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

/** Returns the list of failed checks. Empty array => the font clears the floor. */
export function metricsFloorFailures(
  m: FontMetrics,
  t: FloorThresholds = DEFAULT_FLOOR,
): string[] {
  const fails: string[] = [];
  if (m.xHeightRatio < t.minXHeightRatio) fails.push("x-height too small");
  if (m.apertureOpenness < t.minApertureOpenness) fails.push("apertures too closed");
  if (m.counterSize < t.minCounterSize) fails.push("counters too clogged");
  if (m.strokeContrast > t.maxStrokeContrast) fails.push("stroke contrast too extreme");
  if (m.weightCount < t.minWeightCount) fails.push("too few weights");
  if (m.charsetCompleteness < t.minCharsetCompleteness) fails.push("charset incomplete");
  return fails;
}

export function metricsFloorPass(m: FontMetrics, t: FloorThresholds = DEFAULT_FLOOR): boolean {
  return metricsFloorFailures(m, t).length === 0;
}

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * Objective legibility/craft score, 0..1. A weighted blend of the metrics that
 * research links to readability. Moderate stroke contrast is good (some contrast
 * reads as crafted); extreme contrast is penalized.
 */
export function objectiveQuality(m: FontMetrics): number {
  const xHeight = clamp01((m.xHeightRatio - 0.4) / 0.4); // 0.4->0, 0.8->1
  const aperture = clamp01(m.apertureOpenness);
  const counter = clamp01(m.counterSize);
  // contrast: peak quality around 0.35, falling off toward 0 (flat) and 1 (extreme)
  const contrast = clamp01(1 - Math.abs(m.strokeContrast - 0.35) / 0.65);
  const weights = clamp01(m.weightCount / 8); // 8+ weights = full marks
  const charset = clamp01(m.charsetCompleteness);

  const score =
    0.28 * xHeight +
    0.2 * aperture +
    0.17 * counter +
    0.12 * contrast +
    0.13 * weights +
    0.1 * charset;

  return clamp01(score);
}
