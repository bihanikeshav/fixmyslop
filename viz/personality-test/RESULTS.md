# A/B test — does the /personality skill work?

**Case:** B2B AI SaaS landing page for "Cadence" (an AI meeting notetaker) — the most
slop-prone brief. Same brief, same model (Sonnet), one variable: the skill.
- `control.html` — built from the brief alone, no skill.
- `treatment.html` — built by reading `skills/personality/SKILL.md` and following its
  process + references (ultrathink ideation).

Judged by an independent agent against `reference/slop-manifest.md` + the AI-slop test.

## Result: the skill made a real, measurable difference

| | Control | Treatment |
|---|---|---|
| Slop tells | ~8 (template-like) | ~3–4 (mostly mitigated by concept) |
| Fonts | Playfair Display (AVOID-list 0.64) + DM Sans + cream | Sentient + Cabinet Grotesk + Azeret Mono (all fresh, zero avoid-list) |
| Signature | product-mockup hero (generic) | the page *is* a Cadence notes artifact: ruled paper at line-height + raw-transcript→extracted-output transformation |
| Accessibility | no `:focus-visible`; mobile nav vanishes | `:focus-visible`, token scale, reduced-motion |
| "AI made this?" | instantly yes | borderline no |

## Key insight

Neither build produced the *textbook* indigo-gradient-Inter slop — a strong model
avoids that unprompted now. The control instead fell into **second-generation slop:
Playfair italic serif on cream + gold ink + eyebrow chip + 01/02/03 steps** (the
"tasteful AI" default, itself a cliché). The skill's value is catching the *current*
defaults, not last year's.

## Honest gaps

The treatment still drifted faintly toward the new default — cream surface, an
italic-serif accent, and a three-stat hero-metric block (a named tell) — plus a
low-contrast faint-text miss and dropped mobile nav. A clear win, not a clean sweep.

## Earned follow-up

Add an explicit **second-generation slop** callout to the slop manifest (tasteful
editorial: Playfair/serif + cream + gold + 01/02/03 numbered steps), since that's the
emergent default a strong model now reaches for — and even the skill-guided build
drifted toward it.
