# fix-ai-slop — the design law

You are building or reviewing a real interface. Every deterministic decision (color,
fonts, type scale, spacing, radius, shadow, layout, motion) is computed by the
fix-ai-slop engine, never guessed. Taste and ideation — the ONE centrepiece, the
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
- **Render gate.** Core content — the centrepiece, the headings, the body copy — must
  be visible in markup on load and without JavaScript. Never gate primary content
  behind `opacity:0`-until-scroll; a reveal-on-scroll must start from a present state.
- **Type gate.** Display faces may be loud and characterful. Body text is a readable
  workhorse — never a novelty, display, or hand-condensed face for running text. This
  is the single most common way a build breaks: a beautiful display font gets reused
  for paragraphs and the page becomes unreadable.
- **Assets gate.** Use premade components and icon sets. Never hand-draw illustrative
  SVG (figures, objects, scenes, mascots) — it reads as AI-slop the instant it ships.
  Pick exactly ONE icon set from a real library (Lucide, Phosphor, Feather, Heroicons —
  one, never mixed) for all chrome. NEVER use emoji as icons, section bullets, or
  chrome of any kind — a stray 🚀 or ✨ standing in for an icon reads as amateur/AI-slop
  instantly, no matter how refined everything around it is.
- **Contrast gate.** Every text/background pair meets WCAG AA (4.5:1 body text, 3:1
  large text and UI elements) — computed, not eyeballed. Watch warm-text-on-warm-dark
  pairs; they look fine and measure poorly.

## Palette intent, not palette seed
`generate_palette` and `design_system` derive color from the subject's real material
or energy, never a random number. Pass `hue` (a target 0–360 read off the actual
material — terracotta ~40, forest ~150, ocean ~230), `energy` (muted | balanced |
bold), `accent` (an existing hex to anchor to a brand or reference), or `intent`
(free text, e.g. "coffee roastery, warm, industrial"). Omit all of them only when a
fresh, ungrounded roll is genuinely what's wanted. Never describe this to anyone as
picking a "seed" — a seed is arbitrary; intent is a decision traceable to the subject.

## Forbid the median
Before building, name the median for this brief out loud: the safe font, the
headline-left + bordered-widget-card-right hero, the italic-accent word, the fake
metric card, the muted-earthy "tasteful" palette. Refuse the whole cluster, not one
item — swapping indigo for cream+gold is not divergence. Pick a different layout
archetype, a different type move, and a different font character than your last
build, all mined from THIS subject, not a default list. Then run the swap test:
if this page could belong to another brief unchanged, you didn't diverge — change
an axis and try again.

## The ONE centrepiece
Decide FIRST whether this page even wants a centrepiece: a dense dashboard usually
doesn't — a hero-sized moment steals density from the data it exists to show; a
landing page or marketing surface usually does. If yes, every page ships exactly one
nameable, functional, subject-grounded centrepiece — not atmosphere, not a mood, not
a palette. It can be more than a calculator or widget: an interactive or computed
instrument, a bold typographic or spatial statement, ONE signature motion, a small
constellation of ambient background animation, a single attention-holding container
or prop, or a data-driven visual — but there is only ever ONE, and it must be built
from the subject's real data or mechanic, rendered in markup on load, and unique
enough that pasting it on a competitor's site would look wrong. Personality ornaments
live in the margins around calm text — never on the message itself; the headline and
body copy stay legible and quiet even when the centrepiece around them is loud. The
swap test is the discriminator: swapping the subject should BREAK the artifact. A
color palette, a serif-on-cream mood, a parallax blob, or a product screenshot does
not qualify, no matter how polished.

## Layout
Wireframe-first: if the structure fails in grayscale, with no color or imagery, the
visuals will not save it — resolve hierarchy and grouping before touching a palette.
Five-second scroll test: a stranger should grasp what the product is from structure
alone, before reading a word. Hold a clear grid rhythm and break the pattern only
once, deliberately, for a moment that earns the surprise — not every section
alternating identical slabs. Give sections rhythm WITH variety: vary width, media
placement, and density section to section instead of repeating one template down the
page. A hero is a specific promise + a real product visual (not stock art) + ONE
primary CTA + one conversion path — not a slogan floating over a gradient. Match the
radius language between media and controls; a rounded product shot next to
square-cornered buttons reads as unconsidered. Route the decision through
`structure_ideas` for the archetype and the hero/centrepiece call, and `layout` for
the grid/container math — use the container tokens it returns for the outer wrapper
and never re-add margin on top of `inner`, or you double the gutter. Marketing
surfaces can run big display type and confident whitespace; dashboards keep UI text
small and dense and protect that density from hero-sized intrusions.

## Generation policy
If a request is underspecified, invent a coherent token system FIRST
(`design_system`), then place content into it. Never compensate for weak structure
with gradients, stock photos, or extra widgets — and never pad a layout with a
decorative dead card or a widget that isn't wired to anything real.

## Ship-checklist essentials
- Hierarchy must read correctly in grayscale — if color is doing the hierarchy's job,
  the hierarchy is broken.
- Neutrals dominate; the accent is scarce and deliberate; semantic colors (success,
  warning, danger, info) stay distinct from the accent, never reused for it.
- Design the empty, loading, error, and success states — not only the happy screen.
- No decorative dead cards (a card with nothing real behind it) and no vanity KPI
  strip duplicated across unrelated pages.

## Decision → Tool
| Deciding… | Tool | Notes |
|---|---|---|
| Whole theme at once | `design_system` | palette + type + spacing + radius + shadow + motion in one coherent pass — pass `hue` / `energy` / `accent` / `intent` to ground the palette in the subject |
| Ideation / divergence | `structure_ideas` | forbid-the-median structuring + the hero/centrepiece call, before you touch a tool |
| Is a color OK? | `check_color` / `check_palette` | slop gate + gate-passing alternatives |
| A fresh palette | `generate_palette` | pass `hue` / `energy` / `accent` / `intent` for a grounded, gate-passing, ≥4.5:1 contrast result |
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

## Sources
This design law is adapted from impeccable.style, the personality skill, and the
UI/UX Design Index (Kole Jain, Juxtopposed, Mizko, DesignCourse, Jesse Showalter,
Charli Marie, Flux Academy).