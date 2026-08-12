# fixmyslop — polish

Understand the stage before touching tokens — near-ship or early draft, which
surfaces need finishing, whether prefers-reduced-motion is already handled; ask
only if not obvious from the target. For component-heavy work, load
`reference/components.md` and `reference/motion.md` before editing.

Run the finishing tools: `radius_scale` / `check_radius` (concentric nesting),
`shadow` / `check_shadow` (layered, tinted — never a flat default), `motion_tokens`
/ `check_motion` (ease-out, ≤500ms feedback, reduced-motion respected, nothing
hidden behind opacity:0-until-scroll). Control sizing and radii read as one family.
Re-run `audit_system` if a fuller token set is available.

When using a connected v2 genome, apply `material.component` as the control dialect:
carry its button shape, fill, border, resting/hover/active shadows, press/lift motion,
focus treatment, and explicit disabled/loading/success/error states through the whole
surface — verify the full matrix per interactive control with `check_component_states`.
Use region-level density, substrate-relative elevation, and one shared motion ladder;
portals inherit their trigger's density and surface context. Proximity preview is allowed
only inside contiguous groups on fine pointers, never as page-wide magnetic motion.
Apply `expression` as a budget: one centrepiece, optional quiet texture, native mobile
fallback, and a reduced-motion path that preserves state feedback without displacement.

Polish is subtraction, not addition. Every finishing element earns its place by the
load-bearing test: if removing it would break nothing, remove it. Don't reach for a
border/card/eyebrow/extra marker where whitespace, proximity, or a single channel already
carries the meaning — additive decoration on a weak layout stays slop regardless of scale.

Self-check: shadows layered and tinted, not flat? Nested overlays lift from their actual
substrate? Density stays coherent across portals? Every state is keyboard- and touch-usable?
Motion reverses cleanly and degrades under prefers-reduced-motion, with no content hidden
pre-JS? One element still wins the squint test (`filter: blur(8px)`)? No boxitis, no status
encoded more than one way, no trapped whitespace from a fixed frame?

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
