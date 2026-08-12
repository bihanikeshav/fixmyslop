# fixmyslop — improve_design

Before any tool call, understand the subject: read the target if given, else infer
from the brief or codebase what this is, who uses it, and what real material it
draws from. Ask only what's genuinely unclear — no fixed questionnaire. If this is a
developer tool, API, AI infrastructure product, or research-led technical landing page,
load `reference/technical-product.md` and write its claim/objection narrative spine
before choosing section shapes.

Flow: forbid the median for this subject; decide whether the page wants a
centrepiece and commit to ONE grounded in its real mechanic if so; call
`design_system` once with `hue` / `energy` / `accent` / `intent` from the subject.
Route the rest: `suggest_fonts` (pairing.body is the readable face — never display
as body), `structure_ideas`, `layout` (container tokens on the wrapper; no margin
on inner), `type_scale`, `spacing_scale`, `radius_scale`, `shadow`,
`motion_tokens`. Verify colors with `check_color` / `check_palette` as you place
them. Build real product explanation and evidence before decorative surfaces. Finish
with `audit_system`.

Self-check: one centrepiece (or a deliberate none) that fails the swap test? For a
technical product, does every section answer a distinct objection with real mechanism
or proof? Every token from a tool, not a guess? `audit_system` clean?

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

_The hard gates, forbid-the-median, and the ONE-centrepiece bar live in `design-law.md` and the fixmyslop index — load them if they aren't already in context._
