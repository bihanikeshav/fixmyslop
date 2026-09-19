import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveIntent, STYLE_INTENT_FIELDS, SURFACE_JOB_PRIORS, functionalScore, FUNCTIONAL_THRESHOLD } from "./intent.mjs";

test("schema descriptor exports the dial list", () => {
  assert.equal(STYLE_INTENT_FIELDS.dials.length, 12);
  assert.ok(STYLE_INTENT_FIELDS.dials.includes("contentDensity"));
  assert.ok(SURFACE_JOB_PRIORS.dashboard);
});

test("brief aliases: brief/prompt/description/subject canonicalize to sourceBrief and warn", () => {
  for (const key of ["brief", "prompt", "description", "subject"]) {
    const { intent, warnings } = resolveIntent({ surface: "landing-page", job: "explain-and-convert", [key]: "a developer observability tool" });
    assert.equal(intent.sourceBrief, "a developer observability tool", `${key} should populate sourceBrief`);
    assert.ok(warnings.some((w) => w.includes(key) && w.includes("sourceBrief")), `${key} should warn about the canonical key`);
  }
  // canonical key: no warning
  const { intent, warnings } = resolveIntent({ sourceBrief: "x" });
  assert.equal(intent.sourceBrief, "x");
  assert.ok(!warnings.some((w) => w.includes("canonical key")), "sourceBrief should not warn");
});

test("brief aliases feed the seed so the same brief is stable across keys", () => {
  const a = resolveIntent({ surface: "landing-page", sourceBrief: "dev observability tool" }).seed;
  const b = resolveIntent({ surface: "landing-page", brief: "dev observability tool" }).seed;
  assert.equal(a, b, "sourceBrief and brief should derive the same seed");
});

test("out-of-range dials clamp to [0,1]", () => {
  const { intent } = resolveIntent({
    surface: "landing-page",
    trustLevel: 5, contentDensity: -3, energy: 1.5, warmth: -0.2,
    formality: 0.5, era: 0, craft: 1, experimentalism: 2,
    motionIntensity: -1, layoutVariance: 0.5, materiality: 10, contrastPreference: -10,
  });
  for (const dial of STYLE_INTENT_FIELDS.dials) {
    assert.ok(intent[dial] >= 0 && intent[dial] <= 1, `${dial}=${intent[dial]} out of range`);
  }
  assert.equal(intent.trustLevel, 1);
  assert.equal(intent.contentDensity, 0);
});

test("dashboard intent with null contentDensity fills high from priors", () => {
  const { intent, warnings } = resolveIntent({ surface: "dashboard", job: "monitor", contentDensity: null });
  assert.ok(intent.contentDensity > 0.6, `expected >0.6, got ${intent.contentDensity}`);
  assert.ok(intent.motionIntensity <= 0.25);
  assert.equal(warnings.length, 0);
});

test("contradiction: craft>0.8 + era<0.15 + experimentalism>0.85", () => {
  const { warnings } = resolveIntent({ craft: 0.9, era: 0.05, experimentalism: 0.9 });
  assert.ok(warnings.some((w) => /craft/.test(w) && /era/.test(w)));
});

test("contradiction: contentDensity>0.8 + motionIntensity>0.7", () => {
  const { warnings } = resolveIntent({ contentDensity: 0.85, motionIntensity: 0.75 });
  assert.ok(warnings.some((w) => /contentDensity/.test(w) && /motionIntensity/.test(w)));
});

test("contradiction: theme dark + contrastPreference<0.3", () => {
  const { warnings } = resolveIntent({ theme: "dark", contrastPreference: 0.1 });
  assert.ok(warnings.some((w) => /dark/.test(w) && /contrastPreference/.test(w)));
});

test("determinism: same intent + seed → identical output", () => {
  const input = { surface: "docs", job: "long-form", craft: 0.7, seed: 42, variation: 2 };
  const a = resolveIntent(input);
  const b = resolveIntent(input);
  assert.deepEqual(a, b);
  assert.equal(a.seed, 42);
});

test("determinism: same intent + nonce (no explicit seed) → identical seed", () => {
  const input = { surface: "app", variation: 3, nonce: "abc" };
  const a = resolveIntent(input);
  const b = resolveIntent(input);
  assert.equal(a.seed, b.seed);
  assert.ok(Number.isInteger(a.seed) && a.seed >= 0);
});

test("sourceBrief survives verbatim", () => {
  const brief = "a warm, trustworthy fintech landing page for skeptical freelancers";
  const { intent } = resolveIntent({ surface: "landing-page", sourceBrief: brief });
  assert.equal(intent.sourceBrief, brief);
});

test("unknown surface pushes a warning and uses neutral defaults", () => {
  const { intent, warnings } = resolveIntent({ surface: "carnival-float" });
  assert.ok(warnings.some((w) => /unknown surface/.test(w)));
  for (const dial of STYLE_INTENT_FIELDS.dials) {
    assert.equal(intent[dial], 0.5, `${dial} should default neutral`);
  }
});

test("defaults: theme, variation, audience, references", () => {
  const { intent } = resolveIntent({});
  assert.equal(intent.theme, "light");
  assert.equal(intent.variation, 0);
  assert.deepEqual(intent.audience, []);
  assert.deepEqual(intent.references, []);
});

test("resolveIntent never throws on empty input and returns the expected shape", () => {
  const result = resolveIntent();
  assert.ok("intent" in result);
  assert.ok("seed" in result);
  assert.ok(Array.isArray(result.warnings));
});

// functionalScore used to be hand-copied into engine.mjs (surfaceFontEnvelope), background.mjs
// (functionalScoreOf) and spec.mjs (functionalScoreOf). All three now import it from here.
// This guards the consolidation: the shared definition must still be the exact formula the
// copies implemented, over the same clamp01(v, 0.5) fallback behaviour.
test("functionalScore: single shared definition, unchanged formula", () => {
  const literal = (iv) => {
    const c = (n) => { const x = Number(n); return Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0.5; };
    return c(0.4 * c(iv.contentDensity) + 0.35 * c(iv.formality) + 0.25 * (1 - c(iv.energy)));
  };
  const cases = [
    {}, { contentDensity: 0, formality: 0, energy: 0 }, { contentDensity: 1, formality: 1, energy: 1 },
    { contentDensity: 0.8, formality: 0.7, energy: 0.35 }, { contentDensity: 0.2, formality: 0.1, energy: 0.9 },
    { contentDensity: "0.63", formality: null, energy: undefined },
    { contentDensity: -3, formality: 4, energy: NaN },
    { contentDensity: 0.5123456789, formality: 0.3333333333, energy: 0.6666666667 },
  ];
  for (const iv of cases) assert.equal(functionalScore(iv), literal(iv), JSON.stringify(iv));
  // every consumer must be reading the SAME number
  assert.equal(FUNCTIONAL_THRESHOLD, 0.55);
});
