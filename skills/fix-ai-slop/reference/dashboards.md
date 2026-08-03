# fix-ai-slop reference — Dashboards & data UI

_Craft knowledge to draw on, not a template. The gates in design-law.md are the only hard rules — invent for THIS subject and diverge freely._

**Anatomy**
- Sidebar is the spine: icon + short label, grouped, rare items at the bottom, active indicator, collapsible-ready. Main canvas = the job-to-be-done.
- Charts are real: axes, numbers, legends, range controls. Data drives form: enums → chips, magnitudes → aligned numbers/bars, time → timeline/line.
- Layered neutrals, one accent, semantic statuses. Design the zero-data empty state; bulk actions on multi-select. Account card, not a gradient-letter avatar.

**Recipe:** sidebar spine + object list/table + 1–2 real charts with ranges. Usually NO hero-sized centrepiece — it steals density.

**Optimistic UI:** low-risk frequent actions update immediately, reconcile async — toast + undo. Never optimistic-delete without undo.

**Three tells**
- Widget-dump dashboards with no primary job.
- The same KPI strip on every page (vanity spam).
- Context-blind layouts — analytics widgets on a settings page.

Density where power users live; air where newcomers decide. `check_layout` for the grid, `check_palette` for statuses.
