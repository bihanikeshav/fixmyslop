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
| **LAMP** | unconfirmed — do **not** assume raw-text rights from the paper alone | held locally only |
| **Baumler** | no license file | held locally only, pending terms |

What *is* committed here is enough to reproduce the pipeline once you have the data:
the ID-only frozen subset manifests (`manifests/frozen-*.json`), the project's own
synthetic fixtures (`fixtures.jsonl`), and the deterministic scorer. Adapters in
`adapters/` turn each raw corpus into the common record shape; see
[`../docs/textslop/DATASET_ADAPTER_PLAN.md`](../docs/textslop/DATASET_ADAPTER_PLAN.md)
for per-corpus fetch details and the full licensing record.

Tests that need a corpus skip automatically when `results/` has no corpus files, so
`pytest` is green on a fresh checkout and runs in full once the corpora are fetched.
