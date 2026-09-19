# TextSlopBench

This directory contains the owned, synthetic prototype benchmark for
`FixMySlop:Humanizer`.

Run the deterministic local candidate:

```text
py textslopbench/run_textslopbench.py --local
```

Run the complete dependency-free safety suite (owned rewrite fixtures + identity
baseline + ClaimFlipBench + InterventionBench):

```text
py textslopbench/local_benchmark_suite.py
```

- **ClaimFlipBench v0.2.0** pairs 15 independently phrased valid rewrites with 25
  known corruptions of numbers,
  entities/roles, negation, polarity, modality, causality, temporal order, membership,
  numeric ranges, comparative direction, scope, quotations, URLs, and occurrence counts.
  It reports corruption recall and valid-paraphrase specificity with Wilson intervals.
- **InterventionBench** balances targeted defects against clean, voice-sensitive
  controls and reports intervention recall, clean preservation, exact recovery,
  idempotence, and anchor/mutation safety.

Neither benchmark proves general semantic equivalence. They are owned regression
gates that make detector blind spots and over-editing measurable without a paid API.
For ClaimFlipBench, 100% means only that every case in the 40-item owned pack passed.

Each external black-box run must produce JSONL with one record per fixture:

```json
{"id":"release_notes_hype","system":"humanizer/host-agent","rewrite":"..."}
```

Score and merge fresh agent results with:

```text
py textslopbench/merge_agent_results.py --inputs textslopbench/results/agent_*.jsonl
```

The checker reports exact preservation, content overlap, frozen analyzer findings,
length changes, and a human-control slice. These are automatic diagnostics, not a
replacement for blinded naturalness, writing-quality, voice, and fidelity judgments.
The benchmark does not use AI-detector scores.

The fixture source is original synthetic text and is versioned by the `0.1.0`
snapshot. Agent result files are generated artifacts and should not be treated as
training data for later benchmark runs.

## Getting the corpora

The human-edit-grounded evaluation uses four external corpora. They are **fetched
locally** into `textslopbench/data_raw/` and are **never committed** (`data_raw/` and
`results/` are gitignored). Check each dataset's terms before use or redistribution:

| Corpus | License | Redistribution |
|--------|---------|----------------|
| **Beemo** | MIT (HuggingFace release) | OK with attribution |
| **TETRA** | CC BY 4.0 | OK with attribution |
| **LAMP** | repo BSD-3-Clause; raw-text redistribution unconfirmed — do **not** assume raw-text rights from the paper alone | held locally only |
| **Baumler** | no license file | held locally only, pending terms |

What *is* committed here is enough to reproduce the pipeline once you have the data:
the ID-only frozen subset manifests (`manifests/frozen-*.json`), the project's own
synthetic fixtures (`fixtures.jsonl`), and the deterministic scorer. Adapters in
`adapters/` turn each raw corpus into the common record shape; see
[`../docs/textslop/DATASET_ADAPTER_PLAN.md`](../docs/textslop/DATASET_ADAPTER_PLAN.md)
for per-corpus fetch details and the full licensing record.

Tests that need a corpus skip automatically when `results/` has no corpus files, so
`pytest` is green on a fresh checkout and runs in full once the corpora are fetched.

## Status of claims (read before citing any number below or in `docs/textslop/`)

> - **v2 superiority / non-inferiority verdicts are WITHDRAWN** pending a cluster-valid
>   bootstrap rerun. The confirmed-v2 comparison (`v2_confirmed_baseline.py`,
>   `docs/textslop/V2_CONFIRMATION_PREREG.md`) needs the un-committed corpora + model outputs
>   to be regenerated with `bootstrap.paired_cluster_bootstrap` (writer/prompt-clustered, not
>   item-level) before any verdict is re-asserted; until then treat V2_BASELINE.md /
>   V2_1_FINDINGS.md conclusions as historical, not current.
> - **Most per-corpus results are n<=24 and exploratory.** LAMP/Beemo held-out slices are
>   24-100 items; several experiment scripts (coverage_experiment.py, expendable_experiment.py,
>   v2_1_exp*) run on disjoint dev-40 sets. Treat point estimates as directional, not
>   statistically settled, outside the frozen/preregistered runs.
> - **No multiple-comparisons correction has been applied** across the many experiment
>   branches (coverage bridge, expendable bridge, repetition holdout, N-pass, gap diagnostic,
>   etc.). Each branch reports its own CI/significance test in isolation; reading several
>   branches together as if they were one preregistered family overstates confidence.
> - **Judge proxy aliases are undocumented mappings.** `gpt-5.6-luna`, `gpt-5.6-terra`, and
>   `gpt-5.4` (used throughout `docs/textslop/FAILURE_ANALYSIS.md`, `DONOHARM_EVAL.md`, and the
>   judged-smoke scripts) are local-proxy names hit at `127.0.0.1:8317`
>   (see `policy_smoke.py`, `antislop_judged_smoke.py`, `partial_benchmark_judge.py`). Their
>   real underlying model mapping is not recorded anywhere in this repo.
>   `TODO(owner): document the gpt-5.6-luna / gpt-5.6-terra / gpt-5.4 -> real-model mapping,
>   or note that it is intentionally opaque and why.`
> - **LAMP licensing:** the LAMP repository is BSD-3-Clause; raw-text redistribution is
>   unconfirmed (do not assume raw-text rights from the paper alone) — see
>   [`../docs/textslop/DATASET_ADAPTER_PLAN.md`](../docs/textslop/DATASET_ADAPTER_PLAN.md) for
>   the full per-corpus record. This matches the "Getting the corpora" table above.

## Script index

Every `.py` file in this directory (and its `adapters/`/`experiments/` subdirectories),
grouped by role. See each script's module docstring for full detail.

### Runners
- `run_textslopbench.py` — run and score the owned TextSlopBench v0.1 fixture set.
- `local_benchmark_suite.py` — the dependency-free safety suite entry point (owned rewrite
  fixtures + identity baseline + ClaimFlipBench + InterventionBench); `python -m pytest` and
  CI both depend on this exiting 0.
- `frozen_run.py` — frozen-100 FixMySlop vs baseline Humanizer head-to-head, chunked/cached.
- `repetition_holdout.py` — preregistered repetition-bridge holdout (FROZEN protocol), v1 vs
  v2, k=3 generations.
- `v2_confirmed_baseline.py` — the v2 confirmation run (preregistered; see "Status of claims").

### Scorers / aggregators
- `chea.py` — Conditional Human-Edit Alignment (Reference + Population flavours); canonical.
- `bootstrap.py` — paired item-level and paired cluster bootstrap for system-vs-system deltas.
- `compare_systems.py` — deterministic baseline_humanizer vs FixMySlop head-to-head from cache.
- `human_edit_grounded.py` — the deterministic core human-edit-grounded scorer (no LLM judge).
- `human_edit_propensity.py` — do real editors actually fix each AI-associated pattern.
- `edit_operations.py` — operation-level taxonomy of Beemo edits (delete/compress/merge/...).
- `delete_scorer.py` — corrected deletion / claim-impact scorer (v2).
- `delete_decomposition.py` — decomposes the Beemo delete deficit by scope/role/claim-impact.
- `residual_estimator.py` — conditional human-residual estimator E[SED_human | SED_source, genre].
- `voice_drift.py` — stylometric direction of damage a rewrite does to a human's voice.
- `slop_specific_lift.py` — Slop-Specific Edit Lift (SEL): separates slop cleanup from ordinary editing.
- `multiref_check.py` — multi-reference proxy for the patch-restore rhetoric dip (LAMP is single-reference).
- `claimflip_bench.py` — owned mutation benchmark for conservative rewrite-safety checks.
- `intervention_bench.py` — owned clean-vs-defective intervention/idempotence benchmark.
- `human_input_track.py` — human-input track do-no-harm reporting (Iteration 2).
- `score_judgments.py` — aggregate anonymized pairwise judgments (own the ambiguous-attribution guard).
- `score_audit_judgments.py` — score counterbalanced multi-judge audit outputs (own the ambiguous-attribution guard).
- `score_ablations.py` — aggregate the five pinned-host ablation conditions.
- `score_dataset_outputs.py` — score held-out dataset outputs against human-edit deltas.
- `score_donoharm.py` / `score_donoharm_judges.py` — score/aggregate do-no-harm preservation + preference judgments.
- `patch_restore.py` — v1 diff-and-patch architecture (LAMP smoke, on cached Pass-1 outputs).
- `edit_budget.py` — span/pattern-family edit-budget model + deterministic counterfactual.
- `validate_spans.py` — validate inferred edit fates against LAMP's fine-grained annotations.

### Dataset prep
- `dataset_eval.py` — held-out dataset preparation + human-edit-delta scoring; owns the
  `adapters.ADAPTERS` registry re-export and requires an explicit `--host-model`.
- `adapters/` — `base.py` (shared adapter interface, optional pyarrow parquet path),
  `lamp.py`, `beemo.py`, `baumler.py`, `tetra.py` (scaffold: pending dataset), `wq.py`,
  `cli.py` (normalize a user-supplied file without downloading/redistributing it),
  `__init__.py` (the `ADAPTERS` registry — single source of truth).
- `prepare_donoharm.py` / `prepare_donoharm_judges.py` — build do-no-harm slices/prompts.
- `prepare_family_ablation.py` — per-arm host payloads for the feature-family ablation.
- `prepare_rewrite_contexts.py` — bounded host-model prompts + audit contexts.
- `make_blinded_pairs.py` — anonymized pairwise prompts, deterministic A/B assignment.
- `merge_agent_results.py` — merge fresh black-box skill outputs, score with the frozen checker.
- `merge_jsonl.py` / `split_jsonl.py` — merge/split JSONL parts, rejecting duplicate IDs.

### Analyses / diagnostics
- `annotation_priority.py` — annotation-derived edit-priority table + counterfactual E-gating sim.
- `coverage_gap.py` — FixMySlop move-coverage decomposition (frozen-100 diagnostic).
- `coverage_bridge_audit.py` — deterministic plan audit for the structural-findings bridge.
- `coverage_experiment.py` — coverage-bridge dev experiment + 3-family ablation (dev data only).
- `expendable_experiment.py` — expendable-content deletion dev experiment + ablation.
- `failure_analysis.py` — pre-change failure analysis from frozen fixture/output artifacts.
- `humanizer_vs_current.py` — baseline humanizer vs current FixMySlop, scored through the canonical pipeline.
- `policy_smoke.py` — FixMySlop current vs FixMySlop HCSR+SEL mechanism-check smoke.
- `budget_smoke.py` — LAMP-only edit-budget rewrite smoke.
- `antislop_judged_smoke.py` — judged smoke: does the Antislop slop layer improve a pragmatics-only rewrite.
- `partial_benchmark_judge.py` — judged head-to-head on the partial owned 12-fixture benchmark.
- `inspect_scorer_sample.py` — stratified sample from the corrected scorer for manual validation.
- `inspect_unsafe_deletions.py` — dump human deletions labeled UNSAFE, with context, for manual review.

### Experiments (dead, archived — see `experiments/README.md`)
- `experiments/v2_1_exp0_thoroughness.py`, `experiments/v2_1_exp1_npass.py`,
  `experiments/v2_1_gap_diag.py` — one-off v2.1 diagnostics, not imported by anything current.

### Utilities
- `common.py` — shared `human_references` parser, `resolve_system_for_text`, and Jaccard
  helper, consolidated out of six-plus copy-pasted implementations (audit fix).
- `export_web_summary.py` — export the deterministic local-suite ledger for the landing page.
- `write_context_examples.py` — extract two exact host contexts for the audit report.
- `write_fixture_traces.py` — write a readable exact source/old/new trace for owned fixtures.
- `__init__.py` — package marker.
