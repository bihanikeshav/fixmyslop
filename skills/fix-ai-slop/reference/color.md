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

**Surface rules (tasteskill.dev)**
- Off-black / off-white, never pure `#000`/`#fff`; tint neutrals ~0.005–0.02 chroma toward the brand hue — pure black/white/gray don't occur in nature.
- Neutral base + ONE accent, saturation < 80% — a rare committed accent beats an evenly-saturated palette. Gate with `check_color` / `check_palette`.
- Tint shadows to the background hue; no pure-black drop shadows on light. Alpha everywhere is a smell (incomplete palette) — define explicit surface/overlay colors per elevation, keep alpha for focus/interactive states.
- One radius scale, locked (all-sharp / all-soft ~12–16px / all-pill); mix only with a rule. `radius_scale` / `check_radius`.
- Glass only over real layering: `backdrop-filter` + 1px inner border + inset highlight + solid fallback under `prefers-reduced-transparency`. Grain/noise on a fixed `pointer-events-none` overlay only, never on scrollers.
- Rotate the palette family across builds; refuse category defaults (tasteskill bans cream+brass "premium") — ground in THIS subject, not the next fashionable alternative.
