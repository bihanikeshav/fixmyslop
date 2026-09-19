/**
 * Small shared numeric helpers. Used across core and pipeline so the same
 * clamping behaviour isn't redefined (and allowed to drift) in every file.
 */

/** Clamp to the closed unit interval [0, 1]. */
export function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/**
 * Clamp to [0, 1], but treat a non-finite input (NaN, +-Infinity) as the
 * neutral midpoint 0.5 instead of propagating garbage. Used where a metric is
 * derived from a division that can legitimately produce NaN (e.g. 0/0) and the
 * caller wants "unknown, assume average" rather than "unknown, assume zero".
 */
export function clamp01OrMid(n: number): number {
  return Number.isFinite(n) ? clamp01(n) : 0.5;
}
