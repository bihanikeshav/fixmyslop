# Documentation index

Every tracked document, grouped by purpose. Status: **current** (describes the code as it
is), **reference** (research input, still valid), **historical** (dated plan/spec; the work
shipped or was superseded — read for rationale, not for instructions).

New here? Read [`../AGENTS.md`](../AGENTS.md) → [`../README.md`](../README.md) →
[`../PRODUCT.md`](../PRODUCT.md) → [`../DESIGN.md`](../DESIGN.md).

## Product and operations — current

| Doc | What it covers |
|---|---|
| [`../PRODUCT.md`](../PRODUCT.md) | Audience, purpose, anti-references, success bar |
| [`../DESIGN.md`](../DESIGN.md) / `../DESIGN.json` | Evidence Workbench design system for `apps/web` |
| [`../apps/DEPLOY.md`](../apps/DEPLOY.md) | Worker + web deployment, endpoint catalogue |
| [`../apps/INSTALL.md`](../apps/INSTALL.md) | Installing the MCP server / skill in agent clients |
| [`DATA-AND-LICENSING.md`](DATA-AND-LICENSING.md) | Where fonts, crawl data and text corpora come from; what may be committed |
| [`../CONTRIBUTING.md`](../CONTRIBUTING.md) | Workflow, test matrix, conventions |
| [`../archive/README.md`](../archive/README.md) | What was retired and why |

## Engine architecture

| Doc | Status | What it covers |
|---|---|---|
| [`superpowers/specs/2026-08-03-connected-design-engine-design.md`](superpowers/specs/2026-08-03-connected-design-engine-design.md) | current | Intent → StyleGenome → LayoutGenome design |
| [`research/2026-08-03-intent-style-layout-space-spec.md`](research/2026-08-03-intent-style-layout-space-spec.md) | current | The intent/style/layout spaces and their dials |
| [`research/layout-feel-spec.md`](research/layout-feel-spec.md) | reference | Layout "feel" dimensions |
| [`layout-explorer-spec.md`](layout-explorer-spec.md) | reference | Layout explorer tool spec |
| [`background-material-taxonomy.md`](background-material-taxonomy.md) | reference | Background/material vocabulary used by `background.mjs` |
| [`motion-interaction-taxonomy.md`](motion-interaction-taxonomy.md) | reference | Motion vocabulary used by `motion.mjs` |
| [`research/2026-08-11-skill-engine-hardening-plan.md`](research/2026-08-11-skill-engine-hardening-plan.md) | historical (done) | How skill `.md` ↔ `.mjs` drift was reconciled; `build-skill.mjs` is idempotent since |
| [`research/2026-08-03-current-data-inventory.json`](research/2026-08-03-current-data-inventory.json) | historical | Snapshot of data assets on 2026-08-03 |

## Research and audits — reference

| Doc | What it covers |
|---|---|
| [`design-research/README.md`](design-research/README.md) | Index of 22 craft essays (type, colour, layout, motion, components…) feeding the skills |
| [`design-research/distinctiveness/README.md`](design-research/distinctiveness/README.md) | Index of 15 notes on what makes a design non-generic |
| [`research/2026-08-03-competitive-skills-and-engine-audit.md`](research/2026-08-03-competitive-skills-and-engine-audit.md) | Comparison with Impeccable, Taste and other skills |
| [`research/2026-08-24-ui-quality-audit.md`](research/2026-08-24-ui-quality-audit.md) | Token + browser audit of `apps/web` (numbers are prose-only; no log attached) |
| [`research/2026-08-24-x-bookmark-design-audit.md`](research/2026-08-24-x-bookmark-design-audit.md) | Design findings from a reviewed bookmark set |
| [`slop-o-meter/design-reference.md`](slop-o-meter/design-reference.md) | Design reference for the Slop-o-meter demo — the demo itself is now in `archive/` |

## Text side (humanizer + TextSlopBench)

See [`textslop/README.md`](textslop/README.md) for the full index and the status of each
claim. Entry points: [`textslop/TEXTSLOPBENCH_CARD.md`](textslop/TEXTSLOPBENCH_CARD.md),
[`textslop/METRICS_GLOSSARY.md`](textslop/METRICS_GLOSSARY.md),
[`textslop/DATASET_ADAPTER_PLAN.md`](textslop/DATASET_ADAPTER_PLAN.md).

## Plans and specs — historical

Written for agent execution. Their `- [ ]` checkboxes were never ticked; **status below is
the truth, not the checkboxes.**

| Doc | Status |
|---|---|
| [`superpowers/specs/2026-06-03-fixmyslop-design.md`](superpowers/specs/2026-06-03-fixmyslop-design.md) | shipped (v1 product design; the Slop-o-meter part was later archived) |
| [`superpowers/specs/2026-06-05-personality-skill-design.md`](superpowers/specs/2026-06-05-personality-skill-design.md) + [`plans/2026-06-05-personality-skill.md`](superpowers/plans/2026-06-05-personality-skill.md) | shipped → `skills/personality/` |
| [`superpowers/specs/2026-08-03-design-engine-expansion-design.md`](superpowers/specs/2026-08-03-design-engine-expansion-design.md) + [`plans/2026-08-03-design-engine-expansion.md`](superpowers/plans/2026-08-03-design-engine-expansion.md) | shipped → `apps/engine/` (the skill it calls "atelier" shipped as `skills/fixmyslop/`) |
| [`superpowers/specs/2026-08-03-prompts-and-engine-hardening-design.md`](superpowers/specs/2026-08-03-prompts-and-engine-hardening-design.md) + [`plans/2026-08-03-prompts-and-engine-hardening.md`](superpowers/plans/2026-08-03-prompts-and-engine-hardening.md) | shipped → `apps/engine/prompts.mjs`, `/skill` routes |

## Code-adjacent READMEs

`apps/` (+ `engine/`, `worker/`, `web/`), `skills/`, `tests/`, `packages/core/`, `packages/pipeline/`, `packages/crawl/`, `scripts/`, `viz/`
(+ `layout-embeddings/`, `personality-test/`, `personality-demo/`), `benchmarks/`
(+ `engine/`, `ui-skills/`), `textslopbench/` (+ `experiments/`), `archive/`.
