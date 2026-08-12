// tools.mjs — the engine instance + the shared tool catalog.
//
// One engine at module scope (data is bundled by wrangler/esbuild as JSON).
// The same tool definitions back BOTH the REST API and the MCP server, so
// behaviour never drifts between the two surfaces.

import { createEngine } from "../../engine/engine.mjs";
import { resolveIntent } from "../../engine/intent.mjs";
import { suggestLayout } from "../../engine/layout-families.mjs";
import { styleGenome } from "../../engine/genome.mjs";
import { exploreDirections } from "../../engine/explore.mjs";
import { connectedStyleGenome, connectedExploreDirections, connectedBuildSpec, CONNECTED_V2_STATUS } from "../../engine/connected.mjs";
import { validateSvg } from "../../engine/svg-guard.mjs";
import { auditMicrocopy, generateEmptyState, auditAccessibility, auditForm, checkComponentStates, checkInformationArchitecture } from "../../engine/ux.mjs";
import { renderPage } from "../../engine/build-page.mjs";
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
  sourceBrief: { type: "string", description: "the original free-text brief/subject, verbatim (e.g. 'a developer API platform / observability tool'). IMPORTANT: this drives type REGISTER — a technical/dev subject here keeps display type precise (slab/sans/mono) instead of defaulting to decorative/script faces. Aliases brief/prompt/description/subject are also accepted (with a warning)." },
  variation: { type: "integer", description: "distance from the previous candidate (re-roll knob)." },
  seed: { type: "number", description: "reproducibility seed; omit for a fresh roll." },
  // continuous dials in [0,1] — set what you can infer; the engine fills the rest from surface/job priors.
  trustLevel: { type: "number" }, contentDensity: { type: "number" }, energy: { type: "number" },
  warmth: { type: "number" }, formality: { type: "number" }, era: { type: "number" },
  craft: { type: "number" }, experimentalism: { type: "number" }, motionIntensity: { type: "number" },
  layoutVariance: { type: "number" }, materiality: { type: "number" }, contrastPreference: { type: "number" },
  accentMode: { type: "string", enum: ["auto", "always", "none"], description: "Connected v2 accent-face policy. Auto uses the subject/register gate; always requests a short accent face when the surface can support it; none withholds it." },
  texturePreference: { type: "string", enum: ["auto", "none", "paper-grain", "film-grain", "halftone", "dither", "mesh", "filtered-surface", "image-or-pattern-surface"], description: "Connected v2 surface texture policy. Texture remains density- and accessibility-gated." },
  expressionPreference: { type: "string", description: "Optional connected v2 treatment id, such as cursor-magnetic-action, asymmetric-split-pinning, grain-surface-overlay, outline-solid-type, or none. Compatibility gates still apply." },
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
    description: "Judge a full palette by role (ground/ink/accent/optional accent2/optional surface). Flags each role, reports near-duplicate colors, the ink-on-ground and accent-on-ground contrast ratios, the banned dark+neon combination (near-black ground + saturated accent — each hex can be individually legal), the surface-elevation step when a surface hex is passed, and an overall pass/fail with per-role fixes.",
    inputSchema: {
      type: "object",
      properties: {
        ground: { type: "string", description: "Background hex." },
        ink: { type: "string", description: "Text/foreground hex." },
        accent: { type: "string", description: "Primary accent hex." },
        accent2: { type: "string", description: "Optional secondary accent hex." },
        surface: { type: "string", description: "Optional card/panel elevation hex — validated as a distinct step above ground (excluded from the duplicate check)." },
      },
      required: ["ground", "ink", "accent"],
    },
    run: (a) => engine.checkPalette(a.ground, a.ink, a.accent, a.accent2, a.surface),
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
    description: "Judge a font family for freshness, repository-local asset availability, remote loadability, display/body role suitability, and safe use. Freshness alone never authorizes a font: asset.available means a repository asset exists; asset.remotelyLoadable must also be true before using loadSpec.faces from a remote response.",
    inputSchema: {
      type: "object",
      properties: { family: { type: "string", description: "Font family name, e.g. \"Inter\"." } },
      required: ["family"],
    },
    run: (a) => engine.checkFont(String(a.family)),
  },
  {
    name: "check_svg",
    description: "Strictly validate LLM-authored SVG markup before it enters a page. Requires a complete root, positive viewBox, finite geometry, unique references, no scripts/foreignObject/external URLs, and accessible semantics. Default kind is icon; raw illustrative SVG requires explicit provenance/allowIllustration.",
    inputSchema: {
      type: "object",
      properties: {
        svg: { type: "string", description: "Complete SVG markup." },
        kind: { type: "string", enum: ["icon", "chart", "illustration"], description: "What the SVG represents; default icon." },
        label: { type: "string", description: "Accessible label for informative SVGs." },
        allowIllustration: { type: "boolean", description: "Explicitly acknowledge reviewed illustration provenance; false by default." },
      },
      required: ["svg"],
    },
    run: (a) => validateSvg(a?.svg, { kind: a?.kind || "icon", label: a?.label || null, allowIllustration: a?.allowIllustration === true }),
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
    name: "dashboard_system",
    description: "Generate a deterministic dashboard specification with exact shell/region coordinates, column math, spacing, type roles, control density, relative surfaces, restrained background personality layers, reduced-motion behavior, and a manifest of real Fluid Functionalism registry components. This is the primary dashboard composition tool: use its geometry instead of eyeballing placement, then install the returned @fluid components instead of recreating them.",
    inputSchema: {
      type: "object",
      properties: {
        viewportWidth: { type: "number", minimum: 320, description: "Viewport width in px (default 1440)." },
        viewportHeight: { type: "number", minimum: 480, description: "Viewport height in px (default 900)." },
        density: { type: "string", enum: ["auto", "compact", "default"], description: "Fluid density context. Auto chooses from available width." },
        navigation: { type: "string", enum: ["sidebar", "rail", "top"], description: "Primary navigation form. Mobile always resolves to a drawer." },
        inspector: { type: "boolean", description: "Whether supporting detail context is needed; it docks only when the primary canvas remains wide enough." },
        content: { type: "string", enum: ["table", "analytics", "mixed", "workflow", "ai"], description: "Primary dashboard work model." },
        theme: { type: "string", enum: ["light", "dark"] },
        personality: { type: "string", enum: ["quiet", "balanced", "expressive"], description: "Controls background-only fades, faint patterns, and at most one ambient animation; never component anatomy." },
        primitive: { type: "string", enum: ["radix", "base"], description: "Choose Fluid's Radix or Base UI registry variants where available." },
        needs: { type: "array", items: { type: "string" }, description: "Additional Fluid registry item names, e.g. color-picker or input-copy." },
        base: { type: "number", enum: [4, 8], description: "Placement grid in px (default 4)." },
      },
    },
    run: (a) => engine.dashboardSystem(a || {}),
  },
  {
    name: "fluid_components",
    description: "Return install commands and direct registry URLs for genuine Fluid Functionalism components. The result is source provenance, not a style suggestion: functional dashboard controls must be installed from @fluid and must not be rebuilt as lookalikes. Includes Fluid surfaces, density context, and spring foundations.",
    inputSchema: {
      type: "object",
      properties: {
        preset: { type: "string", enum: ["core", "table", "analytics", "workflow", "ai"], description: "Dashboard component bundle." },
        primitive: { type: "string", enum: ["radix", "base"], description: "Use Radix (default) or Base UI siblings where Fluid publishes both." },
        needs: { type: "array", items: { type: "string" }, description: "Additional Fluid registry item names." },
      },
    },
    run: (a) => engine.fluidComponents(a || {}),
  },
  {
    name: "check_dashboard_layout",
    description: "Audit proposed dashboard coordinates and implementation provenance. Checks viewport bounds, 4/8px grid alignment, non-overlay region collisions, Fluid registry sourcing, component density, and decorative-layer limits. Returns a deterministic dashboard_system baseline when violations exist.",
    inputSchema: {
      type: "object",
      properties: {
        viewportWidth: { type: "number", minimum: 320 },
        viewportHeight: { type: "number", minimum: 480 },
        base: { type: "number", enum: [4, 8] },
        density: { type: "string", enum: ["compact", "default"] },
        regions: { type: "array", items: { type: "object" }, description: "[{id,x,y,width,height,parentId?,overlay?}] in viewport pixels. Only sibling regions with the same parentId are collision-checked." },
        components: { type: "array", items: { type: "object" }, description: "[{name,source,height?}]. Source must be fluid-functionalism-registry for functional controls." },
        personalityLayers: { type: "array", items: { type: "object" }, description: "[{id,opacity,pointerEvents}]. At most two, opacity <= .08, pointerEvents none." },
      },
      required: ["regions", "components"],
    },
    run: (a) => engine.checkDashboardLayout(a || {}),
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
    name: "explore_directions",
    description: "Produce FOUR genuinely divergent design directions from ONE StyleIntent in ONE call — the corpus-grounded direction explorer (spec: docs/layout-explorer-spec.md §4). 3 directions are corpus-grounded (distinct layout families, greedily chosen for maximum divergence, each perturbed); 1 is engine-synthesized (a blend of two families' macro stance). Each direction spreads layout family, font pairing, AND palette hue, and passes a within-set divergence gate (falling back to a bounded reroll, noted in `warnings` when the floor is relaxed). Pass recentFingerprints[] from genomes already shown this session to diversify against those too. Returns { directions:[{name,genome,fingerprint,fit,provenance,groundedIn,parents?}×count], warnings }. Supersedes manually looping style_genome 4×.",
    inputSchema: { type: "object", properties: {
      ...INTENT_PROPS,
      recentFingerprints: { type: "array", items: { type: "object" }, description: "fingerprints of genomes already shown this session, to diversify against." },
      count: { type: "integer", description: "how many directions (default 4 = 3 corpus-grounded + 1 engine-synthesized).", minimum: 1, maximum: 8 },
    } },
    run: (a) => exploreDirections(engine, a || {}, { seed: a && a.seed, recentFingerprints: (a && a.recentFingerprints) || [], count: (a && a.count) || 4 }),
  },
  {
    name: "connected_style_genome",
    description: "One-shot subject-connected design direction. Canonicalizes brief aliases, grounds palette/layout/type dials in the actual subject, chooses a deterministic display/body pair plus an optional v2 accent face, and returns color-scene, texture, component-personality, button/shadow, cursor/scroll, mobile, and reduced-motion decisions while preserving all core gates.",
    inputSchema: { type: "object", properties: { ...INTENT_PROPS, recentFingerprints: { type: "array", items: { type: "object" }, description: "fingerprints of genomes already shown this session, to diversify against." } } },
    run: (a) => connectedStyleGenome(engine, a || {}, { seed: a && a.seed, recentFingerprints: (a && a.recentFingerprints) || [] }),
  },
  {
    name: "connected_explore_directions",
    description: "One-shot subject-connected direction set. Produces the engine's bounded 2–4 direction set, then applies subject-register font pairing, optional accent faces, material/component personality, and bounded expression treatments to every direction. Use this for deliberate alternatives; thin corpus pools remain honestly reported in warnings.",
    inputSchema: { type: "object", properties: {
      ...INTENT_PROPS,
      recentFingerprints: { type: "array", items: { type: "object" }, description: "fingerprints of genomes already shown this session, to diversify against." },
      count: { type: "integer", description: "requested directions (default 4; the engine may return fewer for a thin family pool).", minimum: 1, maximum: 8 },
    } },
    run: (a) => connectedExploreDirections(engine, a || {}, { seed: a && a.seed, recentFingerprints: (a && a.recentFingerprints) || [], count: (a && a.count) || 4 }),
  },
  {
    name: "connected_build_spec",
    description: "Build one complete subject-connected genome and markdown implementation spec in one call. The spec includes display/body/accent font roles, color-scene and texture decisions, button/shadow personality, one bounded expression centrepiece, and mobile/reduced-motion fallbacks.",
    inputSchema: { type: "object", properties: { ...INTENT_PROPS, recentFingerprints: { type: "array", items: { type: "object" } } } },
    run: (a) => connectedBuildSpec(engine, a || {}, { seed: a && a.seed, recentFingerprints: (a && a.recentFingerprints) || [] }),
  },
  {
    name: "connected_v2_catalog",
    description: "Report the connected v2 research catalog currently wired into the MCP: font-space entries, candidate pair records, component dialects, expression treatments, texture dialects, interaction states, and human-validation status. This is an audit/status tool, not a design direction.",
    inputSchema: { type: "object", properties: {} },
    run: () => CONNECTED_V2_STATUS,
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
    name: "fix_spacing",
    description: "The spacing FIXER (check_spacing only flags — this repairs). Snaps arbitrary padding / margin / gap / size values to a canonical 4px (or 8px) grid, collapses near-duplicates onto ONE shared token (13/15/17 → 16 = s4), and returns a before→after map so you can rewrite a component's box model to the grid. Pass a flat `values` list AND/OR named `components` (e.g. {button:{paddingX:15,paddingY:9,gap:7}, card:{padding:20,gap:13}}). Returns {verdict, base, scale, usedTokens, values:[{from,to,token,changed}], components:{…}, changed}.",
    inputSchema: { type: "object", properties: {
      values: { type: "array", items: { type: "number" }, description: "Flat px values to snap." },
      components: { type: "object", description: "Named box models, e.g. {\"button\":{\"paddingX\":15,\"gap\":7}} — each numeric prop is snapped." },
      base: { type: "number", enum: [4, 8], description: "Grid base px (default 4)." },
    } },
    run: (a) => engine.normalizeSpacing({ values: (a && a.values) || [], components: (a && a.components) || {}, base: (a && a.base) || 4 }),
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
  {
    name: "check_composition",
    description: "Audit a section-grammar layout ([{role, heightShare, focalPoint?, composition?}], top→bottom) for the STRUCTURAL failures that read as 'unbalanced/ugly' even when tokens are clean. SLOP: trapped whitespace (heightShares under-tile the page → unallocated vertical space) and one block swallowing >80%. Advisory: monotonous rhythm (repeated composition / single focal side). It deliberately does NOT judge focal dominance by heightShare (height ≠ visual weight — an app canvas or equal narrative bands are fine; verify the real focal point with a render-level blur/squint test). Returns {verdict, issues, advisories, centrepiece}.",
    inputSchema: { type: "object", properties: {
      sectionGrammar: { type: "array", items: { type: "object" }, description: "[{role, heightShare (0-1), focalPoint?, composition?}], ordered top to bottom." },
      pageKind: { type: "string", description: "e.g. marketing | dashboard | story | app — currently advisory context." },
    }, required: ["sectionGrammar"] },
    run: (a) => engine.checkComposition((a && a.sectionGrammar) || [], { pageKind: (a && a.pageKind) || "marketing" }),
  },
  {
    name: "shade_ramp",
    description: "Generate an even-lightness OKLCH shade ramp (a 50→950-style scale) for ONE hue — the primitive tier a full design system needs beyond the 5 palette roles (layered surfaces, text levels, semantic scales). Chroma tapers at the light/dark ends so they read as tints, and every step is pulled into gamut. Omit hue for a near-neutral gray ramp. Returns [{step, hex, L, C, H}].",
    inputSchema: { type: "object", properties: {
      hue: { type: "number", description: "Hue 0-360 from the subject's material; omit for a neutral gray ramp." },
      steps: { type: "integer", description: "Number of steps (default 9).", minimum: 2, maximum: 15 },
      chroma: { type: "number", description: "Peak chroma mid-ramp (default 0.09 with a hue, 0.012 for neutral)." },
    } },
    run: (a) => engine.shadeRamp(a && a.hue != null ? Number(a.hue) : null, { steps: a && a.steps != null ? Number(a.steps) : 9, chroma: a && a.chroma != null ? Number(a.chroma) : null }),
  },
  {
    name: "semantic_colors",
    description: "Generate functional status colors {error, success, warning, info} anchored to fixed perceptual hues (error ~25, success ~145, warning ~75, info ~205 — kept below the banned indigo band), each nudged a few degrees toward the brand accent so they read as part of THIS system, and each gated non-slop. Pass the palette's accent hue and energy.",
    inputSchema: { type: "object", properties: {
      accentHue: { type: "number", description: "Brand accent hue 0-360 to nudge toward; omit for the canonical hues." },
      energy: { type: "string", enum: ["muted", "balanced", "bold"], description: "Chroma level; default balanced." },
    } },
    run: (a) => engine.semanticColors(a && a.accentHue != null ? Number(a.accentHue) : null, (a && a.energy) || "balanced"),
  },
  {
    name: "audit_microcopy",
    description: "Audit UI copy for slop, per item. Pass items:[{kind, text}] where kind ∈ button|error|empty|label|heading|text|celebration. Flags: vague CTAs that name a mechanism not an outcome, error messages that blame the user / expose jargon / give no recovery action, dead-end empty states, ALL-CAPS shouting, forced exclamation marks, filler 'please'. Returns per-item {verdict, issues}.",
    inputSchema: { type: "object", properties: {
      items: { type: "array", items: { type: "object", properties: { kind: { type: "string" }, text: { type: "string" } } }, description: "[{kind, text}] UI copy strings to judge." },
    }, required: ["items"] },
    run: (a) => auditMicrocopy((a && a.items) || []),
  },
  {
    name: "generate_empty_state",
    description: "Generate a proper three-layer empty state (headline / one-sentence explanation of value / single primary action) instead of a bare 'No data'. Pass the object name and optionally the reason (first-run | no-results | cleared) and an action label. Returns {headline, explanation, cta, layers}.",
    inputSchema: { type: "object", properties: {
      object: { type: "string", description: "The collection that's empty, e.g. \"projects\", \"invoices\"." },
      reason: { type: "string", enum: ["first-run", "no-results", "cleared"], description: "Why it's empty; default first-run." },
      actionLabel: { type: "string", description: "Override the primary CTA label (default \"Create <singular>\")." },
    }, required: ["object"] },
    run: (a) => generateEmptyState({ object: (a && a.object) || "items", reason: (a && a.reason) || "first-run", actionLabel: (a && a.actionLabel) || null }),
  },
  {
    name: "audit_accessibility",
    description: "Audit accessibility BEYOND color contrast, from a structured descriptor (not raw HTML). Pass interactive:[{type, size(px), focusVisible, accessibleName, role}], plus reducedMotion(bool), landmarks(bool), imagesMissingAlt(number). Flags: touch targets < 44px, missing focus indicators, icon-only controls with no accessible name, clickable <div>s, no reduced-motion path, missing alt text, missing landmarks. Returns {verdict, issues}.",
    inputSchema: { type: "object", properties: {
      interactive: { type: "array", items: { type: "object" }, description: "[{type, size, focusVisible, accessibleName, role}] for each interactive element." },
      reducedMotion: { type: "boolean", description: "Is a prefers-reduced-motion path implemented?" },
      landmarks: { type: "boolean", description: "Are semantic landmarks (header/nav/main/footer) present?" },
      imagesMissingAlt: { type: "number", description: "Count of images without alt text." },
    } },
    run: (a) => auditAccessibility(a || {}),
  },
  {
    name: "audit_form",
    description: "Audit a form's UX. Pass fields:[{name, labelPlacement, label, placeholder, required, markedOptional}], columns(number), validation(onkeystroke|onblur|onsubmit-only). Flags: multi-column linear forms, placeholder-as-label, unmarked optional fields, non-top-aligned labels, keystroke-nagging or submit-only validation. Returns {verdict, issues}.",
    inputSchema: { type: "object", properties: {
      fields: { type: "array", items: { type: "object" }, description: "[{name, labelPlacement, label, placeholder, required, markedOptional}]." },
      columns: { type: "number", description: "Number of columns (default 1)." },
      validation: { type: "string", description: "Validation timing: onkeystroke | onblur | onsubmit-only." },
    } },
    run: (a) => auditForm(a || {}),
  },
  {
    name: "check_component_states",
    description: "Check a component's interaction-state matrix for completeness. Required: resting, hover, active, focus, disabled. An async control (async:true) also needs loading, error, success. Pass the states you've defined; returns what's missing so incomplete controls don't ship.",
    inputSchema: { type: "object", properties: {
      component: { type: "string", description: "Component name, e.g. \"primary-button\"." },
      states: { type: "array", items: { type: "string" }, description: "States you've defined, e.g. [\"resting\",\"hover\",\"focus\"]." },
      async: { type: "boolean", description: "Does it trigger async work (needs loading/error/success)?" },
    }, required: ["states"] },
    run: (a) => checkComponentStates({ component: (a && a.component) || "control", states: (a && a.states) || [], async: (a && a.async) === true }),
  },
  {
    name: "check_information_architecture",
    description: "Audit navigation/menu IA against Hick's and Miller's laws. Pass items:[{label, children?}] (or a string array). Flags: more than ~7 top-level items, duplicate labels, vague/jargon labels (Solutions, Platform, Hub, Resources…), and groups with too many children to chunk. Returns {verdict, issues}.",
    inputSchema: { type: "object", properties: {
      items: { type: "array", items: {}, description: "Top-level nav items: strings or {label, children:[…]}." },
    }, required: ["items"] },
    run: (a) => checkInformationArchitecture({ items: (a && a.items) || [] }),
  },
  {
    name: "build_page",
    description: "The genome → coded page path. Resolves ONE subject-grounded design direction (like style_genome) and RENDERS it as a single self-contained, gate-passing HTML page — the engine's decisions as real code, not a markdown spec. The output emits <!doctype html> + <meta charset=\"utf-8\">, styles the wrapper with container tokens (no double-counted margin), keeps neutrals dominant and the accent scarce (one primary CTA), makes one hero dominant, ships all core content in markup, and includes a prefers-reduced-motion path. Content is professional SCAFFOLD keyed to the section grammar — swap in real copy; the shell is non-slop by construction. Returns { html, genome:{family, fonts, palette}, fingerprint }.",
    inputSchema: { type: "object", properties: { ...INTENT_PROPS, viewport: { type: "number", description: "Render viewport width px for the container math (default 1440)." }, recentFingerprints: { type: "array", items: { type: "object" } } } },
    run: (a) => {
      const g = styleGenome(engine, a || {}, { seed: a && a.seed, recentFingerprints: (a && a.recentFingerprints) || [] });
      return {
        html: renderPage(engine, g, { viewport: Number(a && a.viewport) || 1440 }),
        genome: { family: g.layout && g.layout.family, fonts: { display: g.type.display.family, body: g.type.body.family }, palette: { ground: g.color.ground, ink: g.color.ink, accent: g.color.accent, mood: g.color.mood } },
        fingerprint: g.fingerprint,
      };
    },
  },
];

export const TOOL_BY_NAME = Object.fromEntries(TOOLS.map((t) => [t.name, t]));
