// apps/engine/fonts.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createEngine } from "./engine.mjs";
const dir = dirname(fileURLToPath(import.meta.url));
const load = (f) => JSON.parse(readFileSync(resolve(dir, "data", f), "utf8"));
const eng = createEngine({ corpus: load("corpus.json"), brands: load("brands.json"), fonts: load("fonts.json") });
const cat = (fam) => (load("fonts.json").find((f) => f.family === fam) || {}).category;

test("pairing.body is a readable workhorse, never a display/handwriting face", () => {
  const { pairing } = eng.suggestFonts(8);
  assert.ok(pairing.body, "has a body face");
  const c = cat(pairing.body);
  assert.ok(c === "serif" || c === "sans-serif", `body ${pairing.body} category ${c} must be text, not ${c}`);
  assert.notEqual(pairing.body, "Rowan"); // the regression: display serif was picked as body
});

test("top display pick is not an ultra-obscure novelty face", () => {
  const { pairing } = eng.suggestFonts(8);
  for (const bad of ["Kihim", "Boxing", "Striper"]) assert.notEqual(pairing.display, bad);
});

test("category:body never returns a display face; still avoids the monoculture", () => {
  const body = eng.suggestFonts(6, { category: "body" });
  for (const p of body.picks) assert.notEqual(p.category, "display");
  const fams = body.picks.map((p) => p.family.toLowerCase());
  for (const slop of ["inter", "poppins", "roboto"]) assert.ok(!fams.includes(slop));
});

test("pairing.note warns display != body", () => {
  assert.match(eng.suggestFonts(6).pairing.note, /body|running text/i);
});
