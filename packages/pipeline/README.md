# @fixmyslop/pipeline

Ingestion: builds the font index (Google Fonts metadata + real glyph metrics +
personality attributes + external foundries) and the saturation signals that
`@fixmyslop/core`'s recommender scores against. All scripts are plain Node/tsx
CLIs, run individually, each reading and rewriting JSON under the repo's
`data/` directory (resolved relative to `import.meta.url`, not
`process.cwd()`, so scripts work regardless of the invoking directory).

## Scripts

Run with `npm run <script> -w @fixmyslop/pipeline`, or `npx tsx src/<file>.ts`
from this package directory.

| script        | file                       | reads                                                    | writes |
|---------------|----------------------------|-----------------------------------------------------------|--------|
| `index`       | `build-index.ts`           | Google Fonts metadata endpoint (network, keyless)          | `data/fonts.index.json`, `data/saturation.seed.json` |
| `metrics`     | `extract-metrics.ts`       | `data/fonts.index.json`, font TTFs (network)                | `data/fonts.index.json` (in place: real `xHeightRatio`/`strokeContrast`/`counterSize`/`charsetCompleteness`, recomputed `quality`) |
| `personality` | `seed-personality.ts`      | `data/fonts.index.json`, `data/odonovan/estimatedAttributes.csv` (downloaded on first run) | `data/fonts.index.json` (in place: real `personality`, recomputed `quality` including the attribute vote) |
| `fontshare`   | `integrate-fontshare.ts`   | `data/fonts.index.json`, `data/external/*/families.json`, `data/fonts-cache/*.ttf` | `data/fonts.index.json` (appends new, licence-allowlisted fonts) |
| `synthetic`   | `sample-synthetic.ts`      | `ANTHROPIC_API_KEY` (network), `data/observations.synthetic.json` (merge mode) | `data/observations.synthetic.json` |
| —             | `sample-gpt.ts`            | `OPENAI_API_KEY` (network), `data/observations.gpt.json` (merge mode) | `data/observations.gpt.json` |
| `build`       | `tsc`                      | —                                                           | `dist/` |
| `typecheck`   | `tsc --noEmit`             | —                                                           | — |
| `test`        | `vitest run`                | —                                                           | — |

There's a natural build order: `index` -> `metrics` -> `personality` ->
`fontshare`, then the observation samplers whenever you want a fresh
saturation signal. `build-index.ts` is the only script that talks to the
network unconditionally; `extract-metrics.ts` and `integrate-fontshare.ts`
fetch/read font files; the two samplers skip cleanly (exit 0) when their API
key env var isn't set.

## Data flow

- **`fonts.index.json`** is the Brain's font universe — an array of
  `IndexedFont` (a `@fixmyslop/core` `FontRecord` plus provenance:
  `popularityRank`, `metricsReal`, `personalityReal`, `quality`, ...). Every
  script above except the two samplers reads-and-rewrites this one file in
  place.
- **`observations.*.json`** files (`observations.synthetic.json`,
  `observations.gpt.json`, plus crawl/community ones produced elsewhere) are
  arrays of `@fixmyslop/core` `Observation` — role-tagged, window-tagged
  sightings that `computeSaturation()` merges into `SaturationStat`s.
  `sample-synthetic.ts` / `sample-gpt.ts` **accumulate** across runs by
  default: each run loads the prior file, ages every existing window by one
  (`window -> window + 1`), and prepends the new run as window 0 (see
  `src/observations-merge.ts`), bounded to `MAX_WINDOWS` windows. Pass
  `--fresh` to either script to restore the old "overwrite the file every
  run" behaviour.
- **`saturation.seed.json`** is a one-time seed (GF popularity as a body-role
  baseline); display saturation starts at 0 and is filled in by the
  observation signals above, downstream of this package.

## Testing

```bash
cd packages/pipeline
npx vitest run
```

Most tests here exercise this package's own pure functions
(`sources/odonovan.ts`, `sources/gfonts.ts`, `integrate-fontshare.ts`,
`observations-merge.ts`, `signals/openai.ts`, `signals/synthetic.ts`).

Three files are **repo-level integration tests parked in this package**
because this is where `npx vitest run` already executes in this repo (there's
no vitest runner configured for `viz/` or `skills/`), not because their
subject matter belongs here:

- `api.test.ts` and `color-density.test.ts` exercise `viz/personality-test/`
  (the build-time JS API and color model).
- `personality-skill.test.ts` validates `skills/personality/`.

Don't move them without wiring up a runner in their owning directory first,
and coordinate with whoever owns `viz/`/`skills/` — this package does not own
that code.

## Known limitations

- **`apertureOpenness` is unmeasured for every font this pipeline produces.**
  `sources/gfonts.ts`, `extract-metrics.ts`, and `integrate-fontshare.ts` all
  write `apertureOpenness: null` (or leave it untouched, in
  `extract-metrics.ts`'s case) rather than a fabricated value — see
  `../core/README.md` for why. **`data/fonts.index.json` needs a full rebuild**
  (`index` -> `metrics` -> `personality` -> `fontshare`) to purge any
  hard-coded `0.5` placeholders written by older versions of this pipeline;
  there's no way to distinguish an old fake `0.5` from a real one after the
  fact, so a partial/incremental fix is not possible.
- **Licence enforcement is allowlist-based and best-effort.**
  `integrate-fontshare.ts` skips (and logs) any font whose `license` field
  doesn't normalize to one of `LICENSE_ALLOWLIST` (OFL/SIL OFL, Apache-2.0,
  ITF Free Font License, CC0, MIT, UFL). It trusts `families.json`'s license
  string, so a source that mislabels its own licence will still be skipped
  only if the mislabel isn't itself on the allowlist — it does not fetch or
  verify licence text.
- **The three-vote quality blend needs personality data to include the
  attribute vote.** `seed-personality.ts` recomputes `quality` via
  `compositeQuality({ objective, attribute })` once real O'Donovan attributes
  land; fonts that never match the O'Donovan study set keep
  `personalityReal: false` and only ever get the objective vote (the curation
  and LLM votes aren't wired up by any script in this package yet).
