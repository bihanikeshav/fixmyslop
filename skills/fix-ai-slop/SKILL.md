---
name: fix-ai-slop
description: Fix AI-slop design. Staggered skill — this index carries the two rules that break most AI UIs plus a map of passes you load on demand. Use when building or reviewing any UI, page, or component with the fix-ai-slop MCP tools.
license: Apache-2.0. Adapted from impeccable.style, the personality skill, and the UI/UX Design Index (Kole Jain, Juxtopposed, Mizko, DesignCourse, Jesse Showalter, Charli Marie, Flux Academy).
---

# fix-ai-slop — index

The `fix-ai-slop` MCP judges and generates non-slop design tokens (color, fonts,
spacing, radius, shadow, layout, motion) with deterministic math. Route every
deterministic decision to a tool; the ONE bold centrepiece stays yours.

## The two rules that break most AI designs — always apply
- **Fonts:** `suggest_fonts` returns a pairing — `pairing.body` is the readable face.
  NEVER set a display or novelty font as body / paragraph text.
- **Layout:** use the `container` tokens from `layout` (maxWidth + paddingInline).
  NEVER re-add margin on top of `inner` — it double-counts and breaks alignment.

## Load a pass on demand
Read only the file(s) the request needs — or invoke the matching MCP prompt. Run one
pass or chain several in order; decide from what the user actually asked for.

| For | Load | Or prompt |
|---|---|---|
| Full flow: audit the current design and rebuild it distinctive + readable. | `improve_design.md` | `/fix-ai-slop:improve_design` |
| Audit an existing page for slop and give fixes. | `design_review.md` | `/fix-ai-slop:design_review` |
| Generate one coherent token system from a brief. | `theme.md` | `/fix-ai-slop:theme` |
| Palette work: judge and generate gate-passing colors. | `colorize.md` | `/fix-ai-slop:colorize` |
| Typography, spacing and layout math. | `typeset.md` | `/fix-ai-slop:typeset` |
| Finishing pass: motion, shadow, radius, controls. | `polish.md` | `/fix-ai-slop:polish` |

For the complete design law (all five gates, forbid-the-median, the ONE-centrepiece
bar) load `design-law.md`. Unsure which pass? Load `improve_design.md` — it runs the
full flow. Keep this index in context; pull detail only when you act on it.
