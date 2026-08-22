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
