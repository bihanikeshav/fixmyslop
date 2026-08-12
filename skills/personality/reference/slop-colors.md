# Slop colors — the banned palette (hard gate, mandatory read)

Objective color gates. Each is passed or failed by a measurable property (hue,
lightness, chroma), so **no subject-grounded story can argue it away.** A "deep sea"
brief does not license cyan-on-black; a fintech brief does not license reflex blue.

## The banned palette
- **1A · Indigo / violet "AI-startup" accent** — `#6366F1` (Tailwind indigo-500),
  `#7C3AED`, `#8b5cf6`, `#818cf8`. Tailwind's default button color → all over training
  data → "every AI interface turned purple" (Wathan, 2025).
  **Gate:** no high-saturation accent in the blue-purple band (HSL hue ~215–280, S>55%,
  mid lightness) as a fill/hero/CTA.
- **1B · Electric cyan / mint-teal glow** — `#22d3ee`, `#2dd4bf`. The complementary
  partner to indigo; the #1 "AI dark theme" second color.
  **Gate:** no cyan/teal (hue 165–200°) used as a glow or full fill on a dark surface (L<35%).
- **1C · Two-stop indigo→cyan / violet→pink gradient** — `from-indigo-500 to-cyan-400`,
  `from-violet-600 to-pink-500`. The "modern AI/SaaS" wash.
  **Gate:** no two-stop gradient with endpoints >120° apart in hue; none pairing
  hue 250–290° with 165–200° or 290–340°. Gradient-on-text is banned outright.
- **1D · Dark near-black + neon glow** — ground `#000`, `#0B0F19`, `#0D1117` + a colored
  `box-shadow`/`drop-shadow` glow. The single most recognizable AI dark-mode tell.
  **Gate:** if a surface is L<15%, no saturated (C>0.12) box-shadow/drop-shadow and no
  `backdrop-filter: blur`. On near-black, contrast comes from lightness, not chroma.
- **1E · Reflexive fintech blue** — `#2563eb`, `#3b82f6`. "Trustworthy" = invisible;
  dominates every category in the crawl.
  **Gate:** no primary CTA/hero accent in this blue band at high saturation unless the
  product is genuinely financial AND differentiated on two other axes.
- **1F · Second-gen "tasteful editorial" cream+gold** — cream ground (`#F5F0E8`,
  `#FAF7F2`) + serif display + amber/gold ink (`#C17F3A`). The escape-from-slop that
  became slop.
  **Gate:** the *cluster* is the violation — cream ground (L 94–99%, warm) + serif
  display + gold accent (hue 55–85°) all present = second-gen slop, regardless of brief.

## The dark trap
A brief that *suggests* darkness — deep sea, space, night, cybersecurity, AI, crypto —
feels like a license for dark + neon. It is the opposite: that's where the training
data is most saturated with the AI look. **Darkness is a trap, not a license.** Dark is
only justified when (1) the subject's real material is genuinely dark, (2) the accent
is derived from that material's *actual* color (bioluminescence is low-chroma blue-green,
NOT `#22d3ee`; sodium night is amber; radar is amber-green), and (3) the accent never
glows. Better: **invert** — luminous type on a paper ground says "deep/serious" without
the tell. If dark is truly needed, give the ground a real hue (deep teal/ochre), not near-black.

## Positive guidance
1. **Derive the accent from the subject — its real material OR its genuine energy/
   spirit** — never the category *vibe* (fintech→blue). Material gives grounded, often
   muted hues (ink, crust-brown, server metal, clay). Spirit can justify a **bold,
   bright, saturated, or unexpected** hue (a hot-sauce brand's electric red-orange, a
   kids' label's primary yellow, a club's acid green). Pick whichever fits the brief's
   actual energy.
2. **Don't default to muted-earthy.** Terracotta / ochre / oxblood / crust have
   themselves become the safe "tasteful anti-slop" accent. Saturation is NOT slop —
   only the banned bands are. If the subject has energy, use a committed hue, loud.
3. **Check against the bans;** if it lands in a banned band, shift hue 20–30° away.
   Under-used hues if you want grounded-quiet: ochre, oxblood, moss, clay,
   ink-ultramarine (L<40), brick, verdigris — but these are options, not the mandate.
4. **One accent, committed** — bold or quiet, used decisively (interactive elements +
   one callout per viewport), not five soft ones; neutrals tinted toward it at low chroma.
5. **WCAG AA** — text 4.5:1, UI/large 3:1, against every surface incl. gradient stops.

## Multi-color / categorical palettes
When a subject needs a *set* of colors (panels, grade tapes, book spines, category
tags, charts), the slop bans still apply to **every swatch** — never reach for the
Tailwind defaults as "the blue/purple/cyan" of the set (`#2563eb`, `#6366f1`,
`#22d3ee`). Derive the whole set intentionally from the subject's real colors (the
actual grade-tape colors, the real product hues) and shift any swatch that lands in a
banned band. A bright categorical color is fine; the *default* one is not.

→ deep dive (full hex tables, OKLCH coords, sources, the unexpected-hue palette):
docs/design-research/slop-colors.md
