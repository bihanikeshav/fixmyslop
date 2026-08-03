import { test } from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "./engine.mjs";
import { styleGenome } from "./genome.mjs";
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
