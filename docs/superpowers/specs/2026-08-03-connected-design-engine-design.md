# Connected design engine — intent, StyleGenome, LayoutGenome (design)

Date: 2026-08-03
Status: design (approved direction; pending user review of this doc)

Companion research (data/collection contracts, frozen):
- `docs/research/2026-08-03-intent-style-layout-space-spec.md`
- `docs/research/2026-08-03-competitive-skills-and-engine-audit.md`
- `docs/research/2026-08-03-current-data-inventory.json`

This document is the **implementation architecture** the research spec deliberately
left out (its non-goals: "do not write prompts, this is representation not
implementation"). It defines what we build **now**, the contracts between
subsystems, and the clean hand-off line to the data/crawl work (owned separately).

---

## Goal

Turn the engine from four independent recommenders (font / palette / layout /
material) into one **connected loop**: resolve a single coherent *genome* from
intent, then retrieve every layer compatible with it, with provenance and bounded
variation. This is the fix for "refined, not gorgeous" — it is a systems gap, not a
prompt gap.

## Architecture principle

> **The LLM does the semantics. The engine does the math and the memory.**

The calling agent (Claude / Cursor) is the only component that reads free text and
assigns meaning. The engine never guesses meaning — it **validates, grounds,
retrieves, and remembers**. This keeps the "no-AI, pure-math" tag intact and puts
parsing where it is already strong.

```
brief (free text)
   │  [agent parses — semantics]
   ▼
StyleIntent (semantic fields)
   │  [engine: resolve_intent — clamp, priors, contradiction flags]  ← pure math
   ▼
StyleGenome  ◄── diversity memory (recent fingerprints)
   ├─ font pairing      (neighbor retrieval + readability filters)
   ├─ palette + contrast (existing OKLCH corpus engine)
   ├─ layout family      (LayoutGenome retrieval)
   └─ material slots     (radius/shadow/border math, attached to hierarchy nodes)
   ▼
rendered candidate → [deferred: render QA + slop/quality feedback]
```

## Scope of THIS pass

**In (build now — needs no crawl data):**
1. `StyleIntent` schema + `resolve_intent` deterministic validator + surface/job priors table.
2. `StyleGenome` resolver: connects the layers, emits provenance, computes the fingerprint + diversity penalty.
3. `LayoutGenome` schema + a hand-authored **seed library of ~15 interpretable families** (Fable-assisted) + `suggest_layout` retrieval/composition contract.
4. Font-neighbor **retrieval** wired into the live engine (new `font-space` bundle from `build-service-bundle.mjs`; replaces the catalogue-heuristic path for pairing).
5. New MCP tools + REST mirror + tests for all of the above; skill prompts updated to fill `StyleIntent` and read the genome.

**Out (owned by the data/crawl track — "Luna"):**
- The extended crawl (geometry, DOM hierarchy, semantic sections, text roles, responsive transforms, screenshots).
- The positive-quality labeled set and the slop labeled set with provenance.
- A learned layout embedding (added later as a *re-ranker*, never the sole representation).
- Prompt-generation rewrites beyond wiring the new intent/genome flow.

The interpretable genome and hand-authored family library are the **bridge** that
makes the generator work today; the crawl later validates prevalence, expands the
library, and supplies the labels + embedding inputs.

---

## Subsystem 1 — Intent detection → `StyleIntent`

**Mechanism (approved): agent fills, engine validates.** The skill hands the agent
the `StyleIntent` schema and a short filling rubric; the agent produces the object.
The engine's `resolve_intent` is pure math.

`StyleIntent` schema — reuse the research spec (§StyleIntent) verbatim: `surface`,
`job`, `audience[]`, `contentModel`, plus continuous dials in `[0,1]`: `trustLevel`,
`contentDensity`, `energy`, `warmth`, `formality`, `era`, `craft`, `experimentalism`,
`motionIntensity`, `layoutVariance`, `materiality`, `contrastPreference`; plus
`theme`, `references[]`, `variation` (int), `seed` (nullable). The original free-text
brief is preserved on the object (`sourceBrief`) — **intent is never reduced to
`hash(intent)`**; the semantic fields survive downstream.

`resolveIntent(intent)` — deterministic, returns `{ intent: normalized, seed, warnings[] }`:
1. **Clamp** every dial to `[0,1]`; coerce types; default `theme` to `"light"`.
2. **Fill gaps from a surface+job priors table.** Any dial the agent left null is
   filled from a lookup keyed by `(surface, job)`. Examples the table encodes:
   `dashboard/monitor` → high `contentDensity`, low `motionIntensity`, high
   `contrastPreference`; `landing/explain-and-convert` → mid density, higher
   `energy`/`experimentalism`; `docs/long-form` → low density-of-chrome, high
   `craft`, high readability. The priors are a small hand-authored constant, not a
   model.
3. **Contradiction flags** → `warnings[]` (do not hard-fail): e.g. `craft>0.8` with
   `era<0.15` and `experimentalism>0.85`; `contentDensity>0.8` with
   `motionIntensity>0.7`; `theme:"dark"` with `contrastPreference<0.3`. Warnings ride
   into the genome so the agent can explain or reconsider.
4. **Seed**: if `intent.seed` is set, use it (reproducible). Else derive a seed from
   `variation` + a caller-supplied nonce (Worker may use a random nonce; engine stays
   pure — the nonce is an argument, never `Math.random` inside the engine).

Engine: `resolveIntent` in a new `apps/engine/intent.mjs`. Tool: `resolve_intent`.

## Subsystem 2 — `StyleGenome` resolver

`styleGenome(intent, { seed, recentFingerprints = [] })` → the resolved direction
(reuse research spec §StyleGenome shape). It **connects** the layers:

- **personality.axes** derived deterministically from the dials (e.g. `quiet-loud` from
  `energy`+`experimentalism`; `dense-breathing` from `contentDensity`; `warm-clinical`
  from `warmth`). This is the shared vector every layer reads.
- **type** ← font-neighbor retrieval (Subsystem 4), one display + one body, each with
  `featureDistance`/`visualDistance`/`overusePenalty`/`readabilityChecks`/`provenance`.
- **color** ← existing OKLCH corpus engine (`generatePalette`/`designSystem`), grounded
  by `warmth`/`energy`/`contrastPreference`/`theme`.
- **layout** ← `suggest_layout` (Subsystem 3): the chosen family's macro + section grammar.
- **material** ← existing radius/shadow/border math, but **material slots are attached
  to hierarchy-bearing nodes** from the layout family (`materialSlots`), never sprayed
  on every box. `materiality` dial sets restraint.
- **motion** ← `motion_tokens`, scaled by `motionIntensity`; `reducedMotion: "required"`.

**Provenance**: every decision carries its source (neighbor distance / corpus record /
rule / prior). This is what lets the strong agent *explain* a choice and lets us debug
bad output.

**Diversity memory + fingerprint.** A fingerprint is the tuple:
`{ fontPairIds, paletteCoords (OKLCH L,C,H buckets), layoutFamily, sectionOrderHash,
splitRatioBucket, radiusLanguage, shadowLanguage, accentStrategy, motionFamily }`.
The resolver accepts `recentFingerprints[]` (caller-held, stateless engine) and applies
a **diversity penalty** during each layer's selection so re-rolls of the same intent
diverge in *composition*, not just hue. `variation` sets the penalty strength /
sampling distance. Accessibility, readability, product `job`, and core constraints stay
**stable** across re-rolls (never penalized away).

Engine: `styleGenome` in `apps/engine/genome.mjs`. Tool: `style_genome`.

## Subsystem 3 — `LayoutGenome`

**Schema (interpretable first):** reuse research spec §LayoutGenome verbatim —
`pageKind`, `sectionGrammar[] {role, heightShare, focalPoint, composition}`, `macro
{contentWidthShare, columnCount, splitRatio, alignment, whitespace, contentDensity}`,
`hierarchy {focalAreaShare, headingScaleRatio, ctaProminence, contrastConcentration,
repetitionEntropy}`, `material {radius/shadow/border language, accentStrategy,
surfaceTexture}`, `responsive {mobileTransform}`, `quality {score, confidence,
provenance}`, `slop {score, matchedRules}`. The `macro` block is fed by the existing
deterministic `layout()` math (`apps/engine/system.mjs`), which already returns grid /
container / measure / margins / split.

**Family library metadata contract** (per research spec §layout generator contract):
each family carries `name`, `pageKind`, `whenToUse[]`, `notFor[]`,
`dialCompatibility {dial:[min,max]}`, `requiredContent[]`, `mobileTransform`,
`materialSlots[]`, `antiPatterns[]`, plus a default `sectionGrammar` and `macro`.
Provenance on seed families = `"hand-authored"`; the crawl later attaches prevalence
evidence and may promote/retire families.

**Seed set (~15 families, spanning page kinds, each replacing a slop default).** These
are the *slots*; Fable authors the full metadata + section grammar per family during
execution, against this schema:

| family | pageKind | replaces the default of… |
|---|---|---|
| asymmetric-proof-stack | product-with-proof | centered hero + equal 3-card row |
| hero-thesis-single | landing | headline + subhead + two buttons |
| contrast-band-flow | marketing | uniform white sections stacked |
| stacked-narrative-scroll | story/marketing | static feature list |
| split-marquee | landing/brand | centered logo + tagline |
| editorial-broadsheet | editorial/content | single centered column |
| sidebar-doc | docs/long-form | full-width prose |
| two-pane-reader | mobile-first/reading | desktop layout shrunk |
| instrument-console | dashboard/tool | card grid of KPIs |
| ledger-table | data/admin | styled cards hiding a table |
| app-shell-workbench | app | marketing chrome on a tool |
| spec-sheet | product/technical | prose describing specs |
| full-bleed-diagram | explain/technical | screenshot in a rounded card |
| gallery-mosaic | portfolio/visual | equal image grid |
| pricing-comparison | pricing | equal 3-tier cards, no emphasis |

**Retrieval + composition — `suggestLayout(intent, { recentFingerprints })`:**
1. Filter families by `pageKind` compatible with `intent.surface`/`job`/`contentModel`
   and by `dialCompatibility` (hard gate on `layoutVariance`, `contentDensity`).
2. Rank survivors by fit (dial distance) − overuse/diversity penalty (vs
   `recentFingerprints`) + novelty.
3. Return **several** candidates (not one), each a full LayoutGenome with provenance;
   the top is the default. Compose: family `sectionGrammar` + shared style/material
   genome + responsive/a11y transforms. `requiredContent` tells the agent what content
   the family needs; `antiPatterns` tells it what to avoid.

Engine: `suggestLayout` + the library in `apps/engine/layout-families.mjs`. Tool:
`suggest_layout` (supersedes the static `structure_ideas`, which stays as a thin alias
for back-compat).

## Subsystem 4 — Font retrieval (replace the catalogue heuristic)

**New bundle.** Extend `scripts/build-service-bundle.mjs` to emit `font-space.json`:
`{ [id]: { family, category, supplier, popularityRank, trendingRank, quality,
isFoundational, isBrandFont, metrics{...}, personality{...}, neighbors:[{id,sim}...topK] } }`,
sourced from `fonts.index.json` + `font-neighbors.json` (top-K, e.g. 24). Keep it
**separate** from `fonts.json` so the color-critical path stays lean; the engine
lazy-loads it only for retrieval. No runtime vector math — neighbors are precomputed;
metrics/personality are small per-font feature vectors for dial-matching.

**`retrieveFonts({ role, intent, like, exclude, n })`** →
`[{ family, role, featureDistance, visualDistance, overusePenalty, readabilityChecks,
neighbors, provenance }]`:
- **Hard readability filters** by `role`: body requires serif/sans + x-height/aperture/
  weight-count floors; display allows character. (Prevents the jayant.wtf failure —
  display serif recommended as body — structurally, not by heuristic luck.)
- **Fit score** = distance between font `personality`/`metrics` and the genome's
  personality axes; minus `overusePenalty` (popularity/trending bands, avoid-list,
  brand fonts); plus quality. `like` seeds retrieval from `font-neighbors` ("more like
  X"); `exclude` + diversity penalty avoid repeating recent pairs.
- Pairing: pick display + body from their pools with a **contrast** check between them
  (not the same family/feeling), preserving the existing "characterful display +
  readable body" rule.

`suggest_fonts` keeps its signature but routes through `retrieveFonts` when the
`font-space` bundle is present; otherwise falls back to the current catalogue path.

---

## New surface (tools + engine)

| tool (snake) | engine fn | module | returns |
|---|---|---|---|
| `resolve_intent` | `resolveIntent` | `intent.mjs` | normalized intent + seed + warnings |
| `style_genome` | `styleGenome` | `genome.mjs` | full StyleGenome w/ provenance + fingerprint |
| `suggest_layout` | `suggestLayout` | `layout-families.mjs` | ranked LayoutGenome candidates |
| `font_neighbors` | `retrieveFonts` | `engine.mjs` (+`font-space.json`) | ranked font candidates w/ distances |

All mirror to REST `/api/tool/<name>` (existing router in `index.mjs` needs no change —
it dispatches by `TOOL_BY_NAME`). `structure_ideas` → thin alias over `suggest_layout`.

## Skill / prompt wiring

- `explore` and `theme` prompts: first produce a `StyleIntent` (rubric embedded), call
  `resolve_intent`, then `style_genome` — the four `explore` directions become four
  genomes with **different layout families, font pairs, palettes, backgrounds** (bounded
  by the diversity fingerprint), each naming its centrepiece.
- `improve_design` / `design_review`: read the genome's `slop`/`quality`/provenance to
  target fixes.
- Skill index gains a one-line pointer to the intent rubric + genome flow. No prompt
  rewrites beyond wiring; the design-law gates are unchanged.

---

## Testing

- **`intent.test.mjs`**: clamping (out-of-range → [0,1]); priors fill (dashboard → high
  density); contradiction warnings fire; seeded reproducibility; free-text `sourceBrief`
  preserved.
- **`genome.test.mjs`**: same intent + same seed → identical genome (determinism); same
  intent + different `recentFingerprints` → different layout family / font pair / accent
  (variation is in composition, not just hue); provenance present on every layer;
  a11y/readability constraints stable across re-rolls.
- **`layout-families.test.mjs`**: every seed family validates against the schema; each
  has non-empty `whenToUse`/`notFor`/`requiredContent`/`antiPatterns`; `suggest_layout`
  filters by pageKind + dialCompatibility and returns ≥2 candidates; a dashboard intent
  never returns a centered-hero landing family.
- **font retrieval**: body role never returns a display-only face; `like` returns the
  precomputed neighbors; overused/avoid/brand fonts penalized; bundle-absent fallback
  still works.
- **bundle**: `build-service-bundle.mjs` emits `font-space.json` with metrics +
  neighbors; `wrangler deploy --dry-run` bundles clean.
- Existing suites stay green.

## Success criteria (from research spec, made testable here)

- Same intent + seed → reproducible genome; unseeded/re-rolled → varies in composition,
  not just color (asserted via fingerprint divergence).
- Font choices come from visual/feature neighbors and pass role readability filters.
- Layout choice explains its page job + required content; material is restrained
  (slots on hierarchy nodes only).
- Every major choice carries inspectable provenance.
- No new fashionable-cliché monoculture (diversity penalty across a batch of the same
  brief).

## Explicit non-goals (this pass)

- No extended crawl, no positive/slop labeled corpus, no learned embedding, no
  render-acceptance loop — those are the data track's deliverables and plug into these
  contracts later (embedding = re-ranker; labels = family prevalence + slop scores).
- No prompt rewrites beyond wiring the intent/genome flow.
- The hand-authored families are a bridge, not a claim of a learned layout corpus.
