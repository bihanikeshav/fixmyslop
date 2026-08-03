// tools.mjs — the engine instance + the shared tool catalog.
//
// One engine at module scope (data is bundled by wrangler/esbuild as JSON).
// The same tool definitions back BOTH the REST API and the MCP server, so
// behaviour never drifts between the two surfaces.

import { createEngine } from "../../engine/engine.mjs";
import { resolveIntent } from "../../engine/intent.mjs";
import { suggestLayout } from "../../engine/layout-families.mjs";
import { styleGenome } from "../../engine/genome.mjs";
import corpus from "../../engine/data/corpus.json" with { type: "json" };
import brands from "../../engine/data/brands.json" with { type: "json" };
import fonts from "../../engine/data/fonts.json" with { type: "json" };

export const engine = createEngine({ corpus, brands, fonts });
export const stats = { fonts: fonts.length, corpus: corpus.length, brands: brands.length };

// A small static set of layout archetypes. No engine call — this is design
// scaffolding meant to push away from the generic centered-hero SaaS template.
export const STRUCTURE_ARCHETYPES = [
  { name: "The Instrument", description: "A dashboard-like face where the primary content reads as a precision tool: dense readouts, monospace figures, live-looking gauges and dials framing the value prop." },
  { name: "The Editorial Grid", description: "A magazine layout — asymmetric multi-column grid, a strong masthead, pull quotes and captions. Type does the heavy lifting; imagery is incidental." },
  { name: "The Ledger", description: "Everything aligned to a visible accounting grid: ruled rows, right-aligned numerals, running totals. Communicates rigor and receipts over vibes." },
  { name: "Full-bleed Diagram", description: "The hero IS an explanatory schematic — an annotated system map or flow that bleeds edge to edge, with copy hung off callout lines." },
  { name: "Split-flap / Marquee", description: "A transit-board or ticker motif: fixed-width cells, mechanical updates, a horizontal band of moving information that anchors the page's identity." },
];

// Each tool: name, description, JSON-schema inputSchema, and a run() that calls
// the engine. run() receives a plain args object (parsed from query or body).
// Intent → palette options. Same `intent` string always yields the same palette
// (reproducible + grounded); no grounding at all → a genuinely fresh roll each call.
// Math.random is fine here — the tool layer, not the pure engine.
const hashStr = (s) => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const paletteOpts = (a) => {
  a = a || {};
  const seed = a.intent ? hashStr(String(a.intent)) : (a.seed != null ? Number(a.seed) : ((Math.random() * 0x7fffffff) >>> 0));
  return { hue: a.hue != null ? Number(a.hue) : null, energy: a.energy || "balanced", accent: a.accent || null, seed };
};

// StyleIntent input schema — shared by resolve_intent / style_genome / suggest_layout.
// The agent supplies whatever it can infer from the brief; the engine fills the rest.
const INTENT_PROPS = {
  surface: { type: "string", description: "landing-page | dashboard | docs | app | marketing | portfolio | pricing | editorial" },
  job: { type: "string", description: "the page's job, e.g. explain-and-convert, monitor, long-form." },
  audience: { type: "array", items: { type: "string" }, description: "who it's for." },
  contentModel: { type: "string", description: "e.g. product-with-proof, reference, gallery." },
  theme: { type: "string", enum: ["light", "dark"] },
  sourceBrief: { type: "string", description: "the original free-text brief, preserved verbatim." },
  variation: { type: "integer", description: "distance from the previous candidate (re-roll knob)." },
  seed: { type: "number", description: "reproducibility seed; omit for a fresh roll." },
  // continuous dials in [0,1] — set what you can infer; the engine fills the rest from surface/job priors.
  trustLevel: { type: "number" }, contentDensity: { type: "number" }, energy: { type: "number" },
  warmth: { type: "number" }, formality: { type: "number" }, era: { type: "number" },
  craft: { type: "number" }, experimentalism: { type: "number" }, motionIntensity: { type: "number" },
  layoutVariance: { type: "number" }, materiality: { type: "number" }, contrastPreference: { type: "number" },
};

export const TOOLS = [
  {
    name: "check_color",
    description: "Judge a single hex color for AI-slop: hard-banned framework defaults, overused corpus zones, brand clones. Returns a verdict (HARD-BANNED|OVERUSED|NEUTRAL-ok|SAFE), a slop score, OKLCH, the reason, and fresh alternatives when flagged.",
    inputSchema: {
      type: "object",
      properties: { hex: { type: "string", description: "Hex color, e.g. \"#6366f1\" or \"6366f1\"." } },
      required: ["hex"],
    },
    run: (a) => engine.checkColor(String(a.hex)),
  },
  {
    name: "check_palette",
    description: "Judge a full palette by role (ground/ink/accent/optional accent2). Flags each role, reports near-duplicate colors, the ink-on-ground contrast ratio, and an overall pass/fail with per-role fixes.",
    inputSchema: {
      type: "object",
      properties: {
        ground: { type: "string", description: "Background hex." },
        ink: { type: "string", description: "Text/foreground hex." },
        accent: { type: "string", description: "Primary accent hex." },
        accent2: { type: "string", description: "Optional secondary accent hex." },
      },
      required: ["ground", "ink", "accent"],
    },
    run: (a) => engine.checkPalette(a.ground, a.ink, a.accent, a.accent2),
  },
  {
    name: "suggest_fonts",
    description: "Suggest fresh, non-monoculture font families (off the AI avoid-list, away from top-tier popularity). Returns picks plus a {display, body} pairing. RULE: pairing.body is a readable text workhorse — use it for running/body text. NEVER set the display pick (or any novelty/display face) as body text; that is the single most common way an AI design becomes unreadable.",
    inputSchema: {
      type: "object",
      properties: {
        n: { type: "integer", description: "How many to return (default 6).", minimum: 1, maximum: 24 },
        category: { type: "string", description: "Optional filter: \"display\" or \"body\".", enum: ["display", "body"] },
      },
    },
    run: (a) => engine.suggestFonts(Number(a.n) || 6, { category: a.category || null }),
  },
  {
    name: "check_font",
    description: "Judge a font family. Returns FRESH | SLOP | SLOP-allowed-foundational | UNKNOWN, why, whether it is a foundational body workhorse, and fresh alternatives.",
    inputSchema: {
      type: "object",
      properties: { family: { type: "string", description: "Font family name, e.g. \"Inter\"." } },
      required: ["family"],
    },
    run: (a) => engine.checkFont(String(a.family)),
  },
  {
    name: "structure_ideas",
    description: "Return a small static list of distinctive page/layout archetypes (name + description) to steer a design away from the generic centered-hero SaaS template.",
    inputSchema: {
      type: "object",
      properties: { brief: { type: "string", description: "Optional design brief (currently advisory; the archetype list is static)." } },
    },
    run: (_a) => ({ archetypes: STRUCTURE_ARCHETYPES }),
  },
  {
    name: "resolve_intent",
    description: "Normalize a StyleIntent: clamp dials to [0,1], fill the ones you omit from surface/job design priors, flag contradictions, and derive a reproducible seed. You supply the semantics (read the brief); this validates them — pure math, no model. Returns { intent, seed, warnings }.",
    inputSchema: { type: "object", properties: INTENT_PROPS },
    run: (a) => resolveIntent(a || {}),
  },
  {
    name: "style_genome",
    description: "Resolve ONE coherent design direction from a StyleIntent: font pairing (neighbor-retrieved + readability-gated), palette (OKLCH corpus), layout family, material slots, and motion — each with provenance, plus a fingerprint. Pass recentFingerprints[] (from genomes already shown this session) so a re-roll diverges in composition, not just hue. This is the connected engine — one call per direction.",
    inputSchema: { type: "object", properties: { ...INTENT_PROPS, recentFingerprints: { type: "array", items: { type: "object" }, description: "fingerprints of genomes already shown this session, to diversify against." } } },
    run: (a) => styleGenome(engine, a || {}, { seed: a && a.seed, recentFingerprints: (a && a.recentFingerprints) || [] }),
  },
  {
    name: "suggest_layout",
    description: "Retrieve ranked LayoutGenome candidates for an intent — interpretable layout families (section grammar + macro + hierarchy + material slots) with whenToUse / notFor / requiredContent / antiPatterns. Filters by page kind + dials, so a dashboard never gets a centered-hero landing family. Returns several candidates, best first. Supersedes structure_ideas.",
    inputSchema: { type: "object", properties: { ...INTENT_PROPS, recentFingerprints: { type: "array", items: { type: "object" } } } },
    run: (a) => { const r = resolveIntent(a || {}); return suggestLayout(r.intent, { recentFingerprints: (a && a.recentFingerprints) || [] }); },
  },
  {
    name: "font_neighbors",
    description: "Retrieve fonts from the visual/feature neighbor space with a HARD readability gate by role: a body pick is always a legible text workhorse, NEVER a display-only face. Use `like` for 'more like X' (precomputed visual neighbors). Returns candidates with feature/visual distances, overuse penalty, and readability checks.",
    inputSchema: { type: "object", properties: {
      role: { type: "string", enum: ["display", "body"], description: "default display." },
      like: { type: "string", description: "a family to find visual neighbors of, e.g. \"Fraunces\"." },
      exclude: { type: "array", items: { type: "string" }, description: "families to avoid (e.g. already-used pairs)." },
      n: { type: "integer", minimum: 1, maximum: 24 },
    } },
    run: (a) => engine.retrieveFonts({ role: (a && a.role) || "display", like: (a && a.like) || null, exclude: (a && a.exclude) || [], n: Number(a && a.n) || 6 }),
  },
  {
    name: "design_system",
    description: "Generate a complete, coherent design token system grounded in the subject: gate-passing palette + modular type scale + spacing grid + radius scale + shadow ramp + motion + control sizing. GROUND the palette in the subject's REAL material via hue/energy/accent/intent — not a seed. Omit them all for a genuinely fresh roll.",
    inputSchema: { type: "object", properties: {
      baseFont: { type: "number", description: "Base body font px (default 18)." },
      baseUnit: { type: "number", description: "Spacing grid unit px (default 4)." },
      ratio: { type: "string", description: "Type-scale ratio name or number (default perfect-fourth)." },
      radiusBase: { type: "number", description: "Base corner radius px (default 8)." },
      hue: { type: "number", description: "Target accent hue 0–360 you derive from the subject's real material (terracotta ~40, forest ~150, ocean ~230). Grounds the palette." },
      energy: { type: "string", enum: ["muted", "balanced", "bold"], description: "Mood → accent saturation. Default balanced." },
      accent: { type: "string", description: "Anchor on an existing accent hex; nudged non-slop if needed." },
      intent: { type: "string", description: "Free-text material/energy, e.g. 'coffee roastery, warm, industrial'. Grounds it AND makes it reproducible; omit for a fresh roll." },
    } },
    run: (a) => engine.designSystem({ baseFont: a && a.baseFont, baseUnit: a && a.baseUnit, ratio: a && a.ratio, radiusBase: a && a.radiusBase, ...paletteOpts(a) }),
  },
  {
    name: "audit_system",
    description: "Audit a submitted token set across domains (type sizes, spacing values, radius values, shadow css, palette roles). Returns per-domain verdicts and an overall coherence score 0–100.",
    inputSchema: { type: "object", properties: {
      type: { type: "array", items: { type: "number" }, description: "Font sizes px." },
      spacing: { type: "array", items: { type: "number" }, description: "Spacing values px." },
      radius: { type: "array", items: { type: "number" }, description: "Radius values px." },
      shadow: { type: "string", description: "A CSS box-shadow value." },
      palette: { type: "object", description: "{ground, ink, accent, accent2?}." },
    } },
    run: (a) => engine.auditSystem(a || {}),
  },
  {
    name: "type_scale",
    description: "Generate a modular type scale from a base size and ratio. Returns [{step, px, rem}] (line-height/tracking come from the separate lineHeightFor/trackingFor helpers).",
    inputSchema: { type: "object", properties: {
      base: { type: "number", description: "Base px (default 16)." },
      ratio: { type: "string", description: "Ratio name or number (default 1.25)." },
      up: { type: "integer", description: "Steps up (default 5)." },
      down: { type: "integer", description: "Steps down (default 1)." },
    } },
    run: (a) => engine.typeScale(a || {}),
  },
  {
    name: "spacing_scale",
    description: "Generate a spacing scale on a base grid. Returns [{token, px, rem}].",
    inputSchema: { type: "object", properties: { base: { type: "number", description: "Grid unit px (default 4)." }, steps: { type: "integer", description: "How many steps (default 9)." } } },
    run: (a) => engine.spacingScale(a || {}),
  },
  {
    name: "radius_scale",
    description: "Generate a coherent corner-radius scale. Returns {none, sm, md, lg, xl, full}.",
    inputSchema: { type: "object", properties: { base: { type: "number", description: "Base radius px (default 8)." } } },
    run: (a) => engine.radiusScale(a || {}),
  },
  {
    name: "shadow",
    description: "Generate a layered, physically-plausible box-shadow for an elevation. Returns {css, layers}. Not the generic flat default.",
    inputSchema: { type: "object", properties: {
      elevation: { type: "number", description: "Elevation (0 = none, up to ~24)." },
      hue: { type: "number", description: "Optional hue in degrees to tint the shadow (default 0 = neutral black)." },
      alpha: { type: "number", description: "Top-layer alpha (default 0.18)." },
    }, required: ["elevation"] },
    run: (a) => engine.shadow(Number(a.elevation), { hue: a.hue || 0, alpha: a.alpha ?? 0.18 }),
  },
  {
    name: "layout",
    description: "Do the math for a layout: given viewport/base font/columns/split intent, returns a fitted grid, the optimal measure, a recommended split, and a `container` block. RULE: style your outer wrapper with container.maxWidth + container.paddingInline (margin auto). NEVER also cap width by grid.inner and re-add margin — inner already excludes margins, so re-adding them double-counts and breaks alignment. Use grid.template (fluid) unless you truly need fixed-px columns.",
    inputSchema: { type: "object", properties: {
      viewport: { type: "number", description: "Viewport width px (default 1440)." },
      baseFont: { type: "number", description: "Body font px (default 18)." },
      columns: { type: "integer", description: "Max columns cap." },
      split: { type: "string", description: "Split ratio name: golden|thirds|quarter|half." },
    } },
    run: (a) => engine.layout(a || {}),
  },
  {
    name: "generate_palette",
    description: "Generate a fresh, gate-passing palette {ground, ink, accent, accent2} grounded in the subject. Derive the accent from the subject's REAL material — pass a target `hue` and/or `energy`, an `accent` hex to anchor, or a free-text `intent`. Passes the slop gates and ≥4.5:1 contrast. No seed to manage — omit everything for a genuinely fresh roll.",
    inputSchema: { type: "object", properties: {
      hue: { type: "number", description: "Target accent hue 0–360 from the subject's real material (terracotta ~40, forest ~150, ocean ~230)." },
      energy: { type: "string", enum: ["muted", "balanced", "bold"], description: "Mood → accent saturation. Default balanced." },
      accent: { type: "string", description: "Anchor on an existing accent hex; nudged non-slop if needed." },
      intent: { type: "string", description: "Free-text material/energy, e.g. 'coffee roastery, warm'. Grounds + reproducible; omit for a fresh roll." },
    } },
    run: (a) => engine.generatePalette(paletteOpts(a)),
  },
  {
    name: "motion_tokens",
    description: "Return the motion vocabulary: tasteful ease-out curves, durations (fast/base/slow), and the exit-duration factor.",
    inputSchema: { type: "object", properties: {} },
    run: () => engine.motionTokens(),
  },
  {
    name: "check_type",
    description: "Audit a set of font sizes: flags too many sizes, muddy ratio, or an incoherent (non-modular) scale. Returns {verdict, reason, fix}.",
    inputSchema: { type: "object", properties: { sizes: { type: "array", items: { type: "number" }, description: "Font sizes px." } }, required: ["sizes"] },
    run: (a) => engine.auditTypeScale(a.sizes || []),
  },
  {
    name: "check_spacing",
    description: "Audit spacing values: flags off-grid values and one-off (non-reusable) spacing. Returns {verdict, reason, fix}.",
    inputSchema: { type: "object", properties: { values: { type: "array", items: { type: "number" } } }, required: ["values"] },
    run: (a) => engine.auditSpacing(a.values || []),
  },
  {
    name: "check_radius",
    description: "Audit corner radii: flags scale sprawl and (given pairs) broken concentric-corner nesting.",
    inputSchema: { type: "object", properties: {
      values: { type: "array", items: { type: "number" } },
      pairs: { type: "array", items: { type: "object" }, description: "[{outer, padding, inner}] to check concentricity." },
    }, required: ["values"] },
    run: (a) => engine.auditRadius(a.values || [], a.pairs || []),
  },
  {
    name: "check_shadow",
    description: "Audit a CSS box-shadow: flags the generic single-flat default, harsh pure-black alpha, and glow. Returns {verdict, reason, fix}.",
    inputSchema: { type: "object", properties: { css: { type: "string", description: "A CSS box-shadow value." } }, required: ["css"] },
    run: (a) => engine.auditShadow(String(a.css || "")),
  },
  {
    name: "check_layout",
    description: "Audit a layout: flags an out-of-range measure (line length) and off-grid gutters/margins.",
    inputSchema: { type: "object", properties: {
      containerWidth: { type: "number" }, fontPx: { type: "number" }, gutter: { type: "number" }, margin: { type: "number" }, base: { type: "number" },
    } },
    run: (a) => engine.auditLayout(a || {}),
  },
  {
    name: "check_motion",
    description: "Audit a motion spec: flags feedback durations over 500ms and bounce/elastic easing. Returns {verdict, reason, fix}.",
    inputSchema: { type: "object", properties: { durationMs: { type: "number" }, easing: { type: "string" } } },
    run: (a) => engine.auditMotion(a || {}),
  },
];

export const TOOL_BY_NAME = Object.fromEntries(TOOLS.map((t) => [t.name, t]));
