# fix-ai-slop — improve_design

Before any tool call, ask the user: what is this page/product, who is it for, and
give a one-word vibe or reference point. If a target was provided, read it first so
your questions are specific, not generic.

Then run the flow: forbid the median for this subject (name the safe layout/font/
palette cluster and refuse it), commit ONE standout grounded in the subject's real
mechanic, then call `design_system` once for a coherent token baseline. Route every
remaining deterministic decision through its tool: `suggest_fonts` (its pairing.body
is the readable face — never a display face for body text), `layout` (use its
container tokens for the outer wrapper; never re-add margin on top of inner),
`type_scale`, `spacing_scale`, `radius_scale`, `shadow`, `motion_tokens`. Verify colors
with `check_color` / `check_palette` as you place them. Finish with `audit_system` over
the finished token set.

Self-check: did you ask before building? Is there exactly one nameable standout that
fails the swap test if removed? Does every token trace back to a tool call rather than
a guess? Did `audit_system` come back clean with no domain marked SLOP?

_The hard gates, forbid-the-median, and the ONE-standout bar live in `design-law.md` and the fix-ai-slop index — load them if they aren't already in context._
