import { test } from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "./engine.mjs";
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

test("fallback: no font-space bundle → catalogue-fallback shape, no crash", () => {
  const bare = createEngine({ corpus, brands, fonts, fontSpace: null });
  const r = bare.retrieveFonts({ role: "body", n: 4 });
  assert.ok(Array.isArray(r) && r.length > 0);
  assert.equal(r[0].provenance, "catalogue-fallback");
});
