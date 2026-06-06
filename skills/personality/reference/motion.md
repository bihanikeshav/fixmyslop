# Motion — purposeful animation that reads as craft, not decoration

Read at the Polish & motion pass. Motion is a communication channel: it orients
(where did this come from?), gives feedback (what changed?), and shows status (what's
the system doing?). **If cutting an animation breaks comprehension, it belongs; if it
only adds visual interest, it's a liability.** Every page should have *some* considered
motion — a polished page is never fully static — but motion is a vocabulary you define
(2–3 curves, 2–3 durations) and enforce, like a type scale.

## Render-safe rule (non-negotiable — reconciles with the render gate)
Animate **from a present, in-markup state**, never from `opacity:0`/`display:none` that
hides content until JS fires. Entrances enhance content that is already there; with JS
off or `prefers-reduced-motion`, the final (visible) state must show. Never gate the
hero/standout/headings behind a scroll observer.

## Safe recipes (use these exact patterns — don't hand-roll the unsafe version)
The unsafe idioms are the *reflex* ones; reach for these instead.
- **Entrance reveal — content visible by default, animation only when JS is present.**
  Never put `opacity:0` on content in base CSS.
  ```html
  <script>document.documentElement.classList.add('js')</script>  <!-- in <head> -->
  ```
  ```css
  .reveal { transition: opacity .45s ease-out, transform .45s ease-out; }
  html.js .reveal { opacity: 0; transform: translateY(16px); }   /* hidden ONLY if JS ran */
  html.js .reveal.in { opacity: 1; transform: none; }
  ```
  An IntersectionObserver (or a load timeout) only *adds* `.in`. JS off / reduced-motion → content shows.
- **Bar / progress / underline grow:** `transform: scaleX()` + `transform-origin:left`, never `width`.
- **Hover nudge / indent:** `transform: translateX(6px)`, never `padding`/`margin`/`left`.
- **List stagger:** toggle `.in`, then `transition-delay: calc(var(--i) * 40ms)` (transform+opacity only).
- **Press feedback:** `transform: scale(.97)` on `:active`, ~120ms.

## The vocabulary
- **Easing.** Entrances → **ease-out** `cubic-bezier(0,0,0.2,1)` (arrive fast, settle).
  Exits → **ease-in** `cubic-bezier(0.4,0,1,1)` (accelerate away). On-screen moves →
  **ease-in-out** `cubic-bezier(0.4,0,0.2,1)`. Never `linear` for movement (reads cheap;
  linear only for spinners/continuous loops).
- **Duration.** Small UI feedback (button/checkbox/tooltip) **150–200ms**; panels/modals
  **250–400ms**; full-screen ≤**500ms**. Under ~150ms goes unnoticed; over ~400ms breaks
  flow (Doherty). Longer real waits → honest progress indicator, not a fake loop.
- **Choreography.** Stagger lists **20–50ms** per item; the whole cascade must finish
  under ~400ms so it reads as one coordinated event, not N separate animations.
- **Microinteractions** (Saffer): trigger → rules → **feedback** → loops. Animation lives
  in feedback, proportional to the trigger — a press warrants a ~150ms scale/ripple, not
  a 600ms celebration.
- **One signature gesture.** A single orchestrated, on-brand entrance/interaction as the
  first impression (a stagger, a weight-morph, a draw-on) — the page-load moment from
  composition-and-boldness. One, not scattered.

## Performance (the hard rule)
Animate **only `transform` and `opacity`** (GPU-composited). 16.7ms/frame budget.
**Never animate** `width/height/top/left/margin/padding` (reflow/jank) or
`box-shadow`/`filter:blur` (repaint-heavy). Never `transition: all`. `will-change`
sparingly. Subtle Disney polish is fine at *sub-frame amplitude* (2–4px overshoot, a
slight press-squash) — never 40px cartoon bounce.

## Accessibility (required for every non-trivial animation)
```css
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: .01ms !important; animation-iteration-count: 1 !important;
      transition-duration: .01ms !important; scroll-behavior: auto !important; }
}
```
Better per-component: replace spatial motion with a plain opacity fade and `transform:none`.
Opacity/color fades are generally safe; large transforms/parallax are what trigger
vestibular issues. The reduced-motion end state must equal the normal end state.

## Anti-patterns (these are slop)
- Bounce/elastic/spring easing on functional UI (dropdowns, forms) — cartoonish.
- Animating layout props (width/height/top/left) — jank.
- Scatter-shot micro-animations — every element with its own timing → restless noise.
- Decorative loops, parallax-for-its-own-sake, scroll-jacking — motion that says nothing.
- Fake loaders / artificial "processing" pauses — erodes trust in all feedback.
- Excessive duration on frequent interactions (a 500ms close button) — friction by repeat.
- Omitting `prefers-reduced-motion` — an accessibility failure, not optional.

→ deep dive (Disney 12, Material/HIG tokens, citations): docs/design-research/motion-animation.md
