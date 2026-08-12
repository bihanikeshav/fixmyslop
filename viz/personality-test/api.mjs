#!/usr/bin/env node
// api.mjs — the single build-time API Claude calls to (a) get non-slop
// colors/fonts/styles and (b) audit + auto-fix a built HTML page.
//
// This module COMPOSES the existing checkers — it does not reimplement their
// logic. The color verdicts come from color/density.mjs + color/roles.mjs; the
// structural verdicts from structural-check.mjs; the render/motion/font-in-file
// verdicts from slop-check.mjs. Brand-clone naming comes from the getdesign
// identityColors corpus. Font verdicts come from data/fonts.index.json +
// data/font-neighbors.json.
//
// CLI:
//   node api.mjs color  <hex> [--json]
//   node api.mjs palette <ground> <ink> <accent> [accent2] [--json]
//   node api.mjs font    <family...> [--json]
//   node api.mjs fonts   [n] [--json]
//   node api.mjs audit   <file.html> [--fix] [--json]
//
// Importable: every command has a pure function (colorReport, paletteReport,
// fontReport, freshFonts, audit, autoFix) returning plain objects.

import { readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";

import { hexToOklch, deltaEok, hexToOklab } from "./color/color-space.mjs";
import { classify, hardBanned, nearestSafe, CONFIG } from "./color/density.mjs";
import { classifyRole, paletteGate } from "./color/roles.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");

// ===========================================================================
// data loaders (lazy + cached)
// ===========================================================================
let _getdesign = null;
function getdesign() {
  if (_getdesign) return _getdesign;
  try {
    _getdesign = JSON.parse(readFileSync(resolve(ROOT, "data/reference/getdesign/index.json"), "utf8"));
  } catch { _getdesign = []; }
  return _getdesign;
}

let _fonts = null;
function fontsIndex() {
  if (_fonts) return _fonts;
  try {
    _fonts = JSON.parse(readFileSync(resolve(ROOT, "data/fonts.index.json"), "utf8"));
  } catch { _fonts = []; }
  return _fonts;
}

let _neighbors = null;
function fontNeighbors() {
  if (_neighbors) return _neighbors;
  try {
    _neighbors = JSON.parse(readFileSync(resolve(ROOT, "data/font-neighbors.json"), "utf8"));
  } catch { _neighbors = {}; }
  return _neighbors;
}

// ===========================================================================
// 1) color <hex>
// ===========================================================================

// slop score 0..100: density as a fraction of the overuse threshold, capped.
function slopScore(density) {
  return Math.min(100, Math.round((density / CONFIG.OVERUSE_THRESHOLD) * 100));
}

// Brand-clone naming: is this hex ~= a brand's IDENTITY color (getdesign)?
// Returns { brand, brandHex, delta } for the closest identity color within a JND
// window, else null. Identity colors are the ones a brand is recognised by.
function brandClone(hex, maxDelta = 0.06) {
  const lab = hexToOklab(hex);
  let best = null;
  for (const b of getdesign()) {
    for (const ic of b.identityColors || []) {
      let d;
      try { d = deltaEok(lab, hexToOklab(ic)); } catch { continue; }
      if (d <= maxDelta && (!best || d < best.delta)) {
        best = { brand: b.name, brandHex: ic.toLowerCase(), delta: +d.toFixed(3) };
      }
    }
  }
  return best;
}

// Framework-default detection: the literal Tailwind/shadcn/Framer slop hexes are
// flagged by hardBanned() with a label; surface that as the "framework-default"
// reason when the ban is a literal-hex / named-band hit.
function colorReason(hex, cls) {
  const clone = brandClone(hex);
  if (clone) {
    return {
      kind: "brand-clone",
      detail: `≈ ${clone.brand} identity color ${clone.brandHex} (ΔEok ${clone.delta}) — cloning a known brand reads as derivative`,
      brand: clone.brand,
    };
  }
  if (cls.ban) {
    return {
      kind: "framework-default",
      detail: `${cls.ban} — a Tailwind/shadcn/Framer default; the AI-monoculture accent`,
    };
  }
  if (cls.verdict === "OVERUSED") {
    return {
      kind: "framework-default",
      detail: `sits in a crowded zone of the empirical corpus (density ${cls.density.toFixed(1)} ≥ ${CONFIG.OVERUSE_THRESHOLD}) — everyone keeps reaching for this`,
    };
  }
  return { kind: "fresh", detail: "not a brand clone, not a framework default, low corpus density — fresh" };
}

export function colorReport(hex) {
  const cls = classify(hex);
  const reason = colorReason(hex, cls);
  const verdict = cls.verdict; // HARD-BANNED | OVERUSED | NEUTRAL-ok | SAFE
  const alts = (verdict === "HARD-BANNED" || verdict === "OVERUSED")
    ? nearestSafe(hex).map((s) => ({
        hex: s.hex,
        slop: slopScore(s.density),
        deltaEok: +s.delta.toFixed(3),
        reason: s.reason,
      }))
    : [];
  return {
    hex: cls.hex,
    verdict,
    slop: slopScore(cls.density),
    oklch: { L: +cls.oklch.L.toFixed(3), C: +cls.oklch.C.toFixed(3), H: +cls.oklch.H.toFixed(1) },
    reason,
    alternatives: alts,
  };
}

// ===========================================================================
// 2) palette <ground> <ink> <accent> [accent2]
// ===========================================================================
export function paletteReport(ground, ink, accent, accent2) {
  const gate = paletteGate({ ground, ink, accent });

  const perRole = {};
  for (const [role, hex] of [["ground", ground], ["ink", ink], ["accent", accent]]) {
    if (!hex) continue;
    const v = gate.perRole[role];
    const flagged = v.verdict === "HARD-BANNED" || v.verdict === "OVERUSED";
    perRole[role] = {
      hex: v.hex,
      verdict: v.verdict,
      density: +v.density.toFixed(2),
      threshold: Number.isFinite(v.threshold) ? +v.threshold.toFixed(2) : null,
      ban: v.ban,
      fix: flagged
        ? nearestSafe(hex).map((s) => ({ hex: s.hex, deltaEok: +s.delta.toFixed(3), reason: s.reason }))
        : null,
    };
  }

  // optional second accent: classify + duplicate check against accent
  if (accent2) {
    const v = classifyRole(accent2, "accent");
    const flagged = v.verdict === "HARD-BANNED" || v.verdict === "OVERUSED";
    perRole.accent2 = {
      hex: v.hex,
      verdict: v.verdict,
      density: +v.density.toFixed(2),
      ban: v.ban,
      fix: flagged
        ? nearestSafe(accent2).map((s) => ({ hex: s.hex, deltaEok: +s.delta.toFixed(3), reason: s.reason }))
        : null,
    };
  }

  return {
    vector: gate.vector,
    matchedTemplate: gate.matchedTemplate,
    templateSharePct: gate.templateSharePct,
    freshness: gate.freshness,
    perRole,
    pass: Object.values(perRole).every((r) => r.verdict === "SAFE" || r.verdict === "NEUTRAL-ok"),
  };
}

// ===========================================================================
// 3) font <family>  — the SLOP-unless-foundational rule
// ===========================================================================

// The known AI-monoculture avoid-list (slop-check.mjs AVOID_FONTS + the user's
// list). A font on this list — OR in the top popularity tier — is SLOP and must
// not be used for ANY role (including body), UNLESS it is isFoundational, which
// is the single escape hatch (foundational families are deliberately allowed as
// neutral workhorses even though they are common).
const AVOID_LIST = new Set([
  "inter", "poppins", "playfair display", "playfair", "space grotesk", "outfit",
  "dm sans", "montserrat", "roboto", "lato", "open sans", "geist", "manrope",
  "cormorant", "cormorant garamond", "fraunces", "instrument serif", "clash display",
  "general sans", "sora", "plus jakarta sans", "figtree", "epilogue", "satoshi",
]);
// top popularity tier => treated as slop (same rule, data-driven not just the list).
const POPULARITY_SLOP_TOP_N = 40;

function findFont(family) {
  const fam = family.trim().toLowerCase();
  const idx = fontsIndex();
  return idx.find((f) => f.family.toLowerCase() === fam)
    || idx.find((f) => f.family.toLowerCase().startsWith(fam))
    || null;
}

// Freshness score for ranking ALTERNATIVES / the `fonts` suggestions. Higher =
// fresher/more distinctive. Favors: indie suppliers, non-foundational, NOT on the
// avoid list, mid-tail popularity (distinctive but not a dead/obscure font), and
// decent quality.
function freshnessScore(f) {
  if (!f) return -Infinity;
  const fam = f.family.toLowerCase();
  if (AVOID_LIST.has(fam)) return -Infinity;
  if (f.isBrandFont) return -Infinity;
  let s = 0;
  const indie = f.supplier && f.supplier !== "google";
  if (indie) s += 2.5;                       // indie foundry = low-saturation, distinctive
  if (!f.isFoundational) s += 1.0;           // foundational = the common workhorses
  const rank = f.popularityRank || 9999;
  // distinctive band: not top-100 (slop), not bottom-tail (broken/obscure).
  if (rank > 100 && rank < 900) s += 1.5;
  else if (rank >= 900 && rank < 1400) s += 0.6;
  else if (rank <= 100) s -= 2.0;            // popular = converging
  s += (f.quality || 0) * 1.2;               // glyph/metric quality
  return s;
}

function fontVerdict(f, family) {
  if (!f) {
    return {
      verdict: "UNKNOWN",
      why: `"${family}" is not in the font index — can't certify it; prefer a known fresh family.`,
      isFoundational: false,
    };
  }
  const fam = f.family.toLowerCase();
  const onAvoid = AVOID_LIST.has(fam);
  const topTier = (f.popularityRank || 9999) <= POPULARITY_SLOP_TOP_N;
  const isSlop = onAvoid || topTier;

  if (isSlop && f.isFoundational) {
    return {
      verdict: "SLOP-allowed-foundational",
      why: `${f.family} is AI-monoculture slop (${onAvoid ? "on the avoid-list" : `top-${POPULARITY_SLOP_TOP_N} popularity (rank ${f.popularityRank})`}), but isFoundational=true rescues it: usable as a NEUTRAL workhorse for body only — never as the identity/display face. Pair it with a distinctive display font.`,
      isFoundational: true,
    };
  }
  if (isSlop) {
    return {
      verdict: "SLOP",
      why: `${f.family} is AI-monoculture slop (${onAvoid ? "on the avoid-list" : `top-${POPULARITY_SLOP_TOP_N} popularity (rank ${f.popularityRank})`}) and isFoundational=false — do NOT use it for ANY role, including body.`,
      isFoundational: false,
    };
  }
  return {
    verdict: "FRESH",
    why: `${f.family} is not on the avoid-list and not top-tier popular (rank ${f.popularityRank ?? "?"}, supplier ${f.supplier}) — a distinctive choice.`,
    isFoundational: !!f.isFoundational,
  };
}

// alternatives: visually-near (font-neighbors.json) but FRESHER picks.
function fontAlternatives(f, count = 4) {
  if (!f) {
    // no anchor: just return top fresh families
    return freshFonts(count).picks;
  }
  const neigh = fontNeighbors()[f.id] || [];
  const idx = fontsIndex();
  const byId = Object.fromEntries(idx.map((x) => [x.id, x]));
  const scored = neigh
    .map((n) => ({ n, f: byId[n.id] }))
    .filter((x) => x.f)
    .map((x) => ({
      family: x.f.family,
      supplier: x.f.supplier,
      sim: x.n.sim,
      score: freshnessScore(x.f),
      popularityRank: x.f.popularityRank,
      isFoundational: !!x.f.isFoundational,
    }))
    .filter((x) => x.score > -Infinity) // drop avoid-list / brand fonts
    .sort((a, b) => b.score - a.score || b.sim - a.sim);
  return scored.slice(0, count).map((x) => ({
    family: x.family,
    supplier: x.supplier,
    sim: +x.sim.toFixed(3),
    why: `visual neighbor (sim ${x.sim.toFixed(2)}) but fresher${x.supplier !== "google" ? ` — indie (${x.supplier})` : ""}${!x.isFoundational ? ", non-foundational/distinctive" : ""}`,
  }));
}

export function fontReport(family) {
  const f = findFont(family);
  const v = fontVerdict(f, family);
  const out = {
    family: f ? f.family : family,
    verdict: v.verdict,
    why: v.why,
    isFoundational: v.isFoundational,
    alternatives: [],
  };
  if (f) {
    out.supplier = f.supplier;
    out.category = f.category;
    out.popularityRank = f.popularityRank;
  }
  // offer alternatives whenever the input is slop or unknown
  if (v.verdict !== "FRESH") out.alternatives = fontAlternatives(f);
  return out;
}

// ===========================================================================
// 4) fonts [n]  — suggest fresh distinctive families (a display + a body)
// ===========================================================================
export function freshFonts(n = 4) {
  const idx = fontsIndex();
  const scored = idx
    .map((f) => ({ f, score: freshnessScore(f) }))
    .filter((x) => x.score > -Infinity)
    .sort((a, b) => b.score - a.score);

  const display = scored.filter((x) => x.f.category === "display");
  const body = scored.filter((x) => ["sans-serif", "serif"].includes(x.f.category));

  const half = Math.max(1, Math.ceil(n / 2));
  const pick = (arr, k) => arr.slice(0, k).map((x) => ({
    family: x.f.family,
    supplier: x.f.supplier,
    category: x.f.category,
    popularityRank: x.f.popularityRank,
    isFoundational: !!x.f.isFoundational,
    why: `fresh: ${x.f.supplier !== "google" ? `indie (${x.f.supplier}), ` : ""}rank ${x.f.popularityRank}, non-slop ${x.f.category}`,
  }));

  const picks = [...pick(display, half), ...pick(body, n - half)].slice(0, n);
  return {
    picks,
    pairing: {
      display: display[0] ? display[0].f.family : null,
      body: body[0] ? body[0].f.family : null,
      note: "Use the display face for headings/identity, the body face for running text. Both are off the avoid-list.",
    },
  };
}

// ===========================================================================
// 5/6) audit <file.html> [--fix]
// ===========================================================================

// Extract unique hexes from a file (same idiom as slop-check.mjs).
function extractHexes(text) {
  const lc = text.toLowerCase();
  const hexes = [...lc.matchAll(/#[0-9a-f]{3}(?:[0-9a-f]{3})?\b/g)].map((m) => m[0]);
  // normalize 3-digit to 6-digit for classification, but keep original for replace
  const uniq = [...new Set(hexes)];
  return uniq.map((h) => ({
    raw: h,
    norm: h.length === 4 ? "#" + h.slice(1).split("").map((c) => c + c).join("") : h,
  }));
}

// Extract font families referenced (Google-Fonts family= params + font-family decls).
// The two sources have DIFFERENT shapes:
//   family=Fraunces:ital,opsz,wght@0,9..144;...   one family + an axis spec (drop
//                                                  everything from the first ':')
//   font-family: 'DM Mono', monospace             a CSS comma-list of families
// so we parse them separately to avoid leaking axis tags (opsz/wght/9..144) as
// bogus "families".
const GENERIC_FAMILIES =
  /^(sans-serif|serif|monospace|system-ui|ui-\w+|-apple-system|blinkmacsystemfont|cursive|fantasy|inherit|initial|unset|emoji|math|fangsong|courier|courier prime|courier new|helvetica|helvetica neue|arial|georgia|times|times new roman|monaco|segoe ui|menlo|consolas|tahoma|verdana)$/i;
function pushFamily(set, token) {
  token = token.replace(/['"]/g, "").trim();
  if (!token) return;
  if (/^var\(/i.test(token)) return;       // CSS var reference, not a family
  if (/[@]/.test(token)) return;           // residual axis spec (wght@...)
  if (/\.\./.test(token)) return;          // axis range (9..144)
  if (GENERIC_FAMILIES.test(token)) return;
  set.add(token);
}
function extractFonts(text) {
  const fams = new Set();
  // Google-Fonts family= params: family = everything before the first ':'.
  for (const m of text.matchAll(/family=([^&"')]+)/gi)) {
    const fam = m[1].split(":")[0].replace(/\+/g, " ");
    pushFamily(fams, fam);
  }
  // font-family declarations: a comma-list of candidate families.
  for (const m of text.matchAll(/font-family\s*:\s*([^;}{]+)/gi)) {
    for (const token of m[1].split(",")) pushFamily(fams, token.replace(/\+/g, " "));
  }
  return [...fams];
}

// Run structural-check.mjs as a subprocess and parse its score/tells. We shell
// out (rather than refactor) to reuse its detect()/SEVERITY/FIX verbatim.
function runStructural(file) {
  try {
    const out = execFileSync(process.execPath, [resolve(HERE, "structural-check.mjs"), file], {
      encoding: "utf8",
    });
    return parseStructural(out, file);
  } catch (e) {
    // structural-check exits non-zero on SLOP; output is still on stdout.
    const out = (e.stdout || "").toString();
    if (out) return parseStructural(out, file);
    return { severity: 0, tells: [], error: e.message };
  }
}
function parseStructural(out, file) {
  const lines = out.split(/\r?\n/);
  let severity = 0;
  const tells = [];
  const head = lines.find((l) => /severity\s+\d+/.test(l) && l.includes(file));
  if (head) {
    const m = head.match(/severity\s+(\d+)/);
    if (m) severity = +m[1];
  } else {
    const m = out.match(/severity\s+(\d+)/);
    if (m) severity = +m[1];
  }
  for (let i = 0; i < lines.length; i++) {
    const tm = lines[i].match(/^\s*sev\s+(\d+)\/5\s+(.+?)\s+\((.+)\)\s*$/);
    if (tm) {
      const fixLine = (lines[i + 1] || "").match(/FIX:\s*(.+)$/);
      tells.push({ severity: +tm[1], label: tm[2].trim(), context: tm[3].trim(), fix: fixLine ? fixLine[1].trim() : null });
    }
  }
  return { severity, tells };
}

// Run slop-check.mjs as a subprocess and parse its render/motion/font fails.
function runSlopCheck(file) {
  let out;
  try {
    out = execFileSync(process.execPath, [resolve(HERE, "slop-check.mjs"), file], { encoding: "utf8" });
  } catch (e) {
    out = (e.stdout || "").toString() || "";
  }
  const lines = out.split(/\r?\n/);
  const fails = [];
  for (const l of lines) {
    const m = l.match(/^\s*✗\s*(.+)$/) || l.match(/^\s*x\s+(.+)$/);
    if (m) fails.push(m[1].trim());
  }
  const pass = /\bPASS\b/.test(out) && fails.length === 0;
  return { pass, fails };
}

// Classify a slop-check fail line into a structured issue (type + fix).
function slopCheckIssue(fail) {
  const f = fail.toLowerCase();
  if (f.includes("opacity:0") || f.includes("intersectionobserver")) {
    return { type: "render", severity: 5, detail: fail, fix: "Gate the opacity:0 reveal behind an html.js class (content visible with JS off), or render visible and only enhance with JS." };
  }
  if (f.includes("dark ground") && f.includes("glow")) {
    return { type: "render", severity: 4, detail: fail, fix: "Remove the saturated glow on the dark ground; use lightness/contrast, a tight neutral shadow, or a border." };
  }
  if (f.includes("prefers-reduced-motion")) {
    return { type: "motion", severity: 3, detail: fail, fix: "Wrap animation in @media (prefers-reduced-motion: no-preference) or disable it under reduce." };
  }
  if (f.includes("transition: all")) {
    return { type: "motion", severity: 3, detail: fail, fix: "Replace transition:all with explicit transform/opacity transitions." };
  }
  if (f.includes("layout props")) {
    return { type: "motion", severity: 3, detail: fail, fix: "Animate transform/opacity only — never width/height/top/left/margin/padding." };
  }
  if (f.includes("bounce") || f.includes("elastic") || f.includes("overshoot")) {
    return { type: "motion", severity: 2, detail: fail, fix: "Use ease-out / ease-in-out; drop bounce/elastic overshoot on functional UI." };
  }
  if (f.includes("font")) {
    return { type: "font", severity: 3, detail: fail, fix: "Swap the flagged font for a fresh family (run `api.mjs font <name>` for alternatives)." };
  }
  if (f.includes("hex") || f.includes("band") || f.includes("cyan") || f.includes("teal")) {
    return { type: "color", severity: 4, detail: fail, fix: "Run `api.mjs color <hex>` for a nearestSafe replacement, or audit --fix to auto-snap." };
  }
  if (f.includes("functional-component")) {
    return { type: "structure", severity: 1, detail: fail, fix: "Add a real interactive/functional element if the page is meant to be a component." };
  }
  return { type: "other", severity: 2, detail: fail, fix: "Review this slop-check finding." };
}

// The full audit. Composes color (density/roles), fonts (index rule), structure
// (structural-check), render/motion (slop-check).
export function audit(file) {
  if (!existsSync(file)) throw new Error(`no such file: ${file}`);
  const text = readFileSync(file, "utf8");
  const issues = [];

  // ---- colors ----
  const colorFlags = [];
  for (const { raw, norm } of extractHexes(text)) {
    let cls;
    try { cls = classify(norm); } catch { continue; }
    if (cls.verdict === "HARD-BANNED" || cls.verdict === "OVERUSED") {
      const alts = nearestSafe(norm);
      const fix = alts[0] ? alts[0].hex : null;
      colorFlags.push({ hex: raw, verdict: cls.verdict });
      issues.push({
        type: "color",
        severity: cls.verdict === "HARD-BANNED" ? 5 : 4,
        detail: `${raw} is ${cls.verdict}${cls.ban ? ` (${cls.ban})` : ` (density ${cls.density.toFixed(1)})`}`,
        fix: fix ? `replace with ${fix} (ΔEok ${alts[0].delta.toFixed(2)}, ${alts[0].reason})` : "pick a lower-density color",
        replace: fix ? { from: raw, to: fix } : null,
      });
    }
  }

  // ---- fonts ----
  const flaggedFonts = new Set(); // families already reported (suppress slop-check dupes)
  for (const fam of extractFonts(text)) {
    const f = findFont(fam);
    const v = fontVerdict(f, fam);
    if (v.verdict === "SLOP" || v.verdict === "SLOP-allowed-foundational") {
      flaggedFonts.add(fam.toLowerCase());
      const alts = fontAlternatives(f, 3).map((a) => a.family).join(", ");
      issues.push({
        type: "font",
        severity: v.verdict === "SLOP" ? 4 : 2,
        detail: `${fam}: ${v.why}`,
        fix: v.verdict === "SLOP"
          ? `Replace ${fam}. Fresher visual neighbors: ${alts || "(see `api.mjs fonts`)"}.`
          : `${fam} is OK for BODY only; use a distinctive display face for headings. Options: ${alts}.`,
      });
    } else if (v.verdict === "UNKNOWN") {
      issues.push({ type: "font", severity: 1, detail: `${fam}: not in the font index (can't certify).`, fix: "Verify it isn't a renamed slop font; prefer a known-fresh family." });
    }
  }

  // ---- structure (structural-check.mjs) ----
  const struct = runStructural(file);
  for (const t of struct.tells) {
    issues.push({
      type: "structure",
      severity: t.severity,
      detail: `${t.label} (${t.context})`,
      fix: t.fix,
    });
  }

  // ---- render / motion (slop-check.mjs) ----
  // slop-check's value-add over the passes above is render-gating + motion. Its
  // color/font fails overlap the per-hex/per-family passes, so suppress those
  // dupes and keep render/motion/structure/other.
  const slop = runSlopCheck(file);
  for (const fail of slop.fails) {
    const i = slopCheckIssue(fail);
    if (i.type === "color") continue;                 // per-hex color pass is richer
    if (i.type === "font") {
      // only surface if it names a family the per-family pass didn't already flag
      const named = fail.replace(/.*flagged font:\s*/i, "").split(/,\s*/).map((s) => s.trim().toLowerCase());
      if (named.every((n) => flaggedFonts.has(n))) continue;
    }
    issues.push(i);
  }

  // de-dupe identical (type+detail) issues
  const seen = new Set();
  const deduped = issues.filter((i) => {
    const k = i.type + "::" + i.detail;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  deduped.sort((a, b) => b.severity - a.severity);

  const pass = deduped.length === 0;
  const counts = {};
  for (const i of deduped) counts[i.type] = (counts[i.type] || 0) + 1;

  return {
    file,
    pass,
    structuralSeverity: struct.severity,
    issues: deduped,
    summary: pass
      ? "clean — no slop markers across colors, fonts, structure, render/motion."
      : `${deduped.length} issue(s): ` + Object.entries(counts).map(([k, n]) => `${n} ${k}`).join(", ") + `; structural severity ${struct.severity}.`,
  };
}

// audit --fix : auto-apply MECHANICAL color fixes in place (.bak first), then
// re-audit and report what REMAINS (structure/font/motion need Claude).
export function autoFix(file) {
  if (!existsSync(file)) throw new Error(`no such file: ${file}`);
  let text = readFileSync(file, "utf8");

  // build replacement map from a pre-fix color audit
  const replacements = [];
  for (const { raw, norm } of extractHexes(text)) {
    let cls;
    try { cls = classify(norm); } catch { continue; }
    if (cls.verdict === "HARD-BANNED" || cls.verdict === "OVERUSED") {
      const alts = nearestSafe(norm);
      if (alts[0]) replacements.push({ from: raw, to: alts[0].hex, verdict: cls.verdict, delta: +alts[0].delta.toFixed(3) });
    }
  }

  // write a .bak before mutating
  const bak = file + ".bak";
  copyFileSync(file, bak);

  const applied = [];
  for (const r of replacements) {
    // replace every case-insensitive occurrence of the hex token (word-bounded)
    const re = new RegExp(r.from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "gi");
    const matches = text.match(re);
    const count = matches ? matches.length : 0;
    if (count) {
      text = text.replace(re, r.to);
      applied.push({ ...r, count });
    }
  }
  writeFileSync(file, text);

  // re-audit to report what remains (colors should now be clean)
  const after = audit(file);
  const remaining = after.issues.filter((i) => i.type !== "color");

  return {
    file,
    backup: bak,
    replacements: applied,
    colorsFixed: applied.length,
    remaining,
    remainingSummary: remaining.length
      ? `${remaining.length} non-color issue(s) remain (need Claude): ` +
        remaining.map((i) => i.type).filter((v, i, a) => a.indexOf(v) === i).join(", ")
      : "all color slop snapped; nothing else flagged.",
    reauditPass: after.pass,
  };
}

// ===========================================================================
// CLI
// ===========================================================================
function isJson(args) { return args.includes("--json"); }
function strip(args, ...flags) { return args.filter((a) => !flags.includes(a)); }

function human(out) { console.log(typeof out === "string" ? out : JSON.stringify(out, null, 2)); }

function main(argv) {
  const [cmd, ...rest] = argv;
  const json = isJson(rest);
  const args = strip(rest, "--json");

  switch (cmd) {
    case "color": {
      const r = colorReport(args[0]);
      if (json) return human(r);
      console.log(`color ${r.hex}  ->  ${r.verdict}  (slop ${r.slop}/100)`);
      console.log(`  reason: [${r.reason.kind}] ${r.reason.detail}`);
      if (r.alternatives.length) {
        console.log(`  alternatives (lower-slop, closest):`);
        for (const a of r.alternatives) console.log(`    ${a.hex}  slop ${a.slop}  ΔEok ${a.deltaEok}  — ${a.reason}`);
      }
      return;
    }
    case "palette": {
      const r = paletteReport(args[0], args[1], args[2], args[3]);
      if (json) return human(r);
      console.log(`palette  ground=${args[0]} ink=${args[1]} accent=${args[2]}${args[3] ? " accent2=" + args[3] : ""}  ->  ${r.pass ? "PASS" : "FLAGGED"}`);
      console.log(`  template: ${r.matchedTemplate || "(unseen combination)"}  share ${r.templateSharePct}%  freshness ${r.freshness}`);
      for (const [role, v] of Object.entries(r.perRole)) {
        console.log(`  ${role.padEnd(7)} ${v.hex}  ${v.verdict}${v.ban ? ` (${v.ban})` : ""}`);
        if (v.fix) for (const fx of v.fix) console.log(`      fix-> ${fx.hex} (ΔEok ${fx.deltaEok}, ${fx.reason})`);
      }
      return;
    }
    case "font": {
      const fam = args.join(" ");
      const r = fontReport(fam);
      if (json) return human(r);
      console.log(`font "${r.family}"  ->  ${r.verdict}  (foundational=${r.isFoundational})`);
      console.log(`  why: ${r.why}`);
      if (r.alternatives.length) {
        console.log(`  alternatives (visually near, fresher):`);
        for (const a of r.alternatives) console.log(`    ${a.family}${a.supplier ? ` [${a.supplier}]` : ""}  — ${a.why}`);
      }
      return;
    }
    case "fonts": {
      const n = args[0] ? parseInt(args[0], 10) : 4;
      const r = freshFonts(n);
      if (json) return human(r);
      console.log(`fresh non-slop suggestions (display + body):`);
      for (const p of r.picks) console.log(`  ${p.category.padEnd(11)} ${p.family} [${p.supplier}] rank ${p.popularityRank}  — ${p.why}`);
      console.log(`  pairing: display=${r.pairing.display}  body=${r.pairing.body}`);
      console.log(`  ${r.pairing.note}`);
      return;
    }
    case "audit": {
      const file = args.find((a) => a !== "--fix");
      const fix = args.includes("--fix");
      if (!file) { console.error("usage: audit <file.html> [--fix] [--json]"); process.exit(2); }
      if (fix) {
        const r = autoFix(file);
        if (json) return human(r);
        console.log(`audit --fix  ${r.file}  (backup: ${r.backup})`);
        console.log(`  colors auto-fixed: ${r.colorsFixed}`);
        for (const a of r.replacements) console.log(`    ${a.from} -> ${a.to}  (${a.verdict}, ΔEok ${a.delta}, ${a.count}x)`);
        console.log(`  re-audit pass: ${r.reauditPass}`);
        console.log(`  ${r.remainingSummary}`);
        for (const i of r.remaining) console.log(`    [${i.type} sev ${i.severity}] ${i.detail}\n        FIX: ${i.fix}`);
        return;
      }
      const r = audit(file);
      if (json) return human(r);
      console.log(`audit  ${r.file}  ->  ${r.pass ? "PASS" : "FAIL"}`);
      console.log(`  ${r.summary}`);
      for (const i of r.issues) console.log(`  [${i.type} sev ${i.severity}/5] ${i.detail}\n        FIX: ${i.fix}`);
      return;
    }
    default:
      console.error(`unknown command: ${cmd || "(none)"}
usage:
  node api.mjs color   <hex> [--json]
  node api.mjs palette <ground> <ink> <accent> [accent2] [--json]
  node api.mjs font    <family...> [--json]
  node api.mjs fonts   [n] [--json]
  node api.mjs audit   <file.html> [--fix] [--json]`);
      process.exit(2);
  }
}

// run as CLI only when invoked directly
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main(process.argv.slice(2));
}
