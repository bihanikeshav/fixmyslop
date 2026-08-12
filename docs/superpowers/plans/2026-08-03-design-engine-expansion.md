# Design-engine Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grow the pure design engine from color+font into seven math domains (type, spacing, radius, shadow, layout, motion, controls), expose them through the MCP Worker + REST, add a CLI, and ship an engine-backed `atelier` design skill.

**Architecture:** A new pure module `apps/engine/system.mjs` holds all closed-form math; `engine.mjs` re-exports it via `createEngine` and adds `generatePalette`/`designSystem`/`auditSystem`; a thin `cli.mjs` and the existing MCP Worker are the two front doors over the identical engine; a new `skills/atelier/SKILL.md` routes every deterministic design decision to the engine.

**Tech Stack:** ES modules, plain Node (`node --test`, `node:assert/strict`), Cloudflare Workers (hand-rolled JSON-RPC MCP, already present), no new runtime dependencies.

## Global Constraints

- **Purity:** `system.mjs` and `engine.mjs` must NOT use `fs`, `Date.now`, or `Math.random`. Randomness comes from a seeded `mulberry32` PRNG driven by a caller-supplied numeric seed. (Copied verbatim from spec.)
- **Return-shape convention:** generators return `{ value|tokens|css, ... , note }`; auditors return `{ verdict, reason, fix }` where `verdict ∈ {"CLEAN","SLOP"}` (color/font keep their existing verdicts). Every new function follows this.
- **No new deps:** tests use built-in `node:test` + `node:assert/strict`. Run with `node --test apps/engine/`.
- **Snake_case tool names** in the MCP, matching the existing 5 tools. CLI accepts snake_case and normalizes to the engine's camelCase.
- **Rounding helper:** `round(n, p=2) => Math.round(n * 10**p) / 10**p`, defined once in `system.mjs` and imported where needed.

---

### Task 1: `system.mjs` — Type bucket

**Files:**
- Create: `apps/engine/system.mjs`
- Test: `apps/engine/system.test.mjs`

**Interfaces:**
- Produces: `round(n,p?)`, `lerpAnchors(anchors, x)`, `RATIOS`, `typeScale({base,ratio,up,down})→[{step,px,rem}]`, `lineHeightFor(px)→number`, `trackingFor(px)→number(em)`, `fluidType(minPx,maxPx,minVw?,maxVw?)→string`, `auditTypeScale(sizes[])→{verdict,reason,fix}`.

- [ ] **Step 1: Write the failing test**

```js
// apps/engine/system.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { typeScale, lineHeightFor, trackingFor, fluidType, auditTypeScale } from "./system.mjs";

test("typeScale: geometric, snapped, step 0 = base", () => {
  const s = typeScale({ base: 16, ratio: "major-third", up: 2, down: 1 });
  const at = (k) => s.find((x) => x.step === k);
  assert.equal(at(0).px, 16);
  assert.equal(at(1).px, 20);        // 16*1.25
  assert.equal(at(2).px, 25);        // 16*1.5625
  assert.equal(at(-1).px, 12.8);     // 16/1.25, snapped to .1... see note
});

test("lineHeightFor: tighter as size grows", () => {
  assert.ok(lineHeightFor(16) > lineHeightFor(48));
  assert.equal(lineHeightFor(16), 1.5);
});

test("trackingFor: negative on display, ~0 at body", () => {
  assert.equal(trackingFor(16), 0);
  assert.ok(trackingFor(64) < 0);
  assert.ok(trackingFor(12) > 0);
});

test("fluidType: clamp with min/max in rem", () => {
  const c = fluidType(18, 24, 390, 1440);
  assert.match(c, /^clamp\(1\.125rem, .+vw, 1\.5rem\)$/);
});

test("auditTypeScale: flags too many sizes + arbitrary ratio", () => {
  const bad = auditTypeScale([13, 14, 15, 16, 17, 19, 22, 40]);
  assert.equal(bad.verdict, "SLOP");
  assert.ok(bad.fix);
  const good = auditTypeScale(typeScale({ base: 16, ratio: 1.25, up: 4, down: 0 }).map((x) => x.px));
  assert.equal(good.verdict, "CLEAN");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/engine/system.test.mjs`
Expected: FAIL — `Cannot find module './system.mjs'`.

- [ ] **Step 3: Write minimal implementation**

```js
// apps/engine/system.mjs — pure, closed-form design math (no fs/Date/random).
export const round = (n, p = 2) => Math.round(n * 10 ** p) / 10 ** p;

// piecewise-linear interpolation over [x,y] anchors, clamped at the ends
export function lerpAnchors(anchors, x) {
  if (x <= anchors[0][0]) return anchors[0][1];
  const last = anchors[anchors.length - 1];
  if (x >= last[0]) return last[1];
  for (let i = 0; i < anchors.length - 1; i++) {
    const [x0, y0] = anchors[i], [x1, y1] = anchors[i + 1];
    if (x >= x0 && x <= x1) return y0 + (y1 - y0) * ((x - x0) / (x1 - x0));
  }
  return last[1];
}

export const RATIOS = {
  "minor-second": 1.067, "major-second": 1.125, "minor-third": 1.2,
  "major-third": 1.25, "perfect-fourth": 1.333, "aug-fourth": 1.414,
  "perfect-fifth": 1.5, "golden": 1.618,
};
const ratioVal = (r) => (typeof r === "number" ? r : RATIOS[r] || 1.25);
const snapHalf = (px) => Math.round(px * 2) / 2; // 0.5px grid

export function typeScale({ base = 16, ratio = 1.25, up = 5, down = 1 } = {}) {
  const r = ratioVal(ratio);
  const out = [];
  for (let step = -down; step <= up; step++) {
    const px = snapHalf(base * Math.pow(r, step));
    out.push({ step, px, rem: round(px / 16, 4) });
  }
  return out;
}

const LH = [[12, 1.6], [16, 1.5], [24, 1.35], [48, 1.15], [96, 1.02]];
export const lineHeightFor = (px) => round(lerpAnchors(LH, px), 3);

const TRACK = [[12, 0.01], [16, 0], [24, -0.006], [48, -0.02], [96, -0.03]];
export const trackingFor = (px) => round(lerpAnchors(TRACK, px), 4);

export function fluidType(minPx, maxPx, minVw = 390, maxVw = 1440) {
  const slope = (maxPx - minPx) / (maxVw - minVw);
  const interceptRem = round((minPx - slope * minVw) / 16, 4);
  const vw = round(slope * 100, 4);
  return `clamp(${round(minPx / 16, 4)}rem, ${interceptRem}rem + ${vw}vw, ${round(maxPx / 16, 4)}rem)`;
}

export function auditTypeScale(sizes) {
  const uniq = [...new Set(sizes.map(Number))].sort((a, b) => a - b);
  const ratios = uniq.slice(1).map((v, i) => v / uniq[i]);
  const mean = ratios.reduce((a, b) => a + b, 0) / (ratios.length || 1);
  const variance = ratios.reduce((a, b) => a + (b - mean) ** 2, 0) / (ratios.length || 1);
  const cv = Math.sqrt(variance) / (mean || 1);
  const issues = [];
  if (uniq.length > 7) issues.push(`${uniq.length} distinct sizes — too many (aim ≤7)`);
  if (mean < 1.1) issues.push(`mean ratio ${round(mean, 3)} < 1.1 — muddy hierarchy`);
  if (cv > 0.08) issues.push(`inconsistent ratio (CV ${round(cv, 3)}) — not a modular scale`);
  return {
    verdict: issues.length ? "SLOP" : "CLEAN",
    reason: issues.join("; ") || `coherent modular scale (~${round(mean, 3)}×)`,
    fix: issues.length ? typeScale({ base: uniq[0] || 16, ratio: round(Math.max(1.15, mean), 3), up: Math.min(6, uniq.length - 1), down: 0 }) : null,
  };
}
```

Note on the `at(-1)` assertion: `16/1.25 = 12.8`, and `snapHalf(12.8) = 13` — **fix the test** to `assert.equal(at(-1).px, 13)` before running. (Left the arithmetic explicit here so the implementer sees why.)

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test apps/engine/system.test.mjs`
Expected: PASS (5 type tests).

- [ ] **Step 5: Commit**

```bash
git add apps/engine/system.mjs apps/engine/system.test.mjs
git commit -m "feat(engine): type bucket — modular scale, line-height, tracking, fluid, audit"
```

---

### Task 2: `system.mjs` — Spacing bucket

**Files:**
- Modify: `apps/engine/system.mjs`
- Test: `apps/engine/system.test.mjs`

**Interfaces:**
- Consumes: `round` (Task 1).
- Produces: `spacingScale({base,steps})→[{token,px,rem}]`, `auditSpacing(values[])→{verdict,reason,fix}`.

- [ ] **Step 1: Write the failing test** (append to `system.test.mjs`)

```js
import { spacingScale, auditSpacing } from "./system.mjs";

test("spacingScale: base grid multiples", () => {
  const s = spacingScale({ base: 4 });
  assert.deepEqual(s.map((x) => x.px), [4, 8, 12, 16, 24, 32, 48, 64, 96]);
  assert.equal(s[0].token, "s1");
});

test("auditSpacing: flags off-grid + passes clean scale", () => {
  assert.equal(auditSpacing([4, 8, 16, 32]).verdict, "CLEAN");
  const bad = auditSpacing([4, 8, 13, 30]);
  assert.equal(bad.verdict, "SLOP");
  assert.ok(bad.fix.length);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/engine/system.test.mjs`
Expected: FAIL — `spacingScale is not exported`.

- [ ] **Step 3: Write minimal implementation** (append to `system.mjs`)

```js
const SPACE_MULT = [1, 2, 3, 4, 6, 8, 12, 16, 24];
export function spacingScale({ base = 4, steps = SPACE_MULT.length } = {}) {
  return SPACE_MULT.slice(0, steps).map((m, i) => ({ token: `s${i + 1}`, px: base * m, rem: round(base * m / 16, 4) }));
}
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
export function auditSpacing(values) {
  const v = values.map(Number).filter((n) => n > 0);
  const base = v.reduce((a, b) => gcd(a, b), v[0] || 4);
  const offGrid = v.filter((n) => n % base !== 0);
  const issues = [];
  if (base < 4) issues.push(`no consistent base grid (gcd ${base}px) — values not aligned`);
  else if (offGrid.length) issues.push(`off-grid vs ${base}px: ${offGrid.join(", ")}`);
  if (v.length > 6 && new Set(v).size >= v.length) issues.push("all values distinct — no reusable scale");
  return {
    verdict: issues.length ? "SLOP" : "CLEAN",
    reason: issues.join("; ") || `all multiples of ${base}px`,
    fix: issues.length ? spacingScale({ base: base >= 4 ? base : 4 }) : null,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test apps/engine/system.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/engine/system.mjs apps/engine/system.test.mjs
git commit -m "feat(engine): spacing bucket — grid scale + off-grid audit"
```

---

### Task 3: `system.mjs` — Radius bucket

**Files:**
- Modify: `apps/engine/system.mjs`
- Test: `apps/engine/system.test.mjs`

**Interfaces:**
- Consumes: `round` (Task 1).
- Produces: `radiusScale({base})→{none,sm,md,lg,xl,full}`, `nestedRadius(outer,padding)→number`, `outerRadius(inner,padding)→number`, `auditRadius(values[], pairs?)→{verdict,reason,fix}`.

- [ ] **Step 1: Write the failing test** (append)

```js
import { radiusScale, nestedRadius, outerRadius, auditRadius } from "./system.mjs";

test("radiusScale + concentric rule", () => {
  const r = radiusScale({ base: 8 });
  assert.equal(r.md, 8);
  assert.equal(r.full, 9999);
  assert.equal(nestedRadius(16, 12), 4);
  assert.equal(nestedRadius(8, 12), 0);   // clamped
  assert.equal(outerRadius(4, 12), 16);
});

test("auditRadius: sprawl + broken concentricity", () => {
  assert.equal(auditRadius([0, 4, 8, 16]).verdict, "CLEAN");
  assert.equal(auditRadius([2, 3, 5, 7, 9, 11, 13]).verdict, "SLOP");
  const broken = auditRadius([8, 16], [{ outer: 16, padding: 12, inner: 8 }]);
  assert.equal(broken.verdict, "SLOP"); // inner should be 4, not 8
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/engine/system.test.mjs`
Expected: FAIL — `radiusScale is not exported`.

- [ ] **Step 3: Write minimal implementation** (append)

```js
export function radiusScale({ base = 8 } = {}) {
  return { none: 0, sm: round(base * 0.5), md: base, lg: base * 2, xl: base * 3, full: 9999 };
}
export const nestedRadius = (outer, padding) => Math.max(0, outer - padding);
export const outerRadius = (inner, padding) => inner + padding;
export function auditRadius(values, pairs = []) {
  const v = [...new Set(values.map(Number))].filter((n) => n < 9999);
  const issues = [];
  if (v.length > 5) issues.push(`${v.length} distinct radii — sprawl (aim ≤5 + full)`);
  for (const p of pairs) {
    const want = nestedRadius(p.outer, p.padding);
    if (p.inner !== want) issues.push(`inner ${p.inner}px breaks concentricity (should be ${want}px for outer ${p.outer}/pad ${p.padding})`);
  }
  return {
    verdict: issues.length ? "SLOP" : "CLEAN",
    reason: issues.join("; ") || "coherent radius scale, concentric",
    fix: issues.length ? radiusScale({ base: Math.min(...v.filter((n) => n > 0)) || 8 }) : null,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test apps/engine/system.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/engine/system.mjs apps/engine/system.test.mjs
git commit -m "feat(engine): radius bucket — scale + concentric-corner rule + audit"
```

---

### Task 4: `system.mjs` — Shadow bucket

**Files:**
- Modify: `apps/engine/system.mjs`
- Test: `apps/engine/system.test.mjs`

**Interfaces:**
- Consumes: `round` (Task 1).
- Produces: `shadow(elevation, {hue,alpha})→{css,layers}`, `splitShadowLayers(css)→string[]`, `auditShadow(css)→{verdict,reason,fix}`.

- [ ] **Step 1: Write the failing test** (append)

```js
import { shadow, auditShadow } from "./system.mjs";

test("shadow: none at 0, multi-layer above", () => {
  assert.equal(shadow(0).css, "none");
  const s = shadow(4);
  assert.ok(s.layers.length >= 2);
  assert.match(s.css, /px .+px .+px/);
});

test("auditShadow: flags flat default + glow, passes ramp", () => {
  assert.equal(auditShadow("0 4px 6px rgba(0,0,0,0.5)").verdict, "SLOP"); // single + harsh
  assert.equal(auditShadow("0 0 40px rgba(0,0,0,0.2)").verdict, "SLOP");   // glow
  assert.equal(auditShadow(shadow(3).css).verdict, "CLEAN");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/engine/system.test.mjs`
Expected: FAIL — `shadow is not exported`.

- [ ] **Step 3: Write minimal implementation** (append)

```js
const shadowTint = (hue, a) => (hue ? `hsla(${hue}, 25%, 12%, ${a})` : `rgba(0,0,0,${a})`);
export function shadow(elevation = 1, { hue = 0, alpha = 0.18 } = {}) {
  const e = Math.max(0, Number(elevation));
  if (e === 0) return { css: "none", layers: [] };
  const n = Math.min(5, Math.max(2, Math.round(1 + e / 2)));
  const layers = [];
  for (let i = 0; i < n; i++) {
    const f = (i + 1) / n;
    const y = round(e * f * f * 1.2, 1);
    const blur = round(y * 2, 1);
    const spread = round(-e * f * 0.15, 1);
    const a = round(alpha * (1 - i / n), 3);
    layers.push({ x: 0, y, blur, spread, color: shadowTint(hue, a) });
  }
  const css = layers.map((l) => `${l.x}px ${l.y}px ${l.blur}px ${l.spread}px ${l.color}`).join(", ");
  return { css, layers };
}
export function splitShadowLayers(css) {
  const out = []; let depth = 0, cur = "";
  for (const ch of css) {
    if (ch === "(") depth++; else if (ch === ")") depth--;
    if (ch === "," && depth === 0) { out.push(cur.trim()); cur = ""; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
export function auditShadow(css) {
  if (!css || css === "none") return { verdict: "CLEAN", reason: "no shadow", fix: null };
  const layers = splitShadowLayers(css);
  const issues = [];
  if (layers.length === 1) issues.push("single flat layer — reads generic; use a multi-layer ramp");
  if (/rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*(0?\.[3-9]\d*|1(\.0)?)\s*\)/.test(css)) issues.push("harsh pure-black alpha ≥0.3 — muddy; tint + lower alpha");
  for (const l of layers) {
    const m = l.match(/(-?\d+\.?\d*)px\s+(-?\d+\.?\d*)px\s+(-?\d+\.?\d*)px/);
    if (m && +m[1] === 0 && +m[2] === 0 && +m[3] >= 16) issues.push(`glow layer (0 0 ${m[3]}px) — not a shadow`);
  }
  return {
    verdict: issues.length ? "SLOP" : "CLEAN",
    reason: issues.join("; ") || "layered, tinted, plausible",
    fix: issues.length ? shadow(4).css : null,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test apps/engine/system.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/engine/system.mjs apps/engine/system.test.mjs
git commit -m "feat(engine): shadow bucket — layered elevation + slop audit"
```

---

### Task 5: `system.mjs` — Layout + ratios bucket

**Files:**
- Modify: `apps/engine/system.mjs`
- Test: `apps/engine/system.test.mjs`

**Interfaces:**
- Consumes: `round` (Task 1).
- Produces: `grid({viewport,minCol,gutter,margin,maxCols})→{viewport,inner,cols,colW,gutter,margin,template}`, `SPLITS`, `splitRatio(name)→[a,b]`, `computeSplit(width,name)→[a,b]`, `measure(fontPx,cpl)→number`, `auditMeasure(widthPx,fontPx)→{verdict,reason,cpl,fix}`, `focalPoints({w,h})→{thirds,golden}`, `contentBreakpoints({fontPx,maxCpl})→{maxLineWidthPx,suggestMaxCh,note}`, `layout(brief)→{grid,measurePx,measureCh,margins,split,whitespaceRatioTarget}`, `auditLayout({containerWidth,fontPx,gutter,margin,base})→{verdict,reason,fix}`.

- [ ] **Step 1: Write the failing test** (append)

```js
import { grid, computeSplit, measure, auditMeasure, layout, auditLayout } from "./system.mjs";

test("grid: columns exactly fill the container", () => {
  const g = grid({ viewport: 1440, minCol: 280, gutter: 24, margin: 32, maxCols: 12 });
  const filled = g.cols * g.colW + (g.cols - 1) * g.gutter;
  assert.ok(Math.abs(filled - g.inner) < 0.5);
  assert.ok(g.cols >= 1 && g.cols <= 12);
});

test("computeSplit + measure + auditMeasure", () => {
  const [a, b] = computeSplit(1000, "golden");
  assert.ok(Math.abs(a + b - 1000) < 0.5);
  assert.ok(a < b);
  assert.equal(auditMeasure(measure(18, 66), 18).verdict, "CLEAN");
  assert.equal(auditMeasure(1400, 18).verdict, "SLOP"); // way over 75ch
});

test("layout: composite + auditLayout off-grid", () => {
  const L = layout({ viewport: 1440, baseFont: 18, split: "golden" });
  assert.ok(L.grid.cols >= 1);
  assert.ok(L.split.widths.length === 2);
  assert.equal(auditLayout({ containerWidth: 700, fontPx: 18, gutter: 24, margin: 32 }).verdict, "CLEAN");
  assert.equal(auditLayout({ gutter: 23, margin: 32 }).verdict, "SLOP");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/engine/system.test.mjs`
Expected: FAIL — `grid is not exported`.

- [ ] **Step 3: Write minimal implementation** (append)

```js
export function grid({ viewport, minCol = 280, gutter = 24, margin = 32, maxCols = 12 } = {}) {
  const inner = viewport - 2 * margin;
  let cols = Math.floor((inner + gutter) / (minCol + gutter));
  cols = Math.max(1, Math.min(maxCols, cols));
  const colW = round((inner - (cols - 1) * gutter) / cols, 2);
  return { viewport, inner, cols, colW, gutter, margin, template: `repeat(${cols}, ${colW}px)` };
}
export const SPLITS = { golden: [38.2, 61.8], thirds: [33.33, 66.67], quarter: [25, 75], half: [50, 50] };
export const splitRatio = (name) => SPLITS[name] || SPLITS.golden;
export const computeSplit = (width, name = "golden") => { const [a, b] = splitRatio(name); return [round(width * a / 100, 2), round(width * b / 100, 2)]; };
export const measure = (fontPx, cpl = 66) => round(cpl * 0.5 * fontPx, 1);
export function auditMeasure(widthPx, fontPx) {
  const cpl = round(widthPx / (0.5 * fontPx), 1);
  const issues = [];
  if (cpl < 45) issues.push(`measure ${cpl}ch < 45 — too narrow`);
  if (cpl > 75) issues.push(`measure ${cpl}ch > 75 — too wide to track`);
  return { verdict: issues.length ? "SLOP" : "CLEAN", reason: issues.join("; ") || `${cpl}ch — in the 45–75 sweet spot`, cpl, fix: issues.length ? measure(fontPx) : null };
}
export function focalPoints({ w, h }) {
  const P = (fx, fy) => ({ x: round(w * fx), y: round(h * fy) });
  return {
    thirds: [P(1/3, 1/3), P(2/3, 1/3), P(1/3, 2/3), P(2/3, 2/3)],
    golden: [P(0.382, 0.382), P(0.618, 0.382), P(0.382, 0.618), P(0.618, 0.618)],
  };
}
export function contentBreakpoints({ fontPx = 16, maxCpl = 75 } = {}) {
  const maxW = measure(fontPx, maxCpl);
  return { maxLineWidthPx: maxW, suggestMaxCh: maxCpl, note: `cap the text column at ~${maxW}px; beyond that, add columns` };
}
export function layout({ viewport = 1440, baseFont = 18, columns, split } = {}) {
  const g = grid({ viewport, ...(columns ? { maxCols: columns } : {}) });
  const sp = split ? computeSplit(g.inner, split) : null;
  return { grid: g, measurePx: measure(baseFont), measureCh: 66, margins: g.margin, split: split ? { name: split, widths: sp } : null, whitespaceRatioTarget: 0.4 };
}
export function auditLayout({ containerWidth, fontPx = 16, gutter, margin, base = 8 } = {}) {
  const issues = [];
  if (containerWidth && fontPx) {
    const cpl = containerWidth / (0.5 * fontPx);
    if (cpl > 75) issues.push(`measure ${round(cpl, 1)}ch > 75`);
    if (cpl < 45) issues.push(`measure ${round(cpl, 1)}ch < 45`);
  }
  if (gutter != null && gutter % base !== 0) issues.push(`gutter ${gutter}px off the ${base}px grid`);
  if (margin != null && margin % base !== 0) issues.push(`margin ${margin}px off the ${base}px grid`);
  return { verdict: issues.length ? "SLOP" : "CLEAN", reason: issues.join("; ") || "measure in range; gutters/margins on-grid", fix: null };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test apps/engine/system.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/engine/system.mjs apps/engine/system.test.mjs
git commit -m "feat(engine): layout bucket — grid math, splits, measure, focal points, audit"
```

---

### Task 6: `system.mjs` — Motion + controls bucket

**Files:**
- Modify: `apps/engine/system.mjs`
- Test: `apps/engine/system.test.mjs`

**Interfaces:**
- Produces: `CURVES`, `motionTokens()→{curves,durations,exitFactor}`, `durationFor(px)→number`, `stagger(i,base?)→number`, `auditMotion({durationMs,easing})→{verdict,reason,fix}`, `controlSize(fontPx,density)→{fontPx,lineBox,paddingY,height,hitTargetOk}`, `zScale()→{base,dropdown,sticky,modal,toast}`, `auditControl({heightPx})→{verdict,reason,fix}`.

- [ ] **Step 1: Write the failing test** (append)

```js
import { motionTokens, durationFor, auditMotion, controlSize, auditControl } from "./system.mjs";

test("motion: dynamic duration + slop audit", () => {
  assert.ok(durationFor(400) > durationFor(50));
  assert.ok(durationFor(9999) <= 500);
  assert.equal(auditMotion({ durationMs: 250, easing: "cubic-bezier(.22,1,.36,1)" }).verdict, "CLEAN");
  assert.equal(auditMotion({ durationMs: 700, easing: "ease" }).verdict, "SLOP");
  assert.equal(auditMotion({ durationMs: 200, easing: "cubic-bezier(.34,1.56,.64,1)" }).verdict, "SLOP"); // bounce
});

test("controls: 44px floor", () => {
  assert.ok(controlSize(16, "cozy").height >= 44);
  assert.equal(auditControl({ heightPx: 30 }).verdict, "SLOP");
  assert.equal(auditControl({ heightPx: 48 }).verdict, "CLEAN");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/engine/system.test.mjs`
Expected: FAIL — `motionTokens is not exported`.

- [ ] **Step 3: Write minimal implementation** (append)

```js
export const CURVES = {
  "ease-out-quart": "cubic-bezier(.25,1,.5,1)",
  "ease-out-quint": "cubic-bezier(.22,1,.36,1)",
  "ease-out-expo": "cubic-bezier(.16,1,.3,1)",
};
export const motionTokens = () => ({ curves: CURVES, durations: { fast: 150, base: 250, slow: 400 }, exitFactor: 0.75 });
export const durationFor = (px) => Math.max(150, Math.min(500, Math.round(150 + Math.sqrt(Math.abs(px)) * 14)));
export const stagger = (i, base = 50) => i * base;
export function auditMotion({ durationMs, easing } = {}) {
  const issues = [];
  if (durationMs > 500) issues.push(`${durationMs}ms > 500ms for feedback — feels laggy`);
  const m = easing && String(easing).match(/cubic-bezier\(([^)]+)\)/);
  if (m) { const [, y1, , y2] = m[1].split(",").map(Number); if (y1 < 0 || y1 > 1 || y2 < 0 || y2 > 1) issues.push("bounce/elastic easing (control point overshoots) — dated"); }
  return { verdict: issues.length ? "SLOP" : "CLEAN", reason: issues.join("; ") || "duration + easing tasteful", fix: issues.length ? motionTokens() : null };
}
const DENSITY = { compact: 6, cozy: 10, comfortable: 14 };
export function controlSize(fontPx = 16, density = "cozy") {
  const padY = DENSITY[density] ?? DENSITY.cozy;
  const lineBox = Math.round(fontPx * 1.2);
  const height = Math.max(44, lineBox + padY * 2);
  return { fontPx, lineBox, paddingY: padY, height, hitTargetOk: height >= 44 };
}
export const zScale = () => ({ base: 0, dropdown: 1000, sticky: 1100, modal: 1300, toast: 1400 });
export function auditControl({ heightPx } = {}) {
  const ok = heightPx >= 44;
  return { verdict: ok ? "CLEAN" : "SLOP", reason: ok ? `${heightPx}px ≥ 44px min target` : `${heightPx}px < 44px — hit target too small`, fix: ok ? null : controlSize() };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test apps/engine/system.test.mjs`
Expected: PASS (all system buckets green).

- [ ] **Step 5: Commit**

```bash
git add apps/engine/system.mjs apps/engine/system.test.mjs
git commit -m "feat(engine): motion + controls bucket — tokens, dynamic duration, 44px floor"
```

---

### Task 7: `engine.mjs` — palette generator, designSystem, auditSystem, re-exports

**Files:**
- Modify: `apps/engine/engine.mjs` (add import at top; add functions inside `createEngine`; extend the returned object)
- Test: `apps/engine/engine.test.mjs`

**Interfaces:**
- Consumes: everything from `system.mjs`; existing in-scope helpers `oklchToOklab`, `oklabToSrgb`, `isSafeAccentLab`, `CONFIG`, `contrastRatio`, `checkColor`, `checkPalette`.
- Produces (on the `createEngine` return object): `generatePalette(seed)→{ground,ink,accent,accent2,contrast,seed}`, `designSystem(opts)→{palette,type,spacing,radius,elevation,motion,controls}`, `auditSystem(tokens)→{domains,coherence}`, plus all `system.mjs` functions re-exported (`typeScale`, `spacingScale`, `radiusScale`, `shadow`, `layout`, `motionTokens`, `controlSize`, `auditTypeScale`, `auditSpacing`, `auditRadius`, `auditShadow`, `auditLayout`, `auditMotion`, `auditControl`, `zScale`).

- [ ] **Step 1: Write the failing test**

```js
// apps/engine/engine.test.mjs
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/engine/engine.test.mjs`
Expected: FAIL — `eng.generatePalette is not a function`.

- [ ] **Step 3: Write minimal implementation**

At the TOP of `engine.mjs`, after the existing imports/exports region, add the import:

```js
import * as SYS from "./system.mjs";
```

Inside `createEngine`, BEFORE the final `return { ... }`, add:

```js
  // seeded PRNG — keeps generation deterministic + portable (no Math.random)
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function generatePalette(seed = 1) {
    const rand = mulberry32((seed >>> 0) || 1);
    const rnd = (lo, hi) => lo + rand() * (hi - lo);
    const buildHex = (L, C, H) => { const o = oklabToSrgb(oklchToOklab([L, C, H])); return o.inGamut ? o.hex : null; };
    const freshAccent = () => {
      for (let t = 0; t < 200; t++) {
        const L = rnd(0.48, 0.66), C = rnd(0.10, 0.17), H = rand() * 360;
        const lab = oklchToOklab([L, C, H]);
        if (isSafeAccentLab(lab, { minChroma: CONFIG.MIN_INTENTIONAL_CHROMA })) return buildHex(L, C, H);
      }
      return "#1f6e4c";
    };
    const freshNeutral = (kind) => {
      for (let t = 0; t < 200; t++) {
        const L = kind === "ink" ? rnd(0.15, 0.24) : rnd(0.93, 0.965);
        const hex = buildHex(L, rnd(0.006, 0.02), rand() * 360);
        if (!hex) continue;
        const v = classify(hex).verdict;
        if (v === "SAFE" || v === "NEUTRAL-ok") return hex;
      }
      return kind === "ink" ? "#17150f" : "#eceae3";
    };
    for (let a = 0; a < 60; a++) {
      const pal = { ground: freshNeutral("ground"), ink: freshNeutral("ink"), accent: freshAccent(), accent2: freshAccent() };
      const p = checkPalette(pal.ground, pal.ink, pal.accent, pal.accent2);
      if (p.pass && p.contrast != null && p.contrast >= 4.5) return { ...pal, contrast: p.contrast, seed };
    }
    const fb = { ground: "#eceae3", ink: "#17150f", accent: "#b5522f", accent2: "#2f6b5e" };
    return { ...fb, contrast: +contrastRatio(fb.ground, fb.ink).toFixed(2), seed };
  }
  function designSystem({ baseFont = 18, baseUnit = 4, ratio = "perfect-fourth", radiusBase = 8, seed = 1 } = {}) {
    return {
      palette: generatePalette(seed),
      type: SYS.typeScale({ base: baseFont, ratio }),
      spacing: SYS.spacingScale({ base: baseUnit }),
      radius: SYS.radiusScale({ base: radiusBase }),
      elevation: [0, 1, 2, 3, 4, 5].map((e) => ({ level: e, ...SYS.shadow(e) })),
      motion: SYS.motionTokens(),
      controls: { cozy: SYS.controlSize(baseFont, "cozy"), z: SYS.zScale() },
    };
  }
  function auditSystem(tokens = {}) {
    const domains = {};
    if (tokens.type) domains.type = SYS.auditTypeScale(tokens.type);
    if (tokens.spacing) domains.spacing = SYS.auditSpacing(tokens.spacing);
    if (tokens.radius) domains.radius = SYS.auditRadius(tokens.radius);
    if (tokens.shadow) domains.shadow = SYS.auditShadow(tokens.shadow);
    if (tokens.palette) domains.palette = checkPalette(tokens.palette.ground, tokens.palette.ink, tokens.palette.accent, tokens.palette.accent2);
    const vals = Object.values(domains);
    const clean = vals.filter((d) => d.verdict === "CLEAN" || d.pass === true).length;
    return { domains, coherence: vals.length ? Math.round((clean / vals.length) * 100) : 100 };
  }
```

Then extend the `return { ... }` at the end of `createEngine` to include the new functions and re-export all of `SYS`:

```js
  return {
    checkColor, checkPalette, checkFont, suggestFonts, classify, nearestSafe, brandClone,
    density: densityHex, contrastRatio, CONFIG,
    generatePalette, designSystem, auditSystem,
    ...SYS,
  };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test apps/engine/engine.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/engine/engine.mjs apps/engine/engine.test.mjs
git commit -m "feat(engine): generatePalette (seeded), designSystem, auditSystem + system re-exports"
```

---

### Task 8: `cli.mjs` — offline front door

**Files:**
- Create: `apps/engine/cli.mjs`
- Test: `apps/engine/cli.test.mjs`

**Interfaces:**
- Consumes: `createEngine` + data files.
- Produces: an executable that maps `node cli.mjs <snake_or_camel_fn> [jsonArg | positional...]` to the matching engine method and prints JSON. Exit 1 on unknown fn.

- [ ] **Step 1: Write the failing test**

```js
// apps/engine/cli.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));
const cli = resolve(dir, "cli.mjs");
const run = (...args) => JSON.parse(execFileSync("node", [cli, ...args], { encoding: "utf8" }));

test("cli: shadow (positional) + check_palette (json) + snake→camel", () => {
  assert.ok(run("shadow", "4").layers.length >= 2);
  const p = run("check_palette", JSON.stringify({ ground: "#eceae3", ink: "#17150f", accent: "#b5522f" }));
  assert.equal(typeof p.pass, "boolean");
  assert.ok(run("type_scale", JSON.stringify({ base: 16, ratio: 1.25 })).length > 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/engine/cli.test.mjs`
Expected: FAIL — cli.mjs missing (execFileSync throws).

- [ ] **Step 3: Write minimal implementation**

```js
// apps/engine/cli.mjs — offline front door over the engine. `node cli.mjs <fn> [args]`.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createEngine } from "./engine.mjs";

const dir = dirname(fileURLToPath(import.meta.url));
const load = (f) => JSON.parse(readFileSync(resolve(dir, "data", f), "utf8"));
const engine = createEngine({ corpus: load("corpus.json"), brands: load("brands.json"), fonts: load("fonts.json") });

const [, , fnRaw, ...rest] = process.argv;
if (!fnRaw) { console.error("usage: node cli.mjs <fn> [jsonArg | positional...]"); process.exit(1); }
const camel = fnRaw.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
const fn = engine[camel] || engine[fnRaw];
if (typeof fn !== "function") { console.error(`unknown fn: ${fnRaw}`); process.exit(1); }

const parseArgs = (a) => {
  if (a.length === 1 && /^\s*[[{]/.test(a[0])) return [JSON.parse(a[0])];
  return a.map((x) => (/^-?\d+\.?\d*$/.test(x) ? Number(x) : x));
};
console.log(JSON.stringify(fn(...parseArgs(rest)), null, 2));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test apps/engine/cli.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/engine/cli.mjs apps/engine/cli.test.mjs
git commit -m "feat(engine): cli.mjs — offline front door over the engine"
```

---

### Task 9: MCP tools — new tool definitions

**Files:**
- Modify: `apps/worker/src/tools.mjs` (append to the `TOOLS` array)
- Test: `apps/worker/src/tools.test.mjs`

**Interfaces:**
- Consumes: `engine` (already exported from tools.mjs) which now has all the new methods.
- Produces: 15 new entries in `TOOLS` (and therefore `TOOL_BY_NAME`): `design_system`, `audit_system`, `type_scale`, `spacing_scale`, `radius_scale`, `shadow`, `layout`, `palette`, `motion_tokens`, `check_type`, `check_spacing`, `check_radius`, `check_shadow`, `check_layout`, `check_motion`.

- [ ] **Step 1: Write the failing test**

```js
// apps/worker/src/tools.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { TOOL_BY_NAME } from "./tools.mjs";

test("new tools exist and run", () => {
  for (const n of ["design_system", "type_scale", "shadow", "layout", "palette", "check_shadow", "audit_system"]) {
    assert.ok(TOOL_BY_NAME[n], `missing tool ${n}`);
  }
  assert.ok(TOOL_BY_NAME.type_scale.run({ base: 16, ratio: 1.25 }).length > 1);
  assert.equal(TOOL_BY_NAME.check_shadow.run({ css: "0 4px 6px rgba(0,0,0,0.5)" }).verdict, "SLOP");
  assert.ok(TOOL_BY_NAME.design_system.run({ seed: 2 }).palette.accent);
});
```

Note: `tools.mjs` imports `corpus.json` etc. via `import ... from "*.json"`. Node's test runner needs JSON import support — run these worker tests with `node --test --experimental-json-modules apps/worker/src/` OR (simpler, already how the repo builds) rely on Node ≥20.10 where `import json from './x.json' with { type: 'json' }` is stable. If the bare `import x from "./x.json"` in tools.mjs fails under `node --test`, change those three imports in tools.mjs to add `with { type: "json" }`. Verify the import style first with `node -e "import('./apps/worker/src/tools.mjs').then(()=>console.log('ok'))"`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/worker/src/tools.test.mjs`
Expected: FAIL — `missing tool design_system`.

- [ ] **Step 3: Write minimal implementation** (append these entries inside the `TOOLS` array in `tools.mjs`, before the closing `]`)

```js
  {
    name: "design_system",
    description: "Generate a complete, coherent design token system from a seed: gate-passing palette + modular type scale + spacing grid + radius scale + shadow elevation ramp + motion tokens + control sizing. The 'roll a whole theme' call.",
    inputSchema: { type: "object", properties: {
      baseFont: { type: "number", description: "Base body font px (default 18)." },
      baseUnit: { type: "number", description: "Spacing grid unit px (default 4)." },
      ratio: { type: "string", description: "Type-scale ratio name or number (default perfect-fourth)." },
      radiusBase: { type: "number", description: "Base corner radius px (default 8)." },
      seed: { type: "integer", description: "Deterministic seed for the palette (default 1)." },
    } },
    run: (a) => engine.designSystem(a || {}),
  },
  {
    name: "audit_system",
    description: "Audit a submitted token set across domains (type sizes, spacing values, radius values, shadow css, palette roles). Returns per-domain verdicts and an overall coherence score 0–100.",
    inputSchema: { type: "object", properties: {
      type: { type: "array", items: { type: "number" }, description: "Font sizes px." },
      spacing: { type: "array", items: { type: "number" }, description: "Spacing values px." },
      radius: { type: "array", items: { type: "number" }, description: "Radius values px." },
      shadow: { type: "string", description: "A CSS box-shadow value." },
      palette: { type: "object", description: "{ground, ink, accent, accent2?}." },
    } },
    run: (a) => engine.auditSystem(a || {}),
  },
  {
    name: "type_scale",
    description: "Generate a modular type scale. Returns [{step, px, rem}] plus recommended line-height and tracking are available via the fields.",
    inputSchema: { type: "object", properties: {
      base: { type: "number", description: "Base px (default 16)." },
      ratio: { type: "string", description: "Ratio name or number (default 1.25)." },
      up: { type: "integer", description: "Steps up (default 5)." },
      down: { type: "integer", description: "Steps down (default 1)." },
    } },
    run: (a) => engine.typeScale(a || {}),
  },
  {
    name: "spacing_scale",
    description: "Generate a spacing scale on a base grid. Returns [{token, px, rem}].",
    inputSchema: { type: "object", properties: { base: { type: "number", description: "Grid unit px (default 4)." }, steps: { type: "integer", description: "How many steps (default 9)." } } },
    run: (a) => engine.spacingScale(a || {}),
  },
  {
    name: "radius_scale",
    description: "Generate a coherent corner-radius scale. Returns {none, sm, md, lg, xl, full}.",
    inputSchema: { type: "object", properties: { base: { type: "number", description: "Base radius px (default 8)." } } },
    run: (a) => engine.radiusScale(a || {}),
  },
  {
    name: "shadow",
    description: "Generate a layered, physically-plausible box-shadow for an elevation. Returns {css, layers}. Not the generic flat default.",
    inputSchema: { type: "object", properties: {
      elevation: { type: "number", description: "Elevation (0 = none, up to ~24)." },
      hue: { type: "number", description: "Optional hue in degrees to tint the shadow (default 0 = neutral black)." },
      alpha: { type: "number", description: "Top-layer alpha (default 0.18)." },
    }, required: ["elevation"] },
    run: (a) => engine.shadow(Number(a.elevation), { hue: a.hue || 0, alpha: a.alpha ?? 0.18 }),
  },
  {
    name: "layout",
    description: "Do the math for a layout: given viewport/base font/columns/split intent, returns a fitted grid, the optimal measure, margins, a recommended split, and a whitespace-ratio target.",
    inputSchema: { type: "object", properties: {
      viewport: { type: "number", description: "Viewport width px (default 1440)." },
      baseFont: { type: "number", description: "Body font px (default 18)." },
      columns: { type: "integer", description: "Max columns cap." },
      split: { type: "string", description: "Split ratio name: golden|thirds|quarter|half." },
    } },
    run: (a) => engine.layout(a || {}),
  },
  {
    name: "palette",
    description: "Generate a fresh, gate-passing palette {ground, ink, accent, accent2} from a numeric seed (deterministic). Passes the color slop gates and ≥4.5:1 ink-on-ground contrast.",
    inputSchema: { type: "object", properties: { seed: { type: "integer", description: "Deterministic seed (default 1)." } } },
    run: (a) => engine.generatePalette(Number(a && a.seed) || 1),
  },
  {
    name: "motion_tokens",
    description: "Return the motion vocabulary: tasteful ease-out curves, durations (fast/base/slow), and the exit-duration factor.",
    inputSchema: { type: "object", properties: {} },
    run: () => engine.motionTokens(),
  },
  {
    name: "check_type",
    description: "Audit a set of font sizes: flags too many sizes, muddy ratio, or an incoherent (non-modular) scale. Returns {verdict, reason, fix}.",
    inputSchema: { type: "object", properties: { sizes: { type: "array", items: { type: "number" }, description: "Font sizes px." } }, required: ["sizes"] },
    run: (a) => engine.auditTypeScale(a.sizes || []),
  },
  {
    name: "check_spacing",
    description: "Audit spacing values: flags off-grid values and one-off (non-reusable) spacing. Returns {verdict, reason, fix}.",
    inputSchema: { type: "object", properties: { values: { type: "array", items: { type: "number" } } }, required: ["values"] },
    run: (a) => engine.auditSpacing(a.values || []),
  },
  {
    name: "check_radius",
    description: "Audit corner radii: flags scale sprawl and (given pairs) broken concentric-corner nesting.",
    inputSchema: { type: "object", properties: {
      values: { type: "array", items: { type: "number" } },
      pairs: { type: "array", items: { type: "object" }, description: "[{outer, padding, inner}] to check concentricity." },
    }, required: ["values"] },
    run: (a) => engine.auditRadius(a.values || [], a.pairs || []),
  },
  {
    name: "check_shadow",
    description: "Audit a CSS box-shadow: flags the generic single-flat default, harsh pure-black alpha, and glow. Returns {verdict, reason, fix}.",
    inputSchema: { type: "object", properties: { css: { type: "string", description: "A CSS box-shadow value." } }, required: ["css"] },
    run: (a) => engine.auditShadow(String(a.css || "")),
  },
  {
    name: "check_layout",
    description: "Audit a layout: flags an out-of-range measure (line length) and off-grid gutters/margins.",
    inputSchema: { type: "object", properties: {
      containerWidth: { type: "number" }, fontPx: { type: "number" }, gutter: { type: "number" }, margin: { type: "number" }, base: { type: "number" },
    } },
    run: (a) => engine.auditLayout(a || {}),
  },
  {
    name: "check_motion",
    description: "Audit a motion spec: flags feedback durations over 500ms and bounce/elastic easing. Returns {verdict, reason, fix}.",
    inputSchema: { type: "object", properties: { durationMs: { type: "number" }, easing: { type: "string" } } },
    run: (a) => engine.auditMotion(a || {}),
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test apps/worker/src/tools.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/tools.mjs apps/worker/src/tools.test.mjs
git commit -m "feat(mcp): 15 new tools — design_system/audit_system + per-domain generate & audit"
```

---

### Task 10: REST mirror — generic `/api/tool/<name>`

**Files:**
- Modify: `apps/worker/src/index.mjs` (add one route block; import `TOOL_BY_NAME`)
- Test: manual smoke (Task 12). No unit test — routing is thin glue over TOOL_BY_NAME already covered by Task 9.

**Interfaces:**
- Consumes: `TOOL_BY_NAME` from tools.mjs.
- Produces: `GET|POST /api/tool/:name` → the tool's result JSON. GET reads args from query (numbers coerced), POST from JSON body.

- [ ] **Step 1: Add the import**

At the top of `index.mjs`, extend the existing import:

```js
import { engine, stats, STRUCTURE_ARCHETYPES, TOOL_BY_NAME } from "./tools.mjs";
```

(Confirm `TOOL_BY_NAME` is exported from tools.mjs — it is, at the bottom.)

- [ ] **Step 2: Add the route** (inside `fetch`, in the REST section, before the `index / 404` block)

```js
      if (pathname.startsWith("/api/tool/")) {
        const name = pathname.slice("/api/tool/".length);
        const tool = TOOL_BY_NAME[name];
        if (!tool) return err(`unknown tool: ${name}`, 404);
        let args = {};
        if (request.method === "POST") {
          try { args = await request.json(); } catch { return err("invalid JSON body"); }
        } else {
          for (const [k, v] of q.entries()) args[k] = /^-?\d+\.?\d*$/.test(v) ? Number(v) : v;
        }
        return json(tool.run(args));
      }
```

- [ ] **Step 3: Update the root index payload** so the new surface is discoverable. In the `pathname === "/"` block, add:

```js
          tools: Object.keys(TOOL_BY_NAME),
          restTool: "/api/tool/<name> (GET query or POST json)",
```

- [ ] **Step 4: Smoke locally**

Run:
```bash
cd apps/worker && npx wrangler dev --port 8787 &
sleep 3
curl -s "http://localhost:8787/api/tool/shadow?elevation=4" | head -c 200
curl -s "http://localhost:8787/api/tool/design_system?seed=2" | head -c 200
```
Expected: JSON with a layered shadow, and a full token system. Then stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/index.mjs
git commit -m "feat(mcp): generic /api/tool/<name> REST mirror for all tools"
```

---

### Task 11: The `atelier` skill

**Files:**
- Create: `skills/atelier/SKILL.md`

**Interfaces:** none (documentation). Must reference the CLI (`node apps/engine/cli.mjs <tool> <args>`) and the MCP tool names from Task 9, and LINK (not copy) `../personality/reference/*`.

- [ ] **Step 1: Write `skills/atelier/SKILL.md`**

```markdown
---
name: atelier
description: Build a web page whose every deterministic design decision (palette, type scale, spacing, radius, shadow, layout, motion, control sizing) is computed by the fixmyslop engine instead of guessed — while the ONE bold standout is invented by the /personality ideation process. Use when you want distinctive, non-slop UI with tokens that are mathematically coherent, not vibes.
license: Apache-2.0. Design flow adapted from impeccable.style and Anthropic's frontend-design skill; ideation from the personality skill. See ../personality/reference/slop-manifest.md for attribution.
---

An atelier measures twice. This skill keeps the **taste and ideation** of `/personality`
(forbid-the-median, ONE subject-grounded standout, the hard gates) and hands every
**deterministic** decision to the engine — so you stop eyeballing spacing, shadows, and
grids. The engine is pure math; it is the source of truth the live MCP also serves.

## Two front doors to the same engine
- **Local (default in Claude Code):** `node apps/engine/cli.mjs <tool> <args>`
  - `node apps/engine/cli.mjs design_system '{"seed":7,"baseFont":18}'`
  - `node apps/engine/cli.mjs shadow 4`
  - `node apps/engine/cli.mjs check_palette '{"ground":"#eee","ink":"#111","accent":"#c33"}'`
- **Remote (any MCP client / agent):** the fixmyslop Worker — `POST /mcp` or `/api/tool/<name>`.

Both run the identical `apps/engine` module. Verdicts never drift.

## The flow (impeccable's, re-wired)
1. **Absorb + Diverge + Forbid the median** — exactly as `/personality` (read its
   `reference/composition-and-boldness.md` and `reference/hero-artifacts.md`). Invent ONE
   standout. This step is human taste; the engine does not do it.
2. **Commit the theme with math, not vibes** — call `design_system` once for a coherent
   baseline, then adjust intent (ratio, base unit, elevation) and re-roll:
   `node apps/engine/cli.mjs design_system '{"seed":<n>,"ratio":"perfect-fourth"}'`.
3. **Every deterministic decision → a tool** (table below). Never hand-pick these.
4. **Audit before shipping** — run each auditor over what you actually wrote; fix
   anything that returns `verdict:"SLOP"`.

## Decision → Tool
| Deciding… | Tool | Notes |
|---|---|---|
| Whole theme at once | `design_system` | palette + type + spacing + radius + shadow + motion |
| A color is OK? | `check_color` / `check_palette` | slop gate + fresh alternatives |
| A fresh palette | `palette` | seeded, gate-passing, ≥4.5:1 contrast |
| Fonts | `suggest_fonts` / `check_font` | off the AI monoculture |
| Type sizes | `type_scale` / `check_type` | modular; ≤7 sizes |
| Spacing | `spacing_scale` / `check_spacing` | one base grid |
| Corner radii | `radius_scale` / `check_radius` | concentric nesting |
| Shadows | `shadow` / `check_shadow` | layered, tinted — not `0 4px 6px rgba(0,0,0,.1)` |
| Grid / measure / splits | `layout` / `check_layout` | 45–75ch measure, fitted columns |
| Motion | `motion_tokens` / `check_motion` | ease-out only, ≤500ms feedback |
| A whole submitted token set | `audit_system` | per-domain verdicts + coherence score |

## Hard gates (inherited from /personality — non-negotiable)
Read and obey `../personality/reference/slop-colors.md` (color), the render gate, the type
gate, the assets gate, and the contrast gate in `../personality/SKILL.md`. The engine
ENFORCES the color/contrast gates numerically; the standout, render, type-character, and
no-drawn-illustration gates are still yours to hold.

## Reference map (links, not copies)
- Ideation, layout archetypes, boldness → `../personality/reference/composition-and-boldness.md`
- The ONE standout bar + swap test → `../personality/reference/hero-artifacts.md`
- Color law → `../personality/reference/slop-colors.md`
- Polish + motion final pass → `../personality/reference/polish.md` + `../personality/reference/motion.md`
- Components / icons / a11y → `../personality/reference/components-and-assets.md`

## Self-check
Run `/personality`'s 13-point self-check, PLUS: did every token come from the engine
(not a guess)? Run `audit_system` on your final tokens — coherence should be 100 and no
domain `SLOP`. If a value is off-grid, a shadow is flat, or the measure is out of range,
the engine will have told you — fix it before shipping.
```

- [ ] **Step 2: Verify the referenced files exist**

Run:
```bash
ls skills/personality/reference/{slop-colors.md,hero-artifacts.md,composition-and-boldness.md,polish.md,motion.md,components-and-assets.md}
```
Expected: all six list without error (they exist per the personality skill).

- [ ] **Step 3: Commit**

```bash
git add skills/atelier/SKILL.md
git commit -m "feat(skill): atelier — engine-backed design skill (impeccable flow + /personality ideation)"
```

---

### Task 12: Full verification + deploy handoff docs

**Files:**
- Modify: `apps/DEPLOY.md` (document the new tools + endpoints)

**Interfaces:** none.

- [ ] **Step 1: Run the whole engine test suite**

Run: `node --test apps/engine/`
Expected: PASS — all of `system.test.mjs`, `engine.test.mjs`, `cli.test.mjs` green.

- [ ] **Step 2: Run the worker tool test**

Run: `node --test apps/worker/src/tools.test.mjs`
Expected: PASS.

- [ ] **Step 3: MCP protocol smoke test**

Run:
```bash
cd apps/worker && npx wrangler dev --port 8787 &
sleep 3
curl -s -X POST http://localhost:8787/mcp -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log('tools:',JSON.parse(s).result.tools.length))"
curl -s -X POST http://localhost:8787/mcp -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"design_system","arguments":{"seed":5}}}' | head -c 160
```
Expected: `tools: 20`, and a JSON content block with a theme. Stop the dev server.

- [ ] **Step 4: Update `apps/DEPLOY.md`**

Add under the REST endpoints list:

```markdown
- REST (per-tool): `GET|POST /api/tool/<name>` for every MCP tool
  (`design_system`, `type_scale`, `spacing_scale`, `radius_scale`, `shadow`, `layout`,
  `palette`, `motion_tokens`, and the `check_*` / `audit_system` auditors), in addition to
  the named `/api/color`, `/api/palette`, `/api/fonts`, `/api/font`, `/api/structure`.
```

And add a line to the tool-count note:

```markdown
The MCP now exposes 20 tools: 5 color/font + 15 system (type, spacing, radius, shadow,
layout, motion, controls) split into generators and auditors, plus the `design_system`
flagship. All back onto the single pure `apps/engine` module.
```

- [ ] **Step 5: Commit**

```bash
git add apps/DEPLOY.md
git commit -m "docs: document the 20-tool MCP surface + /api/tool REST mirror"
```

- [ ] **Step 6: Deploy handoff (USER runs these — not the agent)**

The agent stops here and hands the user:
```bash
# one-time auth (interactive — run via `!` in the Claude Code prompt):
npx wrangler login
# deploy the worker (MCP goes live):
cd apps/worker && npx wrangler deploy
# then update apps/web/index.html #mcpcfg block to the real workers.dev URL
```

---

## Self-Review

**Spec coverage:** every spec section maps to a task — Type→T1, Spacing→T2, Radius→T3,
Shadow→T4, Layout+ratios→T5, Motion+controls→T6, generatePalette/designSystem/auditSystem→T7,
CLI→T8, MCP tools→T9, REST mirror→T10, atelier skill→T11, tests+DEPLOY+handoff→T12. The
"richer" additions (fluidType, trackingFor, durationFor, zScale, focalPoints,
contentBreakpoints) are in T1/T5/T6.

**Placeholder scan:** no TBD/TODO; every code + test step is concrete. The one arithmetic
caveat (`typeScale` `at(-1)` = 13 after snapping) is called out explicitly with the fix.

**Type consistency:** engine methods are camelCase (`typeScale`, `auditTypeScale`); MCP
tools are snake_case (`type_scale`, `check_type`); the CLI normalizes snake→camel. `verdict`
values are `"CLEAN"|"SLOP"` for the new auditors; color/font keep their existing verdicts;
`audit_system` treats both `verdict==="CLEAN"` and `pass===true` as clean. The `SYS.*`
re-export makes every system function available on the engine object that tools.mjs and
cli.mjs consume.

**Known risk to watch during T9:** JSON-module import style under `node --test` — the plan
tells the implementer to verify and, if needed, add `with { type: "json" }` to the three
imports in tools.mjs.
```
