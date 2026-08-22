# Policy smoke — FixMySlop current vs HCSR+SEL (mechanism check)

Small deterministic-eval smoke (NOT a tuning pass). 8 frozen items (4 LAMP + 4 Beemo), two
policies generated on `gpt-5.6-luna` (2 batched host calls, cached), **no judges, no Humanizer**.
Pattern-level E-gate deliberately NOT implemented. `textslopbench/policy_smoke.py`.

- **A. HCSR magnitude:** target the empirical human residual SED range (conditioned on source-SED
  band, per corpus), not zero.
- **B. SEL prioritization:** weight redundancy (strong), cliche/ornament + specificity
  (provisional), readability/grammar ~0. Pragmatic/genre layer preserved. E kept as evidence only.

## Aggregate (8 items)

| metric | current | HCSR+SEL | want |
|---|---:|---:|---|
| **HCSR** (|SED−human|) | **41.7** | **43.0** | lower |
| final SED | 11.5 | 10.2 | ≈ human residual |
| fidelity pass rate | 1.00 | 1.00 | =1 |
| exact-anchor | 100 | 100 | =100 |
| edit magnitude (word) | 0.24 | 0.16 | lower (less ordinary editing) |
| overall CHEA (dir) | 0.505 | 0.49 | higher |
| **rhetoric CHEA** | **0.606** | **0.606** | not lower |
| redundancy align | 0.56 | 0.44 | higher |
| syntax | 0.42 | 0.37 | higher |
| rhythm | 0.25 | 0.56 | higher |

## Verdict: mechanism functions, but does NOT meet the success criterion — do not scale yet

**HCSR did not improve (41.7 → 43.0), so by the stated criterion the experiment is not promising
as run.** But the failure is diagnosed and specific, and the safety criteria passed:

- **Do-no-harm holds:** hard-anchor fidelity 1.0 (unchanged), **rhetoric CHEA identical (0.606)** —
  the area FixMySlop already handles well was not damaged. Overall CHEA essentially flat. Edit
  magnitude fell (0.24 → 0.16): the SEL "don't polish every sentence" instruction did reduce
  ordinary editing.
- **Why HCSR didn't improve — the target estimator, not the mechanism.** On the high-SED creative
  items, editors kept a *large* residual (source 105 → human 89; 68 → 79; 71 → 69), but the
  tertile-band target range we computed was only ~[18, 46]. The policy therefore told the model to
  suppress to ~33, and it complied. The model *did* respect a non-zero residual target and edit
  less — but the target itself was still far below what these editors actually left. Per-item HCSR
  improved on only 1/8; on `beemo_cliche` the current policy already matched the human (HCSR 0.2)
  and HCSR+SEL over-corrected (7.2).
- **Minor regressions:** redundancy/syntax/lexical direction agreement dipped; rhythm rose.

## What must change before a larger run

1. **Replace the residual target estimator.** The tertile p25–p75 band **understates** the
   residual high-SED items keep. Fit a conditional `E[SED_H | SED_S, genre]` (regression or finer
   bands / quantile fit) so the target tracks the source state instead of collapsing toward the
   low-SED majority. This is the single blocking issue.
2. **Keep SEL weights provisional** (cross-corpus / genre-confounded); redundancy is the only
   higher-confidence weight. Do not promote cliche/specificity weights without same-genre
   human→human evidence.
3. The redundancy-alignment dip suggests the SEL prompt de-emphasised some redundancy edits it
   should keep — revisit the family→aspect weights.

**Recommendation:** the mechanism is sound and safe (no fidelity/rhetoric damage), but it does not
yet merit a larger deterministic run. Fix the target estimator (#1), then re-smoke the same 8
items before scaling. Machine-readable: `policy-smoke-results.json` (+ cached raw generations).

---

# Round 2 — conditional residual estimator (and the decisive negative)

Fixed issue #1: `textslopbench/residual_estimator.py` estimates `E[SED_H | SED_S, genre]` with
per-genre source-SED bins, PAV-monotone median/p25/p75, hierarchical fallback
(genre+bin → genre-extrap → global+bin → global), and **allows SED_H > SED_S**. Fit on dev rows
**excluding the 8 frozen smoke rids**. It fixed the target: LAMP high-SED now predicts residual
~49 (p25/p75 ≈ 32/54) instead of the old ~[18,46]; `beemo_cliche` is protected (its human 25 is
inside the widened band). Same 8 items, cached current outputs reused, **one** new `cond_hcsr`
generation on gpt-5.6-luna.

| metric | current | cond_HCSR |
|---|---:|---:|
| **HCSR** | 41.7 | **42.3** (worse) |
| inside predicted interval | 6/8 | 6/8 |
| fidelity / exact | 1.0 / 100 | 1.0 / 100 |
| rhetoric CHEA | 0.606 | 0.591 |
| overall CHEA | 0.505 | 0.47 |
| redundancy align | 0.56 | 0.33 |

Per-item, the model **ignores the residual floor**: `lamp_cliche` told `[31,53]` suppressed to
**12**; `lamp_over_suppressed` told `[32,54]` went to **20**; `beemo_cliche` (already matching its
human at 25) was nudged to 20 (HCSR 0.2 → 5.1). It suppresses recognizable slop wherever that
lands and does not steer toward a numeric SED band.

## Decisive conclusion — stop tuning HCSR through prompt policy

With a correct, monotone, genre-conditional target, HCSR **still did not improve** and every
success criterion failed (HCSR worse; high-SED LAMP still collapses; beemo_cliche mildly
over-corrected; rhetoric/CHEA slight regressions). The target was not the bottleneck — **the model
cannot introspect or steer a document-level SED aggregate from a prompt.** SED is too coarse a
control signal for prompt-driven magnitude.

**Per the stated stop rule, we stop prompt-policy HCSR and pivot to span / pattern-family magnitude
calibration:** decide per pattern-family / per span whether to edit (using validated E, SEL,
pragmatics, ρ) — concrete, model-actionable decisions — instead of asking the model to hit a
document-level residual number. The conditional estimator and HCSR remain useful as **scoring
targets** (and as inputs to a per-family budget), just not as a prompt instruction.

Machine-readable: `policy-smoke-cond-results.json`. Estimator: `residual_estimator.py` (kept —
monotone, dev-fit, reusable for span-family calibration and HCSR scoring).
