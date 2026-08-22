# TextSlopBench

This directory contains the owned, synthetic prototype benchmark for
`FixMySlop:Humanizer`.

Run the deterministic local candidate:

```text
py textslopbench/run_textslopbench.py --local
```

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
