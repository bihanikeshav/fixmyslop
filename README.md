# fixmyslop

fixmyslop is a mechanism-first design engine for agents and frontend teams. It turns a
real product brief into working behavior, materially different art directions, a
coherent implementation system, and inspectable evidence. Its deterministic checks
catch known failures; they are a safety floor, not a substitute for taste.

The repository also includes a fail-closed prose humanizer, TextSlopBench, a browser
demonstration, an MCP/REST worker, and a blinded comparative UI benchmark.

## What ships

- **Connected design engine** — normalizes messy briefs, models the product objects and
  actions, generates divergent realizations of the same mechanism, and emits a bounded
  build handoff.
- **Deterministic gates** — color, contrast, type roles and assets, layout, spacing,
  radii, shadows, motion, SVG safety, accessibility, component states, composition,
  microcopy, and information architecture.
- **`skills/fixmyslop/`** — the generated, staggered agent skill. It loads task-specific
  craft references on demand and requires a rendered desktop/mobile/input/reduced-motion
  revision loop before a result can claim to pass.
- **`skills/fixmyslop-humanizer/`** — bounded prose repair with anchor, claim-frame,
  fidelity, and clean-text preservation checks. When verification fails, it releases the
  source unchanged.
- **`textslopbench/`** — human-edit-grounded evaluation for useful intervention,
  clean-text preservation, and claim safety; detector scores are not treated as human
  quality.
- **`benchmarks/ui-skills/`** — opaque, seeded comparisons against Impeccable, Taste, or
  another system. Brief-specific behavior is a hard gate and needs an inspectable
  evidence artifact before visual ratings count.
- **`benchmarks/engine/`** — frozen semantic-routing checks across twelve subjects and
  three seeds; a missing mechanism, proof centrepiece, authored alternative, or readable
  type role fails before visual comparison.
- **`apps/web/` and `apps/worker/`** — the product demonstration and Cloudflare MCP/REST
  surface, both backed by the same pure engine.

## Quick start

Requires Node 20+ and Python 3.11+.

```bash
npm ci
npm test
npm run build
python -m pytest tests
```

Useful focused commands:

```bash
npm run test:apps                 # engine + worker contracts
npm run test:ui-bench             # comparative harness
npm run benchmark:engine          # 12 frozen semantic briefs x 3 deterministic seeds
npm run build:web                 # compile the browser demonstration
npm run test:web                  # production web smoke checks
node scripts/build-skill.mjs      # regenerate skill markdown from engine sources
node apps/engine/scripts/run-autonomous-cases.mjs
```

On Windows, `py -m pytest tests` is equivalent to the Python command above.

## Repository map

```text
apps/engine/                 pure deterministic and connected design engine
apps/worker/                 Cloudflare Worker: MCP, prompts, skill, and REST
apps/web/                    static interactive product demonstration
packages/core/               font quality, saturation, roles, and slop scoring
packages/pipeline/           font indexing and glyph-metric data pipeline
packages/crawl/              source collection and corpus derivation
skills/fixmyslop/            generated UI skill and craft references
skills/fixmyslop-humanizer/  prose revision skill and verification pipeline
textslopbench/               text evaluation runners and dataset adapters
benchmarks/ui-skills/        blinded functional + visual comparison protocol
docs/                        product, benchmark, research, and deployment notes
```

`apps/engine` is pure: the same inputs and seed produce the same output. The worker and
web application share that engine so their gates do not drift. The generated skill has
the same source of truth in `apps/engine/prompts.mjs` and `apps/engine/reference.mjs`;
edit those sources and run `node scripts/build-skill.mjs`.

## Text evaluation

TextSlopBench compares rewrites with human editing behavior and protects invariants such
as actors, polarity, modality, scope, temporal order, names, numbers, dates, URLs, and
quotations. External corpora are fetched locally and never committed when redistribution
terms are absent or unclear. Start with:

- [`docs/textslop/TEXTSLOPBENCH_CARD.md`](docs/textslop/TEXTSLOPBENCH_CARD.md)
- [`docs/textslop/METRICS_GLOSSARY.md`](docs/textslop/METRICS_GLOSSARY.md)
- [`docs/textslop/DATASET_ADAPTER_PLAN.md`](docs/textslop/DATASET_ADAPTER_PLAN.md)

## Comparative UI evaluation

The UI benchmark locks the brief, model, starting commit, time/turn budget, tool policy,
network policy, and desktop/mobile viewports. Missing behavior, accessibility, states,
or evidence fails closed before aesthetic scores are compared. Results must be reported
per brief and dimension; this repository does not turn a small frozen pack into a
universal superiority claim.

See [`benchmarks/ui-skills/README.md`](benchmarks/ui-skills/README.md).
The connected adapter's narrower semantic contract is separately documented in
[`benchmarks/engine/README.md`](benchmarks/engine/README.md).

## Deploy

The web demonstration deploys as static Cloudflare Pages content; the Worker exposes MCP,
prompt, skill, and REST endpoints. See [`apps/DEPLOY.md`](apps/DEPLOY.md) for the current
commands and endpoint catalog.

## Product contract

[`PRODUCT.md`](PRODUCT.md) records the audience, purpose, anti-references, design
principles, and accessibility baseline. The core standard is simple: a passing output
must work, must remain faithful to its subject, and must survive rendered inspection. A
token score or anti-pattern scan alone is never proof of design quality.

The reviewed X bookmark set is captured in
[`docs/research/2026-08-24-x-bookmark-design-audit.md`](docs/research/2026-08-24-x-bookmark-design-audit.md).
It records source mechanics and provenance as research inputs; the product regenerates
their useful relationships for the current brief instead of cloning any complete skin.

The final token and browser audit is in
[`docs/research/2026-08-24-ui-quality-audit.md`](docs/research/2026-08-24-ui-quality-audit.md).
