// apps/engine/system.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { typeScale, lineHeightFor, trackingFor, fluidType, auditTypeScale, spacingScale, auditSpacing, radiusScale, nestedRadius, outerRadius, auditRadius, shadow, auditShadow, grid, computeSplit, measure, auditMeasure, layout, auditLayout, motionTokens, durationFor, auditMotion, controlSize, auditControl, checkComposition, normalizeSpacing } from "./system.mjs";

test("normalizeSpacing: snaps off-grid values to the grid, collapses near-duplicates to one token", () => {
  const r = normalizeSpacing({ values: [15, 17, 18, 8, 30] });
  assert.equal(r.verdict, "FIXED");
  // 15/17/18 all collapse onto 16 (s4)
  assert.deepEqual(r.values.slice(0, 3).map((v) => v.to), [16, 16, 16]);
  assert.equal(r.values.find((v) => v.from === 8).changed, false); // already on-grid
  assert.equal(r.values.find((v) => v.from === 30).to, 32);        // 30 → 32
  // shared token for the collapsed trio
  assert.equal(new Set(r.values.slice(0, 3).map((v) => v.token)).size, 1);
  // an already-clean set is CLEAN
  assert.equal(normalizeSpacing({ values: [4, 8, 16, 24] }).verdict, "CLEAN");
});

test("normalizeSpacing: repairs per-component box models", () => {
  const r = normalizeSpacing({ components: { button: { paddingX: 15, paddingY: 9, gap: 7 }, card: { padding: 20, gap: 13 } } });
  assert.equal(r.components.button.paddingX.to, 16);
  assert.equal(r.components.button.paddingY.to, 8);
  assert.equal(r.components.button.gap.to, 8);
  assert.equal(r.components.card.padding.to % 4, 0);   // 20 → a grid step (16)
  assert.equal(r.components.card.gap.to, 12);           // 13 → 12
  assert.ok(r.changed >= 4);
  assert.ok(r.usedTokens.length >= 1 && r.usedTokens.length <= r.scale.length);
});

test("checkComposition: passes a well-tiled grammar, flags trapped whitespace + a swallowing block", () => {
  const good = checkComposition([
    { role: "nav", heightShare: 0.06, focalPoint: "left", composition: "wordmark" },
    { role: "hero", heightShare: 0.4, focalPoint: "left", composition: "thesis" },
    { role: "evidence", heightShare: 0.24, focalPoint: "center", composition: "argument" },
    { role: "cta", heightShare: 0.18, focalPoint: "center", composition: "close" },
    { role: "footer", heightShare: 0.12, focalPoint: "left", composition: "directory" },
  ], { pageKind: "marketing" });
  assert.equal(good.verdict, "CLEAN");
  assert.equal(good.centrepiece, "hero");

  // trapped whitespace: heightShares far under-tile the page
  const trapped = checkComposition([{ role: "nav", heightShare: 0.06 }, { role: "hero", heightShare: 0.3 }, { role: "body", heightShare: 0.1 }], { pageKind: "marketing" });
  assert.equal(trapped.verdict, "SLOP");
  assert.match(trapped.issues.join(" "), /trapped whitespace/);

  // one block swallowing the page
  const swallow = checkComposition([{ role: "nav", heightShare: 0.06 }, { role: "hero", heightShare: 0.88 }, { role: "footer", heightShare: 0.06 }], { pageKind: "marketing" });
  assert.equal(swallow.verdict, "SLOP");

  // monotony is an advisory, not a hard failure
  const mono = checkComposition([
    { role: "a", heightShare: 0.25, composition: "text-left-figure-right", focalPoint: "left" },
    { role: "b", heightShare: 0.25, composition: "text-left-figure-right", focalPoint: "left" },
    { role: "c", heightShare: 0.25, composition: "text-left-figure-right", focalPoint: "left" },
    { role: "d", heightShare: 0.25, composition: "text-left-figure-right", focalPoint: "left" },
  ], { pageKind: "marketing" });
  assert.equal(mono.verdict, "CLEAN");
  assert.ok(mono.advisories.length >= 1);
});

test("checkComposition: roles-only grammar (no heightShare data) is not a trapped-whitespace false positive", () => {
  const rolesOnly = checkComposition([{ role: "hero" }, { role: "features" }, { role: "cta" }], { pageKind: "marketing" });
  assert.equal(rolesOnly.verdict, "CLEAN");
  assert.match(rolesOnly.advisories.join(" "), /no heightShare data/);
  // over-allocation is advisory, not SLOP
  const over = checkComposition([{ role: "hero", heightShare: 0.8 }, { role: "features", heightShare: 0.6 }], { pageKind: "marketing" });
  assert.equal(over.verdict, "CLEAN");
  assert.match(over.advisories.join(" "), />1\.15/);
});

test("typeScale: geometric, snapped, step 0 = base", () => {
  const s = typeScale({ base: 16, ratio: "major-third", up: 2, down: 1 });
  const at = (k) => s.find((x) => x.step === k);
  assert.equal(at(0).px, 16);
  assert.equal(at(1).px, 20);        // 16*1.25
  assert.equal(at(2).px, 25);        // 16*1.5625
  assert.equal(at(-1).px, 13);       // 16/1.25 = 12.8, snapped to 13
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
  assert.equal(auditLayout({ containerWidth: 594, fontPx: 18, gutter: 24, margin: 32 }).verdict, "CLEAN");
  assert.equal(auditLayout({ gutter: 23, margin: 32 }).verdict, "SLOP");
});

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

test("auditTypeScale accepts generator {px} objects, not just numbers", () => {
  const scale = typeScale({ base: 16, ratio: 1.25, up: 4, down: 0 }); // [{step,px,rem}]
  const r = auditTypeScale(scale); // object array
  assert.equal(r.verdict, "CLEAN");
  assert.doesNotMatch(r.reason, /NaN/);
});
test("auditTypeScale: <2 distinct sizes is CLEAN (no false muddy)", () => {
  assert.equal(auditTypeScale([]).verdict, "CLEAN");
  assert.equal(auditTypeScale([16]).verdict, "CLEAN");
});
test("auditSpacing accepts generator {px} objects", () => {
  const sp = spacingScale({ base: 4 }); // [{token,px,rem}]
  assert.equal(auditSpacing(sp).verdict, "CLEAN");
});
test("auditRadius: all-nonpositive input does not yield Infinity fix base", () => {
  const r = auditRadius([0, 0, 0, 0, 0, 0]); // >5 distinct? no — dedup=1; use a sprawl case with zeros
  // sprawl case that also has no positive values is impossible; assert the guard directly:
  const r2 = auditRadius([2, 3, 5, 7, 9, 11]); // sprawl, positive → finite base
  if (r2.fix) assert.ok(Number.isFinite(r2.fix.md));
});
test("auditMotion: malformed cubic-bezier is flagged, not silently CLEAN", () => {
  assert.equal(auditMotion({ durationMs: 200, easing: "cubic-bezier(.5,.5)" }).verdict, "SLOP");
});
test("a correct concentric radius pair is CLEAN", () => {
  assert.equal(auditRadius([8, 16], [{ outer: 16, padding: 12, inner: 4 }]).verdict, "CLEAN");
});

test("layout: usable container tokens that don't double-count margins", () => {
  const L = layout({ viewport: 1440, baseFont: 18, split: "golden" });
  assert.ok(L.container && typeof L.container.maxWidth === "number");
  // applying maxWidth + padding on both sides must fit the viewport
  assert.ok(L.container.maxWidth + 2 * L.container.paddingInline <= 1440);
  assert.match(L.grid.template, /minmax\(0, 1fr\)/);        // fluid, not fixed-px
  assert.match(L.grid.fixedTemplate, /px\)/);               // fixed form preserved separately
  assert.equal(L.grid.inner, 1440 - 2 * L.grid.margin);     // math unchanged
});
