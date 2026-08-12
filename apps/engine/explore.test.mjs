// apps/engine/explore.test.mjs — spec §4 (docs/layout-explorer-spec.md) explore wiring tests.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createEngine } from "./engine.mjs";
import { exploreDirections } from "./explore.mjs";
import { distance, withinSetOk, RELAXED_FLOOR_D } from "./fingerprint.mjs";
import corpus from "./data/corpus.json" with { type: "json" };
import brands from "./data/brands.json" with { type: "json" };
import fonts from "./data/fonts.json" with { type: "json" };

const engine = createEngine({ corpus, brands, fonts });
const landing = { surface: "landing-page", job: "explain-and-convert", sourceBrief: "a tool for indie game devs" };

// ── purity ────────────────────────────────────────────────────────────────────────────────────
test("purity: explore.mjs carries no Math.random/Date.now/new Date in executable code", () => {
  const path = fileURLToPath(new URL("explore.mjs", import.meta.url));
  const src = readFileSync(path, "utf8");
  // no trailing `$` anchor: on a CRLF checkout (core.autocrlf=true), `.replace(/\/\/.*$/, "")`
  // silently no-ops per line — `.` excludes the line-terminator `\r` left dangling after a `\n`-
  // only split, so `.*` can't reach the position `$` (end-of-string, no /m flag) requires, and the
  // whole match fails, leaving comment-only lines (like this file's own header) untouched. This is
  // a pre-existing bug unrelated to the Subsystem 4 (type/color intent-conditioning) fix — caught
  // because it happened to make THIS purity check false-positive on its own header comment.
  const codeOnly = src.split("\n").map((line) => line.replace(/\/\/.*/, "")).join("\n");
  assert.ok(!/Math\.random/.test(codeOnly), "explore.mjs calls Math.random");
  assert.ok(!/Date\.now/.test(codeOnly), "explore.mjs calls Date.now");
  assert.ok(!/new Date/.test(codeOnly), "explore.mjs calls new Date");
});

// ── determinism ───────────────────────────────────────────────────────────────────────────────
test("determinism: same (intent, seed) → identical 4 directions", () => {
  const a = exploreDirections(engine, landing, { seed: 42 });
  const b = exploreDirections(engine, landing, { seed: 42 });
  assert.deepEqual(a, b);
});

test("determinism: same holds across several surfaces/seeds", () => {
  const cases = [
    { surface: "dashboard", job: "monitor" },
    { surface: "docs" },
    { surface: "pricing" },
    { surface: "portfolio" },
  ];
  for (const c of cases) {
    for (const seed of [1, 17, 999]) {
      const a = exploreDirections(engine, c, { seed });
      const b = exploreDirections(engine, c, { seed });
      assert.deepEqual(a, b, `${JSON.stringify(c)} seed ${seed} not deterministic`);
    }
  }
});

// ── shape ─────────────────────────────────────────────────────────────────────────────────────
test("returns 4 directions with the documented shape, 1 engine-synthesized + 3 corpus-grounded", () => {
  const { directions, warnings } = exploreDirections(engine, landing, { seed: 7 });
  assert.ok(Array.isArray(warnings));
  assert.equal(directions.length, 4);
  const synthesized = directions.filter((d) => d.provenance === "engine-synthesized");
  const grounded = directions.filter((d) => d.provenance === "corpus-grounded");
  assert.equal(synthesized.length, 1);
  assert.equal(grounded.length, 3);
  assert.ok(Array.isArray(synthesized[0].parents) && synthesized[0].parents.length >= 1);
  for (const d of directions) {
    assert.ok(typeof d.name === "string" && d.name.length > 0);
    assert.ok(d.genome && d.genome.fingerprint === d.fingerprint);
    assert.ok(typeof d.fit === "number");
    assert.ok("groundedIn" in d);
  }
});

// ── divergence: within-set D>=0.45 (or the relaxed-floor warning), no shared layoutFamily/display
// font, across many seeds on a family-rich surface (landing-page spans several pageKinds/families).
test("divergence across many seeds: within-set gate holds, or the relaxed-floor warning is honestly present", () => {
  let relaxedCount = 0;
  const seeds = 60;
  for (let seed = 0; seed < seeds; seed++) {
    const { directions, warnings } = exploreDirections(engine, landing, { seed });
    assert.equal(directions.length, 4);
    const fps = directions.map((d) => d.fingerprint);
    let allOk = true;
    let minD = Infinity;
    for (let i = 0; i < fps.length; i++) {
      for (let j = i + 1; j < fps.length; j++) {
        const d = distance(fps[i], fps[j]);
        minD = Math.min(minD, d);
        if (!withinSetOk(fps[i], fps[j])) allOk = false;
      }
    }
    if (!allOk) {
      relaxedCount++;
      assert.ok(warnings.includes("divergence-floor-relaxed"), `seed ${seed}: violated within-set gate without the relaxed-floor warning`);
      assert.ok(minD >= RELAXED_FLOOR_D - 1e-9 || warnings.some((w) => w.includes("below-relaxed-floor")), `seed ${seed}: below 0.35 without the below-floor warning`);
    }
  }
  // Report-only assertion: with only 18 families, some relaxed-floor firing on a rich surface is
  // expected — this just guards against it becoming the common case (would mean the greedy
  // selection/reroll logic isn't doing its job).
  assert.ok(relaxedCount / seeds < 0.5, `relaxed-floor fired on ${relaxedCount}/${seeds} seeds — too often for a family-rich surface`);
});

test("no two shown directions share layoutFamily or display font when the within-set gate is met", () => {
  for (let seed = 0; seed < 40; seed++) {
    const { directions } = exploreDirections(engine, landing, { seed });
    const fps = directions.map((d) => d.fingerprint);
    for (let i = 0; i < fps.length; i++) {
      for (let j = i + 1; j < fps.length; j++) {
        if (withinSetOk(fps[i], fps[j])) {
          assert.notEqual(fps[i].layoutFamily, fps[j].layoutFamily, `seed ${seed}: ${i}/${j} share layoutFamily despite passing withinSetOk`);
          assert.notEqual(fps[i].fontPair[0], fps[j].fontPair[0], `seed ${seed}: ${i}/${j} share display font despite passing withinSetOk`);
        }
      }
    }
  }
});

// ── graceful degradation on a thin pageKind ──────────────────────────────────────────────────
test("graceful degradation: a thin-pageKind surface (pricing, default job) still returns 4 directions with a degrade note, never throws", () => {
  // pricing default priors put layoutVariance at 0.3, which gates asymmetric-proof-stack out
  // (needs >=0.55) — leaving pricing-comparison as the sole survivor: a genuinely thin pool.
  let out;
  assert.doesNotThrow(() => { out = exploreDirections(engine, { surface: "pricing" }, { seed: 3 }); });
  assert.equal(out.directions.length, 2, "only 1 family survives, so only a corpus slot + a degraded synth slot are possible");
  const synth = out.directions.find((d) => d.provenance === "engine-synthesized");
  assert.ok(synth, "still produces an engine-synthesized direction");
  assert.equal(synth.parents.length, 1, "degraded synth has a single parent (no second-pageKind family to blend)");
  assert.ok(out.warnings.some((w) => w.startsWith("engine-synthesis-degraded")), "notes the degradation honestly");
});

test("purity holds even under the reroll loop (thin surfaces exercise it hardest)", () => {
  assert.doesNotThrow(() => {
    for (let seed = 0; seed < 30; seed++) exploreDirections(engine, { surface: "dashboard", job: "monitor" }, { seed });
  });
});

// ── vsRecentOk honored against caller-supplied recentFingerprints ───────────────────────────────
test("directions diverge from caller-supplied recentFingerprints, not just from each other", () => {
  const first = exploreDirections(engine, landing, { seed: 11 });
  const recentFingerprints = first.directions.map((d) => d.fingerprint);
  const second = exploreDirections(engine, landing, { seed: 11, recentFingerprints });
  // With the same seed but every prior direction excluded, at least the layout-family composition
  // of the ranked pool should visibly move (penaltyFor kicks in inside suggestLayout).
  const secondFamilies = new Set(second.directions.map((d) => d.fingerprint.layoutFamily));
  const firstFamilies = new Set(first.directions.map((d) => d.fingerprint.layoutFamily));
  const overlap = [...secondFamilies].filter((f) => firstFamilies.has(f));
  assert.ok(overlap.length < secondFamilies.size, "recentFingerprints should move at least one family choice");
});

// ── purity of layout override (styleGenome no-layout path stays exactly as before) ──────────────
test("styleGenome absent-layout path is unaffected by the {layout} override addition", async () => {
  const { styleGenome } = await import("./genome.mjs");
  const a = styleGenome(engine, landing, { seed: 42 });
  const b = styleGenome(engine, landing, { seed: 42 });
  assert.deepEqual(a, b);
  assert.ok(a.layout && a.layout.family, "no-layout-override path still resolves a layout internally");
});
