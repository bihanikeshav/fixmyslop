# fixmyslop reference — Layout & structure

_Craft knowledge to draw on, not a template. The gates in design-law.md are the only hard rules — invent for THIS subject and diverge freely._

**Spacing system**
- One base, 4 or 8px; every gap a multiple — no random 13/17px (`spacing_scale` / `check_spacing`).
- Proximity groups: related closer, unrelated more air. Equal spacing = no grouping. A 2:1 between-vs-within ratio is a reliable start; label→input gap smaller than field→field; more space above a heading than below it.
- Start with too much space and remove it (Refactoring UI) — subtraction, not padding, is the default move.
- Wireframe first; grayscale failure isn't saved by color. Five-second scroll test: structure alone conveys the product.

**Balance & focal point**
- One element wins per view — dominant / sub-dominant / subordinate, three levels not five. Isolate ONE thing; isolating several dilutes it to zero. Squint gate: blur the render (`filter: blur(8px)`), the intended primary must still be the most prominent shape.
- Balance by visual weight, not mirror symmetry: a large element balances against several small ones plus negative space — calibrate it, never strand a column. Unexplained asymmetry reads as disorder.
- Resolve the edges: columns and sections share baselines and bottom edges; align to as few axes as possible; misaligned columns make related content feel unrelated.
- Height is content-driven, never a fixed frame content can't fill — trapped leftover space and empty multi-column are tells. Negative space must amplify the primary. If a column empties out, rebalance widths or merge — don't pad the void.
- Boxitis: wrapping every section in a border/card collapses the hierarchy into equal regions. A border is additive signal, not a default — whitespace between sections usually groups them.

**Captivating vs chaotic**
- Guide the eye. Hold a grid rhythm; break it once, deliberately.
- Archetype/hero via `structure_ideas`; grid math via `layout` (container tokens on the outer wrapper; never re-add margin on `inner`).
- Vary width, media placement, density per section — no identical slabs.
- Ornaments in the margins, never on the message.

**Two densities, both legal**
- Marketing (Apple-like): big product focus, confident whitespace, one idea at a time.
- Product: real density — compact type, layered neutrals, data-first — labels still scannable.

No crammed competing sections, no decorative dead cards. Structure earns polish, never the reverse.
