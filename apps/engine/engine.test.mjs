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
  // color enrichments: a shade ramp (light→dark) and gate-clean semantic status colors
  assert.ok(Array.isArray(ds.palette.ramp) && ds.palette.ramp.length >= 5);
  assert.ok(ds.palette.ramp[0].L > ds.palette.ramp[ds.palette.ramp.length - 1].L, "ramp goes light → dark");
  for (const k of ["error", "success", "warning", "info"]) {
    const v = eng.classify(ds.palette.semantic[k]).verdict;
    assert.ok(v === "SAFE" || v === "NEUTRAL-ok", `${k} ${ds.palette.semantic[k]} is ${v}, must be non-slop`);
  }
});

test("shadeRamp: even-lightness, in-gamut, hue-anchored; neutral when hue omitted", () => {
  const ramp = eng.shadeRamp(150, { steps: 9 });
  assert.equal(ramp.length, 9);
  for (const s of ramp) assert.match(s.hex, /^#[0-9a-f]{6}$/i);
  assert.ok(ramp.every((s, i) => i === 0 || s.L <= ramp[i - 1].L + 1e-9), "monotonic light→dark");
  const neutral = eng.shadeRamp(null, { steps: 5 });
  assert.ok(neutral.every((s) => s.C <= 0.02), "hue-less ramp stays near-neutral");
});

test("checkPalette: dark+neon combination gate + optional surface elevation check", () => {
  // near-black ground + saturated accent — each hex individually legal, the PAIR is banned
  const neon = eng.checkPalette("#141210", "#f2efe9", "#ff5f1f");
  assert.equal(neon.pass, false);
  assert.match(neon.issues.join(" "), /dark\+neon/);
  // same ground with a desaturated accent passes
  const calm = eng.checkPalette("#141210", "#f2efe9", "#b5522f");
  assert.ok(!calm.issues.some((i) => /dark\+neon/.test(i)));
  // surface too close to ground is flagged; a real elevation step passes and is reported
  const muddy = eng.checkPalette("#eceae3", "#17150f", "#b5522f", null, "#ebe9e2");
  assert.equal(muddy.pass, false);
  assert.match(muddy.issues.join(" "), /surface≈ground/);
  const stepped = eng.checkPalette("#eceae3", "#17150f", "#b5522f", null, "#d8d4ca");
  assert.equal(stepped.pass, true);
  assert.ok(stepped.surface && stepped.surface.contrastVsGround >= 1.1);
  assert.ok(Number.isFinite(stepped.contrastAccent));
});

test("generatePalette: dark mood desaturates the accent below the dark+neon line (−25% chroma)", () => {
  for (let seed = 0; seed < 20; seed++) {
    const pal = eng.generatePalette({ hue: 40, energy: "bold", seed, mood: "dark" });
    const C = eng.classify(pal.accent).oklch.C;
    assert.ok(C < 0.17, `dark+bold seed ${seed}: accent C ${C.toFixed(3)} would read as neon on a near-black ground`);
    assert.equal(eng.checkPalette(pal.ground, pal.ink, pal.accent, pal.accent2).pass, true);
  }
});

test("generatePalette: accent2 stays a HARMONIC partner even when +150° lands in the banned indigo band", () => {
  // hue 90 → +150 = 240 (mid-indigo, banned) → the mirror split-complement (~300) must be used,
  // not a collapse back to the primary's own hue.
  for (const seed of [1, 5, 9]) {
    const pal = eng.generatePalette({ hue: 90, energy: "balanced", seed });
    const h1 = eng.classify(pal.accent).oklch.H;
    const h2 = eng.classify(pal.accent2).oklch.H;
    const d = Math.min(Math.abs(h1 - h2), 360 - Math.abs(h1 - h2));
    assert.ok(d >= 60, `seed ${seed}: accent2 hue ${h2.toFixed(0)} sits only ${d.toFixed(0)}° from accent ${h1.toFixed(0)} — not a harmonic partner`);
  }
});

test("semanticColors: warning reads amber (high lightness), all roles gate-clean", () => {
  const sem = eng.semanticColors(150, "balanced");
  const w = eng.classify(sem.warning).oklch;
  assert.ok(w.L >= 0.6, `warning L ${w.L.toFixed(2)} is olive/brown, not amber`);
  assert.ok(w.H > 40 && w.H < 110, `warning hue ${w.H.toFixed(0)} not in the amber band`);
  for (const k of ["error", "success", "warning", "info"]) {
    const v = eng.classify(sem[k]).verdict;
    assert.ok(v === "SAFE" || v === "NEUTRAL-ok", `${k} ${sem[k]} is ${v}`);
  }
});

test("shadeRamp: 11 steps yields the Tailwind-style 50…900,950 labels; neutral ramp anchors warm, not slate", () => {
  const ramp = eng.shadeRamp(200, { steps: 11 });
  assert.equal(ramp[0].step, 50);
  assert.equal(ramp[ramp.length - 2].step, 900);
  assert.equal(ramp[ramp.length - 1].step, 950);
  const neutral = eng.shadeRamp(null, { steps: 5 });
  assert.ok(neutral.every((s) => s.H > 40 && s.H < 110), "hue-less ramp should anchor warm (paper), not the slate blue-gray default");
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
