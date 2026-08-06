// engine.mjs — the fixmyslop query engine, PURE and portable (browser + Worker).
//
// No fs, no child_process, no Date.now/Math.random. Data (corpus/brands/fonts) is
// injected via createEngine(), so the same module powers the CLI, the web UI, and
// the MCP Worker. Logic is ported faithfully from viz/personality-test/{color/*,api.mjs}.

import * as SYS from "./system.mjs";
import fontSpaceBundle from "./data/font-space.json" with { type: "json" };
import { deriveBaseHue, hashToUint32, functionalScore, FUNCTIONAL_THRESHOLD, deriveRegister } from "./intent.mjs";

// ===========================================================================
// font-space.json hydration — Subsystem 4 (font-neighbor retrieval).
//
// The bundle is stored positionally (see scripts/build-service-bundle.mjs for
// why: object keys and neighbor id strings repeated ~2000x is the difference
// between ~550kb and ~1.7mb). Hydrate it once, here, into normal records.
// ===========================================================================
function hydrateFontSpace(bundle) {
  const ids = bundle?.ids || [];
  const entries = bundle?.entries || [];
  const entryFields = bundle?.entryFields || [];
  const metricKeys = bundle?.metricKeys || [];
  if (!ids.length || !entries.length) return null;
  const familyByIndex = new Array(ids.length);
  const fi = entryFields.indexOf("family");
  for (let i = 0; i < entries.length; i++) familyByIndex[i] = entries[i][fi];
  const records = entries.map((row, i) => {
    const obj = {};
    entryFields.forEach((k, j) => { obj[k] = row[j]; });
    const metrics = {};
    metricKeys.forEach((k, j) => { metrics[k] = obj.metrics ? obj.metrics[j] : undefined; });
    metrics.hasItalics = !!metrics.hasItalics;
    const neighbors = (obj.neighbors || [])
      .map(([nIdx, sim]) => (ids[nIdx] ? { id: ids[nIdx], family: familyByIndex[nIdx], sim } : null))
      .filter(Boolean);
    return {
      id: ids[i], family: obj.family, category: obj.category, supplier: obj.supplier,
      popularityRank: obj.popularityRank, trendingRank: obj.trendingRank, quality: obj.quality || 0,
      isFoundational: !!obj.isFoundational, isBrandFont: !!obj.isBrandFont,
      metrics, personality: obj.personality || {}, neighbors,
    };
  });
  const byId = new Map(records.map((r) => [r.id, r]));
  const byFamily = new Map(records.map((r) => [r.family.toLowerCase(), r]));
  return { records, byId, byFamily };
}
const FONT_SPACE = hydrateFontSpace(fontSpaceBundle);

// ===========================================================================
// Color-space math (OKLab/OKLCH/ΔEok/WCAG) — pure. From color/color-space.mjs.
// ===========================================================================
export function hexToRgb(hex) {
  let h = String(hex).trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`bad hex: ${hex}`);
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbToHex([r, g, b]) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}
const srgbToLinearC = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const linearToSrgbC = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
const srgbToLinear = ([r, g, b]) => [srgbToLinearC(r), srgbToLinearC(g), srgbToLinearC(b)];
const linearToSrgb = ([r, g, b]) => [linearToSrgbC(r), linearToSrgbC(g), linearToSrgbC(b)];

export function linearToOklab([r, g, b]) {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  return [
    0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
  ];
}
export function oklabToLinear([L, a, b]) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  return [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
}
export const hexToOklab = (hex) => linearToOklab(srgbToLinear(hexToRgb(hex).map((c) => c / 255)));
export function oklabToSrgb([L, a, b]) {
  const srgb = linearToSrgb(oklabToLinear([L, a, b]));
  const eps = 1e-4;
  const inGamut = srgb.every((c) => c >= -eps && c <= 1 + eps);
  return { hex: rgbToHex(srgb.map((c) => c * 255)), inGamut, srgb };
}
export const isInGamut = ([L, a, b]) => oklabToSrgb([L, a, b]).inGamut;
export function oklabToOklch([L, a, b]) {
  const C = Math.hypot(a, b);
  let H = (Math.atan2(b, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return [L, C, H];
}
export const oklchToOklab = ([L, C, H]) => {
  const r = (H * Math.PI) / 180;
  return [L, C * Math.cos(r), C * Math.sin(r)];
};
export const hexToOklch = (hex) => oklabToOklch(hexToOklab(hex));
export const deltaEok = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
const relLum = ([r, g, b]) => {
  const [R, G, B] = srgbToLinear([r / 255, g / 255, b / 255]);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
};
export function contrastRatio(hexA, hexB) {
  const la = relLum(hexToRgb(hexA)), lb = relLum(hexToRgb(hexB));
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

// ===========================================================================
// CONFIG + hard bans — from color/density.mjs (must stay in sync).
// ===========================================================================
export const CONFIG = {
  BANDWIDTH: 0.02, OVERUSE_THRESHOLD: 40.0, NEUTRAL_CHROMA: 0.04,
  MIN_INTENTIONAL_CHROMA: 0.05, DUPLICATE_DELTA: 0.05,
};
const BANNED_HEXES = new Set([
  "#6366f1", "#7c3aed", "#8b5cf6", "#818cf8", "#a78bfa", "#a855f7",
  "#2563eb", "#3b82f6", "#22d3ee", "#2dd4bf", "#67e8f9", "#5eead4",
]);
// design-law.md hard gate ("Color"): "No indigo/violet AI-accent (hue ~215–280, S>55%,
// mid lightness) ... No reflexive fintech-blue CTA." OKLCH chroma doesn't map 1:1 to
// HSL saturation, but C>0.12 is the empirical equivalent of "S>55%" for sRGB-gamut
// hues in this band (verified against the collapsed #1a89d1 fintech-blue regression:
// oklch H244 C0.14 L0.61 — squarely inside 215-280/mid-lightness and just missed the
// old, narrower 245-310/C>0.18 thresholds). "Mid lightness" = L in [0.3, 0.8] — near-
// black/near-white tints of the same hue aren't the AI-accent look. The whole 215-280
// span is banned (superseding the narrower legacy 1A/1E sub-bands below it used to
// split at 264/245) — this is ONE band, not two, per the law's own wording.
const INDIGO_BAND_LO = 215, INDIGO_BAND_HI = 280, INDIGO_BAND_CHROMA = 0.12;
const INDIGO_BAND_L_LO = 0.3, INDIGO_BAND_L_HI = 0.8;
function inIndigoVioletBand(L, C, H) {
  return C > INDIGO_BAND_CHROMA && H >= INDIGO_BAND_LO && H <= INDIGO_BAND_HI
    && L >= INDIGO_BAND_L_LO && L <= INDIGO_BAND_L_HI;
}
// Generation-time avoidance is DELIBERATELY stricter than hardBanned()'s own C>0.12 cutoff: a
// mid-saturation indigo (C 0.08-0.12, e.g. the #4866aa regression — oklch H265 C0.113 L0.52) still
// reads as the collapsed AI-accent look even though it doesn't clear hardBanned's literal
// design-law.md "S>55%" threshold. hardBanned() (used to classify an already-authored/caller-
// supplied hex) keeps the stricter 0.12 cutoff; inBannedHueBand (used by isSafeAccentLab, i.e. only
// on the GENERATION path) uses this lower one so generatePalette never draws that close to the line
// in the first place.
const INDIGO_GEN_AVOID_CHROMA = 0.08;
export function hardBanned(hex) {
  const h = hex.toLowerCase();
  if (BANNED_HEXES.has(h)) return `literal slop hex ${h}`;
  const [L, C, H] = hexToOklch(hex);
  if (inIndigoVioletBand(L, C, H)) return `indigo/violet AI-accent / reflexive fintech-blue (oklch H${H.toFixed(0)} C${C.toFixed(2)} L${L.toFixed(2)}) — banned per design-law.md hard gate (hue 215-280, S>55%, mid lightness)`;
  if (C >= 0.10 && H >= 170 && H <= 215 && L >= 0.65) return `1B electric cyan/mint (oklch H${H.toFixed(0)} C${C.toFixed(2)} L${L.toFixed(2)})`;
  return null;
}
function inBannedHueBand([L, C, H]) {
  if (C < CONFIG.NEUTRAL_CHROMA) return false;
  if (inIndigoVioletBand(L, C, H)) return true;
  if (H >= INDIGO_BAND_LO && H <= INDIGO_BAND_HI && C > INDIGO_GEN_AVOID_CHROMA
    && L >= INDIGO_BAND_L_LO && L <= INDIGO_BAND_L_HI) return true;
  if (H >= 165 && H <= 222 && L >= 0.5) return true;
  return false;
}

// The AI-monoculture font avoid-list + popularity slop tier — from api.mjs.
const AVOID_LIST = new Set([
  "inter", "poppins", "playfair display", "playfair", "space grotesk", "outfit",
  "dm sans", "montserrat", "roboto", "lato", "open sans", "geist", "manrope",
  "cormorant", "cormorant garamond", "fraunces", "instrument serif", "clash display",
  "general sans", "sora", "plus jakarta sans", "figtree", "epilogue", "satoshi",
]);
const POPULARITY_SLOP_TOP_N = 40;

// ===========================================================================
// Novelty/gimmick display-face demotion — fonts.json/font-space.json carry no explicit
// "novelty"/"gimmick" tag, so this is a name heuristic over a small, checked family of
// bitmap/pixel display faces (verified against font-space.json: Bitcount + its 11 weight/
// grid/ink/prop variants, Coral Pixels, Geist Pixel, Pixelify Sans, Rubik Pixels — no
// collateral matches on legitimate families). WHY this exists: font-space.json's `quality`
// field scores the entire Bitcount family at 0.89 — tied for the highest quality of any
// display face in the bundle — which let retrieveFonts/freshnessScore treat a bitmap
// novelty gimmick as the single best "distinctive" display pick, then explore.mjs's 4
// directions each landed on a different Bitcount VARIANT (same family, 4 hats). A
// characterful grotesque/serif/sans is "distinctive"; a pixel/bitmap gimmick is a novelty
// prop — never the default display face. Only an explicitly very-high-experimentalism
// intent (>0.85) may reach for one.
const NOVELTY_DISPLAY_RX = /bitcount|pixel|bitmap|8-?bit|arcade|dingbat|wingding/i;
const NOVELTY_EXPERIMENTALISM_THRESHOLD = 0.85;
function isNoveltyDisplay(f) {
  return !!f && f.category === "display" && NOVELTY_DISPLAY_RX.test(f.family || "");
}
function noveltyAllowed(intent) {
  return !!intent && clamp01Local(intent.experimentalism, 0) > NOVELTY_EXPERIMENTALISM_THRESHOLD;
}

// ===========================================================================
// familyRoot(name) — normalizes sibling font-face variants ("Bitcount Grid Single Ink",
// "Bitcount Grid Double Ink", …) down to a shared root ("bitcount") so a caller asking to
// exclude an already-used family also excludes its variants — the fix for 4 explore
// directions each picking a different Bitcount VARIANT and reading as 4 distinct fonts
// when they're one family wearing 4 hats. Only strips a small curated list of variant/
// weight modifier words trailing the name — deliberately does NOT strip category words
// (sans/serif/display/text/mono) that distinguish genuinely different type designs (e.g.
// "Source Serif 4" must stay distinct from "Source Sans 3").
// ===========================================================================
const FAMILY_MODIFIER_WORDS = new Set([
  "grid", "ink", "single", "double", "triple", "prop", "dot", "dotted", "pixel",
  "wide", "narrow", "condensed", "expanded", "italic", "variable",
  "rounded", "outline", "fill", "solid", "light", "medium", "black", "thin", "bold",
]);
export function familyRoot(name) {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean);
  while (words.length > 1 && FAMILY_MODIFIER_WORDS.has(words[words.length - 1].toLowerCase())) {
    words.pop();
  }
  return words.join(" ").toLowerCase();
}

// ===========================================================================
// Surface-fit envelope — condition TYPE selection on intent (Subsystem 4 fix).
//
// WHY: retrieveFonts()/styleGenome() used to pick display/body faces purely from
// feature-distance + popularity math, blind to what the intent said about the
// surface. That let a loud pixel/display face (e.g. "Bitcount Single Ink") land on
// a dashboard's headings/metrics — illegible, form fighting function — because
// nothing gated category against contentDensity/formality/energy. This is that gate.
//
// FUNCTIONAL SCORE: a continuous [0,1] blend of the three intent dials the task
// calls out — high contentDensity, high formality, low energy — weighted so a
// single extreme dial alone (e.g. just high formality on an otherwise relaxed
// intent) doesn't flip the whole envelope, but a genuinely data-dense/restrained
// surface (dashboards, consoles, admin apps) clears the FUNCTIONAL_THRESHOLD on
// its priors alone (see intent.mjs SURFACE_JOB_PRIORS: dashboard → cd .8, formality
// .7, energy .35 → score ~.73). Expressive/brand surfaces (marketing, portfolio —
// low density, high energy/experimentalism) stay well under it.
//   functionalScore = 0.4·contentDensity + 0.35·formality + 0.25·(1−energy)
//   FUNCTIONAL_THRESHOLD = 0.55
//
// ENVELOPE RULES (documented per the task):
//   - functional (score ≥ 0.55): body/metric role MUST be sans-serif or monospace
//     (serif dropped too — a data-dense surface wants a numeral-friendly workhorse,
//     never a text serif); display/heading role forbids display + handwriting
//     categories outright (no decorative/pixel/novelty face carries a metric or a
//     functional heading) — a restrained sans (or a serif, if formality is also
//     high — grotesque/serif reads more "restrained" than novelty) may head.
//   - expressive (score < 0.55): body stays the existing serif/sans-serif gate;
//     display is free to use an actual `display` category face — that's the point
//     of a brand/marketing surface having identity type.
// ===========================================================================
const clamp01Local = (v, fallback = 0.5) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;
};
function surfaceFontEnvelope(intent) {
  const score = functionalScore(intent || {});
  return {
    functionalScore: score,
    functional: score >= FUNCTIONAL_THRESHOLD,
    formality: intent ? clamp01Local(intent.formality) : 0.5,
  };
}

// ===========================================================================
// classifyFontGenre(f) + REGISTER_GENRE_RULES — FIX 1, the font-subject-fit gate.
//
// SIGNAL USED: font-space.json/fonts.json carry NO explicit genre/personality-of-form tag (the
// `personality` field that exists is only {professional, calm} — a mood pair, not a genre). So,
// same as isNoveltyDisplay above, this classifies from `category` (the one structural signal every
// record has) + a small, checked family-name regex per genre + (when font-space metrics are
// present) `metrics.strokeContrast` to split "restrained text serif" from "ornate/high-contrast
// display serif" within the single `serif` category. Verified against font-space.json's actual
// display-category names (see engine.test.mjs / type-color-fit.test.mjs) — not a guess.
// ===========================================================================
const BLACKLETTER_RX = /gotisch|fraktur|unifraktur|uncial|blackletter|textura\b|old\s*english/i;
const SCRIPT_RX = /swash|script|cursiv|calligraph|brush|freehand|handjet|fasthand/i;
const DECORATIVE_RX = /creepster|nosifer|butcherman|distress|graffiti|\bhorror\b|circus|western|jokerman|frighten|grunge|zombie|vampire|halloween|carnival/i;
const SLAB_RX = /slab|rockwell|clarendon|antique\b|egyptienne|typewriter/i;
const ORNATE_SERIF_STROKE_CONTRAST = 0.55;

export function classifyFontGenre(f) {
  if (!f) return "unknown";
  const name = f.family || "";
  if (BLACKLETTER_RX.test(name)) return "blackletter";
  if (f.category === "handwriting" || SCRIPT_RX.test(name)) return "script";
  if (isNoveltyDisplay(f) || (f.category === "display" && DECORATIVE_RX.test(name))) return "decorative";
  if (SLAB_RX.test(name)) return "slab";
  if (f.category === "monospace") return "mono";
  if (f.category === "serif") {
    const strokeContrast = Number(f.metrics && f.metrics.strokeContrast);
    return Number.isFinite(strokeContrast) && strokeContrast >= ORNATE_SERIF_STROKE_CONTRAST ? "ornate-serif" : "serif";
  }
  if (f.category === "sans-serif") return "sans";
  if (f.category === "display") return "display-other";
  return "unknown";
}

// ===========================================================================
// fontPresence(f) → [0,1] — a display face's visual ASSERTIVENESS / how space-hungry it is.
//
// The font↔layout coupling axis (user ask): a wide/bold/high-contrast display face commands space
// and only reads well with air around it; a neutral grotesque/mono sits quietly in a dense layout.
// So retrieveFonts (below) matches a face's presence to the resolved layout's `layoutAir` — never a
// space-hungry face crammed into a tight layout. Derived from the SAME signals every other type
// gate uses: classifyFontGenre (the structural genre) + font-space metrics (strokeContrast,
// counterSize, xHeightRatio). Degrades to the genre base alone when metrics are absent — never throws.
// Pure/deterministic.
// ===========================================================================
const PRESENCE_GENRE_BASE = {
  decorative: 0.9, blackletter: 0.85, "display-other": 0.82, "ornate-serif": 0.78,
  script: 0.6, slab: 0.55,
  serif: 0.4, sans: 0.35,
  mono: 0.25, unknown: 0.5,
};
export function fontPresence(f) {
  if (!f) return 0.5;
  let p = PRESENCE_GENRE_BASE[classifyFontGenre(f)] ?? 0.5;
  const m = f.metrics || {};
  const num = (k) => (Number.isFinite(Number(m[k])) ? Number(m[k]) : NaN);
  const sc = num("strokeContrast");
  if (Number.isFinite(sc)) p += 0.25 * (sc - 0.3);   // high stroke contrast reads more present
  const cs = num("counterSize");
  if (Number.isFinite(cs)) p += 0.10 * (cs - 0.5);   // large counters = bigger footprint on the page
  const xh = num("xHeightRatio");
  if (Number.isFinite(xh)) p += 0.10 * (xh - 0.6);   // tall x-height reads larger at a given point size
  return Math.min(1, Math.max(0, p));
}

// REGISTER → genre weighting (design-director fix: match font PERSONALITY to the SUBJECT'S
// register, generalizing the functional/expressive novelty gate above). `exclude` genres are
// filtered out entirely for that register's display role (not just demoted — a dev-tool brief
// should never reach a blackletter/swash face, regardless of how experimental the intent dial is;
// that dial governs how BOLD a pick is within the appropriate register, not whether the register
// itself is honored). `demote`/`prefer` are soft fit adjustments (still reachable, just not the
// default). Other registers keep their own appropriate personalities allowed.
const REGISTER_GENRE_RULES = {
  "technical-precise": {
    exclude: new Set(["blackletter", "script", "decorative"]),
    demote: new Set(["ornate-serif", "display-other"]),
    prefer: new Set(["slab", "mono", "sans"]),
  },
  "neutral-corporate": {
    exclude: new Set(["blackletter", "script", "decorative"]),
    demote: new Set(["display-other"]),
    prefer: new Set(["sans", "serif", "slab"]),
  },
  "friendly-consumer": {
    exclude: new Set(["blackletter"]),
    demote: new Set([]),
    prefer: new Set(["script", "sans", "display-other"]),
  },
  "expressive-editorial": {
    exclude: new Set([]),
    demote: new Set([]),
    prefer: new Set(["ornate-serif", "display-other", "script", "slab"]),
  },
};
const genreRulesFor = (intent) => REGISTER_GENRE_RULES[deriveRegister(intent || {})] || REGISTER_GENRE_RULES["expressive-editorial"];
const REGISTER_DEMOTE_PENALTY = 1.4;
const REGISTER_PREFER_BONUS = 0.45;
// Font↔layout presence coupling (soft bias, never a hard filter — variety must survive).
// MISMATCH is asymmetric-by-construction: it only bites when presence > layoutAir (a space-hungry
// face in a too-tight layout — the failure the user called out); a quiet face in an airy layout is
// not penalized by it, only mildly un-rewarded by MATCH. Magnitudes sit alongside the register
// bonuses so they reorder sensibly without ever dominating quality/readability.
const PRESENCE_MISMATCH = 0.9;
const PRESENCE_MATCH = 0.4;

// seeded PRNG — keeps generation deterministic + portable (no Math.random). Exported at module
// scope so other pure engine modules (e.g. perturb.mjs) can share the exact same stream algorithm
// without going through createEngine().
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ===========================================================================
// Engine factory — inject {corpus:[{hex,weight}], brands:[{name,ic:[]}], fonts:[...]}
// ===========================================================================
export function createEngine({ corpus = [], brands = [], fonts = [], fontSpace = FONT_SPACE } = {}) {
  // pre-compute corpus labs + weights for the KDE
  const pts = corpus.map((c) => ({ lab: hexToOklab(c.hex), w: c.weight || 1 }));
  const brandLabs = brands.flatMap((b) => (b.ic || []).map((hex) => {
    try { return { name: b.name, hex, lab: hexToOklab(hex) }; } catch { return null; }
  }).filter(Boolean));

  function density(lab, bandwidth = CONFIG.BANDWIDTH) {
    const twoSigma2 = 2 * bandwidth * bandwidth;
    let sum = 0;
    for (const p of pts) {
      const d2 = (lab[0] - p.lab[0]) ** 2 + (lab[1] - p.lab[1]) ** 2 + (lab[2] - p.lab[2]) ** 2;
      sum += p.w * Math.exp(-d2 / twoSigma2);
    }
    return sum;
  }
  const densityHex = (hex) => density(hexToOklab(hex));
  const slopScore = (d) => Math.min(100, Math.round((d / CONFIG.OVERUSE_THRESHOLD) * 100));

  function classify(hex) {
    const [L, C, H] = hexToOklch(hex);
    const ban = hardBanned(hex);
    const neutral = C < CONFIG.NEUTRAL_CHROMA;
    const d = densityHex(hex);
    let verdict;
    if (ban) verdict = "HARD-BANNED";
    else if (neutral) verdict = "NEUTRAL-ok";
    else if (d >= CONFIG.OVERUSE_THRESHOLD) verdict = "OVERUSED";
    else verdict = "SAFE";
    return { hex: hex.toLowerCase(), oklch: { L, C, H }, verdict, density: d, ban, neutral };
  }

  function isSafeAccentLab(lab, { minChroma = CONFIG.MIN_INTENTIONAL_CHROMA, allowBandEdge = false } = {}) {
    if (!isInGamut(lab)) return false;
    const { hex } = oklabToSrgb(lab);
    if (hardBanned(hex)) return false;
    const lch = oklabToOklch(lab);
    if (!allowBandEdge && inBannedHueBand(lch)) return false;
    if (density(lab) >= CONFIG.OVERUSE_THRESHOLD) return false;
    if (lch[1] < minChroma) return false;
    return true;
  }

  function nearestSafe(hex, { count = 3, maxDelta = 0.6 } = {}) {
    const startLab = hexToOklab(hex);
    const startDensity = density(startLab);
    const [L0, C0, H0] = oklabToOklch(startLab);
    const neutralInput = C0 < CONFIG.NEUTRAL_CHROMA;
    const minChroma = neutralInput ? 0 : CONFIG.MIN_INTENTIONAL_CHROMA;
    const dLs = [0, 0.02, -0.02, 0.04, -0.04, 0.06, -0.06, 0.08, -0.08, 0.12, -0.12, 0.16, -0.16];
    const dCs = [0, 0.02, -0.02, 0.04, -0.04, 0.06, -0.06, 0.09, -0.09, 0.12, -0.12, 0.15];
    const dHs = [0];
    for (let s = 5; s <= 60; s += 5) { dHs.push(s); dHs.push(-s); }
    const seen = new Set(); const candidates = [];
    for (const dH of dHs) for (const dL of dLs) for (const dC of dCs) {
      const L = L0 + dL, C = Math.max(0, C0 + dC), H = (H0 + dH + 360) % 360;
      if (L <= 0.05 || L >= 0.99) continue;
      const lab = oklchToOklab([L, C, H]);
      if (!isSafeAccentLab(lab, { minChroma, allowBandEdge: true })) continue;
      const cd = density(lab);
      if (cd >= startDensity) continue;
      const { hex: chex } = oklabToSrgb(lab);
      if (seen.has(chex)) continue;
      seen.add(chex);
      const delta = deltaEok(startLab, lab);
      if (delta > maxDelta) continue;
      candidates.push({ hex: chex, lab, L, C, H, dH, delta, density: cd });
    }
    candidates.sort((a, b) => a.delta - b.delta || a.density - b.density);
    const picked = [];
    for (const c of candidates) {
      if (picked.some((p) => deltaEok(p.lab, c.lab) < CONFIG.DUPLICATE_DELTA)) continue;
      const sameFamily = Math.abs(c.dH) <= 15;
      picked.push({
        hex: c.hex, lab: c.lab, oklch: { L: c.L, C: c.C, H: c.H }, density: density(c.lab), delta: c.delta,
        reason: sameFamily
          ? `same hue family, shifted out of the hot zone (ΔEok ${c.delta.toFixed(2)})`
          : `hue shifted ${c.dH > 0 ? "+" : ""}${c.dH}° to escape the slop band (ΔEok ${c.delta.toFixed(2)})`,
      });
      if (picked.length >= count) break;
    }
    return picked.map(({ lab, ...rest }) => rest);
  }

  function brandClone(hex, maxDelta = 0.06) {
    const lab = hexToOklab(hex);
    let best = null;
    for (const b of brandLabs) {
      const d = deltaEok(lab, b.lab);
      if (d <= maxDelta && (!best || d < best.delta)) best = { brand: b.name, brandHex: b.hex, delta: +d.toFixed(3) };
    }
    return best;
  }

  function colorReason(hex, cls) {
    const clone = brandClone(hex);
    if (clone) return { kind: "brand-clone", detail: `≈ ${clone.brand} identity color ${clone.brandHex} (ΔEok ${clone.delta}) — cloning a known brand reads as derivative`, brand: clone.brand };
    if (cls.ban) return { kind: "framework-default", detail: `${cls.ban} — a Tailwind/shadcn/Framer default; the AI-monoculture accent` };
    if (cls.verdict === "OVERUSED") return { kind: "framework-default", detail: `sits in a crowded zone of the empirical corpus (density ${cls.density.toFixed(1)} ≥ ${CONFIG.OVERUSE_THRESHOLD}) — everyone keeps reaching for this` };
    return { kind: "fresh", detail: "not a brand clone, not a framework default, low corpus density — fresh" };
  }

  function checkColor(hex) {
    const cls = classify(hex);
    const reason = colorReason(hex, cls);
    const flagged = cls.verdict === "HARD-BANNED" || cls.verdict === "OVERUSED";
    return {
      hex: cls.hex, verdict: cls.verdict, slop: slopScore(cls.density),
      oklch: { L: +cls.oklch.L.toFixed(3), C: +cls.oklch.C.toFixed(3), H: +cls.oklch.H.toFixed(1) },
      reason,
      alternatives: flagged ? nearestSafe(hex).map((s) => ({ hex: s.hex, slop: slopScore(s.density), deltaEok: +s.delta.toFixed(3), reason: s.reason })) : [],
    };
  }

  function checkPalette(ground, ink, accent, accent2) {
    const roles = [["ground", ground], ["ink", ink], ["accent", accent]];
    if (accent2) roles.push(["accent2", accent2]);
    const perRole = {};
    for (const [role, hex] of roles) {
      if (!hex) continue;
      const cls = classify(hex);
      const flagged = cls.verdict === "HARD-BANNED" || cls.verdict === "OVERUSED";
      perRole[role] = {
        hex: cls.hex, verdict: cls.verdict, density: +cls.density.toFixed(2), ban: cls.ban,
        fix: flagged ? nearestSafe(hex).map((s) => ({ hex: s.hex, deltaEok: +s.delta.toFixed(3), reason: s.reason })) : null,
      };
    }
    // near-duplicate check across chosen colors
    const chosen = roles.filter(([, h]) => h).map(([role, h]) => ({ role, hex: h, lab: hexToOklab(h) }));
    const dupes = [];
    for (let i = 0; i < chosen.length; i++) for (let j = i + 1; j < chosen.length; j++) {
      const d = deltaEok(chosen[i].lab, chosen[j].lab);
      if (d < CONFIG.DUPLICATE_DELTA) dupes.push({ a: chosen[i].role, b: chosen[j].role, delta: +d.toFixed(3) });
    }
    // contrast (ink on ground) — a11y hint
    let contrast = null;
    if (ground && ink) { try { contrast = +contrastRatio(ground, ink).toFixed(2); } catch { /* bad hex */ } }
    return {
      perRole, duplicates: dupes, contrast,
      pass: Object.values(perRole).every((r) => r.verdict === "SAFE" || r.verdict === "NEUTRAL-ok") && dupes.length === 0,
    };
  }

  /**
   * checkColorFit(hex, intent) → { pass, verdict, hex, reason?, fallback? }
   *
   * The color-side sibling to checkTypeFit — the gate that catches a collapsed accent
   * landing in the design-law.md hard-banned indigo/violet/reflexive-fintech-blue band
   * (hue 215-280, S>55%, mid lightness — see hardBanned() above) OR the electric
   * cyan/mint glow band, REGARDLESS of how it was produced (generatePalette already
   * refuses to emit either band on its own gate-passing path, so a violation here means
   * a caller-supplied/anchored accent, or an un-gated hex, bypassed that path). On a
   * violation, `fallback` is NOT a random nearestSafe() nudge — it's a hue re-grounded
   * in the intent's own material (deriveBaseHue: warmth/energy/era/surface, per
   * "Palette = intent, not seed" in design-law.md), so the fix reads as this subject's
   * color, not just "the first non-banned neighbor."
   */
  function checkColorFit(hex, intent = null) {
    let cls;
    try { cls = classify(hex); } catch { return { pass: false, verdict: "INVALID", hex, reason: `not a valid hex: ${hex}`, fallback: null }; }
    if (cls.verdict !== "HARD-BANNED") return { pass: true, verdict: cls.verdict, hex: cls.hex, fallback: null };
    const groundedHue = deriveBaseHue(intent || {});
    const grounded = generatePalette({ hue: groundedHue, energy: "balanced", seed: hashToUint32(`checkColorFit:${cls.hex}`) });
    return {
      pass: false,
      verdict: cls.verdict,
      hex: cls.hex,
      reason: cls.ban,
      fallback: {
        hex: grounded.accent,
        hue: Math.round(groundedHue),
        note: `re-grounded to the intent's own material hue (~${Math.round(groundedHue)}°, derived from warmth/energy/era/surface) instead of the banned band`,
      },
    };
  }

  // ---- fonts ----
  function freshnessScore(f, { experimentalism = 0 } = {}) {
    if (!f) return -Infinity;
    if (AVOID_LIST.has(f.family.toLowerCase())) return -Infinity;
    if (f.isBrandFont) return -Infinity;
    if (isNoveltyDisplay(f) && !(experimentalism > NOVELTY_EXPERIMENTALISM_THRESHOLD)) return -Infinity;
    let s = 0;
    if (isNoveltyDisplay(f)) s -= 4.0; // allowed (very-high-experimentalism) but still never the default
    if (f.supplier && f.supplier !== "google") s += 1.0;   // was 2.5 — stop chasing the obscure indie tail
    if (!f.isFoundational) s += 0.6;
    const rank = f.popularityRank || 9999;
    if (rank > 100 && rank < 900) s += 1.5;
    else if (rank >= 900 && rank < 1400) s += 0.6;
    else if (rank >= 1400 && rank < 1800) s -= 1.0;         // NEW: distinctive fades into novelty
    else if (rank >= 1800) s -= 2.5;                        // NEW: the novelty tail (Kihim 2114) is demoted
    else if (rank <= 100) s -= 2.0;
    s += (f.quality || 0) * 1.2;
    return s;
  }
  function bodyScore(f) {
    if (!f) return -Infinity;
    if (AVOID_LIST.has(f.family.toLowerCase())) return -Infinity;
    if (f.isBrandFont) return -Infinity;
    if (!["serif", "sans-serif"].includes(f.category)) return -Infinity; // never display/handwriting/mono for running text
    let s = 0;
    if (f.isFoundational) s += 3.0;          // the flag literally means "usable as a NEUTRAL body workhorse"
    const rank = f.popularityRank || 9999;
    if (rank > 40 && rank < 1200) s += 1.0;  // distinctive but vetted enough to read
    else if (rank <= 40) s -= 1.0;           // the monoculture floor
    s += (f.quality || 0) * 1.5;
    if (f.supplier && f.supplier !== "google") s += 0.4;
    return s;
  }
  const findFont = (family) => {
    const fam = family.trim().toLowerCase();
    return fonts.find((f) => f.family.toLowerCase() === fam) || fonts.find((f) => f.family.toLowerCase().startsWith(fam)) || null;
  };
  function checkFont(family) {
    const f = findFont(family);
    if (!f) return { family, verdict: "UNKNOWN", why: `"${family}" is not in the font index — can't certify it; prefer a known fresh family.`, isFoundational: false, alternatives: suggestFonts(4).picks };
    const fam = f.family.toLowerCase();
    const onAvoid = AVOID_LIST.has(fam);
    const topTier = (f.popularityRank || 9999) <= POPULARITY_SLOP_TOP_N;
    const isSlop = onAvoid || topTier;
    const base = { family: f.family, supplier: f.supplier, category: f.category, popularityRank: f.popularityRank };
    const slopWhy = onAvoid ? "on the avoid-list" : `top-${POPULARITY_SLOP_TOP_N} popularity (rank ${f.popularityRank})`;
    if (isSlop && f.isFoundational) return { ...base, verdict: "SLOP-allowed-foundational", isFoundational: true, why: `${f.family} is AI-monoculture slop (${slopWhy}), but isFoundational=true rescues it: usable as a NEUTRAL body workhorse only — never the display face.`, alternatives: suggestFonts(4).picks };
    if (isSlop) return { ...base, verdict: "SLOP", isFoundational: false, why: `${f.family} is AI-monoculture slop (${slopWhy}) — do NOT use it for ANY role.`, alternatives: suggestFonts(4).picks };
    return { ...base, verdict: "FRESH", isFoundational: !!f.isFoundational, why: `${f.family} is not on the avoid-list and not top-tier popular (rank ${f.popularityRank ?? "?"}, supplier ${f.supplier}) — a distinctive choice.`, alternatives: [] };
  }
  function suggestFonts(n = 4, { category = null, intent = null } = {}) {
    const experimentalism = intent ? clamp01Local(intent.experimentalism, 0) : 0;
    const disp = fonts.map((f) => ({ f, score: freshnessScore(f, { experimentalism }) })).filter((x) => x.score > -Infinity)
      .filter((x) => x.f.category === "display").sort((a, b) => b.score - a.score);
    const body = fonts.map((f) => ({ f, score: bodyScore(f) })).filter((x) => x.score > -Infinity)
      .sort((a, b) => b.score - a.score);
    const pickOf = (arr) => arr.map((x) => ({
      family: x.f.family, supplier: x.f.supplier, category: x.f.category, popularityRank: x.f.popularityRank,
      isFoundational: !!x.f.isFoundational,
      why: `${x.f.category === "display" ? "characterful display" : "readable body workhorse"}: rank ${x.f.popularityRank}, ${x.f.supplier}`,
    }));
    if (category === "display") return { picks: pickOf(disp).slice(0, n), pairing: pairFrom(disp, body) };
    if (category === "body") return { picks: pickOf(body).slice(0, n), pairing: pairFrom(disp, body) };
    const half = Math.max(1, Math.ceil(n / 2));
    const picks = [...pickOf(disp).slice(0, half), ...pickOf(body).slice(0, n - half)].slice(0, n);
    return { picks, pairing: pairFrom(disp, body) };
  }
  function pairFrom(disp, body) {
    return {
      display: disp[0]?.f.family || null,
      body: body[0]?.f.family || null,
      note: "Display face carries identity (headings, name); body face carries running text — never swap them. The display pick is distinctive; confirm it reads for your context.",
    };
  }

  // retrieveFonts — Subsystem 4: rich, neighbor-aware retrieval over fontSpace
  // (metrics + personality + precomputed visual neighbors). This is what the
  // connected genome uses for type; suggestFonts stays as the light catalogue path.
  // Falls back to the catalogue when the font-space bundle is absent.
  const round3 = (x) => Math.round(x * 1000) / 1000;
  const pick01 = (v) => (Number.isFinite(Number(v)) ? Number(v) : NaN);
  const BODY_CATEGORIES = new Set(["serif", "sans-serif"]);
  function overusePenalty(f) {
    let p = 0;
    if (AVOID_LIST.has((f.family || "").toLowerCase())) p += 1.0;
    if (f.isBrandFont) p += 0.6;
    const rank = f.popularityRank || 9999;
    if (rank <= POPULARITY_SLOP_TOP_N) p += 0.8;
    else if (rank <= 100) p += 0.4;
    if ((f.trendingRank || 9999) <= 40) p += 0.3;
    return p;
  }
  function readabilityChecks(f, { allowMonospaceBody = false } = {}) {
    const x = Number((f.metrics || {}).xHeightRatio);
    // HARD body gate: a text workhorse must be serif/sans (or, on a functional/
    // data-dense surface, monospace — numeral alignment) with a generous x-height.
    // This is the structural fix for the "display serif as body" failure.
    const catOk = BODY_CATEGORIES.has(f.category) || (allowMonospaceBody && f.category === "monospace");
    const bodySuitable = catOk && (!Number.isFinite(x) || x >= 0.48);
    return { bodySuitable, displaySuitable: true };
  }
  function featureDistanceFor(f, role, intent) {
    const m = f.metrics || {};
    const g = (k, d) => (Number.isFinite(Number(m[k])) ? Number(m[k]) : d);
    const ideal = role === "body"
      ? { xHeightRatio: 0.72, apertureOpenness: 0.6, strokeContrast: 0.2 }
      : { xHeightRatio: 0.6, apertureOpenness: 0.5, strokeContrast: 0.45 };
    let d2 = 0, n = 0;
    for (const k of Object.keys(ideal)) { const dv = g(k, ideal[k]) - ideal[k]; d2 += dv * dv; n++; }
    let dist = Math.sqrt(d2 / Math.max(1, n));
    // personality nudge — only when both intent and the font carry a real signal.
    if (intent && f.personality) {
      const formal = pick01(intent.formality), prof = Number(f.personality.professional);
      if (Number.isFinite(formal) && Number.isFinite(prof)) dist += Math.abs(formal - prof) * 0.4;
      const energy = pick01(intent.energy), calm = Number(f.personality.calm);
      if (Number.isFinite(energy) && Number.isFinite(calm)) dist += Math.abs((1 - energy) - calm) * 0.4;
    }
    return dist;
  }
  function retrieveFonts({ role = "display", intent = null, like = null, exclude = [], n = 6, layoutAir = undefined } = {}) {
    const space = fontSpace && fontSpace.records && fontSpace.records.length ? fontSpace : null;
    if (!space) {
      const picks = suggestFonts(n, { category: role === "body" ? "body" : "display" }).picks;
      return picks.map((p) => ({
        family: p.family, role, featureDistance: null, visualDistance: null, overusePenalty: null,
        readabilityChecks: { bodySuitable: role === "body", displaySuitable: true },
        neighbors: [], provenance: "catalogue-fallback",
      }));
    }
    const ex = new Set((exclude || []).map((e) => String(e).toLowerCase()));
    // family-root exclusion: excluding "Bitcount" (or any family) also excludes its variants
    // ("Bitcount Grid Single Ink", …) — the fix for 4 explore directions each landing on a
    // DIFFERENT Bitcount variant (one novelty family wearing 4 hats) instead of 4 real families.
    const exRoots = new Set([...ex].map((e) => familyRoot(e)));
    const allowNovelty = noveltyAllowed(intent);
    let pool = space.records, simById = null;
    if (like) {
      const seed = space.byFamily.get(String(like).toLowerCase()) || space.byId.get(String(like).toLowerCase());
      if (seed && seed.neighbors.length) {
        simById = new Map(seed.neighbors.map((nb) => [nb.id, nb.sim]));
        pool = seed.neighbors.map((nb) => space.byId.get(nb.id)).filter(Boolean);
      }
    }
    const envelope = surfaceFontEnvelope(intent);
    const genreRules = genreRulesFor(intent);
    const scored = [];
    for (const f of pool) {
      if (ex.has((f.family || "").toLowerCase()) || ex.has((f.id || "").toLowerCase())) continue;
      if (exRoots.has(familyRoot(f.family))) continue;
      if (role === "display" && isNoveltyDisplay(f) && !allowNovelty) continue; // pixel/bitmap gimmick — never the default display face
      if (role === "display" && genreRules.exclude.has(classifyFontGenre(f))) continue; // FIX 1: register↔personality mismatch (blackletter/script/decorative out of register for this subject)
      const rc = readabilityChecks(f, { allowMonospaceBody: envelope.functional });
      if (role === "body" && !rc.bodySuitable) continue;   // never a display-only face for running text
      if (role === "body" && envelope.functional && f.category === "serif") continue; // functional body/metric: sans-serif or monospace only, never serif
      if (role === "display" && envelope.functional && (f.category === "display" || f.category === "handwriting")) continue; // functional heading: no decorative/pixel/novelty face — checkTypeFit is the belt-and-suspenders re-check downstream
      const featureDistance = featureDistanceFor(f, role, intent);
      const pen = overusePenalty(f);
      const sim = simById ? (simById.get(f.id) || 0) : 0;
      let fit = (f.quality || 0) * 1.2 - featureDistance - pen + sim * 1.5
        + (role === "body" && f.isFoundational ? 0.6 : 0)
        + (role === "display" && !f.isFoundational ? 0.3 : 0);
      if (role === "display" && isNoveltyDisplay(f)) fit -= 4.0; // allowed at very-high-experimentalism, but never the default over a characterful non-gimmick face
      if (role === "display") {
        const genre = classifyFontGenre(f);
        if (genreRules.demote.has(genre)) fit -= REGISTER_DEMOTE_PENALTY;   // FIX 1: e.g. an ornate display-serif on a technical-precise register
        else if (genreRules.prefer.has(genre)) fit += REGISTER_PREFER_BONUS; // FIX 1: e.g. a grotesk/geometric-sans/mono/slab on a technical-precise register
      }
      if (envelope.functional) {
        if (role === "display" && f.category === "sans-serif") fit += 0.4;   // restrained sans is the default functional head
        if (role === "display" && f.category === "serif" && envelope.formality >= 0.65) fit += 0.2; // high formality: serif/grotesque over novelty
        if (role === "body" && f.category === "monospace") fit += 0.2;       // numeral-heavy metrics read well in mono
      } else if (role === "display" && f.category === "display") {
        fit += 0.3; // expressive/brand surface: an actual display face is the point
      }
      // ── font↔layout presence coupling (only when the caller supplied resolved layoutAir; absent
      // → identical to pre-coupling behavior, back-compat). ──
      if (Number.isFinite(layoutAir)) {
        if (role === "display") {
          const presence = fontPresence(f);
          fit -= PRESENCE_MISMATCH * Math.max(0, presence - layoutAir); // space-hungry face in a tight layout: the worst case
          fit += PRESENCE_MATCH * (1 - Math.abs(presence - layoutAir)); // reward presence ≈ air
        } else if (role === "body" && layoutAir < 0.4) {
          const xh = Number((f.metrics || {}).xHeightRatio);
          if (Number.isFinite(xh)) fit += 0.2 * Math.max(0, xh - 0.6); // dense layout: favor a legible high-x-height body
        }
      }
      scored.push({
        family: f.family, role, fit, category: f.category,
        featureDistance: round3(featureDistance),
        visualDistance: simById ? round3(1 - sim) : null,
        overusePenalty: round3(pen),
        readabilityChecks: rc,
        neighbors: f.neighbors.slice(0, 6).map((nb) => nb.family),
        provenance: "font-space.json",
      });
    }
    scored.sort((a, b) => b.fit - a.fit);
    return scored.slice(0, n).map(({ fit, ...rest }) => rest);
  }

  /**
   * checkTypeFit({ display, body }, intent) → { pass, violations, fallback }
   *
   * The surface-appropriateness GATE (sibling to checkColor/checkPalette) — the check that would
   * have caught the dashboard-gets-Bitcount failure. Re-checks a resolved {display, body} font
   * assignment against the SAME surface-fit envelope retrieveFonts() already filters candidates
   * by (see surfaceFontEnvelope above), so a violation can only reach here via a path that bypassed
   * retrieveFonts's own gate (e.g. a caller-supplied family, or the neighbor-seeded `like` pool).
   * Never throws; `fallback` names the nearest legible replacement (retrieveFonts's own top pick
   * for that role under the same intent) for each violating role, null for roles that already pass.
   */
  function checkTypeFit({ display, body } = {}, intent = null) {
    const envelope = surfaceFontEnvelope(intent);
    const recordFor = (family) => {
      if (!family) return null;
      const rec = fontSpace && fontSpace.byFamily ? fontSpace.byFamily.get(String(family).toLowerCase()) : null;
      if (rec) return rec;
      const f = findFont(family);
      return f ? { family: f.family, category: f.category, metrics: {} } : null;
    };
    const categoryOf = (family) => {
      const rec = recordFor(family);
      return rec ? rec.category : null;
    };
    const violations = [];
    const bodyCategory = categoryOf(body);
    if (envelope.functional && bodyCategory && !["sans-serif", "monospace"].includes(bodyCategory)) {
      violations.push({
        role: "body", family: body, category: bodyCategory,
        reason: `functional/data-dense surface (functionalScore ${envelope.functionalScore.toFixed(2)} ≥ ${FUNCTIONAL_THRESHOLD}) requires a sans-serif or monospace body/metric face — "${body}" is ${bodyCategory}`,
      });
    }
    const displayCategory = categoryOf(display);
    if (envelope.functional && displayCategory && ["display", "handwriting"].includes(displayCategory)) {
      violations.push({
        role: "display", family: display, category: displayCategory,
        reason: `functional/data-dense surface forbids decorative/novelty display faces on the heading role — "${display}" is ${displayCategory}; use a restrained sans (or serif if formality is also high)`,
      });
    }
    // FIX 1: register↔personality gate — independent of `envelope.functional` (a landing-page-shaped
    // dev-tool brief doesn't clear the functional threshold on its dials alone, see deriveRegister's
    // doc comment in intent.mjs, but its SUBJECT is still technical-precise and must never head with
    // a blackletter/script/decorative face).
    if (!violations.some((v) => v.role === "display")) {
      const register = deriveRegister(intent);
      const genreRules = genreRulesFor(intent);
      const displayGenre = classifyFontGenre(recordFor(display));
      if (genreRules.exclude.has(displayGenre)) {
        violations.push({
          role: "display", family: display, category: displayCategory, genre: displayGenre,
          reason: `"${register}" register forbids a ${displayGenre} display face — "${display}" reads ${displayGenre}, out of register for this subject`,
        });
      }
    }
    if (!violations.length) return { pass: true, violations: [], fallback: null };
    const fallbackFor = (role, exclude) => {
      const picks = retrieveFonts({ role, intent, n: 6, exclude: exclude ? [exclude] : [] });
      return picks[0] ? picks[0].family : null;
    };
    return {
      pass: false,
      violations,
      fallback: {
        display: violations.some((v) => v.role === "display") ? fallbackFor("display", display) : display,
        body: violations.some((v) => v.role === "body") ? fallbackFor("body", body) : body,
      },
    };
  }

  // energy → accent chroma band (kept inside the gate). The caller expresses the
  // subject's mood, not a number.
  const ENERGY_CHROMA = { muted: [0.06, 0.11], calm: [0.06, 0.11], balanced: [0.10, 0.16], bold: [0.15, 0.20], vivid: [0.15, 0.20] };

  // MOOD profiles — the ground/surface/ink lightness+chroma envelope for a palette "story". Before
  // this, freshNeutral() had ONE hard-coded ground band (L 0.93-0.965, C 0.006-0.02) no matter what
  // — every direction's ground landed as a near-white pastel ("colors are missing"). `mood` lets a
  // caller (explore.mjs spreads one per direction) pick a genuinely different color story: light
  // paper, a real (non-black) dark ground, a richly tinted surface, or a stark high-contrast pair.
  // `light` is EXACTLY the historical band (back-compat default — no caller passes mood → identical
  // behavior to before this change). `secondaryHueOffset` (non-null moods only) is a second, safely
  // -banded hue for a genuine secondary/semantic color beyond "accent2 = accent, just lighter".
  //
  // FIX 2 (neutral-dominant palette, round 2): round 1 kept `groundC` under CONFIG.NEUTRAL_CHROMA
  // (0.04) for every mood, but a real critic still saw "the whole page washed in one hue" for
  // light/tinted/contrast — only `dark` read as neutral. The bug wasn't chroma, it was LIGHTNESS:
  // "tinted" put its ground at L 0.80-0.89, a full step down from a true off-white (~0.93+). At
  // that lightness even a "legal" C 0.014-0.03 tint reads as a saturated pastel wash (all-sage,
  // all-pink) covering the entire canvas, not a whisper of undertone — because the eye judges
  // colorfulness relative to how far a surface sits from white/black, not chroma in isolation, and
  // `surface` inherited the same low-but-nonzero chroma band across every card/panel on the page,
  // so the wash didn't stop at the ground either. `tinted`'s ground AND surface are now pinned to
  // the same near-neutral lightness+chroma neighborhood as `light`/`dark`/`contrast` — genuinely
  // neutral, not just numerically under a threshold. Its "tinted" character moves entirely to
  // things that are meant to be scarce/expressive: a stronger `chromaBoost` on the accent, and a
  // `secondaryHueOffset` that gives accent2/badges/chart-highlights (and any ONE inverted/dark
  // feature band a build adds) their own distinct hue — never the canvas or the general surface.
  const MOOD_PROFILES = {
    light: {
      groundL: [0.93, 0.965], groundC: [0.006, 0.02], inkL: [0.15, 0.24], inkC: [0.006, 0.02],
      surfaceLOffset: -0.05, chromaBoost: 0, secondaryHueOffset: null,
      fbGround: "#eceae3", fbSurface: "#e1ddd2", fbInk: "#17150f",
    },
    dark: {
      groundL: [0.08, 0.17], groundC: [0.012, 0.03], inkL: [0.88, 0.96], inkC: [0.006, 0.02],
      surfaceLOffset: 0.05, chromaBoost: 0.02, secondaryHueOffset: 150,
      fbGround: "#141210", fbSurface: "#201c17", fbInk: "#f2efe9",
    },
    tinted: {
      groundL: [0.90, 0.94], groundC: [0.006, 0.018], inkL: [0.12, 0.20], inkC: [0.006, 0.02],
      surfaceLOffset: -0.10, chromaBoost: 0.04, secondaryHueOffset: -130,
      fbGround: "#e9e6df", fbSurface: "#d8d4ca", fbInk: "#1c1710",
    },
    contrast: {
      groundL: [0.97, 0.99], groundC: [0.004, 0.012], inkL: [0.03, 0.07], inkC: [0.006, 0.014],
      surfaceLOffset: -0.05, chromaBoost: 0.05, secondaryHueOffset: 150,
      fbGround: "#f7f6f3", fbSurface: "#ebe9e4", fbInk: "#0c0b09",
    },
  };

  // generatePalette({ hue?, energy?, accent?, seed?, mood? }) — INTENT-driven, not seed-driven.
  // The agent grounds it in the subject: a target `hue` from the real material and/or an
  // `energy` mood, or an `accent` hex to anchor on. `seed` is an internal reproducibility
  // detail (the tool layer varies it), NOT something a caller should think about. A bare
  // number is still accepted for back-compat. `mood` (default "light", back-compat) picks the
  // ground/ink color story — see MOOD_PROFILES above.
  function generatePalette(opts = {}) {
    if (typeof opts === "number") opts = { seed: opts };
    const { hue = null, energy = "balanced", accent = null, seed = 1, mood = "light" } = opts;
    const profile = MOOD_PROFILES[mood] || MOOD_PROFILES.light;
    const rand = mulberry32((seed >>> 0) || 1);
    const rnd = (lo, hi) => lo + rand() * (hi - lo);
    const buildHex = (L, C, H) => { const o = oklabToSrgb(oklchToOklab([L, C, H])); return o.inGamut ? o.hex : null; };
    const [cLoBase, cHiBase] = ENERGY_CHROMA[energy] || ENERGY_CHROMA.balanced;
    const cLo = Math.min(0.22, cLoBase + profile.chromaBoost);
    const cHi = Math.min(0.24, cHiBase + profile.chromaBoost);
    const wrap = (h) => ((h % 360) + 360) % 360;
    // an accent around a given hue center (± small jitter) or free; chroma band is caller-set —
    // shared by the primary accent, accent2, and the (mood-gated) secondary hue below.
    const freshAccentAt = (hueCenter, lo, hi) => {
      for (let t = 0; t < 300; t++) {
        const H = hueCenter != null ? wrap(hueCenter + rnd(-14, 14)) : rand() * 360;
        const L = rnd(0.45, 0.68), C = rnd(lo, hi);
        const lab = oklchToOklab([L, C, H]);
        if (isSafeAccentLab(lab, { minChroma: CONFIG.MIN_INTENTIONAL_CHROMA })) return buildHex(L, C, H);
      }
      return null;
    };
    const freshAccent = () => freshAccentAt(hue, cLo, cHi);
    // honor a caller-provided accent hex, nudged non-slop if it isn't clean
    const anchored = () => {
      if (!accent) return null;
      const chk = checkColor(accent);
      if (chk.verdict === "SAFE" || chk.verdict === "NEUTRAL-ok") return chk.hex;
      return (chk.alternatives && chk.alternatives[0] && chk.alternatives[0].hex) || null;
    };
    // neutral ground/surface/ink, hue biased toward the accent so the palette reads cohesive
    // (skills/fix-ai-slop/reference/color.md: "tint neutrals ~0.005–0.02 chroma toward the brand
    // hue"). Lightness/chroma envelope comes from `profile` — this is what makes "dark"/"tinted"/
    // "contrast" moods actually different color stories instead of always-near-white-pastel, while
    // staying genuinely NEUTRAL (low chroma) rather than a paler wash of the accent's own hue.
    // `kind: "surface"` is a second neutral elevation (cards/panels) offset in lightness from
    // `ground` by `profile.surfaceLOffset` — the "neutrals dominate" structure (ground + surface)
    // that gives the scarce accent something to sit ON TOP of, instead of one flat wash.
    const clampL = (v) => Math.min(0.99, Math.max(0.02, v));
    const freshNeutral = (kind) => {
      const [Llo, Lhi] = kind === "ink" ? profile.inkL : profile.groundL;
      const [Clo, Chi] = kind === "ink" ? profile.inkC : profile.groundC;
      let lo = Llo, hi = Lhi;
      if (kind === "surface") {
        const off = profile.surfaceLOffset || 0;
        lo = clampL(Llo + off); hi = clampL(Lhi + off);
        if (lo > hi) { const t = lo; lo = hi; hi = t; }
      }
      for (let t = 0; t < 300; t++) {
        const L = rnd(lo, hi);
        const nH = hue != null ? wrap(hue + rnd(-30, 30)) : rand() * 360;
        const hex = buildHex(L, rnd(Clo, Chi), nH);
        if (!hex) continue;
        const v = classify(hex).verdict;
        if (v === "SAFE" || v === "NEUTRAL-ok") return hex;
      }
      if (kind === "ink") return profile.fbInk;
      if (kind === "surface") return profile.fbSurface;
      return profile.fbGround;
    };
    for (let a = 0; a < 60; a++) {
      const acc = anchored() || freshAccent() || "#1f6e4c";
      const pal = {
        ground: freshNeutral("ground"), surface: freshNeutral("surface"), ink: freshNeutral("ink"),
        accent: acc, accent2: freshAccent() || acc,
      };
      const p = checkPalette(pal.ground, pal.ink, pal.accent, pal.accent2);
      if (p.pass && p.contrast != null && p.contrast >= 4.5) {
        const secondary = profile.secondaryHueOffset != null && hue != null
          ? freshAccentAt(wrap(hue + profile.secondaryHueOffset), cLoBase, cHiBase)
          : null;
        return { ...pal, secondary, contrast: p.contrast, hue, energy, mood };
      }
    }
    const fb = {
      ground: profile.fbGround, surface: profile.fbSurface, ink: profile.fbInk,
      accent: anchored() || "#b5522f", accent2: "#2f6b5e", secondary: null,
    };
    return { ...fb, contrast: +contrastRatio(fb.ground, fb.ink).toFixed(2), hue, energy, mood };
  }
  function designSystem({ baseFont = 18, baseUnit = 4, ratio = "perfect-fourth", radiusBase = 8, hue = null, energy = "balanced", accent = null, seed = 1 } = {}) {
    return {
      palette: generatePalette({ hue, energy, accent, seed }),
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

  return {
    checkColor, checkPalette, checkColorFit, checkFont, checkTypeFit, suggestFonts, retrieveFonts,
    classifyFontGenre, fontPresence, deriveRegister,
    classify, nearestSafe, brandClone,
    density: densityHex, contrastRatio, CONFIG,
    generatePalette, designSystem, auditSystem,
    ...SYS,
  };
}
