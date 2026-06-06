# Components & UI patterns — premade parts, precise instruments, contrast

> The deep dive for the Build step's *component* decisions. Companion to
> `composition-and-boldness.md` (layout archetypes, type moves), `craft-principles.md`
> (hierarchy, type, gestalt), `polish.md` (the finishing pass), and `slop-colors.md`
> (the banned palette). This file does NOT repeat those. It governs four moves: stop
> hand-drawing illustrative SVG (use premade icon/component libraries), keep only
> precise data-driven SVG/canvas, fix contrast, and play with more interesting layouts.

**The core correction.** Claude-hand-authored *illustrative* SVG — figures, scenes,
objects, mascots, "spot illustrations" built by writing `d="…"` to depict a *thing* —
reads amateur every time: wrong proportions, inconsistent stroke, uncanny geometry. The
fix is not "draw better." It is: **never draw the thing.** Use a premade icon set for
glyphs, premade components for UI, and reserve custom SVG/canvas strictly for
*computed* instruments (charts, gauges, generated geometry). Illustration that genuinely
needs an artist is out of scope — leave the slot empty or use type/photography/CSS form,
not a hand-coded cartoon.

---

## 1. Icon libraries — never hand-draw icon glyphs

A hand-coded icon (a `<svg><path d="M3 7l9 5…"/>` "house" or "user") is the most common
amateur tell: it won't match weight, grid, or optical balance with its neighbors. Use one
established set, and only one per page. All four below are free for commercial use.

| Library | Count / styles | Grid · stroke | License | CDN delivery |
|---|---|---|---|---|
| **Lucide** | ~1,600, single outline style | 24×24, 2px stroke | ISC | UMD JS (`data-lucide` + `createIcons()`), or static SVG/font |
| **Phosphor** | ~9,000, six weights (Thin/Light/Regular/Bold/Fill/Duotone) | 24×24 (256-unit canvas) | MIT | web-font (`<i class="ph ph-…">`) via jsDelivr, or SVG |
| **Heroicons** | ~316, Outline/Solid/Mini/Micro | 24×24 (Mini 20, Micro 16) | MIT | copy SVG, or `@heroicons` npm; by the Tailwind team |
| **Tabler** | ~5,900, outline + filled | 24×24, 2px stroke | MIT | web-font / SVG sprite / npm via CDN |

**Exact usage — Lucide (the reference single-file path):**
```html
<i data-lucide="rocket"></i>           <!-- placeholder element, name = kebab-case -->
<script src="https://unpkg.com/lucide@latest"></script>
<script>lucide.createIcons();</script>  <!-- swaps every [data-lucide] for inline SVG -->
```
The UMD bundle exposes a global `lucide`; `createIcons()` replaces each `data-lucide`
element with an inline `<svg>` you can style with `currentColor`, `width`, and
`stroke-width`. Pin a version (`lucide@0.4xx`) for reproducibility rather than `@latest`.

**Exact usage — Phosphor (web font, no JS):**
```html
<link rel="stylesheet"
  href="https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.1/src/regular/style.css">
<i class="ph ph-rocket"></i>
<i class="ph-fill ph-heart" style="color: var(--accent)"></i>
```
Load only the weight CSS files you use (`regular`, `fill`, …) — each is a separate sheet.

**Heroicons / Tabler:** Heroicons ships no runtime — copy the SVG markup (or use the npm
package) and set `class`/`fill`/`stroke`. Tabler offers a web-font and an SVG sprite over
CDN; reference symbols with `<svg><use href="…#tabler-rocket"/></svg>`.

**Which to use when.** Lucide — clean, neutral, the safe default for product UI and a wide
icon vocabulary at one consistent weight. Phosphor — when you want a *character* choice
(Duotone/Fill/Thin) as part of the identity, or need an icon Lucide lacks (largest set).
Heroicons — pairs naturally with a Tailwind build; small, tight, opinionated set. Tabler —
dense dashboards / data UIs needing many utility glyphs at uniform 2px stroke.

**Rules (non-negotiable):**
- **One set per page.** Mixing Lucide + Phosphor + Font Awesome in one view is instant slop.
- **Size and color to the system.** Set `width`/`height` from the spacing scale (16/20/24),
  `stroke-width` to match your type weight, color via `currentColor` so icons inherit the
  palette — never ship them in default black on a tinted ground.
- **Optical sizing.** Bump icons ~1px against cap height so they don't sit small next to text.
- **Decorative icons** get `aria-hidden="true"`; an icon that *is* the only label needs an
  accessible name (`aria-label` on the control, or visually-hidden text). (See §3, §6.)
- **Don't recolor an outline set to fake a fill set** — pick the right weight from the library.

---

## 2. When custom SVG / canvas IS allowed

Allowed only for **precise, data-driven instruments** — geometry *computed* from numbers,
not *drawn* to resemble a thing. These are exactly where hand-authoring is a strength: the
path is generated, so it is correct by construction.

**The test (apply before writing any SVG):**
> If you are hand-authoring `d="…"` (or a series of `<path>`/`<circle>` calls) to **depict
> a thing** — a person, animal, building, plant, tool, mascot, scene, "abstract blob"
> decoration — it is **banned.** If the geometry is **generated from data or a formula**
> (a value, an array, a function, a coordinate set), it is **allowed.**

**Allowed (data-driven):**
- **Charts** — bars, lines, areas, scatter, candlesticks; points mapped from real data.
  Hand-roll small ones from `<rect>`/`<polyline>`; for anything real use a library
  (Chart.js, ECharts, D3) so axes/scales/a11y are correct.
- **Progress / radial instruments** — rings and arcs via `stroke-dasharray` on a `<circle>`,
  computed from a percentage; gauges, dials, meters.
- **Sparklines / trend curves** — a `<polyline>` whose points are `value→pixel` mapped.
- **Maps & geographic shapes** — from real GeoJSON/TopoJSON, projected — not traced by hand.
- **Generated/parametric geometry** — grids, spirographs, voronoi, noise fields, lattices,
  L-systems, particle fields on `<canvas>` — every vertex from a function or seed.
- **Diagrams from structure** — node/edge graphs, flowcharts, treemaps laid out by an
  algorithm (dagre, d3-hierarchy), not positioned by eye.
- **Data-derived dividers** — e.g. a waveform from audio samples, a contour from a dataset.

**Banned (illustrative), regardless of brief:**
- Figures, faces, mascots, characters; animals; objects (rockets, coffee cups, gears as
  decoration); buildings/skylines; landscapes/scenes; "hero illustrations"; decorative
  organic blobs/squiggles meant to look hand-drawn.
- Icon glyphs (→ §1) and logos drawn from scratch.

**If a brief truly needs illustration:** that is an artist/stock/photography job. Substitute
a bold type treatment, a real photograph, a CSS/`conic-gradient` geometric form, or
honest empty space. Do not fill the gap with a hand-coded cartoon.

**Craft for the allowed instruments:**
- Drive everything from data/`viewBox` math; never magic-number coordinates by eye.
- Use `vector-effect: non-scaling-stroke` so strokes stay crisp when the SVG scales.
- Title/`aria`: give an instrument an accessible summary
  (`<svg role="img" aria-label="Revenue grew 40% in Q3">`) or a visually-hidden data table;
  never leave a chart as an unlabeled image (WCAG 1.1.1).
- Respect `prefers-reduced-motion` for animated/particle canvases (see `craft-principles.md`).
- Color from the palette tokens, AA against the surface (§6) — not chart-library defaults.

---

## 3. Accessible UI component patterns (done right + the slop version to avoid)

Reach for **semantic HTML first** — it gives keyboard, role, and focus behavior for free.
For each: correct structure, the generic-slop version to refuse, and how to de-slop it.

**De-slop rule for every component below:** the library/markup gives *structure*; the skill
gives *identity*. Restyle borders, radius, type, and color to the chosen palette — never
ship the framework default look (see §4). Apply ONE consistent border weight and radius
across all of them (`polish.md`).

- **Card** — `<article>` (or `<section>` with heading) containing real heading + content;
  if the whole card is a link, wrap the heading in `<a>` and stretch it with a `::after`
  overlay (don't nest interactive controls). *Slop:* every block boxed in an identical
  rounded-2xl + drop-shadow card → "boxitis," no hierarchy. *De-slop:* group with
  whitespace first; use cards only for truly independent, peer-level items; tint the
  surface, tint the shadow toward it, hold one radius.
- **Data table** — `<table>` with `<caption>`, `<thead>`/`<th scope="col">`,
  `<tbody>`/`<th scope="row">`; numbers right-aligned with `font-variant-numeric:
  tabular-nums`. *Slop:* a grid of `<div>`s faking a table (no semantics, no keyboard/SR
  support) or a card pretending to hold a "metric." *De-slop:* real `<table>`, zebra or
  rule-based separation in palette neutrals, generous cell padding from the spacing scale.
- **Nav bar** — `<header><nav aria-label="Primary"><ul><li><a aria-current="page">`;
  a real `<button aria-expanded aria-controls>` for the mobile toggle. *Slop:* centered
  logo + 4 ghost links + a pill CTA in default indigo. *De-slop:* commit to the layout
  archetype (asymmetric, side-rail, etc.), own the CTA color, give links a real
  `:hover`/`:focus-visible` underline.
- **Form / input** — every field a real `<label for>` (placeholders are NOT labels);
  group with `<fieldset><legend>`; errors in **text** tied via `aria-describedby` +
  `aria-invalid`, not color alone; inputs ≥44px tall. *Slop:* floating-placeholder-only
  fields, thin 1px gray borders failing 3:1, color-only error states. *De-slop:* visible
  labels, ≥3:1 input borders, error text + icon, focus ring in the accent.
- **Badge / tag / pill** — `<span>` with text; if it conveys status, include a word or
  icon, not just hue (WCAG 1.4.1). *Slop:* tiny low-contrast gray pills; status-by-color
  only. *De-slop:* AA text on a tinted-from-palette chip, label spells the status.
- **Tabs** — `role="tablist"` of `<button role="tab" aria-selected aria-controls>` +
  `<div role="tabpanel" tabindex="0">`; arrow-key roving focus. *Slop:* `<div>`s with a
  colored underline and no keyboard support. *De-slop:* real ARIA tabs (or a
  `<details>`/anchor fallback), selected state via weight+color, not color alone.
- **Accordion** — `<details><summary>` (free keyboard + toggle), or a
  `<button aria-expanded aria-controls>` + region pattern. *Slop:* `<div onclick>` rows
  with a rotating chevron and no `aria-expanded`. *De-slop:* native `<details>`, animate
  only `transform`/`opacity`, chevron from the chosen icon set.
- **Dialog / modal** — native `<dialog>` opened with `.showModal()`: gets implicit
  `role="dialog"`, `aria-modal`, top-layer stacking, `::backdrop`, and Esc-to-close for
  free. Add a labelled close `<button>`, `aria-labelledby` the title, and return focus to
  the trigger on close. (Browser support >96%; Chrome 37+, Firefox 98+, Safari 15.4+.
  Note: `showModal` keeps focus *inside* but per APA does not hard-trap it from browser
  chrome — that's intended.) *Slop:* a `<div>` overlay with `z-index: 9999`, no focus
  management, no Esc, scroll-bleed behind. *De-slop:* `<dialog>`, style `::backdrop` as a
  tinted scrim (not pure black), AA content.
- **Toast / notification** — a persistent `aria-live="polite"` (or `role="status"`) region
  so screen readers announce it; never rely on color/position alone; auto-dismiss must be
  pausable / long enough (WCAG 2.2.1). *Slop:* a colored box that appears with no live
  region and vanishes in 2s. *De-slop:* live region, icon+text per status, dismiss control,
  palette colors at AA.

---

## 4. CSS component layer — fast polish without slop

These give structure and reset friction fast. The danger: every one ships a **default
theme that IS the slop** (Tailwind's default `indigo-500` `#6366f1` is the canonical
"every AI app turned purple" source — see `slop-colors.md`). Use the library for
structure; **always restyle the tokens to the chosen palette/type before shipping.**

- **Tailwind (Play CDN)** — `<script src="https://cdn.tailwindcss.com"></script>` for
  zero-build prototyping (the CDN is explicitly *dev-only*, not production). It does NOT
  give you identity — utilities are neutral until you choose values. **Rule:** define your
  palette in the config (`tailwind.config = { theme: { extend: { colors: {…} } } }`) or as
  CSS variables and reference them (`bg-[var(--accent)]`); **never** use `bg-indigo-*`,
  `from-indigo-* to-cyan-*`, or the default blue/violet. Set the font family. Default
  Tailwind look = slop.
- **DaisyUI** (Tailwind plugin) — semantic component classes (`btn`, `card`, `modal`,
  `tabs`) on top of Tailwind. **Rule:** never ship a stock theme (`light`/`dark`/
  `cupcake`); define a custom `[data-theme]` block overriding the color CSS variables
  (`--p` primary, `--s`, `--a`, base/neutral) to your palette. From CDN, the theme is
  written as CSS variables, not in a config. Structure from Daisy, color from you.
- **Pico.css** — classless framework that styles semantic HTML directly (`<button>`,
  `<nav>`, `<table>`, `<article>`) with <10 classes; ~130 `--pico-*` CSS variables and 20
  built-in themes. **Rule:** great for honest semantic structure fast; override the
  `--pico-*` variables (primary, background, font) in `:root`/`[data-theme]` — don't ship
  a stock Pico theme, which reads as "default Pico." Pure CSS, no JS.
  `<link rel="stylesheet" href="…/@picocss/pico@2/css/pico.min.css">`.
- **Open Props** — a *token* library, not components: CSS custom properties for colors,
  sizes, shadows, easings, font scales (`<link rel="stylesheet"
  href="https://unpkg.com/open-props">`). Wrapped in low-specificity `:where()` so they
  override trivially. **Rule:** use the *structural* props (sizes, easings, radii) and
  **substitute your own color/font tokens** — the OKLCH ramps you authored — rather than
  the default hues. This is the most de-slop-friendly option: tokens with no opinionated
  default look.

**One rule across all four:** the library is scaffolding. If the page could be recognized
as "default Tailwind / default Daisy / default Pico," you have shipped the slop. Restyle
the tokens, set the type, commit the accent — then it's structure carrying *your* identity.

---

## 5. Layout patterns to PLAY with (beyond the 12 composition archetypes)

`composition-and-boldness.md` lists 12 *compositional* archetypes for the page spine. These
are *structural* patterns — the scaffolding you build pages and apps on. Push for variety:
don't reach for the centered single-column every time. Each = what · when · how.

- **Bento grid** — *what:* modular CSS Grid of differently-sized cells (Apple/Google/
  Spotify popularized it). *when:* feature showcases, dashboards, "everything at a glance"
  landing sections. *how:* a 12-col grid, cells span varied row/col counts;
  `grid-auto-flow: dense` to backfill gaps; each cell a peer card with one focal idea.
  Avoid uniform sizing — the *variation* is the point; keep one radius/border system.
- **Sidebar / app-shell** — *what:* persistent left (or icon-rail) nav + top bar + main.
  *when:* tools, dashboards, docs, settings. *how:* `grid-template-columns: auto 1fr` with
  `grid-template-areas`; sidebar collapses to a drawer (`<dialog>`/`<details>`) on mobile —
  never `display:none` the nav away.
- **Dashboard** — *what:* a grid of data instruments (KPIs, charts from §2, tables).
  *when:* analytics, admin, monitoring. *how:* responsive
  `repeat(auto-fit, minmax(16rem,1fr))`; match *density* to expert context (don't
  low-density it "because it photographs well"); `tabular-nums` everywhere.
- **Sticky-rail + scrolling content** — *what:* one column pinned (`position: sticky`)
  while the other scrolls. *when:* product detail (sticky media, scrolling specs),
  docs (sticky TOC), checkout (sticky summary). *how:* sticky child inside a tall grid
  column; ensure it releases before the footer; disable sticky on narrow viewports.
- **Magazine / editorial multi-column** — *what:* true newspaper grid, visible rules,
  varied column spans, pull quotes. *when:* long-form, essays, lookbooks (earn it with
  real text). *how:* multi-track grid + `column-span`-style breaks for the lead; one shared
  baseline; pull quote breaks the grid once, deliberately.
- **Split with sticky media** — *what:* page splits into a fixed visual half and a
  scrolling text half. *when:* storytelling product pages, case studies. *how:* two-column
  grid, media column `sticky`; content column drives the narrative; stack on mobile.
- **Asymmetric feature rows** — *what:* alternating media-left / media-right rows with
  *unequal* weighting, not mirrored 50/50. *when:* feature marketing without bento. *how:*
  alternate `grid-template-columns: 7fr 5fr` / `5fr 7fr`; balance by weight, not symmetry
  (`layout-grids-spacing.md`).
- **Masonry** — *what:* variable-height items packed tight (Pinterest). *when:* galleries,
  cards of uneven length. *how:* CSS Grid masonry where supported, else a `columns`-based
  fallback or JS; keep gutters on the spacing scale; beware reading-order surprises for SR.
- **Command-palette-driven** — *what:* a ⌘K overlay as the primary navigation surface.
  *when:* power-user tools, large content sets. *how:* a `<dialog>` with a filtered list,
  arrow-key roving focus, `aria-activedescendant`; must have a visible fallback nav too.
- **Full-bleed alternating sections** — *what:* edge-to-edge bands alternating
  ground/surface, each its own self-contained scene. *when:* marketing narratives, brand
  sites. *how:* `width:100%` sections, inner content `max-width` centered; alternate two
  palette grounds (both AA with their text); vary internal layout per band so it isn't a
  stack of identical hero blocks.
- **Overlapping / layered sections** — *what:* elements bleed across section boundaries
  (image overlapping the band below, cards straddling a color change). *when:* to add depth
  and break the "stacked rectangles" monotony. *how:* negative margin or grid overlap +
  `z-index`; keep figure/ground unambiguous (`craft-principles.md` gestalt); test reflow at
  320px so overlaps don't collide.

**Coverage push:** like the composition archetypes, vary the *structural* pattern across
builds — two bento landing pages or two centered single-columns in a row is convergence.
Pick the structure the content actually wants (a tool wants an app-shell, an essay wants
editorial), not the most photogenic one.

---

## 6. Contrast — accessible pairing

The hard floor (WCAG 2.x AA, the de-facto legal standard): **body text ≥ 4.5:1**,
**large text (≥18pt / ≥14pt bold) ≥ 3:1**, **non-text UI & focus indicators ≥ 3:1**
(SC 1.4.3, 1.4.11). AAA raises body to **7:1**. **Do not round — 4.47:1 fails 4.5:1.**
Every interactive *state* (hover/focus/disabled) and text over gradients/scrims must be
checked at every stop.

**Deriving an accessible text / ground / accent triple (OKLCH recipe):**
1. **Ground** — pick the surface lightness first. Light ground ~`L 0.96–0.99`; dark ground
   ~`L 0.10–0.16`. Give it a *real* low hue (`C 0.02–0.06`) tinted toward the brand —
   not pure white/black (avoids irradiation, `color.md`).
2. **Text** — step `L` far from the ground until contrast passes. On a light ground, text
   ~`L 0.20–0.30`; on a dark ground, text ~`L 0.90–0.97`. Verify the *number*, don't eyeball.
3. **Accent** — the one committed hue (CTAs, key status). It must hit **≥3:1** as a large/UI
   element and **≥4.5:1** if it carries body-size text on it (or if text sits on it).
   Keep it out of the banned bands (`slop-colors.md`); derive it from the subject.
4. **Tier the contrast:** primary text high (AAA if you can), secondary text de-emphasized
   by *weight or muted lightness* but still ≥4.5:1 — never by shrinking below readable size.

**The dark-ground pitfall (the failure we hit).** Warm-brown text on a warm-umber ground —
two colors close in *lightness* and *hue* — looked atmospheric and failed badly: ~2–3:1,
unreadable. On a dark or strongly-tinted ground, **contrast must come from lightness, not
chroma or vibe.** Fix it two ways: **(a) raise the text lightness** (push it toward
`L 0.92+`, near-white tinted), and/or **(b) desaturate / re-lighten the ground** (drop its
chroma and separate its `L` from the text's). Same-family warm-on-warm (or any low-L-delta
pair) is the trap — open the lightness gap and re-measure.

**Tools:** WebAIM Contrast Checker and browser DevTools (contrast in the color picker /
Accessibility pane, plus the vision-deficiency emulator) for AA/AAA pass-fail; verify in CI
where possible. **APCA note:** the WCAG-3 successor algorithm reports perceptual lightness
contrast as **Lc** (0 to ~±106), context-aware by size/weight — roughly *Lc 60 ≈ 4.5:1,
Lc 75 ≈ 7:1, Lc 45 ≈ 3:1*, but only near mid-gray. APCA models dark-mode and thin-type
contrast far better than WCAG 2 (which overstates contrast for near-black pairs — exactly
the warm-on-warm failure). Use APCA as a *better perceptual sanity check*, but **conform to
WCAG 2.x AA numbers** since that is what law and audits require today.

**Never convey meaning by color alone** (SC 1.4.1; ~8% of men have CVD): pair every status
hue with an icon (§1) or text label (§3).

---

## Sources

All URLs verified live during research (June 2026).

**Icon libraries (§1)**
- Lucide — guide & ISC license: https://lucide.dev/guide/lucide/ ; CDN how-to (unpkg + `data-lucide` + `createIcons`): https://kristianfreeman.com/how-to-use-lucide-icons-via-a-cdn ; repo/license: https://github.com/lucide-icons/lucide
- Phosphor Icons — site & weights: https://phosphoricons.com/ ; web CDN package (`@phosphor-icons/web` via jsDelivr, `ph ph-…`): https://github.com/phosphor-icons/homepage
- Heroicons (MIT, Tailwind team): https://heroicons.com/
- Tabler Icons (MIT, ~5,900, 24×24/2px): https://tabler.io/icons
- Icon-license comparison (all MIT/ISC, commercial-safe): https://dev.to/usapopopooon/what-i-didnt-know-about-icon-library-licenses-and-you-might-not-either-30of

**Data-driven SVG/charts (§2)**
- Chart.js: https://www.chartjs.org/ ; Apache ECharts: https://echarts.apache.org/ ; D3: https://d3js.org/
- SVG `stroke-dasharray` for rings/arcs (MDN): https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-dasharray
- Accessible charts / `role="img"` + label (WCAG 1.1.1): https://www.w3.org/WAI/tutorials/images/complex/

**Accessible components (§3)**
- Native `<dialog>` — accessibility & support: https://dev.to/ilham-bouktir/the-html-dialog-element-your-native-solution-for-accessible-modals-and-popups-308p ; focus behavior (APA, no hard trap needed): https://css-tricks.com/there-is-no-need-to-trap-focus-on-a-dialog-element/ ; MDN: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog
- ARIA Authoring Practices (tabs, accordion, dialog patterns): https://www.w3.org/WAI/ARIA/apg/patterns/
- `<details>`/`<summary>` (MDN): https://developer.mozilla.org/en-US/docs/Web/HTML/Element/details
- `aria-live` / `role="status"` for toasts (MDN): https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Live_Regions
- WebAIM Million 2025 (low contrast = #1 failure; ARIA misuse): https://webaim.org/projects/million/2025

**CSS component layer (§4)**
- Tailwind Play CDN (dev-only) & theme config: https://tailwindcss.com/docs/installation/play-cdn ; theme variables: https://tailwindcss.com/docs/theme
- DaisyUI from CDN + custom theme via CSS variables: https://daisyui.com/docs/cdn/ , https://daisyui.com/docs/themes/
- Pico.css (semantic, classless, `--pico-*` vars): https://picocss.com/ , https://picocss.com/docs/css-variables
- Open Props (CSS custom-property tokens, CDN, `:where()` low specificity): https://open-props.style/ , https://github.com/argyleink/open-props
- Tailwind default-indigo as slop source (context, see slop-colors.md): https://adamwathan.me / Tailwind blog

**Layout patterns (§5)**
- Bento grid with CSS Grid (`grid-auto-flow: dense`): https://iamsteve.me/blog/bento-layout-css-grid ; overview/why: https://www.freecodecamp.org/news/bento-grids-in-web-design/
- CSS Grid vs Flexbox (structure vs component): https://blog.logrocket.com/css-flexbox-vs-css-grid/
- `position: sticky` (MDN): https://developer.mozilla.org/en-US/docs/Web/CSS/position
- Intrinsic responsive grids `auto-fit`/`minmax` (MDN): https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout

**Contrast (§6)**
- WCAG 2.2 (Recommendation): https://www.w3.org/TR/WCAG22/ ; SC 1.4.3 Contrast Minimum: https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html ; SC 1.4.11 Non-text Contrast: https://dequeuniversity.com/resources/wcag2.1/1.4.11-non-text-contrast ; SC 1.4.1 Use of Color: https://www.w3.org/WAI/WCAG21/Understanding/use-of-color.html
- WebAIM Contrast & Color: https://webaim.org/articles/contrast/ ; Contrast Checker: https://webaim.org/resources/contrastchecker/
- APCA — easy intro & Lc↔WCAG mapping: https://git.apcacontrast.com/documentation/APCAeasyIntro.html ; why APCA: https://git.apcacontrast.com/documentation/WhyAPCA.html ; calculator: https://apcacontrast.com/
- OKLCH for deriving accessible ramps (evilmartians): https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl
