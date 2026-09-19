# FixMySlop v2 — historical baseline (`A_nolock`)

> **2026-08-23 erratum:** the confirmation harness used an invalid non-inferiority
> decision rule and an abbreviated prompt rather than the complete external Humanizer
> protocol. Treat the results below as historical development evidence only. They do not
> establish a Pareto gain or superiority over the Humanizer skill. See
> [V2_CONFIRMATION_PREREG.md](V2_CONFIRMATION_PREREG.md) for the correction.

Frozen 2026-08-19. Tag: `v2-confirmed-baseline`. This is the exact architecture that passed the
preregistered held-out confirmation (`V2_CONFIRMATION_PREREG.md`, result appended there;
`textslopbench/results/v2-confirmation.json`). Do not modify this definition — improvements are v2.1.

## Architecture

```
source
  → Humanizer draft            (aggressive de-slop generator; single pass)
  → FixMySlop 2-round repair    (anchor/fidelity: prepare → finish → targeted_correction, ×2)
  → final
```

No anchor pre-lock (it suppressed coverage on light-edit corpora without helping). The repair loop
restores any missing/underrepresented hard anchor and edits only flagged spans; it runs up to 2 rounds,
stopping early when the anchor/fidelity audit is clean.

## Exact configuration (as tested)
- **Stage-1 generator prompt** = `humanizer_vs_current.HUMANIZER_SYS` (baseline Humanizer).
- **Stage-2 repair prompt** = `CORRECTION_SYS` in `textslopbench/v2_confirmed_baseline.py` (restore
  missing hard anchors verbatim; edit only actionable_findings; preserve anchors/qualifications/causal/
  quotation/command/certainty; no new facts, no broad restyle).
- **Repair driver** = `pipeline.prepare_rewrite_context` → `finish_rewrite_context` →
  `targeted_correction`, looped 2×.
- **Model** = local proxy `gpt-5.6-luna` @ `127.0.0.1:8317`. Scorer = current canonical TextSlopBench
  (dual-CHEA move_coverage × conditional_direction_agreement, conditional population consensus,
  movement dead-zone, HCSR hygiene; `BENCHMARK_FREEZE.md`).
- **Runner** = `textslopbench/v2_confirmed_baseline.py` (the exact confirmation harness). Cached
  generations for the confirmed run are `textslopbench/results/policy-smoke-conf-*.raw.json`.

## Historical held-out result (untouched data; Beemo holdout-80 + LAMP holdout-100, k=3)
The old harness reported higher fidelity point estimates (+0.40 Beemo / +0.51 LAMP),
exact-anchor (+10), and a 10/10 coherence gate. Its Pareto and non-inferiority labels are withdrawn:
the old confidence-bound rule did not establish those conclusions. The point estimates remain here
only to reproduce the archived run; see the corrected status at the top of this file.

## Status of the v1 path
v1 (conservative FixMySlop) remains the default and is unchanged. v2 is a distinct mode; wiring adds a
mode switch so both paths are invokable.

## Known open item → v2.1 (separate, do NOT tune on the inspected Beemo confirmation holdout)
Close Beemo's ~3.75% residual fidelity failures — the full-paraphrase class with no discrete anchor
(a **semantic** fidelity problem, not an anchor one). Build a graduated semantic-loss backstop
(minimal proposition restoration → clause-level repair → v1 for the affected region → full source-revert
only as last resort) on fresh development examples of that failure class, validate on new untouched data.
Longer-term v2.1 goal: replace the Humanizer Stage-1 with **our own** high-coverage Stage 1 (operator
audit of Humanizer's mechanisms; keep/modify/avoid per operator by benchmark contribution), benchmarked
separately from the repair, so Stage 1 can be compared on coverage/direction/rhetoric before
the repair stage is applied.
