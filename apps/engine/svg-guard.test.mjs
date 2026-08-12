import { test } from "node:test";
import assert from "node:assert/strict";
import { validateSvg } from "./svg-guard.mjs";

const good = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;

test("svg guard accepts a complete accessible/decorative icon", () => {
  const result = validateSvg(good, { kind: "icon" });
  assert.equal(result.pass, true);
  assert.equal(result.verdict, "PASS");
});

test("svg guard rejects the LLM breakage cluster", () => {
  const result = validateSvg(`<svg width="0" height="0"><foreignObject><div>bad</div></foreignObject><path d="MNaN 2" fill="url(#missing)"/></svg>`);
  assert.equal(result.pass, false);
  const codes = new Set(result.errors.map((error) => error.code));
  for (const code of ["viewbox-missing", "unsafe-element", "nonfinite-geometry", "broken-reference", "accessibility"]) assert.ok(codes.has(code), code);
});

test("raw illustrative SVG needs an explicit provenance acknowledgement", () => {
  const result = validateSvg(`<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet"><title>Leaf</title><circle cx="50" cy="50" r="40"/></svg>`, { kind: "illustration" });
  assert.equal(result.pass, false);
  assert.ok(result.errors.some((error) => error.code === "illustration-provenance"));
  assert.equal(validateSvg(resultInput(), { kind: "illustration", allowIllustration: true }).pass, true);
});

test("svg guard rejects every non-fragment URL, including executable schemes", () => {
  const cases = [
    `<a href="javascript:alert(1)"><path d="M4 12h16"/></a>`,
    `<a href="vbscript:msgbox(1)"><path d="M4 12h16"/></a>`,
    `<image href="asset.png" width="10" height="10"/>`,
    `<path d="M4 12h16" fill="url('https://example.test/fill.svg')"/>`,
  ];
  for (const body of cases) {
    const result = validateSvg(`<svg viewBox="0 0 24 24" aria-label="Test">${body}</svg>`);
    assert.equal(result.pass, false, body);
    assert.ok(result.errors.some((error) => error.code === "external-reference"), body);
    assert.equal(result.gates.safety, false, body);
  }
});

test("svg guard permits valid local fragments and rejects missing href fragments", () => {
  const local = validateSvg(`<svg viewBox="0 0 24 24" aria-hidden="true"><defs><path id="tick" d="M4 12h16"/></defs><use href="#tick"/></svg>`);
  assert.equal(local.pass, true);
  const missing = validateSvg(`<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#missing"/></svg>`);
  assert.equal(missing.pass, false);
  assert.ok(missing.errors.some((error) => error.code === "broken-reference"));
  assert.equal(missing.gates.references, false);
});

function resultInput() {
  return `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" role="img"><title>Leaf</title><circle cx="50" cy="50" r="40"/></svg>`;
}
