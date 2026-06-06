# Slop colors

> Objective definition of "AI-slop color" for use in design skills. Every gate is
> phrased so it cannot be argued around by a subject-grounded story. A rule is
> passed or failed by a measurable property — hue angle, lightness, chroma, or
> ground luminance — independent of intent.

---

## 1. The banned palette

Six entries. Each has: hue range, canonical hexes, OKLCH location, and why it reads
as AI-generated.

---

### 1A. Indigo / violet "AI-startup" accent

| | |
|---|---|
| Hue range | 250–285° (HSL / OKLCH H) |
| Canonical hexes | `#6366F1` (Tailwind indigo-500), `#4f46e5` (indigo-600), `#8b5cf6` (violet-500), `#7c3aed` (violet-600), `#818cf8` (indigo-400) |
| OKLCH | L 0.51–0.62, C 0.23–0.25, H 277–293° |

**Why it reads as AI.** Tailwind CSS shipped `bg-indigo-500` as the default button
color in Tailwind UI. Every tutorial, every boilerplate, every open-source clone
used it. Those pages became training data. LLMs learned the statistical rule "modern
tech startup = purple-blue accent." Adam Wathan (Tailwind's creator) publicly
apologized in 2025, calling it "the reason every AI-generated interface on Earth
turned purple." The feedback loop is now self-reinforcing: AI builds indigo sites →
sites ship → they re-enter training corpora → AI doubles down.

**Objective gate.** No high-chroma (C > 0.18) accent whose hue falls in the range
H 250–290°. This includes named CSS colors `indigo`, `blueviolet`, `slateblue`, and
any mid-shade of Tailwind `indigo-*`, `violet-*`, `purple-*` used as a button fill
or hero background.

---

### 1B. Electric cyan / mint-teal glow

| | |
|---|---|
| Hue range | 165–200° |
| Canonical hexes | `#22d3ee` (Tailwind cyan-400), `#67e8f9` (cyan-300), `#2dd4bf` (teal-400) |
| OKLCH | L 0.72–0.82, C 0.10–0.16, H 175–215° |

**Why it reads as AI.** Cyan-on-dark is the complementary partner to the indigo
background and appears in virtually every "AI dark theme" produced by generative
tools. It is the default second color in shadcn/ui gradient presets, the default
glow for AI agent UIs, and is used by v0, Cursor, and Claude's own design outputs
when unconstrained. A 2024 design audit named the "neon accent (usually purple or
cyan)" as the single most recognizable AI dark-mode tell.

**Objective gate.** No cyan or teal (H 165–200°) used as a glow (`box-shadow`,
`text-shadow`, `filter: drop-shadow`) on any surface whose OKLCH lightness is below
L 0.35. No full-opacity cyan fill on a dark ground. (Cyan as a data-vis hue on a
white ground, or as a muted border, is not a gate violation.)

---

### 1C. The two-stop indigo→cyan or violet→pink gradient

| | |
|---|---|
| Stop 1 hue | 250–290° (indigo / violet) |
| Stop 2 hue | 165–200° (cyan / teal) OR 290–340° (pink / magenta) |
| Canonical CSS | `from-indigo-500 to-cyan-400`, `from-violet-600 to-pink-500`, `from-purple-600 to-cyan-300` |

**Why it reads as AI.** This two-stop pairing is the "modern AI/SaaS" gradient that
Tailwind's gradient-color-stop utilities make trivially easy. It spans >120° of hue
in a single wash, making the gradient loud and visually cheap. It appears on hero
backgrounds, CTA buttons, section dividers, and gradient text in the overwhelming
majority of AI-generated landing pages documented across multiple 2024–2025 audits.
The `from-indigo-500 to-purple-600` step (a tighter span) is its own sub-pattern —
the "AI hero wash."

**Objective gate.** No two-stop CSS gradient whose endpoints are >120° apart in hue
(OKLCH H). No gradient that has one stop in H 250–290° and another stop in either
H 165–200° or H 290–340°, regardless of direction. Gradients over text are banned
outright (see slop-manifest: "gradient text on headings/metrics — decorative, not
meaningful").

---

### 1D. Dark near-black ground + neon glow accent

| | |
|---|---|
| Ground hexes | `#000000`, `#0B0F19`, `#0D1117` (GitHub dark), `#0a0a0a`, `#080c14` |
| OKLCH ground | L below 0.15 |
| Glow accent | Any high-chroma (C > 0.15) color used as `box-shadow`, `text-shadow`, or `drop-shadow` on this ground |

**Why it reads as AI.** This is the single most recognizable AI dark-mode tell. The
formula: near-pure-black background + a colored `box-shadow` or `filter: glow` in
cyan, violet, or electric green on cards, buttons, and CTAs. It is the default output
of every major AI coding tool when "dark mode" is requested without constraints.
The raxxo.shop design audit (2024) identified `#000000` pure black + neon accent as
the primary template fingerprint. Around 2024, AI-generated landing pages became
recognizable at a glance by: dark background, neon accents (usually purple or cyan),
rounded corners, and glass-blur cards.

**Objective gate.** If the base surface has OKLCH L < 0.15: no `box-shadow` or
`filter: drop-shadow` in a saturated (C > 0.12) hue. No glassmorphism
(`backdrop-filter: blur`) on this ground. Near-black is only clean when accent
contrast comes from lightness (white or near-white text on elevation layers), not
from chroma.

---

### 1E. Reflexive fintech blue

| | |
|---|---|
| Hue range | 240–265° at mid-to-high saturation |
| Canonical hexes | `#2563eb` (Tailwind blue-600), `#3b82f6` (blue-500), `#1A56DB`, `#0066cc` |
| OKLCH | L 0.48–0.60, C 0.20–0.25, H 252–265° |

**Why it reads as AI.** The slop-manifest data (crawl of 44 AI-built sites) shows
blue dominating every category palette: AI-SaaS, B2B-SaaS, dev-tool, fintech, and
education all default to this hue band. uupm.cc (a popular SaaS design database)
uses `#2563eb` as its canonical SaaS primary — which is exactly why it reads generic.
It is the "trustworthy, professional" choice that training data hammered into every
LLM as the safe neutral. It is not neutral — it is invisible.

**Objective gate.** No primary CTA button or hero accent in H 240–265° at C > 0.18,
unless the product is explicitly financial and the palette is differentiated from
the default in at least two other dimensions (typography, layout density, motion).
For financial products this is still a gate: the question is whether the choice
comes from subject-grounding or reflex.

---

### 1F. Second-generation "tasteful editorial" slop: cream ground + amber/gold accent

| | |
|---|---|
| Ground hexes | `#F5F0E8`, `#FAF7F2`, `#F8F4ED`, `#FFFBF0` |
| OKLCH ground | L 0.95–0.98, C 0.01–0.04, H 70–90° (warm yellowed white) |
| Accent hexes | `#C17F3A`, `#C9A84C`, `#B8860B`, `#D4A853` |
| OKLCH accent | L 0.55–0.70, C 0.12–0.18, H 60–80° |

**Why it reads as AI.** This is the escape-from-slop that became slop. Models
trained to avoid indigo/Inter/glassmorphism now reflexively reach for warm serif +
cream paper + gold ink as the "calm, human, anti-AI" alternative. It was caught in
live A/B testing in this repo: an unguided build fell straight into it. The cluster
is: Playfair Display or Cormorant italic hero, cream background, amber ink, eyebrow
chip, 01/02/03 step markers. The A/B data also confirmed it in the bakery + portfolio
round. It has the same failure mode as first-gen slop: the palette has no connection
to the actual subject — it says "tasteful" without saying anything specific.

**Objective gate.** No cream/warm-white ground (OKLCH L 0.94–0.99, H 60–100°)
paired with a serif display font AND a gold/amber accent (H 55–85°) simultaneously.
Any one of the three in isolation is not a violation. The cluster is the gate: if
all three are present, the design is second-gen slop regardless of the brief.

---

## 2. The dark trap

**The trap:** A brief that suggests darkness — deep sea, outer space, night
atmosphere, cybersecurity, AI/ML, crypto — feels like a license for dark ground +
neon glow. It is the opposite. Subject-suggested darkness is precisely where models
default to the worst AI dark look, because the training data for "AI product" or
"cybersecurity tool" is saturated with exactly that aesthetic.

**The rule:** The subject suggesting darkness is a TRAP, not a license. A dark
palette is only justified when:
1. The real-world material of the subject (physical objects, environments, data) is
   genuinely dark-dominant, AND
2. The accent is derived from that material's actual colors (e.g. bioluminescent
   green for deep sea, amber sodium light for urban night, terracotta for desert
   dusk) rather than chosen from the neon palette, AND
3. The accent does NOT use glow/shadow effects at full chroma.

**Escapes when dark is genuinely right:**

- Invert the assumption: luminous type on a paper ground often communicates
  "deep/serious" better than a dark UI, and avoids the tell entirely.
- If dark ground is truly necessary: use a surface color with perceptible hue
  (e.g. deep teal `oklch(0.12 0.04 195)` for marine; deep ochre-brown
  `oklch(0.14 0.03 55)` for industrial night) rather than near-black. The hue
  grounds it in the subject.
- Derive the accent from the subject's real material color. Bioluminescence is
  blue-green but very low chroma in darkness — it is not `#22d3ee`. Naval radar is
  amber-green (`oklch(0.65 0.12 115)`). Volcanic lava is desaturated amber-red, not
  neon.
- If an accent must be high-chroma, restrict it to a single interactive element
  (one CTA), never used as a glow, shadow, or background wash.

---

## 3. Positive guidance: choosing a non-slop accent

**Step 1: Name the subject's real material.**
What are the physical objects, environments, or data in this domain? A typefoundry's
raw material is ink and paper. An infrastructure company's real material is server
metal, heat, and wire. A bakery's is crust-brown, burnt flour, steam. Extract one
color from that material. Do not use the color that represents the *vibe* of the
domain (fintech = blue) — use the color of the actual stuff.

**Step 2: Check it against the ban list.**
If the derived color falls in a banned hue range, shift the hue 20–30° in the
direction that moves away from the nearest slop cluster and re-derive.

**Step 3: Prefer unexpected hues.**
These hues are under-used in AI outputs and unlikely to read as generated:

| Name | OKLCH approx. | HSL approx. | Example use |
|---|---|---|---|
| Ochre / raw umber | oklch(0.55 0.10 70°) | hsl(38 55% 40%) | Craft, print, archive |
| Oxblood / deep burgundy | oklch(0.35 0.12 18°) | hsl(355 60% 28%) | Editorial, wine, leather |
| Moss / sage | oklch(0.52 0.07 140°) | hsl(120 18% 38%) | Agriculture, ecology, stillness |
| Clay / terracotta | oklch(0.55 0.12 42°) | hsl(22 50% 44%) | Ceramics, food, craft |
| Ink ultramarine | oklch(0.35 0.18 255°) | hsl(230 65% 24%) | Print, academic, technical (dark, not bright) |
| Brick / rust | oklch(0.50 0.14 35°) | hsl(15 55% 42%) | Industrial, heritage |
| Verdigris | oklch(0.58 0.08 185°) | hsl(172 28% 42%) | (only if low-chroma, never as a glow) |

Note: ink ultramarine at low lightness (L < 0.40) is acceptable — it reads as ink,
not as "AI blue." The gate for 1E applies only to mid-to-bright blues (L > 0.48).

**Step 4: One accent, sparingly.**
One high-chroma color in the palette. Restrict it to interactive elements and a
single editorial callout per viewport. Everything else uses neutrals tinted toward
the accent hue at C 0.02–0.04.

**Step 5: Pass WCAG AA before shipping.**
Normal text: 4.5:1. Large text / UI components: 3:1. Test the accent against every
surface it appears on, including gradient stops. Unexpected hues do not get a
contrast waiver.

---

## Quick-reference: slop gate checklist

```
[ ] No H 250–290° accent at C > 0.18 (indigo/violet ban)
[ ] No H 165–200° used as glow on surfaces with L < 0.35 (cyan-on-dark ban)
[ ] No two-stop gradient with endpoints >120° apart in hue (gradient ban)
[ ] No gradient with one stop H 250–290° and other H 165–200° or H 290–340°
[ ] No saturated box-shadow/drop-shadow on surfaces with L < 0.15 (dark-glow ban)
[ ] No H 240–265° at C > 0.18 as primary CTA / hero accent (fintech-blue ban)
[ ] No (cream ground L 0.94–0.99, H 60–100°) + (serif display) + (gold H 55–85°) cluster (second-gen slop ban)
[ ] Accent derived from subject's real material, not from its category vibe
[ ] All text ≥ 4.5:1, all UI components ≥ 3:1 against actual background
```

---

## Sources

Sources are marked **[verified]** (fetched and confirmed) or **[by name]**
(cited from search results or repo data; URL listed but page not directly read).

| Source | Status |
|---|---|
| prg.sh — "Why Your AI Keeps Building the Same Purple Gradient Website" — https://prg.sh/ramblings/Why-Your-AI-Keeps-Building-the-Same-Purple-Gradient-Website | **[verified]** |
| DEV Community (Alan West) — "Why Every AI-Built Website Looks the Same (Blame Tailwind's indigo-500)" — https://dev.to/alanwest/why-every-ai-built-website-looks-the-same-blame-tailwinds-indigo-500-3h2p | **[verified]** |
| Medium (Kai Ni) — "Design Observation: Why Do AI-Generated Websites Always Favour Blue-Purple Gradients?" — https://medium.com/@kai.ni/design-observation-why-do-ai-generated-websites-always-favour-blue-purple-gradients-ea91bf038d4c | **[verified]** |
| The Adpharm — "Claude Design produces AI slop unless you tell it not to" — https://www.theadpharm.com/insights/claude-design-without-the-ai-slop-look | **[verified]** |
| RAXXO Studios (dev.to) — "Dark Mode Design That Doesn't Look AI" — https://dev.to/raxxostudios/dark-mode-design-that-doesnt-look-ai-2cn3 | **[verified]** |
| impeccable.style — "Slop" (49-rule taxonomy) — https://impeccable.style/slop/ | **[verified]** |
| Tailwind CSS v3 — default color palette hex values (indigo-500 #6366f1, violet-600 #7c3aed, cyan-400 #22d3ee, teal-400 #2dd4bf, blue-600 #2563eb, blue-500 #3b82f6) — https://v3.tailwindcss.com/docs/customizing-colors | **[verified]** |
| Medium (ai.in.motion) — "The Purple Problem: Why AI Can't Stop Generating Purple Websites" — https://medium.com/@ai.in.motion.blog/the-purple-problem-why-ai-cant-stop-generating-purple-websites-4381fb066883 | **[by name]** |
| DEV Community (Jaainil) — "AI Purple Problem: Make Your UI Unmistakable" — https://dev.to/jaainil/ai-purple-problem-make-your-ui-unmistakable-3ono | **[by name]** |
| GitHub Changelog — "Dark and dimmed themes are now generally available" (confirms #0D1117) — https://github.blog/changelog/2021-04-14-dark-and-dimmed-themes-are-now-generally-available/ | **[by name]** |
| This repo — `skills/personality/reference/slop-manifest.md` — measured crawl of 44 AI-built sites; second-generation slop A/B finding | **[repo]** |
| This repo — `skills/personality/reference/type-and-color.md` — palettes-to-avoid by vibe (uupm.cc corroboration) | **[repo]** |
