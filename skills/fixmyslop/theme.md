# fixmyslop — theme

Understand the brief before any tool: what it's for, who sees it, what real
material the palette comes from; ask only if unclear. A "dark/techy" brief doesn't
earn the AI-startup look — challenge whether dark is earned at all.

Turn the brief into a StyleIntent (surface, job, the feel as dials, brief verbatim in
sourceBrief), then prefer `connected_style_genome` once for the whole coherent direction.
It normalizes the intent, carries subject semantics into the dials, and selects a
deterministic display/body pair using register and contrast compatibility. Use the
legacy `resolve_intent` → `style_genome` sequence only when the connected tool is not
available. Palette, fonts, layout family, material and motion are resolved together
from one intent, each with provenance. (For a tokens-only pass without
layout/fonts, `design_system` stays the core generator; ground it with `hue` /
`energy` / `accent` / `intent`.) Iterate the palette via `generate_palette` +
`check_palette` and fonts via `suggest_fonts` / `check_font` (pairing.body is the
readable face). Re-roll from intent — bump the variation knob or a dial — rather than
hand-editing values; coherence comes from one system, not a patchwork of one-off calls.

Read the v2 handoff on the returned genome before implementing: `color.scene` is the
interpretable palette scene, `material.texture` is the texture decision, and
`material.component` is the button/shadow personality. Texture is a material channel,
not a blanket grain filter. If a surface is dense or utility-first, accept a withheld
texture. Use `accentMode: "always"` only for a subject that can carry a short accent
face; otherwise let `auto` withhold it.

Self-check: palette derived from something real, not a category default? One coherent
genome (or its re-roll), not a patchwork? `audit_system` coherent, no domain SLOP?

## Connected one-shot path

For a real subject brief, use `connected_style_genome` once, `connected_explore_directions` once for alternatives, or `connected_build_spec` for the markdown handoff. Keep `sourceBrief` verbatim, pass `recentFingerprints` when re-rolling, and use the selected body face for running text. Read the v2 `type.accent`, `material.component`, `material.texture`, and `expression` fields; implement one centrepiece with mobile and reduced-motion fallbacks. This subject-connected path supersedes manual four-call loops when it is available.

_The hard gates, forbid-the-median, and the ONE-centrepiece bar live in `design-law.md` and the fixmyslop index — load them if they aren't already in context._
