# fix-ai-slop — theme

Understand the brief before calling any tool: work out what this is for, who sees
it, and what real material or energy the palette should come from — ask only if
that's genuinely unclear, rather than running a fixed intake script. Don't let a
"dark" or "techy" brief default you toward the AI-startup look — push back on what's
genuinely earned about darkness here, if anything.

Call `design_system` once, passing `hue` / `energy` / `accent` / `intent` derived
from that real material (never an arbitrary seed), for a coherent baseline covering
palette, type, spacing, radius, shadow, and motion together — never assemble a theme
from unrelated one-off tool calls. If the palette needs iteration, call
`generate_palette` again with an adjusted `hue` / `energy` / `intent` and verify with
`check_palette`; verify fonts with `suggest_fonts` / `check_font` (its pairing.body
is the readable face — never a display face for body). Re-roll from intent rather
than hand-editing individual values if something feels off; the engine's coherence
depends on the values coming from one system.

Self-check: did you understand the brief and derive the palette from something real,
not a category default? Is the whole set one `design_system` output (or a re-roll of
one), not a patchwork? Does `audit_system` report full coherence with no domain
SLOP?

_The hard gates, forbid-the-median, and the ONE-centrepiece bar live in `design-law.md` and the fix-ai-slop index — load them if they aren't already in context._
