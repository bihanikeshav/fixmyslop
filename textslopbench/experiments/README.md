# textslopbench/experiments/

One-off, dead (no longer wired into any runner or CI) v2.1 research scripts, moved out of
`textslopbench/` proper to keep the top-level directory to actively-used runners, scorers,
dataset prep, analyses, and utilities (see the root `textslopbench/README.md` script index).
Nothing in the repo imports these — confirmed by grepping for their module names across
`*.py` before the move (audit fix, item 15). They are cached-data, deterministic, no-model-call
diagnostics; kept for provenance/history, not for re-running as part of any current workflow.

Each script resolves the repo root as `Path(__file__).resolve().parent.parent.parent` (one
level deeper than a `textslopbench/*.py` script, since these now live in
`textslopbench/experiments/`) and adds `skills/fixmyslop-humanizer/scripts/` and
`textslopbench/` onto `sys.path` itself, so they still run standalone:
`python textslopbench/experiments/<script>.py`.

- **v2_1_exp0_thoroughness.py** — Fable Experiment 0 (free, deterministic): tests whether
  Humanizer rewrites more than the first-party `rules_detected` Stage-1, and whether
  per-document rewrite intensity predicts the per-document Reference-CHEA deficit. Cached
  dev-40 Stage-1 drafts only, no generation.
- **v2_1_exp1_npass.py** — Fable Experiment 1, the N-PASS probe: tests whether re-applying
  the first-party Stage-1 to its own output 2-3x (then repair) closes the heavy-corpus
  deficit, against Humanizer -> repair as the confirmed champion baseline.
- **v2_1_gap_diag.py** — v2.1 heavy-text gap diagnostic: decomposes the Reference-CHEA /
  conditional-direction deficit between Humanizer's Stage-1 and the first-party
  `rules_detected` Stage-1 by feature, on LAMP + Baumler, to see how much a bucket-A-only
  Stage-2 could theoretically recover.

See `../../docs/textslop/V2_1_FINDINGS.md` for the findings these scripts produced.
