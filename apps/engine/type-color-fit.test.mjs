// apps/engine/type-color-fit.test.mjs — the intent-conditioned TYPE (font) and COLOR (hue) fix
// (Subsystem 4 hardening) + the design-law.md hard-gate widening it depends on.
//
// Regression this closes: a Haiku A/B test showed a dashboard intent got "Bitcount Single Ink" (a
// pixel/display face) stamped on its metrics, AND all 3 canonical intents (landing-devtool,
// portfolio-studio, dashboard-saas — apps/engine/scripts/haiku-val-gen.mjs) came back with the
// exact SAME font pair ("Bitcount"/"Bricolage Grotesque") and the exact SAME accent hex
// ("#1a89d1" — itself the design-law.md banned reflexive-fintech-blue/indigo AI-accent), because
// font/hue selection never consumed the intent dials suggestLayout already derives.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "./engine.mjs";
import { styleGenome } from "./genome.mjs";
import { exploreDirections } from "./explore.mjs";
import { deriveBaseHue, resolveIntent } from "./intent.mjs";
import corpus from "./data/corpus.json" with { type: "json" };
import brands from "./data/brands.json" with { type: "json" };
import fonts from "./data/fonts.json" with { type: "json" };

const engine = createEngine({ corpus, brands, fonts });

const DASHBOARD = { surface: "dashboard", job: "monitor", sourceBrief: "an analytics dashboard for a SaaS product" };
const APP = { surface: "app", sourceBrief: "an internal ops console" };
const MARKETING = { surface: "marketing", sourceBrief: "a bold product launch page" };
const PORTFOLIO = { surface: "portfolio", sourceBrief: "an independent creative design studio" };

// checkTypeFit/checkColorFit/retrieveFonts all read the RESOLVED intent's dials directly (the
// shape genome.mjs already passes them, post resolveIntent()) — surface/job priors only apply
// after resolution, so tests calling these gates directly must resolve first, same as any caller.
const DASHBOARD_RESOLVED = resolveIntent(DASHBOARD).intent;
const MARKETING_RESOLVED = resolveIntent(MARKETING).intent;

const FUNCTIONAL_BODY_CATEGORIES = new Set(["sans-serif", "monospace"]);
const DECORATIVE_CATEGORIES = new Set(["display", "handwriting"]);

// ── TYPE: surface-fit envelope ──────────────────────────────────────────────────────────────────

test("dashboard body/metric font category is sans-serif or monospace across many seeds", () => {
  for (let seed = 0; seed < 60; seed++) {
    const g = styleGenome(engine, DASHBOARD, { seed });
    assert.ok(g.type.body, `seed ${seed}: no body font resolved`);
    assert.ok(
      FUNCTIONAL_BODY_CATEGORIES.has(g.type.body.category),
      `seed ${seed}: dashboard body font "${g.type.body.family}" is ${g.type.body.category}, expected sans-serif/monospace`,
    );
  }
});

test("dashboard never resolves a display/handwriting (decorative/pixel) face for the heading role", () => {
  for (let seed = 0; seed < 60; seed++) {
    const g = styleGenome(engine, DASHBOARD, { seed });
    assert.ok(g.type.display, `seed ${seed}: no display font resolved`);
    assert.ok(
      !DECORATIVE_CATEGORIES.has(g.type.display.category),
      `seed ${seed}: dashboard heading font "${g.type.display.family}" is ${g.type.display.category} — decorative/novelty face forbidden on a functional surface`,
    );
  }
});

test("the regression case: dashboard never resolves Bitcount (the pixel display face that fought the metrics)", () => {
  for (let seed = 0; seed < 60; seed++) {
    const g = styleGenome(engine, DASHBOARD, { seed });
    assert.notEqual(g.type.display.family, "Bitcount Single Ink");
    assert.notEqual(g.type.body.family, "Bitcount Single Ink");
  }
});

test("expressive surfaces (marketing/portfolio) MAY resolve an actual display-category heading face", () => {
  let sawDisplayCategory = false;
  for (let seed = 0; seed < 40; seed++) {
    const g = styleGenome(engine, MARKETING, { seed });
    if (g.type.display.category === "display") sawDisplayCategory = true;
  }
  assert.ok(sawDisplayCategory, "expected at least one seed to pick an actual display-category face for an expressive surface's heading");
});

test("1000-seed sweep: functional surfaces (dashboard, app) never emit a body/metric category outside sans-serif/monospace", () => {
  for (const intent of [DASHBOARD, APP]) {
    for (let seed = 0; seed < 500; seed++) {
      const g = styleGenome(engine, intent, { seed });
      assert.ok(FUNCTIONAL_BODY_CATEGORIES.has(g.type.body.category), `${intent.surface} seed ${seed}: body category ${g.type.body.category}`);
      assert.ok(!DECORATIVE_CATEGORIES.has(g.type.display.category), `${intent.surface} seed ${seed}: display category ${g.type.display.category}`);
    }
  }
});

// ── TYPE: checkTypeFit gate ─────────────────────────────────────────────────────────────────────

test("checkTypeFit fires on a planted bad case: a display face on a functional surface's body role", () => {
  const fit = engine.checkTypeFit({ display: "Inter", body: "Bitcount Single Ink" }, DASHBOARD_RESOLVED);
  assert.equal(fit.pass, false);
  assert.ok(fit.violations.some((v) => v.role === "body" && v.family === "Bitcount Single Ink"));
  assert.ok(fit.fallback.body, "expected a fallback body face");
  assert.notEqual(fit.fallback.body, "Bitcount Single Ink");
});

test("checkTypeFit fires on a planted bad case: a decorative display face heading a functional surface", () => {
  const fit = engine.checkTypeFit({ display: "Bitcount Single Ink", body: "Roboto" }, DASHBOARD_RESOLVED);
  assert.equal(fit.pass, false);
  assert.ok(fit.violations.some((v) => v.role === "display"));
});

test("checkTypeFit passes a legible pairing on a functional surface", () => {
  const fit = engine.checkTypeFit({ display: "Roboto", body: "Roboto" }, DASHBOARD_RESOLVED);
  assert.equal(fit.pass, true);
});

test("checkTypeFit does not gate an expressive surface's decorative display face", () => {
  const fit = engine.checkTypeFit({ display: "Bitcount Single Ink", body: "Roboto" }, MARKETING_RESOLVED);
  assert.equal(fit.pass, true);
});

// ── COLOR: checkColorFit gate + design-law.md hard-band widening ───────────────────────────────

test("hardBanned now catches the exact regression hex (#1a89d1, the collapsed fintech-blue CTA)", () => {
  assert.ok(engine.checkColor("#1a89d1").verdict === "HARD-BANNED");
});

test("checkColorFit fires on the banned indigo/violet/fintech-blue band and falls back to an intent-grounded, non-banned hue", () => {
  const fit = engine.checkColorFit("#1a89d1", DASHBOARD_RESOLVED);
  assert.equal(fit.pass, false);
  assert.ok(fit.fallback && fit.fallback.hex);
  const recheck = engine.checkColor(fit.fallback.hex);
  assert.notEqual(recheck.verdict, "HARD-BANNED");
  assert.ok(fit.fallback.hue < 215 || fit.fallback.hue > 280, `fallback hue ${fit.fallback.hue} still in the banned band`);
});

test("checkColorFit passes a safe accent untouched", () => {
  const fit = engine.checkColorFit("#a37031", DASHBOARD_RESOLVED);
  assert.equal(fit.pass, true);
  assert.equal(fit.fallback, null);
});

test("1000-seed sweep: generatePalette/styleGenome never emits an accent inside the 215-280 indigo/violet/fintech-blue band", () => {
  for (const intent of [DASHBOARD, MARKETING, PORTFOLIO, APP]) {
    for (let seed = 0; seed < 250; seed++) {
      const g = styleGenome(engine, intent, { seed });
      const verdict = engine.checkColor(g.color.accent).verdict;
      assert.notEqual(verdict, "HARD-BANNED", `${intent.surface} seed ${seed}: accent ${g.color.accent} is HARD-BANNED`);
    }
  }
});

// ── COLOR: intent-conditioned base hue ──────────────────────────────────────────────────────────

test("deriveBaseHue never lands inside a banned hue band, across the full warmth×era×energy×contentDensity×formality grid", () => {
  for (let w = 0; w <= 1; w += 0.25) {
    for (let e = 0; e <= 1; e += 0.5) {
      for (let en = 0; en <= 1; en += 0.5) {
        for (let cd = 0; cd <= 1; cd += 0.5) {
          for (let f = 0; f <= 1; f += 0.5) {
            const hue = deriveBaseHue({ warmth: w, era: e, energy: en, contentDensity: cd, formality: f });
            assert.ok(!(hue >= 165 && hue <= 222), `hue ${hue} in cyan/mint band (warmth${w} era${e} energy${en} cd${cd} formality${f})`);
            assert.ok(!(hue >= 215 && hue <= 280), `hue ${hue} in indigo/violet/fintech-blue band`);
          }
        }
      }
    }
  }
});

test("hue differs across the 3 canonical intents (not one shared hue)", () => {
  const dashboardHue = deriveBaseHue({ surface: "dashboard", warmth: 0.3, era: 0.5, energy: 0.35, contentDensity: 0.8, formality: 0.7 });
  const marketingHue = deriveBaseHue({ surface: "marketing", warmth: 0.6, era: 0.5, energy: 0.7, contentDensity: 0.4, formality: 0.4 });
  const dashboardG = styleGenome(engine, DASHBOARD, { seed: 42 });
  const marketingG = styleGenome(engine, MARKETING, { seed: 42 });
  assert.notEqual(dashboardHue, marketingHue);
  assert.notEqual(Math.round(dashboardG.color.hue), Math.round(marketingG.color.hue));
});

test("determinism: same intent + same seed → identical hue and font pair", () => {
  const a = styleGenome(engine, DASHBOARD, { seed: 7 });
  const b = styleGenome(engine, DASHBOARD, { seed: 7 });
  assert.deepEqual(a, b);
});

test("exploreDirections: 3 canonical-style intents (no explicit hue) get distinct direction-0 hues, not the seed-only-hash collision", () => {
  const SEED = 42;
  const landing = { surface: "landing-page", job: "explain-and-convert", sourceBrief: "a landing page for a developer API platform" };
  const portfolio = { surface: "portfolio", sourceBrief: "a portfolio site for an independent creative design studio" };
  const dashboard = { surface: "dashboard", job: "monitor", sourceBrief: "an analytics dashboard for a SaaS product" };
  const hues = [landing, portfolio, dashboard].map((intent) => {
    const { directions } = exploreDirections(engine, intent, { seed: SEED, count: 4 });
    return Math.round(directions[0].genome.color.hue);
  });
  // dashboard (cool/functional-leaning warmth .3) must differ from at least one of the warmer,
  // expressive surfaces — the old bug produced the literal SAME hue for all 3.
  assert.ok(hues[0] !== hues[2] || hues[1] !== hues[2], `dashboard hue collided with the others: ${hues}`);
});

// ── §4 token-quality overhaul: no novelty-font monoculture, family diversity, richer/gate-clean
// color moods, and material variety across the 4 explore() directions ───────────────────────────

const DEVTOOL = {
  surface: "landing-page", job: "explain-and-convert",
  sourceBrief: "a landing page for a developer API platform / observability tool",
};
const NOVELTY_DISPLAY_RX = /bitcount|pixel|bitmap|8-?bit|arcade|dingbat|wingding/i;
function familyRootFor(name) {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean);
  const MOD = new Set([
    "grid", "ink", "single", "double", "triple", "prop", "dot", "dotted", "pixel",
    "wide", "narrow", "condensed", "expanded", "italic", "variable",
    "rounded", "outline", "fill", "solid", "light", "medium", "black", "thin", "bold",
  ]);
  while (words.length > 1 && MOD.has(words[words.length - 1].toLowerCase())) words.pop();
  return words.join(" ").toLowerCase();
}

test("no novelty-font (Bitcount/pixel/bitmap) display pick by default, across many seeds", () => {
  for (let seed = 0; seed < 100; seed++) {
    const g = styleGenome(engine, DEVTOOL, { seed });
    const family = g.type.display && g.type.display.family;
    assert.ok(!family || !NOVELTY_DISPLAY_RX.test(family), `seed ${seed}: novelty display face "${family}" picked without high experimentalism`);
  }
});

test("a very-high-experimentalism intent MAY reach a novelty display face (retrieveFonts gate, not banned outright)", () => {
  // n large enough to cover the whole font-space pool: novelty faces are heavily demoted (still
  // never the DEFAULT top pick, even when allowed) but must remain reachable, not filtered out.
  const picks = engine.retrieveFonts({ role: "display", intent: { experimentalism: 0.95 }, n: 3000 });
  assert.ok(picks.some((p) => NOVELTY_DISPLAY_RX.test(p.family)), "expected at least one novelty face reachable at experimentalism 0.95");
});

test("a low/default-experimentalism intent never surfaces a novelty display face, even asking for every candidate", () => {
  const picks = engine.retrieveFonts({ role: "display", intent: { experimentalism: 0.3 }, n: 2000 });
  assert.ok(!picks.some((p) => NOVELTY_DISPLAY_RX.test(p.family)), "novelty face leaked through at low experimentalism");
});

test("exploreDirections: 4 directions resolve to 4 DISTINCT display font-family roots (not 4 variants of one novelty family)", () => {
  for (const seed of [42, 1, 7, 123]) {
    const { directions } = exploreDirections(engine, DEVTOOL, { seed, count: 4 });
    const roots = directions.map((d) => familyRootFor(d.genome.type.display && d.genome.type.display.family));
    assert.equal(new Set(roots).size, roots.length, `seed ${seed}: duplicate display family roots across directions: ${roots.join(", ")}`);
    assert.ok(roots.every((r) => !NOVELTY_DISPLAY_RX.test(r)), `seed ${seed}: a direction's display root is a novelty face: ${roots.join(", ")}`);
  }
});

test("exploreDirections: color moods vary across the 4 directions — not every ground is a near-white pastel", () => {
  const { directions } = exploreDirections(engine, DEVTOOL, { seed: 42, count: 4 });
  const moods = directions.map((d) => d.genome.color.mood);
  assert.ok(new Set(moods).size > 1, `expected varied color moods, got ${moods.join(", ")}`);
  // at least one direction must NOT be a near-white ground (the "colors are missing" failure).
  const grounds = directions.map((d) => d.genome.color.ground);
  const lightnesses = grounds.map((hex) => engine.classify(hex).oklch.L);
  assert.ok(lightnesses.some((L) => L < 0.85), `expected at least one non-near-white ground, got L values ${lightnesses.map((l) => l.toFixed(2)).join(", ")}`);
});

test("exploreDirections: no accent/accent2/secondary lands in the 215-280 indigo/violet/fintech-blue band, across many seeds", () => {
  for (let seed = 0; seed < 40; seed++) {
    const { directions } = exploreDirections(engine, DEVTOOL, { seed, count: 4 });
    for (const d of directions) {
      for (const hex of [d.genome.color.accent, d.genome.color.accent2, d.genome.color.secondary].filter(Boolean)) {
        const verdict = engine.checkColor(hex).verdict;
        assert.notEqual(verdict, "HARD-BANNED", `seed ${seed} direction "${d.name}": ${hex} is HARD-BANNED`);
      }
    }
  }
});

test("exploreDirections: material (radius base / shadow language) varies across the 4 directions", () => {
  const { directions } = exploreDirections(engine, DEVTOOL, { seed: 42, count: 4 });
  const radiusBases = directions.map((d) => d.genome.material.radii.md);
  const shadowLangs = directions.map((d) => d.genome.material.shadowLanguage);
  assert.ok(new Set(radiusBases).size > 1, `expected varied radius bases, got ${radiusBases.join(", ")}`);
  assert.ok(new Set(shadowLangs).size > 1 || new Set(radiusBases).size > 1, `expected material to vary by direction (radius=${radiusBases.join(",")} shadow=${shadowLangs.join(",")})`);
});
