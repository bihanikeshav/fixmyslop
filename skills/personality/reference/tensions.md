# Tensions — when the guidance conflicts, resolve it here

The references pull from many sources, and good design advice genuinely tensions
against itself. Unreconciled, these contradictions produce mush. When two rules seem
to fight, this file is the tie-breaker. Read it during **Constrain** (step 4), and
whenever a reference line seems to contradict another.

The meta-rule: **most of these are not either/or — they are "earn the exception."**
You may break a default, but only deliberately, once, and in service of the concept.

## Distinctiveness vs. convention
- **"Be unforgettable / break the grid / make unexpected choices"** vs **Jakob's Law
  ("users expect your site to work like the ones they know")**. → Be conventional in
  *interaction* (nav, link affordances, form behavior, icon meaning) and distinctive
  in *expression* (type, color, motion, layout voice, the signature move). Innovate on
  the skin, not the mechanics.
- **"Break the grid / asymmetry reads designed"** vs **"use grids, alignment,
  consistency."** → Establish a disciplined grid first; break it *once per section*,
  deliberately and directionally. Grid-breaking is an accent, not the absence of a grid.
- **"Avoid overused fonts (Inter, Poppins…)"** vs **escape directions that use Inter as
  a body.** → A saturated font may be a quiet *workhorse body* under a distinctive
  heading; it may never be the hero/voice of the page. The distinction is carried by the
  heading + the style move, not the body.
- **"Don't center everything"** vs centering being natural for a short hero. → Default to
  left-aligned for anything scannable (multi-line copy, lists, body). Centering is fine
  for a single short hero headline + sub; never for paragraphs or feature grids.
- **"Don't use monospace as lazy 'technical' shorthand"** vs mono being a real category.
  → Use mono when it's genuinely typographic (code, data, a deliberate aesthetic), not
  as a reflex signifier for "developer/AI product."

## Expression vs. restraint
- **Maximalism** vs **minimalism.** → Not a conflict — *intentionality, not intensity.*
  Pick one clear point of view and execute it precisely. The failure is half-committing
  to both. Maximalism needs elaborate, careful code; minimalism needs ruthless precision.
- **"Create atmosphere — gradients, textures, depth, decorative detail"** vs the slop
  manifest banning gradients/glassmorphism/heavy shadow. → The ban is on *default,
  decorative, purposeless* use. A gradient/blur/texture is allowed when it solves a real
  layering or mood problem and fits the concept — never as reflexive "polish."
- **Generous whitespace / low density** vs **information density when the task needs it**
  (dashboards, tables, power tools). → Match density to user context. Don't default to
  airy low-density "because it photographs well"; don't cram a marketing page either.

## Delight & personality vs. usability
- **"Add personality / a signature move / delight"** vs **"reduce cognitive load, don't
  add friction."** → *Deep delight before surface delight*: the thing must work, be
  reliable, and be usable first. A signature element may never block the primary path,
  slow the task, or survive `prefers-reduced-motion`. Personality lives in the margins of
  a flow that is itself frictionless.
- **"One orchestrated page-load reveal"** vs **"motion conveys state, never decorates."**
  → A single signature entrance is the *sanctioned exception* — it's the first
  impression. Everything after page load must convey a state change (entrance, feedback,
  transition), not ornament.
- **"Amateurish hand-drawn SVG / mascots = slop"** vs the skill encouraging exactly those
  as personality. → The technique is never the problem; *specificity + craft +
  load-bearing intent* is the test. A generic doodle is slop; a crafted mark that *is*
  the page's concept is personality. (This is the core "Personality ≠ slop" rule.)
- **Aesthetic-Usability Effect ("attractive things feel more usable")** vs the duty to
  actually be usable. → Beauty raises *perceived* usability and buys goodwill — it never
  excuses a real usability failure or substitutes for testing. Don't let a pretty surface
  hide a broken flow.

## Simplicity vs. discoverability
- **Tesler's Law / progressive disclosure (hide complexity)** vs **discoverability &
  visible affordances (make things visible).** → Hide *secondary/advanced* complexity
  behind progressive disclosure; never hide the *primary* action or the signifier that
  reveals an affordance. Simplicity is fewer things competing — not fewer things findable.

## Hard floors (these always win — never trade them for aesthetics)
- **Accessibility beats aesthetic preference, every time.** Low-contrast "tasteful" type,
  dark-mode glow, crushed tracking, color-only signaling, removed focus rings, motion
  without a reduced-motion path — all lose to WCAG. If the look needs an a11y violation,
  the look is wrong.
- **Honesty beats conversion.** Persuasion (real scarcity, genuine social proof, urgency
  that is true) is fine; manufactured urgency/scarcity, confirmshaming, hidden costs, and
  hard-to-cancel are deceptive patterns — never ship them, even if they "work."
- **Clarity beats cleverness in copy.** Voice and wit are encouraged, but never at the
  cost of a user understanding what a control does or what an error means.
