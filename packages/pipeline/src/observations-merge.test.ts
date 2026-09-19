import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { Observation } from "@fixmyslop/core";
import { mergeObservations, loadObservations, MAX_WINDOWS } from "./observations-merge.js";

const HERE = dirname(fileURLToPath(import.meta.url));

const obs = (fontId: string, window: number, count = 1): Observation => ({
  fontId,
  role: "display",
  window,
  count,
  signal: "synthetic",
});

describe("mergeObservations", () => {
  it("prepends fresh (window 0) observations unchanged", () => {
    const merged = mergeObservations([], [obs("a", 0)]);
    expect(merged).toEqual([obs("a", 0)]);
  });

  it("ages every prior observation by exactly one window", () => {
    const prior = [obs("a", 0), obs("b", 1)];
    const merged = mergeObservations(prior, []);
    expect(merged.map((o) => o.window)).toEqual([1, 2]);
  });

  it("multiple runs accumulate distinct windows instead of overwriting", () => {
    let observations: Observation[] = [];
    observations = mergeObservations(observations, [obs("a", 0, 5)]); // run 1
    observations = mergeObservations(observations, [obs("a", 0, 3)]); // run 2
    observations = mergeObservations(observations, [obs("a", 0, 1)]); // run 3
    const windows = observations.map((o) => o.window).sort((x, y) => x - y);
    expect(windows).toEqual([0, 1, 2]);
    // The multi-window decay logic can now see more than one window for "a".
    expect(new Set(windows).size).toBeGreaterThan(1);
  });

  it("drops observations that age past maxWindows", () => {
    const prior = [obs("a", MAX_WINDOWS - 1)]; // one run away from the cutoff
    const merged = mergeObservations(prior, [], MAX_WINDOWS);
    expect(merged).toEqual([]);
  });

  it("keeps observations right at the boundary", () => {
    const prior = [obs("a", MAX_WINDOWS - 2)];
    const merged = mergeObservations(prior, [], MAX_WINDOWS);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.window).toBe(MAX_WINDOWS - 1);
  });

  it("is pure: does not mutate its inputs", () => {
    const prior = [obs("a", 0)];
    const priorCopy = JSON.parse(JSON.stringify(prior));
    mergeObservations(prior, [obs("b", 0)]);
    expect(prior).toEqual(priorCopy);
  });
});

describe("loadObservations", () => {
  it("returns [] when the file doesn't exist", async () => {
    const result = await loadObservations(resolve(HERE, "does-not-exist.observations.json"));
    expect(result).toEqual([]);
  });
});
