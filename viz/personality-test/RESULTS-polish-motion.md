# Polish & motion round

Goal (user): pages are now unique, but need polish + animations. Distilled the craft +
motion research into `reference/polish.md` + `reference/motion.md`, added a Polish &
motion pass to the skill, and a grounded motion gate to `slop-check.mjs`. Builds:
`pm-saffron`, `pm-drift`, `pm-studio` (motion studio = meta-test).

## What the motion gate proved
On the OLD builds: motion was **NONE** (cb-hotsauce, v2-cadence) or unsafe
(var-bookstore-1: no reduced-motion + animates layout props). The gap, confirmed.

## Attempt 1 — regressed (honest)
Adding motion brought back the exact problems: scroll-reveal with `opacity:0`
(render-gate), `width` progress bars + `padding` hovers (layout-prop animation). Gate
caught all three → 0/3. **Banning the bad idioms wasn't enough.**

## Fix — hand them the safe recipe
`motion.md` now ships copy-paste safe recipes: entrance reveal gated behind `html.js`
(content visible without JS), bars = `transform:scaleX`, hover = `translate`, stagger =
`transition-delay`, press = `scale`. Rebuilt:
- **Layout-prop animation: gone.** Bounce: none. reduced-motion: shipped on all three.
- **pm-saffron: clean PASS.**
- pm-drift / pm-studio: the only remaining checker flags are *decorative/state*
  `opacity:0` (drift's animated waveform + range-input overlay; studio's non-active
  frames in the frame-viewer) — NOT content hidden on load. Verified by selector
  inspection; render-safe.

Also fixed the checker itself: it now recognizes the `html.js`-gated reveal as safe
(was a false positive) while still failing UNGATED `opacity:0` (old portfolio still
fails on 8 ungated rules — control held).

## Verdict
Polish is visibly higher (NLE chrome, tabular timecodes, type micro-craft, spacing
scale, interactive states) and motion is now present, purposeful, and render-safe
(vocabulary + one signature gesture + reduced-motion, transform/opacity only). The new
motion gate makes this enforceable going forward. Lesson: enabling motion safely
requires giving the safe recipe, not just banning the unsafe one.
