// Connected one-shot adapter — THE LIVE ORCHESTRATOR.
//
// NAMING, because the filenames mislead: this file and ./connected-v2.mjs are NOT a v1
// and its replacement. This file is the entry point everything actually calls
// (apps/worker/src/tools.mjs imports connectedStyleGenome / connectedExploreDirections /
// connectedBuildSpec from HERE), and it imports ./connected-v2.mjs as a SUB-LAYER —
// "v2" there names the v2 research catalogues that layer consumes (font-space.v2,
// color-scene-space.v2, material-texture-space.v2, …), not a second generation of this
// orchestrator. Neither file supersedes the other; deleting or "upgrading to" v2 would
// remove the orchestration, and connected-v2.mjs on its own produces no genome or spec.
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
import { LAYOUT_FAMILIES } from "./layout-families.mjs";
import { applyConnectedV2, CONNECTED_V2_STATUS, fontPairEvidence, fontSpaceEvidence, shipworthyFont } from "./connected-v2.mjs";

const SURFACE_ALIASES = new Map([
  ["landing", "landing-page"],
  ["landing page", "landing-page"],
  ["marketing site", "marketing"],
  ["brand", "portfolio"],
  ["story", "editorial"],
  ["tool", "app"],
]);

// Benchmark and agent callers often describe a surface instead of supplying
// the engine's enum ("creative tool landing page", "public-service form").
// Exact aliases alone made those briefs miss the surface priors and quietly
// become editorial. Rules are ordered from most structurally specific to most
// generic; the source brief is only a tie-breaker for ambiguous labels.
const SURFACE_RULES = [
  { id: "dashboard", score: 9, test: /\b(dashboard|control[ -]plane|operations? console|monitoring console|incident workspace|admin console)\b/i },
  { id: "docs", score: 8, test: /\b(documentation|developer docs|reference manual|api reference|docs)\b/i },
  { id: "pricing", score: 8, test: /\b(pricing|plan comparison|plans? page)\b/i },
  { id: "portfolio", score: 8, test: /\b(portfolio|case[- ]study gallery)\b/i },
  { id: "editorial", score: 8, test: /\b(editorial|research story|long[- ]form story|article|reportage|journal)\b/i },
  { id: "app", score: 8, test: /\b(public[- ]service form|application flow|form flow|wizard|checkout flow|booking flow)\b/i },
  { id: "landing-page", score: 7, test: /\b(landing page|product page|launch page)\b/i },
  { id: "marketing", score: 6, test: /\b(marketing|campaign|conversion page)\b/i },
  { id: "app", score: 5, test: /\b(app|application|editor|workspace|workbench|tool)\b/i },
];

export function canonicalSurface(surface, sourceBrief = "") {
  const raw = String(surface || "").trim().toLowerCase().replace(/[_/]+/g, " ").replace(/\s+/g, " ");
  if (!raw) return undefined;
  if (SURFACE_ALIASES.has(raw)) return SURFACE_ALIASES.get(raw);
  if (["landing-page", "dashboard", "docs", "app", "marketing", "portfolio", "pricing", "editorial"].includes(raw)) return raw;
  const haystack = `${raw} ${String(sourceBrief || "")}`;
  const matches = SURFACE_RULES
    .filter((rule) => rule.test.test(haystack))
    .map((rule) => ({ ...rule, score: rule.score + (rule.test.test(raw) ? 20 : 0) }))
    .sort((a, b) => b.score - a.score);
  return matches[0]?.id || raw.replace(/\s+/g, "-");
}

// Profiles are intentionally small and interpretable. They are semantic
// priors, not a replacement for the caller's explicit dials.
const SUBJECT_PROFILES = [
  {
    id: "creative-tool-workbench",
    signals: [
      [9, /\b(motion choreography|motion editor|animation editor|sequence editor)\b/i, "motion-editor"],
      [8, /\b(font editor|glyph editor|typeface editor|vector editor|image editor|creative editor)\b/i, "creative-editor"],
      [6, /\b(creative tool|creative software|browser[- ]based tool|design tool)\b/i, "creative-tool"],
      [4, /\b(editable sequence|timeline|keyframe|playhead|easing|scrub|tracks?|glyph|outline|node|kerning|variable axis)\b/i, "editable-object-model"],
      [3, /\b(canvas|stage|inspector|preview|undo|export formats?)\b/i, "workbench-parts"],
    ],
    hue: 12,
    dials: { energy: 0.68, warmth: 0.42, formality: 0.44, craft: 0.9, experimentalism: 0.74, motionIntensity: 0.62, materiality: 0.46, contentDensity: 0.64, layoutVariance: 0.62 },
  },
  {
    id: "civic-service-flow",
    signals: [
      [8, /\b(public[- ]service|city resident|benefits? application|government form)\b/i, "public-service"],
      [4, /\b(eligibility|household|income details?|save[- ]and[- ]return|confirmation state)\b/i, "application-model"],
      [2, /\b(form|validation|progress|resident)\b/i, "form-flow"],
    ],
    hue: 138,
    dials: { energy: 0.28, warmth: 0.58, formality: 0.7, craft: 0.84, experimentalism: 0.16, motionIntensity: 0.12, materiality: 0.2, contentDensity: 0.58, layoutVariance: 0.2, trustLevel: 0.92 },
  },
  {
    id: "research-evidence",
    signals: [
      [8, /\b(research story|research edition|evidence story|data story)\b/i, "research-story"],
      [5, /\b(measurements?|methodology|uncertainty|comparison table|citations?)\b/i, "evidence-model"],
      [3, /\b(heat islands?|neighbou?rhoods?|map[- ]like evidence)\b/i, "field-evidence"],
    ],
    hue: 24,
    dials: { energy: 0.38, warmth: 0.5, formality: 0.72, craft: 0.92, experimentalism: 0.42, motionIntensity: 0.16, materiality: 0.48, contentDensity: 0.62, layoutVariance: 0.46, trustLevel: 0.94 },
  },
  {
    id: "community-service-discovery",
    signals: [
      [7, /\b(public library|community cent(?:er|re)|recreation cent(?:er|re)|cultural cent(?:er|re)|public resource directory|parks? and recreation)\b/i, "community-service-subject"],
      [4, /\b(catalog(?:ue)?|resources?|programs?|events?|classes|services|browse|discover|find)\b/i, "discovery-model"],
      [4, /\b(availability|available|hours|branches?|locations?|visit|reserve|register|book|borrow|holds?|waitlist|access)\b/i, "access-model"],
      [2, /\b(families|residents|patrons|neighbou?rhood|community service)\b/i, "community-audience"],
    ],
    hue: 118,
    dials: { energy: 0.4, warmth: 0.64, formality: 0.6, craft: 0.84, experimentalism: 0.24, motionIntensity: 0.16, materiality: 0.32, contentDensity: 0.58, layoutVariance: 0.36, trustLevel: 0.88 },
  },
  {
    id: "care-capacity-command",
    threshold: 9, minEvidence: 2,
    signals: [[7, /\b(hospital|ward|beds?|patient flow|care capacity)\b/i, "care-capacity-objects"], [6, /\b(admit|discharge|transfer|assign|allocate|placement)\b/i, "allocation-actions"], [4, /\b(occupancy|capacity|queue|ready|cleaning|blocked)\b/i, "capacity-states"]],
    hue: 154,
    dials: { energy: 0.38, warmth: 0.32, formality: 0.82, craft: 0.86, experimentalism: 0.14, motionIntensity: 0.14, materiality: 0.18, contentDensity: 0.9, layoutVariance: 0.2, trustLevel: 0.96 },
  },
  {
    id: "fulfillment-picking",
    threshold: 9, minEvidence: 2,
    signals: [[7, /\b(warehouse|fulfil(?:lment)?|pick(?:ing)?|inventory task)\b/i, "fulfillment-objects"], [6, /\b(scan|bin|aisle|tote|pack|confirm pick|substitut)\b/i, "picking-actions"], [4, /\b(batch|route|short pick|exception|quantity|remaining)\b/i, "fulfillment-states"]],
    hue: 42,
    dials: { energy: 0.48, warmth: 0.34, formality: 0.68, craft: 0.8, experimentalism: 0.12, motionIntensity: 0.12, materiality: 0.24, contentDensity: 0.88, layoutVariance: 0.18, trustLevel: 0.9 },
  },
  {
    id: "work-handoff-coordination",
    threshold: 9, minEvidence: 2,
    signals: [[7, /\b(project handoff|handoff workspace|shift handoff|work coordination|project workspace|team workspace|decision workspace|handoffs?)\b/i, "handoff-object"], [5, /\b(owner|dependency|decision|deadline|assignee)\b/i, "coordination-model"], [4, /\b(changed|next action|blocked|approve|transfer ownership|undo)\b/i, "handoff-actions-states"]],
    hue: 128,
    dials: { energy: 0.36, warmth: 0.42, formality: 0.68, craft: 0.84, experimentalism: 0.18, motionIntensity: 0.14, materiality: 0.24, contentDensity: 0.72, layoutVariance: 0.26, trustLevel: 0.88 },
  },
  {
    id: "api-reference-execution",
    threshold: 9, minEvidence: 2,
    signals: [[7, /\b(api reference|endpoint reference|developer reference|sdk reference)\b/i, "api-reference-object"], [6, /\b(request|response|schema|authentication|authorization|parameter|status code)\b/i, "api-contract"], [4, /\b(run example|copy|version|error response|try it)\b/i, "reference-actions-states"]],
    hue: 166,
    dials: { energy: 0.3, warmth: 0.24, formality: 0.76, craft: 0.86, experimentalism: 0.14, motionIntensity: 0.08, materiality: 0.16, contentDensity: 0.68, layoutVariance: 0.18, trustLevel: 0.94 },
  },
  {
    id: "cultural-collection-exploration",
    threshold: 9, minEvidence: 2,
    signals: [[7, /\b(museum|cultural collection|collection catalogue|digital collection)\b/i, "collection-object"], [6, /\b(artifact|object record|accession|provenance|creator|period|exhibition)\b/i, "collection-evidence"], [4, /\b(search|filter|browse|inspect|compare|related works)\b/i, "collection-actions"]],
    hue: 26,
    dials: { energy: 0.34, warmth: 0.58, formality: 0.66, craft: 0.94, experimentalism: 0.38, motionIntensity: 0.14, materiality: 0.52, contentDensity: 0.56, layoutVariance: 0.5, trustLevel: 0.86 },
  },
  {
    id: "grant-application-flow",
    threshold: 9, minEvidence: 2,
    signals: [[8, /\b(grant application|funding application|community grant|arts? grant)\b/i, "grant-workflow"], [6, /\b(eligibility|applicant|project budget|attachments?|funding request)\b/i, "grant-record"], [4, /\b(save|submit|review|confirmation|deadline|field error)\b/i, "application-actions-states"]],
    hue: 112,
    dials: { energy: 0.28, warmth: 0.58, formality: 0.72, craft: 0.86, experimentalism: 0.12, motionIntensity: 0.08, materiality: 0.18, contentDensity: 0.62, layoutVariance: 0.16, trustLevel: 0.94 },
  },
  {
    id: "process-control",
    threshold: 9, minEvidence: 2,
    signals: [[7, /\b(kiln|firing schedule|process control|thermal process|machine cycle)\b/i, "controlled-process"], [6, /\b(temperature|ramp|soak|setpoint|curve|zone|sensor)\b/i, "control-model"], [4, /\b(schedule|start|pause|alarm|deviation|complete)\b/i, "control-actions-states"]],
    hue: 28,
    dials: { energy: 0.42, warmth: 0.48, formality: 0.7, craft: 0.88, experimentalism: 0.18, motionIntensity: 0.16, materiality: 0.36, contentDensity: 0.76, layoutVariance: 0.22, trustLevel: 0.92 },
  },
  {
    id: "emergency-evacuation",
    threshold: 10, minEvidence: 2,
    signals: [[9, /\b(evacuation|wildfire emergency|emergency response|leave now|shelter in place)\b/i, "emergency-action"], [7, /\b(zone|route|shelter|road closure|alert|warning area)\b/i, "evacuation-objects"], [5, /\b(status|acknowledge|check in|depart|safe route|updated)\b/i, "evacuation-actions-states"]],
    hue: 18,
    dials: { energy: 0.62, warmth: 0.3, formality: 0.84, craft: 0.9, experimentalism: 0.08, motionIntensity: 0.08, materiality: 0.12, contentDensity: 0.74, layoutVariance: 0.14, trustLevel: 0.99, contrastPreference: 0.92 },
  },
  {
    id: "financial-planning-workspace",
    threshold: 9, minEvidence: 2,
    signals: [[8, /\b(budgeting workspace|budget planner|financial plan|household budget|operating budget|personal budgeting workspace|personal budget)\b/i, "planning-object"], [6, /\b(income|expense|transaction|category|account|allocation)\b/i, "financial-model"], [4, /\b(forecast|scenario|variance|adjust|reconcile|remaining)\b/i, "planning-actions-states"]],
    hue: 104,
    dials: { energy: 0.34, warmth: 0.36, formality: 0.72, craft: 0.86, experimentalism: 0.16, motionIntensity: 0.1, materiality: 0.2, contentDensity: 0.8, layoutVariance: 0.24, trustLevel: 0.94 },
  },
  {
    id: "guided-audio-session",
    threshold: 9, minEvidence: 2,
    signals: [[8, /\b(meditation audio|guided meditation|breathing session|guided audio|sleep session)\b/i, "guided-session"], [6, /\b(play|pause|duration|audio|track|progress|download)\b/i, "media-controls"], [4, /\b(routine|streak|resume|completed|offline|session)\b/i, "session-states"]],
    hue: 188,
    dials: { energy: 0.2, warmth: 0.62, formality: 0.42, craft: 0.9, experimentalism: 0.3, motionIntensity: 0.12, materiality: 0.42, contentDensity: 0.34, layoutVariance: 0.4, trustLevel: 0.82 },
  },
  {
    id: "procedural-execution",
    threshold: 9, minEvidence: 2,
    signals: [[8, /\b(lab protocol|laboratory protocol|clinical protocol|standard operating procedure|\bSOP\b)\b/i, "procedure-object"], [6, /\b(steps?|reagent|sample|specimen|timer|incubat|measurement)\b/i, "procedure-model"], [4, /\b(record|verify|deviation|complete|pause|resume|sign off)\b/i, "procedure-actions-states"]],
    hue: 152,
    dials: { energy: 0.3, warmth: 0.28, formality: 0.82, craft: 0.9, experimentalism: 0.1, motionIntensity: 0.08, materiality: 0.16, contentDensity: 0.78, layoutVariance: 0.16, trustLevel: 0.98 },
  },
  {
    id: "incident-operations",
    signals: [
      [9, /\b(incident workspace|incident response|on[- ]call engineer|active incident)\b/i, "incident-operations"],
      [5, /\b(service health|event timeline|logs|acknowledge|escalate)\b/i, "operations-model"],
      [3, /\b(observability|causal service path|ownership)\b/i, "observability"],
    ],
    hue: 164,
    dials: { energy: 0.36, warmth: 0.22, formality: 0.76, craft: 0.86, experimentalism: 0.2, motionIntensity: 0.18, materiality: 0.26, contentDensity: 0.88, layoutVariance: 0.24, trustLevel: 0.9 },
  },
  {
    id: "music-nightlife",
    signals: [[5, /\b(music|album|record|sound|dj|concert|nightlife|electronic|club|festival)\b/i, "music-subject"]],
    hue: 332,
    dials: { energy: 0.88, warmth: 0.32, formality: 0.28, craft: 0.8, experimentalism: 0.92, motionIntensity: 0.72, materiality: 0.72 },
  },
  {
    id: "earth-craft",
    signals: [[5, /\b(coffee|roaster|ceramic|pottery|clay|wood|craft|vessel|bakery|brew|atelier|studio)\b/i, "material-craft"]],
    hue: 34,
    dials: { energy: 0.54, warmth: 0.88, formality: 0.3, craft: 0.9, experimentalism: 0.46, motionIntensity: 0.35, materiality: 0.86 },
  },
  {
    id: "climate-civic",
    signals: [[5, /\b(climate|forest|ecology|sustainab|conservation|environment|field journal|nature|habitat|watershed)\b/i, "climate-civic"], [7, /\b(climate field journal|public conservation|watershed observations?|habitat evidence)\b/i, "civic-field-evidence"]],
    hue: 146,
    dials: { energy: 0.48, warmth: 0.68, formality: 0.58, craft: 0.86, experimentalism: 0.38, motionIntensity: 0.24, materiality: 0.62 },
  },
  {
    id: "technical-observability",
    signals: [[5, /\b(developer|api|sdk|observability|incident|infrastructure|database|code|documentation|docs|console|metrics|sre)\b/i, "technical-subject"]],
    hue: 164,
    dials: { energy: 0.34, warmth: 0.28, formality: 0.72, craft: 0.8, experimentalism: 0.24, motionIntensity: 0.2, materiality: 0.3 },
  },
  {
    id: "editorial-archive",
    signals: [[5, /\b(editorial|journal|archive|magazine|reporting|essay|fashion|art director|portfolio|gallery|exhibition)\b/i, "editorial-subject"]],
    hue: 18,
    dials: { energy: 0.48, warmth: 0.58, formality: 0.62, craft: 0.9, experimentalism: 0.72, motionIntensity: 0.3, materiality: 0.58 },
  },
];

function scoreSubjectProfiles(text) {
  return SUBJECT_PROFILES.map((profile) => {
    const evidence = profile.signals.filter(([, test]) => test.test(text)).map(([weight, , signal]) => ({ signal, weight }));
    return { profile, score: evidence.reduce((sum, item) => sum + item.weight, 0), evidence };
  }).filter(({ profile, score, evidence }) => {
    // A single generic noun ("workspace", "canvas", "console") is not
    // enough to claim a subject register. Strong profiles opt into their own
    // threshold/evidence contract; all other profiles need a meaningful
    // combined signal before they can steer the connected adapter.
    const threshold = profile.threshold ?? 5;
    const minEvidence = profile.minEvidence ?? 1;
    return score >= threshold && evidence.length >= minEvidence;
  })
    .sort((a, b) => b.score - a.score || SUBJECT_PROFILES.indexOf(a.profile) - SUBJECT_PROFILES.indexOf(b.profile));
}

function sourceText(input = {}) {
  return [input.sourceBrief, input.brief, input.prompt, input.description, input.subject, input.job, input.contentModel].filter(Boolean).join(" ");
}

export function connectedIntent(input = {}) {
  const raw = { ...input };
  const originalSurface = raw.surface;
  if (!raw.sourceBrief) raw.sourceBrief = sourceText(input);
  if (raw.surface != null) raw.surface = canonicalSurface(raw.surface, raw.sourceBrief);
  // Preserve the caller's descriptive surface for semantic routing. The
  // canonical enum is useful to the frozen engine, but dropping the original
  // phrase loses high-value nouns such as "warehouse picking" or "lab
  // protocol" before the subject profiles get a chance to score them.
  const text = sourceText({ ...raw, surface: originalSurface });
  const scored = scoreSubjectProfiles(`${originalSurface || ""} ${raw.surface || ""} ${text}`);
  const profile = scored[0]?.profile || null;
  const semantic = {
    selected: profile?.id || null,
    score: scored[0]?.score || 0,
    confidence: scored[0] ? Math.min(1, scored[0].score / 12) : 0,
    evidence: scored[0]?.evidence || [],
    candidates: scored.slice(0, 4).map(({ profile: candidate, score, evidence }) => ({ id: candidate.id, score, evidence: evidence.map((item) => item.signal) })),
  };
  if (!profile) return { intent: raw, profile: null, signals: [], semantic };
  const intent = { ...raw };
  for (const [key, value] of Object.entries(profile.dials)) {
    if (intent[key] == null) intent[key] = value;
  }
  if (intent.hue == null) intent.hue = profile.hue;
  return { intent, profile: profile.id, signals: Object.keys(profile.dials).concat("hue"), semantic };
}

const DISPLAY_GENRE_RULES = {
  // A technical/civic brief can still be distinctive, but its identity should
  // come from proportion, contrast, and composition—not a novelty script.
  "technical-observability": new Set(["blackletter", "script", "decorative"]),
  "climate-civic": new Set(["blackletter", "script", "decorative"]),
  "earth-craft": new Set(["blackletter", "decorative"]),
  "neutral-corporate": new Set(["blackletter", "script", "decorative", "display-other"]),
  "friendly-consumer": new Set(["blackletter"]),
  "creative-tool-workbench": new Set(["blackletter", "script", "decorative"]),
  "incident-operations": new Set(["blackletter", "script", "decorative"]),
  "civic-service-flow": new Set(["blackletter", "script", "decorative", "display-other"]),
  "research-evidence": new Set(["blackletter", "script", "decorative"]),
  "community-service-discovery": new Set(["blackletter", "script", "decorative", "display-other"]),
  "care-capacity-command": new Set(["blackletter", "script", "decorative", "display-other"]),
  "fulfillment-picking": new Set(["blackletter", "script", "decorative", "display-other"]),
  "work-handoff-coordination": new Set(["blackletter", "script", "decorative", "display-other"]),
  "api-reference-execution": new Set(["blackletter", "script", "decorative"]),
  "cultural-collection-exploration": new Set(["blackletter", "script", "decorative", "display-other"]),
  "grant-application-flow": new Set(["blackletter", "script", "decorative", "display-other"]),
  "process-control": new Set(["blackletter", "script", "decorative", "display-other"]),
  "emergency-evacuation": new Set(["blackletter", "script", "decorative", "display-other"]),
  "financial-planning-workspace": new Set(["blackletter", "script", "decorative", "display-other"]),
  "guided-audio-session": new Set(["blackletter", "script", "decorative"]),
  "procedural-execution": new Set(["blackletter", "script", "decorative", "display-other"]),
};

const DISPLAY_GENRE_PREFERENCES = {
  "music-nightlife": ["display-other", "script", "slab", "ornate-serif", "sans", "serif", "mono"],
  "earth-craft": ["ornate-serif", "slab", "display-other", "serif", "sans", "script", "mono"],
  "climate-civic": ["serif", "ornate-serif", "slab", "sans", "display-other", "mono"],
  "technical-observability": ["sans", "slab", "mono", "serif", "ornate-serif", "display-other"],
  "editorial-archive": ["ornate-serif", "serif", "display-other", "sans", "slab", "script", "mono"],
  "neutral-corporate": ["sans", "serif", "slab", "ornate-serif", "display-other", "mono"],
  "friendly-consumer": ["sans", "slab", "serif", "display-other", "script", "ornate-serif", "mono"],
  "creative-tool-workbench": ["sans", "mono", "slab", "serif", "display-other", "ornate-serif"],
  "incident-operations": ["sans", "mono", "slab", "serif", "ornate-serif", "display-other"],
  "civic-service-flow": ["sans", "serif", "slab", "ornate-serif", "mono"],
  "research-evidence": ["serif", "sans", "slab", "ornate-serif", "mono", "display-other"],
  "community-service-discovery": ["sans", "serif", "slab", "mono"],
  "care-capacity-command": ["sans", "mono", "slab", "serif"],
  "fulfillment-picking": ["sans", "mono", "slab", "serif"],
  "work-handoff-coordination": ["sans", "slab", "mono", "serif"],
  "api-reference-execution": ["sans", "mono", "slab", "serif"],
  "cultural-collection-exploration": ["serif", "sans", "slab", "ornate-serif", "mono"],
  "grant-application-flow": ["sans", "serif", "slab", "mono"],
  "process-control": ["sans", "mono", "slab", "serif"],
  "emergency-evacuation": ["sans", "slab", "mono", "serif"],
  "financial-planning-workspace": ["sans", "mono", "slab", "serif"],
  "guided-audio-session": ["sans", "serif", "slab", "ornate-serif", "mono"],
  "procedural-execution": ["sans", "mono", "slab", "serif"],
};

const UTILITY_FONT_RX = /wavefont|redacted|icon|symbol|emoji|dingbat|notdef|wingdings/i;
const BODY_SPECIALIST_FONT_RX = /\bsc\b|small\s*caps|stencil|outline|inline|icon|symbol|redacted|wavefont/i;
const DISPLAY_SPECIALIST_FONT_RX = /wavefont|redacted|icon|symbol|emoji|dingbat|notdef/i;
const LOCALE_SPECIFIC_FONT_RX = /\b(arabic|bengali|devanagari|gujarati|gurmukhi|hebrew|kannada|khmer|lao|malayalam|sinhala|tamil|telugu|thai)\b/i;
const CIVIC_TYPE_PROFILES = new Set(["community-service-discovery", "civic-service-flow", "grant-application-flow", "emergency-evacuation"]);

function fontName(font) { return String(font?.family || ""); }
function isUtilityFont(font) { return UTILITY_FONT_RX.test(fontName(font)); }
function isBodySpecialist(font) { return BODY_SPECIALIST_FONT_RX.test(fontName(font)); }
function isDisplaySpecialist(font, profileId) {
  if (DISPLAY_SPECIALIST_FONT_RX.test(fontName(font))) return true;
  if (profileId !== "music-nightlife" && /underline|linefont|wavefont|red\s*rose/i.test(fontName(font))) return true;
  return profileId !== "music-nightlife" && /stencil|outline|inline/i.test(fontName(font));
}

function localeSpecificMismatch(font, intent, profileId) {
  if (!CIVIC_TYPE_PROFILES.has(profileId)) return false;
  const script = fontName(font).match(LOCALE_SPECIFIC_FONT_RX)?.[1];
  if (!script) return false;
  const requested = [intent?.sourceBrief, ...(intent?.audience || []), ...(intent?.references || [])].filter(Boolean).join(" ");
  return !new RegExp(`\\b${script}\\b`, "i").test(requested);
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
  if (CIVIC_TYPE_PROFILES.has(profileId)) {
    const displayUsage = Number(fontSpaceEvidence(display)?.usage?.total || 0);
    const bodyUsage = Number(fontSpaceEvidence(body)?.usage?.total || 0);
    // Public-service type should be credible before it is novel. Observed use
    // is a bounded tie-breaker and never overrides the readability gates.
    score += Math.min(0.26, Math.log1p(displayUsage) * 0.035);
    score += Math.min(0.32, Math.log1p(bodyUsage) * 0.04);
  }
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
    .filter((candidate) => !isUtilityFont(candidate) && !isDisplaySpecialist(candidate, activeProfile) && !localeSpecificMismatch(candidate, intent, activeProfile));
  const bodyCandidates = engine.retrieveFonts({ role: "body", intent, n: 20, layoutAir, exclude: [...(exclusions.body || []), ...(exclusions.display || [])] })
    .filter((candidate) => shipworthyFont(candidate, "body"))
    .filter((candidate) => !isUtilityFont(candidate) && !isBodySpecialist(candidate) && !localeSpecificMismatch(candidate, intent, activeProfile));
  const valid = (candidateDisplay, candidateBody) => {
    if (!candidateDisplay || !candidateBody || candidateDisplay.family === candidateBody.family) return false;
    if (candidateDisplay.asset?.available === false || candidateBody.asset?.available === false) return false;
    if (forbidden?.has(engine.classifyFontGenre?.(candidateDisplay) || candidateDisplay.category)) return false;
    if (isUtilityFont(candidateDisplay) || isDisplaySpecialist(candidateDisplay, activeProfile) || isUtilityFont(candidateBody) || isBodySpecialist(candidateBody)) return false;
    if (localeSpecificMismatch(candidateDisplay, intent, activeProfile) || localeSpecificMismatch(candidateBody, intent, activeProfile)) return false;
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
  // The frozen genome can carry a deliberately expressive base face that is
  // useful for exploration but fails the connected readability contract (the
  // font-editor regression was Chivo Mono). Never let that fallback leak into
  // a shipped connected result when the vetted corpus has a readable role
  // candidate available.
  const safeDisplayFallback = displayCandidates.find((candidate) => candidate?.readabilityChecks?.displaySuitable !== false)
    || engine.retrieveFonts({ role: "display", intent, n: 48, exclude: exclusions.display || [] })
      .find((candidate) => shipworthyFont(candidate, "display") && !isUtilityFont(candidate) && !isDisplaySpecialist(candidate, activeProfile));
  const display = chosen?.display || safeDisplayFallback || (genome.type.display?.readabilityChecks?.displaySuitable === false ? displayCandidates[0] : genome.type.display);
  const safeBodyFallback = bodyCandidates.find((candidate) => candidate.family !== display?.family)
    || engine.retrieveFonts({ role: "body", intent, n: 48, exclude: [...(exclusions.body || []), ...(exclusions.display || [])] })
      .find((candidate) => candidate.family !== display?.family && shipworthyFont(candidate, "body") && !isUtilityFont(candidate) && !isBodySpecialist(candidate));
  const body = chosen?.body || safeBodyFallback || genome.type.body;
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

function boundedMechanism({ id, objects, actions, outcomes, states, proofId, proof, centrepieceId, centrepiece, terms, primary, mobile, reducedMotion }) {
  return {
    id, objects, actions, outcomes, states,
    proofObject: { id: proofId, description: proof, acceptance: ["the proof object exposes a meaningful initial state", "the primary action changes or verifies the named subject object", "loading, empty, success, and recoverable failure preserve context"] },
    centrepiece: { id: centrepieceId, kind: "functional-subject-instrument", description: centrepiece, subjectTerms: terms },
    interaction: { primary, keyboard: "all objects and actions follow a stable order with visible focus and no keyboard trap", touch: "the same action path uses labelled direct controls, generous targets, and no hover-only state", feedback: "selection, progress, success, failure, and recovery stay next to the affected object" },
    mobile, reducedMotion,
  };
}

const MECHANISM_MODELS = {
  "creative-tool-workbench": {
    id: "sequence-choreography",
    objects: ["stage preview", "time ruler", "layer tracks", "keyframes", "playhead", "property inspector", "easing curve", "export artifact"],
    actions: ["select a layer", "scrub the playhead", "move or add a keyframe", "change duration or easing", "preview the sequence", "export the result"],
    outcomes: ["the stage and timeline remain synchronized", "an edit produces visible feedback", "the exported format reflects the edited sequence"],
    states: ["ready", "layer-selected", "editing", "playing", "paused", "exporting", "export-complete", "recoverable-error"],
    proofObject: {
      id: "editable-sequence-proof",
      description: "a truthful editable sequence with a synchronized stage, timeline, inspector, and visible export result",
      acceptance: ["the playhead changes the preview", "at least one property can be edited", "keyboard and touch paths reach the same edit", "the export result names its real format"],
    },
    centrepiece: {
      id: "sequence-workbench",
      kind: "interactive-instrument",
      description: "the working stage + timeline + inspector loop, never a screenshot floating over a decorative field",
      subjectTerms: ["sequence", "timeline", "stage", "keyframe", "playhead"],
    },
    interaction: {
      primary: "scrub, select, edit, preview, and export one small sequence",
      keyboard: "arrow keys move the playhead; Enter selects; bracket or documented shortcuts adjust timing; every shortcut has a visible control",
      touch: "coarse time scrubber, large keyframe targets, and inspector sheets replace hover-only precision",
      feedback: "selection, edit, save/export, loading, and error feedback remain adjacent to the changed object",
    },
    mobile: "preserve a live stage, transport, and coarse timeline in one column; move the inspector into a bottom sheet and never replace the proof with a static phone mockup",
    reducedMotion: "disable autoplay and spatial flourishes; keep a user-controlled scrubber, stepped before/after frames, current-time readout, and instant state feedback",
    realizations: [
      { id: "stage-led", composition: "an oversized live stage owns the upper two-thirds; a full-width timeline forms the base and the inspector is a narrow rail", proofPlacement: "edit directly below the claim before feature copy", interactionEmphasis: "scrub the stage, then tune the selected keyframe", material: "dark editing field, crisp rails, one signal accent" },
      { id: "timeline-led", composition: "layer tracks and time ruler own the centre; the stage is a precise inset and property values live at the row edge", proofPlacement: "the first viewport opens inside the sequence rather than above it", interactionEmphasis: "drag timing relationships and see the inset update", material: "light drafting surface, dense rule system, selected lane in a committed accent" },
      { id: "curve-led", composition: "a large easing graph bridges keyframes; stage and timeline bookend it as synchronized evidence", proofPlacement: "the editable curve is the primary product proof", interactionEmphasis: "change an easing handle and compare motion/time values", material: "graph-paper precision without decorative grids outside the editor" },
      { id: "storyboard-led", composition: "sequence frames create a horizontal storyboard; the active frame expands into a stage with tracks beneath", proofPlacement: "the storyboard itself explains the choreography model", interactionEmphasis: "reorder frames, select one, then refine its timing", material: "paper-like frame tiles inside an otherwise flat tool shell" },
    ],
  },
  "incident-operations": {
    id: "incident-causal-path",
    objects: ["active incident", "service topology", "causal event timeline", "logs", "owner", "severity", "acknowledge action", "escalation path"],
    actions: ["trace the failure path", "inspect an event", "filter logs", "acknowledge ownership", "escalate with context", "resolve or reopen"],
    outcomes: ["the likely cause is legible", "ownership is unambiguous", "the next response action is recorded"],
    states: ["loading", "active-unowned", "active-owned", "escalating", "resolved", "empty", "recoverable-error"],
    proofObject: { id: "causal-incident-trace", description: "one active incident whose service path, event sequence, evidence, owner, and response action stay connected", acceptance: ["timeline events point to affected services", "acknowledge and escalate have confirmation/undo paths", "empty, error, and resolved states preserve context"] },
    centrepiece: { id: "causal-service-timeline", kind: "operational-instrument", description: "the causal service path fused with its event timeline, not a grid of interchangeable metric cards", subjectTerms: ["incident", "service", "timeline", "event", "cause"] },
    interaction: { primary: "move from event to service evidence, then acknowledge or escalate with context", keyboard: "timeline, logs, and actions have a stable tab order and non-color focus/state cues", touch: "events become a vertical trace with a persistent response tray", feedback: "ownership, action progress, success, failure, and undo remain visible on the incident" },
    mobile: "turn the causal path into a vertical trace; pin severity, owner, and response action while logs become an on-demand sheet",
    reducedMotion: "replace animated topology flow with static directional connectors and immediate state changes; never encode severity or causality through animation alone",
  },
  "civic-service-flow": {
    id: "eligibility-application",
    objects: ["eligibility explanation", "household record", "income record", "progress", "field evidence", "save-and-return receipt", "confirmation reference"],
    actions: ["check eligibility", "enter and review details", "resolve a field error", "save and return", "submit", "retain confirmation"],
    outcomes: ["the resident understands eligibility", "errors are recoverable without losing work", "submission produces a durable reference"],
    states: ["eligible", "possibly-eligible", "ineligible-with-next-step", "draft-saved", "field-error", "submitting", "confirmed", "service-error"],
    proofObject: { id: "recoverable-application-step", description: "a real application step showing plain-language eligibility, adjacent validation, saved progress, review, and confirmation continuity", acceptance: ["labels and errors remain associated", "progress has a textual equivalent", "save status and confirmation are durable and copyable"] },
    centrepiece: { id: "guided-application-step", kind: "trust-workflow", description: "the current question, its reason, and a recoverable answer path—not civic branding or decorative cards", subjectTerms: ["eligibility", "application", "question", "answer", "progress"] },
    interaction: { primary: "answer one understandable question, see why it is asked, and recover locally from a mistake", keyboard: "native controls, logical focus, error summary links, and no keyboard traps", touch: "single-column controls with generous targets and persistent save status", feedback: "validation appears beside the field and in a linked summary without clearing valid answers" },
    mobile: "one question group at a time with progress in text; keep Back, Save, and Continue reachable without hiding explanatory copy",
    reducedMotion: "use instant step changes with headings and focus management; progress never depends on animated transitions",
  },
  "research-evidence": {
    id: "neighbourhood-evidence-comparison",
    objects: ["five neighbourhoods", "sourced measurements", "comparison table", "map-like evidence", "methodology", "citation", "uncertainty range"],
    actions: ["compare places", "inspect a measurement", "trace a citation", "change the comparison view", "read methodology and uncertainty"],
    outcomes: ["differences are comparable without invented precision", "every claim remains traceable", "uncertainty remains visible"],
    states: ["overview", "neighbourhood-focused", "metric-compared", "source-open", "method-visible", "missing-data", "uncertainty-visible"],
    proofObject: { id: "sourced-neighbourhood-comparison", description: "one coordinated comparison across map, table, citations, and uncertainty with no invented values", acceptance: ["map and table share labels", "citation and method are reachable from every measurement", "missing and uncertain data are explicitly different"] },
    centrepiece: { id: "evidence-comparison-field", kind: "inspectable-evidence", description: "the five-place measurement comparison rendered as visual material, not a generic article hero", subjectTerms: ["measurement", "comparison", "neighbourhood", "evidence", "uncertainty"] },
    interaction: { primary: "focus a neighbourhood or metric and see the same selection in map, table, narrative, and source", keyboard: "comparison cells and evidence marks expose equivalent text and citations", touch: "map-like marks become a selectable list/table pair, never hover-only points", feedback: "selection, unavailable data, source state, and uncertainty have text and non-color cues" },
    mobile: "lead with a compact comparison and selectable place list; keep source and uncertainty attached to each value while the narrative follows",
    reducedMotion: "replace animated map transitions with immediate coordinated selection and preserve all comparison labels",
  },
  "community-service-discovery": {
    id: "community-resource-discovery",
    objects: ["services and resources", "availability", "event or program", "location and hours", "access details", "account state", "hold, registration, or visit action"],
    actions: ["search or browse", "filter by location, time, or access need", "inspect current availability", "place a hold or register", "plan a visit"],
    outcomes: ["a resident finds the right resource", "availability and access requirements are clear", "the resident can complete or plan the next action"],
    states: ["loading", "results", "no-results-with-recovery", "available", "unavailable", "waitlist", "held-or-registered", "closed", "service-error"],
    proofObject: {
      id: "live-resource-finder",
      description: "a truthful resource finder tying a result to current availability, location, access details, and a real hold, registration, or visit action",
      acceptance: ["result, availability, and next action stay attached", "hours and location are explicit", "no-results and unavailable states offer recovery", "account-required actions explain what happens before sign-in"],
    },
    centrepiece: {
      id: "resource-availability-finder",
      kind: "community-service-instrument",
      description: "a resource and program finder where availability, access, and the next civic action are inspectable—not a generic field map or municipal hero",
      subjectTerms: ["resource", "availability", "program", "location", "hold", "visit"],
    },
    interaction: {
      primary: "find one resource or program, verify availability and access, then hold, register, or plan a visit",
      keyboard: "search, filters, results, availability, and actions use native controls, visible focus, and a stable reading order",
      touch: "filters become a labelled sheet; result, availability, hours, and the action remain together with generous targets",
      feedback: "search progress, no results, availability changes, account requirements, confirmation, failure, and undo remain beside the resource",
    },
    mobile: "lead with search and the nearest useful results; keep availability, location, access, and the hold/register/visit action in each result before secondary description",
    reducedMotion: "use immediate filtering and state changes; do not animate map movement, availability, or event discovery, and preserve textual status updates",
  },
  "care-capacity-command": boundedMechanism({
    id: "care-capacity-allocation", objects: ["patient placement request", "bed", "ward", "care requirement", "occupancy", "cleaning or readiness state", "owner"], actions: ["triage a placement", "match care requirements", "assign or transfer a bed", "mark cleaning or ready", "escalate a blocked placement"], outcomes: ["the safest available placement is visible", "capacity and blockers are current", "ownership and the next action are explicit"], states: ["loading", "awaiting-placement", "available", "reserved", "occupied", "cleaning", "blocked", "transferring", "discharged", "system-error"],
    proofId: "live-bed-placement", proof: "one patient placement tied to care requirements, current ward capacity, bed readiness, ownership, and an assign or escalate action", centrepieceId: "bed-capacity-and-placement-board", centrepiece: "a bed-capacity and placement board where patient requirements, readiness, ownership, and allocation stay connected", terms: ["patient", "bed", "ward", "capacity", "readiness", "placement"], primary: "match one placement request to a safe available bed, assign it, and preserve escalation when no match exists", mobile: "lead with unplaced patients and safe matches; make ward capacity a drill-down and keep assign/escalate attached", reducedMotion: "use immediate status updates and static capacity/transfer cues; never animate patient movement as the only change signal",
  }),
  "fulfillment-picking": boundedMechanism({
    id: "guided-pick-fulfillment", objects: ["pick batch", "item", "bin and aisle", "required quantity", "tote", "scan result", "substitution or short-pick exception"], actions: ["open a batch", "follow the route", "scan a location and item", "confirm quantity", "record a short pick or substitution", "complete the tote"], outcomes: ["the correct item reaches the correct tote", "exceptions remain attributable", "batch progress is reliable"], states: ["loading", "ready", "at-location", "scan-valid", "scan-invalid", "short-pick", "substitution-needed", "batch-complete", "offline"],
    proofId: "scan-confirmed-pick", proof: "one pick task connecting item, bin, quantity, scan feedback, tote, and an exception-safe confirmation", centrepieceId: "guided-pick-path", centrepiece: "the current guided pick path with scan verification and a visible exception branch, not a generic inventory dashboard", terms: ["pick", "item", "bin", "scan", "quantity", "tote"], primary: "scan the assigned bin and item, confirm quantity into the tote, or record a recoverable exception", mobile: "show one pick at a time with bin, item, quantity, scan, and exception controls in thumb reach; keep batch context secondary", reducedMotion: "replace route animation with ordered steps and immediate scan feedback using text, sound-optional, and non-color cues",
  }),
  "work-handoff-coordination": boundedMechanism({
    id: "decision-handoff", objects: ["work item", "change", "decision", "owner", "deadline", "dependency", "next action", "history"], actions: ["review what changed", "resolve or request a decision", "assign ownership", "record a dependency", "handoff with context", "undo an edit"], outcomes: ["the next owner understands the change", "blocked dependencies and decisions are explicit", "the handoff is attributable and reversible"], states: ["unassigned", "in-review", "decision-needed", "blocked", "handed-off", "accepted", "complete", "edit-error"],
    proofId: "live-handoff-record", proof: "one work item combining its change, pending decision, owner, dependency, deadline, next action, and reversible history", centrepieceId: "decision-and-ownership-handoff", centrepiece: "the live decision-and-ownership handoff, not a grid of project summary cards", terms: ["change", "decision", "owner", "dependency", "handoff", "next action"], primary: "review the change, resolve or assign the decision, and transfer ownership with context and undo", mobile: "keep the current item, decision, owner, and next action together; collapse history and dependencies below", reducedMotion: "use immediate status feedback and preserve chronological history without animated reordering",
  }),
  "api-reference-execution": boundedMechanism({
    id: "request-response-contract", objects: ["endpoint", "method and path", "authentication", "parameters", "request example", "response schema", "status and error cases", "version"], actions: ["find an endpoint", "inspect parameters", "edit and run an example", "copy a request", "compare success and error responses", "verify version"], outcomes: ["the request can be formed correctly", "the response and failure contract are inspectable", "the example is versioned and reproducible"], states: ["ready", "editing-request", "running", "success-response", "error-response", "unauthorized", "rate-limited", "version-mismatch"],
    proofId: "runnable-api-example", proof: "one endpoint with editable inputs, an exact request, response schema, real status/error cases, and version context", centrepieceId: "endpoint-request-response-workbench", centrepiece: "a runnable endpoint request/response workbench rather than prose about an API", terms: ["endpoint", "request", "parameter", "response", "schema", "status"], primary: "edit one endpoint request, run or copy it, and inspect the matching response or error contract", mobile: "keep method/path, required inputs, run/copy, and response together; move navigation and secondary schemas into drawers", reducedMotion: "use immediate request state and static response diffs; never animate code or gate the response behind motion",
  }),
  "cultural-collection-exploration": boundedMechanism({
    id: "collection-provenance-exploration", objects: ["collection object", "image or media", "accession record", "creator and period", "provenance", "exhibition context", "related works"], actions: ["search or browse", "filter by collection facets", "inspect an object", "trace provenance", "compare related works", "save or share a record"], outcomes: ["an object is discoverable in collection context", "identity and provenance remain inspectable", "related exploration follows evidence"], states: ["index", "filtered", "object-focused", "provenance-open", "media-fallback", "missing-record", "saved"],
    proofId: "sourced-collection-object", proof: "one collection object whose media, accession identity, creator, period, provenance, exhibition context, and related works remain connected", centrepieceId: "collection-object-and-provenance", centrepiece: "the collection object and provenance record acting as one inspectable visual object, not a generic civic map", terms: ["object", "accession", "creator", "provenance", "exhibition", "collection"], primary: "focus one object, inspect its provenance and context, then follow an evidence-backed related work", mobile: "preserve object, identity, provenance, and related path in reading order; turn facets into a labelled sheet", reducedMotion: "remove spatial gallery transitions and keep objects in stable document order with explicit next/previous controls",
  }),
  "grant-application-flow": boundedMechanism({
    id: "grant-eligibility-and-submission", objects: ["grant program", "eligibility rule", "applicant", "project description", "project budget", "funding request", "attachment", "review and confirmation"], actions: ["check eligibility", "enter and save applicant/project details", "build the budget", "attach evidence", "review errors", "submit and retain confirmation"], outcomes: ["eligibility is understood before effort", "the application can be saved and recovered", "submission is complete, attributable, and confirmed"], states: ["possibly-eligible", "eligible", "ineligible-with-next-step", "draft-saved", "field-error", "review-ready", "submitting", "confirmed", "service-error"],
    proofId: "recoverable-grant-step", proof: "one grant step tying the eligibility reason, applicant answer, budget or attachment requirement, saved progress, adjacent errors, and review state together", centrepieceId: "grant-application-workflow", centrepiece: "the recoverable grant application workflow—not music imagery, event promotion, or celebratory decoration", terms: ["grant", "eligibility", "applicant", "budget", "attachment", "submission"], primary: "verify eligibility, complete one required application record, save it, and recover locally from an error", mobile: "show one coherent requirement group at a time with save status, errors, budget context, and Back/Continue reachable", reducedMotion: "use instant step changes with heading focus; progress, save, and errors never depend on transition animation",
  }),
  "process-control": boundedMechanism({
    id: "scheduled-process-control", objects: ["process run", "equipment", "setpoint curve", "current sensor value", "stage", "schedule", "alarm or deviation", "run record"], actions: ["review the schedule", "edit a bounded setpoint or stage", "start, pause, or stop safely", "acknowledge a deviation", "inspect the run record"], outcomes: ["the planned and actual process remain comparable", "unsafe deviations are visible", "control actions are attributable"], states: ["scheduled", "preflight", "ramping", "holding", "cooling", "paused", "alarm", "complete", "sensor-error"],
    proofId: "planned-versus-actual-run", proof: "one equipment run showing its stage schedule, setpoint curve, actual sensor values, safe controls, deviations, and immutable record", centrepieceId: "process-curve-and-stage-control", centrepiece: "the planned-versus-actual process curve fused with stage controls, not a tactile product photograph", terms: ["process", "stage", "setpoint", "sensor", "curve", "alarm"], primary: "inspect planned versus actual values, make a bounded control change, and acknowledge any deviation safely", mobile: "pin current stage, actual/setpoint, alarm, and safe pause; move curve detail and history below", reducedMotion: "use a static curve with immediate numeric/status updates; never imply safety or progress through animation alone",
  }),
  "emergency-evacuation": boundedMechanism({
    id: "evacuation-zone-to-action", objects: ["alert", "evacuation zone", "current location", "safe route", "road closure", "shelter", "update time", "check-in or departure action"], actions: ["identify the current zone", "verify the latest instruction", "choose a safe route or shelter", "acknowledge or check in", "share or print the plan"], outcomes: ["the resident knows whether to leave now", "the route and shelter reflect current closures", "status and instructions remain available under failure"], states: ["monitor", "warning", "leave-now", "shelter-in-place", "route-blocked", "shelter-full", "checked-in", "offline-stale", "all-clear"],
    proofId: "current-evacuation-plan", proof: "one current zone-specific evacuation plan tying instruction, safe route, closures, shelter capacity, update time, and check-in together", centrepieceId: "zone-instruction-and-safe-route", centrepiece: "the zone instruction and safe route acting as one emergency decision surface, never a scenic wildfire map", terms: ["zone", "instruction", "route", "closure", "shelter", "updated"], primary: "verify the zone instruction, choose a currently safe route or shelter, and record acknowledgement or check-in", mobile: "put instruction, zone, update time, route/closure, shelter, and check-in before all explanatory content; support print/offline", reducedMotion: "disable map movement and flashing; use static routes, text, patterns, and immediate status with assertive announcements for critical changes",
  }),
  "financial-planning-workspace": boundedMechanism({
    id: "budget-allocation-and-forecast", objects: ["account or income source", "expense category", "transaction", "allocation", "period", "remaining amount", "forecast scenario", "variance"], actions: ["categorize a transaction", "allocate an amount", "adjust a scenario", "compare planned and actual", "reconcile", "save or undo"], outcomes: ["every amount is attributable", "remaining money and tradeoffs are clear", "a scenario can change without corrupting actuals"], states: ["loading", "uncategorized", "allocated", "overspent", "underfunded", "scenario-active", "reconciled", "sync-error"],
    proofId: "live-budget-scenario", proof: "one budget period tying income, categorized transactions, allocations, remaining amounts, planned-versus-actual variance, and a reversible forecast change", centrepieceId: "allocation-and-forecast-ledger", centrepiece: "the allocation and forecast ledger where a changed amount visibly affects remaining money and variance", terms: ["income", "transaction", "category", "allocation", "remaining", "forecast"], primary: "allocate or recategorize one amount and verify its effect on remaining money and the forecast", mobile: "lead with remaining, urgent categories, and one reversible allocation; turn scenario and transaction detail into ordered sheets", reducedMotion: "update totals immediately with textual deltas; never animate money movement or use color alone for variance",
  }),
  "guided-audio-session": boundedMechanism({
    id: "guided-session-playback", objects: ["session", "duration", "audio chapters or cues", "playback position", "pace or voice option", "download state", "completion or resume state"], actions: ["choose a session", "play, pause, scrub, or skip a cue", "adjust pace or voice where supported", "download", "resume or complete"], outcomes: ["the user can understand and control the session before committing", "progress survives interruption", "offline and media failure have recovery"], states: ["ready", "playing", "paused", "buffering", "downloaded", "offline", "resume-available", "complete", "media-error"],
    proofId: "controllable-guided-session", proof: "one genuine guided session with duration, structured cues, playback controls, position, resume/download state, and media failure recovery", centrepieceId: "guided-session-player", centrepiece: "the calm, controllable guided-session player—not nightlife styling, an ambient orb, or decorative sound waves", terms: ["session", "duration", "cue", "playback", "resume", "download"], primary: "preview and control one session, interrupt it, and verify resume or offline behavior", mobile: "keep session title, duration, transport, current cue, and resume/download together; move supporting practice copy below", reducedMotion: "stop ambient breathing/visualizer animation; keep user-controlled audio, static cue progress, elapsed time, and instant feedback",
  }),
  "procedural-execution": boundedMechanism({
    id: "verified-protocol-run", objects: ["protocol version", "ordered step", "sample or specimen", "reagent or input", "quantity", "timer or condition", "measurement", "deviation record", "sign-off"], actions: ["verify version and prerequisites", "start a run", "record an input or measurement", "complete or pause a step", "record a deviation", "sign off"], outcomes: ["the correct procedure is followed in order", "inputs, measurements, and deviations are attributable", "the run record is reproducible"], states: ["draft", "ready", "in-progress", "timed-wait", "step-blocked", "deviation-open", "paused", "complete", "version-mismatch"],
    proofId: "live-protocol-step", proof: "one live protocol step tying version, sample, inputs, timer or condition, measurement, completion, deviation, and sign-off to the run record", centrepieceId: "protocol-step-and-run-record", centrepiece: "the current protocol step and immutable run record, not generic API documentation or an observability console", terms: ["protocol", "version", "sample", "step", "measurement", "deviation"], primary: "verify prerequisites, complete and record one step, and capture a deviation without losing the run context", mobile: "pin current step, sample identity, timer/condition, record action, and deviation; keep completed steps in a collapsed history", reducedMotion: "use immediate step/status changes and a static timer readout; never gate procedural instructions on animation",
  }),
  "music-nightlife": {
    id: "playable-release",
    objects: ["tracklist", "waveform", "playhead", "release artifact", "credits"],
    actions: ["play or pause", "scrub a track", "inspect credits", "choose a format"],
    outcomes: ["the release can be heard and understood before purchase"],
    states: ["ready", "playing", "paused", "buffering", "track-error"],
    proofObject: { id: "playable-track", description: "a playable sound object tied to its track, waveform, and credits", acceptance: ["transport works from keyboard and touch", "buffering and failure remain understandable without animation"] },
    centrepiece: { id: "track-driven-instrument", kind: "playable-media", description: "a playable sound object or track-driven visual instrument, not a decorative hero image", subjectTerms: ["track", "sound", "waveform", "release"] },
    interaction: { primary: "play, scrub, or select a track and reveal its sound-world context", keyboard: "native media controls plus visible track navigation", touch: "large transport and scrub targets without hover dependence", feedback: "current track, time, buffering, and error are textual as well as visual" },
    mobile: "keep the playable control and title together; move supporting credits below the first interaction",
    reducedMotion: "stop ambient visualizers and keep user-controlled audio transport plus a static waveform/time readout",
  },
  "earth-craft": {
    id: "material-origin-object",
    objects: ["tactile product", "origin", "material", "process", "maker note", "purchase or reservation"],
    actions: ["inspect material", "trace origin", "compare a variant", "purchase or reserve"],
    outcomes: ["craft and provenance justify the decision"],
    states: ["available", "variant-selected", "reserved", "sold-out", "media-fallback"],
    proofObject: { id: "origin-process-record", description: "one tactile object whose origin, material, and making process are inspectable", acceptance: ["provenance stays attached to the object", "the action reflects real availability"] },
    centrepiece: { id: "tactile-origin-object", kind: "material-proof", description: "one tactile object shown at deliberate scale, with its material story doing the visual work", subjectTerms: ["object", "material", "origin", "maker"] },
    interaction: { primary: "inspect one material or process detail before selecting a variant", keyboard: "variant and media controls have labels and focus", touch: "direct swipe/select alternatives have visible controls", feedback: "selection and availability appear beside the object" },
    mobile: "stack the object before its explanation and keep the primary action reachable after the first proof",
    reducedMotion: "replace rotation/reveal with selectable still views and preserve provenance",
  },
  "climate-civic": {
    id: "place-evidence-index",
    objects: ["places", "observations", "dates", "people", "evidence", "civic action"],
    actions: ["select a place", "filter observations", "inspect evidence", "take the next civic action"],
    outcomes: ["local evidence and the next action are legible together"],
    states: ["overview", "place-focused", "filtered", "missing-data", "action-ready"],
    proofObject: { id: "field-evidence-map", description: "a field map or living index tying places, observations, dates, and sources together", acceptance: ["map/list have equivalent access", "evidence is not hidden behind motion"] },
    centrepiece: { id: "field-instrument", kind: "evidence-map", description: "a field instrument—map, archive, or living index—that makes the subject legible at a glance", subjectTerms: ["place", "observation", "map", "evidence"] },
    interaction: { primary: "filter or focus one place and inspect its evidence", keyboard: "map marks have list equivalents and visible focus", touch: "selectable list and map controls replace hover", feedback: "filter and missing-data states remain explicit" },
    mobile: "preserve the evidence-first order, collapse secondary metadata, and keep the civic action visible",
    reducedMotion: "use immediate map/list selection and static directional cues",
  },
  "technical-observability": {
    id: "operational-state-decision",
    objects: ["status", "timeline", "query", "evidence", "owner", "recovery action"],
    actions: ["inspect state", "run a query", "trace evidence", "assign ownership", "recover"],
    outcomes: ["the main state and next decision are obvious"],
    states: ["loading", "healthy", "degraded", "failed", "recovering", "empty"],
    proofObject: { id: "operational-state", description: "one operational state with evidence, ownership, and a recovery action", acceptance: ["state is not encoded by color alone", "loading, empty, and error preserve the recovery path"] },
    centrepiece: { id: "operational-instrument", kind: "decision-surface", description: "a calm operational instrument that makes the main state or decision obvious before decoration appears", subjectTerms: ["status", "evidence", "owner", "recovery"] },
    interaction: { primary: "inspect evidence and take one reversible recovery action", keyboard: "dense regions and actions keep stable focus order", touch: "secondary columns become ordered detail sheets", feedback: "state change, error, and undo remain adjacent" },
    mobile: "collapse navigation first, preserve the primary state and action, and turn secondary columns into ordered sections",
    reducedMotion: "use immediate state feedback and static causality; no ambient operational animation",
  },
  "editorial-archive": {
    id: "inspectable-archive",
    objects: ["headline", "artifact", "provenance", "sequence", "quotation", "next reading path"],
    actions: ["inspect an artifact", "trace provenance", "move through the sequence"],
    outcomes: ["the archive's point of view and source remain legible"],
    states: ["index", "artifact-focused", "provenance-open", "media-fallback"],
    proofObject: { id: "sourced-artifact", description: "one real artifact with provenance and a deliberate sequence context", acceptance: ["artifact and provenance stay connected", "media fallback preserves identity and caption"] },
    centrepiece: { id: "subject-archive", kind: "sourced-artifact", description: "a subject-specific archive, image, or typographic statement that gives the page its point of view", subjectTerms: ["artifact", "archive", "provenance", "sequence"] },
    interaction: { primary: "focus an artifact and reveal its provenance or sequence context", keyboard: "archive order and captions remain navigable", touch: "explicit next/previous controls replace hover", feedback: "focus and media failure preserve captions" },
    mobile: "keep the opening statement and first artifact together, then preserve reading order over desktop choreography",
    reducedMotion: "remove scroll choreography and keep the archive in document order",
  },
  "neutral-corporate": {
    id: "evidence-backed-decision",
    objects: ["criteria", "evidence", "tradeoff", "choice", "next step"],
    actions: ["compare criteria", "inspect evidence", "choose", "continue"],
    outcomes: ["the decision is understandable and defensible"],
    states: ["ready", "choice-selected", "pending", "confirmed", "error"],
    proofObject: { id: "decision-comparison", description: "one comparison whose criteria, evidence, and tradeoffs remain visible beside the choice", acceptance: ["no plan is privileged by decoration alone", "selection and confirmation are non-color states"] },
    centrepiece: { id: "decision-proof", kind: "comparison", description: "the single comparison, decision, or proof object that earns trust for this brief", subjectTerms: ["comparison", "criteria", "evidence", "decision"] },
    interaction: { primary: "compare, select, and confirm without losing criteria", keyboard: "comparison and choice order stay logical", touch: "linear comparison preserves criteria near each option", feedback: "selection, progress, success, and error stay visible" },
    mobile: "make the decision path linear, with secondary detail below the primary choice",
    reducedMotion: "use immediate selection and confirmation states",
  },
  "technical-docs": {
    id: "task-reference",
    objects: ["task index", "runnable example", "API or configuration reference", "edge case", "version context"],
    actions: ["find a task", "run or copy the example", "verify inputs", "inspect an edge case"],
    outcomes: ["the task can be completed and verified"],
    states: ["ready", "copied", "version-mismatch", "example-error"],
    proofObject: { id: "runnable-reference-example", description: "a runnable example with inputs, output, and version context", acceptance: ["example and required inputs are visible together", "copy/run feedback and failure are explicit"] },
    centrepiece: { id: "reference-spine", kind: "navigable-reference", description: "a navigable reference spine that lets a developer find, understand, and verify one task quickly", subjectTerms: ["task", "example", "reference", "version"] },
    interaction: { primary: "find one task, run or copy its example, and verify the output", keyboard: "anchored navigation and copy/run controls are fully reachable", touch: "task title, example, and copy action stay together", feedback: "copy, run, version mismatch, and errors appear beside the example" },
    mobile: "keep the task title, example, and copy action together; move secondary navigation into an ordered drawer",
    reducedMotion: "remove animated navigation and preserve direct focus/anchor changes",
  },
  "project-workspace": {
    id: "owned-handoff",
    objects: ["project", "decision", "owner", "deadline", "dependency", "next action"],
    actions: ["inspect a change", "decide", "assign or hand off", "undo"],
    outcomes: ["ownership and the next decision are explicit"],
    states: ["unassigned", "in-progress", "blocked", "decided", "complete", "recoverable-error"],
    proofObject: { id: "live-handoff-record", description: "one live work item with change history, ownership, and a reversible next action", acceptance: ["change, owner, and decision remain attached", "edits expose success, failure, and undo"] },
    centrepiece: { id: "handoff-work-item", kind: "workflow-record", description: "a living handoff surface that shows what changed, who owns the next decision, and what can move now", subjectTerms: ["change", "owner", "decision", "handoff"] },
    interaction: { primary: "review a change, make or assign the decision, and keep undo available", keyboard: "record actions and history have stable focus", touch: "current item and next action remain pinned", feedback: "status, save, failure, and undo stay attached to the work item" },
    mobile: "collapse navigation first, keep the current work item and next action pinned, and order supporting context below",
    reducedMotion: "use immediate status feedback and preserve history without animated reordering",
  },
};

const GENERIC_MECHANISMS = {
  docs: { id: "task-reference", objects: ["task index", "runnable example", "reference", "edge case", "version"], actions: ["find a task", "run or copy the example", "verify inputs", "inspect an edge case"], outcomes: ["the task can be completed and verified"], states: ["ready", "copied", "version-mismatch", "example-error"], proof: "a runnable example with inputs, output, and version context", centrepiece: "reference-spine" },
  workflow: { id: "owned-handoff", objects: ["work item", "decision", "owner", "deadline", "dependency", "next action"], actions: ["inspect change", "make a decision", "assign or hand off", "undo an edit"], outcomes: ["ownership and the next decision are explicit"], states: ["unassigned", "in-progress", "blocked", "decided", "complete", "recoverable-error"], proof: "one live work item with change history, ownership, and a reversible next action", centrepiece: "handoff-work-item" },
  default: { id: "subject-decision-proof", objects: ["subject evidence", "criteria", "tradeoff", "primary action"], actions: ["inspect evidence", "compare a tradeoff", "take the primary action"], outcomes: ["the core claim or decision is verifiable"], states: ["ready", "loading", "empty", "success", "recoverable-error"], proof: "one subject-specific object that lets the user verify the core claim before acting", centrepiece: "subject-proof-object" },
};

const GENERIC_REALIZATIONS = [
  { id: "instrument-led", composition: "the proof instrument dominates; explanation and action form a restrained supporting rail", proofPlacement: "inside the opening view", interactionEmphasis: "act on the primary object", material: "flat functional field with one state accent" },
  { id: "evidence-led", composition: "evidence and provenance form the main column; the action sits beside the exact claim it resolves", proofPlacement: "before persuasion copy", interactionEmphasis: "inspect then decide", material: "quiet surfaces with rule-based grouping" },
  { id: "process-led", composition: "the object's states form a spatial sequence; the current state expands while history recedes", proofPlacement: "the state transition is the proof", interactionEmphasis: "advance, compare, and recover", material: "layered only where state or depth is real" },
  { id: "split-proof", composition: "input/control and outcome/proof share a hard split, with feedback crossing the seam", proofPlacement: "input and outcome remain simultaneously visible", interactionEmphasis: "change one input and verify one output", material: "contrasting work and result fields" },
];

const APP_WORKBENCH_FAMILY = LAYOUT_FAMILIES.find((family) => family.name === "app-shell-workbench");
const PROOF_STACK_FAMILY = LAYOUT_FAMILIES.find((family) => family.name === "asymmetric-proof-stack");

function mechanismLayoutOverride(profileId, realization = null) {
  if (profileId === "creative-tool-workbench" && APP_WORKBENCH_FAMILY) {
    const composition = {
      "stage-led": "stage-dominant-over-timeline-with-inspector-rail",
      "timeline-led": "timeline-dominant-with-live-stage-inset",
      "curve-led": "easing-curve-bridge-between-stage-and-timeline",
      "storyboard-led": "storyboard-strip-with-expanded-active-frame",
    }[realization?.id] || realization?.composition || "stage-dominant-over-timeline-with-inspector-rail";
    return {
      ...APP_WORKBENCH_FAMILY,
      family: APP_WORKBENCH_FAMILY.name,
      pageKind: "app",
      fit: 1,
      whenToUse: ["demonstrate-a-real-creative-tool", "create-and-edit", "prove-before-persuasion"],
      notFor: ["decorative-product-screenshot", "editorial-archive", "hero-only-launch"],
      requiredContent: ["editableSequence", "synchronizedStage", "timeline", "inspector", "exportResult", "pricing"],
      antiPatterns: ["generic-screenshot-over-gradient", "motion-as-decoration", "hero-band-above-the-proof", "fake-editor-shell"],
      mobileTransform: "live-stage-plus-coarse-timeline-inspector-sheet",
      sectionGrammar: [
        { role: "appbar", heightShare: 0.06, focalPoint: "left", composition: "product-identity-transport-and-primary-action" },
        { role: "workspace", heightShare: 0.54, focalPoint: "center", composition },
        { role: "inspector-panel", heightShare: 0.1, focalPoint: "right", composition: "selected-keyframe-values-and-export-proof" },
        { role: "features", heightShare: 0.14, focalPoint: "left", composition: "sequence-model-and-format-evidence" },
        { role: "pricing", heightShare: 0.1, focalPoint: "left", composition: "compact-transparent-plan-comparison" },
        { role: "footer", heightShare: 0.06, focalPoint: "left", composition: "shortcuts-formats-and-legal" },
      ],
      macro: { contentWidthShare: 0.98, columnCount: 12, splitRatio: realization?.id === "timeline-led" ? 0.64 : 0.74, alignment: "grid-led", whitespace: 0.24, contentDensity: 0.7 },
      materialSlots: ["workspace-surface", "panel-surface", "selection-accent"],
      optionalSections: [],
      swappableAdjacent: [["features", "pricing"]],
      provenance: "connected:creative-tool-proof-workbench-v1",
    };
  }
  if (profileId === "community-service-discovery" && PROOF_STACK_FAMILY) {
    const composition = {
      "instrument-led": "search-and-filters-over-resource-results-with-availability-rail",
      "evidence-led": "availability-and-access-matrix-with-results-as-supporting-index",
      "process-led": "find-verify-access-act-sequence-with-current-result-expanded",
      "split-proof": "search-results-left-availability-and-action-right",
    }[realization?.id] || "search-and-filters-over-resource-results-with-availability-rail";
    return {
      ...PROOF_STACK_FAMILY,
      family: PROOF_STACK_FAMILY.name,
      pageKind: "product-with-proof",
      fit: 1,
      whenToUse: ["discover-community-resources", "verify-availability", "complete-or-plan-access"],
      notFor: ["field-map-as-decoration", "municipal-hero-only", "generic-service-cards"],
      requiredContent: ["searchAndFilters", "resourceResults", "availability", "locationAndHours", "accessDetails", "nextAction"],
      antiPatterns: ["generic-civic-hero", "map-without-service-state", "cards-without-availability", "account-wall-before-explanation"],
      mobileTransform: "search-first-results-with-attached-availability-and-action",
      sectionGrammar: [
        { role: "nav", heightShare: 0.06, focalPoint: "left", composition: "service-identity-search-entry-and-account-state" },
        { role: "proof", heightShare: 0.46, focalPoint: "left", composition },
        { role: "features", heightShare: 0.16, focalPoint: "left", composition: "events-programs-and-resource-paths" },
        { role: "comparison", heightShare: 0.12, focalPoint: "center", composition: "location-hours-access-and-availability" },
        { role: "cta", heightShare: 0.12, focalPoint: "left", composition: "hold-register-contact-or-plan-visit" },
        { role: "footer", heightShare: 0.08, focalPoint: "left", composition: "emergency-accessibility-language-and-policy-links" },
      ],
      macro: { contentWidthShare: 0.92, columnCount: 6, splitRatio: realization?.id === "split-proof" ? 0.58 : 0.68, alignment: "left-led", whitespace: 0.34, contentDensity: 0.62 },
      materialSlots: ["proof-surface", "evidence-surface", "action-accent"],
      optionalSections: [],
      swappableAdjacent: [["features", "comparison"]],
      provenance: "connected:community-service-proof-layout-v1",
    };
  }
  return null;
}

function genericMechanismFor(intent) {
  if (intent?.surface === "docs") return GENERIC_MECHANISMS.docs;
  if (intent?.surface === "app" && intent?.contentModel === "workflow") return GENERIC_MECHANISMS.workflow;
  return GENERIC_MECHANISMS.default;
}

function specializeCommunityMechanism(model, intent) {
  const text = String(intent?.sourceBrief || "");
  if (/\b(library|catalog(?:ue)?|borrow|book|media|branch|hold)\b/i.test(text)) {
    return {
      ...model,
      id: "library-discovery-and-hold",
      objects: ["catalogue item", "format and audience filters", "branch availability", "library event or program", "hours and accessibility", "account state", "hold or visit action"],
      actions: ["search or browse the catalogue", "filter by format, age, or branch", "inspect branch availability", "place a hold", "discover an event", "plan a visit"],
      outcomes: ["a patron finds a useful item or program", "branch availability and access are clear", "the patron can place a hold or plan a visit"],
      proofObject: { ...model.proofObject, id: "catalogue-availability-proof", description: "a working catalogue result tied to format, branch availability, hours, accessibility, and a hold or visit action" },
      centrepiece: { ...model.centrepiece, id: "catalogue-and-program-finder", description: "a catalogue and program finder where branch availability, access, and hold or visit actions remain attached to the result", subjectTerms: ["catalogue", "branch", "availability", "program", "hold", "visit"] },
    };
  }
  if (/\b(recreation|community cent(?:er|re)|classes|facility|sports?|pool|court|workshop)\b/i.test(text)) {
    return {
      ...model,
      id: "community-program-registration",
      objects: ["class or program", "schedule", "facility", "space availability", "access and fee details", "registration", "visit information"],
      actions: ["browse programs", "filter by time, age, location, or access need", "inspect space availability", "register or join a waitlist", "plan a visit"],
      outcomes: ["a resident finds a suitable program", "space, schedule, cost, and access are clear", "registration or a visit can be completed"],
      proofObject: { ...model.proofObject, id: "program-availability-proof", description: "a real program result tying schedule, facility, remaining space, access, and registration together" },
      centrepiece: { ...model.centrepiece, id: "program-schedule-and-registration", description: "a program schedule where facility availability, access, registration, and waitlist state remain inspectable", subjectTerms: ["program", "schedule", "facility", "space", "registration", "waitlist"] },
    };
  }
  if (/\b(resource directory|support services?|provider|referral|food support|legal clinic|cooling cent(?:er|re)|shelter)\b/i.test(text)) {
    return {
      ...model,
      id: "community-support-directory",
      objects: ["service provider", "support category", "availability", "eligibility or access details", "location and hours", "language and accessibility", "contact or referral action"],
      actions: ["search support", "filter by need, location, language, or access", "verify availability", "inspect requirements", "contact or request a referral"],
      outcomes: ["a resident finds an appropriate service", "availability and requirements are clear", "contact or referral can proceed safely"],
      proofObject: { ...model.proofObject, id: "service-access-proof", description: "a verified service result tying current availability, requirements, location, language, accessibility, and contact together" },
      centrepiece: { ...model.centrepiece, id: "service-access-finder", description: "a support-service finder where availability, access requirements, and contact or referral stay attached", subjectTerms: ["service", "availability", "requirements", "location", "language", "referral"] },
    };
  }
  return model;
}

function specializeCreativeMechanism(model, intent) {
  const text = String(intent?.sourceBrief || "");
  if (/\b(font|typeface|glyph|kerning|variable axis)\b/i.test(text)) {
    return { ...boundedMechanism({
      id: "glyph-outline-editing",
      objects: ["glyph set", "selected glyph", "outline nodes and handles", "advance width and sidebearings", "kerning pair", "variable axis", "proof specimen", "font export"],
      actions: ["select a glyph", "move or add an outline node", "adjust metrics or kerning", "change a variable axis", "inspect the specimen", "undo and export"],
      outcomes: ["the edited glyph updates everywhere", "metrics and interpolation remain inspectable", "the exported font reflects the verified edit"],
      states: ["ready", "glyph-selected", "editing-outline", "editing-metrics", "previewing", "undo-available", "exporting", "export-complete", "invalid-outline"],
      proofId: "synchronized-glyph-edit", proof: "one editable glyph whose outline, metrics, kerning context, specimen preview, undo history, and exported font stay synchronized", centrepieceId: "glyph-canvas-and-specimen", centrepiece: "the working glyph canvas and live specimen connected by the selected outline and metrics—not a type specimen pretending to be an editor", terms: ["glyph", "outline", "node", "metrics", "kerning", "specimen"], primary: "edit one glyph outline or metric and verify the change in a live specimen before undo or export", mobile: "keep glyph selection, coarse node editing, metrics, and the live specimen available; move advanced axes and history into sheets", reducedMotion: "disable animated interpolation previews by default; keep explicit axis values, static before/after specimens, and instant edit feedback",
    }), realizations: [
      { id: "canvas-led", composition: "the glyph outline canvas dominates; glyph set and metrics form narrow rails while the proof specimen spans the base", proofPlacement: "the specimen updates beside the edited outline", interactionEmphasis: "move a node and verify contour plus metrics", material: "flat drafting field with selected nodes and handles as the only bright signal" },
      { id: "specimen-led", composition: "a large live specimen dominates; the selected glyph canvas is inset and metrics align beneath each context", proofPlacement: "the proof specimen is always visible during the edit", interactionEmphasis: "edit in context and compare strings", material: "paper-like specimen field beside a precise editor surface" },
      { id: "metrics-led", composition: "sidebearings, advance width, kerning, and axis values form the primary grid; canvas and specimen flank it", proofPlacement: "numeric and optical proof share one row", interactionEmphasis: "adjust a metric and compare before/after spacing", material: "measured rules only inside the font workbench" },
      { id: "glyph-set-led", composition: "the glyph set becomes an inspectable matrix; the active glyph expands into outline and specimen panes", proofPlacement: "coverage and consistency become visible before export", interactionEmphasis: "move between related glyphs and preserve the edit context", material: "dense flat glyph cells with one active-object surface" },
    ] };
  }
  return model;
}

export function deriveMechanismPlan(intent = {}, profileId = null, realizationIndex = 0) {
  const specific = MECHANISM_MODELS[profileId];
  const generic = genericMechanismFor(intent);
  const baseModel = specific || {
    ...generic,
    proofObject: { id: `${generic.id}-proof`, description: generic.proof, acceptance: ["proof is visible before the primary action", "loading, empty, success, and recoverable error states are defined"] },
    centrepiece: { id: generic.centrepiece, kind: "subject-proof", description: generic.proof, subjectTerms: String(intent.sourceBrief || "").toLowerCase().match(/[a-z][a-z-]{3,}/g)?.slice(0, 5) || ["subject"] },
    interaction: { primary: generic.actions.join(", "), keyboard: "all actions are reachable with visible focus and no trap", touch: "the same actions use direct controls with at least 44px targets", feedback: "loading, error, success, and undo feedback stay next to the affected object" },
    mobile: "keep the proof object before supporting explanation, linearize secondary detail, and preserve the primary action",
    reducedMotion: "remove ambient and entrance motion while preserving immediate state feedback and all information",
  };
  const model = profileId === "community-service-discovery"
    ? specializeCommunityMechanism(baseModel, intent)
    : profileId === "creative-tool-workbench"
      ? specializeCreativeMechanism(baseModel, intent)
      : baseModel;
  const realizations = model?.realizations || GENERIC_REALIZATIONS;
  const realization = realizations[((Number(realizationIndex) || 0) % realizations.length + realizations.length) % realizations.length];
  const validity = {
    centrepiecePresent: !!model.centrepiece?.id,
    proofPresent: !!model.proofObject?.id,
    mechanismComplete: [model.objects, model.actions, model.outcomes, model.states].every((items) => Array.isArray(items) && items.length > 0),
    presentationIsNotProof: true,
  };
  return {
    schemaVersion: "connected-mechanism-plan-v1",
    id: model.id,
    profile: profileId || "unprofiled",
    objects: [...model.objects],
    actions: [...model.actions],
    outcomes: [...model.outcomes],
    states: [...model.states],
    proofObject: { ...model.proofObject, acceptance: [...model.proofObject.acceptance] },
    centrepiece: { ...model.centrepiece, relevance: "subject-mechanism", status: validity.centrepiecePresent && validity.proofPresent ? "accepted" : "rejected" },
    interaction: { ...model.interaction },
    mobile: model.mobile,
    reducedMotion: model.reducedMotion,
    realization: { ...realization, mechanismId: model.id },
    validity: { ...validity, pass: Object.values(validity).every(Boolean) },
  };
}

function conceptCard(intent, profileId, engine, semantic = null, realizationIndex = 0) {
  const activeProfile = pairingProfile(engine, intent, profileId);
  const allowGenericSurfaceOverride = !profileId || ["technical-observability", "editorial-archive"].includes(profileId);
  const override = allowGenericSurfaceOverride && intent?.surface === "docs"
    ? SURFACE_CONCEPT_OVERRIDES.docs
    : allowGenericSurfaceOverride && intent?.surface === "app" && intent?.contentModel === "workflow"
      ? SURFACE_CONCEPT_OVERRIDES.workflow
      : null;
  const base = override || CONCEPT_CARDS[activeProfile] || CONCEPT_CARDS["editorial-archive"];
  const mechanismProfile = override?.profile || activeProfile;
  const mechanism = { ...deriveMechanismPlan(intent, mechanismProfile, realizationIndex), extraction: semantic };
  return {
    profile: activeProfile,
    sourceBrief: intent.sourceBrief || "",
    ...base,
    centrepiece: mechanism.centrepiece.description,
    subjectObjects: mechanism.objects.join(", "),
    interaction: mechanism.interaction.primary,
    mobile: mechanism.mobile,
    reducedMotion: mechanism.reducedMotion,
    semantic,
    mechanism,
    proofObject: mechanism.proofObject,
    realization: mechanism.realization,
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
    `- User actions: ${concept.mechanism?.actions?.join("; ") || "inspect and act on the subject"}.`,
    `- Outcomes: ${concept.mechanism?.outcomes?.join("; ") || "the core claim becomes verifiable"}.`,
    `- Required states: ${concept.mechanism?.states?.join(", ") || "ready, loading, empty, success, recoverable-error"}.`,
    `- Proof object: ${concept.proofObject?.description || "a visible subject-specific proof object"}.`,
    `- Interaction: ${concept.interaction}.`,
    `- Direction realization: **${concept.realization?.id || "instrument-led"}** — ${concept.realization?.composition || "let the proof instrument dominate"}.`,
    `- Mobile transform: ${concept.mobile}.`,
    `- Reduced motion: ${concept.reducedMotion || "remove ambient motion and preserve state feedback"}.`,
    `- Swap test: ${concept.swapTest}`,
    "",
    "The proof object and mechanism are mandatory. Type, colour, texture, and scroll treatments may present them but cannot replace them. Reject a build whose centrepiece is null, decorative, or still works after swapping the subject.",
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
    "- Before visual QA, resolve these families to licensed local font assets in the exact available format (WOFF2 or TTF), declare that format correctly with `@font-face`, and await `document.fonts.ready`; a generic fallback is a failure to validate the pairing, not a successful typography pass.",
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
    `- Functional centrepiece: **${expression?.centrepiece || "subject-proof-object"}**; proof object **${expression?.centrepiecePlan?.proofObjectId || genome?.connected?.v2?.proofObject || "must-be-defined"}**.`,
    `- Presentation treatment: **${expression?.presentationTreatment || "none"}**${treatments.length ? `; selected treatments: ${treatments.map((treatment) => treatment.id).join(", ")}` : ""}. This may present the mechanism but never replace it.`,
    `- Mobile fallbacks: ${Object.entries(expression?.responsive || {}).map(([id, value]) => `${id} → ${value}`).join("; ") || "normal flow"}.`,
    `- Reduced motion: ${Object.entries(expression?.reducedMotion || {}).map(([id, value]) => `${id} → ${value}`).join("; ") || "static by default"}.`,
    "- Keep one centrepiece, preserve native mobile scrolling, define reduced-motion behavior, and keep all type effects display-only. The catalogue is empirical guidance, not permission to stack effects.",
  ].join("\n");
}

function decorateDirections(engine, directions, intent, seed, profileId, semantic = null) {
  const usedDisplay = [];
  const usedBody = [];
  const usedAccent = [];
  return directions.map((direction, index) => {
    const concept = conceptCard(intent, profileId, engine, semantic, index);
    const enrichedIntent = { ...intent, mechanismPlan: concept.mechanism, directionRealization: concept.realization };
    const mechanismLayout = mechanismLayoutOverride(profileId, concept.realization);
    const baseGenome = mechanismLayout
      ? styleGenome(engine, enrichedIntent, { seed: hashToUint32(`${seed}:mechanism-layout:${index}`), layout: mechanismLayout })
      : direction.genome;
    const genomeWithType = typeVariant(engine, baseGenome, enrichedIntent, seed, index, profileId, { display: usedDisplay, body: usedBody });
    const paletted = applyConnectedPalette(engine, genomeWithType, enrichedIntent, seed, index);
    const genome = applyConnectedV2(engine, paletted, enrichedIntent, { seed: seed + index, profileId, excludeAccent: usedAccent });
    if (genome.type?.display?.family) usedDisplay.push(genome.type.display.family);
    if (genome.type?.body?.family) usedBody.push(genome.type.body.family);
    if (genome.type?.accent?.family) usedAccent.push(genome.type.accent.family);
    return {
      ...direction,
      genome: { ...genome, connected: { ...(genome.connected || {}), profile: profileId, source: "connected-intent-v2", semantic, concept, artDirection: concept.realization } },
      fingerprint: genome.fingerprint,
      mechanism: concept.mechanism,
      artDirection: concept.realization,
    };
  });
}

function fallbackLayoutFamilies(intent) {
  const surface = intent?.surface;
  const pageKinds = surface === "docs"
    ? new Set(["docs", "reading", "technical", "explain"])
    : surface === "app" || surface === "dashboard"
      ? new Set(["app", "dashboard", "data-admin", "technical"])
      : new Set(["product-with-proof", "landing", "marketing", "story", "editorial"]);
  return LAYOUT_FAMILIES.filter((family) => pageKinds.has(family.pageKind));
}

function connectedFallbackDirections(engine, intent, profileId, semantic, seed, requestedCount = 4) {
  const target = Math.max(2, Math.min(4, Number(requestedCount) || 4));
  const families = fallbackLayoutFamilies(intent);
  const fallback = [];
  for (let index = 0; index < target; index += 1) {
    const concept = conceptCard(intent, profileId, engine, semantic, index);
    const family = families[index % Math.max(1, families.length)];
    try {
      const genome = styleGenome(engine, {
        ...intent,
        mechanismPlan: concept.mechanism,
        directionRealization: concept.realization,
        // Keep the fallback in the frozen engine's compatible range while
        // retaining the subject dials and mechanism contract.
        layoutVariance: Math.max(0.38, Math.min(0.68, Number(intent.layoutVariance ?? 0.5))),
        contentDensity: Math.max(0.34, Math.min(0.72, Number(intent.contentDensity ?? 0.5))),
      }, { seed: hashToUint32(`${seed}:connected-fallback:${index}`), layout: family });
      if (genome) fallback.push({
        name: `${profileId || "connected"}-fallback-${index + 1}`,
        genome,
        warnings: ["connected-fallback-layout-family"],
        groundedIn: "connected-mechanism-model",
        retrieval: null,
      });
    } catch {
      // A family can reject a thin or unusually dense brief. Try the next
      // family rather than returning a dishonest empty exploration.
    }
  }
  return fallback;
}

function ensureAuthoredMechanismDirections(directions, profileId, requestedCount = 4) {
  const target = Math.max(2, Math.min(4, Number(requestedCount) || 4));
  if (!directions.length || directions.length >= target) return directions;
  const sourceCount = directions.length;
  const expanded = [...directions];
  while (expanded.length < target) {
    const source = directions[expanded.length % sourceCount];
    expanded.push({
      ...source,
      name: `${profileId}-authored-realization-${expanded.length + 1}`,
      warnings: [...(source.warnings || []), "connected-authored-mechanism-realization"],
      groundedIn: source.groundedIn || "connected-mechanism-model",
    });
  }
  return expanded;
}

export function connectedStyleGenome(engine, input = {}, options = {}) {
  const { intent, profile, signals, semantic } = connectedIntent(input);
  const seed = Number(options.seed ?? genomeSeed(genomeFromInput(intent)));
  const concept = conceptCard(intent, profile, engine, semantic, 0);
  const enrichedIntent = { ...intent, mechanismPlan: concept.mechanism, directionRealization: concept.realization };
  const mechanismLayout = mechanismLayoutOverride(profile, concept.realization);
  const typed = typeVariant(engine, styleGenome(engine, enrichedIntent, { ...options, layout: options.layout || mechanismLayout }), enrichedIntent, seed, 0, profile);
  const paletted = applyConnectedPalette(engine, typed, enrichedIntent, seed, 0);
  const genome = applyConnectedV2(engine, paletted, enrichedIntent, { seed, profileId: profile });
  return { ...genome, connected: { ...(genome.connected || {}), profile, signals, semantic, source: "connected-intent-v2", concept, mechanism: concept.mechanism, artDirection: concept.realization } };
}

export function connectedExploreDirections(engine, input = {}, options = {}) {
  const { intent, profile, signals, semantic } = connectedIntent(input);
  const seed = Number.isFinite(Number(options.seed)) ? Number(options.seed) : genomeSeed(genomeFromInput(intent));
  const target = Math.max(2, Math.min(4, Number(options.count ?? 4) || 4));
  const initial = exploreDirections(engine, intent, options);
  const fallback = initial.directions.length < target
    ? connectedFallbackDirections(engine, intent, profile, semantic, seed, target)
    : [];
  const explored = fallback.length >= Math.max(2, initial.directions.length)
    ? { ...initial, directions: fallback, warnings: [...(initial.warnings || []), "connected-authored-fallback-directions"] }
    : initial;
  const concept = conceptCard(intent, profile, engine, semantic, 0);
  const directionInputs = ensureAuthoredMechanismDirections(explored.directions, profile, target);
  const directions = decorateDirections(engine, directionInputs, intent, seed, profile, semantic).map((direction) => ({
    ...direction,
    genome: { ...direction.genome, connected: { ...(direction.genome.connected || {}), signals } },
  }));
  return { ...explored, directions, connected: { profile, signals, semantic, source: "connected-intent-v2", concept, mechanism: concept.mechanism } };
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
