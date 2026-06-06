# Polish — the finishing pass that separates "good" from "shipped"

Read at the Polish & motion pass. The concept can be bold and the standout unique, and
the page can still feel unfinished. Polish is the craft layer underneath the idea. Go
through this after the build; fix every miss.

## Spacing & rhythm
- One spacing scale (e.g. 4/8/12/16/24/32/48/64/96) — every margin/padding/gap from it,
  nothing arbitrary (no `margin: 13px`).
- Vertical rhythm: related things close, unrelated things far (proximity does the grouping).
  Generous, *consistent* section spacing; don't let sections run together or float adrift.
- Whitespace is structural, not leftover. The "expensive" look comes from removing, not adding.

## Alignment
- Align to as few axes as possible; one shared left edge reads intentional, stray offsets
  read as bugs. Optical alignment over mathematical (punctuation/icons may need a nudge).
- Everything sits on the grid until it deliberately breaks it (and the break is obvious-on-purpose).

## Type micro-craft
- Measure 45–75ch for body; line-height 1.5–1.7 body, tighter (0.9–1.1) for display.
- `text-wrap: balance` on headings, `text-wrap: pretty` on body; no widows/orphans on the hero.
- `font-variation-settings`/optical size if the face has it; `font-feature-settings` for
  ligatures; **`tabular-nums` (`font-variant-numeric`) for any aligned/columned numbers**.
- Tracking: a touch positive on all-caps/small labels, slightly negative on large display.
- One scale with real contrast between levels (≤3 sizes per region); the squint test passes.

## Color & finish
- Tinted neutrals (never pure #000/#fff); shadows tinted toward the surface, not flat gray.
- One committed accent, rationed; states derived from it. Consistent border weight + radius
  across the page (don't mix 4px and 24px radii at random).
- Contrast AA everywhere (4.5:1 text, 3:1 large/UI) — verify, don't eyeball.

## Interactive states (the most common polish miss)
- Every interactive element has **hover, `:focus-visible`, and active** states — and a
  visible focus ring (never `outline:none` without a replacement). `cursor:pointer` on
  clickable non-links. Disabled states say why.
- Links/buttons transition smoothly (see motion.md); targets ≥24–44px.

## Detail finish
- Selection color set to the accent; custom scrollbar only if on-concept; `<title>` + meta.
- Real content, not lorem; no placeholder/broken images; no console errors.
- Responsive: check ~390px and ~1440px — nothing overflows, mobile nav works, type fluid via `clamp()`.
- Empty/error/loading states designed with the same care as the happy path (peak-end).

## The polish test
Zoom out (the squint test): is there one clear focal point and an obvious order? Zoom in:
do edges align, do numbers line up, does every control respond? If a detail looks
accidental, it is — fix it.

→ deep dives: docs/design-research/{visual-hierarchy,typography,layout-grids-spacing,color,accessibility}.md
