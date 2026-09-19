# tests/ — Python suite for the text side

Covers `skills/fixmyslop-humanizer/scripts/` and `textslopbench/`. Run from the repo root:

```bash
python -m pytest -q
```

Stdlib + pytest only. About 20 tests are marked `requires_corpora` (`_corpus_guard.py`) and
**skip** unless the external corpora have been fetched into `textslopbench/data_raw/`
(see `docs/textslop/DATASET_ADAPTER_PLAN.md`) — a fresh clone is green by design.

| Area | Files |
|---|---|
| Humanizer pipeline | `test_humanizer.py`, `test_v2_pipeline.py`, `test_antislop.py`, `test_regression.py`, `test_iteration2.py`, `test_patch_restore.py` |
| Bridges (repo-only) | `test_structural_bridge.py`, `test_expendable_bridge.py`, `test_bridge_lazy_import.py` |
| Dataset adapters / provenance | `test_adapters.py`, `test_tetra_sel.py`, `test_dataset_eval_provenance.py`, `test_validate_spans.py` |
| Scoring and statistics | `test_bootstrap_and_pairing_kat.py` (known-answer), `test_ambiguous_attribution.py`, `test_chea.py`, `test_score_chea_wiring.py`, `test_residual_estimator.py` |
| Human-edit grounding | `test_human_edit_grounded.py`, `test_human_edit_propensity.py`, `test_annotation_priority.py`, `test_voice_drift.py`, `test_edit_budget.py` |
| Cross-repo contracts | `test_local_benchmarks.py` (incl. `apps/web/demo/textslop-summary.js` stays in sync with `textslopbench/export_web_summary.py`), `test_personality_type_and_color.py` |

JavaScript tests live next to their code, not here (see `AGENTS.md`).
