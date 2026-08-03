import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveIntent, STYLE_INTENT_FIELDS, SURFACE_JOB_PRIORS } from "./intent.mjs";

test("schema descriptor exports the dial list", () => {
  assert.equal(STYLE_INTENT_FIELDS.dials.length, 12);
  assert.ok(STYLE_INTENT_FIELDS.dials.includes("contentDensity"));
  assert.ok(SURFACE_JOB_PRIORS.dashboard);
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
