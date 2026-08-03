# fix-ai-slop reference — Color systems

_Craft knowledge to draw on, not a template. The gates in design-law.md are the only hard rules — invent for THIS subject and diverge freely._

**Less color, more meaning**
- Neutrals dominate; color = status, selection, brand moments. Linear, Notion, Vercel, Supabase run ~90%+ neutral with a tiny accent.
- One brand accent for primary actions. Semantics distinct: success / warning / danger / info — destructive is never playful.
- Icons mostly monochrome; color only for state. Rainbow cards fail hierarchy and a11y. Gate shipped color with `check_color` / `check_palette`.

**Why 60-30-10 breaks in apps**
- Landing pages can run 60/30/10; apps need layered surfaces.
- Neutral stack: 3–4 background elevations, 1–2 strokes, ~3 text steps. Layers: frame → chrome/sidebar → card → overlay, plus borders, text tiers, accent+states, semantics, data-viz.
- Soft near-gray borders, no pure-black hairlines. Importance maps to contrast; primary button strongest. Ramps via `generate_palette` / `design_system`.

**Ramps & dark mode**
- Brand ramp 50–900. Dark mode is retuned, not mirrored.
- Light primary: mid-dark (600/700); dark primary: lighter mid (300/400).
- Dark surfaces get LIGHTER as they elevate — double the perceptual distance; a dark card is never darker than the page.
- Dim pure white text on dark; brighten borders. Charts: separate data palette; may break brand monotony on purpose.
