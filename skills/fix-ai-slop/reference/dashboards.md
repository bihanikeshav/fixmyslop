# fix-ai-slop reference — Dashboards & data UI

_Craft knowledge to draw on, not a template. The gates in design-law.md are the only hard rules — invent for THIS subject and diverge freely._

**Anatomy**
- Sidebar is the spine: icon + short label, grouped, rare items at the bottom, active indicator, collapsible-ready. Main canvas = the job-to-be-done.
- Charts are real: axes, numbers, legends, range controls. Data drives form: enums → chips, magnitudes → aligned numbers/bars, time → timeline/line.
- Layered neutrals, one accent, semantic statuses. Design the zero-data empty state; bulk actions on multi-select. Account card, not a gradient-letter avatar.

**Recipe:** sidebar spine + object list/table + 1–2 real charts with ranges. Usually NO hero-sized centrepiece — it steals density.

**Balance the three columns (sidebar · list · inspector):**
- The object list is the job — keep it dominant. A detail/inspector rail must not out-weigh it (wider column, heavier button, bigger title) while holding less information; the inspector assists, it doesn't star. Two co-equal big titles across list and inspector = no focal point.
- One status channel per row: a colored dot OR a word OR a row tint — never all three. Cap per-row treatments; the row's job is scannability, not signal density. Align magnitudes and timestamps on a shared axis.
- Columns resolve to shared edges. A sidebar or inspector that dead-ends in dead space needs its width rebalanced or its content merged — not padded. Height is content-driven; never a fixed frame the content can't fill.

**Optimistic UI:** low-risk frequent actions update immediately, reconcile async — toast + undo. Never optimistic-delete without undo.

**Three tells**
- Widget-dump dashboards with no primary job.
- The same KPI strip on every page (vanity spam).
- Context-blind layouts — analytics widgets on a settings page.

Density where power users live; air where newcomers decide. `check_layout` for the grid, `check_palette` for statuses.
