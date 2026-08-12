// apps/engine/fingerprint.test.mjs — sanity tests for the §3 fingerprint distance D(a,b).
import { test } from "node:test";
import assert from "node:assert/strict";
import { distance, D, withinSetOk, vsRecentOk, evaluateSet, TOTAL_WEIGHT } from "./fingerprint.mjs";

const FP_A = {
  layoutFamily: "asymmetric-proof-stack",
  canonicalOrder: ["nav", "hero", "proof", "features", "cta", "footer"],
  fontPair: ["Fraktur Sans", "Reading Serif"],
  paletteHue: 30,
  splitRatio: 0.58, whitespace: 0.62, headingScaleRatio: 2.1, columnCount: 2,
  darkBands: "000000",
  radiusLanguage: "controlled-mixed", shadowLanguage: "soft-low-elevation", motionFamily: "slide",
};

test("weights sum to 14 per spec §3", () => {
  assert.equal(TOTAL_WEIGHT, 14);
});

test("D(x, x) = 0", () => {
  assert.equal(distance(FP_A, FP_A), 0);
  assert.equal(distance({ ...FP_A }, { ...FP_A }), 0); // structurally equal, different object identity
});

test("D is symmetric and in [0,1]", () => {
  const FP_B = {
    ...FP_A,
    layoutFamily: "instrument-console",
    canonicalOrder: ["nav", "proof", "features", "features", "unknown"],
    fontPair: ["Other Display", "Other Body"],
    paletteHue: 210,
    splitRatio: 0.24, whitespace: 0.3, headingScaleRatio: 1.6, columnCount: 12,
    darkBands: "010100",
    radiusLanguage: "sharp-minimal", shadowLanguage: "flat-borders-not-shadows", motionFamily: "fade",
  };
  const dab = distance(FP_A, FP_B);
  const dba = distance(FP_B, FP_A);
  assert.equal(dab, dba);
  assert.ok(dab >= 0 && dab <= 1);
  assert.ok(dab > 0.5, `expected FP_A/FP_B to be far apart, got ${dab}`);
});

test("D() alias equals distance()", () => {
  assert.equal(D(FP_A, FP_A), distance(FP_A, FP_A));
});

test("identical-family-different-fonts gives expected spread: not 0, not maximal", () => {
  const sameFamilyDiffFonts = { ...FP_A, fontPair: ["Different Display", "Different Body"] };
  const d = distance(FP_A, sameFamilyDiffFonts);
  assert.ok(d > 0, "different fonts must move the distance off 0");
  assert.ok(d < 0.5, `same family + same everything-else should stay well under 0.5, got ${d}`);
});

test("distance handles missing/null fields as maximally different, never throws", () => {
  assert.doesNotThrow(() => distance({}, {}));
  assert.doesNotThrow(() => distance(null, FP_A));
  assert.doesNotThrow(() => distance(FP_A, undefined));
  const d = distance({}, {});
  assert.ok(d >= 0 && d <= 1);
});

test("hue distance is circular (350 vs 10 is close, not far)", () => {
  const near = { ...FP_A, paletteHue: 350 };
  const wrapped = { ...FP_A, paletteHue: 10 };
  const d = distance(near, wrapped);
  // only paletteHue differs, weight 2/14, circular diff 20/180
  const expected = (2.0 * (20 / 180)) / 14;
  assert.ok(Math.abs(d - expected) < 1e-9, `expected ${expected}, got ${d}`);
});

test("withinSetOk enforces D>=0.45 AND hard rules (no shared family/display font, hue sep>=40)", () => {
  const sameFamily = { ...FP_A, paletteHue: 200 }; // far in hue but same family — must fail
  assert.equal(withinSetOk(FP_A, sameFamily), false);
  const closeHue = { ...FP_A, layoutFamily: "other-family", canonicalOrder: ["nav", "features", "cta"], paletteHue: 35 };
  assert.equal(withinSetOk(FP_A, closeHue), false); // hue sep < 40
});

test("vsRecentOk requires D>=0.30 against every recent fingerprint and no exact repeat triple", () => {
  const recent = [{ ...FP_A, sectionOrderHash: 111 }];
  const candidate = { ...FP_A, layoutFamily: FP_A.layoutFamily, sectionOrderHash: 111 };
  assert.equal(vsRecentOk(candidate, recent), false); // exact triple repeat (same family/order/display font)
  const different = { ...FP_A, layoutFamily: "totally-different", canonicalOrder: ["nav", "cta"], fontPair: ["X", "Y"], paletteHue: 250, sectionOrderHash: 222 };
  assert.equal(vsRecentOk(different, recent), true);
});

test("evaluateSet summarizes a set of fingerprints with min pairwise/vs-recent distances", () => {
  const b = { ...FP_A, layoutFamily: "b", canonicalOrder: ["nav", "cta"], fontPair: ["Bx", "By"], paletteHue: 200 };
  const summary = evaluateSet([FP_A, b], []);
  assert.ok(summary.minPairwiseD != null);
  assert.equal(summary.minVsRecentD, null); // no recent fingerprints supplied
});
