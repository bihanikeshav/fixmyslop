---
name: personality
description: Give a web page real, page-specific personality. Use when building a site/page/component and you want output that is distinctly itself, not generic AI aesthetics. Forces an ideation phase that invents a signature element grounded in the page's subject, inside anti-slop constraints.
license: Apache-2.0. Slop taxonomy adapted from impeccable.style and Anthropic's frontend-design skill; see reference/slop-manifest.md for attribution.
---

This skill makes you *design*, not decorate. The failure mode it fixes: fed the
right fonts and colors, a model still ships something that "feels off" — correct
but characterless. Character does not come from turning up randomness. It comes
from a process. Follow it.

> **Spend thinking budget here.** Before coding, raise effort or use `ultrathink`.
> Temperature is not the lever; deliberate ideation is.

## The Process (do this before any code)

1. **Absorb.** What is this page *about*? Who is it for? List 8–12 concrete nouns,
   metaphors, materials, rituals, or in-jokes from the subject's actual world.
   (A cat-lover's portfolio → cats, naps, yarn, 3am, whiskers, a light switch.)
2. **Diverge.** Brainstorm ~15 candidate "personality concepts," each tying ONE
   noun/metaphor from step 1 to a specific UI moment. Go wide and cheap. Do not
   stop at 3. (See `reference/personality-moves.md` for *types* of moves to riff on.)
3. **Ground & commit.** Critique the 15. Pick ONE cohesive direction with 2–3
   signature elements that reinforce each other. Write down the single thing a
   visitor will remember.
4. **Constrain.** Re-read `reference/slop-manifest.md` and name the specific
   defaults you are forbidding yourself on this build (e.g. "no gradient text, no
   pill CTA, no centered hero, not Inter").
5. **Build.** Now write production code, executing `reference/craft-principles.md`
   and choosing type/color from `reference/type-and-color.md`.

## Personality ≠ slop

The slop manifest flags "amateurish hand-drawn SVG" and "image hover transform."
Your cat animation and dashed pointer line are also hand-drawn SVG. The difference
is **specificity + craft + load-bearing intent**, not the technique. A generic
doodle is slop; a doodle that *is the concept of the page* is personality. Craft
the move; make it earn its place; never default to it.

## The AI-slop test

When you think you're done: *"If I showed this to someone and said an AI made this,
would they instantly believe me?"* If yes, that's the problem. A distinctive
interface makes people ask "how was this made?", not "which AI made this?"

## References
- `reference/personality-moves.md` — types of signature moves to instantiate.
- `reference/slop-manifest.md` — the anti-patterns (your constraints) + the data behind them.
- `reference/craft-principles.md` — spacing, hierarchy, contrast, motion so distinctive ≠ broken.
- `reference/type-and-color.md` — fonts/palettes: what to avoid, what to pick from (rotate; never default).
