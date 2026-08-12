# fixmyslop reference — Failure modes

_Craft knowledge to draw on, not a template. The gates in design-law.md are the only hard rules — invent for THIS subject and diverge freely._

The ranked tells, each with a one-line fix — hunt in this order.

- **shadcn/Tailwind default kit** (slate cards, one recycled blue, uniform padding + rounding) → ground palette and structure in the subject; `check_color` / `check_palette` / `check_layout`.
- **AI-purple / indigo accent** → derive the accent from real material; `check_color`.
- **Purple→blue gradient, especially gradient-on-text** → ban outright; one committed accent.
- **Over-animation** (everything fades/floats) → keep only motion that carries meaning; `check_motion`.
- **Rounded-everything** at one fat radius → concentric, varied radii; `radius_scale` / `check_radius`.
- **Dark + neon glow** (near-black ground + saturated accent) → give the ground a real hue, drop the glow.
- **Emoji as icons / bullets / chrome** → one real icon set (Lucide, Phosphor, Feather).
- **Default Inter / Geist** → a subject-grounded pairing; `suggest_fonts` / `check_font`.
- **Symmetric hero + three cards + CTA** → break it with a real hero and section variety; `structure_ideas` / `check_layout`.

**Structural tells:** harsh hard shadows (use soft, tinted, large-blur — `shadow` / `check_shadow`); inconsistent radius/type/button sizes; mismatched icon sets; flat hierarchy with no empty/loading/error states; five confused pricing tiers with hidden discounts; missing real pages (billing detail, analytics, empty).

**Composition & hierarchy tells** (these read as "ugly / unbalanced" even when color and fonts are clean):
- **Two co-equal headlines / everything bold** (nothing leads) → one primary per view, three weight levels max; run the squint test (`filter: blur(8px)`).
- **Eyebrow chip on every block** (a mono kicker above each section) → label by proximity; keep kickers only where structure needs them — the eyebrow-on-every-block cluster is named slop.
- **Status encoded three ways** (color bar + dot + word on one row) → one channel per meaning; de-emphasize secondary content, don't add markers.
- **Uniform padding everywhere** (nothing groups) → related tighter, unrelated looser; a 2:1 between-vs-within ratio.
- **Trapped whitespace / empty multi-column** (columns strand at different heights, a fixed frame won't fill) → resolve shared edges, content-driven height, balance by weight; rebalance widths instead of padding the void.
- **Boxitis** (every section wrapped in its own card) → whitespace groups; a border is additive signal, not a default.

**Sterile mush vs clutter:** stripping everything leaves a dead SaaS — but the cure is structure and scale, not added ornament. Earn life from ONE crafted centrepiece, real hierarchy, and product-true visuals, then subtract everything that isn't load-bearing (if removing it would break nothing, remove it). Ornament decorating a weak layout is slop regardless of scale.
