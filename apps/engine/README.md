# apps/engine

The pure, deterministic design engine. No `fs`, network, `Date.now` or `Math.random` in
any runtime module — data is injected through `createEngine()`, so the same code runs in
the CLI, the browser (`apps/web/build/`) and the Cloudflare Worker (`apps/worker`).
Same input + seed ⇒ byte-identical output. Tests are **node:test**:
`node --test "apps/engine/*.test.mjs"` (never vitest — it reports 0 tests and exits 0).

## Flow

```text
brief ─▶ intent.mjs ─▶ genome.mjs ──────────────▶ StyleGenome ─▶ spec.mjs / build-page.mjs
          StyleIntent    │ type+colour  engine.mjs                 (build-spec / HTML page)
                         │ layout       layout-families.mjs ─ perturb.mjs ─ retrieval.mjs
                         │ material     background.mjs
                         │ motion       motion.mjs
                         └ fingerprint  fingerprint.mjs ─ divergence.mjs
explore.mjs   = N divergent directions for one intent (the only path that perturbs layout)
connected.mjs = LIVE orchestrator the Worker calls; wraps the above and adds
                connected-v2.mjs enrichment (accent font, colour scene, texture, components)
```

## Modules

| File | Role |
|---|---|
| `engine.mjs` | `createEngine({corpus, brands, fonts})`: colour gates (`checkColor`, `checkPalette`, `nearestSafe`, `generatePalette` — OKLab KDE over the crawl corpus), font gates (`checkFont`, `suggestFonts`, `retrieveFonts`, pairing), `designSystem` / `auditSystem` |
| `system.mjs` | Closed-form design maths: type scale, spacing, radius, shadows + their audits |
| `ux.mjs` | Rule-based UX validators: microcopy, empty states, forms, a11y, component states, IA |
| `svg-guard.mjs` | Safety/quality gate for LLM-authored SVG (no scripts, handlers, external refs) |
| `intent.mjs` | Subsystem 1: validate/complete a `StyleIntent`; seeded hashing; shared `functionalScore` |
| `genome.mjs` | Subsystem 2: resolve one coherent `StyleGenome` with provenance + fingerprint |
| `layout-families.mjs` | Subsystem 3: hand-authored layout families, fit scoring, `suggestLayout` (single-shot = unperturbed best fit, by design) |
| `perturb.mjs` | 3b: seeded parametric layout perturbation + gates (`PERTURB_V1` draw order is append-only) |
| `background.mjs` / `motion.mjs` | Material and motion axes: taxonomy + slop gates (S1–S16 / M1–M16) + seeded perturbation |
| `fingerprint.mjs` / `divergence.mjs` | Distance between directions; per-axis divergence floors |
| `explore.mjs` | §4 explore wiring: `exploreDirections` with diversity memory and bounded rerolls |
| `retrieval.mjs` + `genome-vector.mjs` | Layout retrieval over `data/retrieval-index.v1.json`; `genome-vector.mjs` is the single vectoriser (`viz/layout-embeddings/genome-vector.mjs` re-exports it) |
| `role-aliases.mjs`, `section-purpose.mjs` | Section role canonicalisation; role → content purpose + centrepiece choice |
| `connected.mjs` | **Live entry point** (`connectedStyleGenome`, `connectedExploreDirections`, `connectedBuildSpec`, `deriveMechanismPlan`) |
| `connected-v2.mjs` | Enrichment sub-layer of `connected.mjs`. "v2" = the v2 research catalogues in `data/research/master-v2/`, not a replacement |
| `components.mjs`, `dashboard.mjs` | Component recipe selection; dashboard geometry + Fluid registry install plans |
| `spec.mjs`, `build-page.mjs` | Genome → Markdown build-spec; genome → one self-contained gate-passing HTML page |
| `prompts.mjs`, `reference.mjs` | **Source of truth for `skills/fixmyslop/`** and the MCP prompts. Edit here, then `node scripts/build-skill.mjs`. Inner backticks in `reference.mjs` bodies must be escaped |
| `cli.mjs` | `node apps/engine/cli.mjs <fn> [args]` offline front door |
| `font-pair-judgments.v2.json` | Curated font pair judgments |

## Data (`data/`, tracked)

`corpus.json` (colour points), `brands.json`, `fonts.json`, `font-space.json`,
`font-runtime.v1.json`, `retrieval-index.v1.json`. Frozen bundles produced by
`scripts/build-service-bundle.mjs`, `scripts/build-font-runtime.mjs` and
`scripts/build-retrieval-index.mjs`. They are imported at module load, so they must stay
tracked (see `.gitignore` exceptions).

## Scripts (`scripts/`, Node-only, never imported at runtime)

`build-retrieval-index.mjs` (offline index builder), `run-autonomous-cases.mjs` (end-to-end
case runner), `run-ab-cases.mjs` (core genome vs connected adapter A/B), `gen-4-directions.mjs`
and `haiku-val-gen.mjs` (emit build-specs for manual/LLM validation).

## Rules

- Changing output for an existing input + seed is a breaking change: update
  `benchmarks/engine/` deliberately and say so.
- Everything reachable from `apps/worker/src/tools.mjs` sees attacker-controlled input:
  bound loops, never throw raw, keep the memoisation caches bounded.
- Thresholds carry a comment naming the regression that set them. Keep that habit.
