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