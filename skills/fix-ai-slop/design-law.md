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
  Emit `<!doctype html>` and `<meta charset="utf-8">` — without it, refined punctuation
  (— · • “ ”) decodes as mojibake (`â€"`, `Â·`), which reads as broken, not designed.
- **Type.** Display faces may be loud. Body is a readable workhorse — never a
  display or novelty face for running text. This is the #1 way builds break. A
  family is not shippable until its runtime asset exists, its role gate passes, and
  the exact pair has been rendered with `document.fonts.ready`.
- **Assets.** One real icon set (Lucide, Phosphor, Feather, Heroicons — pick one,
  never mix). NEVER emoji as icons, bullets, or chrome. Never hand-draw illustrative
  SVG (figures, scenes, mascots) — it reads as AI-slop instantly. Run `check_svg` on
  every generated SVG: viewBox, finite geometry, unique references, accessibility,
  no scripts/foreignObject/external URLs; use host-managed CSS/GSAP for motion.
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
the whole cluster — swapping indigo for cream+gold is not divergence. The Linear/Vercel/Stripe look (dark + monochrome + one blue/purple accent + Geist/Inter + glass) is itself a median cluster — refuse it wholesale; take the discipline (restraint, high contrast, density, keyboard-first — see reference/product-ui.md), never the skin. Mine layout,
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

## Balance & restraint
The two failures that read as "ugly" even when palette and fonts are fine: weight
that doesn't resolve, and detail that was added instead of removed. All grounded in
`docs/design-research/{visual-hierarchy,composition-and-boldness,layout-grids-spacing,gestalt,cognitive-load}.md`.
- **One element wins.** You can't emphasize everything — for something to lead, the
  rest must recede. One dominant, one sub-dominant, the rest subordinate (three levels,
  not five). Never two co-equal big-bold headlines in adjacent columns. Isolate ONE
  thing; isolating several dilutes the emphasis to zero (Von Restorff).
- **Squint gate (mandatory before ship).** Blur the render (`filter: blur(8px)`). The
  element you meant as primary must still be the most prominent shape. If it isn't, the
  hierarchy is broken — fix it, don't ship it.
- **Balance by weight, and resolve the edges.** A large element balances against several
  small ones plus negative space — calibrate it; never strand a column. Columns and
  sections resolve to shared baselines and bottom edges; misaligned axes make related
  content feel unrelated. Align to as few axes as possible.
- **Height is content-driven, never a fixed frame.** Don't box content in fixed
  dimensions it can't fill — trapped leftover space reads as an error, and an empty
  multi-column is a tell. Negative space must amplify the primary, not sit as dead gap.
  Prefer fluid edges (`clamp()`) so content fills rather than traps. If a column empties
  out, rebalance widths or merge — don't pad the void.
- **Reach the design by removal.** Start with too much space and remove it. Sleek is
  subtraction: scale, contrast, and structure carry boldness; gradients, glass, and extra
  chrome do not. Load-bearing test — keep a move only if removing it would break the
  argument; if removal changes nothing, remove it.
- **Encode each fact once.** One status = one channel (a color OR a dot OR a word, not
  all three); stacking cues pollutes the signal. Cap treatments per row/level;
  de-emphasize secondary content (muted, lighter) instead of adding another marker. Bold
  stays under ~15–20% or it stops meaning anything.
- **Label groups, not blocks.** A heading set tight above its content already reads as
  its label by proximity — a mono eyebrow on top of it is redundant load. The
  eyebrow-chip-on-every-block cluster is named slop; use kickers only where real
  structure needs them.
- **Boxes are additive signal, not a default.** Whitespace between sections usually
  groups them; reach for a border only when spacing can't. Boxitis — every section in its
  own card — collapses the hierarchy into equal regions.
- **Spacing inequality is the grouping signal.** Equal spacing everywhere destroys
  grouping. Related tighter, unrelated looser — a 2:1 between-vs-within ratio is a
  reliable start; a label→input gap must be smaller than field→field; more space above a
  heading than below it.

## Generation policy
Underspecified request → invent the token system first (`design_system`), then
place content into it. Never paper over weak structure with gradients, stock
photos, extra widgets, or decorative dead cards.

## Ship essentials
- Hierarchy reads in grayscale — color never does hierarchy's job.
- One element dominates the squint test (`filter: blur(8px)`) — if the primary isn't the
  most prominent blurred shape, the hierarchy is broken.
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
| Fonts | `connected_style_genome` / `suggest_fonts` / `check_font` | require asset.available + roleSuitability; render exact @font-face pair before ship |
| Type sizes | `type_scale` / `check_type` | modular, ≤7 sizes |
| Spacing | `spacing_scale` / `check_spacing` | one base grid |
| Radii | `radius_scale` / `check_radius` | concentric nesting |
| Shadows | `shadow` / `check_shadow` | layered, tinted — never flat |
| Grid / measure | `layout` / `check_layout` | container tokens on the outer wrapper; no margin on inner |
| Motion | `motion_tokens` / `check_motion` | ease-out, ≤500ms feedback, respects prefers-reduced-motion |
| SVG | `check_svg` | reject malformed/unsafe/broken LLM paths; use one reviewed icon set |
| Whole token set | `audit_system` | per-domain verdicts + coherence score |
| Composition balance | `check_composition` | trapped whitespace / swallowing block / monotony over a section grammar |
| Full color scale | `shade_ramp` / `semantic_colors` | 50→950 ramp + gate-clean status colors beyond the 5 roles |
| UX copy & flows | `audit_microcopy` / `generate_empty_state` | outcome CTAs, recoverable errors, three-layer empty states |
| A11y / forms / states / nav | `audit_accessibility` / `audit_form` / `check_component_states` / `check_information_architecture` | beyond contrast: 44px targets, focus, labels, full state matrix, Hick's/Miller's |

A "SLOP" verdict gets fixed before shipping — the gate is objective.

## Sources
Adapted from impeccable.style, the personality skill, and the UI/UX Design Index
(Kole Jain, Juxtopposed, Mizko, DesignCourse, Jesse Showalter, Charli Marie, Flux
Academy).
