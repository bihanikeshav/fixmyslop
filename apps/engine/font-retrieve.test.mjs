import { test } from "node:test";
import assert from "node:assert/strict";
import { createEngine, fontPresence } from "./engine.mjs";
import corpus from "./data/corpus.json" with { type: "json" };
import brands from "./data/brands.json" with { type: "json" };
import fonts from "./data/fonts.json" with { type: "json" };

const engine = createEngine({ corpus, brands, fonts });
const catByFamily = new Map(fonts.map((f) => [f.family.toLowerCase(), f.category]));

test("retrieveFonts uses the font-space bundle (not the fallback)", () => {
  const r = engine.retrieveFonts({ role: "display", n: 5 });
  assert.ok(r.length > 0);
  assert.equal(r[0].provenance, "font-space.json");
});

test("body role: every candidate is body-suitable (serif/sans, ok x-height)", () => {
  const body = engine.retrieveFonts({ role: "body", n: 25 });
  assert.ok(body.length > 0, "expected body candidates");
  for (const r of body) {
    assert.equal(r.readabilityChecks.bodySuitable, true);
    const cat = catByFamily.get(r.family.toLowerCase());
    if (cat) assert.ok(["serif", "sans-serif"].includes(cat), `${r.family} is ${cat}, not a body category`);
  }
});

test("body role NEVER returns a known display-only face (the jayant.wtf fix, structural)", () => {
  const displayFace = fonts.find((f) => f.category === "display");
  assert.ok(displayFace, "fixture: expected at least one display face in the catalogue");
  const body = engine.retrieveFonts({ role: "body", n: 4000 }); // ask for essentially all
  const hit = body.find((r) => r.family.toLowerCase() === displayFace.family.toLowerCase());
  assert.equal(hit, undefined, `${displayFace.family} (display) must never appear as a body candidate`);
});

test("like: seeds candidates from precomputed visual neighbors", () => {
  // Roboto is guaranteed present in the neighbor data.
  const r = engine.retrieveFonts({ role: "display", like: "Roboto", n: 8 });
  assert.ok(r.length > 0, "expected neighbor candidates for Roboto");
  // neighbor-seeded results carry a visualDistance (1 - sim); the full-pool path leaves it null.
  assert.ok(r.some((x) => x.visualDistance !== null), "expected at least one neighbor-derived visualDistance");
});

test("overused/top-tier faces are penalized", () => {
  const overused = fonts.find((f) => (f.popularityRank || 9999) <= 40);
  assert.ok(overused, "fixture: expected a top-40 popularity font");
  const all = engine.retrieveFonts({ role: "display", n: 4000 });
  const hit = all.find((r) => r.family.toLowerCase() === overused.family.toLowerCase());
  if (hit) assert.ok(hit.overusePenalty > 0, `${overused.family} should carry an overuse penalty`);
});

test("exclude removes a family from the results", () => {
  const first = engine.retrieveFonts({ role: "display", n: 5 })[0];
  const excluded = engine.retrieveFonts({ role: "display", n: 5, exclude: [first.family] });
  assert.ok(!excluded.some((r) => r.family.toLowerCase() === first.family.toLowerCase()));
});

// ── font↔layout presence coupling ─────────────────────────────────────────────────────────────
test("fontPresence: display/ornate > neutral sans > mono", () => {
  const disp = fontPresence({ category: "display", family: "Bold Display", metrics: { strokeContrast: 0.6, counterSize: 0.6, xHeightRatio: 0.7 } });
  const sans = fontPresence({ category: "sans-serif", family: "Neutral Grotesk", metrics: { strokeContrast: 0.1, counterSize: 0.5, xHeightRatio: 0.6 } });
  const mono = fontPresence({ category: "monospace", family: "Code Mono", metrics: { strokeContrast: 0.05, counterSize: 0.45, xHeightRatio: 0.55 } });
  assert.ok(disp > sans, `display ${disp} should exceed sans ${sans}`);
  assert.ok(sans > mono, `sans ${sans} should exceed mono ${mono}`);
  for (const p of [disp, sans, mono]) assert.ok(p >= 0 && p <= 1, `presence ${p} in range`);
});

test("fontPresence: degrades to the genre base when metrics are absent (no crash)", () => {
  const p = fontPresence({ category: "display", family: "Foo" });
  assert.ok(Number.isFinite(p) && p > 0.5, "a display face with no metrics still reads high-presence");
  assert.equal(fontPresence(null), 0.5);
});

test("layoutAir couples display presence: an airy layout surfaces higher-presence faces than a tight one", () => {
  const airy = engine.retrieveFonts({ role: "display", n: 8, layoutAir: 0.9 });
  const tight = engine.retrieveFonts({ role: "display", n: 8, layoutAir: 0.1 });
  assert.ok(airy.length && tight.length);
  const meanPresence = (rs) => rs.reduce((s, r) => s + fontPresence({ category: r.category, family: r.family }), 0) / rs.length;
  assert.ok(meanPresence(airy) > meanPresence(tight),
    `airy mean presence ${meanPresence(airy).toFixed(3)} should exceed tight ${meanPresence(tight).toFixed(3)}`);
});

test("layoutAir absent → identical to pre-coupling results (back-compat)", () => {
  const implicit = engine.retrieveFonts({ role: "display", n: 6 }).map((r) => r.family);
  const explicitUndef = engine.retrieveFonts({ role: "display", n: 6, layoutAir: undefined }).map((r) => r.family);
  assert.deepEqual(implicit, explicitUndef);
});

test("fallback: no font-space bundle → catalogue-fallback shape, no crash", () => {
  const bare = createEngine({ corpus, brands, fonts, fontSpace: null });
  const r = bare.retrieveFonts({ role: "body", n: 4 });
  assert.ok(Array.isArray(r) && r.length > 0);
  assert.equal(r[0].provenance, "catalogue-fallback");
});
