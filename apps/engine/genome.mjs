// apps/engine/genome.mjs — Subsystem 2: the StyleGenome resolver.
//
// The connective tissue: given a StyleIntent (+ seed + diversity memory), it resolves
// ONE coherent direction across type, color, layout, material and motion, each decision
// carrying provenance, plus a fingerprint that bounds variation on re-rolls.
//
// Pure/deterministic: no Math.random, no Date.now. The color/font/material generators
// come from the injected engine instance (createEngine), so this shares the same data.

import { resolveIntent, clamp01 } from "./intent.mjs";
import { suggestLayout, LAYOUT_FAMILIES } from "./layout-families.mjs";

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
 * styleGenome(engine, intentInput, { seed?, recentFingerprints? }) → StyleGenome
 * Deterministic: same (intent, seed) → identical genome. Different recentFingerprints
 * → divergence in composition (layout family / font pair / accent), not just hue.
 */
export function styleGenome(engine, intentInput = {}, { seed, recentFingerprints = [] } = {}) {
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

  // ---- type (neighbor retrieval + readability gate) ----
  const display = engine.retrieveFonts({ role: "display", intent, exclude: recentFamilies, n: 4 })[0] || null;
  const body = engine.retrieveFonts({
    role: "body", intent, n: 4,
    exclude: [...(display ? [display.family] : []), ...recentFamilies],
  })[0] || null;

  // ---- color (existing OKLCH corpus engine), grounded by energy + theme, reproducible by seed ----
  const palette = engine.generatePalette({ energy: band(intent.energy), seed: useSeed });

  // ---- layout ----
  const layouts = suggestLayout(intent, { recentFingerprints });
  const layout = layouts[0] || null;

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

  // ---- motion ----
  const motion = { ...motionFromDial(intent.motionIntensity), tokens: engine.motionTokens() };

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
    layoutAlternatives: layouts.slice(1, 3),
    material,
    motion,
    responsive: { collapseRules: layout && layout.responsive ? [layout.responsive.mobileTransform] : [] },
    fingerprint,
    provenance: {
      type: display && display.provenance ? display.provenance : "catalogue-fallback",
      color: "OKLCH corpus engine (checkColor-gated)",
      layout: layout && layout.quality ? layout.quality.provenance : ["hand-authored"],
      material: "materiality dial → radius/shadow scales",
    },
  };
}
