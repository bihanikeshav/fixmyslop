# scripts/

Flat folder of build, data, proof and QA scripts. Run everything from the repo root.
Python scripts need `pip install -r scripts/requirements.txt` (torch etc. — only for the
embedding work). Most data scripts read/write the gitignored `data/` tree.

## Build and CI (safe to run any time)

| Script | Does |
|---|---|
| `build-web.mjs` | Compile `apps/web/demo/*.jsx` + engine runtime into `apps/web/build/` (`npm run build:web`) |
| `check-web-build.mjs` | Smoke-check that build output and referenced assets exist (`npm run test:web`) |
| `build-skill.mjs` | Regenerate `skills/fixmyslop/**` from `apps/engine/prompts.mjs` + `reference.mjs`. Idempotent. |
| `build-personality-skill.mjs` | Regenerate `skills/personality/reference/type-and-color.{md,json}` and the data block in `slop-manifest.md` from the font index. Needs `data/`. |
| `check-repo-hygiene.mjs` | CI gate: no stray images, no file > 50 MiB, no credential-shaped filenames |
| `verify-live-mcp.mjs [origin]` | Probe the deployed Worker's MCP endpoint (network) |

## Engine data bundles (write to `apps/engine/data/`, which IS tracked)

| Script | Does |
|---|---|
| `build-service-bundle.mjs` | Freeze corpus / brands / fonts / font-space into fs-free JSON for the Worker and browser |
| `build-font-runtime.mjs` | Build `font-runtime.v1.json` (loadable faces per font) from the index + font cache |
| `../apps/engine/scripts/build-retrieval-index.mjs` | Build `retrieval-index.v1.json` from the layout genome corpus |

## Font index enrichment (order matters; all need `data/fonts.index.json`)

1. `fetch-fontshare.py`, `fetch-velvetyne.py`, `fetch-uncut-github.py` — fetch libre foundry fonts (network) → `data/external/*/families.json` + `data/fonts-cache/`
2. `packages/pipeline` `integrate-fontshare.ts` — merge them into the index (licence-checked)
3. `extend-personality.mjs` → `extend-personality-metrics.mjs` — fill personality vectors (vibe-derived, then metric-derived)
4. `embed_visual.py` — DINOv2 glyph embeddings; `import-fontjoy.mjs` / `build-visual.mjs` are the older embedding routes
5. `build-neighbors.mjs` → `build-hybrid-neighbors.mjs` — k-NN closeness index (feature, then feature+visual)
6. `build-projection.py` — UMAP map → `viz/font-projector.html`

Helpers: `probe-gf.mjs` (check Google Fonts metadata shape), `list-font-candidates.mjs`,
`inspect-quality.mjs`.

## Slop / saturation signal

| Script | Does |
|---|---|
| `process-slop.mjs`, `merge-matrix.mjs` | Turn collected LLM "default font" runs into `slop-matrix.json` + synthetic saturation |
| `merge-saturation.mjs`, `rebuild-saturation.mjs` | Blend synthetic (0.6) and crawl (0.4) saturation; rebuild idempotently |
| `build-vibe-recs.mjs` | Per-vibe fit-and-fresh recommendations |
| `process-palette.mjs` | Palette-slop summary → `data/palette-slop.json` |
| `escape-analysis.mjs`, `process-escape.mjs`, `anti-slop-report.mjs`, `analyze-demo.mjs` | One-off analyses/reports over the matrix |

## Demos

`demo.mjs` (core on sample data), `demo-real.mjs` (core on the real index),
`gen-blob-preview.mjs` (genome → low-fi direction preview), `regen-demo-genomes.mjs`.

## Proof pages and visual QA (Playwright; output under `data/tmp/`)

`build-*-proof(s).mjs` generate proof pages from engine output; the matching
`capture-*.mjs` serve and screenshot them; `render-qa-sweep.mjs` runs geometric QA at
several viewport sizes. Screenshots must not be committed — keep them in `data/tmp/` or `.scratch/`.
