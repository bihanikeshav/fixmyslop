// apps/engine/ux.test.mjs — the UX-layer validators/generators are pure + rule-based.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { auditMicrocopy, generateEmptyState, auditAccessibility, auditForm, checkComponentStates, checkInformationArchitecture } from "./ux.mjs";

test("purity: ux.mjs has no Math.random/Date.now/new Date", () => {
  const src = readFileSync(fileURLToPath(new URL("ux.mjs", import.meta.url)), "utf8")
    .split("\n").map((l) => l.replace(/\/\/.*$/, "")).join("\n");
  assert.ok(!/Math\.random|Date\.now|new Date/.test(src));
});

test("auditMicrocopy: flags vague buttons, blaming/dead-end errors; passes good copy", () => {
  const r = auditMicrocopy([
    { kind: "button", text: "Submit" },
    { kind: "button", text: "Create account" },
    { kind: "error", text: "Invalid input." },
    { kind: "error", text: "That email is already registered — try signing in instead." },
    { kind: "heading", text: "WELCOME!!!" },
  ]);
  assert.equal(r.results[0].verdict, "SLOP");        // "Submit"
  assert.equal(r.results[1].verdict, "CLEAN");       // "Create account"
  assert.equal(r.results[2].verdict, "SLOP");        // blames + no recovery
  assert.equal(r.results[3].verdict, "CLEAN");       // has recovery, plain
  assert.equal(r.results[4].verdict, "SLOP");        // ALL-CAPS + exclamation
  assert.equal(r.verdict, "SLOP");
});

test("auditMicrocopy: common recovery phrasings are recognized (no false 'no next action')", () => {
  const r = auditMicrocopy([
    { kind: "error", text: "Your session expired. Sign in again to continue." },
    { kind: "error", text: "Something went wrong on our end. Refresh the page." },
    { kind: "error", text: "That code has expired — resend a new one from settings." },
  ]);
  for (const item of r.results) {
    assert.ok(!item.issues.some((i) => /no next action/.test(i)), `"${item.text}" wrongly flagged: ${item.issues.join("; ")}`);
  }
});

test("generateEmptyState: three layers + one primary action", () => {
  const e = generateEmptyState({ object: "projects" });
  assert.match(e.headline, /projects/i);
  assert.ok(e.explanation && e.cta);
  assert.equal(e.layers.length, 3);
  const nr = generateEmptyState({ object: "invoices", reason: "no-results" });
  assert.equal(nr.cta, "Clear filters");
});

test("auditAccessibility: small targets, no focus, icon w/o name, div-button", () => {
  const r = auditAccessibility({
    interactive: [
      { type: "button", size: 32, focusVisible: false },
      { type: "icon-button", size: 48, accessibleName: "" },
      { type: "link", role: "div-button", accessibleName: "Home", size: 44 },
    ],
    reducedMotion: false, landmarks: true, imagesMissingAlt: 2,
  });
  assert.equal(r.verdict, "SLOP");
  assert.ok(r.issues.length >= 4);
  assert.equal(auditAccessibility({ interactive: [{ type: "button", size: 48, focusVisible: true, accessibleName: "Save" }], reducedMotion: true, landmarks: true }).verdict, "CLEAN");
});

test("auditForm: multi-column, placeholder-as-label, unmarked optional", () => {
  const r = auditForm({ columns: 2, validation: "onkeystroke", fields: [
    { name: "email", labelPlacement: "placeholder" },
    { name: "company", required: false },
  ] });
  assert.equal(r.verdict, "SLOP");
  assert.ok(r.issues.length >= 3);
  assert.equal(auditForm({ columns: 1, validation: "onblur", fields: [{ name: "email", labelPlacement: "top", required: true }] }).verdict, "CLEAN");
});

test("checkComponentStates: required matrix + async conditionals", () => {
  const r = checkComponentStates({ component: "primary-button", states: ["resting", "hover"], async: true });
  assert.equal(r.verdict, "SLOP");
  assert.deepEqual(r.missingRequired, ["active", "focus", "disabled"]);
  assert.deepEqual(r.missingConditional, ["loading", "error", "success"]);
  assert.equal(checkComponentStates({ states: ["resting", "hover", "active", "focus", "disabled"] }).verdict, "CLEAN");
});

test("checkInformationArchitecture: Hick's cap, jargon, duplicates", () => {
  const r = checkInformationArchitecture({ items: ["Home", "Solutions", "Platform", "Pricing", "Docs", "Blog", "About", "Contact", "Home"] });
  assert.equal(r.verdict, "SLOP");
  assert.ok(r.issues.some((i) => /top-level/.test(i)));      // > 7
  assert.ok(r.issues.some((i) => /jargon|buzzword/.test(i)));
  assert.ok(r.issues.some((i) => /duplicate/.test(i)));
  assert.equal(checkInformationArchitecture({ items: ["Home", "Pricing", "Docs", "Blog", "Contact"] }).verdict, "CLEAN");
});
