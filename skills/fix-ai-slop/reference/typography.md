# fix-ai-slop reference — Typography

_Craft knowledge to draw on, not a template. The gates in design-law.md are the only hard rules — invent for THIS subject and diverge freely._

**One family, many roles**
- One strong sans, several weights; hierarchy over novelty.
- Three roles: display/heading, body/paragraph, label/meta. `suggest_fonts` returns a pairing — `pairing.body` is the workhorse; verify with `check_font`.
- Marketing: up to ~6 size steps. Dashboards: tighter — hero sizes steal density.

**Practical scale (Mizko blueprint)**
- Small increments, often 2px. Labels and paragraphs are separate styles.
- Labels: 10 / 12 / 14 / 16, compact line-height.
- Paragraphs: 12 / 14 / 16 / 18, reading line-height.
- Build with `type_scale` (modular, ≤7 sizes); verify with `check_type`. Bind as tokens — never freehand.

**Setting details**
- Large headings: tracking −2% to −3%, line-height ~110–120%.
- Body takes more line-height than a single-line label; long measure needs air.
- Mobile headings reduce slightly from desktop.

Most-broken rule: a display or novelty face for running text reads as slop instantly.
