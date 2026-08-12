---
name: personality
description: Give a web page real, page-specific personality. Use when building a site/page/component and you want output that is distinctly itself, not generic AI aesthetics. Forces ideation that invents ONE bold, subject-grounded standout — with a different layout, type treatment, and standout every time.
license: Apache-2.0. Slop taxonomy adapted from impeccable.style and Anthropic's frontend-design skill; see reference/slop-manifest.md for attribution.
---

This skill makes you *design*, not decorate. There are two failure modes it fixes,
and you must beat BOTH:
1. **Slop** — generic AI aesthetics (indigo, gradients, glassmorphism, Inter).
2. **Timid sameness** — the safe "tasteful anti-slop" template every model now
   converges to: light warm ground, a neutral grotesque, one italic-serif accent
   word, a bordered widget card, mono labels, left-aligned. Passing the slop gates is
   not enough if the result is interchangeable with the last thing you built.

Character = **one specific bold thing this page does that no other page would**,
executed with a layout, type, and palette you would not have reached for by reflex.

> **Spend thinking budget here.** Before coding, raise effort or use `ultrathink`.
> Temperature is not the lever; deliberate ideation + deliberate divergence are.

## Step 0 — Mandatory reads (do this first, every time, in full)
Not "consult if relevant" — the rules of the game. Skipping them is how slop and
sameness ship.
- `reference/slop-manifest.md` — the anti-pattern taxonomy.
- `reference/slop-colors.md` — banned palette + dark-is-a-trap. Hard gate.
- `reference/hero-artifacts.md` — what a real standout is, and its bar.
- `reference/composition-and-boldness.md` — layout archetypes, bold type moves, the
  boldness dial, and the forbid-the-median variety engine.
- `reference/components-and-assets.md` — use premade components/icons, never hand-drawn
  illustrative SVG; accessible component + layout patterns; contrast pairing. Hard gate.
- `reference/tensions.md` — the tie-breaker when rules seem to conflict.

## The Process (before any code)
1. **Absorb.** What is this about? Who for? List 8–12 concrete nouns, materials,
   rituals, data, mechanics from the subject's real world. Hunt for the **core data
   or mechanic** (the thing that changes / can be computed).
2. **Diverge.** ~15 candidate concepts tying ONE noun/mechanic to a UI moment. Wide
   and cheap. Don't stop at 3.
3. **Forbid the median (do not skip).** Write down THE single most predictable
   solution for this brief — the safe font (a neutral grotesque / the italic-serif
   accent), the safe layout (headline-left + card-right split), the safe standout (a
   slider that outputs a number), the safe palette (light warm ground + one earthy
   accent). **Now forbid all of it for this build.** This is what makes each build
   different from the last; the gates raise the floor, this raises the ceiling.
4. **Commit — to an aesthetic direction, a standout, a layout, and a type stance.** Pick:
   - ONE **extreme aesthetic tone** and execute it fully (brutalist / maximalist /
     editorial / retro-futurist / art-deco / industrial / luxury / soft / playful…) —
     intentionality > intensity; match code complexity to the vision. The gates are a
     FLOOR, not a license to be timid. See **Aesthetic direction** in `composition-and-boldness.md`.
   - ONE **standout** (the bar in `hero-artifacts.md`): bold, subject-grounded,
     unique. Often functional, but it may also be a bold visual / typographic /
     spatial statement — never decoration, never a story defending a generic choice.
     **Vary the archetype** (don't default to a calculator/slider).
   - ONE **layout archetype** from `composition-and-boldness.md` that is NOT the
     split-hero+card default.
   - ONE **bold type move** from `composition-and-boldness.md` that is NOT "one
     italic-serif accent word" (retired — overused).
5. **Constrain.** Name the slop defaults you forbid (palette, gradient text, pill
   CTAs, dark+glow) plus the median from step 3.
6. **Build.** Type/color from `reference/type-and-color.md`, obeying `slop-colors.md`.
   Choose a **characterful** display face — not a default grotesque. Build the UI from
   **premade components + an icon library** (`components-and-assets.md`); never hand-draw
   illustrative SVG. Custom SVG/canvas only for a data-driven instrument.
7. **Polish & motion pass.** Before you call it done, read `reference/polish.md` and
   `reference/motion.md` and work both: the finishing-craft checklist (spacing rhythm,
   optical alignment, type micro-craft, interactive states, detail finish) AND
   purposeful, render-safe motion. A static, unpolished page is not done.
8. **Self-check (gate).** Run the checklist below. Weak answer → not done.

## The standout requirement (non-negotiable)
Every page ships exactly ONE nameable, subject-grounded standout the page is
remembered for — see `hero-artifacts.md` for the full bar and the **swap test**
(swapping the subject should break it). It must render on load and degrade without JS.
A palette, a font pairing, a mood, a product screenshot, or a generic scroll-reveal
do NOT count. **And the input→number widget (calculator / clock / gauge) is now the
reflexive default — only pick it if the subject's number is genuinely central.
Otherwise prefer a more expressive archetype** (generative visual, spatial/map,
simulation, explorable diagram, before↔after). Not every subject has a number; don't
invent one to justify a calculator.

## Boldness (restraint ≠ timidity)
Restraint means precision in service of a bold idea — not safeness, not blandness. A
statement piece must be **loud**: large scale, high contrast, decisive single color
or dramatic monochrome, confident asymmetry, a willingness to dominate the viewport.
"Tasteful, safe, and forgettable" is a failure. **Bold ≠ slop:** bold is intentional,
grounded, and committed; slop is reflexive and generic — and you reach boldness with
scale/contrast/composition, never with banned colors or gradients.

## Variety (different every time)
If your output could be swapped with the last anti-slop page you built, you
converged. Each build must differ in **layout archetype**, **type move**, **font
character**, and **standout kind**. The forbid-the-median step (3) is how you do it.

## Polish & motion (every page earns this)
A unique concept still has to feel *finished* and *alive*. Two requirements before
shipping — details in `reference/polish.md` and `reference/motion.md`:
- **Polish** — one spacing scale, optical alignment, type micro-craft (measure, leading,
  `tabular-nums`, balanced headings), every interactive with hover + `:focus-visible` +
  active, AA contrast, responsive at 390/1440, real content. The squint test passes.
- **Motion** — a small vocabulary (2–3 curves, 2–3 durations), ONE signature load/
  interaction gesture, microinteraction feedback proportional to the trigger.
  **transform/opacity only**, ease-out entrances, 150–400ms, staggered lists. Animate
  from a *present* state (render-safe), and ship `prefers-reduced-motion`. No bounce on
  functional UI, no scroll-jacking, no animating layout props. Use `motion.md`'s safe
  recipes: bars use `scaleX` (not width), hover uses `translate` (not padding), and a
  reveal must NOT put `opacity:0` on content in base CSS (gate it behind `html.js`).

## Hard gates (objective — not subject to your judgment)
- **Color gate.** Nothing from `reference/slop-colors.md`. Darkness is a trap, not a
  license. Derive the accent from the subject's real material OR its genuine energy —
  and note that muted-earthy accents (terracotta / ochre / oxblood / crust) have
  themselves become the safe default. If the subject has energy, commit to a bold,
  bright, or unexpected hue (saturation is not slop — only the banned bands are).
- **Render gate.** Core content (standout, headings, copy) visible on load and without
  JS. Never gate primary content behind `opacity:0`-until-scroll. Reveal-on-scroll is
  secondary polish only, and respects `prefers-reduced-motion`.
- **Type gate.** Not the avoid-list, not the "tasteful" darlings (Playfair, Cormorant,
  Fraunces, Instrument Serif, Clash Display), and not the new safe grotesques becoming
  defaults (Inter, Geist, Space Grotesk, Outfit, Cabinet Grotesk, General Sans,
  Sentient). Pick a characterful display face and vary it per build.
- **Assets gate.** Never hand-draw illustrative SVG (figures, objects, scenes, mascots,
  spot illustrations) — it reads amateur. Use **premade components**: an icon library
  (Lucide / Phosphor / Heroicons / Tabler via CDN) for every glyph, accessible UI
  component patterns, optionally a CSS component layer — all restyled to your palette/
  type, never shipped as defaults (`components-and-assets.md`). Custom SVG/canvas is
  allowed ONLY for precise, *data-driven* instruments (charts, rings, gauges, curves,
  maps generated from data) — never to draw a *thing*.
- **Contrast gate.** Every text/background pair meets WCAG AA (4.5:1 body, 3:1 large/UI)
  — computed, not eyeballed. Beware warm-text-on-warm-dark grounds (the low-contrast
  trap): raise text lightness or desaturate the ground until it passes.

## The final self-check (answer all before you ship)
1. **Name the standout** in three words. _(none → not done)_
2. **What does it do / state, grounded in the subject?** _(a mood/story → fail)_
3. **Renders on load, without JS?** _(blank-until-scroll → fail)_
4. **Any slop color? Dark + glow?** Grep your hexes against `slop-colors.md`. _(yes → fail)_
5. **Bold, not timid?** Would a cautious designer have shipped this? _(yes → fail)_
6. **Layout archetype deliberate** (not headline-left + card-right)? _(default → fail)_
7. **A real type move** beyond an italic accent word? Characterful font, not a default
   grotesque? _(no → fail)_
8. **Did I forbid the median, and would another of my outputs look the same?** _(same → fail)_
9. **Polished?** One spacing scale, aligned edges, type micro-craft, every control has
   hover + `:focus-visible` + active, works at 390px. _(accidental detail → fail)_
10. **Contrast computed?** Every text/bg pair ≥ AA (4.5:1 / 3:1), checked with numbers —
    especially warm-on-warm-dark. _(eyeballed / any pair below → fail)_
11. **Premade assets, no drawn illustration?** Icons from a library; components/patterns
    restyled (not defaults); any custom SVG is a data-driven instrument, not a drawing.
    _(hand-drawn illustration → fail)_
12. **Purposeful motion + reduced-motion?** A defined easing/duration vocabulary, one
    signature gesture, transform/opacity only, `prefers-reduced-motion` shipped. _(static,
    or decorative/janky motion → fail)_
13. **The AI-slop test:** would someone instantly believe an AI made this? _(yes → fail)_

## Personality ≠ slop (and ≠ amateur, ≠ timid sameness)
Personality comes from the **concept**, a **data-driven instrument**, **bold
composition**, and **premade components used with identity** — NOT from Claude drawing
pictures. Hand-drawn illustrative SVG (figures, scenes, objects, mascots) reads
amateur every time; that's why icons come from a library and visuals from real
components. The crafted-SVG exception is narrow: a *precise, data-driven instrument*
(a chart, ring, gauge, curve, map computed from data) is craft; a doodled scene is
slop. Two other traps are just as real: a *mood* dressed in a subject story, and a
safe template that passes every gate and bores. The test is always the artifact, its
polish, and its boldness — never the explanation.

## Reference map
Mandatory reads are in Step 0. Read the rest on demand.

| When you're… | Read |
|---|---|
| **Always, before building (Step 0)** | `slop-manifest.md` · `slop-colors.md` · `hero-artifacts.md` · `composition-and-boldness.md` · `tensions.md` |
| Inventing the standout | `reference/hero-artifacts.md` (functional archetypes) · `reference/personality-moves.md` |
| Choosing layout, type expression, boldness | `reference/composition-and-boldness.md` |
| Polishing & adding motion (final pass) | `reference/polish.md` + `reference/motion.md` |
| Components, icons, layout patterns, contrast | `reference/components-and-assets.md` |
| A proven distinctiveness move | `reference/distinctiveness.md` (steal the method, not the tokens) |
| Choosing fonts & color | `reference/type-and-color.md` + `reference/slop-colors.md` |
| Composing visuals — hierarchy, spacing, gestalt, motion, a11y, responsive, tokens | `reference/craft-principles.md` |
| Designing behavior — affordances, UX laws, cognitive load, IA/nav, forms, onboarding | `reference/ux-principles.md` |
| Going deeper on any topic | `docs/design-research/<topic>.md` (index at `docs/design-research/README.md`) |
