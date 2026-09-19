# viz/layout-embeddings

Prototype for a **hybrid visual + genome layout-retrieval index**: given a
query site, find the most similar layouts by fusing a DINOv2 visual embedding
of the full-page screenshot with a structural "genome" vector. This directory
is where that fusion was designed and sanity-checked; the winning vectorizer
(`genome-vector.mjs`) graduated into production and is now imported directly
by `apps/engine/retrieval.mjs` (see status column below and the note at the
bottom of this file).

## Pipeline order

1. `select_sample.py` / `make_all_hosts.py` — pick which hosts to embed.
   Reads `data/layout-crawl/layout-genome-manifest.v3.ndjson` (gitignored,
   not tracked) and screenshots on disk; writes `sample-hosts.json` (~50
   hosts) or `all-hosts.json` (all hosts with a screenshot).
2. `embed_layout.py` — embeds each host's full-page screenshot with DINOv2
   (`torch.hub`, frozen ViT-S/14) under two crop strategies ("top" viewport,
   "tiled" mean-pool). Requires `torch`, `numpy`, `PIL`, and the untracked
   screenshot corpus at `data/layout-crawl/screenshots/`. Writes the
   `layout-visual-embeddings*.json` files (see below).
3. `genome-vector.mjs` — vectorizes the structural `LayoutGenome` (z-scored
   numeric fields + one-hot alignment + role histogram/bigram). This is the
   **production** vectorizer, reused verbatim by `apps/engine/retrieval.mjs`
   and `apps/engine/scripts/build-retrieval-index.mjs`.
4. `hybrid_fusion.mjs` — late-fusion sketch: weighted cosine of visual +
   genome vectors at a few weightings, printed and written to
   `hybrid-fusion-report.json`. Prototype only, not wired into production.
5. `build-layout-neighbors.mjs` — builds the fused nearest-neighbor index
   (`layout-neighbors.hybrid.json`) from `layout-visual-embeddings.full.json`
   + the genome corpus.
6. `query_nn.mjs` / `validate-layout-neighbors.mjs` — ad hoc sanity checks
   over the built index; write `nn-report.json` / `layout-neighbors-validation.json`.

## Scripts (one line each)

- `select_sample.py` — pick ~50 representative hosts for the small prototype; writes `sample-hosts.json`.
- `make_all_hosts.py` — list every host with a screenshot on disk; writes `all-hosts.json`.
- `embed_layout.py` — DINOv2-embed screenshots (top/tiled strategies); writes `layout-visual-embeddings*.json`.
- `genome-vector.mjs` — **production** LayoutGenome → vector (z-score + one-hot + role histograms); also imported by `apps/engine`.
- `hybrid_fusion.mjs` — prototype: weighted visual+genome cosine fusion, a few weightings; writes `hybrid-fusion-report.json`.
- `build-layout-neighbors.mjs` — builds the hybrid nearest-neighbor index; writes `layout-neighbors.hybrid.json`.
- `query_nn.mjs` — prints/writes top-5 NN per query host under each visual strategy; writes `nn-report.json`.
- `validate-layout-neighbors.mjs` — prints/writes top-5 NN under genome-only/visual-only/hybrid; writes `layout-neighbors-validation.json`.

## Data files — why each ~15MB of JSON is tracked

All four large derived JSON files below are produced by `embed_layout.py`,
which requires `torch` + DINOv2 + the **untracked** screenshot corpus
(`data/layout-crawl/screenshots/`, gitignored). None of them can be
regenerated from tracked files alone in a fresh checkout, so they are kept
tracked (not moved to `.gitignore`) even though none of them is read by
`npm test`, `npm run build`, or `.github/workflows/ci.yml` (verified by
grepping the whole repo, `apps/engine/scripts`, `scripts/`, and
`.github/workflows/ci.yml` — none of these paths reference the file names
below).

| File | Size | Read by |
|---|---|---|
| `layout-visual-embeddings.full.json` | 9.2 MB | `build-layout-neighbors.mjs` (`VISUAL_PATH`); referenced as `visualSource` metadata inside `layout-neighbors.hybrid.json` |
| `layout-visual-embeddings.gallery.json` | 3.8 MB | Not read by any script; referenced only as a metadata path string (`visualEmbeddings`) inside `data/layout-crawl/archetype-proposals.gallery.v1.json` / `.v2.json` — those files don't programmatically load it either. Kept tracked anyway: same DINOv2/untracked-screenshots regeneration dependency as the others. |
| `layout-neighbors.hybrid.json` | 1.8 MB | Not read by any other tracked script (it's the *output* of `build-layout-neighbors.mjs`, consumed only by a human via `query_nn.mjs`-style ad hoc inspection). Kept tracked: it's the only record of what the hybrid index actually looked like, and regenerating it needs `layout-visual-embeddings.full.json` + the genome corpus (itself gitignored under `data/layout-crawl/`). |
| `layout-visual-embeddings.json` | 364 KB | `hybrid_fusion.mjs`, `query_nn.mjs` (both `readFile` it directly) |

Small generated reports (`nn-report.json`, `layout-neighbors-validation.json`,
`hybrid-fusion-report.json`, a few KB each) are also tracked; they're cheap
and are the only durable record of a given script run's output.

**Nothing was removed under task 7.** No file in this directory is read by
nothing — the four big ones either have a direct reader in this directory or
are needed to regenerate outputs that do, and all four require the untracked
screenshot corpus + torch to reproduce, so none qualified for
`git rm --cached` + `.gitignore` under the "only if read by nothing" rule.

## Production dependency

`genome-vector.mjs` is imported **verbatim** by:
- `apps/engine/retrieval.mjs`
- `apps/engine/retrieval.test.mjs`
- `apps/engine/scripts/build-retrieval-index.mjs`

Per the task brief for this pass, another agent is concurrently converting
this file into a re-export of a new `apps/engine/genome-vector.mjs` — it was
**not** touched here.

## Superseded

`genome_vec.mjs` (rough, unnormalized stand-in vectorizer) has been deleted;
`hybrid_fusion.mjs` now imports `genome-vector.mjs` instead (`genomeVector`/
`cosine`, fit once via `fitGenomeCorpus` over the genome corpus, in place of
the old `genomeVec`/`cos`). `hybrid-fusion-report.json` was regenerated
against the new vectorizer as part of that change (its two required inputs —
`data/layout-crawl/layout-genome-manifest.v3.ndjson` and
`layout-genomes.v3.ndjson` — are gitignored but happened to be present on the
machine that made this change; run `node viz/layout-embeddings/hybrid_fusion.mjs`
again yourself if you have that data locally and want to refresh it, since a
fresh checkout without it can't). The report's fused-similarity numbers now
differ from the old `genome_vec.mjs`-based run — that's the expected effect
of switching to the normalized/weighted production vectorizer, not a bug.
