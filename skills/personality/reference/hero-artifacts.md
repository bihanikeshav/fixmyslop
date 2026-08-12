# Hero artifacts — the ONE functional standout every page must ship

Mandatory read. Personality is not a mood or a palette — it is **one nameable,
functional, subject-grounded component** the page is remembered for. Atmosphere is
where slop hides; a working component is personality you cannot screenshot-clone.

## The bar (must clear ALL five)
1. **Nameable** — a proper noun ("the Lunar Bake Wheel," "the Depth Reader"). If the best
   name is "the hero section" or "the vibe," it isn't one.
2. **Functional / interactive** — it computes, responds to input/scroll/time/pointer,
   reveals real info, simulates, or plays. A still image or gradient computes nothing.
3. **Grounded** — built from the subject's real data or mechanic (moon→loaf, depth→reading,
   tempo→beat), not borrowed.
4. **Renders on load, degrades without JS** — the true current state is in markup
   immediately. Never `opacity:0`-until-scroll for the thing that IS the page.
5. **Unique** — paste it on a competitor unchanged and it should look wrong.

**The swap test (the discriminator):** *swapping the subject should BREAK the artifact.*
A tide dial makes no sense for a tax app. If your "signature" survives the swap, you
built atmosphere wearing a signature's clothes — go back and build the instrument.

**Does NOT qualify:** a color palette; a serif-on-cream mood; "feels like the deep sea";
a product screenshot; a parallax/scroll-reveal; an animated blob/gradient; a logo marquee.

## Archetypes (pick ONE, by the subject's data shape)
- **Live calculator / estimator** — inputs → the number the audience came for.
- **Real-time clock / phase / seasonal widget** — driven by actual time/date/tide/sky.
- **Generative / seeded visual** — deterministic art from a seed (name, date, order #).
- **Interactive map / spatial explorer** — info lives at pannable/clickable locations.
- **Data instrument / gauge / meter** — one real, changing metric as a live readout.
- **Simulation / physics toy** — a small world running real rules you can poke.
- **Mini-game** — a playable loop built from the subject's mechanic (if tone fits).
- **Explorable / annotated diagram** — scrub/step through how the subject works.
- **Before ↔ after transformer** — a slider revealing the real change the subject makes.
- **Configurator / builder** — assemble the actual product; spec/price updates live.
- **Live feed / ticker** — a stream of the subject's real recent activity.
- **A small genuinely-useful tool** — bookmark-bait the exact audience reuses.

**The numeric widget is the new default.** Calculator / clock / gauge (input→number)
is now the reflexive standout — it's the *easiest* functional thing, so it's where
everyone lands. Only pick it if the subject's number is genuinely central. Most
subjects are better served by an **expressive** archetype — generative visual,
spatial/map, simulation, mini-game, explorable diagram, before↔after, live feed.

## How to find it (start at mechanism, never at mood)
1. Name the subject's core **mechanic or data** in one sentence (what it does/measures/runs on).
2. Find where that mechanic produces a **number, state, change, space, or sequence**
   (phase angle, tide height, a transformation, a map of places, an ordered set). If
   there's no natural *number*, that's fine — don't force a calculator; a state/space/
   sequence points to an expressive archetype (generative, spatial, simulation, diagram).
3. Pick the archetype that fits that data shape (the list above is a lookup table). If
   the obvious fit is calculator/clock/gauge, deliberately consider an expressive
   alternative before committing.
4. Build the **smallest working version, real on load**; layer interaction on top; then name it.
5. Apply the five tests + the swap test. Fails "could belong to another site"? You grounded
   in a generic mechanic — go more specific.

## Anti-patterns (reject these)
- **Concept that isn't a component** — a "feeling" renders nothing (no inputs, no state).
- **Justification dressed as a signature** — "dark + cyan glow *because* deep sea" is a slop
  palette with a backstory. Grounding must produce a working mechanism, not excuse a color.
- **Decorative animation as a hero** — particles/parallax/animated gradient compute nothing.
- **Invisible-until-scroll** — blank with JS off → fails test 4.
- **Copying another site's artifact** — clone the archetype, never the token (no second
  drivable car). Mine YOUR subject.
- **Generic-mechanic grounding** — a calculator/map/counter that fits any business fails the swap test.

→ deep dive (12 archetypes with real examples + grounding for arbitrary subjects):
docs/design-research/hero-artifacts.md
