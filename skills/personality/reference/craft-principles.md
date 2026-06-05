# Craft principles (visual)

Terse, skill-ready rules for the Build step. Apply these so a distinctive design
never becomes a broken one. Each section links its deep dive for the full reasoning
and citations.

## Visual hierarchy
- Establish ONE dominant element per screen region first; size everything else down from it.
- Differentiate levels with at least two dimensions (size + weight, or size + color) — never size alone.
- De-emphasize secondary text with lighter weight or muted color, not by shrinking below readable sizes.
- Design in grayscale first; add color last so hierarchy never leans on it.
- Limit to ~3 visual levels (and 3 type sizes) per section; bold no more than ~15–20% of body copy.
- One filled/solid CTA per region; demote second actions to outline/ghost/text.
- Use isolation (Von Restorff) for the single most critical control — dilutes if more than one element is "special."
- Run the squint test (`filter: blur(8px)` on a screenshot): the primary CTA must stay the most prominent shape.
→ deep dive: docs/design-research/visual-hierarchy.md

## Typography
- Constrain prose to ~45–75ch (`max-width: 65ch`); cap line length even on wide viewports.
- Set body `line-height: 1.5` floor; 1.6–1.7 for long measures or small text; never below 1.4 for reading text.
- Use a modular scale with one ratio (1.25 UI-dense / 1.333 content / 1.5 editorial), not ad-hoc sizes.
- Size type fluidly with `clamp(min, vw+rem, max)` — keep `rem` bounds so browser zoom still scales it (else fails WCAG 1.4.4). This is the single source for all fluid type/space.
- Letter-space all-caps/small-caps 0.05–0.12em; negative track hero headings >48px (−0.02em); never track lowercase body.
- Max two type families unless there's an explicit editorial reason; pair on shared structure (x-height, stress axis).
- Serve WOFF2 only; add `font-display: swap` and preload the critical weight; prefer variable fonts at 3+ weights.
- Don't ship default `line-height: normal` (~1.2) on body text, or `font-size` below 14px for body / 12px for any text.
→ deep dive: docs/design-research/typography.md

## Color
- Author the palette in OKLCH custom properties; build shade ramps by stepping `L` uniformly (perceptually even, not HSL).
- Three tiers: primitive ramps → semantic (intent) → component; change `--color-primary` once, cascade everywhere.
- Tint neutrals toward the brand hue (chroma ~0.02–0.06) — or commit to a pure-neutral ramp; pick one and hold it.
- Apply 60-30-10: ~60% neutral surface, ~30% secondary, ~10% high-chroma accent reserved for CTAs/key status.
- Never convey meaning by color alone — pair every status hue with icon, label, or pattern (~8% of men are color-blind).
- Use near-black/near-white (`oklch(0.10 …)` / `oklch(0.98 …)`), not pure `#000`/`#fff`, to avoid irradiation.
- Dark mode = elevation by lightness (base ~#121212, lighter surfaces step up), not inversion; drop accent chroma 20–30%.
→ deep dive: docs/design-research/color.md

## Layout, grids & spacing
- Pick a constrained 8pt spacing scale (4, 8, 16, 24, 32, 48, 64…) up front; reference tokens, never raw pixels.
- Start with too much whitespace, then remove; macro space sets perceived quality, micro space sets legibility.
- Set vertical margins/padding as multiples of the body line-height for consistent rhythm.
- Use CSS Grid for page structure, Flexbox for component internals; space with `gap`, not edge margins.
- Set `box-sizing: border-box` globally so spacing math stays predictable.
- Align to as few axes as possible; a single shared left edge reads intentional, slight offsets read as error.
- Balance asymmetry by weight, not mirror equality; break the grid at most once per section, deliberately and directionally.
- Match density to user context — don't default to low density "because it photographs well."
→ deep dive: docs/design-research/layout-grids-spacing.md

## Gestalt (grouping & perception)
- Group with whitespace before borders — tighten space inside a group, widen it between groups; equal spacing kills grouping.
- Place labels directly above/beside their input, never equidistant between two fields.
- Reserve one distinct color for the single primary action; don't reuse it for links, banners, and dividers (similarity pollution).
- Use a card (common region) only when grouping heterogeneous content; avoid "boxitis" and nested competing containers.
- Keep figure/ground unambiguous — blur/scrim/darken busy backgrounds and modal underlays so text stays the figure.
- Animate related elements together (common fate); reserve stagger for true sequences, not for items that should read as a unit.
- Keep grid alignment consistent so continuation lines don't fracture related content; re-cue sequences (numbers/lines) when rows stack on mobile.
→ deep dive: docs/design-research/gestalt.md

## Motion
- Animate only `transform` and `opacity` (GPU-composited); never animate width/height/top/left/margin/padding, `box-shadow`, or `transition: all`.
- Durations: 150–200ms small feedback, 250–400ms panels/modals, ≤500ms full-screen; shorten further for frequent interactions.
- Ease-out for entrances, ease-in for exits; avoid linear (except spinners) and bounce/elastic on functional UI.
- Every animation must answer where/what/status — if cutting it doesn't break comprehension, remove it.
- Stagger lists 20–50ms per item, completing under ~400ms total.
- Always provide `@media (prefers-reduced-motion: reduce)`: replace spatial motion with an opacity fade (this is the source rule for reduced motion).
- Reserve delight (confetti, celebratory draws) for rare, emotionally significant moments; never fake loading time.
→ deep dive: docs/design-research/motion-animation.md

## Accessibility (hard floor)
- Contrast: body text ≥4.5:1, large text (≥18pt/14pt bold) ≥3:1, non-text UI & focus indicators ≥3:1; don't round (4.47 fails).
- Touch/pointer targets ≥24×24px (WCAG 2.5.8); aim 44×44px with ≥8px separation for primary actions.
- Use semantic HTML first (`<button>`, `<nav>`, `<h1>`–`<h6>`, `<label>`); one `<h1>`, no skipped heading levels.
- Keep a visible focus indicator — never `outline: none` without a ≥3:1, ≥2px replacement.
- Make all functionality keyboard-operable (test mouse-unplugged); trap focus in modals and return it on close.
- Associate every input with a real `<label>`; placeholders are not labels. Identify errors in text, not color alone.
- Size type in `rem`/`em` so 200% zoom works; reflow to a 320px viewport with no two-directional scrolling or lost content.
- Set `lang` on `<html>`; write meaningful `alt` (empty `alt=""` for decorative); no flashing >3×/sec; "No ARIA is better than bad ARIA."
→ deep dive: docs/design-research/accessibility.md

## Responsive & mobile-first
- Author base styles for the narrowest viewport; add with `min-width` queries, never strip with `max-width` overrides.
- Place breakpoints where the content breaks, not at device widths (no `$iphone`/`$ipad` magic numbers).
- Express widths in `%`/`fr`/`minmax()`; reserve `px` for borders and outline offsets.
- Prefer intrinsic layout: `grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr))` reflows with no media queries.
- Use `@container` (with `container-type: inline-size`) for reusable components; keep `@media` for page-level layout and user prefs.
- Ship responsive images: `srcset`+`sizes`, `<picture>` for art direction, WebP/AVIF, `loading="lazy"` on below-fold (never the LCP image).
- Adapt functionality for small screens — never `display: none` away nav/features/content; treat LCP >2.5s as failure.
→ deep dive: docs/design-research/responsive-mobile-first.md

## Design systems & tokens
- Define primitive tokens as an exhaustive palette first, before any component CSS.
- Add a semantic (intent) tier; components reference semantic tokens only, never primitives or hardcoded values.
- Implement tokens as CSS custom properties on `:root`; alias semantic to primitive (`--color-action-primary: var(--blue-500)`).
- Name tokens by purpose, not value (`--color-feedback-error`, not `--color-red-600`); namespace by system prefix.
- Treat theming (light/dark/brand/high-contrast) as swapping semantic token VALUES — names stay identical, zero component changes.
- Encode every interactive state in the component API: default, hover, focus-visible, active, disabled, loading, error.
- Keep variant sets minimal — require a real reuse case before adding one; "start local, promote carefully."
- Skip the full system for throwaway prototypes; a token file plus a few utilities is enough until inconsistency hurts.
→ deep dive: docs/design-research/design-systems-tokens.md
