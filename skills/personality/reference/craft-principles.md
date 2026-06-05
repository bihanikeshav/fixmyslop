# Craft principles

Distilled from practitioner sources (see Sources). These keep a distinctive design
from becoming a broken one. Apply in step 5 (Build).

## Hierarchy
- Establish hierarchy with weight, size, and color together — not size alone. [Refactoring UI]
- Design in grayscale first; add color last so hierarchy never leans on it. [Refactoring UI]
- De-emphasize secondary text with lighter weight and softer color, not just smaller size. [Refactoring UI]

## Spacing & rhythm
- Start with too much whitespace, then remove. [Refactoring UI]
- Use a constrained spacing scale, not arbitrary one-off values. [Refactoring UI]
- Vary spacing to group related things; equal spacing everywhere reads flat. [Refactoring UI]
- Tighten space inside a group and widen it between groups — proximity signals relationship. [Refactoring UI]

## Type
- Use a modular type scale with a consistent ratio (1.25 / 1.333 / 1.5), not ad-hoc sizes. [Smashing Magazine]
- Size type fluidly with clamp() mixing rem + vw so browser zoom still scales it. [Smashing Magazine]
- Keep the measure ~45–75 characters; ~66 is the classic ideal. [Bringhurst]
- Cap line length around 90 characters even on wide viewports. [Practical Typography]
- Set body line-height to at least 1.5 (≈1.5–1.7 reads best). [WCAG]

## Color
- Tint neutrals toward the brand hue instead of using pure, lifeless gray. [Refactoring UI]
- Build a full set of shades up front (~5–10 per hue) rather than lightening on the fly. [Refactoring UI]
- Tinting is a deliberate choice — Geist commits to a pure-neutral ramp; pick one and hold it. [Vercel Geist]
- Meet WCAG AA contrast: 4.5:1 for body text, 3:1 for large text. [WCAG]

## Motion
- Motion should convey a state change, not decorate. [Linear]
- Use exponential ease-out (quart / quint / expo); avoid bounce or elastic on UI. [frontend-design]
- Animate transform and opacity, not layout props (width/height/margin), to stay smooth. [frontend-design]
- Respect prefers-reduced-motion and keep ambient motion low-contrast. [frontend-design]

## Restraint
- Ration the accent color to one primary action per screen; keep the rest neutral. [Linear]
- Don't compete for attention you haven't earned — dim the chrome so content leads. [Linear]
- Match implementation complexity to the aesthetic; minimalism needs precision. [frontend-design]
- Look expensive by removing elements, not adding them. [Vercel Geist]

## Sources
- Refactoring UI (Adam Wathan & Steve Schoger) — https://www.refactoringui.com/
- Linear — https://linear.app/now/behind-the-latest-design-refresh
- Vercel Geist — https://vercel.com/geist/colors
- Smashing Magazine, "Modern Fluid Typography Using CSS Clamp" — https://www.smashingmagazine.com/2022/01/modern-fluid-typography-css-clamp/
- Practical Typography (Matthew Butterick) — https://practicaltypography.com/line-length.html
- Bringhurst, *The Elements of Typographic Style* — book; measure 45–75 / 66 ideal (cited by name, no canonical free URL)
- WCAG 2.1 (W3C) — https://www.w3.org/TR/WCAG21/ (line spacing 1.4.8/1.4.12; contrast 1.4.3)
- frontend-design — companion Anthropic/impeccable frontend-design skill (no public URL; cited by name)
