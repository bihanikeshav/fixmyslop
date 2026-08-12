// apps/engine/ux.mjs — pure, rule-based UX-layer validators + generators (no fs/Date/random).
// The token engine (engine.mjs/system.mjs) covers VISUAL design; this covers the UX layers the
// coverage audit found unvalidated: microcopy, empty states, accessibility-beyond-contrast, forms,
// component-state completeness, and information architecture. Deterministic heuristics grounded in
// docs/design-research/{ux-writing-microcopy,onboarding-empty-states,accessibility,forms-input,
// components-and-ui-patterns,information-architecture,ux-laws}.md — never a model call, so the same
// input always yields the same verdict.

const lower = (s) => String(s == null ? "" : s).trim().toLowerCase();
const words = (s) => String(s == null ? "" : s).trim().split(/\s+/).filter(Boolean);
const isAllCaps = (s) => { const t = String(s || ""); return t.length >= 4 && t === t.toUpperCase() && /[A-Z]/.test(t); };

// ── 1. microcopy ─────────────────────────────────────────────────────────────
// Vague CTAs that name a mechanism, not an outcome (ux-writing-microcopy.md). "Next"/"Continue" are
// intentionally NOT here — they're legitimate in a wizard/flow.
const VAGUE_BUTTONS = new Set(["submit", "ok", "click here", "here", "go", "button", "learn more", "read more"]);
const BLAMEY = [/invalid/i, /illegal/i, /you (must|failed|forgot|didn't|can't)/i, /wrong/i, /bad request/i];
const TECHNICAL = [/\b[45]\d\d\b/, /null|undefined|exception|stack ?trace/i, /error code/i];
const RECOVERY = /\b(try|check|enter|add|choose|select|use|contact|retry|update|remove|reconnect|refresh|reload|sign|log|verify|confirm|resend|restart|rename|upgrade|wait|go back|free up)\b/i;
export function auditMicrocopy(items = []) {
  const list = Array.isArray(items) ? items : [];
  const results = list.map((it, i) => {
    const kind = lower(it && it.kind) || "text";
    const text = String((it && it.text) != null ? it.text : "");
    const issues = [];
    if (!text.trim()) issues.push("empty copy");
    if (isAllCaps(text)) issues.push("ALL-CAPS copy shouts — use sentence case and let styling carry emphasis");
    if (/!/.test(text) && kind !== "celebration") issues.push("exclamation marks read as forced enthusiasm — cut them");
    if (/\bplease\b/i.test(text)) issues.push("drop 'please' — it pads the label without adding meaning");
    if (kind === "button") {
      if (VAGUE_BUTTONS.has(lower(text))) issues.push(`vague button "${text}" — name the OUTCOME (e.g. "Create account", "Save changes")`);
      if (words(text).length > 4) issues.push("button label > 4 words — tighten to verb + object");
    }
    if (kind === "error") {
      if (BLAMEY.some((re) => re.test(text))) issues.push("blames the user — describe what happened and the fix, not fault");
      if (TECHNICAL.some((re) => re.test(text))) issues.push("exposes technical/jargon detail — say what to do in plain language");
      if (!RECOVERY.test(text)) issues.push("no next action — an error must tell the user how to recover");
    }
    if (kind === "empty" && words(text).length <= 3) issues.push("empty-state copy is a dead end — add a sentence of value + a primary action");
    return { index: i, kind, text, verdict: issues.length ? "SLOP" : "CLEAN", issues };
  });
  const flagged = results.filter((r) => r.verdict === "SLOP").length;
  return { verdict: flagged ? "SLOP" : "CLEAN", count: results.length, flagged, results };
}

// ── 2. empty-state generator (onboarding-empty-states.md: headline / explanation / one action) ───
export function generateEmptyState({ object = "items", actionLabel = null, reason = "first-run" } = {}) {
  const obj = (String(object || "items").trim() || "items");
  const singular = obj.replace(/s$/, "");
  const r = ["first-run", "no-results", "cleared"].includes(reason) ? reason : "first-run";
  const headline = { "first-run": `No ${obj} yet`, "no-results": `No ${obj} match your filters`, "cleared": "You're all caught up" }[r];
  const explanation = {
    "first-run": `Your ${obj} will appear here. Create your first ${singular} to get started.`,
    "no-results": "Try broadening or clearing the filters to see more.",
    "cleared": "Nothing needs your attention right now.",
  }[r];
  const cta = r === "no-results" ? "Clear filters" : (r === "cleared" ? null : (actionLabel || `Create ${singular}`));
  return {
    headline, explanation, cta, reason: r,
    layers: ["headline: what/why nothing is here", "explanation: one sentence of value", "action: the single next step"],
    note: "Three layers, one primary action — never a bare 'No data'.",
  };
}

// ── 3. accessibility beyond contrast (accessibility.md) — structured descriptor, not raw HTML ────
export function auditAccessibility({ interactive = [], reducedMotion = null, landmarks = null, imagesMissingAlt = 0 } = {}) {
  const issues = [];
  const items = Array.isArray(interactive) ? interactive : [];
  items.forEach((el, i) => {
    const type = lower(el && el.type) || "control";
    const label = `${type}#${i}`;
    if (el && el.focusVisible === false) issues.push(`${label}: no visible focus indicator — keyboard users lose their place (WCAG 2.4.7)`);
    const size = Number(el && el.size);
    if (Number.isFinite(size) && size > 0 && size < 44) issues.push(`${label}: touch target ${size}px < 44px (WCAG 2.5.5 / Fitts)`);
    if (type !== "text" && (el && (el.accessibleName === "" || el.accessibleName == null))) issues.push(`${label}: no accessible name — an icon-only control needs aria-label or visible text`);
    if (el && el.role === "div-button") issues.push(`${label}: a clickable <div> isn't keyboard-operable — use <button>`);
  });
  if (reducedMotion === false) issues.push("no prefers-reduced-motion path — motion must degrade to static (WCAG 2.3.3)");
  if (Number(imagesMissingAlt) > 0) issues.push(`${Number(imagesMissingAlt)} image(s) missing alt text`);
  if (landmarks === false) issues.push("no semantic landmarks (header/nav/main/footer) — screen-reader navigation relies on them");
  return { verdict: issues.length ? "SLOP" : "CLEAN", issues, checked: items.length };
}

// ── 4. forms (forms-input.md) ────────────────────────────────────────────────
export function auditForm({ fields = [], columns = 1, validation = null } = {}) {
  const issues = [];
  const fs = Array.isArray(fields) ? fields : [];
  if (Number(columns) > 1) issues.push(`${columns}-column form — a single column is faster and less error-prone for linear entry (short related pairs like city/state are the only exception)`);
  const v = lower(validation);
  if (v === "onkeystroke") issues.push("validating on every keystroke nags mid-typing — validate on blur, and again on submit");
  if (v === "onsubmit-only" && fs.length > 6) issues.push("submit-only validation on a long form dumps all errors at once — add on-blur validation");
  fs.forEach((f, i) => {
    const name = (f && f.name) || `field#${i}`;
    const placement = lower(f && f.labelPlacement);
    if (placement === "placeholder" || (f && f.label == null && f.placeholder)) issues.push(`${name}: placeholder-as-label vanishes on focus and fails a11y — use a persistent label`);
    if (f && f.required === false && f.markedOptional !== true) issues.push(`${name}: optional field not marked "(optional)" — users assume everything is required`);
    if (placement === "right" || placement === "far-left") issues.push(`${name}: label not top-aligned/adjacent — top labels scan fastest`);
  });
  return { verdict: issues.length ? "SLOP" : "CLEAN", issues, fields: fs.length };
}

// ── 5. component-state completeness (components-and-ui-patterns.md) ───────────
const REQUIRED_STATES = ["resting", "hover", "active", "focus", "disabled"];
const CONDITIONAL_STATES = ["loading", "error", "success"];
export function checkComponentStates({ component = "control", states = [], async: isAsync = false } = {}) {
  const have = new Set((Array.isArray(states) ? states : []).map(lower));
  const missingRequired = REQUIRED_STATES.filter((s) => !have.has(s));
  const missingConditional = isAsync ? CONDITIONAL_STATES.filter((s) => !have.has(s)) : [];
  const issues = [];
  if (missingRequired.length) issues.push(`${component}: missing required states — ${missingRequired.join(", ")}`);
  if (missingConditional.length) issues.push(`${component}: an async control also needs — ${missingConditional.join(", ")}`);
  return { verdict: issues.length ? "SLOP" : "CLEAN", component, missingRequired, missingConditional, required: REQUIRED_STATES, conditional: CONDITIONAL_STATES };
}

// ── 6. information architecture (information-architecture.md / Hick's + Miller's) ─────────────────
const IA_JARGON = [/synerg/i, /^leverage/i, /solutions?$/i, /^platform$/i, /^hub$/i, /experiences?$/i, /^resources?$/i];
export function checkInformationArchitecture({ items = [] } = {}) {
  const top = Array.isArray(items) ? items : [];
  const issues = [];
  const labelOf = (x) => (typeof x === "string" ? x : (x && x.label) || "");
  const topLabels = top.map(labelOf);
  if (top.length > 7) issues.push(`${top.length} top-level items — Hick's/Miller's: keep primary nav to ~7 or fewer and group the rest`);
  const dupes = [...new Set(topLabels.filter((l, i) => l && topLabels.indexOf(l) !== i))];
  if (dupes.length) issues.push(`duplicate nav labels: ${dupes.join(", ")}`);
  for (const l of topLabels) if (l && IA_JARGON.some((re) => re.test(l.trim()))) issues.push(`vague/jargon label "${l}" — name the destination, not a category buzzword`);
  for (const it of top) {
    const kids = it && Array.isArray(it.children) ? it.children : null;
    if (kids && kids.length > 9) issues.push(`"${labelOf(it) || "group"}" has ${kids.length} children — chunk into ~5-7`);
  }
  return { verdict: issues.length ? "SLOP" : "CLEAN", issues, topLevel: top.length };
}
