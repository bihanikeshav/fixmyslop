# fixmyslop reference — Typography

_Craft knowledge to draw on, not a template. The gates in design-law.md are the only hard rules — invent for THIS subject and diverge freely._

**One family, many roles**
- One strong sans, several weights; hierarchy over novelty.
- Three roles: display/heading, body/paragraph, label/meta. Prefer the connected
  pairing; `pairing.body` is the workhorse. A family is usable only when its
  `asset.available` and role gate pass. Emit the exact `@font-face`, await
  `document.fonts.ready`, and render a headline/body/label specimen before judging
  the pairing. Candidate research pairings are not human-validated truth.
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
