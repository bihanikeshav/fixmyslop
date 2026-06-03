/**
 * The anti-inductive recommender — the beating heart of the Brain.
 *
 *   recommend = high quality x low CURRENT saturation
 *
 * Hard rules (from the spec, section 2):
 *   - Saturation only RE-ORDERS within the quality-floored set. A font below the
 *     quality threshold is never recommended, no matter how rare. You never get
 *     "weird ugly font", only "good and less worn".
 *   - For display picks, foundational (invisible-infrastructure) fonts are excluded.
 *   - freshness dials how hard saturation is penalized: 0 = ignore saturation
 *     (safe/mainstream ok), 1 = maximally avoid the mainstream.
 *
 * Deterministic: given the same candidates + query it always returns the same
 * ranking (stable tiebreak by font id).
 */

import { personalityMatch } from "./personality.js";
import type {
  FontRecord,
  Recommendation,
  RecommendQuery,
  SaturationStat,
} from "./types.js";

export interface Candidate {
  font: FontRecord;
  /** Composite quality 0..1 (from quality.compositeQuality). */
  quality: number;
  saturation: SaturationStat;
}

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

export function recommend(
  candidates: readonly Candidate[],
  query: RecommendQuery,
): Recommendation[] {
  const freshness = clamp01(query.freshness);

  const scored: Recommendation[] = [];
  for (const c of candidates) {
    // Quality floor: hard gate. Saturation can never rescue a low-quality font in.
    if (c.quality < query.qualityThreshold) continue;

    // Display picks never surface foundational/infrastructure fonts.
    if (query.role === "display" && c.font.isFoundational) continue;

    const match = personalityMatch(query.target, c.font.personality);
    if (match === 0 && Object.keys(query.target).length > 0) continue;

    const sat = query.role === "display" ? c.saturation.display : c.saturation.body;
    // Anti-inductive penalty: scaled by freshness. Rising trends are penalized
    // a little harder so things heading toward slop fall faster.
    const trendBoost = c.saturation.trend > 0 ? c.saturation.trend * 0.25 : 0;
    const penalty = clamp01(freshness * (sat + trendBoost));

    const score = c.quality * match * (1 - penalty);

    scored.push({
      font: c.font,
      score,
      qualityScore: c.quality,
      personalityMatch: match,
      displaySaturation: c.saturation.display,
      reasons: buildReasons(c.quality, match, sat, freshness, query.role),
    });
  }

  scored.sort((a, b) => b.score - a.score || cmpId(a.font.id, b.font.id));
  return scored.slice(0, Math.max(0, query.limit));
}

function buildReasons(
  quality: number,
  match: number,
  sat: number,
  freshness: number,
  role: string,
): string[] {
  const r: string[] = [];
  r.push(`quality ${quality.toFixed(2)} (above floor)`);
  if (match < 1) r.push(`personality match ${match.toFixed(2)}`);
  if (freshness > 0) {
    r.push(
      sat < 0.2
        ? `under-saturated in ${role} role (${sat.toFixed(2)})`
        : `saturation ${sat.toFixed(2)} penalized at freshness ${freshness.toFixed(2)}`,
    );
  }
  return r;
}

function cmpId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
