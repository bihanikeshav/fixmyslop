# fix-ai-slop — typeset

Understand the content before any tool — marketing headline, long-form, dense data
table, product UI — and what the reading measure must support; ask only if that or
an existing pairing to keep isn't clear.

`suggest_fonts` → pairing.body is the readable face for running text, never a
display or novelty face, however striking it looks in a headline. Verify with
`check_font`. Build the scale with `type_scale` (modular, ≤7 sizes) and
`spacing_scale` (one base grid), verified with `check_type` / `check_spacing`. Call
`layout` for the grid — container tokens (maxWidth + paddingInline) on the outer
wrapper, no margin re-added on inner (it doubles the gutter). Verify with
`check_layout`.

Self-check: body font traces to pairing.body? No margin stacked on inner?
`check_type` / `check_spacing` / `check_layout` clean?

_The hard gates, forbid-the-median, and the ONE-centrepiece bar live in `design-law.md` and the fix-ai-slop index — load them if they aren't already in context._
