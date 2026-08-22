# TextSlopBench dataset adapter plan

This is an access-and-normalization plan, not a license assertion. The adapters are
implemented locally, accept user-supplied files, and do not download, redistribute,
or silently copy raw text. Every evaluation run must record the source path, hash,
license/terms review, snapshot, split, and whether raw text may be retained.

## Iteration 1 retrieval status

- LAMP: retrieved from the authors' repository at a pinned local checkout; the released JSON contains 1,057 records. A stable SHA-256-selected 24-record subset of the original `test` split was evaluated. The repository is BSD-3-Clause; raw source text remains local.
- Beemo: retrieved from the Hugging Face MIT release as Parquet (2,187 train rows). A stable 24-record slice was evaluated and is explicitly labeled `unspecified`, because the single downloaded shard has no row-level test split. This is a held-out-from-this-run diagnostic, not a canonical test score.
- Baumler: the public repository was retrieved and the adapter normalized 24 treatment/control records, but no explicit license file was present. It is prepared locally and not treated as a publishable scored result pending terms confirmation.
- WQ/WQRM: adapter and source references are present; no corpus evaluation was run in this iteration because a safe, usable preference-pair artifact was not retrieved.

Detailed derived results are in [LAMP_EVAL.md](LAMP_EVAL.md), [BEEMO_EVAL.md](BEEMO_EVAL.md), and the machine-readable JSON under `textslopbench/results/`. The evaluation host metadata is recorded in each candidate JSONL.

## Implemented normalized schema

Each adapter emits JSONL records with:

```json
{
  "dataset": "LAMP",
  "record_id": "stable-id",
  "split": "test",
  "source_text": "raw AI or draft text",
  "human_references": ["professional or participant edit"],
  "candidates": [],
  "metadata": {}
}
```

Run an adapter without modifying the source dataset:

```text
py -m textslopbench.adapters.cli lamp path/to/local/data.jsonl --split test --limit 100 --manifest run-manifest.json
```

Adapters live in `textslopbench/adapters/`:

- `lamp.py`: raw/original/response plus human-edit/reference aliases and edit-category metadata.
- `baumler.py`: traverses participant `responses`, emits treatment and control metadata, and preserves character-level edit logs when present.
- `beemo.py`: maps machine, human, expert-edited, and optional LLM-edited variants.
- `wq.py`: maps writing-quality preference pairs into chosen/rejected candidates.

## Dataset-specific status

### LAMP

The LAMP paper describes 1,057 LLM-generated paragraphs and 8,035 fine-grained edits by 18 professional writers, across literary fiction and creative non-fiction. The adapter supports the source/edited/reference shape and preserves edit-category metadata. Use the paper and repository/data release supplied by the authors as the provenance record; do not assume raw-text redistribution rights from the paper alone.

Source: [LAMP paper](https://arxiv.org/abs/2409.14509), [paper PDF](https://openreview.net/pdf/90892a88a438a498c72216cbef98824c849a6544.pdf).

Evaluation subset: select by a predeclared hash list, not by tuning on the full corpus. Keep a development and hidden evaluation split separate.

### Baumler personal-style post-edit logs

The public repository documents per-participant JSON logs with `model_generation`,
`final_version`, `model_generation_shown`, scenarios, details, and character-level
edits. The adapter emits one record per participant/task and keeps control tasks
marked as independent human writing. Treat participant IDs, timestamps, demographics,
and free-text survey fields as sensitive; exclude them from public benchmark cards.

Source: [author repository](https://github.com/ctbaumler/personal_style_postedit),
[author publication page](https://ctbaumler.github.io/publications.html).

Evaluation subset: treatment tasks for draft-to-post-edit; control tasks for the
first-class Do-No-Harm track; participant-level grouping to prevent leakage across
train/dev/eval.

### Beemo

The paper describes human, machine-generated, expert-edited, and LLM-edited outputs
across several use cases and says the materials are publicly available. The adapter
accepts common machine/human/expert field aliases but requires a local copy and a
terms review before use.

Source: [Beemo paper](https://arxiv.org/abs/2411.04032).

Evaluation subset: stratify by use case, source model, and edit condition. Do not let
the same prompt or source item appear in both tuning and evaluation.

### WQ/WQRM

WQ is a preference benchmark and WQRM is an automatic secondary metric, not a
replacement for human evaluation. The adapter consumes local preference-pair files;
the WQRM model is intentionally not bundled into the core prototype. If used, run
paragraph-level inference and record model revision because the model card notes it
was trained on shorter text.

Sources: [WQ/WQRM paper](https://arxiv.org/abs/2504.07532),
[WQRM model card](https://huggingface.co/Salesforce/WQRM),
[inference code](https://github.com/salesforce/creativity_eval/blob/main/WritingRewards/WQRM_inference.py).

## Evaluation protocol

1. Download or receive the dataset outside this repository.
2. Record source URL, commit/tag, file hash, license/terms review, and raw-retention policy.
3. Normalize with the adapter and write only derived manifests/IDs into the benchmark workspace.
4. Create a locked evaluation ID list before running either humanizer.
5. Run source, baseline Humanizer, FixMySlop, and human-reference conditions with the same host configuration where applicable.
6. Score exact protected-span/fact checks, edit deltas, human-edit alignment, and blinded human judgments separately.
7. Report dataset-specific results; never merge LAMP creative-writing scores with Baumler personal-style or WQ preference scores into one unqualified number.

## Current limitations

The adapters remain schema-tolerant and retain local raw corpora only under the
operator's control. Real-data scores are first held-out diagnostics, not claims of
benchmark-wide superiority. Baumler still needs explicit terms review, and WQ needs
a usable preference-pair snapshot before evaluation.
