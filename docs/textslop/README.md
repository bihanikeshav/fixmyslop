# TextSlop docs

Documentation for the text side of fixmyslop — the `fixmyslop-humanizer` skill and
`TextSlopBench`. Start with the **[benchmark card](TEXTSLOPBENCH_CARD.md)** and the
**[metrics glossary](METRICS_GLOSSARY.md)**.

## Map

- **Benchmark & metrics** — [TEXTSLOPBENCH_CARD.md](TEXTSLOPBENCH_CARD.md),
  [METRICS_GLOSSARY.md](METRICS_GLOSSARY.md), [FROZEN_100.md](FROZEN_100.md),
  [BENCHMARK_FREEZE.md](BENCHMARK_FREEZE.md)
- **Datasets & licensing** — [DATASET_ADAPTER_PLAN.md](DATASET_ADAPTER_PLAN.md) (the
  licensing record), [DATASET_EVAL_RESULTS.md](DATASET_EVAL_RESULTS.md),
  [TETRA_SEL.md](TETRA_SEL.md)
- **Human-edit grounding** — [HUMAN_EDIT_GROUNDED.md](HUMAN_EDIT_GROUNDED.md),
  [HUMAN_EDIT_PROPENSITY.md](HUMAN_EDIT_PROPENSITY.md),
  [ANNOTATION_PRIORITY.md](ANNOTATION_PRIORITY.md), [SPAN_VALIDATION.md](SPAN_VALIDATION.md)
- **Method & analysis** — [EDIT_BUDGET.md](EDIT_BUDGET.md), [POLICY_SMOKE.md](POLICY_SMOKE.md),
  [COVERAGE_GAP.md](COVERAGE_GAP.md), [VOICE_DRIFT.md](VOICE_DRIFT.md),
  [DONOHARM_EVAL.md](DONOHARM_EVAL.md), [FAILURE_ANALYSIS.md](FAILURE_ANALYSIS.md)
- **v2 / v2.1 lineage** — [V2_BASELINE.md](V2_BASELINE.md),
  [V2_CONFIRMATION_PREREG.md](V2_CONFIRMATION_PREREG.md), [V2_1_FINDINGS.md](V2_1_FINDINGS.md),
  [V2_1_STAGE1.md](V2_1_STAGE1.md), [RESEARCH_REGISTRY.md](RESEARCH_REGISTRY.md)

## Notes on links

- Links into `../../textslopbench/results/*` point at **generated** artifacts (eval
  outputs, cached runs). `results/` is gitignored, so those resolve only after you run the
  benchmark locally. The committed, always-present inputs are under
  `../../textslopbench/manifests/` (ID-only frozen subsets) and `../../textslopbench/fixtures.jsonl`.
- A few docs reference earlier iteration/scaffolding notes that were **not** carried into
  this public repo; they remain in the private research archive. Such links may dangle here.
