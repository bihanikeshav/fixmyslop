# fix-ai-slop reference — Fluid Functionalism dashboards

_Craft knowledge to draw on, not a template. The gates in design-law.md are the only hard rules — invent for THIS subject and diverge freely._

## Source components, not a borrowed skin

For dashboards, admin tools, and AI product surfaces, the functional component source is [Fluid Functionalism](https://www.fluidfunctionalism.com/) and its [MIT-licensed registry](https://github.com/mickadesign/fluid-functionalism). Call `fluid_components` and install the returned `@fluid/*` registry items. Do not recreate lookalike buttons, cards, tables, inputs, selects, dropdowns, tabs, dialogs, tooltips, switches, scroll areas, or AI controls.

Let Fluid own component anatomy, named icon slots, state transitions, proximity behavior, SizeContext, SurfaceContext, and spring physics. Radix is the default; use the returned `-base` sibling only when the host application is already built on Base UI. Preserve the registry source and license provenance.

## Geometry is computed

Call `dashboard_system` before placing dashboard UI. Use its exact shell rectangles, responsive 12/6/1-column tracks, gutter, outer inset, type roles, 28px compact or 36px default Fluid density, relative surface roles, and responsive inspector mode. The primary work area must survive before an inspector is allowed to dock. Do not eyeball spacing, font sizes, or placement.

The returned placements are the initial viewport contract. Content can grow vertically, but shared axes, column starts, within-group gaps, and between-group gaps stay bound to the generated variables. Dashboard type remains compact and hero-sized display type is forbidden.

## Personality surrounds the components

The product may add its own palette, background fades, at most two faint pattern layers, and one small ambient animation behind the canvas or in its margins. Decorative layers use `pointer-events: none`, stay at or below 0.08 opacity, keep data contrast intact, and disappear under reduced motion/transparency as appropriate. They never alter Fluid component internals or compete with interaction feedback.

## Required verification

Pass implemented region coordinates, component provenance, and personality layers to `check_dashboard_layout`. Fix every SLOP issue before ship: off-grid values, out-of-bounds or colliding regions, non-Fluid functional controls, mismatched component density, too many decorative layers, intrusive opacity, or decor that intercepts input. Then run the normal palette, accessibility, form, state, and motion checks.
