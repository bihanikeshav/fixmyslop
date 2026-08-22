# Human-input track

(Formerly "do-no-harm.") Systems are run on 24 human-written Beemo inputs. Per Iteration 2
review point 6, a system is **not** rewarded merely for making zero edits: intervention and
preference are reported as separate axes, alongside anchor/claim fidelity. Metric names follow
[METRICS_GLOSSARY.md](METRICS_GLOSSARY.md). Judge preferences are three pinned models
(`gpt-5.4`, `gpt-5.6-luna`, `gpt-5.6-terra`), diagnostic only, not a human panel.

| System | Intervention rate | Mean norm. edit magnitude | Anchor/claim fidelity | Rewrite preferred | Original preferred | Tie rate |
|---|---:|---:|---:|---:|---:|---:|
| baseline_humanizer | 100.0% | 0.5350 | 20.8% (5/24) | 44/72 | 20/72 | 11.1% |
| fixmyslop | 0.0% | 0.0000 | 100.0% (24/24) | 0/72 | 0/72 | 100.0% |

## How to read this

- **Baseline** edits every human input (intervention 100%), and judges preferred its rewrite
  61% of the time — but it dropped a hard anchor or claim on 19 of 24 inputs (fidelity 20.8%).
  Its preference score and its fidelity failure are different facts and neither cancels the other.
- **FixMySlop** left all 24 inputs untouched (intervention 0%), so every judgment is a tie and
  fidelity is trivially 100%. This is preservation, **not** demonstrated quality: with zero edits
  there is nothing for a judge to prefer. A future revision that intervenes on a genuine defect in
  human prose would move both the intervention rate and the preference axes, which is the point of
  reporting them separately.

## Provenance caveat

These baseline/FixMySlop host outputs were generated before the final narrowing of the UI
classifier. The preservation result is unaffected (identical output preserves everything), but
rerun before quoting exact final provenance.

Machine-readable: [human-input-track-24.json](../../textslopbench/results/human-input-track-24.json)
(recomputed deterministically by `textslopbench/human_input_track.py`), preservation details in
[donoharm-eval-24.json](../../textslopbench/results/donoharm-eval-24.json), judgments in
[donoharm-judges-24.json](../../textslopbench/results/donoharm-judges-24.json).
