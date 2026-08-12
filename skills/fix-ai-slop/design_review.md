# fix-ai-slop — design_review

Before auditing, understand what "good" means here: skim the target, infer the
audience and the page's job; ask only about genuine ambiguity.

Hunt the ranked tells, in the order they show up: shadcn/Tailwind default kit
(slate cards, one recycled blue, uniform padding and rounding) — `check_color` /
`check_palette` / `check_layout`, fix by grounding in the subject; AI-purple/indigo
accent — `check_color`; purple→blue gradient or gradient-on-text — ban outright;
over-animation — `check_motion`, keep only motion that carries meaning;
emoji-as-icons — swap for the one real icon set; default Inter/Geist —
`check_font` / `suggest_fonts`; symmetric hero + three cards + CTA —
`check_layout` / `structure_ideas`, break it with a real hero and section variety.
Then `audit_system` over extracted tokens, plus `check_type`, `check_spacing`,
`check_radius`, `check_shadow` on what shipped. Flag banned colors, display-font
body text, margin stacked on a layout inner, opacity:0-until-scroll, and a missing
centrepiece. Every finding names its concrete fix (`generate_palette`,
`suggest_fonts`, …), not just a verdict.

Crawl-validated tells (from our own labeled corpus — a small seed, supplementary to
the gates): incomplete-layout whitespace, unmotivated section bands, repeated default
cards, weak focal continuity, duplicate CTA end-caps, weak content density, pill-heavy
chrome, colored-glow shadows, gradient text/surface, single-font monoculture. Confirm
each against a tool verdict before flagging.

Audit the UX layer too, where the page has one: `audit_microcopy` on buttons, errors,
and empty states; `audit_accessibility` (focus visibility, 44px targets, accessible
names, reduced-motion); `audit_form` on any form; `check_component_states` on async
controls; `check_information_architecture` on the primary nav. Same rule as the visual
tells: every finding cites the tool verdict.

Self-check: every finding cites a tool verdict? Ranked tells checked specifically?
Fix list implementable with no follow-up questions?

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
