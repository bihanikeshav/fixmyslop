# fix-ai-slop — improve_design

Before any tool call, understand the subject: read the target if given, else infer
from the brief or codebase what this is, who uses it, and what real material it
draws from. Ask only what's genuinely unclear — no fixed questionnaire.

Flow: forbid the median for this subject; decide whether the page wants a
centrepiece and commit to ONE grounded in its real mechanic if so; call
`design_system` once with `hue` / `energy` / `accent` / `intent` from the subject.
Route the rest: `suggest_fonts` (pairing.body is the readable face — never display
as body), `structure_ideas`, `layout` (container tokens on the wrapper; no margin
on inner), `type_scale`, `spacing_scale`, `radius_scale`, `shadow`,
`motion_tokens`. Verify colors with `check_color` / `check_palette` as you place
them. Finish with `audit_system`.

Self-check: one centrepiece (or a deliberate none) that fails the swap test? Every
token from a tool, not a guess? `audit_system` clean?

_The hard gates, forbid-the-median, and the ONE-centrepiece bar live in `design-law.md` and the fix-ai-slop index — load them if they aren't already in context._
