# fix-ai-slop — theme

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

_The hard gates, forbid-the-median, and the ONE-standout bar live in `design-law.md` and the fix-ai-slop index — load them if they aren't already in context._
