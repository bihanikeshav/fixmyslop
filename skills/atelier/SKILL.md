---
name: atelier
description: Build a web page whose every deterministic design decision (palette, type scale, spacing, radius, shadow, layout, motion, control sizing) is computed by the ai-slop-font engine instead of guessed — while the ONE bold standout is invented by the /personality ideation process. Use when you want distinctive, non-slop UI with tokens that are mathematically coherent, not vibes.
license: Apache-2.0. Design flow adapted from impeccable.style and Anthropic's frontend-design skill; ideation from the personality skill. See ../personality/reference/slop-manifest.md for attribution.
---

An atelier measures twice. This skill keeps the **taste and ideation** of `/personality`
(forbid-the-median, ONE subject-grounded standout, the hard gates) and hands every
**deterministic** decision to the engine — so you stop eyeballing spacing, shadows, and
grids. The engine is pure math; it is the source of truth the live MCP also serves.

## Two front doors to the same engine
- **Local (default in Claude Code):** `node apps/engine/cli.mjs <tool> <args>`
  - `node apps/engine/cli.mjs design_system '{"seed":7,"baseFont":18}'`
  - `node apps/engine/cli.mjs shadow 4`
  - `node apps/engine/cli.mjs check_palette '{"ground":"#eee","ink":"#111","accent":"#c33"}'`
- **Remote (any MCP client / agent):** the ai-slop-font Worker — `POST /mcp` or `/api/tool/<name>`.

Both run the identical `apps/engine` module. Verdicts never drift.

## The flow (impeccable's, re-wired)
1. **Absorb + Diverge + Forbid the median** — exactly as `/personality` (read its
   `reference/composition-and-boldness.md` and `reference/hero-artifacts.md`). Invent ONE
   standout. This step is human taste; the engine does not do it.
2. **Commit the theme with math, not vibes** — call `design_system` once for a coherent
   baseline, then adjust intent (ratio, base unit, elevation) and re-roll:
   `node apps/engine/cli.mjs design_system '{"seed":<n>,"ratio":"perfect-fourth"}'`.
3. **Every deterministic decision → a tool** (table below). Never hand-pick these.
4. **Audit before shipping** — run each auditor over what you actually wrote; fix
   anything that returns `verdict:"SLOP"`.

## Decision → Tool
| Deciding… | Tool | Notes |
|---|---|---|
| Whole theme at once | `design_system` | palette + type + spacing + radius + shadow + motion |
| A color is OK? | `check_color` / `check_palette` | slop gate + fresh alternatives |
| A fresh palette | `generate_palette` | seeded, gate-passing, ≥4.5:1 contrast |
| Fonts | `suggest_fonts` / `check_font` | off the AI monoculture |
| Type sizes | `type_scale` / `check_type` | modular; ≤7 sizes |
| Spacing | `spacing_scale` / `check_spacing` | one base grid |
| Corner radii | `radius_scale` / `check_radius` | concentric nesting |
| Shadows | `shadow` / `check_shadow` | layered, tinted — not `0 4px 6px rgba(0,0,0,.1)` |
| Grid / measure / splits | `layout` / `check_layout` | 45–75ch measure, fitted columns |
| Motion | `motion_tokens` / `check_motion` | ease-out only, ≤500ms feedback |
| A whole submitted token set | `audit_system` | per-domain verdicts + coherence score |

## Hard gates (inherited from /personality — non-negotiable)
Read and obey `../personality/reference/slop-colors.md` (color), the render gate, the type
gate, the assets gate, and the contrast gate in `../personality/SKILL.md`. The engine
ENFORCES the color/contrast gates numerically; the standout, render, type-character, and
no-drawn-illustration gates are still yours to hold.

## Reference map (links, not copies)
- Ideation, layout archetypes, boldness → `../personality/reference/composition-and-boldness.md`
- The ONE standout bar + swap test → `../personality/reference/hero-artifacts.md`
- Color law → `../personality/reference/slop-colors.md`
- Polish + motion final pass → `../personality/reference/polish.md` + `../personality/reference/motion.md`
- Components / icons / a11y → `../personality/reference/components-and-assets.md`

## Self-check
Run `/personality`'s 13-point self-check, PLUS: did every token come from the engine
(not a guess)? Run `audit_system` on your final tokens — coherence should be 100 and no
domain `SLOP`. If a value is off-grid, a shadow is flat, or the measure is out of range,
the engine will have told you — fix it before shipping.
