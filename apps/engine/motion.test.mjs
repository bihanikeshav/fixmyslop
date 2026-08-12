// apps/engine/motion.test.mjs — purity, determinism, gate-compliance, hard-guarantee, and
// diversity tests for motion.mjs (docs/motion-interaction-taxonomy.md).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolveIntent, hashToUint32 } from "./intent.mjs";
import { LAYOUT_FAMILIES } from "./layout-families.mjs";
import { deriveMotion, checkMotionViolations, MOTION_TREATMENTS, MOTION_SLOP_TABLE } from "./motion.mjs";
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
    contrastPreference: intent.contrastPreference, craft: intent.craft, theme: intent.theme,
  };
}

const SOME_FAMILIES = ["hero-thesis-single", "contrast-band-flow", "instrument-console", "ledger-table", "stacked-narrative-scroll", "split-marquee"];

// ── purity ────────────────────────────────────────────────────────────────────────────────────
test("purity: motion.mjs carries no Math.random/Date.now/new Date in executable code", () => {
  const path = fileURLToPath(new URL("motion.mjs", import.meta.url));
  const src = readFileSync(path, "utf8");
  const codeOnly = src.split("\n").map((l) => l.replace(/\/\/.*$/, "")).join("\n");
  assert.ok(!/Math\.random/.test(codeOnly), "calls Math.random");
  assert.ok(!/Date\.now/.test(codeOnly), "calls Date.now");
  assert.ok(!/new Date/.test(codeOnly), "calls new Date");
});

// ── determinism ───────────────────────────────────────────────────────────────────────────────
test("determinism: same (family, iv, streamSeed) → identical MotionGenome", () => {
  const iv = ivFor({ surface: "landing-page", job: "explain-and-convert" });
  const family = FAMILY_BY_NAME.get("hero-thesis-single");
  const a = deriveMotion(family, iv, 12345);
  const b = deriveMotion(family, iv, 12345);
  assert.deepEqual(a, b);
});

test("determinism: no-seed path is stable across repeated calls", () => {
  const iv = ivFor({ surface: "dashboard", job: "monitor" });
  const family = FAMILY_BY_NAME.get("instrument-console");
  const a = deriveMotion(family, iv, null);
  const b = deriveMotion(family, iv, null);
  assert.deepEqual(a, b);
  assert.deepEqual(a.provenance, ["taxonomy-v1", "authored-default"]);
});

test("no-seed path never draws RNG (no perturbed provenance)", () => {
  const iv = ivFor({ surface: "landing-page" });
  const family = FAMILY_BY_NAME.get("split-marquee");
  const motion = deriveMotion(family, iv, undefined);
  assert.ok(!motion.provenance.includes("perturbed"));
});

// ── shape ─────────────────────────────────────────────────────────────────────────────────────
test("every family produces a full MotionGenome shape", () => {
  for (const family of LAYOUT_FAMILIES) {
    const iv = ivFor({});
    const motion = deriveMotion(family, iv, 7);
    assert.ok(motion.defaults && typeof motion.defaults.enterEasing === "string");
    assert.ok(motion.scroll && motion.scroll.smooth && motion.scroll.snap && motion.scroll.sticky && motion.scroll.parallax && motion.scroll.marquee);
    assert.ok(motion.heroFit && Number.isFinite(motion.heroFit.targetHeightShare));
    assert.ok(motion.reveal && typeof motion.reveal.treatment === "string");
    assert.ok(motion.scrollbar && typeof motion.scrollbar.width === "string");
    for (const slotName of family.materialSlots) assert.ok(slotName in motion.micro, `${family.name} missing micro slot ${slotName}`);
    assert.ok(motion.transitions.page && motion.transitions.section && motion.transitions.state);
    assert.ok(Number.isInteger(motion.intensity) && motion.intensity >= 1 && motion.intensity <= 10);
    assert.ok(Array.isArray(motion.slop.matchedRules));
    assert.ok(Array.isArray(motion.provenance));
  }
});

test("MOTION_TREATMENTS / MOTION_SLOP_TABLE cover the taxonomy's 18 treatments and M1-M16", () => {
  for (let i = 1; i <= 16; i++) assert.ok(`M${i}` in MOTION_SLOP_TABLE, `M${i} missing from MOTION_SLOP_TABLE`);
  assert.ok(Object.keys(MOTION_TREATMENTS).length >= 18);
});

// ── GATE COMPLIANCE — the load-bearing test: 1000 seeds x several families → zero M1-M16
// violations surviving the gate, even after perturbation pushes params around. ────────────────────
test("gate compliance: 1000 seeds x 6 families → zero surviving M1-M16 violations", () => {
  const iv = ivFor({ surface: "landing-page", job: "explain-and-convert" });
  const ivDash = ivFor({ surface: "dashboard", job: "monitor" });
  let checked = 0;
  for (const name of SOME_FAMILIES) {
    const family = FAMILY_BY_NAME.get(name);
    const bag = ["dashboard", "data-admin", "app"].includes(family.pageKind) ? ivDash : iv;
    for (let seed = 0; seed < 1000; seed++) {
      const motion = deriveMotion(family, bag, hashToUint32(`motion-gate-test:${name}:${seed}`));
      const violations = checkMotionViolations(motion, family);
      assert.deepEqual(violations, [], `${name} seed ${seed} intensity=${motion.intensity} violations=${JSON.stringify(violations)}`);
      checked++;
    }
  }
  assert.equal(checked, SOME_FAMILIES.length * 1000);
});

test("gate compliance holds across extreme dial combinations too", () => {
  const family = FAMILY_BY_NAME.get("stacked-narrative-scroll");
  const extremeIvs = [
    { materiality: 1, energy: 1, layoutVariance: 1, contentDensity: 1, contrastPreference: 1, craft: 1, theme: "dark" },
    { materiality: 0, energy: 0, layoutVariance: 0, contentDensity: 0, contrastPreference: 0, craft: 0, theme: "light" },
    { materiality: 0.9, energy: 0.9, layoutVariance: 0.1, contentDensity: 0.5, contrastPreference: 0.9, craft: 0.9, theme: "dark" },
  ];
  for (const iv of extremeIvs) {
    for (let seed = 0; seed < 200; seed++) {
      const motion = deriveMotion(family, iv, hashToUint32(`motion-extreme:${seed}`));
      assert.deepEqual(checkMotionViolations(motion, family), []);
    }
  }
});

// ── THE THREE HARD GUARANTEES — always hold, across every seed/family, perturbed or not ────────
test("HARD guarantee: prefers-reduced-motion fallback always present", () => {
  for (const family of LAYOUT_FAMILIES) {
    for (let seed = 0; seed < 100; seed++) {
      const motion = deriveMotion(family, ivFor({}), hashToUint32(`rm:${family.name}:${seed}`));
      assert.equal(motion.defaults.respectsReducedMotion, true, `${family.name} seed ${seed}`);
    }
  }
  // and the no-seed (authored-default) path too
  for (const family of LAYOUT_FAMILIES) {
    const motion = deriveMotion(family, ivFor({}), null);
    assert.equal(motion.defaults.respectsReducedMotion, true);
  }
});

test("HARD guarantee: core content is never gated invisible-until-scroll", () => {
  for (const family of LAYOUT_FAMILIES) {
    for (let seed = 0; seed < 100; seed++) {
      const motion = deriveMotion(family, ivFor({}), hashToUint32(`render-integrity:${family.name}:${seed}`));
      assert.equal(motion.reveal.gatesCoreContent, false, `${family.name} seed ${seed}`);
    }
  }
});

test("HARD guarantee: hero fits ~100vh (no content spill past the fold)", () => {
  for (const family of LAYOUT_FAMILIES) {
    for (let seed = 0; seed < 100; seed++) {
      const motion = deriveMotion(family, ivFor({}), hashToUint32(`hero-fit:${family.name}:${seed}`));
      assert.ok(motion.heroFit.targetHeightShare >= 0.85 && motion.heroFit.targetHeightShare <= 1.15, `${family.name} seed ${seed}`);
      assert.ok(motion.heroFit.tolerance >= 0.05 && motion.heroFit.tolerance <= 0.2, `${family.name} seed ${seed}`);
    }
  }
});

// ── specific M-rows ───────────────────────────────────────────────────────────────────────────
test("M4/M5: linear and bounce/elastic easing never survive the gate, anywhere in the genome", () => {
  const family = FAMILY_BY_NAME.get("contrast-band-flow");
  const iv = { materiality: 0.7, energy: 0.9, layoutVariance: 0.9, contentDensity: 0.5, contrastPreference: 0.5, craft: 0.9 };
  const SAFE = new Set(["cubic-bezier(0.16,1,0.3,1)", "cubic-bezier(0.22,1,0.36,1)", "cubic-bezier(0.25,1,0.5,1)"]);
  for (let seed = 0; seed < 400; seed++) {
    const motion = deriveMotion(family, iv, hashToUint32(`m4m5:${seed}`));
    assert.ok(SAFE.has(motion.defaults.enterEasing));
    assert.ok(SAFE.has(motion.reveal.easing));
    for (const slot of Object.values(motion.micro)) {
      assert.ok(SAFE.has(slot.hover.easing));
      assert.ok(SAFE.has(slot.press.easing));
    }
    assert.ok(motion.defaults.springConfig.damping >= 15);
  }
});

test("M1: scroll-snap is never mandatory and never on for a non-narrative family", () => {
  for (const family of LAYOUT_FAMILIES) {
    for (let seed = 0; seed < 100; seed++) {
      const motion = deriveMotion(family, ivFor({}), hashToUint32(`m1:${family.name}:${seed}`));
      assert.equal(motion.scroll.snap.mode, "proximity");
      if (motion.scroll.snap.enabled) assert.ok(["story", "marketing", "brand"].includes(family.pageKind));
    }
  }
});

test("M2: parallax stays single-layer, ratio <=0.2", () => {
  const family = FAMILY_BY_NAME.get("stacked-narrative-scroll");
  const iv = { materiality: 0.8, energy: 0.8, layoutVariance: 1, contentDensity: 0.5, contrastPreference: 0.5, craft: 1 };
  for (let seed = 0; seed < 500; seed++) {
    const motion = deriveMotion(family, iv, hashToUint32(`m2:${seed}`));
    assert.ok(motion.scroll.parallax.layers <= 1);
    assert.ok(motion.scroll.parallax.ratio <= 0.2 + 1e-9);
  }
});

test("M12: at most one marquee, slow + pause-on-hover whenever enabled", () => {
  const family = FAMILY_BY_NAME.get("split-marquee");
  const iv = { materiality: 0.7, energy: 0.9, layoutVariance: 0.9, contentDensity: 0.3, contrastPreference: 0.5, craft: 0.8 };
  let sawMarquee = false;
  for (let seed = 0; seed < 500; seed++) {
    const motion = deriveMotion(family, iv, hashToUint32(`m12:${seed}`));
    assert.ok(motion.scroll.marquee.count <= 1);
    if (motion.scroll.marquee.enabled) {
      sawMarquee = true;
      assert.equal(motion.scroll.marquee.pauseOnHover, true);
      assert.notEqual(motion.scroll.marquee.speed, "fast");
    }
  }
  assert.ok(sawMarquee, "expected marquee to fire at least once across 500 seeds on a marquee-eligible family");
});

test("M10: hover on asset (figure/image) slots never carries scale/rotate", () => {
  const family = FAMILY_BY_NAME.get("gallery-mosaic");
  const iv = { materiality: 0.7, energy: 1, layoutVariance: 1, contentDensity: 0.4, contrastPreference: 0.5, craft: 1 };
  for (let seed = 0; seed < 500; seed++) {
    const motion = deriveMotion(family, iv, hashToUint32(`m10:${seed}`));
    for (const [name, slot] of Object.entries(motion.micro)) {
      if (/figure|mosaic|marquee-visual|image|photo|diagram|frame|detail/i.test(name) && slot.hover.enabled) {
        assert.ok(!/scale|rotate/.test(slot.hover.transform || ""), `${name} hover=${slot.hover.transform}`);
      }
    }
  }
});

test("M13: hover micro-interactions never enabled at or below intensity 5", () => {
  const family = FAMILY_BY_NAME.get("ledger-table");
  const iv = { materiality: 0.5, energy: 0.2, layoutVariance: 0.9, contentDensity: 0.5, contrastPreference: 0.5, craft: 0.9 };
  for (let seed = 0; seed < 300; seed++) {
    const motion = deriveMotion(family, iv, hashToUint32(`m13:${seed}`));
    if (motion.intensity <= 5) {
      for (const slot of Object.values(motion.micro)) assert.equal(slot.hover.enabled, false);
    }
  }
});

test("M15: focus ring always present, with a real width, on every micro slot", () => {
  for (const family of LAYOUT_FAMILIES) {
    const motion = deriveMotion(family, ivFor({}), 321);
    for (const slot of Object.values(motion.micro)) {
      assert.equal(slot.focus.ring, true);
      assert.ok(slot.focus.width >= 1);
    }
  }
});

// ── intensity-coupled enrichments (spring presets, micro durations, choreography, exit easing) ──
test("spring weight, micro durations, and choreography track MOTION_INTENSITY; exit easing accelerates", () => {
  const family = FAMILY_BY_NAME.get("hero-thesis-single");
  const calm = deriveMotion(family, { energy: 0.1, layoutVariance: 0, craft: 0.5 }, null);
  const loud = deriveMotion(family, { energy: 1.0, layoutVariance: 0, craft: 0.5 }, null);
  // spring gets stiffer + micro faster as intensity rises, but damping never bounces (>=15)
  assert.ok(loud.defaults.springConfig.stiffness > calm.defaults.springConfig.stiffness);
  assert.ok(calm.defaults.springConfig.damping >= 15 && loud.defaults.springConfig.damping >= 15);
  assert.ok(loud.defaults.springConfig.stiffness <= 180);
  // choreography escalates cascade → wave/simultaneous with intensity
  assert.equal(calm.reveal.choreography, "cascade");
  assert.ok(["wave", "simultaneous"].includes(loud.reveal.choreography));
  // exit easing is a real accelerate curve, distinct from the ease-out enter, and gate-safe
  assert.notEqual(loud.defaults.exitEasing, loud.defaults.enterEasing);
  assert.deepEqual(checkMotionViolations(loud, family), []);
  assert.deepEqual(checkMotionViolations(calm, family), []);
});

// ── DIVERSITY — a family across 5 seeds → distinct motion character ─────────────────────────────
test("diversity: same family across 5 seeds yields distinct motion params", () => {
  const family = FAMILY_BY_NAME.get("hero-thesis-single");
  const iv = { materiality: 0.7, energy: 0.5, layoutVariance: 0.8, contentDensity: 0.4, contrastPreference: 0.5, craft: 0.6 };
  const seen = new Set();
  for (let seed = 0; seed < 5; seed++) {
    const motion = deriveMotion(family, iv, hashToUint32(`motion-diversity:${seed}`));
    seen.add(JSON.stringify({ e: motion.defaults.enterEasing, ent: motion.defaults.durations.entrance, stg: motion.defaults.stagger, rt: motion.reveal.treatment, rd: motion.reveal.distance, sb: motion.scrollbar.custom }));
  }
  assert.ok(seen.size >= 3, `expected mostly-distinct motion param sets across 5 seeds, got ${seen.size}`);
});

// ── wiring: genome.mjs / explore.mjs ─────────────────────────────────────────────────────────────
const engine = createEngine({ corpus, brands, fonts });
const landing = { surface: "landing-page", job: "explain-and-convert", sourceBrief: "a tool for indie game devs" };

test("styleGenome carries a motion.design field (full MotionGenome) for every resolved layout, alongside the legacy motion.families", async () => {
  const { styleGenome } = await import("./genome.mjs");
  const g = styleGenome(engine, landing, { seed: 42 });
  assert.ok(g.motion.families.length > 0, "legacy motion.families still resolved (no regression)");
  assert.ok(g.motion.design && g.motion.design.defaults && g.motion.design.scroll);
  assert.ok(Array.isArray(g.motion.design.slop.matchedRules));
  assert.ok(Array.isArray(g.provenance.motion));
});

test("exploreDirections: the 4 directions carry 4 distinct motion characters", () => {
  const { directions } = exploreDirections(engine, landing, { seed: 7 });
  assert.equal(directions.length, 4);
  const sigs = directions.map((d) => {
    const md = d.genome.motion.design;
    return `${md.intensity}:${md.reveal.treatment}:${md.defaults.durations.entrance}:${md.defaults.stagger}:${md.scroll.snap.enabled}:${md.scroll.marquee.enabled}:${md.scrollbar.custom}`;
  });
  assert.equal(new Set(sigs).size, 4, `expected 4 distinct motion signatures, got ${JSON.stringify(sigs)}`);
});

test("exploreDirections: every direction's motion passes M1-M16 gate compliance", () => {
  const { directions } = exploreDirections(engine, landing, { seed: 123 });
  for (const d of directions) {
    const family = FAMILY_BY_NAME.get(d.genome.layout.family);
    assert.deepEqual(checkMotionViolations(d.genome.motion.design, family), []);
    assert.equal(d.genome.motion.design.defaults.respectsReducedMotion, true);
    assert.equal(d.genome.motion.design.reveal.gatesCoreContent, false);
    assert.ok(d.genome.motion.design.heroFit.targetHeightShare >= 0.85 && d.genome.motion.design.heroFit.targetHeightShare <= 1.15);
  }
});

test("exploreDirections determinism still holds with motion wired in", () => {
  const a = exploreDirections(engine, landing, { seed: 42 });
  const b = exploreDirections(engine, landing, { seed: 42 });
  assert.deepEqual(a, b);
});
