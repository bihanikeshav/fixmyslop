# Design: the `/personality` skill

**Date:** 2026-06-05
**Status:** approved-pending-spec-review
**Owner:** Keshav

## 1. The pivot

Until now `fixmyslop` *diagnoses* a site and *swaps* slop one item at a time
(the `diagnose` CLI, the saturation/neighbors data). That's a corrective tool. It
does not make a model *creative*.

The complaint that triggered this: even after feeding a model fresh fonts and
colors, the output "feels off / not creative." That is **not** a temperature
problem — and temperature isn't even reachable:

- **Claude Code does not expose temperature.** No `settings.json` key, no env
  var, no flag. (The Agent SDK / API underneath have a `temperature` param; the
  CLI deliberately does not surface it.)
- Temperature is the wrong lever regardless. Randomness ≠ creativity. Higher
  temperature on a model with no creative scaffolding produces *noisier slop*
  plus broken code, not taste.
- The levers Claude Code *does* give us are about **thinking budget**: effort
  level (`/effort`, up to `max`), extended thinking / the `ultrathink` keyword,
  and model choice. A creative ideation phase should spend that budget.

So we pivot: **stop fixing slop item-by-item; make the model creative inside
constraints.** Tell it what's slop (so it can't reach for defaults), give it
craft guardrails (so "creative" never means "broken"), and force a real ideation
phase that invents *page-specific personality* — the equivalent of the cat
animation / pull-chain-lightbulb theme switch / dashed-SVG pointer line on a
hand-made portfolio.

## 2. Why existing skills fall short

- **Anthropic `frontend-design`** and **impeccable `frontend-design`** both say
  "commit to a BOLD direction," "what makes this UNFORGETTABLE?" — they name the
  *destination* but give no *route* to inventing the signature element.
- **impeccable suite** (18 skills) is excellent but too big/complex; we want a
  single `/frontend-design`-sized skill.
- **uupm.cc (UI/UX Pro Max)** is MIT-licensed and ships a big DB, but its own
  "fresh" recommendations drift into slop (its SaaS palette is `#2563EB`, its
  Micro-SaaS palette is indigo `#6366F1`, first font pairings are Inter / Poppins
  / Open Sans). **We use uupm only as an anti-pattern reference**, never as a
  source of fresh picks.

## 3. The four real levers of LLM design creativity

The skill is built around these (none is temperature):

1. **Thinking budget** — an explicit ideation phase *before any code* (where
   `ultrathink` / high effort pays off).
2. **Divergence → selection** — force ~15 candidate concepts, then critique and
   commit to one. Breadth-then-pick yields far more originality than "give me the
   answer."
3. **Subject-grounding** — personality must derive from *what the page is about*.
   Mine concrete nouns / metaphors / rituals from the subject; turn ONE into an
   interactive signature.
4. **Constraints as fuel** — the anti-patterns aren't only "don't"; they are
   generative constraints (Oblique-Strategies style): "no gradient, no pill, no
   Inter, no centered hero" forces a novel path.

**Slop vs personality (the key distinction):** impeccable flags "amateurish
hand-drawn SVG" and "image hover transform" as slop, yet a crafted hand-drawn
SVG can be exactly the personality we want. The difference is **specificity +
craft + load-bearing intent**, not the technique. A generic doodle = slop; a
doodle that *is the concept of the page* = personality. The skill must state this
explicitly so the model isn't scared off the very moves we want.

## 4. Deliverable

A single Claude Code skill, invoked like `/frontend-design`:

```
skills/personality/
  SKILL.md                      # the skill (kept tight, ~150–200 lines)
  reference/
    slop-manifest.md            # merged anti-patterns (generated + curated)
    personality-moves.md        # the catalog of signature-move *types*
    type-and-color.md           # per-vibe avoid + fresh option-sets (generated)
    craft-principles.md         # researched, cited craft rules (distilled)
```

`SKILL.md` carries the process + the slop test + pointers into `reference/`
(same pattern impeccable uses). The skill is self-contained markdown — portable,
zero runtime deps to *use*. Our repo's build scripts *generate* the data-backed
reference files; a consumer just reads them.

`name: personality`, description in the spirit of frontend-design ("give a page
real, page-specific personality; avoid generic AI aesthetics").

## 5. Skill anatomy

### 5a. The Creative Process (the heart of the skill)

A mandatory ordered phase before any code:

1. **Absorb** — purpose, audience, and crucially the *subject's world*: what is
   this page actually about? List concrete nouns, metaphors, materials, rituals,
   in-jokes from that world.
2. **Diverge** — brainstorm ~15 candidate "personality concepts," each tying a
   subject noun/metaphor to a UI moment. Cheap, fast, deliberately varied. Use
   `ultrathink` / high effort here.
3. **Ground & commit** — critique the 15, pick ONE cohesive direction with 2–3
   signature elements that reinforce each other. State the *one thing someone
   will remember*.
4. **Constrain** — restate the anti-patterns as hard constraints for this build.
5. **Build** — only now write code, executing the craft guardrails.

### 5b. Personality-move catalog (`reference/personality-moves.md`)

Not specific designs — *types* of signature moves the model instantiates from
the subject. Seed list (expand during build):

- physical-object metaphor for a control (pull-chain light = theme switch)
- a mascot/character that has a *reason* to exist on this page
- hand-annotation / marginalia / dashed pointer lines that explain or wink
- a custom cursor that *means* something in context
- a signature page-load gesture (one orchestrated reveal, not scattered)
- a subject-tied easter egg
- a tactile/skeuomorphic toggle or knob
- ambient motion tied to the theme (not decorative)
- a deliberately "wrong"/rule-breaking choice owned with confidence
- type-as-image: the wordmark/headline *is* the hero illustration

Each entry: what it is, when it earns its place, how to keep it craft-not-doodle.

### 5c. Slop manifest (`reference/slop-manifest.md`)

Merged, de-duplicated anti-patterns from three sources, organized by category
(typography, color, layout, motion, copy, general quality):

- **impeccable.style/slop** (49 rules) — the most complete public taxonomy.
- **frontend-design DON'Ts** (Anthropic + impeccable skills).
- **our own data tells** — `style.ts` detectors (aiPurpleGradient, gradientText,
  glassmorphism, pill buttons, tight tracking…) + the empirical slop signal
  (saturated fonts from `saturation.json`, modal slop palette from
  `palette-slop.json`), which give *quantified* backing ("Inter is on N% of
  crawled sites").
- uupm cited as corroboration ("even the popular design DB defaults to this").

Ends with the **AI-slop test**: "If you showed this and said 'AI made this,'
would they instantly believe you? If yes, that's the problem."

### 5d. Craft guardrails (`reference/craft-principles.md`)

Condensed, *researched and cited* rules (see §6) so distinctive never means
broken: type scale & hierarchy, spacing rhythm, contrast/WCAG, line length &
line-height, motion easing, when-not-to-card, alignment. Sourced from real
practitioner writing, distilled into terse DO/DON'T lines.

### 5e. Type & color grounding (`reference/type-and-color.md`)

Per-vibe **option sets**, generated from our data:

- **AVOID** = saturated fonts (`saturation.json`) + modal slop palette
  (`palette-slop.json`) for that vibe.
- **PICK FROM** = 6–10 fresh font directions + 3–4 palettes per vibe, drawn from
  `escape-directions.json` + fresh `font-neighbors` + the 2067-font index,
  filtered free-commercial.

**Anti-convergence rule (decision note):** the user chose "prescribe top picks
per vibe" over a wide undirected pool. To honor that *and* avoid minting the next
Inter (impeccable explicitly warns "NEVER converge on Space Grotesk"), each vibe
is an **option set with an explicit rule**: *pick the one that fits THIS page's
concept; rotate across builds; never default to the first listed; step outside
the set when the concept demands it.* Concrete enough to ground the model, plural
enough to avoid a new monoculture.

## 6. Taste seeding — research pass + distill

A focused deep-research pass (its own build task) over real practitioner sources,
distilled into `reference/craft-principles.md` with citations. Candidate sources:
Refactoring UI, design writing from Linear / Vercel / Stripe / Anthropic, and a
few named practitioners' essays. Output = terse, cited DO/DON'T principles — not
long quotes. This is what gives the model *seeded taste* rather than vibes.

## 7. How the existing project feeds the skill

A generator `scripts/build-personality-skill.mjs` reads our data
(`saturation.json`, `palette-slop.json`, `escape-directions.json`,
`font-neighbors.json`, `fonts.index.json`, `crawl-profiles.json`) and emits
`reference/slop-manifest.md` (data-tell section) and `reference/type-and-color.md`.
The prose parts of the manifest (impeccable/frontend-design rules) and the
researched craft file are authored/curated, checked in, and not overwritten by
the generator. Re-run the generator when data changes.

The `diagnose` CLI and the font/color engine **stay** — they become the *audit*
companion to the *generation* skill, and the data backing for §5e.

## 8. The proof ("improve the design, actually")

A `viz/personality-demo/` before→after: the same brief rendered (a) as the
generic AI archetype, and (b) run through the `/personality` process. This is the
validation that the skill changes output, not just a document. At least one
worked example committed.

## 9. Verification

- A test asserts `SKILL.md` + every `reference/*.md` exist and are non-empty, and
  that the process phase, slop test, and per-vibe tables are present.
- A consistency check: no font/palette in a PICK-FROM set is itself above the
  slop cutoff (no self-contradiction).
- The skill is dry-run usable: invoking it on a sample brief produces the ideation
  phase before code (manually verified on the demo).

## 10. Non-goals

- Not rebuilding impeccable's 18-skill suite.
- Not an LLM at `diagnose` runtime (diagnosis stays deterministic).
- Not scraping uupm's data as fresh material (anti-pattern reference only).
- Not auto-generating *new* fonts/colors; we select from real, licensed ones.

## 11. Risks

- **Convergence** — mitigated by the option-set + rotation rule (§5e); revisit if
  outputs still cluster.
- **"Personality" is subjective** — mitigated by subject-grounding (it must come
  from the page's own world) and the craft guardrails (so it's never just noise).
- **Over-long skill** — keep `SKILL.md` tight; push detail into `reference/`.

## 12. Build phases (detail comes from writing-plans)

1. Scaffold `skills/personality/` + `SKILL.md` skeleton (process + slop test +
   pointers).
2. Author `personality-moves.md` and the prose slop manifest.
3. Deep-research pass → `craft-principles.md` (cited).
4. Generator `build-personality-skill.mjs` → data-tell manifest +
   `type-and-color.md`.
5. Wire everything; tighten `SKILL.md`.
6. Before→after demo in `viz/personality-demo/`.
7. Tests + consistency check.
