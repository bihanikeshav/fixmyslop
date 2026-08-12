# fix-ai-slop — typeset

Understand the content before any tool — marketing headline, long-form, dense data
table, product UI — and what the reading measure must support; ask only if that or
an existing pairing to keep isn't clear.

`connected_style_genome` is preferred for a real subject; otherwise use
`suggest_fonts`. Treat the result as a load contract: both `pairing.assets.*.available`
must be true, `check_font` must pass the selected role, and the implementation must
emit the returned `@font-face` files before styling. `pairing.body` is the readable
face for running text, never a display or novelty face, however striking it looks in
a headline. Render a headline, labels, and a 65–75ch body specimen; wait for
`document.fonts.ready` and reject any fallback, clipping, or bad wraps. Build the scale with `type_scale` (modular, ≤7 sizes) and
`spacing_scale` (one base grid), verified with `check_type` / `check_spacing`. Call
`layout` for the grid — container tokens (maxWidth + paddingInline) on the outer
wrapper, no margin re-added on inner (it doubles the gutter). Verify with
`check_layout`.

Guard the hierarchy while you set type: one element wins per view (one dominant, not
two co-equal big-bold headlines); three weight levels max and bold under ~15–20%;
de-emphasize secondary text (muted, lighter) rather than adding another treatment;
label a group once by proximity, not with a kicker on every block. Space by grouping —
related tighter, unrelated looser (2:1), never uniform.

Self-check: exact assets loaded? body font traces to pairing.body? body measure is
45–75ch? No margin stacked on inner? One primary survives the squint test
(`filter: blur(8px)`)? Spacing groups (related tight / unrelated loose), not uniform?
`check_type` / `check_spacing` / `check_layout` clean? If SVG is present, did
`check_svg` return PASS?

## Dashboard implementation contract

When the target is a dashboard, admin tool, or AI product surface, load
`reference/fluid-dashboards.md` and call `dashboard_system` before placing UI.
Use its exact shell rectangles, column tracks, gutters, type roles, density, surfaces,
responsive inspector mode, and CSS variables. Call `fluid_components` when you need
a component-only manifest. Install the returned genuine `@fluid/*` registry sources;
do not build visual approximations of Fluid buttons, cards, tables, inputs, selects,
dropdowns, tabs, dialogs, tooltips, switches, scroll areas, or AI controls.

The product's own character belongs around those components: subject-grounded color,
background fades, at most two faint pattern layers, and at most one small ambient
animation behind the content. Never alter Fluid anatomy, proximity behavior, surface
context, density context, or springs to manufacture personality. Before ship, pass the
implemented coordinates, component source records, and decorative layers to
`check_dashboard_layout`; a SLOP verdict blocks shipping.

## Connected one-shot path

For a real subject brief, use `connected_style_genome` once, `connected_explore_directions` once for alternatives, or `connected_build_spec` for the markdown handoff. Keep `sourceBrief` verbatim, pass `recentFingerprints` when re-rolling, and use the selected body face for running text. Read the v2 `type.accent`, `material.component`, `material.texture`, and `expression` fields; implement one centrepiece with mobile and reduced-motion fallbacks. This subject-connected path supersedes manual four-call loops when it is available.

_The hard gates, forbid-the-median, and the ONE-centrepiece bar live in `design-law.md` and the fix-ai-slop index — load them if they aren't already in context._
