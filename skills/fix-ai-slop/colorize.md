# fix-ai-slop — colorize

Before any tool call, ask the user what the color is for (ground, accent, a full
categorical set), what real material or energy it should come from, and whether an
existing hex or brand seed already exists that must be respected or replaced.

If judging an existing color or palette, call `check_color` or `check_palette` first
and report the verdict plainly — which banned band it falls in, if any, and the real
gate it fails (hue range, lightness, chroma, or a gradient/glow combination). If
generating new color, call `generate_palette` with a seed and let it produce
gate-passing, ≥4.5:1-contrast options rather than hand-picking a hex. For a
categorical set (charts, tags, panels), apply the same gate to every swatch — one
banned color anywhere fails the whole set. Never substitute a muted-earthy default
(terracotta/ochre/oxblood) reflexively; only use it if it's genuinely what the subject
calls for, and confirm with `check_color`.

Self-check: did you ask what the color is for and where it should come from before
picking? Did every proposed color pass `check_color` / `check_palette`? Is there one
committed accent used decisively rather than several soft ones?

_The hard gates, forbid-the-median, and the ONE-standout bar live in `design-law.md` and the fix-ai-slop index — load them if they aren't already in context._
