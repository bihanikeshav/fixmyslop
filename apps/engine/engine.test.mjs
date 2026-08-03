import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createEngine } from "./engine.mjs";

const dir = dirname(fileURLToPath(import.meta.url));
const load = (f) => JSON.parse(readFileSync(resolve(dir, "data", f), "utf8"));
const eng = createEngine({ corpus: load("corpus.json"), brands: load("brands.json"), fonts: load("fonts.json") });

test("generatePalette: deterministic + gate-passing", () => {
  const a = eng.generatePalette(7);
  const b = eng.generatePalette(7);
  assert.deepEqual(a, b);                 // same seed → same palette (no Math.random)
  assert.ok(a.contrast >= 4.5);
  assert.equal(eng.checkPalette(a.ground, a.ink, a.accent, a.accent2).pass, true);
});

test("generatePalette: intent-grounded (hue anchors accent, energy varies, accent nudged non-slop)", () => {
  // a target hue from the subject's material anchors the accent hue (± jitter)
  const green = eng.generatePalette({ hue: 150, energy: "bold", seed: 3 });
  const [, , H] = eng.classify(green.accent).oklch ? [0, 0, eng.classify(green.accent).oklch.H] : [0, 0, 0];
  assert.ok(H > 100 && H < 200, `hue-150 accent should be green-ish, got H${H}`);
  assert.equal(eng.checkPalette(green.ground, green.ink, green.accent, green.accent2).pass, true);
  // anchoring on a hard-banned hex nudges it off-slop
  const anchored = eng.generatePalette({ accent: "#6366f1" });
  assert.notEqual(anchored.accent.toLowerCase(), "#6366f1");
  // no grounding + different seeds → genuine variety
  assert.notEqual(eng.generatePalette({ seed: 11 }).accent, eng.generatePalette({ seed: 22 }).accent);
});

test("designSystem: full coherent theme", () => {
  const ds = eng.designSystem({ baseFont: 18, baseUnit: 4, ratio: "perfect-fourth", radiusBase: 8, seed: 3 });
  assert.ok(ds.palette.accent);
  assert.ok(ds.type.length > 1);
  assert.equal(ds.spacing[0].px, 4);
  assert.equal(ds.elevation.length, 6);
});

test("auditSystem: coherence score", () => {
  const r = eng.auditSystem({ type: [16, 20, 25, 31], spacing: [4, 8, 16], radius: [0, 4, 8] });
  assert.ok(r.coherence >= 0 && r.coherence <= 100);
  assert.ok(r.domains.type);
});

test("system fns re-exported on engine", () => {
  assert.equal(typeof eng.typeScale, "function");
  assert.equal(typeof eng.shadow, "function");
});

test("audit_system on designSystem output scores 100 (not silent NaN-CLEAN)", () => {
  const ds = eng.designSystem({ seed: 5 });
  const r = eng.auditSystem({ type: ds.type, spacing: ds.spacing, radius: Object.values(ds.radius).filter((n) => n < 9999) });
  assert.doesNotMatch(JSON.stringify(r.domains), /NaN/);
  assert.equal(r.coherence, 100);
});
