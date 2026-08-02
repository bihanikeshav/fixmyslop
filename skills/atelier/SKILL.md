---
name: atelier
description: Engine-backed design process — gather direction, forbid the median, one bold standout, and route every deterministic decision (color, fonts, spacing, radius, shadow, layout, motion) to the ai-slop-font engine. Self-contained.
license: Apache-2.0. Adapted from impeccable.style and the personality skill.
---

# Atelier — the design law

You are building or reviewing a real interface. Every deterministic decision (color,
fonts, type scale, spacing, radius, shadow, layout, motion) is computed by the
ai-slop-font engine, never guessed. Taste and ideation — the ONE standout, the
composition — are still yours; math is not.

## Hard gates (non-negotiable — a build that fails any of these is not done)
- **Color gate.** No banned band: no indigo/violet AI-accent (hue ~215–280, S>55%,
  mid lightness), no electric cyan/mint-teal glow on dark, no indigo→cyan or
  violet→pink two-stop gradient (never gradient-on-text), no near-black ground
  (L<15%) paired with a saturated colored glow/blur, no reflexive fintech blue as the
  hero CTA, no cream-ground + serif-display + gold-accent cluster. Darkness is a trap,
  not a license — a dark brief does not excuse dark+neon; if dark is genuinely earned,
  give the ground a real hue and never let the accent glow. Derive the accent from the
  subject's real material or genuine energy, not the category vibe. Run `check_color` /
  `check_palette` on every color before it ships.
- **Render gate.** Core content — the standout, the headings, the body copy — must be
  visible in markup on load and without JavaScript. Never gate primary content behind
  `opacity:0`-until-scroll; a reveal-on-scroll must start from a present state.
- **Type gate.** Display faces may be loud and characterful. Body text is a readable
  workhorse — never a novelty, display, or hand-condensed face for running text. This
  is the single most common way a build breaks: a beautiful display font gets reused
  for paragraphs and the page becomes unreadable.
- **Assets gate.** Use premade components and icon sets. Never hand-draw illustrative
  SVG (figures, objects, scenes, mascots) — it reads as AI-slop the instant it ships.
- **Contrast gate.** Every text/background pair meets WCAG AA (4.5:1 body text, 3:1
  large text and UI elements) — computed, not eyeballed. Watch warm-text-on-warm-dark
  pairs; they look fine and measure poorly.

## Forbid the median
Before building, name the median for this brief out loud: the safe font, the
headline-left + bordered-widget-card-right hero, the italic-accent word, the fake
metric card, the muted-earthy "tasteful" palette. Refuse the whole cluster, not one
item — swapping indigo for cream+gold is not divergence. Pick a different layout
archetype, a different type move, and a different font character than your last
build, all mined from THIS subject, not a default list. Then run the swap test:
if this page could belong to another brief unchanged, you didn't diverge — change
an axis and try again.

## The ONE standout
Every page ships exactly one nameable, functional, subject-grounded component — not
atmosphere, not a mood, not a palette. It must be interactive or computed (not a
still image), built from the subject's real data or mechanic, rendered in markup on
load, and unique enough that pasting it on a competitor's site would look wrong. The
swap test is the discriminator: swapping the subject should BREAK the artifact. A
color palette, a serif-on-cream mood, a parallax blob, or a product screenshot does
not qualify, no matter how polished.

## Decision → Tool
| Deciding… | Tool | Notes |
|---|---|---|
| Whole theme at once | `design_system` | palette + type + spacing + radius + shadow + motion in one coherent pass |
| Ideation / divergence | `structure_ideas` | forbid-the-median structuring before you touch a tool |
| Is a color OK? | `check_color` / `check_palette` | slop gate + gate-passing alternatives |
| A fresh palette | `generate_palette` | seeded, gate-passing, ≥4.5:1 contrast |
| Fonts | `suggest_fonts` — the returned pairing.body is the readable face; NEVER set a display or novelty face as body text. Verify with `check_font` |
| Type sizes | `type_scale` / `check_type` | modular scale, ≤7 sizes |
| Spacing | `spacing_scale` / `check_spacing` | one base grid, no off-grid values |
| Corner radii | `radius_scale` / `check_radius` | concentric nesting |
| Shadows | `shadow` / `check_shadow` | layered, tinted — never a flat `0 4px 6px rgba(0,0,0,.1)` |
| Grid / measure / columns | `layout` — use the container tokens it returns (maxWidth + paddingInline) for your outer wrapper; NEVER re-add margin on top of inner, or you double the gutter. Verify with `check_layout` |
| Motion | `motion_tokens` / `check_motion` | ease-out only, ≤500ms feedback, respects prefers-reduced-motion |
| A whole submitted token set | `audit_system` | per-domain verdicts + a coherence score |

If a tool returns a "SLOP" verdict on anything you built, fix it before shipping —
the gate is objective, not a suggestion.

# Verbs

## improve_design
Before any tool call, ask the user: what is this page/product, who is it for, and
give a one-word vibe or reference point. If a target was provided, read it first so
your questions are specific, not generic.

Then run the flow: forbid the median for this subject (name the safe layout/font/
palette cluster and refuse it), commit ONE standout grounded in the subject's real
mechanic, then call `design_system` once for a coherent token baseline. Route every
remaining deterministic decision through its tool: `suggest_fonts` (its pairing.body
is the readable face — never a display face for body text), `layout` (use its
container tokens for the outer wrapper; never re-add margin on top of inner),
`type_scale`, `spacing_scale`, `radius_scale`, `shadow`, `motion_tokens`. Verify colors
with `check_color` / `check_palette` as you place them. Finish with `audit_system` over
the finished token set.

Self-check: did you ask before building? Is there exactly one nameable standout that
fails the swap test if removed? Does every token trace back to a tool call rather than
a guess? Did `audit_system` come back clean with no domain marked SLOP?

## design_review
Before any tool call, ask the user what "good" means for this page — what audience,
what the page is trying to make someone do, and whether there's a known problem area
(readability, color, layout) they already suspect. If a target was provided, skim it
first so your questions are pointed rather than generic.

Then audit systematically: run `audit_system` over the page's current tokens if they
can be extracted, and `check_color` / `check_palette`, `check_font`, `check_type`,
`check_spacing`, `check_radius`, `check_shadow`, `check_layout`, `check_motion`
individually over whatever is actually shipped. Flag any banned-band color, any
display font used as body text, any margin stacked on top of a layout-provided
inner/container, any content hidden behind opacity:0-until-scroll, and any
missing standout (atmosphere/mood with no functional component). For each finding,
name the concrete fix — re-run `suggest_fonts` or `generate_palette` where needed, not
just a verdict.

Self-check: does every finding cite a tool verdict, not just an opinion? Did you check
the font-as-body and layout-margin bugs specifically? Is the fix list concrete enough
to hand to an implementer with no follow-up questions?

## theme
Before any tool call, ask the user for the brief if it wasn't given: what is this
for, who sees it, what real material/energy should the palette derive from, and any
constraint (light/dark preference, an existing brand seed, a target ratio or base
unit). Do not let a "dark" or "techy" brief default you toward the AI-startup look —
push back and ask what's genuinely earned about darkness here, if anything.

Call `design_system` once with a seed and any stated intent (ratio, base unit,
elevation) for a coherent baseline covering palette, type, spacing, radius, shadow,
and motion together — never assemble a theme from unrelated one-off tool calls. If the
palette needs iteration, use `generate_palette` and verify with `check_palette`; verify
fonts with `suggest_fonts` / `check_font` (its pairing.body is the readable face —
never a display face for body). Re-roll the seed rather than hand-editing individual
values if something feels off; the engine's coherence depends on the values coming
from one system.

Self-check: did you ask for the brief and derive the palette from something real, not
a category default? Is the whole set one `design_system` output (or a re-roll of one),
not a patchwork? Does `audit_system` report full coherence with no domain SLOP?

## colorize
Before any tool call, ask the user what the color is for (ground, accent, a full
categorical set), what real material or energy it should come from, and whether an
existing hex or brand seed already exists that must be respected or replaced.

If judging an existing color or palette, call `check_color` or `check_palette` first
and report the verdict plainly — which banned band it falls in, if any, and the real
gate it fails (hue range, lightness, chroma, or a gradient/glow combination). If
generating new color, call `generate_palette` with a seed and let it produce
gate-passing, ≥4.5:1-contrast options rather than hand-picking a hex. For a
categorical set (charts, tags, panels), apply the same gate to every swatch — one
banned color anywhere fails the whole set. Never substitute a muted-earthy default
(terracotta/ochre/oxblood) reflexively; only use it if it's genuinely what the subject
calls for, and confirm with `check_color`.

Self-check: did you ask what the color is for and where it should come from before
picking? Did every proposed color pass `check_color` / `check_palette`? Is there one
committed accent used decisively rather than several soft ones?

## typeset
Before any tool call, ask the user what kind of content this is (marketing headline,
long-form article, dense data table, product UI), what the reading measure needs to
support, and whether a font pairing already exists that must be kept or replaced.

Call `suggest_fonts` for a pairing and read it carefully: the returned pairing.body
is the readable face for running text — never assign a display or novelty face to
body copy, even if it looks striking in a headline. Verify the pairing with
`check_font`. Build the numeric scale with `type_scale` (modular, ≤7 sizes) and
`spacing_scale` (one base grid), verifying each with `check_type` / `check_spacing`.
For the grid itself call `layout`, and use its container tokens (maxWidth +
paddingInline) directly on the outer wrapper — never re-add margin on top of the
inner element it gives you, that double-counts the gutter and breaks the measure.
Verify with `check_layout`.

Self-check: does the body font trace to pairing.body, never a display face? Does the
outer wrapper use container tokens with no extra margin stacked on inner? Does
`check_type` / `check_spacing` / `check_layout` all come back clean?

## polish
Before any tool call, ask the user what stage this is (near-ship vs. early draft),
which surfaces most need finishing (interactive controls, elevation/depth, motion),
and whether prefers-reduced-motion support is already handled elsewhere.

Then run the finishing tools in turn: `radius_scale` / `check_radius` for concentric
corner nesting across nested elements, `shadow` / `check_shadow` for layered, tinted
elevation (never a flat default box-shadow), and `motion_tokens` / `check_motion` for
ease-out timing capped around 500ms on feedback interactions, confirming
prefers-reduced-motion is respected and nothing primary is hidden behind
opacity:0-until-scroll. Check that control sizing and corner radii read as one
family rather than several unrelated values, and re-run `audit_system` if a fuller
token set is available to catch anything the individual checks miss.

Self-check: did you ask which surfaces needed the pass before touching tokens? Do
shadows read as layered and tinted rather than flat? Does motion degrade cleanly
under prefers-reduced-motion with no content hidden pre-JS?
