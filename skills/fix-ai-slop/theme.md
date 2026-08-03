# fix-ai-slop — theme

Understand the brief before any tool: what it's for, who sees it, what real
material the palette comes from; ask only if unclear. A "dark/techy" brief doesn't
earn the AI-startup look — challenge whether dark is earned at all.

Call `design_system` once with `hue` / `energy` / `accent` / `intent` from that
material — never assemble a theme from unrelated one-off calls. Iterate the palette
via `generate_palette` + `check_palette`; verify fonts via `suggest_fonts` /
`check_font` (pairing.body is the readable face). Re-roll from intent rather than
hand-editing values — coherence comes from one system.

Self-check: palette derived from something real, not a category default? One
`design_system` output (or its re-roll), not a patchwork? `audit_system` coherent,
no domain SLOP?

_The hard gates, forbid-the-median, and the ONE-centrepiece bar live in `design-law.md` and the fix-ai-slop index — load them if they aren't already in context._
