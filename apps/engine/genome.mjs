// apps/engine/genome.mjs — Subsystem 2: the StyleGenome resolver.
//
// The connective tissue: given a StyleIntent (+ seed + diversity memory), it resolves
// ONE coherent direction across type, color, layout, material and motion, each decision
// carrying provenance, plus a fingerprint that bounds variation on re-rolls.
//
// Pure/deterministic: no Math.random, no Date.now. The color/font/material generators
// come from the injected engine instance (createEngine), so this shares the same data.

import { resolveIntent, clamp01, hashToUint32, deriveBaseHue } from "./intent.mjs";
import { suggestLayout, LAYOUT_FAMILIES } from "./layout-families.mjs";
import { canonicalRole } from "./role-aliases.mjs";
import { deriveBackground } from "./background.mjs";
import { deriveMotion } from "./motion.mjs";

const FAMILY_BY_NAME = new Map(LAYOUT_FAMILIES.map((f) => [f.name, f]));

const band = (v) => (v < 0.34 ? "muted" : v < 0.67 ? "balanced" : "bold");

// FNV-1a-ish hash of the section role order — part of the fingerprint.
function hashSections(sectionGrammar = []) {
  const s = sectionGrammar.map((x) => x.role).join(">");
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

function materialFromDial(m) {
  return {
    radiusLanguage: m < 0.33 ? "tight-square" : m < 0.66 ? "controlled-mixed" : "soft-rounded",
    shadowLanguage: m < 0.33 ? "flat-or-hairline" : m < 0.66 ? "soft-low-elevation" : "layered-elevation",
    borderLanguage: m < 0.5 ? "selective-structural" : "minimal",
    surfaceTreatment: m > 0.66 ? "subtle-texture" : "none",
    accentTreatment: "one-primary-plus-signal",
  };
}

function motionFromDial(mi) {
  const families = mi < 0.25 ? ["fade"] : mi < 0.6 ? ["fade", "slide"] : ["fade", "slide", "scale"];
  return { intensity: mi, families, reducedMotion: "required" };
}

/**
 * styleGenome(engine, intentInput, { seed?, recentFingerprints?, layout? }) → StyleGenome
 * Deterministic: same (intent, seed) → identical genome. Different recentFingerprints
 * → divergence in composition (layout family / font pair / accent), not just hue.
 *
 * `layout` (spec §4 explore wiring): an already-composed/perturbed LayoutGenome candidate
 * (as produced by `suggestLayout`/`perturbAndValidate` in explore.mjs). When present, this
 * skips the internal `suggestLayout` call entirely and uses the given layout verbatim — the
 * caller (exploreDirections) owns family selection + perturbation for that direction. When
 * `layout` is absent (the historical call shape), behavior is EXACTLY unchanged: internal
 * `suggestLayout(intent, { recentFingerprints })` picks the top candidate, as before.
 */
export function styleGenome(engine, intentInput = {}, { seed, recentFingerprints = [], layout: layoutOverride = null } = {}) {
  const resolved = resolveIntent(intentInput);
  const intent = resolved.intent;
  const useSeed = Number.isFinite(Number(seed)) ? Number(seed) : resolved.seed;

  // Shared personality axes every layer reads (derived from the dials).
  const axes = {
    "quiet-loud": clamp01((intent.energy + intent.experimentalism) / 2),
    "technical-organic": clamp01(1 - intent.warmth),
    "classic-futurist": clamp01(intent.experimentalism * 0.6 + (1 - intent.era) * 0.4),
    "warm-clinical": clamp01(1 - intent.warmth),
    "dense-breathing": clamp01(1 - intent.contentDensity),
  };

  // Diversity memory → exclusions. Fingerprints may carry fontPair (families) + layoutFamily.
  const recentFamilies = recentFingerprints.flatMap((fp) => (fp && fp.fontPair) || []);

  // ---- type (neighbor retrieval + readability gate, surface-fit envelope conditioned on intent) ----
  let display = engine.retrieveFonts({ role: "display", intent, exclude: recentFamilies, n: 4 })[0] || null;
  let body = engine.retrieveFonts({
    role: "body", intent, n: 4,
    exclude: [...(display ? [display.family] : []), ...recentFamilies],
  })[0] || null;
  // checkTypeFit — belt-and-suspenders re-check (retrieveFonts already filters by the same
  // envelope, so this only fires via a path that bypassed it, e.g. the neighbor-seeded `like`
  // pool); on a violation, swap in the nearest legible candidate for the offending role(s).
  const typeFit = engine.checkTypeFit
    ? engine.checkTypeFit({ display: display && display.family, body: body && body.family }, intent)
    : { pass: true };
  if (typeFit && !typeFit.pass) {
    if (typeFit.violations.some((v) => v.role === "display")) {
      display = engine.retrieveFonts({
        role: "display", intent, n: 4,
        exclude: [...recentFamilies, ...(display ? [display.family] : [])],
      })[0] || display;
    }
    if (typeFit.violations.some((v) => v.role === "body")) {
      body = engine.retrieveFonts({
        role: "body", intent, n: 4,
        exclude: [...recentFamilies, ...(body ? [body.family] : []), ...(display ? [display.family] : [])],
      })[0] || body;
    }
  }

  // ---- color (existing OKLCH corpus engine), grounded by energy + intent-derived hue (warmth/
  // era/energy/surface — design-law.md "Palette = intent, not seed") + theme, reproducible by seed.
  // An explicit intentInput.hue (raw, pre-normalization — hue isn't a StyleIntent dial) still wins.
  const explicitHue = Number.isFinite(Number(intentInput.hue))
    ? (((Number(intentInput.hue) % 360) + 360) % 360)
    : null;
  const baseHue = explicitHue != null ? explicitHue : deriveBaseHue(intent);
  let palette = engine.generatePalette({ energy: band(intent.energy), seed: useSeed, hue: baseHue });
  // checkColorFit — belt-and-suspenders re-check against the design-law.md indigo/violet/
  // fintech-blue + cyan/mint hard bans; generatePalette's own gate already refuses to emit either
  // band, so this only fires if a caller-anchored accent slipped through some other path.
  const colorFit = engine.checkColorFit ? engine.checkColorFit(palette.accent, intent) : { pass: true };
  if (colorFit && !colorFit.pass && colorFit.fallback) {
    palette = { ...palette, accent: colorFit.fallback.hex, hue: colorFit.fallback.hue };
  }

  // ---- layout ----
  const layouts = layoutOverride ? null : suggestLayout(intent, { recentFingerprints });
  const layout = layoutOverride || (layouts ? layouts[0] || null : null);

  // ---- material (slots attached to the layout's hierarchy nodes, never sprayed) ----
  const m = intent.materiality;
  const matLang = materialFromDial(m);
  const family = layout ? FAMILY_BY_NAME.get(layout.family) : null;
  const material = {
    ...matLang,
    radii: engine.radiusScale({ base: Math.round(4 + m * 12) }),
    shadow: engine.shadow(Math.round(m * 8), { hue: 0, alpha: 0.12 + m * 0.1 }),
    slots: family ? family.materialSlots : [],   // hierarchy nodes that receive material — never every box
  };

  // ---- background (docs/background-material-taxonomy.md — the field/surface treatment axis,
  // filling `family.materialSlots` alongside `material` above) ----
  const background = family
    ? deriveBackground(family, {
        materiality: intent.materiality, energy: intent.energy, layoutVariance: intent.layoutVariance,
        contentDensity: intent.contentDensity, contrastPreference: intent.contrastPreference, craft: intent.craft,
        formality: intent.formality, theme: intent.theme, hue: palette.hue,
      }, hashToUint32(`${useSeed}:background:${family.name}`))
    : null;

  // ---- motion (docs/motion-interaction-taxonomy.md — the scroll/reveal/micro-interaction axis;
  // `design` carries the full taxonomy-derived MotionGenome next to the legacy families/intensity
  // dial fingerprint.mjs's motionFamily already reads, so existing consumers of `motion.families`
  // are unaffected) ----
  const motionDesign = family
    ? deriveMotion(family, {
        materiality: intent.materiality, energy: intent.energy, layoutVariance: intent.layoutVariance,
        contentDensity: intent.contentDensity, contrastPreference: intent.contrastPreference, craft: intent.craft,
        theme: intent.theme, hue: palette.hue,
      }, hashToUint32(`${useSeed}:motion:${family.name}`))
    : null;
  const motion = { ...motionFromDial(intent.motionIntensity), tokens: engine.motionTokens(), design: motionDesign };

  // §3 extension (ADDITIVE — penaltyFor/sectionOrderHash above stay on RAW roles; canonicalOrder
  // here is used ONLY by the §3 distance math in fingerprint.mjs, per spec trap 7).
  const canonicalOrder = layout ? layout.sectionGrammar.map((s) => canonicalRole(s.role)) : [];
  const darkBands = layout
    ? layout.sectionGrammar.map((s) => (s.surface === "inverted" ? "1" : "0")).join("")
    : "";

  const fingerprint = {
    fontPair: [display && display.family, body && body.family].filter(Boolean),
    paletteHue: Math.round(palette.hue || 0),
    layoutFamily: layout ? layout.family : null,
    sectionOrderHash: layout ? hashSections(layout.sectionGrammar) : null,
    splitRatioBucket: layout && layout.macro ? Math.round((layout.macro.splitRatio || 0) * 10) : null,
    radiusLanguage: matLang.radiusLanguage,
    shadowLanguage: matLang.shadowLanguage,
    accentStrategy: matLang.accentTreatment,
    motionFamily: motion.families[motion.families.length - 1],
    // ── additive §3 fields ──
    canonicalOrder,
    splitRatio: layout && layout.macro ? layout.macro.splitRatio : null,
    whitespace: layout && layout.macro ? layout.macro.whitespace : null,
    contentWidthShare: layout && layout.macro ? layout.macro.contentWidthShare : null,
    columnCount: layout && layout.macro ? layout.macro.columnCount : null,
    headingScaleRatio: layout && layout.hierarchy ? layout.hierarchy.headingScaleRatio : null,
    darkBands,
  };

  return {
    sourceIntent: intent,
    sourceBrief: intent.sourceBrief,
    seed: useSeed,
    variation: intent.variation,
    warnings: resolved.warnings,
    personality: { axes },
    type: {
      display, body,
      note: "display carries identity; body carries running text — never swap them.",
    },
    color: { ...palette, source: "corpus-plus-oklch" },
    layout,
    layoutAlternatives: layouts ? layouts.slice(1, 3) : [],
    material,
    background,
    motion,
    responsive: { collapseRules: layout && layout.responsive ? [layout.responsive.mobileTransform] : [] },
    fingerprint,
    provenance: {
      type: display && display.provenance ? display.provenance : "catalogue-fallback",
      color: "OKLCH corpus engine (checkColor-gated)",
      layout: layout && layout.quality ? layout.quality.provenance : ["hand-authored"],
      material: "materiality dial → radius/shadow scales",
      background: background ? background.provenance : [],
      motion: motionDesign ? motionDesign.provenance : [],
    },
  };
}
