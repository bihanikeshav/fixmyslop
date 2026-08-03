# fix-ai-slop — improve_design

Understand the subject before calling any tool: if a target was given, read it
first; otherwise work out from the brief or codebase what this page or product
actually is, who uses it, and what real material or energy it should draw from. Ask
only what's genuinely unclear and material to the build — skip what you can
reasonably infer, and don't run a fixed script of questions.

Then run the flow: forbid the median for this subject (name the safe layout/font/
palette cluster and refuse it), decide whether this page even wants a centrepiece and
commit to ONE grounded in the subject's real mechanic if so, then call
`design_system` once — passing `hue` / `energy` / `accent` / `intent` derived from
the subject — for a coherent token baseline. Route every remaining deterministic
decision through its tool: `suggest_fonts` (its pairing.body is the readable face —
never a display face for body text), `structure_ideas` for the archetype/hero call,
`layout` (use its container tokens for the outer wrapper; never re-add margin on top
of inner), `type_scale`, `spacing_scale`, `radius_scale`, `shadow`, `motion_tokens`.
Verify colors with `check_color` / `check_palette` as you place them. Finish with
`audit_system` over the finished token set.

Self-check: did you understand the subject before building, asking only what
mattered? Is there exactly one nameable centrepiece — or a deliberate decision to
ship none — that fails the swap test if removed? Does every token trace back to a
tool call rather than a guess? Did `audit_system` come back clean with no domain
marked SLOP?

_The hard gates, forbid-the-median, and the ONE-centrepiece bar live in `design-law.md` and the fix-ai-slop index — load them if they aren't already in context._
