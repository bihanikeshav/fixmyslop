---
name: personality
description: Give a web page real, page-specific personality. Use when building a site/page/component and you want output that is distinctly itself, not generic AI aesthetics. Forces an ideation phase that invents ONE functional, subject-grounded standout component inside hard anti-slop gates.
license: Apache-2.0. Slop taxonomy adapted from impeccable.style and Anthropic's frontend-design skill; see reference/slop-manifest.md for attribution.
---

This skill makes you *design*, not decorate. The failure mode it fixes: fed the
right fonts and colors, a model still ships something that "feels off" — correct
but characterless, or "distinctive" only as a mood it can rationalize. Character is
not a vibe and not a color palette. It is **one specific thing the page does that no
other page would.** This skill forces that, behind gates you may not argue your way
around.

> **Spend thinking budget here.** Before coding, raise effort or use `ultrathink`.
> Temperature is not the lever; deliberate ideation is.

## Step 0 — Mandatory reads (do this first, every time, in full)

You MUST read these four before you design. They are not "consult if relevant" —
they are the rules of the game. Skipping them is how slop ships.
- `reference/slop-manifest.md` — the anti-pattern taxonomy (what to never do).
- `reference/slop-colors.md` — the banned palette + the dark-is-a-trap rule. Hard gate.
- `reference/hero-artifacts.md` — what a real standout component is, and the bar it must clear.
- `reference/tensions.md` — the tie-breaker when rules seem to conflict.

Then read on demand from the Reference map (bottom) for the task at hand.

## The Process (do this before any code)

1. **Absorb.** What is this page *about*? Who is it for? List 8–12 concrete nouns,
   metaphors, materials, rituals, data, or mechanics from the subject's actual world.
   Hunt specifically for the subject's **core data or mechanic** — the thing that
   *changes* or *can be computed* (moon phase → loaf; ocean depth → reading; tempo →
   beat; tides → schedule). That mechanic is usually your standout.
2. **Diverge.** Brainstorm ~15 candidate concepts, each tying ONE noun/mechanic to a
   specific UI moment. Go wide and cheap. Do not stop at 3. (`reference/personality-moves.md`
   and `reference/hero-artifacts.md` are menus to riff on.)
3. **Commit to ONE hero artifact.** Critique the 15 and pick the single **functional,
   subject-grounded standout component** the whole page will be remembered for. It
   must clear the bar below. Write its name down. Pick 1–2 supporting moves that
   reinforce it — never competing standouts.
4. **Constrain.** Name the specific defaults you are forbidding on this build (fonts,
   the slop palette, gradient text, pill CTAs, centered hero, dark+glow). If the
   subject tempts a slop default (a "dark" subject → dark+neon), say so and refuse it.
5. **Build.** Write production code. Choose type/color from `reference/type-and-color.md`
   and obey `reference/slop-colors.md`. Pull in craft/ux references as needed.
6. **Self-check (gate).** Run the checklist below before you call it done. If any
   answer is weak, you are not done.

## The hero-artifact requirement (non-negotiable)

**Every page ships exactly ONE nameable, functional standout component grounded in the
subject.** No page is done without it. The bar — it must be ALL of:
- **Nameable** — you can say what it is in three words ("the Lunar Bake Wheel").
- **Functional / interactive** — it computes, responds to input/scroll/time, reveals
  real information, or simulates. Not a static illustration, not a styling treatment.
- **Grounded** — built from the subject's real data or mechanic, not borrowed.
- **Renders on load & degrades without JS** — see the render gate. An invisible
  standout is a failed standout.
- **Unique** — it could not be lifted onto any other company's site unchanged.

What does **NOT** count (these are the rationalizations to reject): a color palette;
a font pairing; "the page *feels* like a notebook"; a hero product screenshot; a
generic scroll-reveal or fade-in; a mood ("calm and editorial"); or any choice whose
only defense is a clever story. **If your only argument for the standout is a
justification, it's not a standout — it's slop with a narrative.**

## Hard gates (objective — not subject to your judgment)

- **Color gate.** Use nothing from the banned palette in `reference/slop-colors.md`
  (indigo/violet "AI startup" hues, electric cyan/teal glow, indigo→cyan gradients,
  near-black + neon glow, reflexive fintech-blue, cream+gold "tasteful" pairing).
  **Darkness is a trap, not a license:** a subject that suggests dark (deep sea,
  space, night, AI, security) is exactly when dark+glow slop sneaks in. Derive the
  accent from the subject's real material; one accent, used sparingly.
- **Render gate.** Core content (the hero artifact, headings, copy) must be visible
  on load and without JavaScript. Never gate primary content behind `opacity:0`
  until-scroll or an IntersectionObserver. Reveal-on-scroll is for secondary polish
  only, and must respect `prefers-reduced-motion`.
- **Type gate.** Not on the avoid-list, and not the over-used "tasteful" darlings
  (Playfair, Cormorant, Fraunces, Instrument Serif, Clash Display, General Sans,
  Space Grotesk) reached for by reflex. See `reference/type-and-color.md`.

## The final self-check (answer all before you ship)

1. **Name the standout.** What is it, in three words? _(no answer → not done)_
2. **Is it functional?** What does it compute / respond to / reveal? _(a styling
   choice or mood → fail)_
3. **Does it render on load, without JS?** _(blank-until-scroll → fail)_
4. **Grounded, not rationalized?** Is it from the subject's real data/mechanic, or a
   story defending a generic choice? _(story → fail)_
5. **Any slop color?** Grep your own hexes against `reference/slop-colors.md`. Dark +
   glow anywhere? _(yes → fail)_
6. **Could it belong to any other site?** _(yes → not distinctive enough → fail)_
7. **The AI-slop test:** if I said "an AI made this," would they instantly believe
   me? _(yes → fail)_

## Personality ≠ slop

The slop manifest flags "amateurish hand-drawn SVG." Your crafted, load-bearing SVG
component is also hand-drawn SVG. The difference is **specificity + craft +
load-bearing function**, not the technique. The trap is the inverse, too: a *mood*
dressed in a subject story ("dark because deep sea") is slop wearing a costume. The
test is always the artifact, never the explanation.

## Reference map

Mandatory reads are in Step 0. Read the rest on demand for the current step.

| When you're… | Read |
|---|---|
| **Always, before building (Step 0)** | `slop-manifest.md` · `slop-colors.md` · `hero-artifacts.md` · `tensions.md` |
| Inventing the standout & supporting moves | `reference/hero-artifacts.md` (functional archetypes) · `reference/personality-moves.md` (moves + Voice & delight) |
| Wanting a proven distinctiveness move | `reference/distinctiveness.md` (steal the method, not the tokens) |
| Choosing fonts & color | `reference/type-and-color.md` (avoid-list + fresh sets) + `reference/slop-colors.md` |
| Composing visuals — hierarchy, type, layout, spacing, gestalt, motion, a11y, responsive, tokens | `reference/craft-principles.md` |
| Designing behavior — affordances, UX laws, cognitive load, IA/nav, forms, onboarding | `reference/ux-principles.md` |
| Going deeper on any topic | `docs/design-research/<topic>.md` (full cited essays; index at `docs/design-research/README.md`) |
