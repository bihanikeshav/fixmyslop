# fix-ai-slop — colorize

Understand what the color is for — ground, accent, or categorical set — and what
real material it comes from, before picking; ask only if a hex or brand constraint
isn't already clear.

Judging: `check_color` / `check_palette` first; report plainly which banned band it
falls in and the gate it fails. Generating: `generate_palette` with `hue` /
`energy` / `accent` / `intent` from the material — gate-passing, ≥4.5:1 — not a
hand-picked hex. Categorical sets: every swatch passes; one banned color fails the
set. Don't reach for muted-earthy (terracotta/ochre) reflexively — only if the
subject calls for it, confirmed by `check_color`.

Self-check: every proposed color passed `check_color` / `check_palette`? One
committed accent used decisively, not several soft ones?

_The hard gates, forbid-the-median, and the ONE-centrepiece bar live in `design-law.md` and the fix-ai-slop index — load them if they aren't already in context._
