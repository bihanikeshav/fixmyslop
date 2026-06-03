/**
 * Role-aware saturation model.
 *
 * Merges the three signals (synthetic AI / real crawl / community) into one
 * role-segmented saturation per font, recency-weighted. Deterministic: the caller
 * passes the current window index, never Date.now().
 */

import type { FontRole, SaturationStat } from "./types.js";

/** One observation of a font used in a role, in a given weekly window. */
export interface Observation {
  fontId: string;
  role: FontRole;
  /** Weekly window index (monotonic). Higher = more recent. */
  window: number;
  /** Count of sightings in that window. */
  count: number;
  /** Which signal produced it (weighted differently). */
  signal: "synthetic" | "crawl" | "community";
}

export interface SaturationConfig {
  /** The current (latest) window index. Observations are aged relative to this. */
  currentWindow: number;
  /** Per-week decay factor for older observations, 0..1. */
  decay: number;
  /** Relative trust in each signal. */
  signalWeights: Record<Observation["signal"], number>;
  /** Normalizer: count that maps to saturation ~1.0 for a role. */
  saturationScale: number;
}

export const DEFAULT_SATURATION_CONFIG: Omit<SaturationConfig, "currentWindow"> = {
  decay: 0.8,
  signalWeights: { synthetic: 1.0, crawl: 1.0, community: 0.5 },
  saturationScale: 100,
};

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * Compute role-segmented saturation stats for every font seen in the observations.
 * `trend` compares the most recent window's weighted volume against the prior one.
 */
export function computeSaturation(
  observations: readonly Observation[],
  config: SaturationConfig,
): Map<string, SaturationStat> {
  const acc = new Map<
    string,
    { display: number; body: number; displayNow: number; displayPrev: number }
  >();

  for (const o of observations) {
    const age = config.currentWindow - o.window;
    if (age < 0) continue; // ignore future windows
    const recency = Math.pow(config.decay, age);
    const weight = config.signalWeights[o.signal] * recency * o.count;

    const entry =
      acc.get(o.fontId) ?? { display: 0, body: 0, displayNow: 0, displayPrev: 0 };
    if (o.role === "display") {
      entry.display += weight;
      if (age === 0) entry.displayNow += config.signalWeights[o.signal] * o.count;
      if (age === 1) entry.displayPrev += config.signalWeights[o.signal] * o.count;
    } else {
      entry.body += weight;
    }
    acc.set(o.fontId, entry);
  }

  const out = new Map<string, SaturationStat>();
  for (const [fontId, e] of acc) {
    const display = clamp01(e.display / config.saturationScale);
    const body = clamp01(e.body / config.saturationScale);
    const denom = e.displayPrev === 0 ? Math.max(1, e.displayNow) : e.displayPrev;
    const trend = clamp01((e.displayNow - e.displayPrev) / denom);
    out.set(fontId, { fontId, display, body, trend });
  }
  return out;
}
