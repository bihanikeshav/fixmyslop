# Hero artifacts — the one functional standout every page must have

> A companion to `distinctiveness/README.md`. That file catalogs *moves* (type as
> identity, own one color, a personal metaphor). This file is narrower and harder:
> the skill's new hard requirement that **every page ship ONE nameable, functional,
> subject-grounded standout component** — a *hero artifact* — not a mood, not a
> palette, not a "feels like X." Atmosphere is where slop hides. A working component
> is personality you cannot screenshot-clone.

---

## Definition & the bar

A **hero artifact** is the single load-bearing functional centerpiece of a page. It
qualifies only if it clears ALL five tests:

1. **Nameable.** You can give it a proper noun — "the Lunar Bake Wheel," "the Depth
   Reader," "the Tide Schedule." If the best name you can manage is "the hero
   section" or "the vibe," it isn't one.
2. **Functional / interactive.** It *does* something: computes, responds to input /
   scroll / time / pointer, reveals real information, simulates, or plays. A still
   image, a gradient, or a decorative loop does not compute anything.
3. **Grounded in the SUBJECT's real data or mechanic.** It is built around the thing
   the subject actually *is* — moon phase → loaf; ocean depth → reading length;
   tempo → metronome; tide table → opening hours. Swap the subject and the artifact
   should break, because it was made of that subject's substance.
4. **Renders on load; degrades without JS.** Core content is present in markup and
   visible immediately. Never `opacity:0`-until-scroll for the thing that IS the
   page. With JS off it should still show a real, readable fallback (the static
   wheel, the current value, the table).
5. **Could not belong to any other site.** If you could paste it onto a competitor
   unchanged, it is decoration, not a hero artifact.

**Gold standard.** A moon-phase bakery whose hero is a live 28-day lunar wheel: each
of the 28 segments maps to a real loaf, the current phase is highlighted from the
device clock, hover reveals that day's bake, and with JS off it renders today's
phase + loaf as static SVG. Nameable (the Lunar Bake Wheel), functional (clock-driven,
hoverable), grounded (the bakery's actual moon-phase conceit), degrades, unique.

**Does NOT qualify** (these are the slop that masquerades as a signature): a color
palette; a serif-on-cream "editorial mood"; "the page feels like the deep sea"; a
generic product screenshot or device mockup; a parallax/scroll-reveal decoration; a
hero headline with a nice font; an abstract animated blob/gradient; a marquee of logos.

---

## The archetypes (~12 functional hero components)

For each: **what it is · when it fits · a real example · how to ground it in an
ARBITRARY subject.** Pick ONE per page; build it from step-1 nouns of `/personality`.

### 1. Live calculator / estimator
- **What:** Inputs → an instant, subject-specific answer with a number the visitor
  came for.
- **When:** The subject has a question its audience always asks ("how much / how long
  / when / am I eligible").
- **Real example:** Wise's homepage live currency converter; Omni Calculator's
  topic-specific tools; the actuarial "Death Clock."
- **Ground it anywhere:** *Mattress brand* → a "Sleep Debt" calculator (bedtime +
  wake time → hours owed, mapped to a recommended firmness). *Tax software* →
  enter income, see refund estimate animate up.

### 2. Real-time clock / phase / seasonal widget
- **What:** A component driven by the actual current time, date, season, or a live
  natural cycle — not a fake animation.
- **When:** The subject is bound to time, place, sky, or season.
- **Real example:** time.is; sunrise/sunset and golden-hour widgets; live ISS / moon
  trackers; Radio Garden (spin a globe to the current local radio of a place).
- **Ground it anywhere:** *Coffee roaster* → a "Roast Clock" showing which roast is
  freshest this week. *Surf shop* → today's actual tide + swell pulled to a dial that
  recolors at high tide.

### 3. Generative / seeded deterministic visual
- **What:** A unique-but-reproducible visual generated from a seed (a name, a date, an
  order number) — same seed always yields the same artwork.
- **When:** The subject involves identity, personalization, or many distinct entities.
- **Real example:** GitHub identicons; "boring avatars"; Vercel/`@vercel/og` seeded
  OG images.
- **Ground it anywhere:** *Wine club* → each member's name seeds a unique label
  pattern. *Newsletter tool* → each issue number seeds a deterministic cover so the
  archive looks like a coherent series nobody hand-drew.

### 4. Interactive map / spatial explorer
- **What:** A pannable/zoomable/clickable space where information lives at locations.
- **When:** The subject is inherently geographic OR can be laid out as a believable
  space (a shop floor, a body, a timeline-as-terrain).
- **Real example:** "The True Size Of…"; Radio Garden's globe; Flightradar24's live
  map; a museum's clickable floor plan.
- **Ground it anywhere:** *Regional cheesemonger* → a map of source farms, click a
  pin → that cheese. *API product* → a world map of edge regions with live latency
  pulsing at each node.

### 5. Data instrument / gauge / meter
- **What:** A live readout of one real metric, styled as a real instrument (dial,
  bar, counter) — value present in markup on load.
- **When:** The subject has one number that matters and changes.
- **Real example:** Electricity Maps (live grid carbon intensity); the US Debt Clock;
  Down Detector; Worldometer counters.
- **Ground it anywhere:** *Recycling startup* → a live "Bottles diverted" odometer
  from real throughput. *Status-page SaaS* → an uptime gauge that is the company's
  own current uptime, not a stock 99.9%.

### 6. Simulation / physics toy
- **What:** A small interactive world running real rules — drag, drop, knock, flow —
  that the visitor can poke endlessly.
- **When:** The subject embodies a physical behavior (materials, fluids, motion,
  growth, contagion).
- **Real example:** Sandspiel / The Powder Toy (falling-sand); Bruno Simon's
  Cannon.js car; Matter.js demos.
- **Ground it anywhere:** *Craft brewery* → a fermentation toy: drop yeast, watch
  bubbles + gravity drop in real time. *Insurance* → a risk-domino toy that shows a
  small accident cascading, then "coverage" catching it.

### 7. Mini-game
- **What:** A genuinely playable game built from the subject's mechanic — score,
  goal, replay.
- **When:** The subject maps to a simple, instantly-graspable game loop AND a playful
  tone is appropriate.
- **Real example:** Chrome's offline dino runner; Burberry "B Bounce"; brand Google
  Doodle games.
- **Ground it anywhere:** *Knife maker* → a timing game: tap to land the perfect
  edge-grind angle. *Logistics app* → a tiny "route the package" puzzle on a grid
  that mirrors the real product.

### 8. Explorable / annotated diagram
- **What:** A labeled cross-section or schematic the visitor scrubs, expands, or
  steps through to understand how the subject works.
- **When:** The subject is a mechanism, process, or object worth explaining.
- **Real example:** Bartosz Ciechanowski's interactive essays ("Mechanical Watch,"
  "GPS," "Gears"); Nicky Case's "Parable of the Polygons."
- **Ground it anywhere:** *Espresso machine maker* → a scrubbable cutaway: drag the
  shot timeline, watch pressure and the puck change. *Audio plugin* → an annotated
  signal-flow diagram where each node previews its sound on click.

### 9. Before ↔ after transformer / comparison slider
- **What:** A draggable divider (or toggle) that reveals a real transformation the
  subject performs.
- **When:** The subject's whole value IS a change: messy→clean, raw→edited, old→new.
- **Real example:** juxtapose.js / TwentyTwenty sliders; remove.bg before/after; NASA
  glacier then/now.
- **Ground it anywhere:** *Restoration studio* → drag across a damaged→restored photo.
  *Copywriting service* → slide between the client's original paragraph and the
  rewrite, word-diff highlighted.

### 10. Configurator / builder
- **What:** The visitor assembles or customizes the actual product and watches it
  update live, ideally with a real price or spec.
- **When:** The subject is a product with real options the buyer chooses among.
- **Real example:** Tesla / Rivian / Porsche car configurators; NIKEiD; Teenage
  Engineering product builders.
- **Ground it anywhere:** *Custom-frame shop* → upload art, pick moulding + mat, see
  the framed result and price update. *Meal kit* → build the box, watch macros and
  cost recompute per swap.

### 11. Live feed / ticker
- **What:** A continuously-updating stream of the subject's real activity — events,
  edits, sales, posts, plays.
- **When:** The subject produces a steady flow of real, recent events.
- **Real example:** "Listen to Wikipedia" (edits play as sounds in real time); stock
  tickers; GitHub public events; Internet Live Stats.
- **Ground it anywhere:** *Indie record label* → a now-playing ticker of what listeners
  are streaming. *Open-source tool* → a live feed of recent installs/stars scrolling
  the hero.

### 12. A small genuinely-useful tool (bookmark-bait)
- **What:** A free micro-utility the exact audience would use repeatedly and save —
  the page earns return visits by being useful, not just promotional.
- **When:** You can extract a tiny, real, daily-useful task from the subject's domain.
- **Real example:** Squoosh / TinyPNG; regex101; caniuse; Coolors palette generator;
  WhatFontIs.
- **Ground it anywhere:** *Font marketplace* (this repo) → a live pairing previewer:
  type your own text, see two fonts set together, shuffle, copy the CSS. *Moving
  company* → a "will it fit" box-volume estimator the mover keeps open all day.

---

## The method — how to FIND the artifact for any subject

Slop comes from starting at atmosphere ("what mood?"). Hero artifacts come from
starting at **mechanism + data**. Worked procedure:

1. **Name the subject's core MECHANIC or DATA.** One sentence: *what does this thing
   fundamentally do, measure, or run on?* (Bakery → bakes on the lunar cycle; surf
   shop → tides; metronome app → tempo; ocean charity → depth/pressure; tax app →
   your numbers → a refund.) This is the noun you build from.
2. **Find where that mechanic produces a NUMBER, a STATE, or a CHANGE.** Phase angle,
   tide height, BPM, depth in meters, refund in dollars, edits per second. If you
   can't find one, you haven't dug into the subject yet — keep going, don't retreat
   to mood.
3. **Pick the archetype that fits that data shape.** Time/cycle → #2. One changing
   number → #5. A transformation → #9. A choosable product → #10. A flow of events
   → #11. A mechanism to explain → #8. (The 12 above are a lookup table by data
   shape.)
4. **Build the smallest working version, real on load.** Render the true current
   value/state in markup first; layer interaction on top. Then name it.
5. **Apply the five tests.** If it fails "could it belong to another site?" you
   grounded it in a generic mechanic, not THIS subject — return to step 1 and go
   more specific.

The test of whether you've found it: **swapping the subject should break the
artifact.** A tide dial makes no sense for a tax app; a refund estimator makes no
sense for a surf shop. If your "signature" survives the swap unchanged, it's
atmosphere wearing a signature's clothes.

---

## Anti-patterns (the artifact's failure modes)

- **The concept that isn't a component.** "Our signature is a moonlit, tidal
  feeling." A feeling renders nothing. If it has no inputs, no state, and no current
  value, it is not a hero artifact — it's a mood board.
- **Justification dressed as a signature.** "Dark background + cyan glow *because*
  deep sea." That is a slop palette with a backstory. The grounding has to produce a
  *working component* (a live depth gauge), not retro-rationalize a color choice.
  Reasoning that explains a styling decision is not the same as building a mechanism.
- **Decorative animation mistaken for a hero.** A looping particle field, a parallax
  drift, an animated gradient — pretty, but it computes nothing about the subject and
  responds to no real input. Motion ≠ function.
- **The invisible-until-scroll artifact.** Core content hidden behind
  `opacity:0`/`IntersectionObserver`, or a hero that's blank with JS off. If the
  thing that IS the page only exists after scroll or after JS, it fails test 4. Render
  the true state on load; enhance after.
- **Copying another site's specific artifact.** Cloning Bruno's drivable car, the
  bird-on-a-wire divider, or the lil-me cursor instead of mining your OWN subject's
  mechanic. The car is grounded in *Bruno's* childhood, not yours. Steal the archetype
  (#4 spatial explorer), never the token. A second drivable car reads as imitation on
  sight.
- **Generic-mechanic grounding.** A calculator that works for any business ("contact
  us ROI calculator"), a world map with no real data, a counter that counts nothing
  real. Grounded means built from *this* subject's substance — fails the swap test
  otherwise.

---

## One-line rule for the builder

Find the subject's core data or mechanic, build one nameable working component around
THAT, render it real on load, and make sure swapping the subject would break it. If it
survives the swap, you built atmosphere — go back and build the instrument.

---

## Statement assets in the wild — field notes (Magnific · Mastra · Kinetik)

The archetypes above are mostly *tools you operate*. A second, equally strong family is
the **statement asset**: a bespoke hero that *shows the product's output or mechanic*
rather than describing it. Three studied (lift the move, not the execution):

- **Magnific** — a full-bleed, genuinely striking **output asset** (a real image at
  quality) bleeding off the hero, beside a **rotating capability column**. The asset IS
  the output; the rotating list shows breadth without a text wall. "direct your best work."
- **Mastra** — a **bespoke generative concept diagram** of the real mechanic: an animated
  agent-network graph (hub + branching glowing nodes), not a stock screenshot — a custom
  picture of *what the framework builds* — plus a real `npm create mastra` command.
- **Kinetik** — an asymmetric layout with a **fanned deck of outcome cards**: each a real
  photo + an actual result it produced ("Wrote 3 versions of bio in my voice"). Proof, not
  promises. Statement line "Not a chatbot. A doer."

**New archetypes to add to the catalog:**
1. **Proof / output asset** — show the real thing the product makes, full-bleed, at quality.
2. **Concept diagram of the real mechanic** — a custom, precise generative graphic of how it
   works (agent graph, pipeline). Distinct from a *doodled* illustration (banned) because it
   depicts the actual system, data-driven.
3. **Outcome cards** — a few real, specific results (real artifact + concrete one-line
   outcome), fanned/overlapping, not a tidy 3-up.

**What to lift:** the asset is concrete + load-bearing (passes the swap test); a short
**opinionated statement line** carries it ("Not a chatbot. A doer.", never "AI-powered
platform"); an **asymmetric layout** where one side is a content-rich lightly-animated
bespoke asset (rotating list / live graph / card deck) — not centered, not a browser-framed
screenshot; **real product artifacts** as texture (an install command, a real CTA channel,
genuine results). Caveat: all three lean dark/gradient — borrow the asset + layout +
statement moves, execute them in a non-slop palette/type.
