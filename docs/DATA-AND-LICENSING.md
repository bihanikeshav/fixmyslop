# Data provenance and licensing

Code in this repository is licensed under Apache-2.0 (see `LICENSE`, `NOTICE`). That
licence covers our code and our own derived statistics. It does **not** relicense
third-party fonts, websites, texts or guides described below.

## What is committed vs local-only

| Data | Location | Committed? | Why |
|---|---|---|---|
| Frozen engine bundles (colour corpus points, brand colours, font metadata, font space, retrieval index) | `apps/engine/data/*.json` | yes | Required at import time; derived statistics and metadata only — no font files, no page content |
| Curated research spaces the engine imports | `data/research/master-v2/` (6 JSON + `INDEX.md`) | yes | Same reason |
| Everything else under `data/` (font index, TTF cache, crawl NDJSON, screenshots, scraped references, observations) | `data/` | **no** (gitignored) | Regenerable, large, and/or third-party content |
| Text corpora and benchmark run outputs | `textslopbench/data_raw/`, `textslopbench/results/` | **no** | Redistribution terms absent or unconfirmed |
| ID-only manifests and own synthetic fixtures | `textslopbench/manifests/`, `fixtures.jsonl` | yes | Contain no third-party text |
| Layout embedding dumps | `viz/layout-embeddings/*.json` | see `viz/README.md` | Derived vectors keyed by hostname |

## Fonts

Hard rule: the index only contains fonts that are **free for commercial use**, because a
recommender must never suggest something a user cannot legally ship.
`packages/pipeline/src/integrate-fontshare.ts` enforces a licence allowlist on ingest.

| Source | Licence | Fetched by |
|---|---|---|
| Google Fonts | OFL / Apache-2.0 / UFL per family | `packages/pipeline/src/sources/gfonts.ts` (keyless metadata endpoint) |
| Fontshare (Indian Type Foundry) | ITF Free Font License | `scripts/fetch-fontshare.py` |
| Velvetyne | OFL | `scripts/fetch-velvetyne.py` |
| Uncut.wtf (GitHub-hosted subset) | per-repo libre licences | `scripts/fetch-uncut-github.py` |

Not used: Adobe Fonts (EULA forbids extraction), DaFont-style aggregators (unclear terms).
Font binaries are cached locally in `data/fonts-cache/` and never committed.

Personality attributes come from O'Donovan, Lībeks, Agarwala & Hertzmann, *Exploratory
Font Selection Using Crowdsourced Attributes* (SIGGRAPH 2014). Fontjoy vectors
(`scripts/import-fontjoy.mjs`) are MIT (Jack000/fontjoy). Visual embeddings use DINOv2
(Apache-2.0, facebookresearch/dinov2).

## Crawled websites

The layout/colour/font corpus (~1,260 sites, seeded from AI-tool directories plus design
galleries) is analysed locally. We commit only aggregate statistics and derived feature
vectors. Raw HTML, screenshots and scraped prose (including `data/reference/getdesign/`)
are **local research material and must not be committed or redistributed**.

Crawler policy (implemented in `packages/crawl/src`): honest `fixmyslop/x.y` user agent,
robots.txt respected by default, public http(s) hosts only (no IP literals / private
hosts), bounded concurrency, images/media/fonts blocked. A site owner can ask for
exclusion via a GitHub issue.

## Text corpora (TextSlopBench)

See `docs/textslop/DATASET_ADAPTER_PLAN.md` for per-corpus status. Summary: LAMP — repo is
BSD-3-Clause, raw-text redistribution unconfirmed; Baumler — no licence file, not
publishable; Beemo / WQ — fetched locally per their terms. None are committed.

## Borrowed guidance in the skills

- `skills/fixmyslop-humanizer` builds on Wikipedia's "Signs of AI writing" (CC BY-SA 4.0).
- `skills/personality` and `skills/fixmyslop` credit impeccable.style, Anthropic's
  frontend-design skill and tasteskill.dev (Leonxlnx/taste-skill) inline where rules are borrowed.
