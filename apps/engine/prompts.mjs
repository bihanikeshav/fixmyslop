// prompts.mjs — the canonical design process. Pure. Source for BOTH the MCP prompts
// and the generated atelier skill, so they can never drift.
// No fs, no Date.now, no Math.random — deterministic string authoring only.

import { REFERENCE } from "./reference.mjs";

export const PREAMBLE = "# fix-ai-slop — the design law\n\nYou are building or reviewing a real interface. Deterministic decisions (color,\nfonts, type scale, spacing, radius, shadow, layout, motion) are computed by the\nfix-ai-slop engine, never guessed. Taste and ideation stay yours. Everything below\nexcept the hard gates is leverage, not law — diverge from it when the subject earns\nit; only the gates are non-negotiable.\n\n## Hard gates (the only non-negotiables)\n- **Color.** No indigo/violet AI-accent (hue ~215–280, S>55%, mid lightness). No\n  electric cyan/mint glow on dark. No indigo→cyan or violet→pink gradient — never\n  gradient-on-text. No near-black ground (L<15%) + saturated glow: dark+neon is\n  banned even for a \"dark\" brief; if dark is earned, give the ground a real hue and\n  no glowing accent. No reflexive fintech-blue CTA. No cream + serif-display + gold\n  cluster. Derive the accent from the subject's real material, not the category\n  vibe. Run `check_color` / `check_palette` on every color that ships.\n- **Render.** Core content — centrepiece, headings, body copy — visible in markup on\n  load, without JS. Never opacity:0-until-scroll; reveals start from a present state.\n- **Type.** Display faces may be loud. Body is a readable workhorse — never a\n  display or novelty face for running text. This is the #1 way builds break.\n- **Assets.** One real icon set (Lucide, Phosphor, Feather, Heroicons — pick one,\n  never mix). NEVER emoji as icons, bullets, or chrome. Never hand-draw illustrative\n  SVG (figures, scenes, mascots) — it reads as AI-slop instantly.\n- **Contrast.** Every text/background pair meets WCAG AA (4.5:1 body, 3:1 large/UI)\n  — computed, not eyeballed. Warm-on-warm-dark pairs look fine and measure poorly.\n\n## Palette = intent, not seed\nGround `generate_palette` / `design_system` in the subject: pass `hue` (read off\nreal material — terracotta ~40, forest ~150, ocean ~230), `energy`\n(muted | balanced | bold), `accent` (a hex to anchor), or `intent` (free text, e.g.\n\"coffee roastery, warm, industrial\"). Omit all only for a deliberately ungrounded\nroll. It is never a \"seed\" — intent traces to the subject.\n\n## Forbid the median\nName the median for this brief (safe font, headline-left + widget-card-right hero,\nitalic accent word, fake metric card, muted-earthy \"tasteful\" palette) and refuse\nthe whole cluster — swapping indigo for cream+gold is not divergence. Mine layout,\ntype move, and font character from THIS subject. Swap test: if the page could\nbelong to another brief unchanged, change an axis and retry.\n\n## The ONE centrepiece\nDecide FIRST whether the page wants one: dashboards usually don't (a hero-sized\nmoment steals density from the data); landings usually do. If yes: exactly one\nnameable, subject-grounded centrepiece, in markup on load — an interactive or\ncomputed instrument, a bold typographic or spatial statement, ONE signature motion,\nambient background animation, a single attention-holding prop, or a data-driven\nvisual. Personality ornaments live in the margins, never on the message — headline\nand body stay calm and legible. Discriminator: swapping the subject should BREAK\nit. A palette, a mood, a parallax blob, or a screenshot doesn't qualify.\n\n## Layout\nWireframe-first: structure must hold in grayscale before any palette. Five-second\nscroll test: a stranger grasps the product from structure alone. Hold a grid\nrhythm; break it once, deliberately. Vary width, media placement, and density\nsection to section — no repeated identical slabs. Hero = specific promise + real\nproduct visual + ONE primary CTA + one conversion path. Match radius language\nbetween media and controls. Route archetype/hero calls through `structure_ideas`\nand grid math through `layout` — use its container tokens on the outer wrapper and\nnever re-add margin on `inner` (it doubles the gutter). Marketing can run big type\nand whitespace; dashboards stay small and dense.\n\n## Generation policy\nUnderspecified request → invent the token system first (`design_system`), then\nplace content into it. Never paper over weak structure with gradients, stock\nphotos, extra widgets, or decorative dead cards.\n\n## Ship essentials\n- Hierarchy reads in grayscale — color never does hierarchy's job.\n- Neutrals dominate; the accent is scarce; semantic colors stay distinct from it.\n- Design the empty, loading, error, and success states.\n\n## Decision → Tool\n| Deciding… | Tool | Notes |\n|---|---|---|\n| Whole theme | `design_system` | one coherent pass; ground with `hue` / `energy` / `accent` / `intent` |\n| Ideation / divergence | `structure_ideas` | forbid-the-median + the hero/centrepiece call |\n| Is a color OK? | `check_color` / `check_palette` | slop gate + passing alternatives |\n| Fresh palette | `generate_palette` | grounded, gate-passing, ≥4.5:1 |\n| Fonts | `suggest_fonts` / `check_font` | pairing.body is the readable face — never a display face as body |\n| Type sizes | `type_scale` / `check_type` | modular, ≤7 sizes |\n| Spacing | `spacing_scale` / `check_spacing` | one base grid |\n| Radii | `radius_scale` / `check_radius` | concentric nesting |\n| Shadows | `shadow` / `check_shadow` | layered, tinted — never flat |\n| Grid / measure | `layout` / `check_layout` | container tokens on the outer wrapper; no margin on inner |\n| Motion | `motion_tokens` / `check_motion` | ease-out, ≤500ms feedback, respects prefers-reduced-motion |\n| Whole token set | `audit_system` | per-domain verdicts + coherence score |\n\nA \"SLOP\" verdict gets fixed before shipping — the gate is objective.\n\n## Sources\nAdapted from impeccable.style, the personality skill, and the UI/UX Design Index\n(Kole Jain, Juxtopposed, Mizko, DesignCourse, Jesse Showalter, Charli Marie, Flux\nAcademy).";

// Short server-level guidance, injected into the model's context by clients that honor
// the MCP `instructions` field on connect — so the two most-broken rules ride along even
// with no skill or prompt loaded. Keep it tight; it lands in the system prompt.
export const INSTRUCTIONS = "fix-ai-slop is a design engine: it judges and generates non-slop design tokens (color, fonts, spacing, radius, shadow, layout, motion) with deterministic math. When building or reviewing any UI, route every deterministic decision to these tools: understand the subject first, ask only what's genuinely unclear, call `design_system` for a coherent baseline or the per-domain tools, then audit with the `check_*` tools / `audit_system` and fix anything marked SLOP. The two rules that break most AI designs: FONTS — `suggest_fonts` returns a pairing; `pairing.body` is the readable face, NEVER set a display/novelty font as body text. LAYOUT — use the container tokens `layout` returns (maxWidth + paddingInline); NEVER re-add margin on top of `inner`. Guided workflow: 6 prompts via prompts/list — improve_design, design_review, theme, colorize, typeset, polish.";

export const VERBS = [
  {
    name: "improve_design",
    description: "Full flow: audit the current design and rebuild it distinctive + readable.",
    args: [{ name: "target", description: "File or URL to improve (optional).", required: false }],
    body: "Before any tool call, understand the subject: read the target if given, else infer\nfrom the brief or codebase what this is, who uses it, and what real material it\ndraws from. Ask only what's genuinely unclear — no fixed questionnaire.\n\nFlow: forbid the median for this subject; decide whether the page wants a\ncentrepiece and commit to ONE grounded in its real mechanic if so; call\n`design_system` once with `hue` / `energy` / `accent` / `intent` from the subject.\nRoute the rest: `suggest_fonts` (pairing.body is the readable face — never display\nas body), `structure_ideas`, `layout` (container tokens on the wrapper; no margin\non inner), `type_scale`, `spacing_scale`, `radius_scale`, `shadow`,\n`motion_tokens`. Verify colors with `check_color` / `check_palette` as you place\nthem. Finish with `audit_system`.\n\nSelf-check: one centrepiece (or a deliberate none) that fails the swap test? Every\ntoken from a tool, not a guess? `audit_system` clean?",
  },
  {
    name: "design_review",
    description: "Audit an existing page for slop and give fixes.",
    args: [{ name: "target", description: "File or URL to review.", required: false }],
    body: "Before auditing, understand what \"good\" means here: skim the target, infer the\naudience and the page's job; ask only about genuine ambiguity.\n\nHunt the ranked tells, in the order they show up: shadcn/Tailwind default kit\n(slate cards, one recycled blue, uniform padding and rounding) — `check_color` /\n`check_palette` / `check_layout`, fix by grounding in the subject; AI-purple/indigo\naccent — `check_color`; purple→blue gradient or gradient-on-text — ban outright;\nover-animation — `check_motion`, keep only motion that carries meaning;\nemoji-as-icons — swap for the one real icon set; default Inter/Geist —\n`check_font` / `suggest_fonts`; symmetric hero + three cards + CTA —\n`check_layout` / `structure_ideas`, break it with a real hero and section variety.\nThen `audit_system` over extracted tokens, plus `check_type`, `check_spacing`,\n`check_radius`, `check_shadow` on what shipped. Flag banned colors, display-font\nbody text, margin stacked on a layout inner, opacity:0-until-scroll, and a missing\ncentrepiece. Every finding names its concrete fix (`generate_palette`,\n`suggest_fonts`, …), not just a verdict.\n\nSelf-check: every finding cites a tool verdict? Ranked tells checked specifically?\nFix list implementable with no follow-up questions?",
  },
  {
    name: "theme",
    description: "Generate one coherent token system from a brief.",
    args: [{ name: "brief", description: "What the theme is for.", required: false }],
    body: "Understand the brief before any tool: what it's for, who sees it, what real\nmaterial the palette comes from; ask only if unclear. A \"dark/techy\" brief doesn't\nearn the AI-startup look — challenge whether dark is earned at all.\n\nCall `design_system` once with `hue` / `energy` / `accent` / `intent` from that\nmaterial — never assemble a theme from unrelated one-off calls. Iterate the palette\nvia `generate_palette` + `check_palette`; verify fonts via `suggest_fonts` /\n`check_font` (pairing.body is the readable face). Re-roll from intent rather than\nhand-editing values — coherence comes from one system.\n\nSelf-check: palette derived from something real, not a category default? One\n`design_system` output (or its re-roll), not a patchwork? `audit_system` coherent,\nno domain SLOP?",
  },
  {
    name: "colorize",
    description: "Palette work: judge and generate gate-passing colors.",
    args: [{ name: "intent", description: "What the color is for + its real material/energy, e.g. 'accent for a coffee brand, warm', or an existing hex to anchor (optional).", required: false }],
    body: "Understand what the color is for — ground, accent, or categorical set — and what\nreal material it comes from, before picking; ask only if a hex or brand constraint\nisn't already clear.\n\nJudging: `check_color` / `check_palette` first; report plainly which banned band it\nfalls in and the gate it fails. Generating: `generate_palette` with `hue` /\n`energy` / `accent` / `intent` from the material — gate-passing, ≥4.5:1 — not a\nhand-picked hex. Categorical sets: every swatch passes; one banned color fails the\nset. Don't reach for muted-earthy (terracotta/ochre) reflexively — only if the\nsubject calls for it, confirmed by `check_color`.\n\nSelf-check: every proposed color passed `check_color` / `check_palette`? One\ncommitted accent used decisively, not several soft ones?",
  },
  {
    name: "typeset",
    description: "Typography, spacing and layout math.",
    args: [{ name: "context", description: "Content type.", required: false }],
    body: "Understand the content before any tool — marketing headline, long-form, dense data\ntable, product UI — and what the reading measure must support; ask only if that or\nan existing pairing to keep isn't clear.\n\n`suggest_fonts` → pairing.body is the readable face for running text, never a\ndisplay or novelty face, however striking it looks in a headline. Verify with\n`check_font`. Build the scale with `type_scale` (modular, ≤7 sizes) and\n`spacing_scale` (one base grid), verified with `check_type` / `check_spacing`. Call\n`layout` for the grid — container tokens (maxWidth + paddingInline) on the outer\nwrapper, no margin re-added on inner (it doubles the gutter). Verify with\n`check_layout`.\n\nSelf-check: body font traces to pairing.body? No margin stacked on inner?\n`check_type` / `check_spacing` / `check_layout` clean?",
  },
  {
    name: "polish",
    description: "Finishing pass: motion, shadow, radius, controls.",
    args: [],
    body: "Understand the stage before touching tokens — near-ship or early draft, which\nsurfaces need finishing, whether prefers-reduced-motion is already handled; ask\nonly if not obvious from the target.\n\nRun the finishing tools: `radius_scale` / `check_radius` (concentric nesting),\n`shadow` / `check_shadow` (layered, tinted — never a flat default), `motion_tokens`\n/ `check_motion` (ease-out, ≤500ms feedback, reduced-motion respected, nothing\nhidden behind opacity:0-until-scroll). Control sizing and radii read as one family.\nRe-run `audit_system` if a fuller token set is available.\n\nSelf-check: shadows layered and tinted, not flat? Motion degrades cleanly under\nprefers-reduced-motion, no content hidden pre-JS?",
  },
];

export function renderPrompt(name, args = {}) {
  const v = VERBS.find((x) => x.name === name);
  if (!v) throw new Error(`unknown prompt: ${name}`);
  let body = v.body;
  for (const [k, val] of Object.entries(args || {})) body = body.split(`{{${k}}}`).join(String(val));
  return {
    description: v.description,
    messages: [{ role: "user", content: { type: "text", text: `${PREAMBLE}\n\n## ${v.name}\n${body}` } }],
  };
}

const VERB_BY_NAME = Object.fromEntries(VERBS.map((v) => [v.name, v]));

// The installable skill is STAGGERED: SKILL.md is a cheap index that carries the two
// rules + a map of passes. Each pass loads on demand (renderVerbFile); the full design
// law lives in design-law.md (= PREAMBLE). Loading the index is cheap; detail is pulled
// only when the task needs it.
export function renderSkill() {
  const rows = VERBS.map((v) => `| ${v.description} | \`${v.name}.md\` | \`/fix-ai-slop:${v.name}\` |`).join("\n");
  const refRows = REFERENCE.map((r) => `| ${r.title} — ${r.when} | \`reference/${r.key}.md\` |`).join("\n");
  return `---
name: fix-ai-slop
description: Fix AI-slop design. Staggered skill — this index carries the two rules that break most AI UIs plus a map of passes you load on demand. Use when building or reviewing any UI, page, or component with the fix-ai-slop MCP tools.
license: Apache-2.0. Adapted from impeccable.style, the personality skill, and the UI/UX Design Index (Kole Jain, Juxtopposed, Mizko, DesignCourse, Jesse Showalter, Charli Marie, Flux Academy).
---

# fix-ai-slop — index

The \`fix-ai-slop\` MCP judges and generates non-slop design tokens (color, fonts,
spacing, radius, shadow, layout, motion) with deterministic math. Route every
deterministic decision to a tool; the ONE bold centrepiece stays yours.

## The two rules that break most AI designs — always apply
- **Fonts:** \`suggest_fonts\` returns a pairing — \`pairing.body\` is the readable face.
  NEVER set a display or novelty font as body / paragraph text.
- **Layout:** use the \`container\` tokens from \`layout\` (maxWidth + paddingInline).
  NEVER re-add margin on top of \`inner\` — it double-counts and breaks alignment.

## Load a pass on demand
Read only the file(s) the request needs — or invoke the matching MCP prompt. Run one
pass or chain several in order; decide from what the user actually asked for.

| For | Load | Or prompt |
|---|---|---|
${rows}

For the complete design law (all five gates, forbid-the-median, the ONE-centrepiece
bar) load \`design-law.md\`. Unsure which pass? Load \`improve_design.md\` — it runs the
full flow.

## Reference — pull a topic only when you want depth
Craft knowledge, not law. Load one of these ONLY if the task needs that depth;
otherwise ship against the gates, and prefer your own subject-grounded invention
over any example here.

| Topic | Load |
|---|---|
${refRows}

Keep this index in context; pull detail only when you act on it.
`;
}

// One pass, loaded on demand. Lean — the gates live in design-law.md / the index.
export function renderVerbFile(name) {
  const v = VERB_BY_NAME[name];
  if (!v) return null;
  return `# fix-ai-slop — ${name}\n\n${v.body}\n\n_The hard gates, forbid-the-median, and the ONE-centrepiece bar live in \`design-law.md\` and the fix-ai-slop index — load them if they aren't already in context._\n`;
}
