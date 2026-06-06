# Premade-components + contrast + layout round

User: still off — stop Claude drawing illustrative SVG (use premade components), contrast
off on saffron, bake in more UI patterns, play with layouts. Decisions: ban illustrative
SVG (keep data-driven instruments), use icon libraries + UI component patterns + a
constrained CSS layer, auto-verify contrast, vary layouts. Builds: `ca-saffron`,
`ca-hotsauce`, `ca-ledger` (+ rebuilt from the old pm-saffron/pm-* that had drawn SVG +
low contrast).

## Verified results
- **No hand-drawn illustration.** All three: icon-lib **yes** (Lucide), literal-SVG-paths
  **0**. The old drawn long-table / body-silhouette are gone; standouts are now data-driven
  instruments (Season Wheel, Scoville Heat Ladder) or pure components.
- **Contrast — fixed and proven.** In-browser computed audit (color vs effective bg, WCAG):
  - old **pm-saffron: 10 failures**, worst **2.13:1** (the warm-brown-on-umber you flagged).
  - new **ca-saffron: 0 / 270**, **ca-hotsauce: 0 / 194**, **ca-ledger: 0 / 368**.
  The audit catches the real failure and passes the fixed builds (`contrast-audit.js`).
- **Real components + varied layouts.** ca-ledger = app-shell dashboard (sidebar + real
  `<table>` + status badges + filter chips + aging instrument); ca-hotsauce = full-bleed
  type poster (Bungee) + Scoville data bars; ca-saffron = single-object Season Wheel on
  pomegranate. Lucide icons throughout; component patterns restyled to each palette.
- **Floor + motion:** ca-hotsauce, ca-ledger PASS the full checker; ca-saffron had ONE
  slip — `transition: top` (a layout-prop animation) on a nav element. Fixed in the skill
  (`motion.md` hover recipe now forbids inset props too). Otherwise motion-safe + reduced-motion.

## Verdict
The four asks are met and grounded: illustrative SVG banned (verified 0 literal paths +
icon-lib used), contrast fixed (computed audit: 10→0 on saffron), more real UI/component
patterns baked in (`components-and-assets.md` + the deep doc), and layouts genuinely varied
(app-shell / poster / single-object). Lesson reinforced: hand it the premade building blocks
and an objective gate (computed contrast, asset signals), don't rely on the model's judgment.
