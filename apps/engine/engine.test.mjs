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

// Regression: auditSystem used to throw "values.map is not a function" here, because
// designSystem().radius is the radiusScale OBJECT while auditRadius only handled arrays.
// The test above hand-converts the shape and so hid the crash; this one does not.
test("audit_system accepts designSystem() output verbatim (radius object, no hand-conversion)", () => {
  const ds = eng.designSystem({ seed: 5 });
  const r = eng.auditSystem({ type: ds.type, spacing: ds.spacing, radius: ds.radius });
  assert.equal(r.domains.radius.verdict, "CLEAN");
  assert.doesNotMatch(JSON.stringify(r.domains), /NaN/);
  assert.equal(r.coherence, 100);
  // array form and object form must agree
  const asArray = eng.auditSystem({ radius: Object.values(ds.radius) });
  assert.deepEqual(asArray.domains.radius, r.domains.radius);
  // the `full` pill sentinel is ignored, and {px} token objects normalise
  assert.equal(eng.auditSystem({ radius: [{ px: 4 }, { px: 8 }, 9999] }).domains.radius.verdict, "CLEAN");
});

// ---------------------------------------------------------------------------
// Colour-gate perf hardening (exactness guard).
//
// nearestSafe() used to cost ~3,900 lattice candidates x THREE full 1,971-point KDE
// passes each, once per flagged role — checkPalette on five banned hexes burned ~500ms
// of CPU on a public, unauthenticated Worker endpoint. It now runs ONE KDE pass per
// candidate, walks flat Float64Arrays, skips terms that underflow to an exact +0.0, and
// memoises through a bounded LRU.
//
// Every expectation below is a snapshot captured from the PRE-optimisation code. If any
// of it moves, the optimisation stopped being exact and the change must be reverted.
// ---------------------------------------------------------------------------
const NEAREST_SAFE_SNAPSHOT = {
  "#6366f1": { verdict: "HARD-BANNED", slop: 100, oklch: { L: 0.585, C: 0.204, H: 277.1 }, alternatives: [
    { hex: "#6f67e4", slop: 61, deltaEok: 0.026, reason: "same hue family, shifted out of the hot zone (ΔEok 0.03)" },
    { hex: "#644fec", slop: 72, deltaEok: 0.048, reason: "same hue family, shifted out of the hot zone (ΔEok 0.05)" },
    { hex: "#8454f2", slop: 54, deltaEok: 0.059, reason: "same hue family, shifted out of the hot zone (ΔEok 0.06)" }] },
  "#22d3ee": { verdict: "HARD-BANNED", slop: 50, oklch: { L: 0.797, C: 0.134, H: 211.5 }, alternatives: [
    { hex: "#56cfec", slop: 33, deltaEok: 0.023, reason: "same hue family, shifted out of the hot zone (ΔEok 0.02)" },
    { hex: "#66cac5", slop: 13, deltaEok: 0.059, reason: "hue shifted -20° to escape the slop band (ΔEok 0.06)" },
    { hex: "#79dce3", slop: 24, deltaEok: 0.06, reason: "same hue family, shifted out of the hot zone (ΔEok 0.06)" }] },
  "#a78bfa": { verdict: "HARD-BANNED", slop: 77, oklch: { L: 0.709, C: 0.159, H: 293.5 }, alternatives: [
    { hex: "#af88f6", slop: 71, deltaEok: 0.014, reason: "same hue family, shifted out of the hot zone (ΔEok 0.01)" },
    { hex: "#988ee0", slop: 34, deltaEok: 0.046, reason: "same hue family, shifted out of the hot zone (ΔEok 0.05)" },
    { hex: "#937efa", slop: 24, deltaEok: 0.047, reason: "same hue family, shifted out of the hot zone (ΔEok 0.05)" }] },
  "#c2410c": { verdict: "OVERUSED", slop: 100, oklch: { L: 0.553, C: 0.174, H: 38.4 }, alternatives: [
    { hex: "#c94817", slop: 85, deltaEok: 0.02, reason: "same hue family, shifted out of the hot zone (ΔEok 0.02)" },
    { hex: "#bd352c", slop: 90, deltaEok: 0.036, reason: "same hue family, shifted out of the hot zone (ΔEok 0.04)" },
    { hex: "#aa4e22", slop: 46, deltaEok: 0.047, reason: "same hue family, shifted out of the hot zone (ΔEok 0.05)" }] },
  "#3b82f6": { verdict: "HARD-BANNED", slop: 100, oklch: { L: 0.623, C: 0.188, H: 259.8 }, alternatives: [
    { hex: "#7d80e4", slop: 17, deltaEok: 0.073, reason: "hue shifted +20° to escape the slop band (ΔEok 0.07)" },
    { hex: "#7969eb", slop: 54, deltaEok: 0.084, reason: "hue shifted +25° to escape the slop band (ΔEok 0.08)" },
    { hex: "#6488c2", slop: 14, deltaEok: 0.09, reason: "same hue family, shifted out of the hot zone (ΔEok 0.09)" }] },
  "#eab308": { verdict: "OVERUSED", slop: 100, oklch: { L: 0.795, C: 0.162, H: 86 }, alternatives: [
    { hex: "#e3b707", slop: 59, deltaEok: 0.014, reason: "same hue family, shifted out of the hot zone (ΔEok 0.01)" },
    { hex: "#ddad53", slop: 49, deltaEok: 0.046, reason: "same hue family, shifted out of the hot zone (ΔEok 0.05)" },
    { hex: "#fcb24f", slop: 68, deltaEok: 0.049, reason: "same hue family, shifted out of the hot zone (ΔEok 0.05)" }] },
  // a safe/neutral input: no alternatives are computed at all
  "#ffffff": { verdict: "NEUTRAL-ok", slop: 100, oklch: { L: 1, C: 0, H: 89.9 }, alternatives: [] },
};

test("checkColor/nearestSafe: byte-identical to the pre-optimisation snapshot", () => {
  for (const [hex, want] of Object.entries(NEAREST_SAFE_SNAPSHOT)) {
    const got = eng.checkColor(hex);
    assert.equal(got.verdict, want.verdict, hex);
    assert.equal(got.slop, want.slop, hex);
    assert.deepEqual(got.oklch, want.oklch, hex);
    assert.deepEqual(got.alternatives, want.alternatives, hex);
  }
});

test("checkPalette: byte-identical to the pre-optimisation snapshot (five banned roles)", () => {
  const p = eng.checkPalette("#6366f1", "#7c3aed", "#8b5cf6", "#818cf8", "#a78bfa");
  assert.equal(p.pass, false);
  assert.equal(p.contrast, 1.28);
  assert.equal(p.contrastAccent, 1.05);
  assert.deepEqual(p.duplicates, []);
  assert.deepEqual(p.issues, ["surface #a78bfa is HARD-BANNED (literal slop hex #a78bfa)"]);
  assert.deepEqual(Object.keys(p.perRole), ["ground", "ink", "accent", "accent2"]);
  assert.deepEqual(p.perRole.ground.fix.map((f) => f.hex), ["#6f67e4", "#644fec", "#8454f2"]);
  assert.deepEqual(p.perRole.ink.fix.map((f) => f.hex), ["#7a43e3", "#7b08fa", "#911fea"]);
  assert.deepEqual(p.perRole.accent.fix.map((f) => f.hex), ["#9558f1", "#7564fe", "#7d5ad4"]);
  assert.deepEqual(p.perRole.accent2.fix.map((f) => f.hex), ["#8a89f6", "#798ddb", "#929dee"]);
  assert.deepEqual([p.perRole.ground.density, p.perRole.ink.density, p.perRole.accent.density, p.perRole.accent2.density],
    [48.89, 40.68, 31.3, 18.87]);
});

test("colour-gate memoisation is transparent: repeat calls agree and cannot be poisoned", () => {
  const a = eng.checkPalette("#6366f1", "#7c3aed", "#8b5cf6", "#818cf8", "#a78bfa");
  const b = eng.checkPalette("#6366f1", "#7c3aed", "#8b5cf6", "#818cf8", "#a78bfa");
  assert.deepEqual(a, b);
  assert.notEqual(a, b);                       // distinct objects, not the cached instance
  a.perRole.ground.fix[0].hex = "#deadbe";     // a caller mutating its result…
  a.issues.push("tampered");
  const c = eng.checkPalette("#6366f1", "#7c3aed", "#8b5cf6", "#818cf8", "#a78bfa");
  assert.deepEqual(c, b);                      // …must not affect the next caller
  // nearestSafe options participate in the key, so a different count is not a false hit
  assert.equal(eng.nearestSafe("#6366f1").length, 3);
  assert.equal(eng.nearestSafe("#6366f1", { count: 5 }).length, 5);
  assert.equal(eng.nearestSafe("#6366f1").length, 3);
  // checkColor of a safe colour still short-circuits to no alternatives
  assert.deepEqual(eng.checkColor("#ffffff"), eng.checkColor("#ffffff"));
});

test("checkPalette on five banned hexes is not a CPU sink", () => {
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < 50; i++) eng.checkPalette("#6366f1", "#7c3aed", "#8b5cf6", "#818cf8", "#a78bfa");
  const msPerCall = Number(process.hrtime.bigint() - t0) / 1e6 / 50;
  // Pre-fix this was ~250-500ms PER CALL with no memoisation, on a public endpoint.
  assert.ok(msPerCall < 5, `checkPalette averaged ${msPerCall.toFixed(2)}ms/call`);
});
