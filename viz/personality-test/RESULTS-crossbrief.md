# Cross-brief test — 5 DIFFERENT subjects through the bias-fixed skill

The right test for real usage (each task is a different brief). Subjects chosen to
probe the two biases: hot sauce + toddler music (does color go bold, not earthy?),
jazz club (dark-trap + non-numeric), poetry magazine (no number — avoid a forced
calculator?), climbing gym (spatial). Files: `cb-*.html` / `cb-*-full.png`.

## The two target biases — fixed
- **Color: bold + varied.** Acid chartreuse `#CBFF00` (hot sauce), vivid green `#00C840`
  (climbing), bright vermillions (jazz/poetry/kids). Distinct accent hues 3 (was ~1 all
  oxblood in the same-brief test). The muted-earthy convergence is gone; saturation is back.
- **Standout: varied + expressive.** Body heat-map (diagram), parachute simulation,
  translation before/after split, date-seeded board (feed), grade-distribution ring.
  **range-slider 0/5, calculator 0/5** (was 3/5). **italic-accent 1/5** (was 4–5/5).
  The numeric-widget + italic clichés are gone.
- **Layout/boldness:** poster, editorial multi-column, single-object ×3 — bold, loud,
  visually distinct. They look like 5 different sites, not one template.

## Residual issues (honest)
- **Slop floor 3/5**, both fails a saturated BLUE in a multi-color categorical set:
  - `cb-kidsmusic` used the exact Tailwind `#2563eb` as a parachute panel — a real miss
    (grab-the-default when a *set* of colors is needed).
  - `cb-climbing` used a blue V8–9 grade tape — defensible (climbing grades use blue),
    one of six categorical colors, not the hero accent (accent is green). Checker flags
    any saturated blue; intent of the gate (no blue as hero/CTA) is not violated.
  → Fixed in skill text: `slop-colors.md` now says categorical palettes must avoid the
    exact slop defaults on every swatch.
- **Font character clusters on condensed display** (Big Shoulders ×3) — "bold type move"
  → everyone reaches for condensed. Noted in `slop-manifest.md` (bold ≠ only-condensed).

## Verdict
The two systematic biases the same-brief test exposed are resolved across genuinely
different briefs: bold/varied color and varied/expressive standouts, no slider / calc /
italic / earthy defaults. Remaining nits are narrow (categorical-blue defaults; a
condensed-font lean) and now addressed in skill text. Net: a different, bold, grounded
page per subject — the real-usage goal.
