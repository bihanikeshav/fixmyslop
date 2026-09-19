# viz/

Visualisation and dev-workshop scripts. **This directory is not throwaway** —
several files here are direct production dependencies, imported at build time
or by tests, not just used to make pictures. See the "Production
dependencies" section below before deleting or moving anything.

## Sub-folders and top-level files

| Path | What it is | Status | Regenerate |
|---|---|---|---|
| `font-projector.html` | UMAP map of raw DINOv2 font embeddings (slop fonts glow red) | prototype / dev-log artifact | `python scripts/build-projection.py` |
| `layout-embeddings/` | Hybrid visual+genome layout-retrieval prototype (DINOv2 screenshot embeddings + structural genome vectors, fused NN search) | mixed — see its own README | see `viz/layout-embeddings/README.md` |
| `personality-demo/` | Two-file before/after showcase for the `/personality` skill | dev log / demo, static | not generated, hand-authored |
| `personality-test/` | The `/personality` skill's color model, structural-slop detector, build-time API, and informal A/B test logs | mixed — see its own README | see `viz/personality-test/README.md` |

### `personality-demo/`
- `README.md` — explains the before/after pair.
- `archetype-slop.html` — the generic-AI-hero baseline.
- `personality.html` — the same brief run through `/personality`.

Both are hand-authored, static demo artifacts; nothing regenerates them.

## Production dependencies (do not delete without updating these)

- `scripts/build-service-bundle.mjs` imports `viz/personality-test/color/corpus.mjs`.
- `packages/pipeline/src/api.test.ts` (vitest) shells out to `viz/personality-test/api.mjs` as a CLI.
- `packages/pipeline/src/color-density.test.ts` (vitest) imports
  `viz/personality-test/color/color-space.mjs` and `viz/personality-test/color/density.mjs`.
- `apps/engine/retrieval.mjs`, `apps/engine/retrieval.test.mjs`, and
  `apps/engine/scripts/build-retrieval-index.mjs` import
  `viz/layout-embeddings/genome-vector.mjs` verbatim as the production
  LayoutGenome vectorizer.
- `apps/engine/engine.mjs`'s color/font logic is a faithful port of
  `viz/personality-test/{color/*,api.mjs}` (not an import, but the two must
  be kept in sync by hand — see the comment at the top of `engine.mjs`).

None of these paths were changed in this pass except as documented in the two
sub-READMEs (`genome-vector.mjs` itself was explicitly out of scope — another
agent is converting it into a re-export of a new
`apps/engine/genome-vector.mjs`).

## Generated artifacts and derived data

`viz/layout-embeddings/` tracks ~15MB of DINOv2-derived JSON that cannot be
regenerated without the untracked screenshot corpus (`data/layout-crawl/screenshots/`,
gitignored) plus `torch`. Full evidence of what reads each file and why each
one stays tracked is in `viz/layout-embeddings/README.md`.

## Dev logs

`viz/personality-test/RESULTS*.md` are informal, unblinded, single-author dev
logs (each now carries a banner saying so). They are not a substitute for
`benchmarks/ui-skills/`, which is the blinded, multi-rater harness.
