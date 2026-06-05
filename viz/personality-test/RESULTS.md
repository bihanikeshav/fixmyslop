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

## Visual confirmation (screenshots)

`control-full.png` and `treatment-full.png` (1440px, full-page). The render confirms
the verdict and adds nuance: the control is unmistakable second-gen slop (Playfair
italic on cream, gold accent, eyebrow chip, 01/02/03 steps). The treatment is clearly
more designed — the raw-transcript→green-extracted-output transformation is a real
load-bearing concept, with ruled paper, mono speaker labels, and a semantic green
accent. **But** it still sits in the same warm-serif-on-cream register and keeps a
three-stat hero-metric block — i.e. it improved on, but did not fully escape, the
second-gen default. Motivates the manifest hardening below (and a re-run to confirm
the hardened skill escapes the cream/serif register entirely).

## Round 2 — two more briefs, with the hardened skill

Briefs: a moon-phase sourdough bakery ("Hearth & Moon") and a deep-sea marine
biologist's portfolio ("Dr. Maya Okafor"). A/B each; treatments used the hardened
skill (with the second-gen-slop section). Screenshots: `*-control-full.png`,
`*-treatment-full.png`.

- **Both controls fell into second-gen slop again** — Cormorant Garamond italic on
  cream/parchment, eyebrow chip, rust/gold accent. The "artisan" / "tasteful science"
  reflex is robust and reproducible. (The bakery control's dark section also rendered
  empty — a bug.)
- **Both treatments escaped it decisively and invented a real signature concept:**
  - Bakery: near-black *crust* ground (cream inverted to foreground), Fraunces + DM
    Mono, mahogany Maillard accent, and **the Lunar Bake Wheel** — a JS-computed
    28-day moon-phase calendar (Meeus algorithm) mapping each loaf to its phase.
  - Portfolio: abyssal navy, Fraunces + Azeret Mono, accent = **470 nm** (the actual
    wavelength of deep-sea bioluminescence), and **the Descent Wire** — a depth
    indicator that turns scroll into a real metres-deep reading + ocean-zone name.
  - Both explicitly cited and avoided the second-gen-slop section — the hardening worked.

**Caveat (honest):** the portfolio treatment's lower sections rely on scroll-reveal
and came back blank in a static full-page capture (content left at `opacity:0` until
an IntersectionObserver fires). Distinctive heroes can over-lean on JS reveals;
content should degrade gracefully (visible without JS / on reduced-motion). A real
craft note for the skill, not just this build.

## Earned follow-up

Add an explicit **second-generation slop** callout to the slop manifest (tasteful
editorial: Playfair/serif + cream + gold + 01/02/03 numbered steps), since that's the
emergent default a strong model now reaches for — and even the skill-guided build
drifted toward it.
