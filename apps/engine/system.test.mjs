// apps/engine/system.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { typeScale, lineHeightFor, trackingFor, fluidType, auditTypeScale, spacingScale, auditSpacing } from "./system.mjs";

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
