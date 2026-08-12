# fixmyslop — explore

Start from intent — it's what makes a design good. If a brief or target was given, read
it; otherwise, in one natural pass, get what they're building, who it's for, and a word
or reference for the feel, and offer them one line for the centrepiece they picture. All
optional — if they'd rather just see options, proceed; but ground each direction in
something concrete about the subject, never four arbitrary rolls.

Turn what you learned into a StyleIntent — surface, job, and the feel expressed as dials
(energy, warmth, craft, experimentalism, layoutVariance, materiality…), with the brief
kept verbatim in sourceBrief — and call `connected_explore_directions` ONCE. It
normalizes the intent, carries subject register into each direction, and assembles the
engine's bounded 2–4 direction set in one shot —
3 corpus-grounded (distinct layout families, greedily chosen for maximum divergence,
each perturbed) + 1 engine-synthesized (blended macro stance from two families) — and
already enforces the divergence gate internally (layout family, font pairing, AND
palette hue all spread; a bounded reroll runs on your behalf if two directions land too
close, noted in `warnings` when it has to relax the floor). If you have fingerprints from
directions already shown this session, pass them in `recentFingerprints` so this call
diverges from those too. There is no manual fingerprint-threading loop anymore — one call
does it.

Each returned direction carries a complete, gate-passing genome: a layout family
(section grammar + hierarchy), a font pairing (display + a readability-gated body —
never a display face as body), a palette (accent hex, checkColor-gated), material, and
motion — plus `provenance` ("corpus-grounded" or "engine-synthesized"), `groundedIn`
(the real host a corpus-grounded family was mined from, when known), and `parents` for
the synthesized direction. `type.pairing` explains the display genre, readable body
category, register, and compatibility strategy. Your job per direction: give it a name for its feel (never
'Option 1' or the raw family name), and write one line on how the centrepiece lives
HERE — the same standout realized differently (an instrument in one, a typographic
statement in another). To hand-verify, run `check_palette` / `check_font`; to swap a
pairing for a nearer visual neighbor, `font_neighbors`.

For the v2 fields, compare the optional `type.accent` role, `material.component.dialect`,
`material.texture.dialect`, and `expression.centrepiece` across directions. Treat these
as a coherent expression language: one direction may be tactile with a magnetic cursor,
another editorial with a pinned narrative stack, and another crisp with no decorative
effect. Do not stack every available treatment. Preserve each direction's
`expression.responsive` and `expression.reducedMotion` fallbacks in the implementation.

Present each returned direction compactly (the set is bounded 2–4 — fewer than four is
normal, not a failed call): name, layout family, fonts, palette (accent hex),
background, the centrepiece line, and — when present — what it's grounded in (a real
site) or what it's synthesized from (its two parent families). If `warnings` mentions a
relaxed divergence floor, that's honest signal the corpus is thin for this surface
(expected for docs/dashboard/app pageKinds until more mined archetypes ship) — don't
hide it, just don't dwell on it. Then ask which to build; on their pick, hand off to
improve_design (or theme) to build that one for real, carrying that direction's genome
as the spec.

Self-check: did you make ONE `connected_explore_directions` call (not four manual genome calls)?
Did you present every returned direction with a real centrepiece line for each? Did you surface
`groundedIn` where present? Is each grounded in the subject or stated intent, not an
arbitrary roll?

## Magic UI component contract

When a page needs animated copy/paste components, load `reference/magic-ui-components.md` and call
`magic_ui_component` for the role, variant, state matrix, responsive fallback, and install command.
Start with one visual anchor plus one supporting effect. Use `check_magic_ui_composition` before shipping;
it blocks stacked high-motion loops, ambient effects acting as content, unpausable autoplay, long-form text animation,
missing keyboard/focus behavior, and effects above the opacity budget. Prefer the current `@magicui/*` registry
implementation and prop/className customization; do not recreate a lookalike. Preserve semantic content, 44px touch
targets, a coarse-pointer fallback, and `prefers-reduced-motion` behavior.


## Connected one-shot path

For a real subject brief, use `connected_style_genome` once, `connected_explore_directions` once for alternatives, or `connected_build_spec` for the markdown handoff. Keep `sourceBrief` verbatim, pass `recentFingerprints` when re-rolling, and use the selected body face for running text. Read the v2 `type.accent`, `material.component`, `material.texture`, and `expression` fields; implement one centrepiece with mobile and reduced-motion fallbacks. This subject-connected path supersedes manual four-call loops when it is available.

_The hard gates, forbid-the-median, and the ONE-centrepiece bar live in `design-law.md` and the fixmyslop index — load them if they aren't already in context._
