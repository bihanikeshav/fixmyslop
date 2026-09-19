/**
 * The objective "quality floor" — computed purely from font metrics, no taste.
 *
 * Two jobs:
 *  1. metricsFloorPass(): a hard filter that kills fonts that are "rare because
 *     broken/limited" rather than rare-and-good.
 *  2. objectiveQuality(): a 0..1 legibility/craft score used as the first of the
 *     three quality votes.
 */

import type { FontMetrics } from "./types.js";
import { clamp01 } from "./util.js";

export interface FloorThresholds {
  minXHeightRatio: number;
  minApertureOpenness: number;
  minCounterSize: number;
  maxStrokeContrast: number;
  minWeightCount: number;
  minCharsetCompleteness: number;
}

export const DEFAULT_FLOOR: FloorThresholds = {
  minXHeightRatio: 0.42,
  minApertureOpenness: 0.25,
  minCounterSize: 0.25,
  maxStrokeContrast: 0.95,
  minWeightCount: 2,
  minCharsetCompleteness: 0.6,
};

/**
 * Returns the list of failed checks. Empty array => the font clears the floor.
 *
 * `apertureOpenness` is `null` when the metric hasn't been measured (no glyph-
 * outline aperture analysis has run for this font yet — see FontMetrics). An
 * unmeasured aperture cannot fail the gate; it's simply skipped, not assumed
 * good or bad.
 */
export function metricsFloorFailures(
  m: FontMetrics,
  t: FloorThresholds = DEFAULT_FLOOR,
): string[] {
  const fails: string[] = [];
  if (m.xHeightRatio < t.minXHeightRatio) fails.push("x-height too small");
  if (m.apertureOpenness != null && m.apertureOpenness < t.minApertureOpenness) {
    fails.push("apertures too closed");
  }
  if (m.counterSize < t.minCounterSize) fails.push("counters too clogged");
  if (m.strokeContrast > t.maxStrokeContrast) fails.push("stroke contrast too extreme");
  if (m.weightCount < t.minWeightCount) fails.push("too few weights");
  if (m.charsetCompleteness < t.minCharsetCompleteness) fails.push("charset incomplete");
  return fails;
}

export function metricsFloorPass(m: FontMetrics, t: FloorThresholds = DEFAULT_FLOOR): boolean {
  return metricsFloorFailures(m, t).length === 0;
}

/**
 * Objective legibility/craft score, 0..1. A weighted blend of the metrics that
 * research links to readability. Moderate stroke contrast is good (some contrast
 * reads as crafted); extreme contrast is penalized.
 *
 * `apertureOpenness` carries a 0.2 weight when measured. When it's `null`
 * (unmeasured — see FontMetrics doc), that weight is dropped and the remaining
 * weights are renormalized over the metrics that ARE measured, so an
 * unmeasured aperture affects neither the score nor the floor gate.
 */
export function objectiveQuality(m: FontMetrics): number {
  const xHeight = clamp01((m.xHeightRatio - 0.4) / 0.4); // 0.4->0, 0.8->1
  const counter = clamp01(m.counterSize);
  // contrast: peak quality around 0.35, falling off toward 0 (flat) and 1 (extreme)
  const contrast = clamp01(1 - Math.abs(m.strokeContrast - 0.35) / 0.65);
  const weights = clamp01(m.weightCount / 8); // 8+ weights = full marks
  const charset = clamp01(m.charsetCompleteness);

  const components: Array<[value: number, weight: number]> = [
    [xHeight, 0.28],
    [counter, 0.17],
    [contrast, 0.12],
    [weights, 0.13],
    [charset, 0.1],
  ];
  if (m.apertureOpenness != null) {
    components.push([clamp01(m.apertureOpenness), 0.2]);
  }

  const totalWeight = components.reduce((s, [, w]) => s + w, 0);
  const score = components.reduce((s, [v, w]) => s + v * w, 0) / totalWeight;

  return clamp01(score);
}
