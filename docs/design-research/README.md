# Design research library

A staging library of deep, **cited** reference essays on UX & design principles —
raw material to later distill into the `/personality` skill (`skills/personality/`).
Each file follows the same shape: *why it matters → core principles (cited) → how to
apply (web UI) → anti-patterns → sources*. Sources are real and verified where a
canonical URL exists; books/papers without a free URL are cited by name.

These are **not** loaded by the skill yet. The plan: harvest the "how to apply" and
"anti-patterns" lines into the skill's `reference/craft-principles.md` and
`reference/slop-manifest.md`, keeping the skill tight and pushing depth here.

## Foundations
- [visual-hierarchy.md](visual-hierarchy.md) — order, focal flow, scanning patterns (F/Z/layer-cake), the squint test, Von Restorff.
- [typography.md](typography.md) — classification, pairing, modular scale, measure, leading, web-font loading, variable/fluid type.
- [color.md](color.md) — RGB/HSL vs perceptual OKLCH/LCH, palette building, 60-30-10, harmony, WCAG contrast, dark mode.
- [layout-grids-spacing.md](layout-grids-spacing.md) — grids, the 8-point system, spatial rhythm, alignment, white space, breaking the grid.
- [gestalt.md](gestalt.md) — proximity, similarity, closure, continuity, figure/ground, common region/fate, Prägnanz → UI.
- [motion-animation.md](motion-animation.md) — purpose, easing, duration (Doherty), choreography, Disney 12, performance, reduced motion.

## Interaction & cognition
- [affordances-signifiers.md](affordances-signifiers.md) — Norman: affordances, signifiers, feedback, mapping, constraints, the two gulfs.
- [ux-laws.md](ux-laws.md) — Hick, Fitts, Miller, Jakob, Tesler, Doherty, peak-end, serial position… + Nielsen's 10 heuristics.
- [cognitive-load.md](cognitive-load.md) — Sweller's load types, working memory (7±2 / ~4), chunking, recognition>recall, choice overload.
- [information-architecture.md](information-architecture.md) — organization/labeling/navigation systems, information scent, card sorting, findability.

## Building blocks
- [forms-input.md](forms-input.md) — labels above fields, validation timing, error copy, input types, minimizing fields.
- [accessibility.md](accessibility.md) — WCAG POUR, contrast/target-size numbers, semantic HTML, focus, ARIA, inclusive design.
- [design-systems-tokens.md](design-systems-tokens.md) — atomic design, token tiers (primitive→semantic→component), theming, CSS variables.
- [responsive-mobile-first.md](responsive-mobile-first.md) — fluid grids, mobile-first, container queries, clamp(), touch targets, responsive images.

## Voice, feeling & ethics
- [ux-writing-microcopy.md](ux-writing-microcopy.md) — voice vs tone, clarity, button & error copy, empty-state copy, anti-buzzword.
- [emotional-design-delight.md](emotional-design-delight.md) — Norman's three levels, design hierarchy of needs, deep vs surface delight, signature moments.
- [onboarding-empty-states.md](onboarding-empty-states.md) — time-to-value, progressive over front-loaded, empty-state anatomy, contextual guidance.
- [dark-patterns.md](dark-patterns.md) — the deceptive-pattern taxonomy to AVOID, persuasion vs manipulation, ethical defaults.

## Distinctiveness playbook
- [distinctiveness/](distinctiveness/README.md) — how ~115 genuinely distinctive sites (15 categories: tech, consumer, creative, indie) make themselves unmistakable, reverse-engineered into transferable techniques. The positive mirror of the slop manifest. Each exemplar separates the *transferable technique* from the *literal token you must never copy*.

## Skill hard-gates (objective, un-rationalizable)
- [hero-artifacts.md](hero-artifacts.md) — the ONE functional, subject-grounded standout every page must ship; the 5-test bar, 12 archetypes, the find-it method, and the **swap test** (swapping the subject should break the artifact).
- [slop-colors.md](slop-colors.md) — the banned palette with objective hue/lightness/chroma gates (indigo-violet, cyan-on-dark, the AI gradient, dark+neon, fintech-blue, cream+gold), the dark-is-a-trap rule, and how to derive a non-slop accent from the subject's real material.
- [hero-artifacts.md](hero-artifacts.md) · [composition-and-boldness.md](composition-and-boldness.md) · [motion-animation.md](motion-animation.md) — the standout bar, layout/type/boldness + variety engine, and purposeful render-safe motion.
- [components-and-ui-patterns.md](components-and-ui-patterns.md) — use premade icons/components (never hand-drawn illustrative SVG); when custom SVG is allowed (data-driven instruments only); accessible component patterns; de-slopping a CSS framework; 11 layout patterns; the WCAG contrast recipe + dark-ground pitfall.

## Provenance
Each essay was produced by a focused web-research pass (primary sources preferred:
Nielsen Norman Group, Refactoring UI, Practical Typography, W3C/WCAG + WebAIM,
Material/HIG, Laws of UX, Baymard, GOV.UK, Norman/jnd.org, Brad Frost, Brignull's
deceptive.design, and named books/papers). Uncertain or paywalled claims are flagged
in each file's Sources section.
