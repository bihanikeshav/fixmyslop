# @fixmyslop/core

The deterministic "Brain": pure functions for font quality, personality
matching, role classification, saturation, recommendation, and slop scoring.
No I/O, no `Date.now()`, no randomness, no network calls — every function is
given all the state it needs (including "now", as a window index) and always
returns the same output for the same input. This is what makes the package
safe to unit-test exhaustively and safe for `@fixmyslop/pipeline` and any
consuming app to trust without re-deriving the logic themselves.

## Public API

Everything is re-exported from `src/index.ts`. By file:

- **`types.ts`** — the shared domain types: `FontMetrics`, `FontRecord`,
  `PersonalityVector` (+ `PERSONALITY_ATTRIBUTES` / `SHAIKH_FACTORS`),
  `SaturationStat`, `RecommendQuery`, `Recommendation`.
- **`util.ts`** — `clamp01` (clamp to `[0,1]`) and `clamp01OrMid` (same, but a
  non-finite input — e.g. a `0/0` division — maps to the neutral `0.5`
  midpoint instead of `0`). Both are exported for reuse; nothing in this
  package or `@fixmyslop/pipeline` should redefine a local `clamp01`.
- **`metrics.ts`** — `objectiveQuality(metrics)`: the deterministic
  legibility/craft score (vote 1 of 3, see `quality.ts`). `metricsFloorPass` /
  `metricsFloorFailures`: the hard quality gate that excludes fonts that are
  "rare because broken", not "rare because good".
- **`quality.ts`** — `compositeQuality(votes, weights?)`: blends up to four
  quality votes (`objective`, `attribute`, `curation`, `llm`), renormalizing
  over whichever are present so a missing vote never silently drags the score
  down. `attributeQualityVote(personality)`: derives vote 2 (the
  confidence/craft signal) from an O'Donovan-style personality vector — a
  vector with decisive, non-neutral ratings scores higher than a flat or empty
  one. Returns `undefined` (not `0`) when there's no personality data, so the
  vote is dropped rather than asserting "no character".
- **`personality.ts`** — `personalityMatch(target, font)`: cosine similarity
  over the 12-attribute vocabulary, 0..1.
- **`role.ts`** — `classifyRoles(elements)`: deterministic hero/body font
  extraction from rendered page elements (no LLM).
- **`saturation.ts`** — `computeSaturation(observations, config)`: merges
  weighted, recency-decayed sightings into a role-segmented saturation +
  trend per font. `MIN_TREND_EVIDENCE`: the minimum weighted evidence before
  `trend` can reach its full magnitude — see "Known limitations" below.
- **`recommend.ts`** — `recommend(candidates, query)`: the anti-inductive
  ranker (quality floor, foundational-font exclusion for display picks,
  freshness-scaled saturation penalty). Deterministic tiebreak by font id.
- **`slop.ts`** — `slopScore(input)`: the 0..100 Slop-o-meter score + verdict
  for a page's hero/body fonts.
- **`recommendations.ts`** — the "prescription" side: `diagnoseImprovements`,
  `suggestReplacements`, `classifyAccent`, plus the curated `FONT_GROUPS` /
  `FRESH_PALETTES` data.

## Data flow

This package reads and writes nothing on disk. It is a pure library:
`@fixmyslop/pipeline` scripts call into it while building `data/*.json`, and
any consuming app (e.g. `apps/engine`) calls into it at request time with data
loaded from those files. See `../pipeline/README.md` for what actually reads
and writes the on-disk index.

## Testing

```bash
cd packages/core
npx vitest run
```

Tests live in `src/core.test.ts` and `src/recommendations.test.ts`.

## Known limitations

- **`apertureOpenness` is often unmeasured.** No pipeline source currently
  computes real glyph-outline aperture openness (that's a later refinement to
  `extract-metrics.ts` in the pipeline package). Unmeasured fonts carry
  `apertureOpenness: null` in `FontMetrics` — never a fabricated placeholder
  value. `objectiveQuality()` renormalizes its weights to skip a `null`
  aperture, and `metricsFloorFailures()` skips the `minApertureOpenness` gate
  for it, so an unmeasured aperture affects neither the quality score nor the
  quality floor.

  **Rebuild required:** earlier index builds wrote a hard-coded `0.5`
  placeholder for every font's `apertureOpenness`, which is indistinguishable
  from a genuinely-measured `0.5` after the fact — there is no way to migrate
  old data safely. `data/fonts.index.json` must be rebuilt from scratch (the
  pipeline's `index` / `metrics` / `fontshare` scripts) for this field, and
  therefore `objectiveQuality`/the floor gate, to mean what they say.

- **`trend` needs a minimum amount of evidence.** A single low-weight sighting
  going from "unseen" to "seen once" is scaled down by a confidence factor
  (`MIN_TREND_EVIDENCE` in `saturation.ts`) rather than reported as a maximal
  (`1.0`) trend — see the tests in `core.test.ts` under "saturation trend:
  thin evidence can't fake a max trend".
