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

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

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
