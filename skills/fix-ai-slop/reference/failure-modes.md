# fix-ai-slop reference — Failure modes

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

**Sterile mush vs clutter:** stripping everything leaves a dead SaaS. Add structured personality — margin ornaments, one micro-motion, product-true visuals — while text stays calm.
