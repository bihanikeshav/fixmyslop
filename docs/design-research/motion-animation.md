# Motion & Animation in UI Design

> Motion is a communication channel: it orients users in space, confirms actions, signals status, and reveals hierarchy — purposeful movement makes an interface legible; purposeless movement makes it exhausting.

---

## Why It Matters

Static interfaces force users to infer relationships between states; motion makes those relationships visible in time. When a modal slides in from a button's position, users understand where it came from and can predict how to dismiss it. When a list item bounces after being deleted, users waste cognitive resources parsing a signal that carries no meaning. The distinction — motion as information vs. motion as decoration — determines whether animation earns its rendering cost. Material Design frames this directly: "motion helps make a UI expressive and easy to use" but only when it is "meaningful and appropriate." [Material Design 3 Motion] Apple's Human Interface Guidelines reinforce the constraint: "Don't add motion for the sake of adding motion. Gratuitous or excessive animation can distract people or make them feel disconnected." [Apple HIG Motion]

---

## Core Principles

**1. Purposeful Motion**
Every animated transition should answer at least one question for the user: Where did this element come from? What just changed? What is the system doing? Val Head, in *Designing Interface Animation* (Rosenfeld Media, 2016), categorizes these functions as orientation, feedback, and narrative. An animation that answers none of these questions should be removed. The test is simple: if cutting the animation breaks comprehension, it belongs; if it only adds visual interest, it is a liability.

**2. Easing and Natural Physics**
Real objects do not start or stop instantaneously — they accelerate and decelerate. The Disney principle of *Slow In and Slow Out* (introduced in Frank Thomas and Ollie Johnston's *The Illusion of Life: Disney Animation*, 1981) describes this: pile drawings at the start and end of a motion, fewer in the middle, to create the illusion of weight. In CSS this translates directly to easing curves. **Ease-out** (`cubic-bezier(0.0, 0.0, 0.2, 1)`) is correct for elements *entering* — they arrive at full speed and settle gently, which feels responsive. **Ease-in** (`cubic-bezier(0.4, 0.0, 1, 1)`) is correct for elements *leaving* — they accelerate away and do not linger. **Standard/ease-in-out** (`cubic-bezier(0.4, 0.0, 0.2, 1)`) governs elements that move between two on-screen positions. Material Design 3 codifies these as *Emphasized Decelerate* (`cubic-bezier(0.05, 0.7, 0.1, 1.0)`) for entrances and *Emphasized Accelerate* (`cubic-bezier(0.3, 0.0, 0.8, 0.15)`) for exits. [Material Design 3 Easing and Duration]

**3. Duration and the Doherty Threshold**
Duration must balance perceptibility against impatience. Val Head's research-grounded recommendation is **200–500 ms** for interface animations: small UI elements (button feedback, tooltip appearance) at 150–200 ms, medium transitions (panel slides, modal entrances) at 250–400 ms, large full-screen transitions at 400–500 ms. [Val Head, "How Fast Should Your UI Animations Be?", 2016] The lower bound is physiological — the Model Human Processor requires roughly 230 ms to consciously perceive a visual event, so animations shorter than ~150 ms may go unnoticed. The upper bound comes from the **Doherty Threshold**: Walter J. Doherty and Ahrvind J. Thadani's 1982 IBM Systems Journal paper established that system response under 400 ms keeps users in flow; beyond that, the user's attention detaches. [Laws of UX: Doherty Threshold] Transitions that genuinely take longer (network fetches, heavy computation) should use progress indicators, not animation loops, to fill the wait honestly.

**4. Squash, Stretch, and Perceived Weight (Disney Principles)**
The Disney principle of *Squash and Stretch* gives objects the illusion of physical mass. Applied to UI, a button that compresses slightly on press and snaps back on release feels tactile rather than inert. The principle of *Anticipation* — a brief preparatory motion before the main action — helps users predict what is about to happen: a checkbox that tilts 2–3° before the checkmark appears, a drawer handle that nudges before the panel opens. *Follow-Through and Overlapping Action* means elements do not all stop at the same frame; a dialog that slightly overshoots its resting position and settles back reads as having physical momentum. Used sparingly and with sub-frame amplitude (2–4 px overshoot, not 40 px), these principles add perceived quality. Used heavily, they produce cartoon UI. [Thomas & Johnston, *The Illusion of Life*, 1981; Marvel App blog on Disney motion principles]

**5. Staging and Hierarchy**
The Disney principle of *Staging* — presenting an idea so it is "completely and unmistakably clear" — maps directly to visual hierarchy in transitions. The element that carries the most importance should lead; secondary content follows. In a list-to-detail transition, the selected item should drive the animation (it expands or morphs into the destination) while surrounding items recede. This is the basis of Material Design's *container transform* pattern: the surface that contains a tap target expands to fill the destination, preserving spatial continuity. [Material Design 3 Motion]

**6. Choreography and Staggering**
When multiple elements animate simultaneously, they compete for attention and read as noise. Staggering — delaying the start of each successive element by a small, consistent offset — converts parallel noise into a readable cascade. The IBM Carbon Design System recommends 20 ms stagger intervals for list items; Material Design 2's choreography guidance describes "successor elements" following "lead elements" with 30–50 ms offsets. [IBM Carbon Design System Choreography] The rule is that stagger intervals must be small enough that the sequence reads as one coordinated event, not as a series of independent animations. Above ~80 ms per item, a list of 10 cards takes 800 ms to complete — longer than any individual transition budget.

**7. Microinteractions (Trigger → Rules → Feedback → Loops/Modes)**
Dan Saffer's *Microinteractions: Designing with Details* (O'Reilly, 2013) provides the canonical structural model. A microinteraction has four parts: the **trigger** (user gesture or system event that initiates it), the **rules** (logic governing what happens), the **feedback** (the visible/audible/haptic response that communicates the result), and **loops and modes** (whether it repeats or enters a special state). Animation lives almost entirely in the feedback layer. A toggle switch that slides from left to right is feedback for the "toggle state" rule. A progress ring is feedback for "upload in progress." Good microinteraction feedback is proportional to the trigger — a button press warrants a brief ripple or scale pulse (150–200 ms), not a 600 ms celebration sequence. [Dan Saffer, *Microinteractions*, O'Reilly, 2013]

**8. Performance: Animate the Compositor Layer**
The browser rendering pipeline runs in four stages: Style → Layout → Paint → Composite. Changing properties that trigger Layout (e.g., `width`, `height`, `top`, `left`, `margin`, `padding`) forces the browser to recalculate geometry for potentially the entire document — this is a reflow, and it is expensive. Changing Paint properties (e.g., `background-color`, `border`, `box-shadow`) redraws pixels without recalculating geometry — cheaper but still CPU-bound. Only `transform` and `opacity` skip both stages entirely and run on the GPU compositor thread. This is the primary performance rule for web animation: **animate only `transform` and `opacity`**. At 60 FPS, each frame has a budget of 16.7 ms (`1000 / 60`). A single forced layout during an animation frame is typically enough to blow that budget and produce jank. [web.dev, "Why are some animations slow?"; "How to create high-performance CSS animations"]

**9. Accessibility: Respect `prefers-reduced-motion`**
Vestibular disorders (affecting the inner ear's balance system) affect roughly 35% of adults over 40 and can be triggered by parallax scrolling, large-scale transforms, and animations that involve rapid movement across the viewport. Epilepsy and migraine sensitivity compound this population. The CSS media feature `prefers-reduced-motion: reduce` surfaces the OS-level accessibility setting ("Reduce Motion" on macOS/iOS, "Animation Effects" on Windows 11). The correct response is not to disable all animation — opacity fades and color transitions are generally safe — but to replace motion-heavy animations with sedentary alternatives. [MDN Web Docs, `prefers-reduced-motion`; WCAG 2.1 SC 2.3.3 Animation from Interactions (AAA)]

```css
/* Default: full motion */
.panel {
  transition: transform 300ms cubic-bezier(0.05, 0.7, 0.1, 1.0),
              opacity  250ms ease-out;
}

/* Honored preference: replace spatial motion with fade */
@media (prefers-reduced-motion: reduce) {
  .panel {
    transition: opacity 200ms ease-out;
    transform: none !important;
  }
}
```

**10. Delight vs. Distraction**
Apple's HIG draws a clear line: "Prefer quick, precise animations. Animations that combine brevity and precision tend to feel more lightweight and less intrusive." Delight is a surplus, not a baseline — it is the sensation a user gets when an animation is *more elegant than expected*, not when it is merely present. Confetti bursts on completing a form, ink ripples on button press, satisfying checkmark draws on task completion: these earn their place only in interactions that are rare, emotionally significant, or explicitly celebratory. Animating every affordance at the same amplitude flattens the hierarchy of joy and trains users to ignore motion entirely.

---

## How to Apply (Web UI)

**DO** animate `transform` (translate, scale, rotate) and `opacity` exclusively for performance-critical transitions.

**DO** use ease-out curves for elements entering the screen: `cubic-bezier(0.0, 0.0, 0.2, 1)` or Material's Emphasized Decelerate `cubic-bezier(0.05, 0.7, 0.1, 1.0)`.

**DO** use ease-in curves for elements exiting: `cubic-bezier(0.4, 0.0, 1, 1)` or Material's Emphasized Accelerate `cubic-bezier(0.3, 0.0, 0.8, 0.15)`.

**DO** target 150–200 ms for small UI feedback (button press, checkbox, tooltip), 250–400 ms for panel/modal transitions, and ≤500 ms for full-screen transitions.

**DO** stagger list items with 20–50 ms offsets, ensuring the full sequence completes in under 400 ms total.

**DO** write `@media (prefers-reduced-motion: reduce)` blocks for every non-trivial animation; replace spatial motion with opacity transitions.

**DO** use `will-change: transform` sparingly and only when profiling confirms a performance gain — it consumes GPU memory and causes its own compositing overhead if overused.

**DO** test animations at throttled CPU (4× slowdown in Chrome DevTools) to catch jank before shipping.

**AVOID** animating `width`, `height`, `top`, `left`, `margin`, or `padding` — these trigger layout recalculation on every frame.

**AVOID** animating `box-shadow` or `filter: blur()` — these are repaint-heavy and cannot be composited cheaply.

**AVOID** linear easing (`animation-timing-function: linear`) for element movement — it reads as mechanical and cheap; reserve linear only for continuous-loop effects (spinners, progress bars).

**AVOID** running entrance and exit animations simultaneously with the same curve — enter on ease-out, exit on ease-in, or both feel wrong.

**AVOID** `transition: all` — it applies transitions to every property including layout-triggering ones, producing unintended reflows.

**AVOID** omitting `prefers-reduced-motion` handling — this is an accessibility requirement, not an optional enhancement.

---

## Anti-Patterns

**Bounce and elastic easing on functional UI.** Spring physics (`cubic-bezier` values that overshoot 1.0) and bounce easing introduce oscillation that reads as playful/cartoon. In a utility UI — a dropdown, a form, a data table — they feel tonally wrong and force the duration up to remain readable (the extra direction changes require more time to parse). Reserve spring physics for consumer-facing, emotionally expressive products and only on large, infrequent interactions like an app launch screen or onboarding flow.

**Animating layout properties.** `width: 0 → auto`, `height: auto → 300px`, `left: -100px → 0` — all trigger forced layout (reflow) on every animation frame. On a mid-range Android device this reliably produces jank. The fix is to translate (`transform: translateX(-100%)`) or scale (`transform: scaleX(0)`) instead, keeping geometry calculations out of the render loop.

**Scatter-shot microanimations.** When every interactive element — button, checkbox, link, input, icon — has its own entrance, hover, focus, active, and exit animation at different timings and curves, the interface reads as restless. Motion loses meaning when it is everywhere. Define a motion vocabulary (two or three curves, two or three durations) and enforce it systematically, the same way a type scale or color palette is enforced.

**Ignoring `prefers-reduced-motion`.** The WCAG Animation from Interactions criterion (2.3.3, AAA) specifies that motion triggered by interaction can be disabled unless it is essential to the functionality. More practically: a user who has enabled Reduce Motion on their OS has done so because motion makes them unwell. Shipping an interface that ignores this setting is an accessibility failure. The MDN implementation guide (2020) marks `prefers-reduced-motion` as "Baseline: Widely Available" — there is no browser-support excuse.

**Excessive duration on repeated interactions.** A 500 ms animation on a "close" button feels satisfying the first time. On the fiftieth dismiss in a day it is friction. Apple's HIG specifically advises: "In general, avoid adding motion to interactions that occur frequently." Duration budgets should scale inversely with interaction frequency.

**Animating purely for perceived loading.** Skeleton screens and progress bars communicate status honestly. Fake animations — a loader that spins for a fixed 2 seconds regardless of actual load time, or an artificial "processing" pause before showing already-available data — teach users that animations are theatrical, eroding trust in all feedback thereafter.

---

## Sources

1. **Material Design 3 — Easing and Duration**
   https://m3.material.io/styles/motion/easing-and-duration/tokens-specs
   (Cubic-bezier values for Emphasized, Standard, Decelerate, Accelerate tokens; duration ranges.)

2. **Material Design 3 — Motion Overview**
   https://m3.material.io/styles/motion/overview/how-it-works

3. **Apple Human Interface Guidelines — Motion**
   https://developer.apple.com/design/human-interface-guidelines/motion
   (Prefer quick precise animations; make motion optional; avoid motion on frequent interactions.)

4. **web.dev — "Why are some animations slow?"**
   https://web.dev/articles/animations-overview
   (Rendering pipeline: Style → Layout → Paint → Composite; 16.7 ms frame budget; transform/opacity as composited properties.)

5. **web.dev — "How to create high-performance CSS animations"**
   https://web.dev/articles/animations-guide
   (Practical guidance: animate transform and opacity; use DevTools to catch layout/paint triggers; will-change caveats.)

6. **MDN Web Docs — `prefers-reduced-motion`**
   https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
   (Syntax, browser support, recommended CSS pattern for replacing spatial motion with opacity transitions.)

7. **Val Head — "How Fast Should Your UI Animations Be?"** (2016)
   https://valhead.com/2016/05/05/how-fast-should-your-ui-animations-be/
   (200–500 ms range; Model Human Processor; Nielsen Norman Group 100 ms / 1 s landmarks.)

8. **Val Head — *Designing Interface Animation*** (Rosenfeld Media, 2016)
   (Book, no canonical URL. Covers motion categories: orientation, feedback, narrative; animation style guides.)

9. **Laws of UX — Doherty Threshold**
   https://lawsofux.com/doherty-threshold/
   (Doherty & Thadani, IBM Systems Journal, 1982: <400 ms response keeps users in flow.)

10. **Dan Saffer — *Microinteractions: Designing with Details*** (O'Reilly, 2013; Full Color Ed. 2014)
    https://www.amazon.com/Microinteractions-Full-Color-Designing-Details/dp/1491945923
    (Book, no canonical URL. Trigger → Rules → Feedback → Loops/Modes structural model.)

11. **Frank Thomas & Ollie Johnston — *The Illusion of Life: Disney Animation*** (Disney Editions, 1981/1995)
    https://en.wikipedia.org/wiki/Disney_Animation:_The_Illusion_of_Life
    (Book, no canonical URL. Original 12 principles: Squash/Stretch, Anticipation, Staging, Follow-Through, Slow In/Out, Arc, Secondary Action, Timing, Exaggeration, Solid Drawing, Appeal.)

12. **Wikipedia — Twelve Basic Principles of Animation**
    https://en.wikipedia.org/wiki/Twelve_basic_principles_of_animation
    (Reference summary of all 12 principles with attributions.)

13. **Marvel App Blog — "Disney's Motion Principles in Designing Interface Animations"**
    https://marvelapp.com/blog/disneys-motion-principles-in-designing-interface-animations/
    (UI adaptation of Squash/Stretch, Anticipation, Timing, Staging, Secondary Action, Follow-Through.)

14. **IBM Carbon Design System — Motion Choreography**
    https://carbondesignsystem.com/elements/motion/choreography/
    (Stagger intervals; producer/consumer choreography patterns.)

15. **Smashing Magazine — "Including Animation In Your Design System"** (Val Head, 2019)
    https://www.smashingmagazine.com/2019/02/animation-design-system/
    (How to encode motion vocabulary as design tokens; motion style guides.)
