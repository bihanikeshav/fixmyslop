# Slop-o-meter — Design Reference (for the mockup)

Data-backed. The "before" is measured from our slop matrix (12 vibes × Opus/Sonnet/Haiku)
and live style fingerprints of real AI-built sites. The "after" is curated from the
under-saturated, model-vouched pool. Use the BEFORE to show the slop; use the AFTER as
the site's own anti-slop identity.

---

## PART 1 — THE SLOP (the "before" to parade and mock)

### 1a. Slop fonts (measured, by saturation)
- **The universal serif slop:** **Playfair Display** (saturation 1.00 — unanimous #1 for luxury, magazine, and bleeds everywhere)
- **The grotesk monoculture (tech/SaaS):** Space Grotesk, Outfit, DM Sans, Sora, **Inter**, Manrope, Plus Jakarta Sans, Lexend
- **The "fancy" serifs:** Cormorant Garamond, Bodoni Moda, DM Serif Display, Abril Fatface, Libre Baskerville
- **The "friendly rounded":** Poppins, Nunito, Quicksand, Raleway
- **Body text everywhere:** **Inter** (even elite sites self-host it). 5/6 mass AI tools used Inter for hero AND body.

### 1b. Slop colors = Tailwind defaults, untouched
- **Indigo / violet:** `#4f46e5` `#6366f1` `#818cf8` `#a78bfa`
- **Blue / cyan:** `#3b82f6` `#60a5fa` `#22d3ee`
- **Dark slate backgrounds:** `#0f172a` `#1e1d2b`
- **The gradients:** indigo→violet, and the pink→purple (`#ff397d → #a775eb`)

### 1c. Slop styles (measured live on mass AI tools)
- **Gradient-text headings** (`background-clip:text`)
- **Glassmorphic nav** (`backdrop-filter: blur`) — on nearly every site
- **Pill buttons** (`rounded-full`) + **rounded-2xl everything**
- **Soft shadows everywhere**, tight hero letter-spacing, big centered single-column hero
- **Animations = Tailwind built-ins:** `animate-spin`, `animate-pulse`, `animate-ping`, `animate-bounce`, plus fade-in-up on scroll. (Found verbatim on vimeraai, happyseeds, aihair, floorplanmaker.)
- Bento grids, emoji bullets, "✨ AI-powered" badges

> The one-line thesis to put in the hero: **"AI slop is just the Tailwind defaults."**

---

## PART 2 — THE ANTI-SLOP (the "after")

Principle: **be intentional, editorial, characterful.** Every slop tell has an antidote —
flat bold color instead of gradients, real type contrast instead of one grotesk, mechanical/
editorial motion instead of fade-up, sharp or asymmetric structure instead of rounded-everything.

### 2a. Fresh fonts (all real Google Fonts, near-zero saturation in our data)

**Bold-fresh — farthest from slop, high character (recommended for a rebellious tool):**
| Font | Why it's anti-slop |
|---|---|
| **Bitcount** | Pixel/dot variable display — brand-new, unmistakable, literally the opposite of a safe grotesk |
| **Unbounded** | Geometric, heavy, quirky — confident display voice |
| **Tektur** | Blocky techno-display, mechanical, zero SaaS softness |
| **Big Shoulders Display** | Condensed editorial poster type — bold, newsroom energy |
| **Grenze Gotisch** | Modern blackletter — dramatic, nobody's defaulting to it |
| **Syne** | Art-world wide display — design-forward, distinctive |
| **Victor Mono** | Mono with *cursive italics* — perfect accent for a diagnostic tool |
| **Martian Mono** | NASA-grade mono, wide and technical |

**Safe-fresh — clean and current but not (yet) slop. Good for body/UI:**
Hanken Grotesk, Public Sans, Schibsted Grotesk, Spline Sans, Bitter (slab), Newsreader (editorial serif), Instrument Serif (elegant, fresher than Playfair), Crimson Pro.
*(Watch list — rising toward slop, use knowingly: Bricolage Grotesque, Gabarito, Figtree, Urbanist.)*

**Suggested pairings for the site:**
- Rebellious: **Bitcount** (hero) + **Public Sans** (body) + **Martian Mono** (accent/labels)
- Editorial-bold: **Big Shoulders Display** (hero) + **Newsreader** (body) + **Victor Mono** (data)
- Confident-modern: **Unbounded** (hero) + **Hanken Grotesk** (body) + **Geist Mono** (mono)

### 2b. Fresh color directions (NO gradient)
- **Riso / print:** ink black `#111111` + paper cream `#F4EFE6` + ONE saturated hit (tomato `#FF4D3D`, electric blue `#1454FF`, or acid lime `#C6F432`)
- **Diagnostic-meter:** off-black + bone white + hazard amber `#FFC400` — fits a "meter" and reads as analytical, not pretty
- Rule: flat color blocks, hard edges between fields, one accent doing the work. The slop is gradients; the antidote is **conviction in flat color.**

### 2c. Fresh style directions
- **Replace gradient-text** → solid heavy color, or outline/stroked type, or a knockout on a color block
- **Replace glassmorphism** → opaque bold panels, visible borders, print-style rules/accent bars
- **Replace rounded-2xl** → sharp corners, or one intentional radius used sparingly; asymmetry over uniformity
- **Replace fade-up / Tailwind animate-*** → mechanical motion: a **slop-meter gauge/needle**, a **marquee ticker** of slop fonts, **type that assembles/glitches** on reveal, number counters
- Texture: halftone / riso grain / scanlines — anything with a made-by-a-human hand
- No emoji badges; use real iconography or none

---

## PART 3 — THE HERO ANIMATION (your concept, grounded in real data)

What the meter can *actually* detect and therefore *show*:
1. **Intro:** a wall/marquee of the measured slop — Playfair Display, Inter, Space Grotesk… rendered in the Tailwind-indigo palette with a purple gradient and a glassmorphic card, deliberately overdone. Tagline: *"Tired of AI slop? It's just the Tailwind defaults."*
2. **The ask:** paste your URL.
3. **The reveal (all real, all extractable):** a gauge swings to your score, and tells light up — `Inter hero ✓` · `AI purple gradient ✓` · `glassmorphic nav ✓` · `pill buttons ✓` · `animate-pulse ✓`.
4. **The antidote:** the page *re-skins itself live* into the anti-slop direction — swaps to a fresh font + flat palette + sharp motion — and hands over font + palette recommendations.

Everything in steps 1, 3, and 4 is backed by data/extraction we already have. The only optional
LLM/vision piece is a subjective screenshot critique — not required for any of the above.
