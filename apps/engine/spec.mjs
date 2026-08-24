// apps/engine/spec.mjs — genome → build-spec serializer (Haiku validation harness).
//
// Pure, deterministic: same StyleGenome (as returned by styleGenome()/exploreDirections()'s
// `direction.genome`) always produces the identical Markdown string. No fs, no randomness — file
// writing is the runner script's job (apps/engine/scripts/haiku-val-gen.mjs), not this module's.
//
// WHY THIS EXISTS: every existing consumer of a StyleGenome (skills/fixmyslop/explore.md, the
// MCP tool descriptions in apps/worker/src/tools.mjs) hands the raw genome to a CAPABLE model and
// trusts it to translate dial values, treatment ids and taxonomy jargon into a real design with
// taste. There is no genome→literal-instructions serializer anywhere in the repo (checked
// apps/worker/src/tools.mjs, install-doc.mjs — both pass genomes through untouched). A weak model
// cannot make that translation, so this module does it instead: every value below is a concrete
// number, hex, font family, or named CSS technique — never an adjective a weak model would have to
// interpret.

import { typeScale, spacingScale } from "./system.mjs";
import { purposeForRole, centrepieceRoleOf } from "./section-purpose.mjs";

const pct = (n) => `${Math.round((Number(n) || 0) * 100)}%`;
const num = (n, d = 2) => (Number.isFinite(Number(n)) ? Number(n).toFixed(d).replace(/\.?0+$/, "") : String(n));
const px = (n) => `${Math.round(Number(n) || 0)}px`;
const ms = (n) => `${Math.round(Number(n) || 0)}ms`;
const clamp01 = (n, fallback = 0.5) => {
  const x = Number(n);
  return Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : fallback;
};

// functionalScore — SAME formula as engine.mjs's surfaceFontEnvelope / intent.mjs's deriveBaseHue /
// background.mjs's functionalScoreOf (0.4·contentDensity + 0.35·formality + 0.25·(1−energy)),
// duplicated here (matches the existing duplication pattern between those three modules) so this
// serializer can make the brief SURFACE-AWARE: expressive/marketing surfaces (low score) get the
// "go bold, build one centrepiece" framing; functional/dense surfaces (high score) get the "stay
// dense and legible, boldness is data hierarchy" framing.
function functionalScoreOf(intent = {}) {
  const cd = clamp01(intent.contentDensity);
  const formality = clamp01(intent.formality);
  const energy = clamp01(intent.energy);
  return clamp01(0.4 * cd + 0.35 * formality + 0.25 * (1 - energy));
}

// ── type scale derivation (spec §2 wiring: genome carries headingScaleRatio, a heading:body
// ratio, but no modular *step* ratio for the rest of the scale — that's a build-spec concern this
// module owns, deterministically, from the same dials). ─────────────────────────────────────────
function baseFontPx(intent) {
  const density = Number.isFinite(Number(intent?.contentDensity)) ? Number(intent.contentDensity) : 0.5;
  return Math.round(19 - 4 * density); // dense (1.0) → 15px, breathing (0.0) → 19px
}
function scaleRatioName(headingScaleRatio) {
  const r = Number(headingScaleRatio) || 1.5;
  if (r >= 3.2) return "golden";
  if (r >= 2.4) return "perfect-fourth";
  if (r >= 1.7) return "major-third";
  return "major-second";
}
function weightsFor(hierarchy) {
  const cc = Number(hierarchy?.contrastConcentration) || 0.4;
  const cta = Number(hierarchy?.ctaProminence) || 0.4;
  return {
    heading: cc >= 0.6 ? 800 : cc >= 0.4 ? 700 : 600,
    body: 400,
    accent: cta >= 0.6 ? 700 : 600,
  };
}

function availableWeight(font, desired) {
  const listed = font?.asset?.recommendedWeights;
  if (!Array.isArray(listed) || !listed.length) return desired;
  const numeric = listed.map(Number).filter(Number.isFinite);
  if (!numeric.length) return desired;
  return numeric.reduce((best, weight) => Math.abs(weight - desired) < Math.abs(best - desired) ? weight : best, numeric[0]);
}

const STEP_LABELS = { 4: "H2", 3: "H3", 2: "H4 / lead paragraph", 1: "body-large / intro", 0: "body (base)", "-1": "small / caption" };

function typeSection(genome) {
  const intent = genome.sourceIntent || {};
  const base = baseFontPx(intent);
  const headingScaleRatio = genome.layout?.hierarchy?.headingScaleRatio ?? 1.75;
  const ratioName = scaleRatioName(headingScaleRatio);
  const scale = typeScale({ base, ratio: ratioName, up: 4, down: 1 });
  const desiredWeights = weightsFor(genome.layout?.hierarchy);
  const hasHero = (genome.layout?.sectionGrammar || []).some((section) => section?.role === "hero");
  const largestScalePx = Math.max(...scale.map((step) => Number(step.px) || 0));
  // headingScaleRatio is a hierarchy signal, not permission to make a nominal hero smaller than
  // H2. Keep the computed hero strictly above the rest of the reference scale.
  const heroPx = Math.max(Math.round(base * headingScaleRatio), Math.ceil(largestScalePx * 1.2));
  const display = genome.type?.display?.family || "system-ui";
  const body = genome.type?.body?.family || "system-ui";
  const w = {
    heading: availableWeight(genome.type?.display, desiredWeights.heading),
    body: availableWeight(genome.type?.body, desiredWeights.body),
    accent: availableWeight(genome.type?.body, desiredWeights.accent),
  };
  const displayAsset = genome.type?.display?.asset;
  const bodyAsset = genome.type?.body?.asset;
  const displaySuitable = genome.type?.display?.readabilityChecks?.displaySuitable;
  const bodySuitable = genome.type?.body?.readabilityChecks?.bodySuitable;
  const productSurface = ["dashboard", "data-admin", "app"].includes(genome.layout?.pageKind);

  const rows = scale
    .slice()
    .sort((a, b) => b.step - a.step)
    .map((s) => `| ${STEP_LABELS[s.step] || `step ${s.step}`} | ${px(s.px)} (${s.rem}rem) |`)
    .join("\n");

  const heroRule = hasHero
    ? `Hero reference: ${px(heroPx)} (= the only text role above the ${px(largestScalePx)} scale ceiling). Keep the hero strictly larger than every other text role at each breakpoint; a responsive \`clamp()\` may reduce it on narrow screens while preserving that ordering.`
    : `This grammar has no hero. Do not invent a hero headline or reserve hero-sized type; use the scale below for the interface hierarchy.`;

  const fontGate = `Font delivery gate:
- The named families are implementation candidates, not fallback hints. ${displayAsset?.available === true ? `${display} has a verified asset record` : `${display} still needs a verified asset`}; ${bodyAsset?.available === true ? `${body} has a verified asset record` : `${body} still needs a verified asset`}.
- Before visual QA, use the exact licensed asset declarations from the connected font handoff, await \`document.fonts.ready\`, and verify \`document.fonts.check()\` for every shipped family/weight.
- ${displaySuitable === false ? `BLOCKED: ${display} has not passed the display-role suitability gate; re-resolve the pairing before implementation.` : `Require ${display} to pass the display-role suitability gate.`} ${bodySuitable === false ? `BLOCKED: ${body} has not passed the body-role suitability gate; re-resolve the pairing before implementation.` : `Require ${body} to pass the body-role suitability gate.`} Never hide a failed or missing face behind a generic fallback.`;

  return `## Type

Font roles (never swap them — display carries identity, body carries running text):
- Heading / display candidate: **${display}**, weight ${w.heading}${productSurface ? "; reserve it for identity and genuinely prominent headings, not routine controls or data labels" : ""}
- Body / running-text font: **${body}**, weight ${w.body}
- Accent / UI text (buttons, nav links, labels, badges, form controls): **${body}**, weight ${w.accent}

${heroRule}

Reference type scale (base ${px(base)}, modular ratio "${ratioName}"):
| role | size |
|---|---|
${rows}

Treat these as hierarchy anchors, not a ban on interpolation. Prefer the listed values; use fluid values between adjacent anchors when viewport fit, localization, or optical correction requires it, and preserve a clear hierarchy. Line-height: 1.5 for body text, 1.15-1.35 for headings (tighter as size increases).

${fontGate}`;
}

// ── layout section ───────────────────────────────────────────────────────────────────────────
function layoutSection(genome) {
  const L = genome.layout || {};
  const macro = L.macro || {};
  const h = L.hierarchy || {};
  const grammar = L.sectionGrammar || [];
  const primaryRole = centrepieceRoleOf(grammar);
  const productSurface = ["dashboard", "data-admin", "app"].includes(L.pageKind);
  const sections = grammar
    .map((s, i) => {
      const isPrimary = s.role === primaryRole;
      const primaryNote = productSurface
        ? " **← PRIMARY WORK AREA: put the real product objects, actions, and visible outcomes here. Decorative expression cannot substitute for the workflow.**"
        : " **← FOCAL COMPOSITION: give the subject-specific mechanism or proof the strongest visual weight here.**";
      const purpose = purposeForRole(s.role) + (isPrimary ? primaryNote : "");
      return `| ${i + 1} | ${s.role} | ${pct(s.heightShare)} emphasis (not a height) | ${s.focalPoint} | ${s.composition} | ${s.surface === "inverted" ? "inverted (dark band on a light theme, or vice-versa)" : "normal"} | ${purpose} |`;
    })
    .join("\n");
  const mobile = (genome.responsive?.collapseRules && genome.responsive.collapseRules[0]) || L.responsive?.mobileTransform || "stack sections full-width, preserve order";
  const primaryRule = primaryRole
    ? productSurface
      ? `The **${primaryRole}** is the primary work area, not a marketing centrepiece. It must expose the subject's real workflow and states at useful density. Do not add a hero above it.`
      : `The **${primaryRole}** is the suggested focal region. Its visual dominance must come from subject-specific content or proof, not from an expression effect alone.`
    : `Preserve every necessary product function even if regions are merged.`;

  return `## Layout

Archetype: **${L.family || "unspecified"}** (page kind: ${L.pageKind || "n/a"})

Treat this grammar as a reference sequence, not a wireframe to copy literally. Preserve every named product function and the hierarchy encoded by \`heightShare\`, but merge supporting regions, reorder adjacent support around the user's task, or change the desktop grouping when the brief, content, or interaction model requires it. Document each structural departure in one sentence. \`heightShare\` is RELATIVE EMPHASIS — which functions matter most — NOT a pixel or vh height target. Do NOT set a fixed or min-height from it, and do NOT pad a region with empty space to reach a size. Let CONTENT determine actual height. No region may contain more than ~150px of contiguous empty vertical space unless that space is visibly serving the focal composition. The "content purpose" column is the functional contract, not optional flavor text:

| # | section role | relative emphasis | focal point | composition | surface | content purpose |
|---|---|---|---|---|---|---|
${sections}

**No empty functions.** Every required purpose above must be implemented with real content, whether it remains a standalone section or is merged into a better workflow. No blank band, color-only placeholder, or caption without an object beneath it. ${primaryRule}

Macro proportions:
- Content max-width: ${pct(macro.contentWidthShare)} of viewport width (centered, generous side margins outside it)
- Column count for multi-column sections: ${macro.columnCount}
- Split ratio (for any two-pane/asymmetric section): ${num(macro.splitRatio)} / ${num(1 - (Number(macro.splitRatio) || 0.5))} — the larger side gets ${num(Math.max(macro.splitRatio, 1 - macro.splitRatio))} of the row
- Alignment: ${macro.alignment || "left-led"}
- Whitespace level: ${pct(macro.whitespace)} — ${Number(macro.whitespace) >= 0.5 ? "generous breathing room between blocks, don't crowd it" : "tight/dense spacing between blocks, pack content efficiently"} — content density target ${pct(macro.contentDensity)}

Hierarchy numbers:
- Focal area reference: ~${pct(h.focalAreaShare)} of its region. Adapt within the available content and viewport; preserve dominance without clipping or manufacturing dead space
- CTA prominence: ${pct(h.ctaProminence)} — ${Number(h.ctaProminence) >= 0.6 ? "make the primary call-to-action visually loud (large, high-contrast, isolated)" : "keep the primary call-to-action present but understated, not shouting"}
- Contrast concentration: ${pct(h.contrastConcentration)} — concentrate strong value/color contrast on the focal element(s), keep the rest of the page comparatively quiet

Mobile behavior (below ~640px): ${mobile}.`;
}

// ── color section ────────────────────────────────────────────────────────────────────────────
function colorSection(genome) {
  const c = genome.color || {};
  const theme = genome.sourceIntent?.theme === "dark" ? "dark" : "light";
  const secondary = c.accent2 || c.secondary;
  const roles = [
    c.ground && ["background", c.ground, "page background and major canvas surfaces"],
    c.surface && ["surface", c.surface, "panels or nested surfaces that need a distinct neutral level"],
    c.ink && ["text", c.ink, "body copy and headings"],
    c.accent && ["accent (primary)", c.accent, "primary actions, active selection, and the highest-priority interactive signal"],
    secondary && ["accent (secondary)", secondary, "a subordinate counterpoint selected with the primary; use for comparison, secondary data, or a distinct state, never as a competing CTA"],
  ].filter(Boolean);
  const rows = roles.map(([role, value, use]) => `| ${role} | \`${value}\` | ${use} |`).join("\n");
  const secondaryGuidance = secondary
    ? "The secondary accent is a deliberate counterpoint to the primary, not a license to add arbitrary hues: test them together in the same view and keep the secondary visibly subordinate."
    : "No secondary accent is supplied. Do not invent one unless the product needs a distinct semantic or comparative channel; if it does, resolve and gate that role with the rest of the palette.";
  return `## Color

Theme: **${theme}**. This genome supplies ${roles.length} palette roles:

| role | hex | use for |
|---|---|---|
${rows}

Treat the palette as role relationships, not a literal-color-count ceiling. Derived tints/shades are allowed for interaction states and surface depth. Add semantic success, warning, error, or info colors only when the product needs those meanings; gate every added color against its actual background and keep it distinct from the primary action color. ${secondaryGuidance}

Contrast requirement: background/text pair measures ${num(c.contrast, 2)}:1 — this MUST stay at or above 4.5:1 (WCAG AA) for body text; large/UI text stays at or above 3:1. Do not lighten text or add translucency that drops below those thresholds. Accent hue reference: ${Math.round(Number(c.hue) || 0)}° (OKLCH).`;
}

// ── background section ───────────────────────────────────────────────────────────────────────
function fmtParams(params = {}) {
  const entries = Object.entries(params).filter(([k]) => k !== "meta");
  if (!entries.length) return "(no params)";
  return entries.map(([k, v]) => `${k}=${typeof v === "number" ? num(v, 4) : v}`).join(", ");
}

function backgroundSection(genome) {
  const bg = genome.background || {};
  const field = bg.field || {};
  const productSurface = ["dashboard", "data-admin", "app"].includes(genome.layout?.pageKind);
  const slotRows = Object.entries(bg.slots || {})
    .map(([name, s]) => `| ${name} | ${s.treatment} | ${fmtParams(s.params)} |`)
    .join("\n");
  const intensityRule = productSurface
    ? "On this product surface, the background should support scanning and state changes. Keep treatments quiet enough that data, controls, selection, and focus remain the strongest signals."
    : "Make the assigned field treatment intentional and visible enough to establish the scene, while keeping copy and proof dominant.";
  return `## Background

${intensityRule}

Page field (the base page background treatment): **${field.treatment}**
Params: ${fmtParams(field.params)}

${bg.band ? `Section-band rhythm: alternates every band, hue count ${bg.band.hueCount}, alternation rate ${pct(bg.band.alternationRate)}, dark bands: ${bg.band.darkBandCount}.\n` : ""}
Material slot treatments (apply ONLY to the named surfaces, not sprayed across every box):
| slot | treatment | params |
|---|---|---|
${slotRows || "| (none) | — | — |"}

Hard rule: no gradient text on headings/metrics. No animated background (ambient particles/mesh motion) anywhere.`;
}

// ── motion section ───────────────────────────────────────────────────────────────────────────
function motionSection(genome) {
  const m = genome.motion?.design || {};
  const d = m.defaults || {};
  const scroll = m.scroll || {};
  const reveal = m.reveal || {};
  const t = m.transitions || {};
  const grammar = genome.layout?.sectionGrammar || [];
  const hero = grammar.find((section) => section?.role === "hero");
  const singleViewport = grammar.find((section) => section?.singleViewport === true);
  const viewportRule = hero || singleViewport
    ? `First-screen composition: **${hero?.role || singleViewport?.role}** is the initial focal region. Aim to make its promise, proof, and primary action understandable in the first viewport when the real content fits. Content height wins: never force \`100vh\`, clip text, or shrink controls to satisfy a viewport target.`
    : "This layout has no hero or single-viewport region. Do not add a hero-height block or reserve a viewport of empty space. Let task content determine the block size; an app workspace may occupy remaining viewport space only when its internal scrolling and keyboard reachability are explicit.";

  return `## Motion

Easing: enter = \`${d.enterEasing}\`, exit = \`${d.exitEasing}\`. Never use \`linear\` or a bounce/elastic (overshooting) easing anywhere.
Durations: feedback ${ms(d.durations?.feedback)}, state-change ${ms(d.durations?.state)}, layout ${ms(d.durations?.layout)}, entrance ${ms(d.durations?.entrance)}. Stagger between list/grid items: ${ms(d.stagger)}.
Animate ONLY \`transform\` and \`opacity\` — never width/height/padding/margin (causes layout jank).

Scroll behavior: ${scroll.smooth?.enabled ? `smooth scroll via CSS (\`scroll-behavior:smooth\`), lerp ${num(scroll.smooth?.lerp, 2)}` : "native scroll, no smoothing"}. Scroll-snap: ${scroll.snap?.enabled ? `enabled, ${scroll.snap.mode} mode, ${scroll.snap.axis}-axis` : "disabled"}. Sticky nav: ${scroll.sticky?.enabled ? "yes, pinned to top" : "no"}. Parallax: ${scroll.parallax?.enabled ? `one layer, ratio ${num(scroll.parallax.ratio, 2)}` : "none"}. Marquee: ${scroll.marquee?.enabled ? `one, ${scroll.marquee.speed}, pause on hover` : "none"}.

Scroll-reveal on entrance: ${reveal.treatment === "none" ? "disabled — content renders fully visible immediately" : `${reveal.treatment}, distance ${px(reveal.distance)}, duration ${ms(reveal.duration)}, stagger ${ms(reveal.stagger)}, fires once, triggers at ${pct(reveal.viewportAmount)} in view`}.

Section transitions (expand/collapse if any): use \`${t.section?.technique || "clip-grid-rows"}\`, ${ms(t.section?.duration)}. Page transition: ${t.page?.technique || "crossfade"}, ${ms(t.page?.duration)}.

### Hard guarantees (non-negotiable, verify before finishing)
1. **Reduced motion**: every animation/transition above MUST be wrapped so \`@media (prefers-reduced-motion: reduce)\` collapses it to instant/no-motion. No exceptions.
2. **No content gated on scroll/JS**: primary copy, controls, and the product mechanism's meaningful initial state must be present and visible in the initial render — never \`opacity:0\` or \`visibility:hidden\` waiting on a scroll or JS event to reveal core content. Reveal-on-scroll (if used above) is a decorative *polish* layer only, on secondary content.
3. **Content-driven geometry**: ${viewportRule}`;
}

// ── spacing / material section ───────────────────────────────────────────────────────────────
function spacingMaterialSection(genome) {
  const mat = genome.material || {};
  const spacing = spacingScale({ base: 4 });
  const spacingRow = spacing.map((s) => `${s.token}=${px(s.px)}`).join(", ");
  return `## Spacing & Material

Spacing scale (4px base grid) — use these as rhythm anchors: ${spacingRow}. Prefer the scale, but permit bounded intermediate values for optical alignment, safe-area insets, touch targets, and responsive fit. Record repeated exceptions as a new token instead of accumulating one-offs.

Radius scale: none=0, sm=${px(mat.radii?.sm)}, md=${px(mat.radii?.md)}, lg=${px(mat.radii?.lg)}, xl=${px(mat.radii?.xl)}, full=${mat.radii?.full}px (pills/avatars only). Radius language: ${mat.radiusLanguage}.

Shadow: \`${mat.shadow?.css || "none"}\`. Shadow language: ${mat.shadowLanguage}. Border language: ${mat.borderLanguage}. Surface treatment: ${mat.surfaceTreatment}. Accent treatment: ${mat.accentTreatment}.

Apply material (radius/shadow/border) ONLY to these hierarchy slots, never spray it across every box on the page: ${(mat.slots || []).join(", ") || "(none specified)"}.`;
}

/**
 * genomeToSpec(genome) → Markdown string.
 *
 * Pure: no fs, no Date.now, no Math.random — same genome always serializes identically. `genome`
 * is a full StyleGenome (styleGenome()'s return, or an exploreDirections() direction's `.genome`).
 * The output is the ONLY design guidance a weak model receives — every section below pins a
 * concrete, literal value (font family, hex, px, ms, named CSS technique), never a vague adjective
 * that would require taste to interpret.
 */
// ── creative brief section — the design-law directives (design-law.md), made surface-aware via
// functionalScore. This is guidance, not dictation: it names the trap (forbid-the-median), makes
// the centrepiece call surface-conditional, and hands ideation/composition/content/intensity to
// the model, while the sections above still pin the exact math the engine owns. ──────────────────
function briefSection(genome) {
  const intent = genome.sourceIntent || {};
  const fs = functionalScoreOf(intent);
  const expressive = fs < 0.55;
  const centrepieceGuidance = expressive
    ? `This is an expressive/marketing surface (functionalScore ${num(fs)} < 0.55) — it wants ONE
bold, subject-grounded product mechanism or proof: an interactive/computed instrument, a real
product state that can be manipulated, or a data-driven demonstration. Decide what it is FIRST,
build its meaningful initial state in markup, and make it nameable — if you swapped the subject,
this mechanism should break. A type effect, signature motion, ambient animation, palette, mood,
parallax object, or stock screenshot is expression, not the product mechanism, and does not qualify
on its own. Expression may stage the mechanism but may never substitute for it. Earn the whitespace this layout gives you:
generous space must be backed by oversized type, confident color, or motion — never left as empty,
undecorated dead air. Fill every section with real content; no decorative dead cards, no empty
voids masquerading as "breathing room."`
    : `This is a functional/data-dense surface (functionalScore ${num(fs)} ≥ 0.55) — it usually does
NOT want a hero-sized centrepiece; that steals density from the data. Stay dense and legible. The
boldness here is the subject's working mechanism, confident data hierarchy, and deliberate
state-coding, not big type or a signature effect. Put real objects, actions, and outcomes in the
primary work area. An expression treatment may support orientation or feedback, but it cannot count
as the product centrepiece or replace the workflow.`;

  return `## Creative brief — read this before you build

The sections below (Layout, Type, Color, Background, Motion, Spacing & Material) are YOUR SYSTEM:
palette roles + relationships, the type scale, the spacing/radius/shadow ramps, the layout
hierarchy, and the motion timing/easing tokens. That math supplies reference anchors. Preserve its
relationships and hard gates, then adapt the exact composition, region grouping, and bounded token
values when product truth, content, localization, or responsive behavior requires it. The
subject-specific product mechanism and expressive intensity are yours to invent. This is a strong
direction, not a form to fill in.

**Forbid the median.** Name the obvious safe version of this brief — the same-everything, timid
build a weak model reaches for by default (predictable headline-left + widget-card-right hero,
italic accent word, fake metric card, muted "tasteful" palette, generous but empty whitespace) —
and refuse the whole cluster. Mine the layout, the type move, and the font character from THIS
brief. Swap test: if the page could belong to a different brief unchanged, change an axis and
retry.

**Product mechanism before expression.** ${centrepieceGuidance}

**Personality without obscuring the mechanism.** The headline and body copy stay calm
and immediately readable — never sacrifice legibility for personality there. The loud personality
may stage the subject-specific mechanism and live in the margins/ornament, but it never replaces the
mechanism or gets smeared across the message itself.

**Hard gates — non-negotiable, verify before finishing:**
- Body text uses the resolved body role below — never a display or novelty face for running text.
- Every text/background pair meets WCAG AA (4.5:1 body, 3:1 large/UI) — computed, not eyeballed.
- One real icon set (Lucide, Phosphor, Feather, Heroicons — pick one, never mix), supplied as a
  reviewed local subset or vetted inline paths rather than fetched from a runtime CDN. NEVER emoji
  as icons, bullets, or chrome. Never hand-draw illustrative SVG (figures, scenes, mascots).
- Core content — the product mechanism's meaningful initial state, headings, body copy — is present in markup on load, without JS.
  Never \`opacity:0\`-until-scroll; reveals start from a present, visible state.

Where content is needed (copy, labels, data), invent plausible, concrete content that fits the
brief and the section roles below — never lorem ipsum, never bracketed placeholders like
"[Headline here]".`;
}

export function genomeToSpec(genome = {}) {
  const brief = genome.sourceBrief || genome.sourceIntent?.sourceBrief || "";
  const sections = [
    briefSection(genome),
    layoutSection(genome),
    typeSection(genome),
    colorSection(genome),
    backgroundSection(genome),
    motionSection(genome),
    spacingMaterialSection(genome),
  ];
  return `# Build Spec

Brief: ${brief || "(none given — design is fully specified below; invent plausible, concrete content consistent with the layout roles)"}

Deliverable: one HTML entry point plus the licensed local font/assets explicitly named by the
connected handoff. Inline page-specific CSS and JS when practical. Make no remote CDN, stylesheet,
font, script, or image requests. Do not pretend a named family loaded by putting it before a generic
fallback: copy the verified local asset, declare the exact face with \`@font-face\`, await
\`document.fonts.ready\`, and verify it with \`document.fonts.check()\`. If the asset or role gate is
missing, return to font resolution; only use a system stack when the engine deliberately selected
one.

${sections.join("\n\n")}
`;
}
