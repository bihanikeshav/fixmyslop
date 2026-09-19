/**
 * Composite quality = the three-vote pipeline.
 *
 *  vote 1: objective metrics       (deterministic, from the font file)
 *  vote 2: attribute-model confidence / craft signal (seeded from O'Donovan data)
 *  vote 3: LLM + human curation     (offline, cached, OUTVOTABLE)
 *
 * The LLM vote can never decide alone: votes 1+2 carry the majority of the weight,
 * so a confident metrics+data signal overrides a stray LLM opinion. This guards
 * against re-introducing AI taste bias.
 */

import type { PersonalityVector } from "./types.js";
import { clamp01 } from "./util.js";

export interface QualityVotes {
  /** From metrics.objectiveQuality(), 0..1. */
  objective: number;
  /** Confidence/craft from the O'Donovan attribute model, 0..1. Optional. */
  attribute?: number;
  /** Human curation (Typewolf / Fonts In Use presence), 0..1. Optional. */
  curation?: number;
  /** LLM-as-judge, 0..1. Optional. Capped influence by construction. */
  llm?: number;
}

export interface QualityWeights {
  objective: number;
  attribute: number;
  curation: number;
  llm: number;
}

/**
 * Default weights. Objective + attribute together are >= 0.6 of any blend, so the
 * deterministic/data votes always dominate the LLM vote.
 */
export const DEFAULT_QUALITY_WEIGHTS: QualityWeights = {
  objective: 0.4,
  attribute: 0.25,
  curation: 0.2,
  llm: 0.15,
};

/**
 * Blend available votes by their weights, renormalizing over only the votes that
 * are present. Always returns 0..1.
 */
export function compositeQuality(
  votes: QualityVotes,
  weights: QualityWeights = DEFAULT_QUALITY_WEIGHTS,
): number {
  const present: Array<[number, number]> = [[clamp01(votes.objective), weights.objective]];
  if (votes.attribute !== undefined) present.push([clamp01(votes.attribute), weights.attribute]);
  if (votes.curation !== undefined) present.push([clamp01(votes.curation), weights.curation]);
  if (votes.llm !== undefined) present.push([clamp01(votes.llm), weights.llm]);

  const totalWeight = present.reduce((s, [, w]) => s + w, 0);
  if (totalWeight === 0) return 0;
  const weighted = present.reduce((s, [v, w]) => s + v * w, 0);
  return clamp01(weighted / totalWeight);
}

/**
 * Derive the "attribute" quality vote (vote 2 — see file header) from a
 * personality vector: the confidence/craft signal carried by the O'Donovan
 * crowdsourced attributes. A font with clearly-perceived, decisive character
 * (ratings far from the 0.5 neutral midpoint, in either direction) reflects a
 * confident crowd signal; a flat/near-neutral or empty vector reflects a weak
 * or absent one.
 *
 * Returns `undefined` — not 0 — when there's no personality data to vote from,
 * so `compositeQuality` drops the vote entirely (renormalizing over the votes
 * that remain) instead of asserting a false "no character" opinion.
 */
export function attributeQualityVote(personality: PersonalityVector): number | undefined {
  const values = Object.values(personality).filter((v): v is number => v !== undefined);
  if (values.length === 0) return undefined;
  const avgDistanceFromNeutral =
    values.reduce((sum, v) => sum + Math.abs(v - 0.5) * 2, 0) / values.length;
  return clamp01(avgDistanceFromNeutral);
}
