# fix-ai-slop — theme

Understand the brief before any tool: what it's for, who sees it, what real
material the palette comes from; ask only if unclear. A "dark/techy" brief doesn't
earn the AI-startup look — challenge whether dark is earned at all.

Turn the brief into a StyleIntent (surface, job, the feel as dials, brief verbatim in
sourceBrief), normalize with `resolve_intent`, then call `style_genome` once for the
whole coherent direction — palette, fonts, layout family, material and motion resolved
together from one intent, each with provenance. (For a tokens-only pass without
layout/fonts, `design_system` stays the core generator; ground it with `hue` /
`energy` / `accent` / `intent`.) Iterate the palette via `generate_palette` +
`check_palette` and fonts via `suggest_fonts` / `check_font` (pairing.body is the
readable face). Re-roll from intent — bump the variation knob or a dial — rather than
hand-editing values; coherence comes from one system, not a patchwork of one-off calls.

Self-check: palette derived from something real, not a category default? One coherent
genome (or its re-roll), not a patchwork? `audit_system` coherent, no domain SLOP?

_The hard gates, forbid-the-median, and the ONE-centrepiece bar live in `design-law.md` and the fix-ai-slop index — load them if they aren't already in context._
