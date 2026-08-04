// apps/engine/background.mjs — Subsystem 3c: the BACKGROUND / MATERIAL axis (pure math, no AI,
// no Math.random, no Date.now — deterministic; runs in a Cloudflare Worker, the browser, and the
// CLI). Mirrors layout-families.mjs + perturb.mjs: a hand-authored treatment taxonomy (select) +
// slop gates (S1-S16) + seeded perturbation (the PERTURB_V1 always-draw contract), instead of
// reinventing the wiring pattern. Spec: docs/background-material-taxonomy.md.
//
// `deriveBackground(family, iv, streamSeed)` → BackgroundGenome. `family` is a LAYOUT_FAMILIES
// entry (layout-families.mjs) — we read `family.pageKind` and `family.materialSlots` /
// `family.sectionGrammar` only, no import needed. `iv` is the same intent-values bag every other
// axis consumes ({materiality, energy, layoutVariance, contentDensity, contrastPreference, craft}),
// PLUS two optional additions this axis reads: `iv.theme` ("light"/"dark", default "light") and
// `iv.hue` (0-360, an already-computed accent hue to anchor the background on — this is how
// exploreDirections gets 4 backgrounds that don't collide: it feeds each direction's own
// 40°-separated palette hue in here, so the background rotates WITH the palette rather than
// picking an independent, possibly-colliding hue of its own).
//
// `streamSeed == null` → no perturbation: deterministic authored defaults, zero RNG draws (mirrors
// perturb.mjs's amplitude-0 passthrough / "no-seed path stays stable" contract).

import { mulberry32 } from "./engine.mjs";
import { hashToUint32 } from "./intent.mjs";

const clamp01 = (n, fallback = 0.5) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.min(1, Math.max(0, x));
};
const clampRange = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const round = (n, d = 4) => Math.round(n * 10 ** d) / 10 ** d;
const wrapHue = (h) => ((Number(h) % 360) + 360) % 360;
const band3 = (x, low, mid, high) => (x < 0.34 ? low : x < 0.67 ? mid : high);

// ── §1 taxonomy — treatment metadata (docs/background-material-taxonomy.md §1). One entry per
// treatment this engine can emit. `owned` marks the handful the doc assigns to a different module
// (B1-B4 radius/shadow/border/accent already live in layout-families.mjs `deriveMaterial`). ─────
export const BACKGROUND_TREATMENTS = {
  "A1-flat-tinted-neutral": {
    group: "field", doc: "A1",
    taste: "off-black/off-white or a tinted neutral, chroma ~0.005-0.02 toward the brand hue",
    slop: "pure #000/#fff (S12); cream/beige 'tasteful' default (S13)",
  },
  "A1-flat-saturated-escape": {
    group: "field", doc: "A1",
    taste: "a committed solid saturated fill — a documented slop-escape move, not a default",
    slop: "over-saturated fill, accent chroma >= cap (S14)",
  },
  "A2-linear-gradient-tonal": {
    group: "field", doc: "A2",
    taste: "2 stops, small hue travel, low chroma, models light on a real surface",
    slop: "AI purple->cyan gradient: high ΔH + high chroma in the violet/indigo->cyan band (S1)",
  },
  "A3-radial-glow": {
    group: "field", doc: "A3", gatedOffByDefault: true,
    taste: "a deliberate light source with a reason to be there",
    slop: "saturated radial glow / spotlight halo on dark, unmotivated (S3)",
  },
  "A4-mesh-blob": {
    group: "field", doc: "A4", gatedOffByDefault: true,
    taste: "rare, brand-tied, single restrained palette",
    slop: "multi-hue high-blur purple-leaning mesh reached for as the default 'modern SaaS' hero (S2)",
  },
  "A5-grain-fixed-overlay": {
    group: "field", doc: "A5",
    taste: "subtle, on a fixed pointer-events-none pseudo-element only",
    slop: "grain on a scrolling container — perf + taste tell (S15)",
  },
  "A6-dot-grid": {
    group: "field", doc: "A6",
    taste: "low-opacity, supports a canvas/map/measurement task",
    slop: "decorative dot-grid behind ordinary marketing content (S10)",
  },
  "A7-line-grid": {
    group: "field", doc: "A7",
    taste: "only when it supports a canvas, map, or measurement task",
    slop: "decorative grid-line background with no functional surface (S10)",
  },
  "A8-repeating-stripes": {
    group: "field", doc: "A8", gatedOffByDefault: true,
    taste: "essentially never as generic decoration",
    slop: "repeating-gradient stripes used as surface decoration (S9)",
  },
  "A9-geometric-pattern": {
    group: "field", doc: "A9", gatedOffByDefault: true,
    taste: "brand-specific motif, low-density, motivated",
    slop: "generic tiled pattern as filler",
  },
  "A11-duotone-image": {
    group: "field", doc: "A11",
    taste: "photo pushed to a two-tone brand palette — a strong, cheap brand-unifier",
    slop: "over-saturation / illegible mid-tones",
  },
  "A12-band-alternation": {
    group: "field", doc: "A12",
    taste: "rhythm that differentiates sections within ONE page theme",
    slop: "uniform white sections stacked / same treatment every band / theme-invert mid-scroll (S16)",
  },
  "B5-glass": {
    group: "surface", doc: "B5",
    taste: "only to solve a real layering problem — inner border + inset highlight + reduced-transparency fallback",
    slop: "glassmorphism everywhere — decoration, not layering (S4)",
  },
  "B6-vignette": {
    group: "surface", doc: "B6",
    taste: "inset highlight for physical edge refraction, used sparingly",
    slop: "overdone vignette as faux-depth with no material logic",
  },
  "signal-flat": {
    group: "surface", doc: "B3-adjacent",
    taste: "a purposeful accent chip, no glow by default",
    slop: "colored box-shadow glow on dark as the default 'cool' AI look (S5)",
  },
  // §B1-B4 (radius/shadow/border/accentStrategy) are owned by layout-families.mjs deriveMaterial —
  // listed here only so the S-row table below is complete; not emitted by this module.
  "B1-radius-language": { group: "surface", doc: "B1", owned: "layout-families.mjs deriveMaterial" },
  "B2-shadow-language": { group: "surface", doc: "B2", owned: "layout-families.mjs deriveMaterial" },
  "B4-border-language": { group: "surface", doc: "B4", owned: "layout-families.mjs deriveMaterial" },
  "C1-gradient-text": {
    group: "cross-cutting", doc: "C1", gatedOffByDefault: true,
    taste: "essentially none for headings/metrics",
    slop: "gradient text on headings/metrics — decorative, not meaningful (S11)",
  },
  "C2-animated-background": {
    group: "cross-cutting", doc: "C2", gatedOffByDefault: true,
    taste: "one high-impact moment, respects prefers-reduced-motion",
    slop: "perpetual animated mesh/particles as ambient filler",
  },
};

// ── §3 danger-zone table (docs/background-material-taxonomy.md §3), S1-S16, for reference/report
// use. Rows this module actively gates are marked `active:true`; S5-S8 are per-element radius/
// shadow/border tells already governed by layout-families.mjs `deriveMaterial`'s radiusLanguage/
// shadowLanguage/borderLanguage bands (band3 over the `materiality` dial) — out of THIS axis's
// scope (no per-element border/shadow data reaches deriveBackground), so they're documented here
// but delegated, not re-implemented. ────────────────────────────────────────────────────────────
export const SLOP_TABLE = {
  S1: { name: "AI purple/violet->cyan gradient", active: true },
  S2: { name: "Mesh/blob lava-lamp bg (multi-hue)", active: true },
  S3: { name: "Radial glow / spotlight halo on dark", active: true },
  S4: { name: "Glassmorphism-everywhere", active: true },
  S5: { name: "Colored box-shadow glow (dark-mode neon)", active: true, note: "background-axis slice only (accent-signal slots); the shadowLanguage half is owned by deriveMaterial" },
  S6: { name: "Ghost card (hairline + wide diffuse shadow)", active: false, owned: "layout-families.mjs deriveMaterial" },
  S7: { name: "Side-accent border on rounded card", active: false, owned: "layout-families.mjs deriveMaterial" },
  S8: { name: "Extreme radius blob", active: false, owned: "layout-families.mjs deriveMaterial" },
  S9: { name: "Repeating-gradient stripes as decor", active: true },
  S10: { name: "Decorative grid/dot-grid behind ordinary content", active: true },
  S11: { name: "Gradient text", active: true },
  S12: { name: "Pure #000/#fff fields", active: true },
  S13: { name: "Cream/beige 'tasteful' default", active: true },
  S14: { name: "Over-saturated fill", active: true },
  S15: { name: "Grain on scroll container", active: true },
  S16: { name: "Section-invert theme break", active: true },
};

// ── numeric thresholds the gates check against (docs §3, translated to this module's param units:
// hue in degrees, lightness/chroma/opacity as [0,1] proxies for OKLCH L/C). ─────────────────────
const SAT_CAP = 0.32;              // S14 — chroma proxy for "saturation >= 80%"
const SAT_CLAMP = 0.26;
const CREAM_HUE_LO = 25, CREAM_HUE_HI = 55;      // S13 — warm-cream hue band
const CREAM_LIGHTNESS_MIN = 0.90;
const CREAM_CHROMA_MAX = 0.035;
const PURPLE_LO = 255, PURPLE_HI = 305;          // S1 — violet/indigo band
const CYAN_LO = 175, CYAN_HI = 205;              // S1 — cyan band
const HUE_TRAVEL_DANGER = 25;
const CHROMA_DANGER = 0.14;
const GRID_OPACITY_MAX = 0.22;                    // S10 taste ceiling even where allowed (raised — see
                                                   // "make backgrounds visible" pass: 0.14 rendered as an
                                                   // imperceptible haze; canvas-capable surfaces can carry
                                                   // a real, working grid at this ceiling)
const GRAIN_OPACITY_MAX = 0.18;                   // A5 taste ceiling (raised from 0.08 — see above; 0.035
                                                   // default opacity was invisible on screen)
const BAND_ALTERNATION_MAX = 0.72;                // S16
const GLASS_FILL_OPACITY_MAX = 0.16;
const OFFBLACK_MIN_L = 0.04, OFFWHITE_MAX_L = 0.97;
const MIN_TINT_CHROMA = 0.006;

// functionalScore — SAME formula as engine.mjs's surfaceFontEnvelope / intent.mjs's deriveBaseHue
// (0.4·contentDensity + 0.35·formality + 0.25·(1−energy)), duplicated here rather than imported so
// this module stays a pure fn of the `iv` dial bag every axis already receives (matches the existing
// duplication pattern between engine.mjs and intent.mjs). Used to make the background axis
// surface-aware: functional/dense surfaces (dashboards, consoles) want a quieter-but-present ground;
// expressive/marketing surfaces can carry a visibly stronger field.
function functionalScoreOf(iv) {
  return clamp01(0.4 * clamp01(iv.contentDensity) + 0.35 * clamp01(iv.formality) + 0.25 * (1 - clamp01(iv.energy)));
}

const CANVAS_CAPABLE_PAGEKINDS = new Set(["dashboard", "data-admin", "app", "technical", "explain"]);
const canvasCapable = (pageKind) => CANVAS_CAPABLE_PAGEKINDS.has(pageKind);

// Slots plausibly overlaying real media/canvas (glass "solves a real layering problem" — §B5,
// gated by a layeringDepth proxy since we have no live crawl signal at genome-gen time).
const GLASS_ELIGIBLE_SLOT_RE = /hero|marquee|workspace|instrument|diagram|figure|canvas|frame/i;
const SIGNAL_SLOT_RE = /accent|signal|alert|status/i;
const FIGURE_SLOT_RE = /figure|diagram|frame|detail|mosaic/i;

function hasBandSlots(family) {
  if ((family.materialSlots || []).some((s) => /band/i.test(s))) return true;
  return (family.sectionGrammar || []).some((s) => /band/i.test(s.role));
}
function hasFigureSlot(family) {
  return (family.materialSlots || []).some((s) => FIGURE_SLOT_RE.test(s));
}

// ── deterministic default hue (no RNG): a pure hash of the family name, used only when the
// caller hasn't supplied iv.hue. Deliberately NOT grounded in the corpus's most-frequent gradient
// hue (indigo/blue — see data/observations.gradients.json) because that frequency IS the S1 slop
// signal (§2 principle 12: "refuse the category default"); frequency is a slop-risk prior here,
// not a taste target. ──────────────────────────────────────────────────────────────────────────
function defaultHue(family) {
  return hashToUint32(`bg-hue:${family.name}`) % 360;
}

// ── base (unperturbed) treatment selection — pure fn of dials + family, no RNG. Mirrors
// layout-families.mjs deriveMaterial's band3-over-dials pattern. ────────────────────────────────
function selectFieldTreatment(family, iv) {
  if (hasBandSlots(family)) return "A12-band-alternation";
  const m = iv.materiality, e = iv.energy, lv = iv.layoutVariance, craft = iv.craft, fs = iv.functionalScore;
  if (e > 0.75 && m < 0.3) return "A1-flat-saturated-escape";
  if (canvasCapable(family.pageKind) && lv < 0.4) {
    return m > 0.5 ? "A6-dot-grid" : "A7-line-grid";
  }
  // expressive/bold surfaces (low functionalScore, energetic) earn a visibly stronger field even
  // at moderate materiality/craft — design-law "earn the whitespace": a marketing surface with
  // room to breathe should carry a real tonal wash, not default to a near-white plate.
  if (fs < 0.45 && e >= 0.5 && m >= 0.45) return "A2-linear-gradient-tonal";
  if (m >= 0.66 && craft >= 0.45) return "A2-linear-gradient-tonal";
  if (m >= 0.4 && craft >= 0.6) return "A5-grain-fixed-overlay";
  if (hasFigureSlot(family) && m >= 0.5) return "A11-duotone-image";
  return "A1-flat-tinted-neutral";
}

// authored default params per treatment — grounded where cheap (data/observations.*), else
// taxonomy-authored (see report: A2/A5/A6/A7/A12 params below are taxonomy defaults, not mined —
// no corpus field captures gradient stop count, grain scale, dot spacing, or band alternation rate
// directly; only endpoint-hue clustering and %-of-sites tells are captured today).
//
// PERCEPTIBILITY + INTENT VARIANCE (design-law "backgrounds are a present design element, not a
// whisper" pass): every branch below is a function of `iv.energy`/`iv.functionalScore`, not a flat
// constant — expressive/bold surfaces (low functionalScore, high energy) carry a visibly stronger
// field (more chroma, lower/higher lightness swing away from near-white/near-black); functional/
// dense surfaces (high functionalScore) stay quieter but are NEVER back to near-untinted — the
// floor everywhere is well above MIN_TINT_CHROMA so the ground always reads as a real hue.
function baseParams(treatment, iv, hue) {
  const theme = iv.theme === "dark" ? "dark" : "light";
  const e = clamp01(iv.energy);
  const fs = clamp01(iv.functionalScore);
  switch (treatment) {
    case "A1-flat-tinted-neutral": {
      // chroma: 0.020 (quiet/functional) .. 0.075 (bold/expressive) — visibly tinted either way.
      const chroma = round(clampRange(0.03 + e * 0.045 - fs * 0.02, 0.02, 0.075), 4);
      const lightness = theme === "dark"
        ? round(clampRange(0.13 - e * 0.03 + fs * 0.02, 0.08, 0.18), 4)
        : round(clampRange(0.93 - e * 0.05 + fs * 0.015, 0.85, 0.955), 4);
      return { hue, lightness, chroma };
    }
    case "A1-flat-saturated-escape":
      return { hue, lightness: 0.5, chroma: 0.16 };
    case "A2-linear-gradient-tonal": {
      // chroma: 0.06 (restrained) .. 0.13 (bold) — stays clear of CHROMA_DANGER (0.14)/SAT_CAP (0.32).
      const chroma = round(clampRange(0.07 + e * 0.06 - fs * 0.03, 0.055, 0.13), 4);
      const lightness = theme === "dark"
        ? round(clampRange(0.24 - e * 0.06, 0.14, 0.28), 4)
        : round(clampRange(0.88 - e * 0.08, 0.72, 0.9), 4);
      return { hue, hueDelta: 14, angle: 135, stopCount: 2, chroma, lightness };
    }
    case "A5-grain-fixed-overlay": {
      // opacity: 0.06 (quiet) .. 0.16 (bold) — perceptible film-grain, was an invisible 0.035 flat.
      const opacity = round(clampRange(0.09 + e * 0.06 - fs * 0.03, 0.06, 0.16), 4);
      const chroma = round(clampRange(0.02 + e * 0.02, 0.016, 0.045), 4);
      return { hue, lightness: theme === "dark" ? 0.12 : 0.93, chroma, opacity, scale: 128, monochrome: true, placement: "fixed" };
    }
    case "A6-dot-grid": {
      const opacity = round(clampRange(0.13 - fs * 0.03 + e * 0.05, 0.09, 0.2), 4);
      return { hue, lightness: theme === "dark" ? 0.15 : 0.91, chroma: 0.018, scale: 24, spacing: 24, opacity };
    }
    case "A7-line-grid": {
      const opacity = round(clampRange(0.13 - fs * 0.03 + e * 0.05, 0.09, 0.2), 4);
      return { hue, lightness: theme === "dark" ? 0.15 : 0.91, chroma: 0.018, scale: 1, spacing: 32, opacity, contrast: 0.1 };
    }
    case "A11-duotone-image":
      return { hue, hueDelta: 40, contrast: 0.15, lightness: 0.4, chroma: 0.1 };
    case "A12-band-alternation":
      return { hue, hueCount: 2, alternationRate: 0.45, darkBandCount: 1 };
    default:
      return { hue, lightness: theme === "dark" ? 0.13 : 0.93, chroma: 0.03 };
  }
}

// swap groups perturbation may pick within — "treatment swap within a taste-safe set" (task §3).
const FLAT_SWAP_GROUP = ["A1-flat-tinted-neutral", "A2-linear-gradient-tonal", "A5-grain-fixed-overlay"];
const CANVAS_SWAP_GROUP = ["A6-dot-grid", "A7-line-grid"];

function swapGroupFor(treatment) {
  if (FLAT_SWAP_GROUP.includes(treatment)) return FLAT_SWAP_GROUP;
  if (CANVAS_SWAP_GROUP.includes(treatment)) return CANVAS_SWAP_GROUP;
  return null; // A12 (structural) / A11 (asset-bound) — never swapped
}

// ── cross-axis divergence spread (deterministic, no RNG) — apps/engine/divergence.mjs's
// backgroundAxisDistance is what explore.mjs enforces a floor on across the 4 directions; rather
// than rejection-resample the perturbation seed until treatments happen to spread, rotate the base
// (unperturbed) treatment selection through its taste-safe swap group by the caller's direction
// index. `iv.spreadIndex` = this direction's slot index (0-based), `iv.spreadCount` = how many
// directions are being assembled together — both optional; omitted (the historical/non-explore
// call shape) → identical behavior to before this addition, so the no-seed authored-default path
// stays stable. Only ever picks among the SAME group `perturbField`'s swap gate already draws
// from, so this can never push a direction into a less-safe treatment. ────────────────────────────
function applyTreatmentSpread(treatment, iv) {
  if (!Number.isFinite(iv.spreadIndex)) return treatment;
  const group = swapGroupFor(treatment);
  if (!group || group.length < 2) return treatment;
  const base = group.indexOf(treatment);
  const idx = ((base < 0 ? 0 : base) + Math.max(0, Math.trunc(iv.spreadIndex))) % group.length;
  return group[idx];
}

// Swap groups top out at 3 members (FLAT_SWAP_GROUP), so with 4 directions the treatment rotation
// above can't guarantee all 4 land on distinct treatments (pigeonhole) — the two that DO collide
// on treatment still need to read as visually distinct fields, not near-duplicates. Nudge
// lightness/chroma by a small, taste-safe, index-keyed offset (same rotation idea as
// applyTreatmentSpread, just on the continuous params instead of the discrete treatment) BEFORE
// perturbation/gating runs, so gateBackground's existing S12/S13/S14 bounds still have final say —
// this can never push a value out of compliance, only vary where in the compliant range it lands.
// Values are NOT monotonic in index — a swap-group has at most 3 members, so index 0 and index 3
// always collide on the discrete treatment rotation (3 | (3-0)); these arrays put index 3 at an
// extreme so the pairs that lose the treatment signal (0,3) / (1,3) / (2,3) still separate on
// lightness+chroma, while 0/1/2 (which usually differ on treatment or family-driven hue already)
// stay in a more moderate, unmistakably-still-"field" range.
const LIGHTNESS_SPREAD = [0.025, -0.05, 0.055, -0.09];
const CHROMA_SPREAD = [1.0, 1.8, 0.7, 2.6];
function applyParamSpread(params, iv) {
  if (!Number.isFinite(iv.spreadIndex)) return params;
  const idx = Math.max(0, Math.trunc(iv.spreadIndex));
  const p = { ...params };
  if (Number.isFinite(p.lightness)) p.lightness = round(clampRange(p.lightness + LIGHTNESS_SPREAD[idx % LIGHTNESS_SPREAD.length], 0, 1), 4);
  if (Number.isFinite(p.chroma)) p.chroma = round(Math.max(0, p.chroma * CHROMA_SPREAD[idx % CHROMA_SPREAD.length]), 4);
  return p;
}

// ── BACKGROUND_PERTURB_V1 — determinism contract mirroring perturb.mjs's PERTURB_V1: every draw
// below is taken from the mulberry32(streamSeed) stream in this FIXED order, EVERY TIME, even when
// the parameter it feeds doesn't exist on the current treatment or the draw's result is a no-op.
// Append new draws — never insert — so existing streamSeeds stay reproducible. ────────────────────
function perturbField(field, family, iv, rand, amp) {
  const u = () => rand() * 2 - 1;
  const p = { ...field.params };
  let treatment = field.treatment;

  const hueRotateDraw = u();              // 1. hue rotation
  const hueDeltaDraw = u();               // 2. gradient hue-travel jitter
  const chromaDraw = u();                 // 3. chroma jitter
  const lightnessDraw = u();              // 4. lightness jitter
  const opacityDraw = u();                // 5. opacity jitter
  const scaleDraw = u();                  // 6. scale/spacing jitter
  const contrastDraw = u();               // 7. contrast jitter
  const swapGate = rand();                // 8. treatment-swap gate (always drawn)
  const swapPick = rand();                // 9. treatment-swap pick (always drawn)
  const bandAltDraw = u();                // 10. band alternation-rate jitter

  if (Number.isFinite(p.hue)) p.hue = wrapHue(p.hue + hueRotateDraw * 40 * amp);
  if (Number.isFinite(p.hueDelta)) p.hueDelta = round(clampRange(p.hueDelta + hueDeltaDraw * 8 * amp, -30, 30), 2);
  if (Number.isFinite(p.chroma)) p.chroma = round(clampRange(p.chroma * (1 + chromaDraw * 0.25 * amp), 0, 0.4), 4);
  if (Number.isFinite(p.lightness)) p.lightness = round(clampRange(p.lightness + lightnessDraw * 0.05 * amp, 0, 1), 4);
  if (Number.isFinite(p.opacity)) p.opacity = round(clampRange(p.opacity * (1 + opacityDraw * 0.3 * amp), 0, 1), 4);
  if (Number.isFinite(p.scale)) p.scale = round(Math.max(1, p.scale * (1 + scaleDraw * 0.2 * amp)), 2);
  if (Number.isFinite(p.spacing)) p.spacing = round(Math.max(1, p.spacing * (1 + scaleDraw * 0.2 * amp)), 2);
  if (Number.isFinite(p.contrast)) p.contrast = round(clampRange(p.contrast + contrastDraw * 0.06 * amp, 0, 1), 4);
  if (Number.isFinite(p.alternationRate)) p.alternationRate = round(clampRange(p.alternationRate + bandAltDraw * 0.1 * amp, 0, 1), 4);

  const group = swapGroupFor(treatment);
  if (group && swapGate < 0.22 * clamp01(amp, 1)) {
    const others = group.filter((t) => t !== treatment);
    if (others.length) {
      const idx = Math.min(others.length - 1, Math.floor(swapPick * others.length));
      treatment = others[idx];
      // re-derive params for the new treatment, keep the jittered hue for continuity.
      const fresh = baseParams(treatment, iv, p.hue ?? field.params.hue);
      Object.assign(p, fresh, { hue: p.hue ?? fresh.hue });
    }
  }

  return { treatment, category: "field", params: p, meta: BACKGROUND_TREATMENTS[treatment] || {} };
}

// Base (unperturbed, no-RNG) per-slot assignment: glass is never chosen without an explicit
// perturbation roll (S4 posture — glass only "with a documented reason"); accent-style slots get
// a flat signal chip, glow off; everything else inherits the field treatment.
function baseSlots(family, hue) {
  const slots = {};
  for (const name of family.materialSlots || []) {
    if (SIGNAL_SLOT_RE.test(name)) {
      slots[name] = { treatment: "signal-flat", category: "surface", params: { hue, glowEnabled: false }, meta: BACKGROUND_TREATMENTS["signal-flat"] };
    } else {
      slots[name] = { treatment: "field-inherit", category: "surface", params: {}, meta: {} };
    }
  }
  return slots;
}

// per-slot perturbation draws — always 2 draws per slot (glass-gate, glow-gate), in
// family.materialSlots array order (already fixed/deterministic per family).
function perturbSlots(family, iv, hue, rand, amp) {
  const slots = {};
  for (const name of family.materialSlots || []) {
    const glassGate = rand();  // always drawn
    const glowGate = rand();   // always drawn — S5 posture keeps this off by default (see gate)
    void glowGate;
    if (GLASS_ELIGIBLE_SLOT_RE.test(name) && iv.materiality >= 0.66 && iv.craft >= 0.6 && glassGate < 0.28 * amp) {
      slots[name] = {
        treatment: "B5-glass", category: "surface",
        params: { blurPx: round(12 + iv.materiality * 8, 1), fillOpacity: 0.12, innerBorder: true, insetHighlight: true, reducedTransparencyFallback: true },
        meta: BACKGROUND_TREATMENTS["B5-glass"],
      };
    } else if (SIGNAL_SLOT_RE.test(name)) {
      slots[name] = {
        treatment: "signal-flat", category: "surface",
        params: { hue, glowEnabled: false },
        meta: BACKGROUND_TREATMENTS["signal-flat"],
      };
    } else {
      slots[name] = { treatment: "field-inherit", category: "surface", params: {}, meta: {} };
    }
  }
  return slots;
}

// ── §3 gate — clamps params or falls back to a safer treatment; never throws, never leaves a
// candidate out of compliance. Cites the S-row it enforces inline. ─────────────────────────────
function gateBackground(bg, family) {
  const matched = [];
  const field = { ...bg.field, params: { ...bg.field.params } };
  const p = field.params;

  // S2 — mesh/blob (guard: not in any selectable/swap set today, kept for defense-in-depth).
  if (field.treatment === "A4-mesh-blob") {
    matched.push("S2"); field.treatment = "A1-flat-tinted-neutral";
    Object.assign(p, { lightness: 0.955, chroma: 0.012 });
  }
  // S3 — radial glow (guard, same reasoning as S2).
  if (field.treatment === "A3-radial-glow") {
    matched.push("S3"); field.treatment = "A2-linear-gradient-tonal";
    p.chroma = Math.min(Number(p.chroma) || 0.08, 0.1);
  }
  // S9 — repeating stripes (guard).
  if (field.treatment === "A8-repeating-stripes") {
    matched.push("S9"); field.treatment = "A1-flat-tinted-neutral";
    Object.assign(p, { lightness: 0.955, chroma: 0.012 });
  }
  // S10 — decorative grid/dot-grid outside a canvas-capable surface.
  if ((field.treatment === "A6-dot-grid" || field.treatment === "A7-line-grid") && !canvasCapable(family.pageKind)) {
    matched.push("S10"); field.treatment = "A1-flat-tinted-neutral";
    Object.assign(p, { lightness: 0.955, chroma: 0.012 });
  }
  // taste ceilings for the grid/grain treatments even where allowed.
  if ((field.treatment === "A6-dot-grid" || field.treatment === "A7-line-grid") && Number.isFinite(p.opacity) && p.opacity > GRID_OPACITY_MAX) {
    matched.push("S10"); p.opacity = GRID_OPACITY_MAX;
  }
  if (field.treatment === "A5-grain-fixed-overlay") {
    if (Number.isFinite(p.opacity) && p.opacity > GRAIN_OPACITY_MAX) { matched.push("S15"); p.opacity = GRAIN_OPACITY_MAX; }
    if (p.placement !== "fixed") { matched.push("S15"); p.placement = "fixed"; } // never on a scroll container
  }
  // S1 — AI purple/violet -> cyan gradient: high ΔH + high chroma spanning the danger hue pair.
  if (field.treatment === "A2-linear-gradient-tonal" && Number.isFinite(p.hue) && Number.isFinite(p.hueDelta)) {
    const hueB = wrapHue(p.hue + p.hueDelta);
    const inPurple = (h) => h >= PURPLE_LO && h <= PURPLE_HI;
    const inCyan = (h) => h >= CYAN_LO && h <= CYAN_HI;
    const spansDangerPair = (inPurple(p.hue) && inCyan(hueB)) || (inCyan(p.hue) && inPurple(hueB));
    if (spansDangerPair && Math.abs(p.hueDelta) > HUE_TRAVEL_DANGER && (Number(p.chroma) || 0) > CHROMA_DANGER) {
      matched.push("S1");
      p.hue = wrapHue(p.hue + 90); // rotate the whole gradient out of the danger band
      p.chroma = Math.min(Number(p.chroma) || 0.08, 0.1);
      p.hueDelta = clampRange(p.hueDelta, -HUE_TRAVEL_DANGER, HUE_TRAVEL_DANGER);
    }
  }
  // S12 — pure #000/#fff: never let lightness sit at the extremes or chroma go untinted.
  if (Number.isFinite(p.lightness)) {
    const beforeL = p.lightness;
    p.lightness = clampRange(p.lightness, OFFBLACK_MIN_L, OFFWHITE_MAX_L);
    if (p.lightness !== beforeL) matched.push("S12");
  }
  if (Number.isFinite(p.chroma) && p.chroma < MIN_TINT_CHROMA) {
    matched.push("S12"); p.chroma = MIN_TINT_CHROMA;
  }
  // S13 — cream/beige "tasteful" default: warm-cream hue + very light + near-untinted.
  if (field.treatment.startsWith("A1") && Number.isFinite(p.hue) && Number.isFinite(p.lightness) && Number.isFinite(p.chroma)) {
    if (p.hue >= CREAM_HUE_LO && p.hue <= CREAM_HUE_HI && p.lightness > CREAM_LIGHTNESS_MIN && p.chroma < CREAM_CHROMA_MAX) {
      matched.push("S13");
      p.hue = wrapHue(p.hue + 140); // rotate away from the category default (§2 principle 12)
    }
  }
  // S14 — over-saturated fill: chroma proxy for saturation >= 80%.
  if (Number.isFinite(p.chroma) && p.chroma >= SAT_CAP) {
    matched.push("S14"); p.chroma = SAT_CLAMP;
  }
  // S16 — section-invert theme break: banding so violent it reads as a different site.
  let band = null;
  if (field.treatment === "A12-band-alternation") {
    const rate = Number.isFinite(p.alternationRate) ? p.alternationRate : 0.45;
    if (rate > BAND_ALTERNATION_MAX) { matched.push("S16"); p.alternationRate = 0.6; }
    else p.alternationRate = rate;
    band = { hueCount: Math.min(p.hueCount ?? 2, 2), alternationRate: p.alternationRate, darkBandCount: p.darkBandCount ?? 1 };
  }

  // S4 — glassmorphism-everywhere: only allow B5-glass on slots plausibly solving real layering;
  // clamp its fill opacity regardless. S5 — colored glow on dark: force off by default (posture).
  const slots = {};
  for (const [name, slot] of Object.entries(bg.slots)) {
    let s = { ...slot, params: { ...slot.params } };
    if (s.treatment === "B5-glass") {
      if (!GLASS_ELIGIBLE_SLOT_RE.test(name)) {
        matched.push("S4");
        s = { treatment: "field-inherit", category: "surface", params: {}, meta: {} };
      } else if (Number.isFinite(s.params.fillOpacity) && s.params.fillOpacity > GLASS_FILL_OPACITY_MAX) {
        matched.push("S4"); s.params.fillOpacity = GLASS_FILL_OPACITY_MAX;
      }
    }
    if (s.treatment === "signal-flat" && s.params.glowEnabled) {
      matched.push("S5"); s.params.glowEnabled = false;
    }
    slots[name] = s;
  }

  // S11 — gradient text: never emitted by this axis (posture: off by default).
  const crossCutting = { gradientText: false, animated: { enabled: false, motionType: null, easing: null, respectsReducedMotion: true } };

  return {
    field: { ...field, meta: BACKGROUND_TREATMENTS[field.treatment] || {} },
    band,
    slots,
    crossCutting,
    matched: [...new Set(matched)],
  };
}

/**
 * deriveBackground(family, iv, streamSeed) → BackgroundGenome
 *
 * `family`: a LAYOUT_FAMILIES entry (reads .pageKind, .materialSlots, .sectionGrammar, .name).
 * `iv`: {materiality, energy, layoutVariance, contentDensity, contrastPreference, craft, formality}
 *   (0..1 dials, same bag every other axis uses — `formality` is optional, defaults to 0.5, and
 *   only feeds functionalScore below) plus optional `theme` ("light"/"dark") and `hue` (0-360 — an
 *   already-resolved accent hue to anchor the field on; falls back to a deterministic per-family
 *   hash hue when omitted).
 * `streamSeed`: null/undefined → stable authored defaults, zero RNG draws. A number → run through
 *   BACKGROUND_PERTURB_V1, then gate.
 */
export function deriveBackground(family, iv = {}, streamSeed = null) {
  const ivn = {
    materiality: clamp01(iv.materiality),
    energy: clamp01(iv.energy),
    layoutVariance: clamp01(iv.layoutVariance),
    contentDensity: clamp01(iv.contentDensity),
    contrastPreference: clamp01(iv.contrastPreference),
    craft: clamp01(iv.craft),
    formality: clamp01(iv.formality),
    theme: iv.theme === "dark" ? "dark" : "light",
    spreadIndex: Number.isFinite(Number(iv.spreadIndex)) ? Number(iv.spreadIndex) : undefined,
  };
  ivn.functionalScore = functionalScoreOf(ivn);
  const hue = Number.isFinite(Number(iv.hue)) ? wrapHue(Number(iv.hue)) : defaultHue(family);

  const treatment = applyTreatmentSpread(selectFieldTreatment(family, ivn), ivn);
  const field = { treatment, category: "field", params: applyParamSpread(baseParams(treatment, ivn, hue), ivn), meta: BACKGROUND_TREATMENTS[treatment] || {} };
  let bg = {
    field, slots: baseSlots(family, hue), band: null,
    crossCutting: { gradientText: false, animated: { enabled: false, motionType: null, easing: null, respectsReducedMotion: true } },
  };

  if (streamSeed != null && Number.isFinite(Number(streamSeed))) {
    const rand = mulberry32(Number(streamSeed) >>> 0);
    const amp = 0.35 + 0.65 * ivn.layoutVariance; // mirrors composeGenome's layout amplitude formula
    const perturbedField = perturbField(field, family, ivn, rand, amp);
    const perturbedSlots = perturbSlots(family, ivn, hue, rand, amp);
    bg = { field: perturbedField, slots: perturbedSlots, band: null, crossCutting: bg.crossCutting };
  }

  const gated = gateBackground(bg, family);
  return {
    field: gated.field,
    band: gated.band,
    slots: gated.slots,
    crossCutting: gated.crossCutting,
    slop: { score: gated.matched.length, matchedRules: gated.matched },
    provenance: ["taxonomy-v1", streamSeed != null ? "perturbed" : "authored-default"],
  };
}

/**
 * checkBackgroundViolations(bg, family) → string[] of S-row ids still out of compliance.
 * Independent re-check (mirrors perturb.mjs's validatePerturbed being separate from
 * perturbGenome) — used by tests to verify the gate actually leaves nothing out of bounds, not
 * just that it ran.
 */
export function checkBackgroundViolations(bg, family) {
  const v = [];
  const p = bg.field.params || {};
  if (Number.isFinite(p.lightness) && (p.lightness < OFFBLACK_MIN_L - 1e-9 || p.lightness > OFFWHITE_MAX_L + 1e-9)) v.push("S12");
  if (Number.isFinite(p.chroma) && p.chroma < MIN_TINT_CHROMA - 1e-9) v.push("S12");
  if (Number.isFinite(p.chroma) && p.chroma >= SAT_CAP + 1e-9) v.push("S14");
  if (bg.field.treatment.startsWith("A1") && Number.isFinite(p.hue) && Number.isFinite(p.lightness) && Number.isFinite(p.chroma)) {
    if (p.hue >= CREAM_HUE_LO && p.hue <= CREAM_HUE_HI && p.lightness > CREAM_LIGHTNESS_MIN && p.chroma < CREAM_CHROMA_MAX) v.push("S13");
  }
  if (bg.field.treatment === "A2-linear-gradient-tonal" && Number.isFinite(p.hue) && Number.isFinite(p.hueDelta)) {
    const hueB = wrapHue(p.hue + p.hueDelta);
    const inPurple = (h) => h >= PURPLE_LO && h <= PURPLE_HI;
    const inCyan = (h) => h >= CYAN_LO && h <= CYAN_HI;
    const spans = (inPurple(p.hue) && inCyan(hueB)) || (inCyan(p.hue) && inPurple(hueB));
    if (spans && Math.abs(p.hueDelta) > HUE_TRAVEL_DANGER && (Number(p.chroma) || 0) > CHROMA_DANGER) v.push("S1");
  }
  if (bg.field.treatment === "A4-mesh-blob") v.push("S2");
  if (bg.field.treatment === "A3-radial-glow") v.push("S3");
  if (bg.field.treatment === "A8-repeating-stripes") v.push("S9");
  if ((bg.field.treatment === "A6-dot-grid" || bg.field.treatment === "A7-line-grid")) {
    if (!canvasCapable(family.pageKind)) v.push("S10");
    if (Number.isFinite(p.opacity) && p.opacity > GRID_OPACITY_MAX + 1e-9) v.push("S10");
  }
  if (bg.field.treatment === "A5-grain-fixed-overlay") {
    if (Number.isFinite(p.opacity) && p.opacity > GRAIN_OPACITY_MAX + 1e-9) v.push("S15");
    if (p.placement !== "fixed") v.push("S15");
  }
  if (bg.field.treatment === "A12-band-alternation" && bg.band && bg.band.alternationRate > BAND_ALTERNATION_MAX + 1e-9) v.push("S16");
  if (bg.crossCutting?.gradientText) v.push("S11");
  for (const [name, slot] of Object.entries(bg.slots || {})) {
    if (slot.treatment === "B5-glass") {
      if (!GLASS_ELIGIBLE_SLOT_RE.test(name)) v.push("S4");
      if (Number.isFinite(slot.params.fillOpacity) && slot.params.fillOpacity > GLASS_FILL_OPACITY_MAX + 1e-9) v.push("S4");
    }
    if (slot.treatment === "signal-flat" && slot.params.glowEnabled) v.push("S5");
  }
  return [...new Set(v)];
}
