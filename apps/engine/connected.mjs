// Connected one-shot adapter.
//
// The frozen engine remains the source of truth for math, gates, retrieval, and
// genome shape. This seam adds the missing semantic bridge: a short subject
// brief must influence the same axes that the engine already consumes, then a
// deterministic role-aware font variant is chosen from the engine's vetted
// candidate space. No model call or random state is introduced.

import { styleGenome } from "./genome.mjs";
import { exploreDirections } from "./explore.mjs";
import { genomeToSpec } from "./spec.mjs";
import { hashToUint32 } from "./intent.mjs";
import { applyConnectedV2, CONNECTED_V2_STATUS, fontPairEvidence, shipworthyFont } from "./connected-v2.mjs";

const SURFACE_ALIASES = new Map([
  ["landing", "landing-page"],
  ["brand", "portfolio"],
  ["story", "editorial"],
  ["tool", "app"],
]);

// Profiles are intentionally small and interpretable. They are semantic
// priors, not a replacement for the caller's explicit dials.
const SUBJECT_PROFILES = [
  {
    id: "music-nightlife",
    test: /\b(music|album|record|sound|dj|concert|nightlife|electronic|club|festival)\b/i,
    hue: 332,
    dials: { energy: 0.88, warmth: 0.32, formality: 0.28, craft: 0.8, experimentalism: 0.92, motionIntensity: 0.72, materiality: 0.72 },
  },
  {
    id: "earth-craft",
    test: /\b(coffee|roaster|ceramic|pottery|clay|wood|craft|vessel|bakery|brew|atelier|studio)\b/i,
    hue: 34,
    dials: { energy: 0.54, warmth: 0.88, formality: 0.3, craft: 0.9, experimentalism: 0.46, motionIntensity: 0.35, materiality: 0.86 },
  },
  {
    id: "climate-civic",
    test: /\b(climate|forest|ecology|sustainab|library|civic|public|community|field journal|nature)\b/i,
    hue: 146,
    dials: { energy: 0.48, warmth: 0.68, formality: 0.58, craft: 0.86, experimentalism: 0.38, motionIntensity: 0.24, materiality: 0.62 },
  },
  {
    id: "technical-observability",
    test: /\b(developer|api|sdk|observability|incident|infrastructure|database|code|documentation|docs|console|metrics|sre)\b/i,
    hue: 164,
    dials: { energy: 0.34, warmth: 0.28, formality: 0.72, craft: 0.8, experimentalism: 0.24, motionIntensity: 0.2, materiality: 0.3 },
  },
  {
    id: "editorial-archive",
    test: /\b(editorial|journal|archive|magazine|reporting|essay|fashion|art director|portfolio|gallery|exhibition)\b/i,
    hue: 18,
    dials: { energy: 0.48, warmth: 0.58, formality: 0.62, craft: 0.9, experimentalism: 0.72, motionIntensity: 0.3, materiality: 0.58 },
  },
];

function sourceText(input = {}) {
  return [input.sourceBrief, input.brief, input.prompt, input.description, input.subject, input.job, input.contentModel].filter(Boolean).join(" ");
}

export function connectedIntent(input = {}) {
  const raw = { ...input };
  if (raw.surface != null) raw.surface = SURFACE_ALIASES.get(String(raw.surface).toLowerCase()) || raw.surface;
  if (!raw.sourceBrief) raw.sourceBrief = sourceText(input);
  const text = sourceText(raw);
  const profile = SUBJECT_PROFILES.find((candidate) => candidate.test.test(text)) || null;
  if (!profile) return { intent: raw, profile: null, signals: [] };
  const intent = { ...raw };
  for (const [key, value] of Object.entries(profile.dials)) {
    if (intent[key] == null) intent[key] = value;
  }
  if (intent.hue == null) intent.hue = profile.hue;
  return { intent, profile: profile.id, signals: Object.keys(profile.dials).concat("hue") };
}

const DISPLAY_GENRE_RULES = {
  // A technical/civic brief can still be distinctive, but its identity should
  // come from proportion, contrast, and composition—not a novelty script.
  "technical-observability": new Set(["blackletter", "script", "decorative"]),
  "climate-civic": new Set(["blackletter", "script", "decorative"]),
  "earth-craft": new Set(["blackletter", "decorative"]),
  "neutral-corporate": new Set(["blackletter", "script", "decorative", "display-other"]),
  "friendly-consumer": new Set(["blackletter"]),
};

const DISPLAY_GENRE_PREFERENCES = {
  "music-nightlife": ["display-other", "script", "slab", "ornate-serif", "sans", "serif", "mono"],
  "earth-craft": ["ornate-serif", "slab", "display-other", "serif", "sans", "script", "mono"],
  "climate-civic": ["serif", "ornate-serif", "slab", "sans", "display-other", "mono"],
  "technical-observability": ["sans", "slab", "mono", "serif", "ornate-serif", "display-other"],
  "editorial-archive": ["ornate-serif", "serif", "display-other", "sans", "slab", "script", "mono"],
  "neutral-corporate": ["sans", "serif", "slab", "ornate-serif", "display-other", "mono"],
  "friendly-consumer": ["sans", "slab", "serif", "display-other", "script", "ornate-serif", "mono"],
};

const UTILITY_FONT_RX = /wavefont|redacted|icon|symbol|emoji|dingbat|notdef|wingdings/i;
const BODY_SPECIALIST_FONT_RX = /\bsc\b|small\s*caps|stencil|outline|inline|icon|symbol|redacted|wavefont/i;
const DISPLAY_SPECIALIST_FONT_RX = /wavefont|redacted|icon|symbol|emoji|dingbat|notdef/i;

function fontName(font) { return String(font?.family || ""); }
function isUtilityFont(font) { return UTILITY_FONT_RX.test(fontName(font)); }
function isBodySpecialist(font) { return BODY_SPECIALIST_FONT_RX.test(fontName(font)); }
function isDisplaySpecialist(font, profileId) {
  if (DISPLAY_SPECIALIST_FONT_RX.test(fontName(font))) return true;
  if (profileId !== "music-nightlife" && /underline|linefont|wavefont|red\s*rose/i.test(fontName(font))) return true;
  return profileId !== "music-nightlife" && /stencil|outline|inline/i.test(fontName(font));
}

function pairingProfile(engine, intent, profileId) {
  if (profileId) return profileId;
  if (["dashboard", "app", "docs"].includes(intent?.surface)) return "technical-observability";
  if (intent?.surface === "pricing") return "neutral-corporate";
  const register = engine.deriveRegister?.(intent);
  if (register === "technical-precise") return "technical-observability";
  if (register === "friendly-consumer") return "friendly-consumer";
  if (register === "neutral-corporate") return "neutral-corporate";
  return "editorial-archive";
}

function genreRank(preferences, genre) {
  const index = preferences.indexOf(genre);
  return index < 0 ? preferences.length + 1 : index;
}

function typePairScore(engine, display, body, profileId, subjectKey) {
  if (!display || !body || display.family === body.family) return -Infinity;
  if (!shipworthyFont(display, "display") || !shipworthyFont(body, "body")) return -Infinity;
  const displayGenre = engine.classifyFontGenre?.(display) || display.category || "unknown";
  const bodyCategory = body.category || "unknown";
  const preferences = DISPLAY_GENRE_PREFERENCES[profileId] || DISPLAY_GENRE_PREFERENCES["editorial-archive"];
  const forbidden = DISPLAY_GENRE_RULES[profileId];
  if (forbidden?.has(displayGenre) || isUtilityFont(display) || isDisplaySpecialist(display, profileId) || isBodySpecialist(body)) return -Infinity;

  let score = 2.0 - genreRank(preferences, displayGenre) * 0.16;
  // These are intentional contrast pairs: the display face carries identity,
  // while the text face supplies a stable reading texture.
  if (["ornate-serif", "serif", "slab"].includes(displayGenre) && bodyCategory === "sans-serif") score += 1.1;
  if (["display-other", "script"].includes(displayGenre) && bodyCategory === "sans-serif") score += 0.95;
  if (["sans", "mono"].includes(displayGenre) && bodyCategory === "serif") score += 0.85;
  if (displayGenre === "sans" && bodyCategory === "sans-serif") score += 0.25;
  if (displayGenre === "mono" && bodyCategory === "sans-serif") score += profileId === "technical-observability" ? 0.7 : 0.1;
  if (displayGenre === "script" && bodyCategory === "serif") score += profileId === "music-nightlife" ? 0.35 : 0;
  if (body.readabilityChecks?.bodySuitable === false) score -= 5;
  const displayFit = Number(display.featureDistance);
  const bodyFit = Number(body.featureDistance);
  if (Number.isFinite(displayFit)) score += Math.max(0, 0.45 - displayFit);
  if (Number.isFinite(bodyFit)) score += Math.max(0, 0.35 - bodyFit);
  // v2 observations are candidate evidence, never ground truth. They can
  // break a tie between already-valid pairs, but cannot rescue an unreadable pair.
  if (fontPairEvidence(display, body).record) score += 0.28;
  // A very small seeded tie-breaker gives direction variants different
  // pairings without allowing a bad pairing to outrank a good one.
  score += (hashToUint32(`${subjectKey}:${display.family}:${body.family}`) / 0xffffffff) * 0.18;
  return score;
}

function typeVariant(engine, genome, intent, seed, variant = 0, profileId = null, exclusions = {}) {
  if (!genome?.type || !genome.layout) return genome;
  const layoutAir = Number.isFinite(Number(genome.layout.macro?.whitespace))
    ? Number(genome.layout.macro.whitespace)
    : undefined;
  const subjectKey = `${intent.sourceBrief || ""}:${intent.surface || ""}:${genome.layout.family}:${seed}:${variant}`;
  const activeProfile = pairingProfile(engine, intent, profileId);
  const forbidden = DISPLAY_GENRE_RULES[activeProfile];
  const displayCandidates = engine.retrieveFonts({ role: "display", intent, n: 20, layoutAir, exclude: exclusions.display || [] })
    .filter((candidate) => shipworthyFont(candidate, "display"))
    .filter((candidate) => !forbidden?.has(engine.classifyFontGenre?.(candidate) || candidate.category))
    .filter((candidate) => !isUtilityFont(candidate) && !isDisplaySpecialist(candidate, activeProfile));
  const bodyCandidates = engine.retrieveFonts({ role: "body", intent, n: 20, layoutAir, exclude: [...(exclusions.body || []), ...(exclusions.display || [])] })
    .filter((candidate) => shipworthyFont(candidate, "body"))
    .filter((candidate) => !isUtilityFont(candidate) && !isBodySpecialist(candidate));
  const valid = (candidateDisplay, candidateBody) => {
    if (!candidateDisplay || !candidateBody || candidateDisplay.family === candidateBody.family) return false;
    if (candidateDisplay.asset?.available === false || candidateBody.asset?.available === false) return false;
    if (forbidden?.has(engine.classifyFontGenre?.(candidateDisplay) || candidateDisplay.category)) return false;
    if (isUtilityFont(candidateDisplay) || isDisplaySpecialist(candidateDisplay, activeProfile) || isUtilityFont(candidateBody) || isBodySpecialist(candidateBody)) return false;
    const gate = engine.checkTypeFit?.({ display: candidateDisplay?.family, body: candidateBody?.family }, intent);
    return !gate || gate.pass;
  };
  const pairs = [];
  for (const candidateDisplay of displayCandidates.slice(0, 10)) {
    for (const candidateBody of bodyCandidates.slice(0, 10)) {
      if (!valid(candidateDisplay, candidateBody)) continue;
      const score = typePairScore(engine, candidateDisplay, candidateBody, activeProfile, subjectKey);
      if (Number.isFinite(score)) pairs.push({ display: candidateDisplay, body: candidateBody, score });
    }
  }
  pairs.sort((a, b) => b.score - a.score);
  const chosen = pairs[0] || null;
  const display = chosen?.display || displayCandidates[0] || genome.type.display;
  const body = chosen?.body || bodyCandidates.find((candidate) => candidate.family !== display?.family) || genome.type.body;
  const next = {
    ...genome,
    type: {
      ...genome.type,
      display,
      body,
      pairing: {
        strategy: "subject-register-contrast-v1",
        displayGenre: engine.classifyFontGenre?.(display) || display?.category || "unknown",
        bodyCategory: body?.category || "unknown",
        score: chosen ? Math.round(chosen.score * 1000) / 1000 : null,
      register: activeProfile,
      },
    },
    fingerprint: { ...genome.fingerprint, fontPair: [display?.family, body?.family].filter(Boolean) },
    provenance: { ...genome.provenance, type: "font-space.json:connected-pair-compatibility-v1" },
  };
  return next;
}

function energyBand(intent, fallback = "balanced") {
  if (Number(intent?.energy) < 0.34) return "muted";
  if (Number(intent?.energy) >= 0.67) return "bold";
  return fallback;
}

function connectedMood(intent, fallback = "light") {
  // A requested theme is a hard semantic constraint for the one-shot path.
  // Explore may vary mood in the frozen core, but the connected seam keeps all
  // alternatives faithful to an explicit light/dark brief.
  if (intent?.theme === "dark") return "dark";
  if (intent?.theme === "light") return "light";
  return fallback;
}

function applyConnectedPalette(engine, genome, intent, seed, variant = 0) {
  if (!genome?.color) return genome;
  const hue = Number.isFinite(Number(genome.color.hue)) ? Number(genome.color.hue) : (Number.isFinite(Number(intent.hue)) ? Number(intent.hue) : null);
  const palette = engine.generatePalette({
    hue,
    energy: energyBand(intent, genome.color.energy),
    seed: hashToUint32(`${seed}:connected-palette:${variant}`),
    mood: connectedMood(intent, genome.color.mood),
    accent: intent.accent || null,
  });
  const checked = engine.checkPalette(palette.ground, palette.ink, palette.accent, palette.accent2);
  if (!checked.pass) return genome;
  return {
    ...genome,
    color: { ...palette, source: "connected-theme-coherence-v1" },
    fingerprint: { ...genome.fingerprint, paletteHue: Math.round(palette.hue ?? hue ?? 0) },
    provenance: { ...genome.provenance, color: "oklch:connected-theme-coherence-v1" },
  };
}

const CONCEPT_CARDS = {
  "music-nightlife": {
    centrepiece: "a playable sound object or track-driven visual instrument, not a decorative hero image",
    subjectObjects: "tracklist, waveform or spectral trace, release credits, and one physical artifact from the record",
    interaction: "let play, scrub, hover, or scroll expose one controlled layer of the sound world",
    mobile: "keep the playable control and title together; move supporting credits below the first interaction",
  },
  "earth-craft": {
    centrepiece: "one tactile object shown at a deliberate scale, with the material story doing the visual work",
    subjectObjects: "origin, process, material, maker note, and a considered purchase or reservation moment",
    interaction: "use a restrained reveal, rotation, or texture shift to reward attention without turning the product into a toy",
    mobile: "stack the object before its explanation and keep the primary action reachable after the first proof",
  },
  "climate-civic": {
    centrepiece: "a field instrument—map, archive, or living index—that makes the subject legible at a glance",
    subjectObjects: "places, observations, dates, people, and a concrete next action for the reader or resident",
    interaction: "allow one meaningful filter, map move, or evidence reveal; never hide the core story behind motion",
    mobile: "preserve the evidence-first order, collapse secondary metadata, and keep the civic action visible",
  },
  "technical-observability": {
    centrepiece: "a calm operational instrument that makes the main state or decision obvious before decoration appears",
    subjectObjects: "status, timeline, command or query, evidence, ownership, and a clear recovery action",
    interaction: "use motion for state change and feedback only; keep loading, focus, and reduced-motion states explicit",
    mobile: "collapse navigation first, preserve the primary state and action, and turn secondary columns into ordered sections",
  },
  "editorial-archive": {
    centrepiece: "a subject-specific archive, image, or typographic statement that gives the page its point of view",
    subjectObjects: "headline, provenance, sequence, pull quote or artifact, and a deliberate next reading path",
    interaction: "use scroll or hover to reveal context around the work, not to decorate every section",
    mobile: "keep the opening statement and first artifact together, then preserve reading order over desktop choreography",
  },
  "neutral-corporate": {
    centrepiece: "the single comparison, decision, or proof object that earns trust for this brief",
    subjectObjects: "criteria, evidence, tradeoffs, and one unambiguous next step",
    interaction: "use progressive disclosure only where it reduces cognitive load; keep comparison and action visible",
    mobile: "make the decision path linear, with secondary detail below the primary choice",
  },
};

const SURFACE_CONCEPT_OVERRIDES = {
  docs: {
    profile: "technical-docs",
    centrepiece: "a navigable reference spine that lets a developer find, understand, and verify one task quickly",
    subjectObjects: "task index, runnable example, API or configuration reference, edge cases, and version context",
    interaction: "use anchored navigation and progressive detail for lookup; never hide the example or required inputs behind animation",
    mobile: "keep the task title, example, and copy action together; move secondary navigation into an ordered drawer",
  },
  workflow: {
    profile: "project-workspace",
    centrepiece: "a living handoff surface that shows what changed, who owns the next decision, and what can move now",
    subjectObjects: "projects, decisions, owners, deadlines, dependencies, and a visible next action",
    interaction: "make status changes, handoffs, and undoable edits feel immediate; keep context attached to the work item",
    mobile: "collapse navigation first, keep the current work item and next action pinned, and order supporting context below",
  },
};

function conceptCard(intent, profileId, engine) {
  const activeProfile = pairingProfile(engine, intent, profileId);
  const override = intent?.surface === "docs"
    ? SURFACE_CONCEPT_OVERRIDES.docs
    : intent?.surface === "app" && intent?.contentModel === "workflow"
      ? SURFACE_CONCEPT_OVERRIDES.workflow
      : null;
  const base = override || CONCEPT_CARDS[activeProfile] || CONCEPT_CARDS["editorial-archive"];
  return {
    profile: activeProfile,
    sourceBrief: intent.sourceBrief || "",
    ...base,
    swapTest: "If the brief's subject can be removed without changing the centrepiece, objects, and interaction, reject the build and make those three choices more specific.",
  };
}

function conceptMarkdown(concept) {
  if (!concept) return "";
  return [
    "",
    "## Subject concept card",
    "",
    `- Register: ${concept.profile}`,
    `- Centrepiece: ${concept.centrepiece}.`,
    `- Subject objects: ${concept.subjectObjects}.`,
    `- Interaction: ${concept.interaction}.`,
    `- Mobile transform: ${concept.mobile}.`,
    `- Swap test: ${concept.swapTest}`,
    "",
    "Use this card to make the content and centrepiece specific before writing markup. The genome supplies the system; the card supplies the reason this page exists.",
  ].join("\n");
}

function fontLoadingMarkdown(genome) {
  const display = genome?.type?.display || {};
  const body = genome?.type?.body || {};
  const accent = genome?.type?.accent || null;
  return [
    "",
    "## Font loading handoff",
    "",
    `- Display: **${display.family || "system-ui"}**${display.supplier ? ` (${display.supplier})` : ""}.`,
    `- Body: **${body.family || "system-ui"}**${body.supplier ? ` (${body.supplier})` : ""}.`,
    `- Accent: **${accent?.family || "not selected"}**${accent?.supplier ? ` (${accent.supplier})` : ""} — short display accents only; never paragraphs.`,
    "- Before visual QA, resolve these families to actual licensed local WOFF2 assets, declare them with `@font-face`, and await `document.fonts.ready`; a generic fallback is a failure to validate the pairing, not a successful typography pass.",
    "- Keep the body face on running text, the display face on headings/identity roles, and the accent face on short accents only; never swap them to make a missing asset look acceptable.",
  ].join("\n");
}

function connectedV2Markdown(genome) {
  const component = genome?.material?.component;
  const texture = genome?.material?.texture;
  const expression = genome?.expression;
  const scene = genome?.color?.scene;
  const treatments = expression?.treatments || [];
  return [
    "",
    "## Connected v2 expression handoff",
    "",
    `- Component dialect: **${component?.dialect || "calm"}**; button shape **${component?.button?.shape || "controlled-rectangle"}**, interaction **${component?.button?.interaction || "soft-color-shift"}**.`,
    `- Shadow personality: **${component?.shadow?.language || genome?.material?.shadowLanguage || "flat-or-hairline"}**; use the supplied resting/hover/active layers only on interactive controls.`,
    `- Surface texture: **${texture?.dialect || "none-observed"}**${texture?.enabled ? ` at ${texture.intensity} opacity in ${texture.placement}` : " — withheld by the density/materiality gate"}.`,
    `- Colour scene: **${scene?.axes?.temperature || "neutral"} ${scene?.axes?.lightness || "light"}**, ${scene?.axes?.contrast || "unknown"} contrast, accent ratio ${scene?.axes?.accentRatio ?? "unknown"}.`,
    `- Expression centrepiece: **${expression?.centrepiece || "none"}**${treatments.length ? `; selected treatments: ${treatments.map((treatment) => treatment.id).join(", ")}` : ""}.`,
    `- Mobile fallbacks: ${Object.entries(expression?.responsive || {}).map(([id, value]) => `${id} → ${value}`).join("; ") || "normal flow"}.`,
    `- Reduced motion: ${Object.entries(expression?.reducedMotion || {}).map(([id, value]) => `${id} → ${value}`).join("; ") || "static by default"}.`,
    "- Keep one centrepiece, preserve native mobile scrolling, define reduced-motion behavior, and keep all type effects display-only. The catalogue is empirical guidance, not permission to stack effects.",
  ].join("\n");
}

function decorateDirections(engine, directions, intent, seed, profileId) {
  const usedDisplay = [];
  const usedBody = [];
  const usedAccent = [];
  return directions.map((direction, index) => {
    const genomeWithType = typeVariant(engine, direction.genome, intent, seed, index, profileId, { display: usedDisplay, body: usedBody });
    const paletted = applyConnectedPalette(engine, genomeWithType, intent, seed, index);
    const genome = applyConnectedV2(engine, paletted, intent, { seed: seed + index, profileId, excludeAccent: usedAccent });
    if (genome.type?.display?.family) usedDisplay.push(genome.type.display.family);
    if (genome.type?.body?.family) usedBody.push(genome.type.body.family);
    if (genome.type?.accent?.family) usedAccent.push(genome.type.accent.family);
    return { ...direction, genome, fingerprint: genome.fingerprint };
  });
}

export function connectedStyleGenome(engine, input = {}, options = {}) {
  const { intent, profile, signals } = connectedIntent(input);
  const seed = Number(options.seed ?? genomeSeed(genomeFromInput(intent)));
  const typed = typeVariant(engine, styleGenome(engine, intent, options), intent, seed, 0, profile);
  const paletted = applyConnectedPalette(engine, typed, intent, seed, 0);
  const genome = applyConnectedV2(engine, paletted, intent, { seed, profileId: profile });
  return { ...genome, connected: { ...(genome.connected || {}), profile, signals, source: "connected-intent-v1", concept: conceptCard(intent, profile, engine) } };
}

export function connectedExploreDirections(engine, input = {}, options = {}) {
  const { intent, profile, signals } = connectedIntent(input);
  const seed = Number.isFinite(Number(options.seed)) ? Number(options.seed) : genomeSeed(genomeFromInput(intent));
  const explored = exploreDirections(engine, intent, options);
  const concept = conceptCard(intent, profile, engine);
  return { ...explored, directions: decorateDirections(engine, explored.directions, intent, seed, profile).map((direction) => ({ ...direction, genome: { ...direction.genome, connected: { ...(direction.genome.connected || {}), profile, signals, source: "connected-intent-v1", concept } } })), connected: { profile, signals, source: "connected-intent-v1", concept } };
}

export function connectedBuildSpec(engine, input = {}, options = {}) {
  const genome = connectedStyleGenome(engine, input, options);
  return { genome, spec: `${genomeToSpec(genome)}${conceptMarkdown(genome.connected?.concept)}${fontLoadingMarkdown(genome)}${connectedV2Markdown(genome)}` };
}

function genomeFromInput(intent) {
  return [intent.sourceBrief || "", intent.surface || "", intent.job || "", intent.variation ?? 0].join("|");
}
function genomeSeed(key) { return hashToUint32(key); }

export { CONNECTED_V2_STATUS };
