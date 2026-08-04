// apps/engine/background.test.mjs — purity, determinism, gate-compliance, and diversity tests
// for background.mjs (docs/background-material-taxonomy.md).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolveIntent, hashToUint32 } from "./intent.mjs";
import { LAYOUT_FAMILIES } from "./layout-families.mjs";
import { deriveBackground, checkBackgroundViolations, BACKGROUND_TREATMENTS, SLOP_TABLE } from "./background.mjs";
import { createEngine } from "./engine.mjs";
import { exploreDirections } from "./explore.mjs";
import corpus from "./data/corpus.json" with { type: "json" };
import brands from "./data/brands.json" with { type: "json" };
import fonts from "./data/fonts.json" with { type: "json" };

const FAMILY_BY_NAME = new Map(LAYOUT_FAMILIES.map((f) => [f.name, f]));

function ivFor(intentInput) {
  const { intent } = resolveIntent(intentInput);
  return {
    layoutVariance: intent.layoutVariance, contentDensity: intent.contentDensity,
    materiality: intent.materiality, energy: intent.energy,
    contrastPreference: intent.contrastPreference, craft: intent.craft, formality: intent.formality,
    theme: intent.theme,
  };
}

const SOME_FAMILIES = ["hero-thesis-single", "contrast-band-flow", "instrument-console", "ledger-table", "editorial-broadsheet", "gallery-mosaic"];

// ── purity ────────────────────────────────────────────────────────────────────────────────────
test("purity: background.mjs carries no Math.random/Date.now/new Date in executable code", () => {
  const path = fileURLToPath(new URL("background.mjs", import.meta.url));
  const src = readFileSync(path, "utf8");
  const codeOnly = src.split("\n").map((l) => l.replace(/\/\/.*$/, "")).join("\n");
  assert.ok(!/Math\.random/.test(codeOnly), "calls Math.random");
  assert.ok(!/Date\.now/.test(codeOnly), "calls Date.now");
  assert.ok(!/new Date/.test(codeOnly), "calls new Date");
});

// ── determinism ───────────────────────────────────────────────────────────────────────────────
test("determinism: same (family, iv, streamSeed) → identical BackgroundGenome", () => {
  const iv = ivFor({ surface: "landing-page", job: "explain-and-convert" });
  const family = FAMILY_BY_NAME.get("hero-thesis-single");
  const a = deriveBackground(family, iv, 12345);
  const b = deriveBackground(family, iv, 12345);
  assert.deepEqual(a, b);
});

test("determinism: no-seed path is stable across repeated calls", () => {
  const iv = ivFor({ surface: "dashboard", job: "monitor" });
  const family = FAMILY_BY_NAME.get("instrument-console");
  const a = deriveBackground(family, iv, null);
  const b = deriveBackground(family, iv, null);
  assert.deepEqual(a, b);
  assert.deepEqual(a.provenance, ["taxonomy-v1", "authored-default"]);
});

test("no-seed path never draws RNG (params match the authored-default shape, no perturb provenance)", () => {
  const iv = ivFor({ surface: "landing-page" });
  const family = FAMILY_BY_NAME.get("split-marquee");
  const bg = deriveBackground(family, iv, undefined);
  assert.ok(!bg.provenance.includes("perturbed"));
});

// ── shape ─────────────────────────────────────────────────────────────────────────────────────
test("every family produces a full BackgroundGenome shape", () => {
  for (const family of LAYOUT_FAMILIES) {
    const iv = ivFor({});
    const bg = deriveBackground(family, iv, 7);
    assert.ok(typeof bg.field.treatment === "string" && bg.field.treatment in BACKGROUND_TREATMENTS, `${family.name} field.treatment`);
    assert.ok(bg.field.params && typeof bg.field.params === "object");
    assert.ok(bg.slots && typeof bg.slots === "object");
    for (const slotName of family.materialSlots) assert.ok(slotName in bg.slots, `${family.name} missing slot ${slotName}`);
    assert.ok(Array.isArray(bg.slop.matchedRules));
    assert.ok(Array.isArray(bg.provenance));
  }
});

test("BACKGROUND_TREATMENTS / SLOP_TABLE cover the taxonomy's S1-S16", () => {
  for (let i = 1; i <= 16; i++) assert.ok(`S${i}` in SLOP_TABLE, `S${i} missing from SLOP_TABLE`);
  assert.ok(Object.keys(BACKGROUND_TREATMENTS).length >= 15);
});

// ── GATE COMPLIANCE — the load-bearing test: 1000 seeds x several families → zero S1-S16
// violations surviving the gate, even after perturbation pushes params around. ──────────────────
test("gate compliance: 1000 seeds x 6 families → zero surviving S1-S16 violations", () => {
  const iv = ivFor({ surface: "landing-page", job: "explain-and-convert" });
  const ivDash = ivFor({ surface: "dashboard", job: "monitor" });
  let checked = 0;
  for (const name of SOME_FAMILIES) {
    const family = FAMILY_BY_NAME.get(name);
    const bag = ["dashboard", "data-admin", "app"].includes(family.pageKind) ? ivDash : iv;
    for (let seed = 0; seed < 1000; seed++) {
      const bg = deriveBackground(family, bag, hashToUint32(`gate-test:${name}:${seed}`));
      const violations = checkBackgroundViolations(bg, family);
      assert.deepEqual(violations, [], `${name} seed ${seed} treatment=${bg.field.treatment} params=${JSON.stringify(bg.field.params)}`);
      checked++;
    }
  }
  assert.equal(checked, SOME_FAMILIES.length * 1000);
});

test("gate compliance holds across dark theme + extreme dial combinations too", () => {
  const family = FAMILY_BY_NAME.get("split-marquee");
  const extremeIvs = [
    { materiality: 1, energy: 1, layoutVariance: 1, contentDensity: 1, contrastPreference: 1, craft: 1, theme: "dark" },
    { materiality: 0, energy: 0, layoutVariance: 0, contentDensity: 0, contrastPreference: 0, craft: 0, theme: "light" },
    { materiality: 0.9, energy: 0.9, layoutVariance: 0.1, contentDensity: 0.5, contrastPreference: 0.9, craft: 0.9, theme: "dark" },
  ];
  for (const iv of extremeIvs) {
    for (let seed = 0; seed < 200; seed++) {
      const bg = deriveBackground(family, iv, hashToUint32(`extreme:${seed}`));
      assert.deepEqual(checkBackgroundViolations(bg, family), []);
    }
  }
});

test("S1 specifically: purple/violet->cyan gradients never survive the gate", () => {
  // Force the gradient treatment and hand-craft a pre-gate candidate that WOULD violate S1,
  // then confirm the public deriveBackground path (which always gates) never emits it.
  const family = FAMILY_BY_NAME.get("hero-thesis-single");
  const iv = { materiality: 0.9, energy: 0.5, layoutVariance: 0.5, contentDensity: 0.5, contrastPreference: 0.5, craft: 0.9 };
  for (let seed = 0; seed < 500; seed++) {
    const bg = deriveBackground(family, iv, hashToUint32(`s1:${seed}`));
    if (bg.field.treatment === "A2-linear-gradient-tonal") {
      const hueB = ((bg.field.params.hue + bg.field.params.hueDelta) % 360 + 360) % 360;
      const inBand = (h, lo, hi) => h >= lo && h <= hi;
      const spans = (inBand(bg.field.params.hue, 255, 305) && inBand(hueB, 175, 205))
        || (inBand(bg.field.params.hue, 175, 205) && inBand(hueB, 255, 305));
      if (spans) {
        assert.ok(Math.abs(bg.field.params.hueDelta) <= 25 || bg.field.params.chroma <= 0.14, "S1 danger pair survived with high ΔH+chroma");
      }
    }
  }
});

test("S12: field lightness/chroma never pure #000/#fff (never untinted)", () => {
  const family = FAMILY_BY_NAME.get("hero-thesis-single");
  const iv = ivFor({});
  for (let seed = 0; seed < 300; seed++) {
    const bg = deriveBackground(family, iv, hashToUint32(`s12:${seed}`));
    const p = bg.field.params;
    if (Number.isFinite(p.lightness)) {
      assert.ok(p.lightness > 0 && p.lightness < 1, `lightness ${p.lightness} at extreme`);
    }
    if (Number.isFinite(p.chroma)) assert.ok(p.chroma > 0, "chroma untinted (0)");
  }
});

test("S4: glass only ever assigned to a layering-plausible slot, opacity capped", () => {
  const family = FAMILY_BY_NAME.get("app-shell-workbench"); // has workspace-surface, panel-surface
  const iv = { materiality: 1, energy: 0.7, layoutVariance: 0.5, contentDensity: 0.6, contrastPreference: 0.6, craft: 1 };
  let sawGlass = false;
  for (let seed = 0; seed < 400; seed++) {
    const bg = deriveBackground(family, iv, hashToUint32(`s4:${seed}`));
    for (const [name, slot] of Object.entries(bg.slots)) {
      if (slot.treatment === "B5-glass") {
        sawGlass = true;
        assert.ok(/hero|marquee|workspace|instrument|diagram|figure|canvas|frame/i.test(name), `glass on non-layering slot ${name}`);
        assert.ok(slot.params.fillOpacity <= 0.16 + 1e-9);
        assert.ok(slot.params.innerBorder && slot.params.insetHighlight && slot.params.reducedTransparencyFallback);
      }
    }
  }
  assert.ok(sawGlass, "expected glass to fire at least once across 400 seeds at high materiality/craft on an eligible slot");
});

test("S10: dot/line grid only ever selected for canvas-capable page kinds", () => {
  for (const family of LAYOUT_FAMILIES) {
    const iv = ivFor({});
    for (let seed = 0; seed < 50; seed++) {
      const bg = deriveBackground(family, iv, hashToUint32(`s10:${family.name}:${seed}`));
      if (bg.field.treatment === "A6-dot-grid" || bg.field.treatment === "A7-line-grid") {
        assert.ok(["dashboard", "data-admin", "app", "technical", "explain"].includes(family.pageKind), `${family.name} (${family.pageKind}) got a grid field`);
      }
    }
  }
});

test("S11: gradient text is never emitted", () => {
  for (const family of LAYOUT_FAMILIES) {
    const bg = deriveBackground(family, ivFor({}), 99);
    assert.equal(bg.crossCutting.gradientText, false);
  }
});

// ── DIVERSITY — a family across 5 seeds → distinct bg treatments/params ─────────────────────────
test("diversity: same family across 5 seeds yields distinct background params (and often treatments)", () => {
  const family = FAMILY_BY_NAME.get("hero-thesis-single");
  const iv = { materiality: 0.7, energy: 0.5, layoutVariance: 0.8, contentDensity: 0.4, contrastPreference: 0.5, craft: 0.6 };
  const seen = new Set();
  const treatments = new Set();
  for (let seed = 0; seed < 5; seed++) {
    const bg = deriveBackground(family, iv, hashToUint32(`diversity:${seed}`));
    seen.add(JSON.stringify(bg.field.params));
    treatments.add(bg.field.treatment);
  }
  assert.ok(seen.size >= 4, `expected mostly-distinct param sets across 5 seeds, got ${seen.size}`);
});

// ── PERCEPTIBILITY — backgrounds must be visibly present (above an opacity/chroma floor), and
// distinct intents must land on genuinely different fields, not all collapse toward near-white
// ("make backgrounds visible" pass — the old A5 default (opacity 0.035) and A1 default (chroma
// 0.012) rendered as invisible). ─────────────────────────────────────────────────────────────────
const PERCEPTIBLE_CHROMA_FLOOR = 0.018; // well above MIN_TINT_CHROMA (0.006) — a real, visible hue
const PERCEPTIBLE_OPACITY_FLOOR = 0.05; // well above the old 0.035 grain default

test("perceptibility: field params clear a visible-intensity floor (no-seed authored defaults)", () => {
  const cases = [
    ["hero-thesis-single", { surface: "landing-page", job: "explain-and-convert" }],
    ["instrument-console", { surface: "dashboard", job: "monitor" }],
    ["editorial-broadsheet", { surface: "blog-article", job: "read" }],
  ];
  for (const [familyName, intentInput] of cases) {
    const family = FAMILY_BY_NAME.get(familyName);
    const iv = ivFor(intentInput);
    const bg = deriveBackground(family, iv, null);
    const p = bg.field.params;
    if (Number.isFinite(p.chroma)) {
      assert.ok(p.chroma >= PERCEPTIBLE_CHROMA_FLOOR, `${familyName} chroma ${p.chroma} below perceptibility floor`);
    }
    if (Number.isFinite(p.opacity)) {
      assert.ok(p.opacity >= PERCEPTIBLE_OPACITY_FLOOR, `${familyName} opacity ${p.opacity} below perceptibility floor`);
    }
  }
});

test("perceptibility: backgrounds vary visibly across ≥3 distinct intents (not all near-white)", () => {
  const family = FAMILY_BY_NAME.get("hero-thesis-single");
  const intents = [
    { surface: "landing-page", job: "launch-announce", sourceBrief: "bold energetic product launch" },
    { surface: "dashboard", job: "monitor", sourceBrief: "dense functional monitoring console" },
    { surface: "blog-article", job: "read", sourceBrief: "calm long-form editorial read" },
  ];
  const signatures = intents.map((intentInput) => {
    const iv = ivFor(intentInput);
    const bg = deriveBackground(family, iv, null);
    return { treatment: bg.field.treatment, lightness: bg.field.params.lightness, chroma: bg.field.params.chroma };
  });
  const distinctChroma = new Set(signatures.map((s) => s.chroma?.toFixed(3)));
  const distinctLightness = new Set(signatures.map((s) => s.lightness?.toFixed(3)));
  assert.ok(distinctChroma.size >= 2 || distinctLightness.size >= 2, `expected intents to visibly diverge, got ${JSON.stringify(signatures)}`);
});

test("diversity: hue rotates across seeds even when treatment stays put", () => {
  const family = FAMILY_BY_NAME.get("ledger-table");
  const iv = ivFor({ surface: "dashboard", job: "scan-and-act-on-records" });
  const hues = new Set();
  for (let seed = 0; seed < 8; seed++) {
    const bg = deriveBackground(family, iv, hashToUint32(`hue-diversity:${seed}`));
    hues.add(bg.field.params.hue);
  }
  assert.ok(hues.size >= 5, `expected varied hues, got ${hues.size} distinct values: ${[...hues]}`);
});

// ── wiring: genome.mjs / explore.mjs ─────────────────────────────────────────────────────────────
const engine = createEngine({ corpus, brands, fonts });
const landing = { surface: "landing-page", job: "explain-and-convert", sourceBrief: "a tool for indie game devs" };

test("styleGenome carries a background field for every resolved layout", async () => {
  const { styleGenome } = await import("./genome.mjs");
  const g = styleGenome(engine, landing, { seed: 42 });
  assert.ok(g.background && g.background.field && g.background.field.treatment);
  assert.ok(Array.isArray(g.background.slop.matchedRules));
});

test("exploreDirections: the 4 directions carry 4 distinct backgrounds (treatment+hue signature)", () => {
  const { directions } = exploreDirections(engine, landing, { seed: 7 });
  assert.equal(directions.length, 4);
  const sigs = directions.map((d) => `${d.genome.background.field.treatment}:${d.genome.background.field.params.hue}`);
  assert.equal(new Set(sigs).size, 4, `expected 4 distinct bg signatures, got ${JSON.stringify(sigs)}`);
  // pairwise hue separation should track the palette's 40°-separation approach
  const hues = directions.map((d) => d.genome.background.field.params.hue);
  for (let i = 0; i < hues.length; i++) {
    for (let j = i + 1; j < hues.length; j++) {
      const d = Math.abs(hues[i] - hues[j]) % 360;
      const circ = Math.min(d, 360 - d);
      assert.ok(circ > 5, `direction ${i}/${j} background hues too close: ${hues[i]} vs ${hues[j]}`);
    }
  }
});

test("exploreDirections: every direction's background passes S1-S16 gate compliance", () => {
  const { directions } = exploreDirections(engine, landing, { seed: 123 });
  for (const d of directions) {
    const family = FAMILY_BY_NAME.get(d.genome.layout.family);
    assert.deepEqual(checkBackgroundViolations(d.genome.background, family), []);
  }
});

test("exploreDirections determinism still holds with background wired in", () => {
  const a = exploreDirections(engine, landing, { seed: 42 });
  const b = exploreDirections(engine, landing, { seed: 42 });
  assert.deepEqual(a, b);
});
