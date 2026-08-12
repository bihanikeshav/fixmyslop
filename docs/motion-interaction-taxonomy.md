# Motion / Interaction Taxonomy + Taste Rules

Spec for the design engine's **MOTION / INTERACTION axis** — the sibling of the built
layout, color, type, and **background/material** axes (mined/authored treatments + seeded
perturbation + slop gates). Motion is the thing that makes a page "feel" alive: scroll
behavior, reveals, easing, snapping, micro-interactions, page transitions, custom scrollbars.
It is also a **major slop zone** — scroll-jacking, whole-page parallax, autoplay-everything,
janky/linear easing, motion that ignores `prefers-reduced-motion`. So this taxonomy is built
to **separate motion-used-with-taste from slop-default**, and every treatment is annotated with
(a) its parameters, (b) the gate that flips it from taste to slop, and (c) whether we can
**detect / mine it from the current crawl** or it **needs a motion-aware re-capture**.

`prefers-reduced-motion` is treated as a **HARD requirement**, not a nice-to-have — it is a
non-negotiable output of every motion treatment, mirroring how contrast-AA is non-negotiable in
the color axis.

Research/spec deliverable only — **no engine code changed here.** This is the sibling of
`docs/background-material-taxonomy.md` and follows its format deliberately.

## Sources and how much each is worth

| Source | Weight | What it gave |
|---|---|---|
| **local `impeccable:animate` skill** | **High** | The richest single source on purposeful motion. Concrete, parameterized rules: duration bands by purpose (100–150 / 200–300 / 300–500 / 500–800 ms), the recommended easing tokens (`ease-out-quart/quint/expo` with exact cubic-beziers) and the banned ones (bounce/elastic), **exit = ~75% of enter duration**, stagger 100–150ms, transform+opacity-only, `will-change` sparingly, the reduced-motion CSS block, and an explicit **NEVER** list. Cited `imp/animate`. |
| **tasteskill.dev** (Leonxlnx/taste-skill, "the anti-slop frontend framework") | **High** | The strongest external anti-slop framing. Verbatim rules: **animate ONLY `transform`/`opacity`** (never top/left/width/height); default `cubic-bezier(0.16, 1, 0.3, 1)`; spring `stiffness 100 / damping 20`, no linear on springs; durations 300ms UI / 700ms fluid / 800ms+ scroll-entry; stagger `i*0.06` (~60ms); **`MOTION_INTENSITY` 1–10 dial** (low=hover, high=scroll/magnetic); **reduced-motion mandatory above intensity 3**; **ban `window.addEventListener('scroll')`** and custom `scrollY`-in-React-state; scroll-pin only via GSAP ScrollTrigger isolated in leaves; **marquee at most ONCE per page**; hover only above intensity 5; **motion must have a one-sentence purpose** ("It looked cool" is amateur). Cited `tasteskill`. |
| **local `impeccable:polish` skill** | **High** | The ship-gate view: transitions 150–300ms, `ease-out-quart/quint/expo` never bounce/elastic, **60fps / only animate transform+opacity**, motion serves purpose not decoration, respects reduced-motion; every interactive element needs all **8 states** (default/hover/focus/active/disabled/loading/error/success); no layout shift (CLS); 44×44px touch targets. Cited `imp/polish`. |
| **local `impeccable:delight` skill** | **Med** | Micro-interaction + delight detail: press `translateY(2px)`+shadow, hover `translateY(-2px)` at `ease-out-quart`, delight moments **< 1s** and skippable, **vary responses** (not the same animation every time), custom cursors only for branded experiences, "if users notice the delight more than the goal, you've gone too far." Cited `imp/delight`. |
| **our `skills/personality/reference/slop-manifest.md`** (Motion + General-quality sections) | **High** | Repo's own tells: **bounce/elastic easing is dated → use ease-out-quart/quint/expo**; **animating layout props (width/height/padding/margin) = jank, use transform/opacity**; **image hover scale/rotate is a recurring generated-UI signature**; **core content invisible until scroll** (`opacity:0` + IntersectionObserver gating the hero/headings/body — "reads as blank/broken without JS and to crawlers; reveal effects are for secondary polish only, and must respect `prefers-reduced-motion`"); **the standout that doesn't render** (a signature component that needs JS/scroll to appear — an invisible standout is a failed standout). Cited `slop-manifest`. |
| **`docs/background-material-taxonomy.md`** | — | The sibling spec whose format, engine-mapping method, and minability framing this doc mirrors. |

Method note (same as the background axis): **frequency-across-sites is the slop-risk prior.**
A motion pattern that saturates the corpus (linear easing everywhere, `animate-pulse`,
scroll-jack libs, image-hover-scale) is high slop-risk ⇒ gate; a rare, well-executed treatment
is a distinctiveness signal ⇒ safe to reach for. This mirrors how the type axis treats
over-used fonts.

---

## What our crawl already captures (the minable substrate)

**Per-element computed style** (`crawl-features.ts` `ElementStyle` / v2 `LayoutElement`, read off
the live DOM, ~600 elements/site, both viewports):

- `transitionProperty` — e.g. `"all"`, `"transform"`, `"transform, opacity"`, `"color, background-color"`
- `transitionDuration` — e.g. `"0s"`, `"0.15s"`, `"0.3s"`, comma-lists per property
- `transitionTiming` — the timing function, e.g. `"ease"`, `"cubic-bezier(0.4, 0, 0.2, 1)"`, `"linear"`
- `animationName` — `"none"` or the **keyframe name** (e.g. `"spin"`, `"marquee"`; **not** the keyframe body)
- geometry that bears on motion indirectly: `rect.normalized` / `areaShare` / `heightShare`, `document.height`
  vs `viewport.height`, `visibility.opacity`, `visibility.inViewport`, `zIndex`, `overlapIds`, `sectionRole`.

**Page-level fingerprint** (`PageFingerprint`, computed once per site on desktop):

- `animationLibs[]` — **motion-library detection** via script src + globals + DOM markers:
  `aos`, `animate.css`, `gsap` (+ ScrollTrigger/TweenMax), `framer-motion`,
  `lenis/locomotive` (smooth-scroll libs, merged into one label), `swiper` (carousel/slider).
- `tailwindAnimate[]` — the `animate-*` utility class names actually present in markup. This leaks
  **motion *intent*** even when computed style is static at crawl time (reveal, marquee, scroll,
  float, accordion, etc.).
- `gradientText`, `sparkleBadge` — cross-cutting AI tells (already used by other axes).

### What the corpus actually contains (empirical scan, first 600 records of `geometry-crawl-raw.v2.1.ndjson`, 583 ok)

This is the evidence that the transition/animation fields carry **real, mineable signal**, not noise:

- **Transitions are near-universal:** 487 / 583 ok sites (84%) have at least one element with a
  non-trivial (`≠ all`, `≠ none`) `transitionProperty`.
- **CSS `animationName ≠ none` on 245 / 583 sites (42%)** — a real animation-saturation signal.
- **Easing distribution is directly countable** (element-weighted top): `ease` (dominant),
  `cubic-bezier(0.4, 0, 0.2, 1)` (Material standard, ~15k), `ease-in-out`, and **`linear` (~680
  occurrences)** — linear on a non-continuous transition is a jank tell we can flag by frequency.
- **Duration distribution:** after `0s` (the resting default), the mass sits at **`0.15s`,
  `0.2s`, `0.3s`** with a long thin tail to `0.5s`+ — i.e. the corpus mostly lives inside
  impeccable's 150–300ms band, so **over-long durations are detectable as outliers.**
- **Motion libraries, site counts:** `swiper` 36, `gsap` 19, `framer-motion` 15,
  `lenis/locomotive` 13, `aos` 6, `animate.css` 2.
- **`tailwindAnimate` is a goldmine of intent:** `animate-pulse` 64, `accordion-up/down` 28 each,
  `animate-spin` 24, `animate-ping` 17, `animate-marquee` 14 (+ `marquee-vertical/left/right/alt/reverse`),
  `animate-fade-in` 12, `animate-bounce` 11, plus a long tail of `animate-on-scroll`,
  `animate-fade-up`, `animate-scroll*`, `animate-float`, `animate-blob`, `animate-border-beam`,
  `animate-meteor-effect`, `animate-marquee`. **Reveal, marquee, and scroll-keyed motion are all
  legible here today.**

### Coverage table — motion-relevant signal: captured now vs needs re-capture

| Signal | Captured? | Field / source | Minable now vs re-capture |
|---|---|---|---|
| CSS `transition-property` | **Yes** | `ElementStyle.transitionProperty` | **Minable now** |
| CSS `transition-duration` | **Yes** | `ElementStyle.transitionDuration` | **Minable now** (duration-band distribution) |
| CSS `transition-timing-function` (easing) | **Yes** | `ElementStyle.transitionTiming` | **Minable now** (easing distribution; linear/bounce detection) |
| CSS `animation-name` present | **Yes** (name only) | `ElementStyle.animationName` | **Minable now** (animation saturation); keyframe *body* NOT captured |
| Motion library present (gsap/framer/lenis/locomotive/aos/swiper/animate.css) | **Yes** | `PageFingerprint.animationLibs[]` | **Minable now** |
| Tailwind `animate-*` intent (reveal/marquee/scroll/float/accordion…) | **Yes** | `PageFingerprint.tailwindAnimate[]` | **Minable now** (intent proxy) |
| Gradient text (cross-cutting tell) | **Yes** | `PageFingerprint.gradientText` | **Minable now** |
| `transform` (computed matrix / translate / scale) | **No** | — (`"transform"` only appears as a *transition-property value*) | **Re-capture** |
| `will-change` | **No** | — | **Re-capture** |
| `scroll-snap-type` / `scroll-snap-align` | **No** | — | **Re-capture** |
| `scroll-behavior: smooth` | **No** | — (lenis/locomotive lib is a weak proxy) | **Re-capture** |
| Custom scrollbar (`::-webkit-scrollbar`, `scrollbar-width`, `scrollbar-color`) | **No** | — | **Re-capture** |
| `position: sticky` / pinned sections | **No** | — (`zIndex`/`overlapIds` exist but no `position`) | **Re-capture** (weak geometric inference only) |
| Scroll-triggered reveal (opacity:0 → in) | **Partial** | inferred: `animationLibs` (aos/gsap/lenis) + `tailwindAnimate` (`animate-on-scroll`) + `visibility.opacity==0` on in-viewport content | **Partial now** (see note) |
| Parallax (depth-differential on scroll) | **Partial** | inferred: `lenis/locomotive`/`gsap` + `[data-scroll]`; no per-layer speed | **Re-capture** for true detection |
| **Hero fits viewport / no spill past ~100vh** | **Yes (geometry)** | hero `sectionRole`/`focalRegion` rect + `heightShare` vs `viewport.height`; `document.height` | **Minable now** (geometry, no motion re-capture needed) |
| Autoplay video / motion | **Partial** | `assets[].tag == "video"` exists; `autoplay`/`muted`/`loop` attrs NOT captured (media is route-aborted) | **Re-capture** |

> **Reveal-detection caveat.** The rich-capture recipe (`--rich-capture`) **stubs
> `IntersectionObserver` to fire immediately** and autoscrolls, so reveal-gated elements are
> *forced visible* — meaning rich-capture geometry **cannot** see the initial `opacity:0` reveal
> state. The **default** recipe (no IO stub, single `waitForTimeout(1200)`) is the one where an
> IO-gated hero can still read `opacity:0` above the fold — which is exactly the `slop-manifest`
> "core content invisible until scroll" tell. So reveal is best mined from `tailwindAnimate` +
> `animationLibs` today, and the opacity-gated-hero slop check should run against **default**-recipe
> captures, not rich-capture ones.

---

# 1. The taxonomy

Each treatment: **what it is · key parameters · TASTE vs SLOP gate (with source) · detected via**.
Parameters are the dials `deriveMotion` would expose; the gate is the condition the slop layer
checks. Grouped: **A. Scroll-field behavior** (page-level), **B. Reveal & entrance**,
**C. Micro-interaction** (component-level), **D. Transition & continuity**, **E. Cross-cutting**.

Global defaults every treatment inherits (from `imp/animate` + `tasteskill` + `imp/polish`):
**animate `transform`/`opacity` only**; **easing = `ease-out-quart/quint/expo` or
`cubic-bezier(0.16,1,0.3,1)` for enters, never linear/bounce/elastic**; **exit ≈ 75% of enter
duration**; **`prefers-reduced-motion` collapses the treatment to static/instant (HARD).**

## A. Scroll-field behavior (page-level)

### A1. Smooth-scroll
- **What**: eased programmatic scrolling (CSS `scroll-behavior: smooth` or a lib: Lenis / Locomotive).
- **Params**: technique (CSS vs lib), damping/lerp, duration; whether it hijacks the wheel.
- **TASTE**: light smoothing that keeps native scroll semantics; **CSS `scroll-behavior: smooth`**
  or a well-tuned Lenis with low lerp. Anchor-link smoothing is the safest form.
- **SLOP**: heavy lerp that makes the page feel laggy/floaty and fights the user's input; any
  hand-rolled `window.addEventListener('scroll')` / `scrollY`-in-state driver — **"causes
  frame-rate collapse and re-render storms"** (`tasteskill`, banned outright). Smooth-scroll that
  becomes scroll-*jacking* → see A2.
- **Detected via**: `animationLibs` contains `lenis/locomotive` (proxy) **now**; true
  `scroll-behavior: smooth` needs **re-capture**.

### A2. Scroll-snap (section snapping)
- **What**: `scroll-snap-type: y mandatory/proximity` with `scroll-snap-align` on sections — the
  page clicks to section boundaries.
- **Params**: axis, `mandatory` vs `proximity`, snap alignment, per-section vs free.
- **TASTE**: **`proximity`** snapping on a genuinely sectioned, full-height narrative (a deck-like
  page); gives rhythm without trapping the user. Pairs naturally with the `contrast-band-flow` /
  `viewport-canvas` layout families.
- **SLOP**: **`mandatory`** snapping that traps scroll, eats momentum, and breaks Find-in-page /
  keyboard scroll — a scroll-jacking cousin (`tasteskill`: pinning only via ScrollTrigger,
  isolated; reduced-motion must "collapse entirely").
- **Detected via**: **needs re-capture** (`scroll-snap-type`/`align` not captured; `swiper` is a
  weak carousel-only proxy).

### A3. Sticky / pinned sections
- **What**: `position: sticky` headers, or a section pinned while inner content animates (GSAP
  ScrollTrigger `pin: true`).
- **Params**: pin target, pin duration (scroll distance), `pinSpacing`, `scrub`.
- **TASTE**: a sticky nav/aside that aids orientation; a **single** deliberate pinned
  storytelling beat via ScrollTrigger, **isolated in a leaf component** (`tasteskill` canonical:
  `start:"top top", pin:true, pinSpacing:false`; horizontal-pan `scrub:1`).
- **SLOP**: multiple stacked pins that turn the whole page into a scroll-jacked slideshow; pinning
  that ignores reduced-motion.
- **Detected via**: `animationLibs` = `gsap` + `[data-scroll]` (proxy) **now**; `position:sticky`
  and pin config **need re-capture**.

### A4. Parallax (depth-differential on scroll)
- **What**: layers translate at different rates vs scroll, implying depth.
- **Params**: layer count, per-layer speed ratio, axis, subtle (≤0.2 ratio) vs excessive.
- **TASTE**: **one subtle** background layer moving slightly slower than foreground — a whisper of
  depth. Ratio small; respects reduced-motion.
- **SLOP**: **whole-page / multi-layer parallax** as the site's whole personality; big speed
  ratios that induce nausea and layout jitter; parallax that ignores reduced-motion (`tasteskill`:
  "parallax… must collapse entirely under reduced motion"; slop danger-zone S-P below).
- **Detected via**: `lenis/locomotive`/`gsap` + `[data-scroll]` (proxy) **now**; per-layer speed
  **needs re-capture**.

### A5. Marquee / ticker (continuous auto-scroll)
- **What**: an infinitely translating row (logos, testimonials, words).
- **Params**: speed, direction, pause-on-hover, gap, duplication for seamless loop.
- **TASTE**: **at most ONE per page** (`tasteskill`: "two or more marquees reads as lazy filler"),
  slow, pause-on-hover, purpose-driven (a real logo wall).
- **SLOP**: multiple marquees; fast dizzying speed; marquee as filler where a static grid would do;
  no reduced-motion stop.
- **Detected via**: `tailwindAnimate` (`animate-marquee`/`-vertical`/`-left`/`-right`/`-reverse`,
  `animate-infinite-scroll`, `animate-scroll-logos`) + `swiper` — **minable now** (frequency
  per site directly counts the "≥2 marquees" tell).

### A6. Hero fits the viewport (no spill past ~100vh fold) — *the user's explicit ask*
- **What**: the hero/first section resolves within ~100vh so the first paint is a complete
  composition, not a headline whose content is cut mid-glyph by the fold.
- **Params**: hero `heightShare` target (≈ 0.9–1.05 × viewport), overflow tolerance, scroll-cue
  affordance.
- **TASTE**: hero section height ≈ one viewport (±10%); a small "scroll" affordance invites the
  next section. Adjacent tell in `slop-manifest`: **"oversized hero headline that eats the whole
  viewport"** — fitting the *composition* to the fold is good; letting a *single headline* consume
  it is not.
- **SLOP**: hero content spilling well past 100vh so the fold cuts a sentence/card in half; OR the
  inverse tell (one giant headline = the entire fold with nothing else).
- **Detected via**: **minable now from geometry** — hero `sectionRole`/`focalRegion` rect
  `heightShare` vs `viewport.height`, and whether the next section's top sits near ~1.0vh. No
  motion re-capture needed.

## B. Reveal & entrance

### B1. Scroll-reveal (fade / slide / mask, staggered) — *the user's explicit ask*
- **What**: elements enter (fade + short translate, or clip-path mask) as they cross into view.
- **Params**: distance (**≤ ~24px** translate), duration (**enter 500–800ms** for scroll-entry,
  `tasteskill`/`imp/animate`), easing (`cubic-bezier(0.16,1,0.3,1)` / ease-out-quint), **stagger
  ≈ 60ms** (`tasteskill` `i*0.06`) to **100–150ms** (`imp/animate`), `once: true`, viewport amount ~0.3.
- **TASTE**: **secondary polish only** — fade + small slide with easing, fires once, small
  distance. Motion library `whileInView` / IntersectionObserver. Must have a stated purpose
  (`tasteskill`).
- **SLOP** *(HARD)*: **gating the hero/headings/body behind `opacity:0` + IO** — "reads as
  blank/broken without JS and to crawlers… reveal effects are for secondary polish only, and must
  respect `prefers-reduced-motion`" (`slop-manifest`). Long distances, big durations, everything
  reveals (animation fatigue). Linear/bounce easing.
- **Detected via**: `tailwindAnimate` (`animate-on-scroll`, `animate-fade-up`, `animate-fade-in`,
  `animate-in`, `animate-slide-up-fade`) + `animationLibs` (`aos`, `gsap`) **now**; the
  opacity-gated-hero *slop* check via `visibility.opacity==0` on in-viewport hero content in
  **default-recipe** captures.

### B2. Loading / enter (page-load choreography)
- **What**: the site's opening move — staggered reveal of hero elements on first paint; skeletons.
- **Params**: element stagger (100–150ms, `imp/animate`), fade+slide combo, hero duration 500–800ms,
  ONE signature moment.
- **TASTE**: **one well-orchestrated hero entrance** (`imp/animate`: "one signature animation");
  skeleton screens that fade; content is present in the DOM and merely *animates in*.
- **SLOP** *(HARD)*: **"the standout that doesn't render"** — a signature component that needs JS/
  scroll to appear; an invisible standout is a failed standout (`slop-manifest`). Everything
  animating on load; a long blocking intro.
- **Detected via**: `tailwindAnimate` (`animate-hero-title/description/image`, `animate-fade-in-up`,
  `animate-in`) **now**; the render-failure slop check overlaps B1's opacity-gate detector.

### B3. Custom scrollbar (polished) — *the user's explicit ask*
- **What**: a styled scrollbar (`scrollbar-width: thin` + `scrollbar-color`, or
  `::-webkit-scrollbar*`) tuned to the palette.
- **Params**: width (thin), thumb/track color (tinted to surface, not pure gray), radius, hover state.
- **TASTE**: **thin, tinted to the surface** (chroma toward brand hue, per the neutral-tint rule),
  subtle hover; keeps the OS affordance legible and the track from clashing.
- **SLOP**: an over-thick/high-contrast/neon scrollbar that becomes decoration; a track so styled
  it's hard to grab; pure-gray thumb (untinted, per color rules).
- **Detected via**: **needs re-capture** (`scrollbar-width`/`scrollbar-color` and `::-webkit-scrollbar`
  pseudo-element styles are not captured).

## C. Micro-interaction (component-level)

### C1. Hover feedback
- **What**: pointer-hover response on interactive elements.
- **Params**: transform (`translateY(-1 to -2px)` lift and/or `scale(1.02–1.05)`), color/shadow
  shift, duration **150–250ms**, easing ease-out-quart.
- **TASTE**: subtle lift/scale + color shift (`imp/delight`: `translateY(-2px)` at ease-out-quart;
  `imp/animate` hover scale 1.02–1.05). `tasteskill`: **hover only when `MOTION_INTENSITY > 5`** and
  only on genuinely interactive elements; hover is desktop-only (no equivalent on touch).
- **SLOP**: **image hover scale/rotate — "a recurring generated-UI signature"** (`slop-manifest`);
  scale so large it reflows neighbors; animating layout props to do it (use transform).
- **Detected via**: `transitionProperty` including `transform`/`scale` on `img`/asset elements +
  short `transitionDuration` **now** (image-hover-scale is a computable co-occurrence: transform
  transition on an `img`/`figure`). Precise hover-transform value needs re-capture, but the
  *presence* is inferable.

### C2. Press / active state
- **What**: the tactile "push" on `:active`.
- **Params**: `translateY(1–2px)` down and/or `scale(0.98)`, fast (**100–150ms**), shadow decrease.
- **TASTE**: `active:scale-[0.98]` / `translateY(2px)` "simulate a physical push" (`tasteskill`,
  `imp/delight`). Fast, snappy.
- **SLOP**: no press feedback at all (dead button); or a heavy/slow press that feels laggy.
- **Detected via**: **needs re-capture** (`:active` pseudo-class styles not captured; only resting
  computed style is read).

### C3. Focus state
- **What**: keyboard-focus indicator.
- **Params**: ring color (accent), width, offset, high contrast.
- **TASTE**: **visible, high-contrast focus ring, never removed without replacement** (`imp/polish`,
  `tasteskill`: "Focus rings must be visible and high-contrast"). This is an **accessibility HARD
  rule**, adjacent to reduced-motion.
- **SLOP**: `outline: none` with no replacement; a focus ring below contrast threshold.
- **Detected via**: **needs re-capture** (`:focus-visible` styles + `outline` not captured).

### C4. Toggle / checkbox / switch feedback
- **What**: state-change animation on toggles, checkboxes, switches.
- **Params**: slide + color transition **200–300ms**, check-draw, subtle.
- **TASTE**: smooth slide + color (`imp/animate` 200–300ms); check-mark draw. Purpose = state
  feedback.
- **SLOP**: bounce/elastic spring on the toggle (dated); overwrought particle bursts on a checkbox.
- **Detected via**: `transitionProperty`/`Duration` on control elements **now** (partial);
  keyframe-driven variants need re-capture of keyframe bodies.

### C5. Cursor micro-interaction / custom cursor follower
- **What**: a custom cursor, magnetic buttons, or a trailing cursor element.
- **Params**: magnet strength, follower lag, blend mode; branded vs gratuitous.
- **TASTE**: a **branded** custom cursor or subtle magnetic button on a portfolio/creative site
  (`imp/delight`: "custom cursors for branded experiences"); `tasteskill` files magnetism at the
  high end of the intensity dial (isolated, reduced-motion-collapsing).
- **SLOP**: **gratuitous cursor followers / trailing dots** on an ordinary marketing/SaaS page —
  decoration with no purpose; ignores reduced-motion; hurts perf.
- **Detected via**: **needs re-capture** (JS-driven; no CSS signature; a heuristic on
  `animationLibs` + a `[data-cursor]`/`.cursor` marker could be added).

## D. Transition & continuity

### D1. Page / route transition
- **What**: crossfade or shared-element transition between routes/views.
- **Params**: type (crossfade / shared-element / slide), duration **300–500ms**, easing ease-out.
- **TASTE**: a quick crossfade or a shared-element handoff that preserves spatial continuity
  (`imp/animate` "crossfade between routes, shared element transitions"). One consistent transition.
- **SLOP**: long (>500ms) blocking route transitions; a different flashy transition per link;
  transitions that block interaction.
- **Detected via**: **not capturable from a single-page crawl** (needs cross-route navigation);
  `framer-motion`/`view-transition` presence is a weak proxy — **authored-only**.

### D2. Section / tab / accordion transition
- **What**: expand/collapse, tab-content swap, indicator slide.
- **Params**: height/opacity handling (animate max-height/opacity via transform where possible),
  **300–500ms**, indicator slide, icon rotation.
- **TASTE**: smooth expand/collapse with an overflow-safe technique; a sliding tab indicator
  (`imp/animate`).
- **SLOP**: **animating raw `height`/`padding`/`margin` — jank** (`slop-manifest`; use transform /
  clip / grid-rows trick); janky accordion.
- **Detected via**: `tailwindAnimate` (`animate-accordion-up/down` — 28 sites each; `animate-collapsible-*`,
  `animate-tab-to-left*`) **now**; layout-prop-jank check via `transitionProperty` containing
  `height`/`width`/`padding`/`margin` **now** (directly detectable).

### D3. State transition (show/hide, success/error, loading)
- **What**: smoothing instant state flips.
- **Params**: fade+slide **200–300ms**; success check-draw; error handling (see below).
- **TASTE**: fade + slide instead of instant pop (`imp/animate`); a gentle success scale-pulse.
- **SLOP**: **error "shake" using bounce/elastic** or animating layout; no feedback at all
  (jarring instant flips, an `imp/animate` "static area").
- **Detected via**: `transitionProperty`/`Duration` presence on the relevant elements **now** (partial).

## E. Cross-cutting

### E1. Easing token system
- **What**: the site's easing vocabulary.
- **Params**: enter curve, exit curve, spring config.
- **TASTE**: `--ease-out-quart: cubic-bezier(0.25,1,0.5,1)` / `--ease-out-quint:
  cubic-bezier(0.22,1,0.36,1)` / `--ease-out-expo: cubic-bezier(0.16,1,0.3,1)` for enters;
  springs `stiffness 100 / damping 20` (`imp/animate`, `tasteskill`). Exits ≈ 75% of enter.
- **SLOP**: **`linear`** on a discrete transition (mechanical), **bounce/elastic** (dated —
  `cubic-bezier(0.34,1.56,…)` / `(0.68,-0.6,…)`), CSS default `ease` everywhere by reflex.
- **Detected via**: `transitionTiming` distribution **now** — count `linear`, detect
  `cubic-bezier` with overshoot (`y > 1` or `y < 0` control points = bounce/elastic).

### E2. Duration discipline
- **What**: how long things take.
- **Params**: 100–150ms feedback · 200–300ms state · 300–500ms layout · 500–800ms entrance
  (`imp/animate`); exits ~75%.
- **TASTE**: durations inside the bands; feedback never > 500ms ("feels laggy", `imp/animate`).
- **SLOP**: **over-long durations** (>~800ms on UI feedback/transitions) that feel sluggish.
- **Detected via**: `transitionDuration` distribution **now** — flag the >0.5s / >0.8s tail.

### E3. Animation restraint / density
- **What**: how much of the page moves.
- **TASTE**: **one signature moment + a thin feedback layer** (`imp/animate`: "one well-orchestrated
  experience beats scattered animations"); **vary responses** so repeat use stays fresh (`imp/delight`);
  motion has a **one-sentence purpose** (`tasteskill`).
- **SLOP**: animate-everything fatigue; perpetual ambient loops (`animate-pulse`/`float`/`blob` as
  décor); `MOTION_INTENSITY` claimed high but nothing meaningfully moves (`tasteskill` "motion
  claimed, motion shown").
- **Detected via**: **animation saturation now** — count of `animationName ≠ none` elements per
  site (42% of corpus has ≥1; a high per-site fraction = over-animation) + `tailwindAnimate`
  breadth (many distinct `animate-*` = scattered motion).

### E4. `prefers-reduced-motion` (HARD, non-negotiable)
- **What**: the reduced-motion contract.
- **TASTE / REQUIRED**: every treatment collapses to static/instant under
  `@media (prefers-reduced-motion: reduce)`; **infinite loops, parallax, scroll-jack, magnetism
  must collapse entirely** (`tasteskill`, `imp/animate`, `imp/polish`, `slop-manifest`). Above
  `MOTION_INTENSITY > 3` it is mandatory (`tasteskill`) — the engine treats it as mandatory at all
  levels.
- **SLOP** *(HARD FAIL)*: any motion with **no reduced-motion fallback**.
- **Detected via**: **needs re-capture** (the `@media (prefers-reduced-motion)` rule is not
  observed today). Until then, this is an **authored guarantee** of every emitted MotionGenome, not
  a mined property — the engine always emits `respectsReducedMotion: true`.

---

# 2. Taste principles (distilled, to fold into `deriveMotion` + slop gates)

Each attributed. These are the rules the motion derivation and slop layer encode.

1. **Motion must have a purpose — one sentence.** Valid: hierarchy, storytelling, feedback, state
   transition. "It looked cool" / "GSAP everywhere because it's available is amateur work."
   — `tasteskill`, `imp/animate` ("animate without purpose" is on the NEVER list)
2. **Animate `transform` and `opacity` only.** Never `top/left/width/height/padding/margin` —
   animating layout props is jank. — `tasteskill`, `imp/animate`, `imp/polish`, `slop-manifest`
3. **Easing: ease-out for enters, never linear/bounce/elastic.** `ease-out-quart/quint/expo`
   (`cubic-bezier(0.16,1,0.3,1)`) or springs (stiffness 100 / damping 20); no linear on springs.
   Bounce/elastic are dated and draw attention to the animation itself. — `imp/animate`, `tasteskill`, `slop-manifest`
4. **Duration bands, exits faster than enters.** 100–150 feedback · 200–300 state · 300–500 layout
   · 500–800 entrance/scroll-reveal (ms); **exit ≈ 75% of enter**; feedback never > 500ms. — `imp/animate`, `tasteskill`
5. **Stagger 60–150ms.** `i*0.06` (`tasteskill`) to 100–150ms (`imp/animate`) for lists/reveals.
6. **Restraint: one signature moment + a thin feedback layer.** One well-orchestrated experience
   beats scattered motion; don't animate everything (fatigue). — `imp/animate`, `imp/delight`
7. **Vary responses.** Not the same animation every time; delight should stay fresh with repeated
   use. — `imp/delight`
8. **Delight is quick (< 1s) and skippable; never blocks core function.** If users notice the
   delight more than the goal, it's gone too far. — `imp/delight`
9. **Reveal effects are secondary polish — never gate core content on them.** Hero/headings/body
   must render without JS/scroll; an invisible standout is a failed standout. — `slop-manifest`
10. **No hand-rolled scroll drivers.** Ban `window.addEventListener('scroll')` and `scrollY`-in-React-
    state; scroll-pin/scrub only via an isolated ScrollTrigger leaf or `whileInView`. — `tasteskill`
11. **One marquee per page, max.** Two+ reads as lazy filler. — `tasteskill`
12. **Every interactive element gets all its states** (default/hover/focus/active/disabled/loading/
    error/success); focus rings visible and high-contrast, never removed without replacement.
    — `imp/polish`, `tasteskill`
13. **Hover is a high-intensity, desktop-only affordance.** Use hover motion only above intensity 5
    and only on genuinely interactive elements; press (`:active scale-0.98`) is the universal
    tactile primitive. — `tasteskill`, `imp/delight`
14. **60fps or it doesn't ship.** No jank; `will-change` sparingly; no layout shift (CLS). — `imp/polish`, `imp/animate`
15. **`prefers-reduced-motion` is a HARD rule.** Every treatment collapses to static; infinite loops/
    parallax/scroll-jack/magnetism collapse entirely. Non-negotiable, like contrast-AA. — all four sources
16. **The AI-slop test for motion.** If someone would instantly believe "an AI added this animation,"
    it's slop (scroll-jack, whole-page parallax, image-hover-scale, ambient pulse, neon glow-in).
    Aim for motion that feels inevitable, not decorative. — `slop-manifest`

---

# 3. Slop danger-zone list (gate or use-only-knowingly-in-context)

The specific motion treatments + parameter ranges the engine should **gate/avoid by default**, or
only emit with explicit in-context justification. Mirrors the background axis's S-table; each row
carries a detectability note (⛏ = minable now, 🔁 = needs re-capture, ⚠ = authored guarantee only).

| # | Danger zone | Gate condition | Detect | Source |
|---|---|---|---|---|
| M1 | **Scroll-jacking** (mandatory snap / heavy smooth-scroll / hand-rolled scroll driver hijacking the wheel) | `scroll-snap-type: … mandatory` full-page, or `window` scroll listener driving position | 🔁 (lib proxy ⛏) | `tasteskill` |
| M2 | **Whole-page / multi-layer parallax** | ≥2 parallax layers or large speed ratio as the site's whole identity | 🔁 (lib proxy ⛏) | `tasteskill`, `imp/animate` |
| M3 | **Autoplay video / motion** | `<video autoplay>` or perpetual ambient loop with no user control | 🔁 (video tag ⛏; autoplay attr 🔁) | `imp/delight`, `imp/polish` |
| M4 | **Linear easing on discrete transition** | `transitionTiming == linear` on a non-continuous property | ⛏ (`transitionTiming` distribution) | `imp/animate`, `imp/polish`, `slop-manifest` |
| M5 | **Bounce / elastic easing** | `cubic-bezier` with overshoot (control `y > 1` or `< 0`); spring w/ high stiffness+low damping | ⛏ (parse `transitionTiming`) | `slop-manifest`, `imp/animate`, `tasteskill` |
| M6 | **Over-long durations** | `transitionDuration` > ~0.5s on UI feedback / > ~0.8s on any transition | ⛏ (`transitionDuration` tail) | `imp/animate`, `tasteskill` |
| M7 | **Animating layout props (jank)** | `transitionProperty` / keyframe touches `width/height/top/left/padding/margin` | ⛏ (`transitionProperty` scan) | `slop-manifest`, `tasteskill`, all |
| M8 | **Motion ignoring `prefers-reduced-motion`** | any active motion with no reduced-motion fallback | ⚠ / 🔁 (authored guarantee; observe via re-capture) | all four (**HARD**) |
| M9 | **Core content gated on reveal** (`opacity:0` hero/heading/body until scroll) | in-viewport hero/heading `visibility.opacity == 0` (default-recipe capture) | ⛏ (default recipe) | `slop-manifest` (**HARD**) |
| M10 | **Image hover scale/rotate** | `transform`/`scale`/`rotate` transition on `img`/`figure` asset | ⛏ (transition-prop on assets) | `slop-manifest` |
| M11 | **Gratuitous cursor follower / magnetism** on ordinary pages | custom-cursor / magnetic markers on a non-creative pageKind | 🔁 (JS-driven) | `imp/delight`, `tasteskill` |
| M12 | **≥2 marquees on one page** | `tailwindAnimate` marquee-class count ≥ 2 (or multiple ticker regions) | ⛏ (`tailwindAnimate`) | `tasteskill` |
| M13 | **Animate-everything fatigue** | high per-site fraction of `animationName ≠ none` + broad `tailwindAnimate` set (ambient `pulse`/`float`/`blob` décor) | ⛏ (animation saturation) | `imp/animate`, `imp/delight` |
| M14 | **The standout that doesn't render** | signature component present only after JS/scroll (invisible at first paint) | ⛏ (opacity-gate overlap w/ M9) | `slop-manifest` (**HARD**) |
| M15 | **Removed focus ring** | `outline:none` with no visible high-contrast replacement | 🔁 | `imp/polish`, `tasteskill` (**HARD a11y**) |
| M16 | **Over-styled / neon custom scrollbar** | thick, high-contrast, untinted scrollbar as decoration | 🔁 | color rules + this doc |

**Danger-zone posture** (matching the background axis): **hard-fail** M8, M9, M14, M15 (accessibility
/ render-integrity — never emit, always guarantee the fallback); **gate to off-by-default** M1–M3,
M10–M12, M16 (emit only when the intent/pageKind explicitly motivates them); treat M4–M7, M13 as
**parameter clamps** (easing snapped to the ease-out token set; durations clamped to the bands;
animated properties restricted to transform/opacity; animation count capped). None but the a11y/render
rows are absolute bans — consistent with the repo's provenance policy: *"frequency is not quality; a
pattern becomes slop only when unmotivated, interchangeable, or harmful in context."*

---

# 4. The user's explicit asks as first-class treatments

Each of these was called out explicitly; each is in the taxonomy with concrete defaults so the
motion axis ships them deliberately, not by accident.

| Ask | Treatment | Concrete default | Detectable? |
|---|---|---|---|
| **Polished custom scrollbar** | **B3** | `scrollbar-width: thin` + `scrollbar-color` **tinted to the surface** (chroma ~0.01 toward brand hue, never pure gray), subtle hover; radius matches the family's `radiusLanguage`. | 🔁 re-capture |
| **Hero fits viewport / no spill past ~1vh** | **A6** | hero section `heightShare` clamped to **≈ 0.9–1.05 × viewport**; next section top near ~1.0vh; a small scroll affordance. Guard the inverse tell (single headline ≠ whole fold). | ⛏ **minable now** (geometry) |
| **Scroll-reveal with easing** | **B1** | fade + `translateY(≤24px)`, **enter 600–800ms**, `cubic-bezier(0.16,1,0.3,1)`, **stagger 60–120ms**, `once:true`, viewport amount 0.3, `transform`/`opacity` only, reduced-motion → instant. **Never gates core content.** | ⛏ partial (intent) + default-recipe opacity check |
| **Smooth-scroll** | **A1** | prefer **CSS `scroll-behavior: smooth`** for anchor jumps; if a lib, low lerp; **never** a `window` scroll listener / `scrollY`-in-state driver. | 🔁 (lib proxy ⛏) |
| **Scroll-snap** | **A2** | `scroll-snap-type: y **proximity**` (not `mandatory`) with per-section `scroll-snap-align: start`, on full-height sectioned narratives only; reduced-motion → no snap. | 🔁 re-capture |

---

# 5. How this maps to the existing engine

The engine **already has the plug-point shape** — the motion axis is a new sibling module that
mirrors `background.mjs` exactly; it does not invent a new subsystem.

### Where `deriveMotion` plugs in

- **Mirror `deriveBackground(family, iv, streamSeed) → BackgroundGenome`** (`apps/engine/background.mjs`).
  Add **`apps/engine/motion.mjs`** exporting **`deriveMotion(family, iv, streamSeed) → MotionGenome`**
  with the identical contract:
  - reads the same `iv` bag — **`energy` is the natural `MOTION_INTENSITY` driver** (map
    `energy`·10 → the 1–10 dial), with `craft` gating micro-interaction richness and `layoutVariance`
    setting the perturbation amplitude (`amp = 0.35 + 0.65·layoutVariance`, same formula
    `deriveBackground` and `composeGenome` use);
  - `streamSeed == null` → **stable authored defaults, zero RNG draws** (mirrors the background
    module's `authored-default` path); a number → run a `MOTION_PERTURB_V1` map then gate;
  - returns `{ …fields, slop: { score, matchedRules }, provenance: ["taxonomy-v1", seed?"perturbed":"authored-default"] }`,
    identical envelope to `BackgroundGenome`.
- **The surface half already partly exists.** `deriveMaterial` (`layout-families.mjs`) owns
  `radiusLanguage/shadowLanguage/borderLanguage/accentStrategy/surfaceTexture` — the *static*
  material. `deriveMotion` owns the **temporal** layer over the same `family.materialSlots`: each
  interactive slot (`row-hover-state`, `cta-band`, `accent-signal`, `selection-accent`, buttons)
  gets a micro-interaction spec (hover/press/focus), exactly as `deriveBackground` fills each slot
  with a §B treatment. `row-hover-state` is literally a motion slot already named in the layout
  families — the cleanest first target.
- **Gate** with a `checkMotionViolations(motion, family)` mirroring `checkBackgroundViolations` —
  the §3 M-table is the rule set, same independent-recheck pattern as `perturb.mjs`'s
  `validatePerturbed`. Reduced-motion (M8) and render-integrity (M9/M14) are **structural
  guarantees** the builder emits, not perturbable dials.

### The MotionGenome shape it emits (mirrors BackgroundGenome's field/band/slots/crossCutting)

```
MotionGenome = {
  defaults: {                      // E1/E2/E4 — the token system, always emitted
    enterEasing, exitEasing,       // from the ease-out-quart/quint/expo set (never linear/bounce)
    springConfig,                  // {stiffness:100, damping:20}
    durations: { feedback, state, layout, entrance },   // the four bands (ms)
    stagger,                       // 60–150ms
    respectsReducedMotion: true,   // HARD — always true, non-perturbable
    animateOnly: ["transform","opacity"],
  },
  scroll: {                        // A1–A5 — smoothScroll, snap, sticky/pin, parallax, marquee
    smooth, snap, sticky, parallax, marquee   // each {enabled, params} or null; off-by-default per gate
  },
  heroFit: { targetHeightShare, tolerance },   // A6 — grounded from geometry now
  reveal: { treatment, distance, duration, easing, stagger, once, gatesCoreContent:false },  // B1/B2
  scrollbar: { custom, width, thumbHue, trackHue },   // B3 — authored until re-capture
  micro: {                         // C1–C4 keyed by materialSlot / interactive role
    "<slot>": { hover, press, focus, toggle }
  },
  transitions: { page, section, state },       // D1–D3
  intensity,                       // resolved MOTION_INTENSITY (from energy)
  slop: { score, matchedRules },   // M-table
  provenance: ["taxonomy-v1", "authored-default" | "perturbed"],
}
```

### Which treatments are GROUNDED from captured data now vs authored-only

- **Grounded now (can be mined into archetypes + used to calibrate defaults and slop thresholds),**
  the same way layout families were mined from geometry clusters:
  - **easing vocabulary & the linear/bounce tells** — `transitionTiming` distribution (M4/M5, E1);
  - **duration discipline** — `transitionDuration` bands and the over-long tail (M6, E2);
  - **layout-prop-jank** — `transitionProperty` scan (M7, D2);
  - **animation saturation / animate-everything** — `animationName≠none` fraction + `tailwindAnimate`
    breadth (M13, E3);
  - **reveal / marquee / scroll intent** — `tailwindAnimate` classes + `animationLibs` (B1/B2/A5, M12);
  - **motion-library posture** — `animationLibs` (gsap/framer/lenis/locomotive/aos/swiper) as priors
    for scroll-jack/parallax risk (M1/M2 proxies);
  - **hero-fits-viewport** — geometry (`heightShare` vs viewport), **no motion re-capture needed** (A6);
  - **image-hover-scale** — transform-transition on `img`/`figure` (M10);
  - **core-content-gated-on-reveal** — `visibility.opacity==0` in-viewport hero in default-recipe captures (M9/M14).
- **Authored-only until a motion-aware re-capture** (§6): smooth-scroll (A1), scroll-snap (A2),
  sticky/pin config (A3), true parallax ratios (A4), custom scrollbar (B3), press/focus states
  (C2/C3), custom cursor/magnetism (C5), page/route transition (D1), autoplay attrs (M3), and the
  observed `prefers-reduced-motion` rule (M8). These are emitted from authored defaults + the taste
  principles, not mined — exactly as the background axis authors treatments it can't yet fully
  ground.

### Mining seed motion archetypes (like layout & background)

Cluster sites over **`transitionTiming` + `transitionDuration` distributions + `animationName`
saturation + `animationLibs` + `tailwindAnimate` breadth + hero `heightShare`**, human-inspect, and
author a seed set of **motion archetypes** — e.g. *"restrained-editorial"* (few transitions,
ease-out, no libs, no reveal), *"scroll-narrative"* (lenis + gsap + on-scroll reveals + one pin),
*"marketing-lively"* (framer whileInView reveals, one marquee, hover lifts), *"tool-quiet"* (state
transitions only, no ambient motion) — each carrying `provenance`, `whenToUse`/`notFor`,
`antiPatterns` (drawn from §3), and a taste-vs-slop note. Corpus frequency doubles as the slop-risk
prior (scroll-jack libs + linear easing + `animate-pulse` are common ⇒ gate).

---

# 6. Re-capture spec (motion-aware crawl upgrade)

What a small, additive upgrade to `crawl-features.ts` would add to make the currently authored-only
treatments **truly minable** (all additive to `ElementStyle` / `PageFingerprint`, same pattern the
background axis proposed for 4-side border widths):

1. **Per-element motion CSS** (extend `ElementStyle`, one extra `getComputedStyle` read each):
   `transform` (the computed matrix/none), `willChange`, `position` (to detect `sticky`),
   `scrollSnapAlign`, and on scroll containers `scrollSnapType`, `scrollBehavior`,
   `overscrollBehavior`, `scrollbarWidth`, `scrollbarColor`.
2. **Pseudo-element / pseudo-class capture** (new): `::-webkit-scrollbar*` styles (custom scrollbar,
   B3/M16); and, for a sample of interactive elements, computed style under `:hover`/`:active`/
   `:focus-visible` (drives C1/C2/C3 and the removed-focus-ring tell M15) — via forced pseudo-state
   evaluation or by reading matched CSS rules.
3. **`@media (prefers-reduced-motion: reduce)` presence** (new page fingerprint): does the site ship
   a reduced-motion block at all — the single most important observable for M8. Scan `document.styleSheets`
   for the media rule.
4. **Keyframe bodies** (new): map `animationName → keyframe steps` (from `document.styleSheets`
   `CSSKeyframesRule`) so we know **what** an animation moves (transform/opacity = fine; width/height =
   jank M7) and whether it loops infinitely (ambient décor M13) — today only the *name* is captured.
5. **Autoplay/loop attrs on media** (new asset field): `<video autoplay muted loop>` /
   `<audio autoplay>` (M3) — currently media is route-aborted, so at minimum capture the attributes
   from the DOM even without loading the stream.
6. **Scroll-sampled computed style** (new recipe, opt-in like `--rich-capture`): sample transform/
   opacity of tracked elements at **several scroll positions** during a short scripted scroll-through,
   diffing them to *observe* actual scroll-reveal (opacity 0→1), parallax (differential translate per
   layer, A4/M2), and pin/scrub behavior (sticky elements holding position, A3/M1) — the only way to
   ground parallax ratios and true scroll-jacking rather than inferring them from library presence.
   **Important:** run this **without** the IntersectionObserver stub (the stub forces reveals visible
   and destroys the 0→1 signal), unlike the current rich-capture recipe.

Items 1–4 are cheap (extra computed-style reads + one stylesheet walk) and unlock the bulk of the
🔁 rows in §3. Item 6 is the larger investment that turns parallax and scroll-jacking from
library-proxy inference into direct measurement.

---

## Source links

- local **`impeccable:animate`** skill (installed plugin `impeccable/1.3.0`, `skills/animate/SKILL.md`) — durations, easing tokens, exit-75%, stagger, transform+opacity, NEVER list, reduced-motion block
- local **`impeccable:polish`** skill (`skills/polish/SKILL.md`) — 150–300ms transitions, 8 interaction states, 60fps, focus rings, reduced-motion, 44px touch targets, no CLS
- local **`impeccable:delight`** skill (`skills/delight/SKILL.md`) — press/hover primitives, delight < 1s + skippable, vary responses, branded cursors
- **tasteskill.dev** (Leonxlnx/taste-skill) — `skills/taste-skill/SKILL.md` + `skills/soft-skill/SKILL.md`: transform/opacity-only, `cubic-bezier(0.16,1,0.3,1)`, spring 100/20, 300/700/800ms, stagger `i*0.06`, `MOTION_INTENSITY` dial, reduced-motion > 3, scroll-listener ban, ScrollTrigger pin, one-marquee, hover > 5, motion-with-purpose
- `skills/personality/reference/slop-manifest.md` — Motion section (bounce/elastic, layout-prop jank, image-hover-scale) + General-quality (core content invisible until scroll; the standout that doesn't render)
- sibling spec: `docs/background-material-taxonomy.md`
- crawl: `packages/crawl/src/crawl-features.ts` (`ElementStyle.transition*`/`animationName`, `PageFingerprint.animationLibs`/`tailwindAnimate`), `packages/crawl/src/derive-layout-data.ts`
- engine plug points: `apps/engine/background.mjs` (`deriveBackground`, `checkBackgroundViolations`), `apps/engine/layout-families.mjs` (`deriveMaterial`, `materialSlots`)
- data: `data/geometry-crawl-raw.v2.1.ndjson` (empirical scan, §"What our crawl actually contains")
</content>
</invoke>
