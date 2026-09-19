/**
 * Merge helper for multi-window Observation accumulation.
 *
 * sample-gpt.ts and sample-synthetic.ts each produce a batch of Observations
 * for the current run, all stamped `window: 0`. Historically each run
 * OVERWROTE its observations.*.json file outright, so the multi-window decay
 * logic in @fixmyslop/core's saturation.ts never saw more than one window —
 * `trend` was always computed against an empty prior window.
 *
 * This module makes runs accumulate by default: existing observations are
 * aged by one window (window -> window + 1) and the fresh batch is prepended
 * as window 0, bounded to MAX_WINDOWS so the file doesn't grow without limit.
 * Callers can still opt into the old overwrite behaviour via a `--fresh` flag.
 */
import { readFile } from "node:fs/promises";
import type { Observation } from "@fixmyslop/core";

/** Number of distinct windows kept before the oldest is dropped. */
export const MAX_WINDOWS = 8;

/** Load a prior observations file, or `[]` if it doesn't exist yet. */
export async function loadObservations(path: string): Promise<Observation[]> {
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as Observation[];
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

/**
 * Pure merge: age `prior` observations by one window (window -> window + 1)
 * and prepend `fresh` (assumed to already be stamped window 0). Observations
 * that age past `maxWindows` are dropped. Deterministic; no I/O.
 */
export function mergeObservations(
  prior: readonly Observation[],
  fresh: readonly Observation[],
  maxWindows: number = MAX_WINDOWS,
): Observation[] {
  const shifted = prior.map((o): Observation => ({ ...o, window: o.window + 1 }));
  return [...fresh, ...shifted].filter((o) => o.window < maxWindows);
}
