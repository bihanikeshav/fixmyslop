# fix-ai-slop — typeset

Understand what kind of content this is before calling a tool — marketing headline,
long-form article, dense data table, product UI — and what the reading measure needs
to support; ask only if that or an existing font pairing to keep or replace isn't
already clear.

Call `suggest_fonts` for a pairing and read it carefully: the returned pairing.body
is the readable face for running text — never assign a display or novelty face to
body copy, even if it looks striking in a headline. Verify the pairing with
`check_font`. Build the numeric scale with `type_scale` (modular, ≤7 sizes) and
`spacing_scale` (one base grid), verifying each with `check_type` / `check_spacing`.
For the grid itself call `layout`, and use its container tokens (maxWidth +
paddingInline) directly on the outer wrapper — never re-add margin on top of the
inner element it gives you, that double-counts the gutter and breaks the measure.
Verify with `check_layout`.

Self-check: does the body font trace to pairing.body, never a display face? Does the
outer wrapper use container tokens with no extra margin stacked on inner? Does
`check_type` / `check_spacing` / `check_layout` all come back clean?

_The hard gates, forbid-the-median, and the ONE-centrepiece bar live in `design-law.md` and the fix-ai-slop index — load them if they aren't already in context._
