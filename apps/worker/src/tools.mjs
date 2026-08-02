// tools.mjs — the engine instance + the shared tool catalog.
//
// One engine at module scope (data is bundled by wrangler/esbuild as JSON).
// The same tool definitions back BOTH the REST API and the MCP server, so
// behaviour never drifts between the two surfaces.

import { createEngine } from "../../engine/engine.mjs";
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
    description: "Suggest fresh, non-monoculture font families (off the AI avoid-list, away from top-tier popularity). Returns picks with supplier/category/rank plus a display+body pairing recommendation.",
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
    name: "design_system",
    description: "Generate a complete, coherent design token system from a seed: gate-passing palette + modular type scale + spacing grid + radius scale + shadow elevation ramp + motion tokens + control sizing. The 'roll a whole theme' call.",
    inputSchema: { type: "object", properties: {
      baseFont: { type: "number", description: "Base body font px (default 18)." },
      baseUnit: { type: "number", description: "Spacing grid unit px (default 4)." },
      ratio: { type: "string", description: "Type-scale ratio name or number (default perfect-fourth)." },
      radiusBase: { type: "number", description: "Base corner radius px (default 8)." },
      seed: { type: "integer", description: "Deterministic seed for the palette (default 1)." },
    } },
    run: (a) => engine.designSystem(a || {}),
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
    description: "Generate a modular type scale. Returns [{step, px, rem}] plus recommended line-height and tracking are available via the fields.",
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
    description: "Do the math for a layout: given viewport/base font/columns/split intent, returns a fitted grid, the optimal measure, margins, a recommended split, and a whitespace-ratio target.",
    inputSchema: { type: "object", properties: {
      viewport: { type: "number", description: "Viewport width px (default 1440)." },
      baseFont: { type: "number", description: "Body font px (default 18)." },
      columns: { type: "integer", description: "Max columns cap." },
      split: { type: "string", description: "Split ratio name: golden|thirds|quarter|half." },
    } },
    run: (a) => engine.layout(a || {}),
  },
  {
    name: "palette",
    description: "Generate a fresh, gate-passing palette {ground, ink, accent, accent2} from a numeric seed (deterministic). Passes the color slop gates and ≥4.5:1 ink-on-ground contrast.",
    inputSchema: { type: "object", properties: { seed: { type: "integer", description: "Deterministic seed (default 1)." } } },
    run: (a) => engine.generatePalette(Number(a && a.seed) || 1),
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
