// apps/engine/spec.mjs — genome → build-spec serializer (Haiku validation harness).
//
// Pure, deterministic: same StyleGenome (as returned by styleGenome()/exploreDirections()'s
// `direction.genome`) always produces the identical Markdown string. No fs, no randomness — file
// writing is the runner script's job (apps/engine/scripts/haiku-val-gen.mjs), not this module's.
//
// WHY THIS EXISTS: every existing consumer of a StyleGenome (skills/fix-ai-slop/explore.md, the
// MCP tool descriptions in apps/worker/src/tools.mjs) hands the raw genome to a CAPABLE model and
// trusts it to translate dial values, treatment ids and taxonomy jargon into a real design with
// taste. There is no genome→literal-instructions serializer anywhere in the repo (checked
// apps/worker/src/tools.mjs, install-doc.mjs — both pass genomes through untouched). A weak model
// cannot make that translation, so this module does it instead: every value below is a concrete
// number, hex, font family, or named CSS technique — never an adjective a weak model would have to
// interpret.

import { typeScale, spacingScale } from "./system.mjs";

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

const STEP_LABELS = { 4: "H2", 3: "H3", 2: "H4 / lead paragraph", 1: "body-large / intro", 0: "body (base)", "-1": "small / caption" };

function typeSection(genome) {
  const intent = genome.sourceIntent || {};
  const base = baseFontPx(intent);
  const headingScaleRatio = genome.layout?.hierarchy?.headingScaleRatio ?? 1.75;
  const ratioName = scaleRatioName(headingScaleRatio);
  const scale = typeScale({ base, ratio: ratioName, up: 4, down: 1 });
  const w = weightsFor(genome.layout?.hierarchy);
  const heroPx = Math.round(base * headingScaleRatio);
  const display = genome.type?.display?.family || "system-ui";
  const body = genome.type?.body?.family || "system-ui";

  const rows = scale
    .slice()
    .sort((a, b) => b.step - a.step)
    .map((s) => `| ${STEP_LABELS[s.step] || `step ${s.step}`} | ${px(s.px)} (${s.rem}rem) |`)
    .join("\n");

  return `## Type

Font families (never swap these two roles — display carries identity, body carries running text):
- Heading / display font: **${display}**, weight ${w.heading}
- Body / running-text font: **${body}**, weight ${w.body}
- Accent / UI text (buttons, nav links, labels, badges, form controls): **${body}**, weight ${w.accent}

Hero size — the ONE largest headline on the page, exactly once, at:
- ${px(heroPx)} (= base ${px(base)} × headingScaleRatio ${num(headingScaleRatio)}), font: ${display}, weight ${w.heading}

Type scale (base ${px(base)}, modular ratio "${ratioName}") — use these sizes for every other text role, no other sizes:
| role | size |
|---|---|
${rows}

Do not introduce any font-size not listed above (hero size + the scale table). Line-height: 1.5 for body text, 1.15-1.35 for headings (tighter as size increases).`;
}

// ── layout section ───────────────────────────────────────────────────────────────────────────
function layoutSection(genome) {
  const L = genome.layout || {};
  const macro = L.macro || {};
  const h = L.hierarchy || {};
  const sections = (L.sectionGrammar || [])
    .map((s, i) => `| ${i + 1} | ${s.role} | ${pct(s.heightShare)} of page height | ${s.focalPoint} | ${s.composition} | ${s.surface === "inverted" ? "inverted (dark band on a light theme, or vice-versa)" : "normal"} |`)
    .join("\n");
  const mobile = (genome.responsive?.collapseRules && genome.responsive.collapseRules[0]) || L.responsive?.mobileTransform || "stack sections full-width, preserve order";

  return `## Layout

Archetype: **${L.family || "unspecified"}** (page kind: ${L.pageKind || "n/a"})

Build the page as EXACTLY these sections, in this exact order, top to bottom. \`heightShare\` is that section's approximate share of total page scroll height — use it to size the section, don't make every section the same height:

| # | section role | height share | focal point | composition | surface |
|---|---|---|---|---|---|
${sections}

Macro proportions:
- Content max-width: ${pct(macro.contentWidthShare)} of viewport width (centered, generous side margins outside it)
- Column count for multi-column sections: ${macro.columnCount}
- Split ratio (for any two-pane/asymmetric section): ${num(macro.splitRatio)} / ${num(1 - (Number(macro.splitRatio) || 0.5))} — the larger side gets ${num(Math.max(macro.splitRatio, 1 - macro.splitRatio))} of the row
- Alignment: ${macro.alignment || "left-led"}
- Whitespace level: ${pct(macro.whitespace)} — ${Number(macro.whitespace) >= 0.5 ? "generous breathing room between blocks, don't crowd it" : "tight/dense spacing between blocks, pack content efficiently"} — content density target ${pct(macro.contentDensity)}

Hierarchy numbers:
- Focal area (the single largest/most dominant element, e.g. hero visual or headline) occupies ~${pct(h.focalAreaShare)} of its section
- CTA prominence: ${pct(h.ctaProminence)} — ${Number(h.ctaProminence) >= 0.6 ? "make the primary call-to-action visually loud (large, high-contrast, isolated)" : "keep the primary call-to-action present but understated, not shouting"}
- Contrast concentration: ${pct(h.contrastConcentration)} — concentrate strong value/color contrast on the focal element(s), keep the rest of the page comparatively quiet

Mobile behavior (below ~640px): ${mobile}.`;
}

// ── color section ────────────────────────────────────────────────────────────────────────────
function colorSection(genome) {
  const c = genome.color || {};
  const theme = genome.sourceIntent?.theme === "dark" ? "dark" : "light";
  return `## Color

Theme: **${theme}**. Use exactly these 4 colors, no others (tints/shades of them for hover/disabled states are fine):

| role | hex | use for |
|---|---|---|
| background | \`${c.ground}\` | page background, section backgrounds (unless a section is marked "inverted" above — invert background/text there) |${c.surface ? `\n| surface | \`${c.surface}\` | cards, panels, elevated/nested surfaces — a second NEUTRAL, distinct in lightness from the page background, never a tint of the accent |` : ""}
| text | \`${c.ink}\` | all body copy, headings |
| accent (primary) | \`${c.accent}\` | primary CTA buttons, links, active/selected states, the single most important interactive element per screen |
| accent (secondary) | \`${c.accent2}\` | secondary accents, badges, chart/data highlights — never the primary CTA |

Neutrals dominate; the accent is scarce (60-30-10: background + surface carry the page, the accent earns attention by being rare, not by being everywhere). Contrast requirement: background/text pair measures ${num(c.contrast, 2)}:1 — this MUST stay at or above 4.5:1 (WCAG AA) for all body text. Do not lighten text or add translucency that would drop it below that.

Accent hue: ${Math.round(Number(c.hue) || 0)}° (OKLCH). Do not introduce a second, unrelated hue family anywhere on the page — and do not let the accent hue bleed into background/surface at anything beyond a faint neutral tint.`;
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
  const slotRows = Object.entries(bg.slots || {})
    .map(([name, s]) => `| ${name} | ${s.treatment} | ${fmtParams(s.params)} |`)
    .join("\n");
  return `## Background

The background is a PRESENT design element, not a whisper — it should read as a visible, intentional
ground the type sits on, not near-invisible white. Build it at the intensity given below.

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
  const hero = m.heroFit || { targetHeightShare: 1.0, tolerance: 0.1 };
  const t = m.transitions || {};

  return `## Motion

Easing: enter = \`${d.enterEasing}\`, exit = \`${d.exitEasing}\`. Never use \`linear\` or a bounce/elastic (overshooting) easing anywhere.
Durations: feedback ${ms(d.durations?.feedback)}, state-change ${ms(d.durations?.state)}, layout ${ms(d.durations?.layout)}, entrance ${ms(d.durations?.entrance)}. Stagger between list/grid items: ${ms(d.stagger)}.
Animate ONLY \`transform\` and \`opacity\` — never width/height/padding/margin (causes layout jank).

Scroll behavior: ${scroll.smooth?.enabled ? `smooth scroll via CSS (\`scroll-behavior:smooth\`), lerp ${num(scroll.smooth?.lerp, 2)}` : "native scroll, no smoothing"}. Scroll-snap: ${scroll.snap?.enabled ? `enabled, ${scroll.snap.mode} mode, ${scroll.snap.axis}-axis` : "disabled"}. Sticky nav: ${scroll.sticky?.enabled ? "yes, pinned to top" : "no"}. Parallax: ${scroll.parallax?.enabled ? `one layer, ratio ${num(scroll.parallax.ratio, 2)}` : "none"}. Marquee: ${scroll.marquee?.enabled ? `one, ${scroll.marquee.speed}, pause on hover` : "none"}.

Scroll-reveal on entrance: ${reveal.treatment === "none" ? "disabled — content renders fully visible immediately" : `${reveal.treatment}, distance ${px(reveal.distance)}, duration ${ms(reveal.duration)}, stagger ${ms(reveal.stagger)}, fires once, triggers at ${pct(reveal.viewportAmount)} in view`}.

Section transitions (expand/collapse if any): use \`${t.section?.technique || "clip-grid-rows"}\`, ${ms(t.section?.duration)}. Page transition: ${t.page?.technique || "crossfade"}, ${ms(t.page?.duration)}.

### Hard guarantees (non-negotiable, verify before finishing)
1. **Reduced motion**: every animation/transition above MUST be wrapped so \`@media (prefers-reduced-motion: reduce)\` collapses it to instant/no-motion. No exceptions.
2. **No content gated on scroll/JS**: the headline, hero copy, and all primary body content must be present and visible in the initial render — never \`opacity:0\` or \`visibility:hidden\` waiting on a scroll or JS event to reveal core content. Reveal-on-scroll (if used above) is a decorative *polish* layer only, on secondary content.
3. **Hero fits the first screen**: the hero section's height must be ${pct(hero.targetHeightShare)} of the viewport height (±${pct(hero.tolerance)}), i.e. roughly one screen — no content spilling past ~100vh, and nothing important cut off above the fold.`;
}

// ── spacing / material section ───────────────────────────────────────────────────────────────
function spacingMaterialSection(genome) {
  const mat = genome.material || {};
  const spacing = spacingScale({ base: 4 });
  const spacingRow = spacing.map((s) => `${s.token}=${px(s.px)}`).join(", ");
  return `## Spacing & Material

Spacing scale (4px base grid) — use only these gaps/paddings/margins: ${spacingRow}.

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
bold, subject-grounded centrepiece: an interactive or computed instrument, a bold typographic or
spatial statement, one signature motion, ambient background animation, a single attention-holding
prop, or a data-driven visual. Decide what it is FIRST, build it in markup on load, and make it
nameable — if you swapped the subject, this centrepiece should break. A palette, a mood, a
parallax blob, or a stock screenshot does not qualify. Earn the whitespace this layout gives you:
generous space must be backed by oversized type, confident color, or motion — never left as empty,
undecorated dead air. Fill every section with real content; no decorative dead cards, no empty
voids masquerading as "breathing room."`
    : `This is a functional/data-dense surface (functionalScore ${num(fs)} ≥ 0.55) — it usually does
NOT want a hero-sized centrepiece; that steals density from the data. Stay dense and legible. The
boldness here is confident data hierarchy and deliberate color-coding, not big type or a signature
moment. If a small instrument or one focal number earns its place, fine — but default to density
over drama.`;

  return `## Creative brief — read this before you build

The sections below (Layout, Type, Color, Background, Motion, Spacing & Material) are YOUR SYSTEM:
exact palette hex + relationships, the type scale, the spacing/radius/shadow ramps, the layout
skeleton and section proportions, and the motion timing/easing tokens. That math is computed and
pinned — build within it, don't recompute it. Everything else — the ideation, the exact
composition, the content, the ONE bold centrepiece, and the expressive intensity — is yours to
invent. This is a strong system and a strong direction, not a form to fill in; be bold and make it
genuinely yours.

**Forbid the median.** Name the obvious safe version of this brief — the same-everything, timid
build a weak model reaches for by default (predictable headline-left + widget-card-right hero,
italic accent word, fake metric card, muted "tasteful" palette, generous but empty whitespace) —
and refuse the whole cluster. Mine the layout, the type move, and the font character from THIS
brief. Swap test: if the page could belong to a different brief unchanged, change an axis and
retry.

**The ONE centrepiece.** ${centrepieceGuidance}

**Personality in the centrepiece, legibility in the body.** The headline and body copy stay calm
and immediately readable — never sacrifice legibility for personality there. The loud personality
lives in the one centrepiece (if this surface has one) and in the margins/ornament, never smeared
across the message itself.

**Hard gates — non-negotiable, verify before finishing:**
- Body text uses the body font pinned below — never a display or novelty face for running text.
- Every text/background pair meets WCAG AA (4.5:1 body, 3:1 large/UI) — computed, not eyeballed.
- One real icon set (Lucide, Phosphor, Feather, Heroicons — pick one, never mix). NEVER emoji as
  icons, bullets, or chrome. Never hand-draw illustrative SVG (figures, scenes, mascots).
- Core content — centrepiece, headings, body copy — is present in markup on load, without JS.
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

Deliverable: a single, self-contained HTML file. Inline all CSS in a \`<style>\` tag and all JS in
a \`<script>\` tag. No external stylesheets, fonts, scripts, or image requests — for the fonts
named below, set them as the first item in a \`font-family\` stack followed by a plausible generic
fallback (e.g. \`ui-sans-serif, system-ui, sans-serif\`), since the named font may not be locally
installed; do not \`@import\` or link to a font file.

${sections.join("\n\n")}
`;
}
