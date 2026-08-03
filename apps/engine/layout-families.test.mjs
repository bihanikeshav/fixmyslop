// apps/engine/layout-families.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveIntent } from "./intent.mjs";
import { LAYOUT_FAMILIES, LAYOUT_FAMILY_SCHEMA_KEYS, suggestLayout } from "./layout-families.mjs";

const HERO_LANDING = new Set(["hero-thesis-single", "contrast-band-flow"]);
const TOOL_KINDS = new Set(["dashboard", "data-admin", "app"]);

test("exactly 15 families, all named per the spec table", () => {
  assert.equal(LAYOUT_FAMILIES.length, 15);
  const names = LAYOUT_FAMILIES.map((f) => f.name).sort();
  assert.deepEqual(names, [
    "app-shell-workbench", "asymmetric-proof-stack", "contrast-band-flow",
    "editorial-broadsheet", "full-bleed-diagram", "gallery-mosaic", "hero-thesis-single",
    "instrument-console", "ledger-table", "pricing-comparison", "sidebar-doc",
    "spec-sheet", "split-marquee", "stacked-narrative-scroll", "two-pane-reader",
  ]);
});

test("every family has all schema keys and non-empty required lists", () => {
  for (const f of LAYOUT_FAMILIES) {
    for (const key of LAYOUT_FAMILY_SCHEMA_KEYS) {
      assert.ok(key in f, `${f.name} missing key ${key}`);
    }
    for (const list of ["whenToUse", "notFor", "requiredContent", "antiPatterns", "materialSlots", "sectionGrammar"]) {
      assert.ok(Array.isArray(f[list]) && f[list].length > 0, `${f.name}.${list} must be non-empty`);
    }
    assert.equal(f.provenance, "hand-authored");
    for (const dial of ["layoutVariance", "contentDensity"]) {
      assert.ok(Array.isArray(f.dialCompatibility[dial]) && f.dialCompatibility[dial].length === 2, `${f.name}.dialCompatibility.${dial}`);
    }
    for (const m of ["contentWidthShare", "columnCount", "splitRatio", "alignment", "whitespace", "contentDensity"]) {
      assert.ok(m in f.macro, `${f.name}.macro.${m}`);
    }
  }
});

test("sectionGrammar heightShares sum to ~1.0 per family", () => {
  for (const f of LAYOUT_FAMILIES) {
    const sum = f.sectionGrammar.reduce((a, s) => a + s.heightShare, 0);
    assert.ok(Math.abs(sum - 1.0) <= 0.05, `${f.name} heightShare sum = ${sum}`);
    for (const s of f.sectionGrammar) {
      assert.ok(typeof s.role === "string" && s.role.length > 0);
      assert.ok(typeof s.focalPoint === "string" && typeof s.composition === "string");
    }
  }
});

function assertFullGenome(c) {
  assert.ok(typeof c.family === "string");
  assert.ok(typeof c.fit === "number" && Number.isFinite(c.fit));
  assert.ok(typeof c.pageKind === "string");
  assert.ok(Array.isArray(c.sectionGrammar) && c.sectionGrammar.length > 0);
  for (const m of ["contentWidthShare", "columnCount", "splitRatio", "alignment", "whitespace", "contentDensity"]) {
    assert.ok(m in c.macro, `macro.${m}`);
  }
  for (const h of ["focalAreaShare", "headingScaleRatio", "ctaProminence", "contrastConcentration", "repetitionEntropy"]) {
    assert.ok(typeof c.hierarchy[h] === "number", `hierarchy.${h}`);
  }
  for (const k of ["radiusLanguage", "shadowLanguage", "borderLanguage", "accentStrategy", "surfaceTexture"]) {
    assert.ok(typeof c.material[k] === "string", `material.${k}`);
  }
  assert.ok(typeof c.responsive.mobileTransform === "string");
  assert.deepEqual(c.quality, { score: null, confidence: null, provenance: ["hand-authored"] });
  assert.deepEqual(c.slop, { score: null, matchedRules: [] });
}

test("landing intent → >=2 candidates, each a full genome", () => {
  const { intent } = resolveIntent({ surface: "landing-page", job: "explain-and-convert" });
  const cands = suggestLayout(intent);
  assert.ok(cands.length >= 2, `expected >=2, got ${cands.length}`);
  for (const c of cands) assertFullGenome(c);
  // ranked best-first
  for (let i = 1; i < cands.length; i++) assert.ok(cands[i - 1].fit >= cands[i].fit);
});

test("dashboard intent → only tool families, never a hero/contrast landing family", () => {
  const { intent } = resolveIntent({ surface: "dashboard", job: "monitor" });
  const cands = suggestLayout(intent);
  assert.ok(cands.length >= 1);
  for (const c of cands) {
    assert.ok(TOOL_KINDS.has(c.pageKind), `${c.family} is pageKind ${c.pageKind}`);
    assert.ok(!HERO_LANDING.has(c.family), `${c.family} must not appear for dashboard`);
  }
  for (const c of cands) assertFullGenome(c);
});

test("passing a recentFingerprint for the top family changes the ranking", () => {
  const { intent } = resolveIntent({ surface: "landing-page", job: "explain-and-convert" });
  const base = suggestLayout(intent);
  assert.ok(base.length >= 2);
  const topName = base[0].family;
  const penalized = suggestLayout(intent, { recentFingerprints: [topName] });
  assert.notEqual(penalized[0].family, topName);
  // and the penalized family's fit drops below its unpenalized value
  const before = base.find((c) => c.family === topName).fit;
  const after = penalized.find((c) => c.family === topName).fit;
  assert.ok(after < before);
});

test("recentFingerprint as an object with .layoutFamily also penalizes", () => {
  const { intent } = resolveIntent({ surface: "landing-page", job: "explain-and-convert" });
  const base = suggestLayout(intent);
  const topName = base[0].family;
  const penalized = suggestLayout(intent, { recentFingerprints: [{ layoutFamily: topName }] });
  assert.notEqual(penalized[0].family, topName);
});

test("dashboard whitespace derives from contentDensity (dense → low whitespace)", () => {
  const { intent } = resolveIntent({ surface: "dashboard", job: "monitor" });
  const cands = suggestLayout(intent);
  for (const c of cands) assert.ok(c.macro.whitespace < 0.45, `${c.family} whitespace ${c.macro.whitespace}`);
});
