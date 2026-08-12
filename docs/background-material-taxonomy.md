# Background / Material Taxonomy + Taste Rules

Spec for the design engine's **BACKGROUND / MATERIAL axis** — the sibling of the built
layout axis (mined archetypes + seeded perturbation + slop gates). Backgrounds are the #1
place AI-slop concentrates (gradient mesh, noise grain, blobs, glass-everything), so this
taxonomy is built to **separate texture-used-with-taste from slop-default**, and every
treatment is annotated with (a) its parameters, (b) the gate that flips it from taste to
slop, and (c) the fields in our crawl that make it **minable** the way layouts were.

Research/spec deliverable only — no engine code changed here.

## Sources and how much each is worth

| Source | Weight | What it gave |
|---|---|---|
| **tasteskill.dev** (Leonxlnx/taste-skill, "the anti-slop frontend framework") | **High** | The richest external source on backgrounds/material. Concrete, parameterized rules: theme-lock, off-black/off-white, tinted shadows, grain-on-fixed-pseudo-element, one-radius-scale, glass = backdrop-filter + 1px inner border + inset highlight + reduced-transparency fallback, "premium consumer palette ban" (cream+brass), saturation < 80%. Cited inline as `tasteskill`. |
| **impeccable.style/slop** (the 49→58-rule public taxonomy behind the local `impeccable:*` skills) | **High** | The named background/surface slop tells with their failure modes and fixes (decorative grid, radial halo, spotlight glow, repeating-gradient stripes, hairline+wide-shadow ghost card, extreme radius, glass-everywhere, cream/beige default, dark-mode glow). Cited as `impeccable/slop`. |
| **local `impeccable:frontend-design` skill** + `reference/color-and-contrast.md`, `reference/spatial-design.md` | **High** | The positive rules: OKLCH + reduce-chroma-at-extremes, tinted neutrals (chroma ~0.01), dark-mode depth via lighter surface not shadow, "shadows should be subtle — if you can clearly see it, it's too strong", "alpha is a design smell", elevation as a semantic scale. Cited as `impeccable/fd`. |
| **our `skills/personality/reference/slop-manifest.md`** + `type-and-color.md` | **High** | Repo's own measured + curated tells: glassmorphism everywhere, repeating-gradient stripes, extreme radius, ghost card, side-accent border, colored box-shadow glow, AI purple/violet gradient, gradient text, cream/beige reflex (2nd-gen slop), warm-off-white+earthy-accent (3rd-gen slop), "always tint — pure #000/#fff never occur in nature". Cited as `slop-manifest`. |
| **taste.dev** | **Thin / wrong target** | Resolves to Terry Xu's personal portfolio, not a taste encoder. Its *only* usable signal is by-example: near-zero gradients/texture, neutral bases, restraint. **The intended "taste" source is almost certainly `tasteskill.dev`** (above), which is a genuine anti-slop framework. Leaning harder on tasteskill + impeccable + our manifest, per instruction. |

The measured/derived detectors already in the repo (below) confirm most of these are
**minable from our corpus**, not just hand-asserted.

## What our crawl already captures (the minable substrate)

Per-element computed style (`crawl-features.ts` `ElementStyle` / v2 `LayoutElement`):

- `backgroundColor` — solid fill, per element (area-weighted → dominant per section)
- `backgroundImage` — `"none"` OR a gradient/`url()` string (this is where every gradient, mesh, pattern, and photo bg lives)
- `boxShadow` — `"none"` or a shadow (elevation / glow)
- `textShadow` — `"none"` or a shadow
- `filter` — `"none"` or e.g. `drop-shadow(...)`, `blur(...)`, `grayscale(...)`
- `backdropFilter` — `"none"` or `blur(...)` (glassmorphism)
- `borderRadius` — px (top-left)
- `borderColor` — only when a visible border (width > 0) exists
- page fingerprint `gradientText` — `background-clip:text` + transparent color + gradient bg

Derived genome fields (`derive-layout-data.ts`):

- **`materialOf(record)`** → `{ radiusLanguage, shadowLanguage, borderLanguage, accentStrategy, surfaceTexture }`
  - `radiusLanguage`: `pill-dominant` (any radius ≥ 100) / `controlled-rounded` / `sharp-minimal`
  - `shadowLanguage`: `flat-borders-not-shadows` / `colored-glow-elevation` (coloredShadows > max(2, shadows·0.2)) / `soft-low-elevation`
  - `borderLanguage`: `structural-dividers` / `selective` / `minimal`
  - `accentStrategy`: `one-primary-plus-signal` (≤2 chromatic colors) / `controlled-multi-accent` (≤6) / `multi-accent`
  - `surfaceTexture`: `gradient-or-textured` (gradients > max(2, elements·0.08)) / `none-or-subtle`
- **`bandRhythmOf(...)`** → `{ sequence, darkBandCount, stripeAlternation, bgHueCount }` — area-weighted dominant `backgroundColor` per section in visual order; the macro dark/light banding signal.
- **`layeringDepthOf(...)`** → `0..1` fraction of leaf elements whose overlap points into a *different* section, **boosted when `backdropFilter` usage or a wide z-index spread** corroborate deliberate layering (glass cards over hero media, sticky headers).
- Aggregate observation files already emitted: `observations.gradients.json` (gradient type + endpoint-hue pair → siteCount), `observations.radii.json` (sharp/rounded/pill), `observations.styles.json` (% of sites per tell, incl. glassmorphism / gradient-text / extreme-radius / AI-purple-gradient).

The upshot: a background/material archetype can be **mined as a frequency-across-sites
cluster over exactly these fields** — the same method that produced the crawl-derived layout
families — and a slop gate is expressible as a threshold on the same fields.

---

# 1. The taxonomy

Each treatment: **what it is · key parameters · TASTE vs SLOP gate (with source) · minable via**.
Parameters are the dials the engine's material derivation would expose; the gate is the
condition the slop layer checks. Treatments are grouped: **field backgrounds** (page/section),
**surface material** (component), and **cross-cutting**.

## A. Field backgrounds (page- and section-level)

### A1. Flat / solid fill
- **What**: single `backgroundColor`, no image.
- **Params**: hue, lightness, chroma; whether tinted-neutral vs saturated brand fill.
- **TASTE**: an *off*-black/off-white or a tinted neutral — chroma ~0.005–0.02 toward the brand hue (`impeccable/fd`, `tasteskill`). A committed **solid saturated color** is a documented slop-*escape* move ("replace soft gradients with solid saturated color", `type-and-color.md`).
- **SLOP**: pure `#000000` / `#ffffff` — "always tint; they don't occur in nature" (`slop-manifest`, `impeccable/fd`, `tasteskill`). Also the **cream/beige `#f5f1ea`–`#faf7f1` reflex** as a "tasteful" default (`impeccable/slop`, `slop-manifest` 2nd-gen), and the **warm-off-white + single earthy accent** 3rd-gen template.
- **Minable**: `backgroundColor` == `#000`/`#fff` exactly (untinted); dominant page bg hex ∈ cream/beige band; `bgHueCount`.

### A2. Linear gradient
- **What**: `linear-gradient(...)` in `backgroundImage`.
- **Params**: angle, stop count, endpoint hue pair, hue travel (ΔH), chroma, contrast.
- **TASTE**: 2 stops, small hue travel (a tonal shift within one hue family), low chroma, used to *model light* on a real surface.
- **SLOP**: the **AI purple→blue gradient** (endpoint hues in violet/indigo→cyan), high ΔH, high chroma; any gradient reached for as generic "impact". (`slop-manifest`, `impeccable/fd`, `impeccable/slop` "AI-purple gradients"). tasteskill: **saturation < 80%, max 1 accent**.
- **Minable**: `observations.gradients.json` already keys **gradient type + endpoint-hue pair → siteCount** — the purple-blue cluster is directly countable; per-site `surfaceTexture=gradient-or-textured`.

### A3. Radial gradient / halo / spotlight glow
- **What**: `radial-gradient(...)`; a soft saturated bloom, usually behind a hero or section.
- **Params**: center placement, radius, accent hue, opacity/haze strength, on-dark vs on-light.
- **TASTE**: a deliberate light source that models real material and has a reason to be there (`impeccable/slop` "light the composition with real material").
- **SLOP**: "**a saturated radial glow on a dark page is a familiar generated-UI shortcut**"; "a faint accent haze sits behind a section as a spotlight" (`impeccable/slop`: *Radial-gradient background halo*, *Decorative radial spotlight glow*). Decorative, unmotivated.
- **Minable**: `backgroundImage` contains `radial-gradient`; high chroma + on-dark (`bandRhythm` dark band) co-occurrence.

### A4. Mesh / blob organic gradient (lava-lamp)
- **What**: multiple overlapping radial/blurred blobs — the "mesh gradient" / organic blob background.
- **Params**: blob count, blur radius, palette breadth, motion (static vs animated).
- **TASTE**: rare, tied to brand, single restrained palette; named in tasteskill's reference vocabulary but **with no license to default to it** — it must be motivated.
- **SLOP**: the multi-hue, high-blur, purple-leaning mesh reached for as the default "modern SaaS" hero. This is a canonical AI tell (co-listed with glass and purple gradient across all sources).
- **Minable**: multiple `radial-gradient` layers in one `backgroundImage`; `surfaceTexture=gradient-or-textured` + high `bgHueCount`.

### A5. Noise / grain texture
- **What**: film-grain/noise overlay (SVG noise, texture image, or `filter`).
- **Params**: opacity, grain scale, monochrome vs colored, placement (fixed overlay vs on scroller).
- **TASTE**: subtle, on a **fixed `pointer-events-none` pseudo-element** — tasteskill's explicit rule: *"Apply grain/noise EXCLUSIVELY to fixed, `pointer-events-none` pseudo-elements (`fixed inset-0 z-[60] pointer-events-none`). NEVER on scrolling containers."* Adds tactility to an otherwise flat field.
- **SLOP**: heavy grain as a "premium" veneer with no material logic; grain on a scrolling container (perf tell as well as taste tell).
- **Minable**: `backgroundImage`/`filter` noise signature; low corpus frequency = distinctiveness signal.

### A6. Dot-grid
- **What**: repeating dot lattice (`radial-gradient` dot tiling or bg image).
- **Params**: dot size, spacing, opacity, contrast vs field.
- **TASTE**: low-opacity, supports a **canvas/map/measurement task** (a board, a diagram surface).
- **SLOP**: decorative dot-grid behind ordinary marketing content — the sibling of the line-grid tell below.
- **Minable**: repeating-`radial-gradient` background image; section role ≠ canvas/diagram (`sectionRole`).

### A7. Line-grid / graph paper
- **What**: repeating line lattice.
- **Params**: line weight, spacing, opacity.
- **TASTE**: only when it **supports a canvas, map, or measurement task** — the exact carve-out impeccable states.
- **SLOP**: "**A decorative grid covers a surface without supporting a canvas, map, or measurement task. Use product structure or a plain field.**" (`impeccable/slop`: *Decorative grid-line background*).
- **Minable**: repeating-`linear-gradient`/tiled bg image; `sectionRole` not a tool/diagram surface.

### A8. Repeating-gradient stripes
- **What**: `repeating-linear-gradient(...)` used as surface decoration.
- **Params**: stripe width, angle, contrast.
- **TASTE**: essentially never as generic decoration — reach for a deliberate texture or leave the surface plain.
- **SLOP**: "**Repeating-gradient stripes used as surface decoration are a recurring generated-UI signature.**" (`impeccable/slop`, `slop-manifest`).
- **Minable**: `backgroundImage` contains `repeating-linear-gradient`.

### A9. Geometric / tiling pattern
- **What**: SVG/image geometric pattern tile.
- **Params**: motif, scale, density, opacity, contrast.
- **TASTE**: brand-specific motif, low-density, motivated.
- **SLOP**: generic tiled pattern as filler; folds into the "decorative surface with no function" family.
- **Minable**: `url()` in `backgroundImage` with small tile / `background-repeat`.

### A10. Image / photo background
- **What**: `url()` photo/illustration as section/page bg.
- **Params**: subject relevance, crop/`objectFit`, overlay/scrim, text-contrast handling.
- **TASTE**: real, relevant imagery with a legibility scrim ensuring WCAG contrast for overlaid text.
- **SLOP**: "**thin light text on images — unpredictable contrast**" (`impeccable/fd` dangerous combos); stock/irrelevant hero filler; Claude-drawn illustrative SVG scene (`slop-manifest`).
- **Minable**: `backgroundImage` `url()`; overlaid text elements' contrast; `assets[].role` = decorative-asset/hero-visual.

### A11. Duotone / tinted image
- **What**: photo pushed to a two-tone brand palette (`filter` + blend, or pre-processed).
- **Params**: shadow hue, highlight hue, contrast.
- **TASTE**: a strong, cheap brand-unifier; ties disparate imagery to one palette.
- **SLOP**: rarely slop; risk is only over-saturation / illegible mid-tones.
- **Minable**: `filter` grayscale/sepia/contrast on image assets; constrained palette on image sections.

### A12. Section-band alternation (contrast banding)
- **What**: alternating dark/light (or hue) full-width bands down the page — the macro rhythm.
- **Params**: band count, dark-band count, alternation rate, hue count, whether each band earns a distinct treatment.
- **TASTE**: rhythm that **differentiates sections** and guides a narrative scroll (this is literally the positive `contrast-band-flow` layout family). tasteskill caveat: banding must stay **within ONE page theme** — "sections do not invert… the user must not feel they walked into a different website mid-scroll."
- **SLOP**: "uniform white sections stacked", "same treatment every band" (the family's own `antiPatterns`); OR banding so violent it reads as multiple sites (tasteskill theme-lock breach).
- **Minable**: **`bandRhythm` directly** — `sequence`, `darkBandCount`, `stripeAlternation` (0..1), `bgHueCount`. This is the single most engine-ready background signal we already compute.

## B. Surface material (component-level)

### B1. Radius language (surface shape)
- **What**: the corner-radius system for cards/inputs/buttons.
- **Params**: scale — sharp (0) / soft (12–16px) / pill (full).
- **TASTE**: **pick ONE scale and stick to it** — tasteskill's *Shape consistency lock*: "all-sharp / all-soft / all-pill; mixed systems only with a documented rule."
- **SLOP**: "**extreme border-radius (24px+ on a small card) — everything becomes a soft blob**" (`impeccable/slop`, `slop-manifest`); inconsistent mixed radii.
- **Minable**: `borderRadius` distribution → `materialOf.radiusLanguage` (`pill-dominant`/`controlled-rounded`/`sharp-minimal`); `observations.radii.json`.

### B2. Shadow / elevation language
- **What**: `boxShadow` as depth.
- **Params**: elevation scale (sm→xl), blur/spread, shadow hue, count of elevation levels.
- **TASTE**: a **consistent elevation scale**, subtle — "**if you can clearly see it, it's probably too strong**" (`impeccable/fd`). **Tint the shadow to the bg hue; no pure-black drop shadows on light backgrounds** (`tasteskill`). In dark mode, get depth from a **lighter surface, not a shadow** (`impeccable/fd`).
- **SLOP**: "rounded rectangles with generic drop shadows — safe, forgettable"; the **hairline border + wide diffuse shadow "ghost card"** ("commit to one: a defined edge OR a soft elevation", `impeccable/slop`, `slop-manifest`).
- **Minable**: `boxShadow` presence/count → `materialOf.shadowLanguage`; hairline (`borderColor` set) co-occurring with a wide `boxShadow` on the same element = ghost-card detector.

### B3. Colored / glow shadow (dark-mode neon)
- **What**: colored `boxShadow` glow, typically on dark.
- **Params**: glow hue, spread, saturation.
- **TASTE**: purposeful lighting tied to a real accent, used sparingly.
- **SLOP**: "**Dark backgrounds with colored box-shadow glows are the default 'cool' look of AI-generated UIs**"; "dark mode with glowing accents… looks cool without requiring actual design decisions" (`impeccable/slop`, `impeccable/fd`, `slop-manifest`).
- **Minable**: **already derived** — `materialOf.shadowLanguage == "colored-glow-elevation"` (coloredShadows threshold), especially with `bandRhythm.darkBandCount` high.

### B4. Border / divider language
- **What**: how surfaces are separated — hairlines, structural dividers, or none.
- **Params**: weight, hue, selective vs full.
- **TASTE**: "**Use cards ONLY when elevation communicates real hierarchy; otherwise group with `border-t`, `divide-y`, or negative space**" (`tasteskill`); cards not required, never nested (`impeccable/fd`).
- **SLOP**: **thick accent border on ONE side of a rounded card — "the most recognizable tell of AI-generated UIs"** (`impeccable/slop` *Side-tab accent border*, `slop-manifest`); border clashing with a rounded corner.
- **Minable**: `borderColor` present + asymmetric width (needs per-side capture; top-width is captured, a side-accent extension would capture all four) → `materialOf.borderLanguage`.

### B5. Glass / backdrop-blur (glassmorphism)
- **What**: `backdropFilter: blur(...)` translucent surface.
- **Params**: blur radius, fill opacity, inner border, inner highlight, fallback.
- **TASTE**: only to **solve a real layering problem**; done properly = "beyond `backdrop-filter`: add a 1px inner border (`border-white/10`) and a subtle inner shadow (`shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]`) for edge refraction, **plus a solid-fill fallback under `prefers-reduced-transparency`**" (`tasteskill`). Label as approximation.
- **SLOP**: "**Glassmorphism everywhere — blur/glass/glow used as decoration rather than to solve a real layering problem**" (`impeccable/slop`, `impeccable/fd`, `slop-manifest`). Also note `impeccable/fd`: "**alpha is a design smell**" — heavy transparency usually means an incomplete palette.
- **Minable**: `backdropFilter != none` frequency (already a flagged detector in `observations.styles.json`); cross-checked against `layeringDepth` — glass with **low** layeringDepth = decorative (nothing real is being layered) = the slop condition; glass with **high** layeringDepth = solving a real overlap.

### B6. Vignette / inner-shadow "physical edge"
- **What**: inset shadow / vignette giving a surface a tactile lip.
- **Params**: inset offset, highlight vs shadow, opacity.
- **TASTE**: `shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]` for physical edge refraction (`tasteskill`); the tactile `:active` push (`-translate-y-[1px]` / `scale-[0.98]`).
- **SLOP**: overdone vignette as faux-depth with no material logic.
- **Minable**: `boxShadow` with `inset`; `textShadow` presence.

## C. Cross-cutting

### C1. Gradient text (decorative)
- **What**: gradient clipped to text.
- **TASTE**: essentially none for headings/metrics.
- **SLOP**: "**Gradient text on headings/metrics — decorative, not meaningful**" (`slop-manifest`, `impeccable/fd`).
- **Minable**: page fingerprint **`gradientText` boolean already captured**.

### C2. Animated background
- **What**: moving gradient/particles/blob motion.
- **Params**: motion type, speed, easing, reduced-motion handling.
- **TASTE**: one high-impact moment; respects `prefers-reduced-motion`; easing = ease-out-quart/quint/expo.
- **SLOP**: perpetual animated mesh/particles as ambient filler; bounce/elastic easing; animating layout props (`slop-manifest` Motion).
- **Minable**: `animationName != none` on a bg element; `filter`/`backgroundImage` on an animated node.

---

# 2. Taste principles (distilled, to fold into material derivation + slop gates)

Concrete, each attributed. These are the rules the engine's `deriveMaterial` and the slop
layer should encode.

1. **Theme-lock over section-invert.** One page theme; sections may re-rhythm (band) but must not feel like a different site mid-scroll. Bound `bandRhythm.stripeAlternation` and keep bands within one theme. — `tasteskill`
2. **Never pure #000/#fff; tint everything.** Off-black (zinc-950 / near-black warm gray) and off-white; neutrals carry chroma ~0.005–0.02 toward the brand hue. Pure black/white and pure gray "don't occur in nature." — `slop-manifest`, `impeccable/fd`, `tasteskill`
3. **Neutral base + ONE high-contrast accent.** Zinc/Slate/Stone base, max 1 accent, **saturation < 80%**. Dominant-color-plus-sharp-accent beats timid even palettes. — `tasteskill`, `impeccable/fd` (60-30-10 is about visual weight, accent works *because* it's rare)
4. **OKLCH, reduce chroma at lightness extremes.** A light tint at 85% L needs ~0.08 chroma, not 0.15 — high chroma at extreme lightness looks garish. — `impeccable/fd`
5. **Decoration must have a function.** A grid/dot/line/halo/spotlight/pattern is taste **only** when it supports a canvas, map, measurement, or real layering task; otherwise use product structure or a plain field. This is the single most repeated background rule across impeccable. — `impeccable/slop`
6. **Depth: pick one — a defined edge OR a soft elevation, never both.** Kill the hairline-border + wide-diffuse-shadow ghost card. Shadows subtle enough that you can't clearly see them; consistent elevation scale. — `impeccable/slop`, `impeccable/fd`
7. **Tint shadows to the background; no pure-black drop shadows on light.** In dark mode, get depth from a lighter surface, not a shadow. — `tasteskill`, `impeccable/fd`
8. **Alpha is a design smell.** Heavy transparency usually means an incomplete palette; define explicit surface/overlay colors per elevation level instead (exception: focus rings / interactive states). Directly constrains how much glass a design should carry. — `impeccable/fd`
9. **Glass is a layering tool, not decoration.** Only over real overlap; when used, add inner border + inset highlight + reduced-transparency solid fallback. — `tasteskill`, `impeccable/slop`
10. **One radius scale, documented.** All-sharp / all-soft(12–16px) / all-pill; no soft-blob 24px+ on small cards; mixed only with a rule. — `tasteskill`, `impeccable/slop`
11. **Grain/noise on a fixed `pointer-events-none` overlay only.** Never on a scroll container. — `tasteskill`
12. **Rotate the palette family across builds; refuse the category default.** If the last premium-consumer build was beige+brass, this one must not be. Escaping slop is grounding the choice in *this* subject's world, not picking the current fashionable alternative (cream+brass → warm-off-white+earthy is just the next default). — `tasteskill` (rotation mandate), `slop-manifest` (2nd/3rd-gen slop)
13. **Cards are not required.** Group with negative space, `border-t`, `divide-y`; never nest cards. — `impeccable/fd`, `tasteskill`
14. **The AI-slop test for backgrounds.** If someone would instantly believe "an AI made this surface," it's slop. Aim for "how was this made?" — `slop-manifest`, `impeccable/fd`

---

# 3. Slop danger-zone list (gate or use-only-knowingly-in-context)

The specific bg treatments + parameter ranges the engine should **gate/avoid by default**,
or only emit with an explicit in-context justification. Each is expressible against captured
fields.

| # | Danger zone | Gate condition (on captured/derived fields) | Source |
|---|---|---|---|
| S1 | **AI purple/violet→cyan gradient** | `backgroundImage` linear/radial with endpoint hues in violet-indigo(~260–300)→cyan(~180–200), high ΔH, high chroma; `observations.gradients.json` cluster | `slop-manifest`, `impeccable/slop`, `impeccable/fd` |
| S2 | **Mesh/blob lava-lamp bg (multi-hue)** | ≥2 `radial-gradient` layers + high `bgHueCount` + `surfaceTexture=gradient-or-textured`, unmotivated section role | all sources |
| S3 | **Radial glow / spotlight halo on dark** | `radial-gradient`, high chroma, on a dark band (`bandRhythm.darkBandCount`>0), decorative section | `impeccable/slop` |
| S4 | **Glassmorphism-everywhere** | `backdropFilter != none` frequency high **AND** `layeringDepth` low (no real overlap being solved) | `impeccable/slop`, `slop-manifest`, `impeccable/fd` |
| S5 | **Colored box-shadow glow (dark-mode neon)** | `materialOf.shadowLanguage == "colored-glow-elevation"` + dark bands | `impeccable/slop`, `slop-manifest` |
| S6 | **Ghost card** (hairline + wide diffuse shadow) | element has `borderColor` set **and** a wide-blur `boxShadow` simultaneously | `impeccable/slop`, `slop-manifest` |
| S7 | **Side-accent border on rounded card** | thick one-side border + `borderRadius`≥8 (needs 4-side border capture to detect the asymmetry) | `impeccable/slop`, `slop-manifest` |
| S8 | **Extreme radius blob** | `borderRadius` ≥ 24 on a small element / `radiusLanguage == "pill-dominant"` where not intentional | `impeccable/slop`, `slop-manifest` |
| S9 | **Repeating-gradient stripes as decor** | `backgroundImage` contains `repeating-linear-gradient` | `impeccable/slop`, `slop-manifest` |
| S10 | **Decorative grid/dot-grid** behind ordinary content | tiled `linear`/`radial-gradient` bg, `sectionRole` ∉ {canvas, diagram, tool} | `impeccable/slop` |
| S11 | **Gradient text** | fingerprint `gradientText == true` on heading/metric | `slop-manifest`, `impeccable/fd` |
| S12 | **Pure #000 / #fff fields** | dominant `backgroundColor` exactly `#000000`/`#ffffff` (untinted) | `slop-manifest`, `tasteskill`, `impeccable/fd` |
| S13 | **Cream/beige "tasteful" default** | dominant page bg hex ∈ `#f5f1ea`–`#faf7f1` warm-cream band (2nd-gen); warm-off-white + single earthy accent (3rd-gen) | `impeccable/slop`, `slop-manifest`, `tasteskill` (palette ban) |
| S14 | **Over-saturated fill** | accent `backgroundColor` saturation ≥ 80% | `tasteskill` |
| S15 | **Grain on scroll container** | noise `filter`/`backgroundImage` on a non-fixed, scrolling element (perf + taste) | `tasteskill` |
| S16 | **Section-invert theme break** | `bandRhythm.stripeAlternation` very high with opposed themes (reads as multiple sites) | `tasteskill` |

**Danger-zone posture:** gate S1–S3, S5, S9–S12, S15 to **off by default** (emit only when the
intent explicitly motivates them); treat S4, S6–S8, S13–S14, S16 as **parameter clamps**
(glass only with layeringDepth justification; radius clamped; palette rotated; saturation
capped). None are absolute bans — impeccable/tasteskill/our-manifest all frame these as
"unmotivated/interchangeable/harmful-in-context," matching the repo's own validation policy
(`derive-layout-data.ts` provenance: "frequency is not quality; a pattern becomes slop only
when unmotivated, interchangeable, or harmful in context").

---

# 4. How this maps to the existing engine

The engine **already has the plug points** — the background axis extends them, it doesn't
invent a new subsystem.

### Where it plugs in

- **`deriveMaterial(family, iv)`** in `apps/engine/layout-families.mjs` already returns
  `{ radiusLanguage, shadowLanguage, borderLanguage, accentStrategy, surfaceTexture }`, driven
  by the `materiality`, `energy`, and `contentDensity` dials via `band3`. **This is the exact
  function the background axis grows into.** Today `surfaceTexture` is a 3-way
  `band3(m, "none", "none-or-subtle", "subtle-gradient")` — thin. The taxonomy above is the
  spec for widening it into a proper `BackgroundGenome`:
  - promote `surfaceTexture` to a **treatment selection** from §1 (flat / tinted-neutral /
    linear / radial / mesh / grain / dot-grid / line-grid / stripes / pattern / image / duotone
    / glass / banding / animated), each with its parameter block (hue, scale, density, opacity,
    contrast, placement, motion) — the §1 "Params" lines are the field list;
  - keep `radiusLanguage` / `shadowLanguage` / `borderLanguage` / `accentStrategy` as the
    **surface-material** half (§B), now governed by principles §2 (theme-lock, tinted shadows,
    one-radius-scale, ghost-card ban, alpha-as-smell);
  - add a **band/field layer** driven by `bandRhythm` semantics (§A12) so page-level rhythm is
    a first-class output, not just component material.
- **`materialSlots`** on every family (e.g. `["hero-surface","proof-rail","feature-lead-card","accent-signal"]`, `["dark-band-surface","light-band-surface","cta-band","accent-signal"]`) are the **named
  surfaces the background axis fills.** The background derivation assigns a §1 treatment +
  params to each slot, gated by §3. The `contrast-band-flow` family's slots are already
  literally a banding spec — the cleanest first target.
- **Slop gate**: the engine already carries a `slop: { score, matchedRules }` field on each
  genome and `perturbAndValidate`/`validatePerturbed` in `perturb.mjs`. The §3 danger-zone
  table is the rule set to add to the material validator — same shape as the layout
  `antiPatterns` gating, thresholded on the captured/derived fields.

### Confirming background archetypes are MINABLE (like layouts were)

Yes — and with **less new instrumentation** than layouts needed, because the material fields
are already captured and three of the derived signals already exist:

- The layout families were mined as human-inspected clusters over the 1,259-host geometry
  crawl (`provenance: "crawl-derived"`, e.g. `docs-three-rail-reader` with
  `clusterMemberCount`/`representativeHost`). The identical method applies to backgrounds:
  cluster sites over **`materialOf` output + `bandRhythm` + `layeringDepth` + `observations.gradients.json`
  / `observations.radii.json` / `observations.styles.json`**, human-inspect, and author a seed
  set of **background archetypes** (e.g. "tinted-neutral flat field + hairline dividers + no
  shadow", "dark-band contrast rhythm + one accent", "glass-over-hero-media with real
  layeringDepth", "editorial off-white + ruled hairlines"), each carrying `provenance`,
  `whenToUse`/`notFor`, `antiPatterns` (drawn from §3), and a taste-vs-slop note.
- Every §1 treatment lists its **"Minable via"** field, so each archetype's membership test
  and each slop gate is computable from the existing NDJSON — no re-crawl required for the
  common cases. Two gaps worth a small capture extension: **all-four-side border widths**
  (to detect the S7 side-accent tell precisely; today only top-width/`borderTopColor` is kept)
  and an explicit **noise/`url()` vs gradient split** in `surfaceTexture` (to separate grain
  from gradient). Both are additive to `crawl-features.ts` `ElementStyle`.
- Frequency-across-sites is already the crawl's organizing principle (the font-saturation
  parallel). So a background treatment's **corpus frequency doubles as its slop-risk prior**:
  the purple gradient, glass, and pill-radius clusters are common ⇒ high slop risk ⇒ gate;
  a well-executed grain-on-fixed-overlay or duotone is rare ⇒ distinctiveness signal ⇒ safe to
  reach for. This mirrors how the type axis treats over-used fonts.

### One-line summary

The background axis = **widen `deriveMaterial` into a treatment-selecting `BackgroundGenome`**
(field layer from §A/§C, surface-material layer from §B), **fill each family's `materialSlots`**
with a §1 treatment + params, **gate with the §3 danger-zone table** on already-captured fields,
and **mine seed background archetypes** from `materialOf` + `bandRhythm` + `layeringDepth` +
the `observations.*` files the same way the crawl-derived layout families were mined.

---

## Source links

- [tasteskill.dev — the anti-slop frontend framework](https://www.tasteskill.dev/) and its [SKILL.md](https://github.com/Leonxlnx/taste-skill)
- [impeccable.style/slop](https://impeccable.style/slop) — the public slop taxonomy behind the local `impeccable:*` skills
- local `impeccable:frontend-design` skill + `reference/color-and-contrast.md`, `reference/spatial-design.md` (installed plugin)
- `skills/personality/reference/slop-manifest.md`, `skills/personality/reference/type-and-color.md`
- crawl: `packages/crawl/src/crawl-features.ts` (capture), `packages/crawl/src/derive-layout-data.ts` (`materialOf`, `bandRhythmOf`, `layeringDepthOf`)
- engine: `apps/engine/layout-families.mjs` (`deriveMaterial`, `materialSlots`)
- note: **taste.dev** resolves to Terry Xu's personal portfolio (not a taste encoder); the intended source is `tasteskill.dev`.
