# TextSlop docs

Documentation for the text side of fixmyslop — the `fixmyslop-humanizer` skill and
`TextSlopBench`. Start with the **[benchmark card](TEXTSLOPBENCH_CARD.md)** and the
**[metrics glossary](METRICS_GLOSSARY.md)**.

Start with the dependency-free local gates:

```text
py textslopbench/local_benchmark_suite.py
```

This reports the identity/no-op baseline alongside the local humanizer, then runs
ClaimFlipBench (known claim mutations) and InterventionBench (edit-vs-preserve,
idempotence, and formatting/voice controls). See
[`../../textslopbench/README.md`](../../textslopbench/README.md) for scope and commands.

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

## Index (every doc, one line + status)

Status legend: **current** (live reference, not withdrawn), **superseded** (historical
record; conclusions withdrawn or overtaken — read for provenance, not as current guidance),
**erratum-bearing** (current or historical, but carries a correction notice at the top that
changes how to read its numbers). See also `../../textslopbench/README.md`'s "Status of
claims" box, which this index is consistent with.

| Doc | One line | Status |
|---|---|---|
| [ANNOTATION_PRIORITY.md](ANNOTATION_PRIORITY.md) | Annotation-derived edit-priority table + counterfactual E-gating simulation (LAMP). | current |
| [BENCHMARK_FREEZE.md](BENCHMARK_FREEZE.md) | The frozen-100 metric set definition. | erratum-bearing (2026-08-24 uncertainty erratum; item-level, not cluster-valid) |
| [COVERAGE_GAP.md](COVERAGE_GAP.md) | FixMySlop move-coverage deficit decomposition, pre-intervention. | current |
| [DATASET_ADAPTER_PLAN.md](DATASET_ADAPTER_PLAN.md) | Dataset adapter plan + the full per-corpus licensing record. | current |
| [DATASET_EVAL_RESULTS.md](DATASET_EVAL_RESULTS.md) | Iteration 1 held-out dataset diagnostics. | current (explicitly "first held-out diagnostics, not benchmark-wide claims") |
| [DONOHARM_EVAL.md](DONOHARM_EVAL.md) | Human-input track: do-no-harm preservation + preference reporting. | current |
| [EDIT_BUDGET.md](EDIT_BUDGET.md) | Span/pattern-family edit-budget model + counterfactual. | current (marked exploratory; see its own top-of-file status note) |
| [FAILURE_ANALYSIS.md](FAILURE_ANALYSIS.md) | Pre-change failure analysis (large machine-readable dump). | current |
| [FROZEN_100.md](FROZEN_100.md) | Frozen-100 FixMySlop vs baseline Humanizer results. | erratum-bearing (inferential/"wins" labels withdrawn; point estimates remain historical diagnostics) |
| [HUMAN_EDIT_GROUNDED.md](HUMAN_EDIT_GROUNDED.md) | The human-edit-grounded scoring core (no LLM judge). | current |
| [HUMAN_EDIT_PROPENSITY.md](HUMAN_EDIT_PROPENSITY.md) | What editors actually fix (rho != E). | current |
| [METRICS_GLOSSARY.md](METRICS_GLOSSARY.md) | TextSlopBench metric glossary. | current |
| [POLICY_SMOKE.md](POLICY_SMOKE.md) | FixMySlop current vs HCSR+SEL mechanism check. | current |
| [README.md](README.md) | This index. | current |
| [RESEARCH_REGISTRY.md](RESEARCH_REGISTRY.md) | Registry of research branches/experiments. | current |
| [SPAN_VALIDATION.md](SPAN_VALIDATION.md) | Is E(p) trustworthy? (LAMP fine-grained edits). | current |
| [TETRA_SEL.md](TETRA_SEL.md) | Slop-Specific Edit Lift (TETRA vs LAMP). | current |
| [TEXTSLOPBENCH_CARD.md](TEXTSLOPBENCH_CARD.md) | The benchmark card (Iteration 3, human-edit-grounded). | current |
| [V2_1_FINDINGS.md](V2_1_FINDINGS.md) | v2.1 Stage-2 gate findings + the decision to ship Option 3. | superseded (explicitly "a historical experiment log, not a current ...") |
| [V2_1_STAGE1.md](V2_1_STAGE1.md) | Designing an in-house Stage 1 (operator audit + benchmark). | superseded (explicitly "historical development evidence only") |
| [V2_BASELINE.md](V2_BASELINE.md) | The historical v2 (`A_nolock`) baseline. | superseded, erratum-bearing (2026-08-23 erratum: invalid non-inferiority claim in the original) |
| [V2_CONFIRMATION_PREREG.md](V2_CONFIRMATION_PREREG.md) | The v2 confirmation preregistered protocol. | superseded, erratum-bearing (2026-08-23 statistical erratum; see `textslopbench/README.md`'s "Status of claims") |
| [VOICE_DRIFT.md](VOICE_DRIFT.md) | Stylometric direction of damage to a human's voice under revision. | current |

## Notes on links

- Links into `../../textslopbench/results/*` point at **generated** artifacts (eval
  outputs, cached runs). `results/` is gitignored, so those resolve only after you run the
  benchmark locally. The committed, always-present inputs are under
  `../../textslopbench/manifests/` (ID-only frozen subsets) and `../../textslopbench/fixtures.jsonl`.
- A few docs reference earlier iteration/scaffolding notes that were **not** carried into
  this public repo; they remain in the private research archive. Such links may dangle here.
