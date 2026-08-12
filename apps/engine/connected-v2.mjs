// Connected v2 enrichment layer.
//
// This module consumes the empirical v2 catalogues without changing the frozen
// intent/genome/layout/worker interfaces. It intentionally returns interpretable
// records, not embeddings: the agent can see why a font, material, component
// dialect, or expression treatment was chosen and can implement it faithfully.

import fontSpaceV2 from "../../data/research/master-v2/font-space.v2.json" with { type: "json" };
import componentPersonalityV1 from "../../data/research/master-v2/component-personality.v1.json" with { type: "json" };
import expressionTreatmentsV1 from "../../data/research/master-v2/expression-treatments.v1.json" with { type: "json" };
import expressionCompatibilityV1 from "../../data/research/master-v2/expression-compatibility.v1.json" with { type: "json" };
import colorSceneSpaceV2 from "../../data/research/master-v2/color-scene-space.v2.json" with { type: "json" };
import materialTextureSpaceV2 from "../../data/research/master-v2/material-texture-space.v2.json" with { type: "json" };
import runtimePairJudgments from "./font-pair-judgments.v2.json" with { type: "json" };
import fontRuntimeV1 from "./data/font-runtime.v1.json" with { type: "json" };
import { hashToUint32 } from "./intent.mjs";

const FONT_BY_FAMILY = new Map((fontSpaceV2.entries || []).map((entry) => [String(entry.family).toLowerCase(), entry]));
const FONT_RUNTIME_BY_FAMILY = new Map((fontRuntimeV1.entries || []).map((entry) => [String(entry.family).toLowerCase(), entry]));
const PAIR_BY_FAMILY = new Map((runtimePairJudgments.pairs || []).map((pair) => [
  `${String(pair.display).toLowerCase()}|${String(pair.body).toLowerCase()}`,
  pair,
]));
const TREATMENT_BY_ID = new Map((expressionTreatmentsV1.treatments || []).map((treatment) => [treatment.id, treatment]));
const COMPONENT_DIALECTS = new Set(componentPersonalityV1.dialects || []);
const TEXTURE_DIALECTS = new Set(materialTextureSpaceV2.dialects || []);

const clamp01 = (value, fallback = 0.5) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
};

const familyKey = (font) => String(font?.family || "").trim().toLowerCase();
const runtimeAsset = (font) => {
  const entry = FONT_RUNTIME_BY_FAMILY.get(familyKey(font));
  const family = entry?.family || font?.family || "";
  const localFormats = entry?.localFormats || entry?.formats || { ttf: null, woff2: [] };
  const publicFormats = entry?.publicFormats || { ttf: null, woff2: [] };
  const facesFor = (formats) => (formats.woff2 || []).length
    ? formats.woff2.map((path) => {
      const weight = Number(String(path).match(/-(400|500|600|700)\.woff2$/)?.[1] || 400);
      return `@font-face { font-family: "${family}"; src: url("${path}") format("woff2"); font-weight: ${weight}; font-style: normal; font-display: swap; }`;
    })
    : (formats.ttf ? [`@font-face { font-family: "${family}"; src: url("${formats.ttf}") format("truetype"); font-weight: 400; font-style: normal; font-display: swap; }`] : []);
  const localFaces = facesFor(localFormats);
  const faces = facesFor(publicFormats);
  const repositoryAvailable = !!entry?.assetAvailable && localFaces.length > 0;
  const remotelyLoadable = !!entry?.remoteAssetAvailable && faces.length > 0;
  return {
    available: repositoryAvailable,
    repositoryAvailable,
    remotelyLoadable,
    id: entry?.id || font?.id || null,
    localFormats,
    publicFormats,
    recommendedWeights: entry?.recommendedWeights || [],
    loadSpec: {
      status: remotelyLoadable ? "bind-before-use" : (repositoryAvailable ? "repository-local-only" : "unavailable"),
      family,
      faces,
      localFaces,
      localBase: repositoryAvailable ? "repository-root" : null,
    },
    source: entry ? "font-runtime.v1" : "font-runtime-missing",
  };
};

const sourceSummary = Object.freeze({
  fontSpace: fontSpaceV2.schemaVersion,
  fontRuntime: fontRuntimeV1.schemaVersion,
  componentPersonality: componentPersonalityV1.schemaVersion,
  expressionTreatments: expressionTreatmentsV1.schemaVersion,
  expressionCompatibility: expressionCompatibilityV1.schemaVersion,
  colorScene: colorSceneSpaceV2.schemaVersion,
  materialTexture: materialTextureSpaceV2.schemaVersion,
  humanValidation: "pending",
});

export const CONNECTED_V2_STATUS = Object.freeze({
  schemaVersion: "connected-style-v2",
  sources: sourceSummary,
  fontEntries: Array.isArray(fontSpaceV2.entries) ? fontSpaceV2.entries.length : 0,
  fontAssets: Array.isArray(fontRuntimeV1.entries) ? fontRuntimeV1.entries.filter((entry) => entry.assetAvailable).length : 0,
  candidatePairRecords: Array.isArray(runtimePairJudgments.pairs) ? runtimePairJudgments.pairs.length : 0,
  componentDialects: [...COMPONENT_DIALECTS],
  expressionTreatments: (expressionTreatmentsV1.treatments || []).map((treatment) => treatment.id),
  textureDialects: [...TEXTURE_DIALECTS],
  interactionStates: componentPersonalityV1.interactionStatesRequired || [],
});

export function fontSpaceEvidence(font) {
  const entry = FONT_BY_FAMILY.get(familyKey(font));
  if (!entry) {
    return {
      available: false,
      schemaVersion: fontSpaceV2.schemaVersion,
      humanValidation: fontSpaceV2.humanPairingValidation || "pending",
    };
  }
  const usage = entry.spaceV2?.usageEvidence || {};
  return {
    available: true,
    id: entry.id,
    family: entry.family,
    category: entry.category,
    quality: entry.quality,
    metrics: entry.metrics,
    personality: entry.personality,
    popularityRank: entry.popularityRank,
    asset: runtimeAsset(entry),
    visualEmbedding: !!entry.spaceV2?.visualEmbedding,
    neighborCount: entry.spaceV2?.neighborCount || 0,
    usage: {
      total: usage.total || 0,
      roles: usage.roles || {},
    },
    pairingEvidence: entry.spaceV2?.pairingEvidence || "pending-human-judgment",
    humanValidation: fontSpaceV2.humanPairingValidation || "pending",
  };
}

// Exploration should retain the whole font latent space. A one-shot page needs
// a stronger gate than "the file exists", though: very low-quality, unobserved
// faces are still useful research candidates but are not safe default typography.
// This is evidence-based rather than a family allow-list, so new faces can enter
// automatically when their measured quality clears the floor.
const SHIP_QUALITY_FLOOR = Object.freeze({ display: 0.74, body: 0.72, accent: 0.72 });

export function shipworthyFont(font, role = "display") {
  const evidence = fontSpaceEvidence(font);
  const quality = Number(evidence.quality);
  const floor = SHIP_QUALITY_FLOOR[role] ?? SHIP_QUALITY_FLOOR.display;
  if (evidence.asset?.available !== true || !Number.isFinite(quality) || quality < floor) return false;
  if (role === "body" && !["serif", "sans-serif", "monospace"].includes(evidence.category)) return false;
  return true;
}

export function fontPairEvidence(display, body) {
  const key = `${familyKey(display)}|${familyKey(body)}`;
  const record = PAIR_BY_FAMILY.get(key) || null;
  return {
    status: record ? "candidate-evidence" : "no-record",
    humanValidation: runtimePairJudgments.humanValidation || "pending",
    record: record ? { ...record } : null,
    source: runtimePairJudgments.source,
  };
}

function usageScore(font) {
  const usage = FONT_BY_FAMILY.get(familyKey(font))?.spaceV2?.usageEvidence;
  if (!usage) return 0;
  const roles = usage.roles || {};
  return Math.min(1, ((roles.heading || 0) * 1.2 + (roles.cta || 0) * 0.8 + (roles.label || 0) * 0.25) / 30);
}

function genreOf(engine, font) {
  return engine.classifyFontGenre?.(font) || font?.category || "unknown";
}

function profileFamily(profileId, intent = {}) {
  if (profileId) return profileId;
  if (["dashboard", "app", "docs"].includes(intent.surface)) return "technical-observability";
  if (intent.surface === "pricing") return "neutral-corporate";
  return "editorial-archive";
}

const ACCENT_GENRE_PREFERENCE = {
  "music-nightlife": ["display-other", "script", "ornate-serif", "slab", "mono", "serif", "sans"],
  "earth-craft": ["ornate-serif", "serif", "display-other", "script", "slab", "sans"],
  "climate-civic": ["serif", "ornate-serif", "slab", "sans", "display-other"],
  "technical-observability": ["mono", "slab", "sans", "serif"],
  "editorial-archive": ["ornate-serif", "serif", "display-other", "script", "slab", "sans"],
  "neutral-corporate": ["sans", "slab", "serif"],
  "friendly-consumer": ["display-other", "sans", "slab", "serif"],
};

const ACCENT_FORBIDDEN = /wavefont|redacted|icon|symbol|emoji|dingbat|notdef|wingdings|object-fit|system-ui/i;

function accentEligible(intent, profileId) {
  if (intent.accentMode === "none") return false;
  if (["docs", "dashboard", "app"].includes(intent.surface)) return false;
  if (intent.accentMode === "always") return true;
  if (profileId === "neutral-corporate" || profileId === "technical-observability") {
    return clamp01(intent.experimentalism, 0.2) > 0.62 && clamp01(intent.energy, 0.5) > 0.68;
  }
  return clamp01(intent.experimentalism, 0.5) >= 0.42 || ["music-nightlife", "editorial-archive", "earth-craft"].includes(profileId);
}

function accentScore(engine, candidate, body, profileId, seed) {
  const genre = genreOf(engine, candidate);
  const preferences = ACCENT_GENRE_PREFERENCE[profileId] || ACCENT_GENRE_PREFERENCE["editorial-archive"];
  const rank = preferences.indexOf(genre);
  const pair = fontPairEvidence(candidate, body);
  const evidenceBonus = pair.record ? 0.75 : 0;
  const usageBonus = usageScore(candidate) * 0.8;
  const qualityBonus = clamp01(FONT_BY_FAMILY.get(familyKey(candidate))?.quality, 0.5) * 0.35;
  const noveltyBonus = Math.min(0.25, Math.max(0, Number(candidate?.overusePenalty) || 0) * -0.1 + 0.12);
  const rankScore = rank < 0 ? 0.05 : (preferences.length - rank) / preferences.length;
  const tie = (hashToUint32(`${seed}:accent:${candidate.family}`) / 0xffffffff) * 0.08;
  return rankScore + evidenceBonus + usageBonus + qualityBonus + noveltyBonus + tie;
}

export function selectAccentFont(engine, genome, intent, { seed = 0, profileId = null, exclude = [] } = {}) {
  const profile = profileFamily(profileId, intent);
  if (!accentEligible(intent, profile)) {
    return {
      enabled: false,
      role: "accent",
      font: null,
      reason: "accent face withheld for readability or utility-first surfaces",
      source: fontSpaceV2.schemaVersion,
    };
  }
  const displayFamily = familyKey(genome?.type?.display);
  const bodyFamily = familyKey(genome?.type?.body);
  const layoutAir = Number.isFinite(Number(genome?.layout?.macro?.whitespace))
    ? Number(genome.layout.macro.whitespace)
    : undefined;
  const candidates = engine.retrieveFonts({
    role: "display",
    intent,
    n: 32,
    layoutAir,
    exclude: [...exclude, displayFamily, bodyFamily].filter(Boolean),
  }).filter((candidate) => {
    const name = String(candidate?.family || "");
    const genre = genreOf(engine, candidate);
    return candidate && shipworthyFont(candidate, "accent") && !ACCENT_FORBIDDEN.test(name) && !["blackletter"].includes(genre) && familyKey(candidate) !== bodyFamily;
  });
  const scored = candidates.map((candidate) => ({ candidate, score: accentScore(engine, candidate, genome?.type?.body, profile, seed) }));
  scored.sort((a, b) => b.score - a.score || String(a.candidate.family).localeCompare(String(b.candidate.family)));
  const chosen = scored[0]?.candidate || null;
  if (!chosen) {
    return {
      enabled: false,
      role: "accent",
      font: null,
      reason: "no eligible accent face survived the retrieval gates",
      source: fontSpaceV2.schemaVersion,
    };
  }
  const evidence = fontSpaceEvidence(chosen);
  return {
    enabled: true,
    role: "accent",
    font: chosen,
    use: "short display accents, labels, pull quotes, or one highlighted word; never paragraphs",
    score: +scored[0].score.toFixed(3),
    genre: genreOf(engine, chosen),
    evidence,
    pairEvidenceWithBody: fontPairEvidence(chosen, genome?.type?.body),
    source: fontSpaceV2.schemaVersion,
    humanValidation: "pending",
  };
}

function oklchFor(engine, hex) {
  try {
    const result = engine.classify(hex);
    return result?.oklch || null;
  } catch {
    return null;
  }
}

function temperatureForHue(hue) {
  if (!Number.isFinite(Number(hue))) return "neutral";
  const h = ((Number(hue) % 360) + 360) % 360;
  if (h >= 28 && h <= 72) return "warm";
  if (h >= 150 && h <= 270) return "cool";
  return "mixed";
}

export function deriveColorScene(engine, genome, intent, textureRef = "none-observed") {
  const ground = oklchFor(engine, genome?.color?.ground);
  const accent = oklchFor(engine, genome?.color?.accent);
  const contrast = engine.checkPalette?.(genome?.color?.ground, genome?.color?.ink, genome?.color?.accent, genome?.color?.accent2)?.contrast ?? null;
  return {
    schemaVersion: colorSceneSpaceV2.schemaVersion,
    source: colorSceneSpaceV2.source,
    axes: {
      temperature: temperatureForHue(genome?.color?.hue),
      lightness: genome?.color?.mood === "dark" ? "dark" : "light",
      chroma: accent?.C == null ? "unknown" : accent.C < 0.08 ? "quiet" : accent.C < 0.18 ? "moderate" : "committed",
      contrast: contrast == null ? "unknown" : contrast >= 7 ? "high" : contrast >= 4.5 ? "AA" : "low",
      accentRatio: +Math.max(0.03, Math.min(0.25, 0.05 + clamp01(intent.experimentalism, 0.5) * 0.12)).toFixed(3),
      surfaceRange: ground && accent ? +(Math.abs(accent.L - ground.L)).toFixed(3) : null,
      textureRef,
    },
    palette: {
      ground: genome?.color?.ground || null,
      ink: genome?.color?.ink || null,
      accent: genome?.color?.accent || null,
      accent2: genome?.color?.accent2 || null,
    },
    humanReview: colorSceneSpaceV2.humanReview || "pending",
  };
}

const TEXTURE_PREFERENCES = {
  "music-nightlife": ["film-grain", "filtered-surface", "halftone", "dither", "mesh"],
  "earth-craft": ["paper-grain", "image-or-pattern-surface", "film-grain", "filtered-surface"],
  "climate-civic": ["paper-grain", "image-or-pattern-surface", "none-observed"],
  "technical-observability": ["none-observed", "dither", "filtered-surface"],
  "editorial-archive": ["paper-grain", "film-grain", "filtered-surface", "image-or-pattern-surface"],
  "neutral-corporate": ["none-observed", "filtered-surface"],
  "friendly-consumer": ["mesh", "filtered-surface", "paper-grain", "none-observed"],
};

export function selectTextureDialect(genome, intent, profileId = null, seed = 0) {
  const profile = profileFamily(profileId, intent);
  const air = Number.isFinite(Number(genome?.layout?.macro?.whitespace)) ? Number(genome.layout.macro.whitespace) : 0.5;
  const dense = clamp01(intent.contentDensity, 0.5) > 0.78;
  const allowed = TEXTURE_PREFERENCES[profile] || TEXTURE_PREFERENCES["editorial-archive"];
  const canTexture = intent.texturePreference !== "none" && !dense && air >= 0.28 && (clamp01(intent.materiality, 0.5) >= 0.42 || profile === "music-nightlife");
  if (!canTexture) {
    return {
      enabled: false,
      dialect: "none-observed",
      intensity: 0,
      placement: "none",
      mobileTransform: "same",
      source: materialTextureSpaceV2.schemaVersion,
      reason: dense ? "content density is too high for a decorative texture" : "materiality/air gate withheld texture",
    };
  }
  const requested = String(intent.texturePreference || "auto");
  const requestedIsAvailable = requested !== "auto" && TEXTURE_DIALECTS.has(requested) && allowed.includes(requested);
  const available = allowed.filter((dialect) => TEXTURE_DIALECTS.has(dialect));
  const dialect = requestedIsAvailable
    ? requested
    : available[hashToUint32(`${seed}:texture:${profile}`) % Math.max(1, available.length)] || "none-observed";
  if (dialect === "none-observed") {
    return { enabled: false, dialect, intensity: 0, placement: "none", mobileTransform: "same", source: materialTextureSpaceV2.schemaVersion, reason: "catalogue selected no texture for this direction" };
  }
  return {
    enabled: true,
    dialect,
    intensity: +Math.min(0.14, 0.035 + clamp01(intent.craft, 0.6) * 0.08).toFixed(3),
    placement: profile === "earth-craft" || profile === "editorial-archive" ? "surface-and-hero-media" : "background-field",
    mobileTransform: "same-or-lighter",
    reducedMotion: "static",
    source: materialTextureSpaceV2.schemaVersion,
    humanReview: materialTextureSpaceV2.humanReview || "pending",
  };
}

const COMPONENT_PREFERENCES = {
  "music-nightlife": ["playful", "tactile", "brutalist"],
  "earth-craft": ["tactile", "organic", "luxury"],
  "climate-civic": ["organic", "editorial", "calm"],
  "technical-observability": ["technical", "crisp", "calm"],
  "editorial-archive": ["editorial", "luxury", "crisp"],
  "neutral-corporate": ["calm", "crisp", "technical"],
  "friendly-consumer": ["playful", "tactile", "calm"],
};

const COMPONENT_TOKEN_MAP = {
  calm: { shape: "controlled-rectangle", fill: "quiet-solid", border: "hairline", interaction: "soft-color-shift", shadow: "soft-low-elevation" },
  crisp: { shape: "tight-rectangle", fill: "solid-with-structure", border: "selective", interaction: "two-pixel-press", shadow: "flat-or-hairline" },
  tactile: { shape: "soft-rounded", fill: "solid-with-depth", border: "selective", interaction: "lift-and-press", shadow: "layered-elevation" },
  playful: { shape: "rounded-offset", fill: "bold-solid", border: "contrast-edge", interaction: "bounce-within-bounds", shadow: "hard-offset-or-contact" },
  editorial: { shape: "text-or-tight-rectangle", fill: "ink-block-or-outline", border: "hairline", interaction: "underline-and-press", shadow: "flat-or-hairline" },
  luxury: { shape: "controlled-rounded", fill: "quiet-solid", border: "fine-line", interaction: "slow-lift", shadow: "soft-low-elevation" },
  technical: { shape: "tight-rectangle", fill: "state-coded-solid", border: "structural", interaction: "state-transition", shadow: "flat-or-hairline" },
  brutalist: { shape: "square-offset", fill: "black-or-accent-block", border: "heavy-structural", interaction: "hard-press", shadow: "hard-offset-or-contact" },
  organic: { shape: "soft-irregular-round", fill: "quiet-solid", border: "selective", interaction: "gentle-lift", shadow: "soft-low-elevation" },
};

function selectComponentDialect(intent, profileId, seed) {
  const profile = profileFamily(profileId, intent);
  const options = (COMPONENT_PREFERENCES[profile] || COMPONENT_PREFERENCES["editorial-archive"]).filter((dialect) => COMPONENT_DIALECTS.has(dialect));
  return options[hashToUint32(`${seed}:component:${profile}`) % Math.max(1, options.length)] || "calm";
}

function shadowFor(engine, level, hue, alpha) {
  try { return engine.shadow(level, { hue, alpha }); } catch { return null; }
}

export function deriveComponentPersonality(engine, genome, intent, profileId = null, seed = 0) {
  const dialect = selectComponentDialect(intent, profileId, seed);
  const tokens = COMPONENT_TOKEN_MAP[dialect] || COMPONENT_TOKEN_MAP.calm;
  const hue = Number.isFinite(Number(genome?.color?.hue)) ? Math.round(Number(genome.color.hue)) : 0;
  const radius = genome?.material?.radii || null;
  const restingShadow = shadowFor(engine, dialect === "brutalist" || dialect === "playful" ? 2 : 1, hue, dialect === "brutalist" || dialect === "playful" ? 0.18 : 0.1);
  const hoverShadow = shadowFor(engine, dialect === "brutalist" || dialect === "playful" ? 3 : 2, hue, dialect === "brutalist" || dialect === "playful" ? 0.22 : 0.14);
  const activeShadow = shadowFor(engine, 0, hue, 0.04);
  return {
    schemaVersion: componentPersonalityV1.schemaVersion,
    dialect,
    source: componentPersonalityV1.source,
    observedRecords: componentPersonalityV1.observedRecords,
    personalityIndependentFromQuality: !!componentPersonalityV1.independence?.personality,
    statesRequired: componentPersonalityV1.interactionStatesRequired || [],
    button: {
      ...tokens,
      height: dialect === "technical" || dialect === "crisp" ? "2.5rem" : "2.75rem",
      horizontalPadding: dialect === "editorial" ? "1.1em" : "1.25em",
      radius: radius ? (dialect === "brutalist" || dialect === "technical" ? radius.sm : radius.md) : null,
      restingShadow,
      hoverShadow,
      activeShadow,
      hoverTransform: dialect === "playful" ? "translateY(-2px) rotate(-0.5deg)" : dialect === "tactile" ? "translateY(-2px)" : "none",
      activeTransform: dialect === "playful" ? "translateY(1px) rotate(0deg)" : "translateY(1px)",
      focusTreatment: "visible-outline-plus-offset",
      disabledTreatment: "reduce-contrast-and-motion",
      loadingTreatment: "preserve-width-and-label-space",
      successTreatment: "state-color-and-label-change",
      errorTreatment: "state-color-and-message-near-control",
    },
    shadow: {
      language: tokens.shadow,
      resting: restingShadow,
      hover: hoverShadow,
      active: activeShadow,
      rule: "shadow is a material cue for interactive state, never a blanket card decoration",
    },
    humanReview: "pending-interaction-replay",
  };
}

function contextTokens(intent, profileId) {
  const profile = profileFamily(profileId, intent);
  const surface = String(intent.surface || "").toLowerCase();
  const tokens = new Set([profile, surface, intent.contentModel, intent.job].filter(Boolean).map((value) => String(value).toLowerCase()));
  if (["landing-page", "marketing", "portfolio", "brand"].includes(surface)) tokens.add("most-marketing");
  if (["portfolio", "brand"].includes(surface)) tokens.add("portfolio");
  if (surface === "editorial") tokens.add("editorial");
  if (profile === "earth-craft") tokens.add("craft");
  if (profile === "music-nightlife") tokens.add("film");
  if (profile === "climate-civic") tokens.add("paper");
  return { profile, tokens };
}

function treatmentMatches(treatment, tokens) {
  const positive = (treatment.whenToUse || []).filter((value) => tokens.has(value)).length;
  const negative = (treatment.notFor || []).filter((value) => tokens.has(value)).length;
  return positive - negative * 3;
}

function chooseTreatment(category, preferredIds, tokens, intent, seed) {
  const options = preferredIds.map((id) => TREATMENT_BY_ID.get(id)).filter((treatment) => treatment?.category === category);
  const scored = options
    .map((treatment) => ({ treatment, score: treatmentMatches(treatment, tokens) + (hashToUint32(`${seed}:expression:${treatment.id}`) / 0xffffffff) * 0.08 }))
    .filter(({ treatment }) => (treatment.whenToUse || []).some((value) => tokens.has(value)));
  scored.sort((a, b) => b.score - a.score || a.treatment.id.localeCompare(b.treatment.id));
  const chosen = scored[0];
  if (!chosen || chosen.score < 0) return null;
  if (category === "cursor" && intent.surface === "touch-primary") return null;
  return chosen.treatment;
}

const EXPRESSION_PREFERENCES = {
  "music-nightlife": {
    cursor: ["cursor-image-trail", "cursor-magnetic-action"],
    scroll: ["horizontal-gallery-pan", "asymmetric-split-pinning", "scroll-reveal-stagger"],
    texture: ["grain-surface-overlay"],
    typography: ["variable-axis-kinetic-type", "outline-solid-type", "type-mask-crop"],
  },
  "earth-craft": {
    cursor: ["cursor-magnetic-action"],
    scroll: ["scroll-reveal-stagger", "sticky-narrative-stack"],
    texture: ["grain-surface-overlay"],
    typography: ["outline-solid-type"],
  },
  "climate-civic": {
    cursor: [],
    scroll: ["scroll-reveal-stagger", "sticky-narrative-stack"],
    texture: ["grain-surface-overlay"],
    typography: [],
  },
  "technical-observability": {
    cursor: [],
    scroll: ["scroll-reveal-stagger"],
    texture: [],
    typography: [],
  },
  "editorial-archive": {
    cursor: ["cursor-magnetic-action"],
    scroll: ["asymmetric-split-pinning", "sticky-narrative-stack", "scroll-reveal-stagger"],
    texture: ["grain-surface-overlay"],
    typography: ["outline-solid-type", "type-mask-crop"],
  },
  "neutral-corporate": { cursor: [], scroll: ["scroll-reveal-stagger"], texture: [], typography: [] },
  "friendly-consumer": { cursor: ["cursor-magnetic-action"], scroll: ["scroll-reveal-stagger"], texture: ["grain-surface-overlay"], typography: [] },
};

export function deriveExpressionPlan(intent, genome, profileId = null, texture = null, seed = 0) {
  const { profile, tokens } = contextTokens(intent, profileId);
  const preferences = EXPRESSION_PREFERENCES[profile] || EXPRESSION_PREFERENCES["editorial-archive"];
  const selected = [];
  const requested = intent.expressionPreference === "none" ? null : TREATMENT_BY_ID.get(intent.expressionPreference);
  if (requested && treatmentMatches(requested, tokens) >= 0 && (requested.category !== "texture" || texture?.enabled)) selected.push(requested);
  const cursor = chooseTreatment("cursor", preferences.cursor || [], tokens, intent, seed);
  const scroll = chooseTreatment("scroll", preferences.scroll || [], tokens, intent, seed);
  const typography = chooseTreatment("typography", preferences.typography || [], tokens, intent, seed);
  if (!requested && cursor) selected.push(cursor);
  if (!requested && scroll) selected.push(scroll);
  if (!requested && typography && clamp01(intent.experimentalism, 0.5) >= 0.62) selected.push(typography);
  if (texture?.enabled) {
    const grain = TREATMENT_BY_ID.get("grain-surface-overlay");
    const grainCompatible = ["paper-grain", "film-grain", "filtered-surface", "halftone", "dither"].includes(texture.dialect);
    if (grain && grainCompatible && treatmentMatches(grain, tokens) > 0 && !selected.some((treatment) => treatment.id === grain.id)) selected.push(grain);
  }
  // One high-commitment centrepiece, plus at most one quiet supporting texture.
  const centreCandidates = selected.filter((treatment) => ["cursor", "scroll", "typography"].includes(treatment.category));
  const centrepiece = centreCandidates[0] || null;
  const finalTreatments = selected.filter((treatment) => treatment === centrepiece || treatment.category === "texture").slice(0, 2);
  return {
    schemaVersion: expressionTreatmentsV1.schemaVersion,
    profile,
    centrepiece: centrepiece ? centrepiece.id : null,
    treatments: finalTreatments,
    constraints: expressionTreatmentsV1.combinationRules || [],
    compatibility: {
      hardRules: expressionCompatibilityV1.hardRules || [],
      defaultConflicts: expressionCompatibilityV1.defaultConflicts || [],
      humanReview: expressionCompatibilityV1.humanReview || "pending",
    },
    responsive: Object.fromEntries(finalTreatments.map((treatment) => [treatment.id, treatment.mobileTransform])),
    reducedMotion: Object.fromEntries(finalTreatments.map((treatment) => [treatment.id, treatment.reducedMotion])),
    performance: Object.fromEntries(finalTreatments.map((treatment) => [treatment.id, treatment.performanceCost])),
    interactionCapture: "static-crawl-derived; hover/press replay remains pending",
    sourceBrief: intent.sourceBrief || "",
    mobileFallback: genome?.responsive?.collapseRules || [],
  };
}

export function applyConnectedV2(engine, genome, intent, { seed = 0, profileId = null, excludeAccent = [] } = {}) {
  const profile = profileFamily(profileId, intent);
  const accent = selectAccentFont(engine, genome, intent, { seed, profileId: profile, exclude: excludeAccent });
  const pairEvidence = fontPairEvidence(genome?.type?.display, genome?.type?.body);
  const displayEvidence = fontSpaceEvidence(genome?.type?.display);
  const bodyEvidence = fontSpaceEvidence(genome?.type?.body);
  const texture = selectTextureDialect(genome, intent, profile, seed);
  const component = deriveComponentPersonality(engine, genome, intent, profile, seed);
  const expression = deriveExpressionPlan(intent, genome, profile, texture, seed);
  const colorScene = deriveColorScene(engine, genome, intent, texture.dialect);
  const type = {
    ...genome.type,
    accent: accent.font,
    roles: { display: "heading/identity", body: "running text", accent: accent.enabled ? "short accent only" : "not selected" },
    pairing: {
      ...(genome.type.pairing || {}),
      v2: {
        schemaVersion: fontSpaceV2.schemaVersion,
        display: displayEvidence,
        body: bodyEvidence,
        pairEvidence,
        accent: accent.enabled ? {
          family: accent.font?.family,
          genre: accent.genre,
          evidence: accent.evidence,
          pairEvidenceWithBody: accent.pairEvidenceWithBody,
        } : null,
        humanValidation: "pending",
      },
    },
  };
  return {
    ...genome,
    type,
    color: { ...genome.color, scene: colorScene },
    material: { ...genome.material, component, texture },
    motion: { ...genome.motion, expression },
    expression,
    connected: {
      ...(genome.connected || {}),
      v2: {
        schemaVersion: "connected-style-v2",
        sources: sourceSummary,
        profile,
        accentFont: accent.enabled ? accent.font?.family : null,
        componentDialect: component.dialect,
        textureDialect: texture.dialect,
        centrepiece: expression.centrepiece,
      },
    },
    provenance: {
      ...(genome.provenance || {}),
      type: "font-space.v2:connected-display-body-accent-v2",
      color: "color-scene-space.v2:interpretable-scene-v2",
      material: "material-texture-space.v2:component-personality-v2",
      motion: "expression-treatments.v1:bounded-expression-plan-v2",
    },
  };
}
