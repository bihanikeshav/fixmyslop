# fix-ai-slop — the design law

You are building or reviewing a real interface. Deterministic decisions (color,
fonts, type scale, spacing, radius, shadow, layout, motion) are computed by the
fix-ai-slop engine, never guessed. Taste and ideation stay yours. Everything below
except the hard gates is leverage, not law — diverge from it when the subject earns
it; only the gates are non-negotiable.

## Hard gates (the only non-negotiables)
- **Color.** No indigo/violet AI-accent (hue ~215–280, S>55%, mid lightness). No
  electric cyan/mint glow on dark. No indigo→cyan or violet→pink gradient — never
  gradient-on-text. No near-black ground (L<15%) + saturated glow: dark+neon is
  banned even for a "dark" brief; if dark is earned, give the ground a real hue and
  no glowing accent. No reflexive fintech-blue CTA. No cream + serif-display + gold
  cluster. Derive the accent from the subject's real material, not the category
  vibe. Run `check_color` / `check_palette` on every color that ships.
- **Render.** Core content — centrepiece, headings, body copy — visible in markup on
  load, without JS. Never opacity:0-until-scroll; reveals start from a present state.
- **Type.** Display faces may be loud. Body is a readable workhorse — never a
  display or novelty face for running text. This is the #1 way builds break.
- **Assets.** One real icon set (Lucide, Phosphor, Feather, Heroicons — pick one,
  never mix). NEVER emoji as icons, bullets, or chrome. Never hand-draw illustrative
  SVG (figures, scenes, mascots) — it reads as AI-slop instantly.
- **Contrast.** Every text/background pair meets WCAG AA (4.5:1 body, 3:1 large/UI)
  — computed, not eyeballed. Warm-on-warm-dark pairs look fine and measure poorly.

## Palette = intent, not seed
Ground `generate_palette` / `design_system` in the subject: pass `hue` (read off
real material — terracotta ~40, forest ~150, ocean ~230), `energy`
(muted | balanced | bold), `accent` (a hex to anchor), or `intent` (free text, e.g.
"coffee roastery, warm, industrial"). Omit all only for a deliberately ungrounded
roll. It is never a "seed" — intent traces to the subject.

## Forbid the median
Name the median for this brief (safe font, headline-left + widget-card-right hero,
italic accent word, fake metric card, muted-earthy "tasteful" palette) and refuse
the whole cluster — swapping indigo for cream+gold is not divergence. Mine layout,
type move, and font character from THIS subject. Swap test: if the page could
belong to another brief unchanged, change an axis and retry.

## The ONE centrepiece
Decide FIRST whether the page wants one: dashboards usually don't (a hero-sized
moment steals density from the data); landings usually do. If yes: exactly one
nameable, subject-grounded centrepiece, in markup on load — an interactive or
computed instrument, a bold typographic or spatial statement, ONE signature motion,
ambient background animation, a single attention-holding prop, or a data-driven
visual. Personality ornaments live in the margins, never on the message — headline
and body stay calm and legible. Discriminator: swapping the subject should BREAK
it. A palette, a mood, a parallax blob, or a screenshot doesn't qualify.

## Layout
Wireframe-first: structure must hold in grayscale before any palette. Five-second
scroll test: a stranger grasps the product from structure alone. Hold a grid
rhythm; break it once, deliberately. Vary width, media placement, and density
section to section — no repeated identical slabs. Hero = specific promise + real
product visual + ONE primary CTA + one conversion path. Match radius language
between media and controls. Route archetype/hero calls through `structure_ideas`
and grid math through `layout` — use its container tokens on the outer wrapper and
never re-add margin on `inner` (it doubles the gutter). Marketing can run big type
and whitespace; dashboards stay small and dense.

## Generation policy
Underspecified request → invent the token system first (`design_system`), then
place content into it. Never paper over weak structure with gradients, stock
photos, extra widgets, or decorative dead cards.

## Ship essentials
- Hierarchy reads in grayscale — color never does hierarchy's job.
- Neutrals dominate; the accent is scarce; semantic colors stay distinct from it.
- Design the empty, loading, error, and success states.

## Decision → Tool
| Deciding… | Tool | Notes |
|---|---|---|
| Whole theme | `design_system` | one coherent pass; ground with `hue` / `energy` / `accent` / `intent` |
| One coherent direction | `resolve_intent` → `style_genome` | normalize a StyleIntent, then resolve fonts+palette+layout+material together; feed prior fingerprints back to diverge |
| Layout family | `suggest_layout` | interpretable LayoutGenome candidates (section grammar + material slots) for the page kind |
| Fonts by neighbor | `font_neighbors` | 'more like X' visual neighbors + a hard body-readability gate |
| Ideation / divergence | `structure_ideas` | forbid-the-median + the hero/centrepiece call |
| Is a color OK? | `check_color` / `check_palette` | slop gate + passing alternatives |
| Fresh palette | `generate_palette` | grounded, gate-passing, ≥4.5:1 |
| Fonts | `suggest_fonts` / `check_font` | pairing.body is the readable face — never a display face as body |
| Type sizes | `type_scale` / `check_type` | modular, ≤7 sizes |
| Spacing | `spacing_scale` / `check_spacing` | one base grid |
| Radii | `radius_scale` / `check_radius` | concentric nesting |
| Shadows | `shadow` / `check_shadow` | layered, tinted — never flat |
| Grid / measure | `layout` / `check_layout` | container tokens on the outer wrapper; no margin on inner |
| Motion | `motion_tokens` / `check_motion` | ease-out, ≤500ms feedback, respects prefers-reduced-motion |
| Whole token set | `audit_system` | per-domain verdicts + coherence score |

A "SLOP" verdict gets fixed before shipping — the gate is objective.

## Sources
Adapted from impeccable.style, the personality skill, and the UI/UX Design Index
(Kole Jain, Juxtopposed, Mizko, DesignCourse, Jesse Showalter, Charli Marie, Flux
Academy).