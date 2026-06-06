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
1. **Name the subject's real material** and take the accent from the actual *stuff*
   (ink, crust-brown, server metal, clay), not the domain's *vibe* (fintech→blue).
2. **Check it against the bans;** if it lands in a banned band, shift hue 20–30° away.
3. **Prefer under-used hues:** ochre/raw-umber, oxblood, moss/sage, terracotta/clay,
   ink-ultramarine (dark, L<40 — reads as ink not "AI blue"), brick/rust, low-chroma verdigris.
4. **One accent, sparingly** — interactive elements + one callout per viewport; neutrals
   tinted toward the accent at very low chroma.
5. **WCAG AA** — text 4.5:1, UI/large 3:1, against every surface incl. gradient stops.

→ deep dive (full hex tables, OKLCH coords, sources, the unexpected-hue palette):
docs/design-research/slop-colors.md
