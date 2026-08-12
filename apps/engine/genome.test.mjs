import { test } from "node:test";
import assert from "node:assert/strict";
import { createEngine, fontPresence } from "./engine.mjs";
import { styleGenome } from "./genome.mjs";
import { CHROME_ROLES } from "./layout-families.mjs";
import corpus from "./data/corpus.json" with { type: "json" };
import brands from "./data/brands.json" with { type: "json" };
import fonts from "./data/fonts.json" with { type: "json" };

const engine = createEngine({ corpus, brands, fonts });
const landing = { surface: "landing-page", job: "explain-and-convert", sourceBrief: "a tool for indie game devs" };

test("same intent + same seed → identical genome (determinism)", () => {
  const a = styleGenome(engine, landing, { seed: 42 });
  const b = styleGenome(engine, landing, { seed: 42 });
  assert.deepEqual(a, b);
});

test("type genome carries per-role leading/tracking (measure-aware body, tighter display)", () => {
  const g = styleGenome(engine, landing, { seed: 7 });
  const s = g.type.setting;
  assert.ok(s && s.display && s.body && s.label);
  assert.ok(s.body.leading >= 1.4 && s.body.leading <= 1.65, `body leading ${s.body.leading} should be a reading line-height`);
  assert.ok(s.display.leading <= 1.2, "display leading is tighter than body");
  assert.match(s.display.tracking, /-0\.0/);   // large headings get negative tracking
});

test("hero-led page: the hero section (first non-chrome) is flagged singleViewport, and only it", () => {
  const g = styleGenome(engine, landing, { seed: 7 });
  const sg = g.layout.sectionGrammar;
  const hero = sg.find((s) => !CHROME_ROLES.has(s.role));
  assert.ok(hero, "hero (first non-chrome section) found");
  assert.equal(hero.singleViewport, true, `hero role "${hero && hero.role}" should be singleViewport:true`);
  assert.equal(sg.filter((s) => s.singleViewport === true).length, 1, "exactly one single-viewport section (the hero)");
});

test("tool page (dashboard): no section is flagged singleViewport (no single-screen hero)", () => {
  const g = styleGenome(engine, { surface: "dashboard", job: "monitor", sourceBrief: "an ops dashboard" }, { seed: 7 });
  assert.ok(g.layout && g.layout.family, "dashboard resolved a layout");
  assert.equal(g.layout.sectionGrammar.some((s) => s.singleViewport === true), false, "a tool page must not carry a single-viewport hero");
});

test("singleViewport is orthogonal to the fingerprint (does not alter selection/determinism)", () => {
  const a = styleGenome(engine, landing, { seed: 42 });
  assert.ok(!JSON.stringify(a.fingerprint).includes("singleViewport"), "flag must not leak into the fingerprint");
});

test("layout resolves before type; airy vs dense intent shifts display presence (font↔layout coupling)", () => {
  const airy = styleGenome(engine, { surface: "landing-page", job: "explain-and-convert", contentDensity: 0.15, energy: 0.7, experimentalism: 0.7, sourceBrief: "an airy brand landing page" }, { seed: 7 });
  const dense = styleGenome(engine, { surface: "dashboard", job: "monitor", contentDensity: 0.9, energy: 0.3, formality: 0.8, sourceBrief: "a dense ops dashboard" }, { seed: 7 });
  assert.ok(airy.layout && airy.layout.macro, "airy genome resolved a layout with macro");
  assert.ok(dense.layout && dense.layout.macro, "dense genome resolved a layout with macro");
  const presenceOf = (g) => fontPresence({ category: g.type.display.category, family: g.type.display.family });
  assert.ok(presenceOf(airy) >= presenceOf(dense),
    `airy display presence ${presenceOf(airy).toFixed(3)} should be >= dense ${presenceOf(dense).toFixed(3)}`);
});

test("genome connects every layer with provenance", () => {
  const g = styleGenome(engine, landing, { seed: 7 });
  assert.ok(g.type.display && g.type.display.family, "display font resolved");
  assert.ok(g.type.body && g.type.body.family, "body font resolved");
  assert.ok(g.color.accent, "palette accent resolved");
  assert.ok(g.layout && g.layout.family, "layout family resolved");
  assert.ok(g.material.radii && g.material.shadow, "material resolved");
  assert.ok(Array.isArray(g.material.slots), "material slots present (hierarchy nodes)");
  assert.ok(g.motion.families.length > 0, "motion resolved");
  assert.ok(g.personality.axes["quiet-loud"] !== undefined, "personality axes derived");
  assert.ok(g.provenance.type && g.provenance.color && g.provenance.layout, "provenance on layers");
  assert.ok(g.fingerprint.fontPair.length >= 1 && g.fingerprint.layoutFamily, "fingerprint computed");
});

test("body font is never the same as the display font", () => {
  const g = styleGenome(engine, landing, { seed: 3 });
  assert.notEqual(g.type.display.family.toLowerCase(), g.type.body.family.toLowerCase());
});

test("diversity memory changes COMPOSITION, not just hue", () => {
  const first = styleGenome(engine, landing, { seed: 9 });
  const second = styleGenome(engine, landing, {
    seed: 9,
    recentFingerprints: [first.fingerprint],
  });
  // Same seed keeps color reproducible, but excluding the prior fingerprint must
  // move the layout family and/or the font pair — not merely the accent.
  const layoutMoved = second.fingerprint.layoutFamily !== first.fingerprint.layoutFamily;
  const fontsMoved = second.fingerprint.fontPair.join() !== first.fingerprint.fontPair.join();
  assert.ok(layoutMoved || fontsMoved, "excluding the prior fingerprint must change composition");
});

test("dashboard intent never resolves a landing hero family", () => {
  const g = styleGenome(engine, { surface: "dashboard", job: "monitor" }, { seed: 1 });
  assert.ok(!["hero-thesis-single", "contrast-band-flow", "split-marquee"].includes(g.layout.family));
});

test("intent contradictions surface as warnings on the genome", () => {
  const g = styleGenome(engine, { surface: "dashboard", contentDensity: 0.9, motionIntensity: 0.9 }, { seed: 1 });
  assert.ok(g.warnings.some((w) => /contentDensity|motion/i.test(w)));
});
