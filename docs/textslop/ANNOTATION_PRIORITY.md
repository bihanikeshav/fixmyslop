# Annotation-derived edit priority + counterfactual E-gating (LAMP)

Built from the VALIDATED ground truth (LAMP `fine_grained_edits`, detector precision 1.0). E here
is occurrence-level annotation E = annotated_edit_count / occurrences — the real rate editors
touch each pattern, not the count-based lower bound. `textslopbench/annotation_priority.py`.
911 records; genres: Literary Fiction 670, Travel 110, Food 82, Advice 30, Creative NF 19.

## Priority table (top slop patterns, annotation E)

| pattern | occ | edited | raw_E | smoothed_E | conf | ρ | edit_priority_v0 |
|---|---:|---:|---:|---:|---|---:|---:|
| tapestry | 46 | 37 | 0.80 | 0.77 | high | 15 | 3.00 |
| seamlessly | 26 | 12 | 0.46 | 0.46 | med | 9 | 1.46 |
| testament | 55 | 25 | 0.46 | 0.45 | high | 8 | 1.38 |
| vibrant | 99 | 44 | 0.44 | 0.44 | high | 7 | 1.26 |
| elevate | 21 | 11 | 0.52 | 0.51 | med | 5 | 1.18 |
| not_x_but_y | 61 | 26 | 0.43 | 0.43 | high | 6 | 1.17 |
| bustling | 50 | 18 | 0.36 | 0.37 | high | 9 | 1.17 |
| intricate | 26 | 7 | 0.27 | 0.30 | med | 6 | 0.77 |
| landscape | 57 | 21 | 0.37 | 0.38 | high | 4 | 0.76 |

## Quadrants

- **high ρ / high E** — tapestry, seamlessly, testament, vibrant → clear edit candidates.
- **high ρ / low E** — **bustling, interplay** → the interesting class: strong AI fingerprint,
  humans edit it *less* (E 0.37 / 0.30). But note "low E" here means below 0.40, **not** "never."
- **low ρ / high E** — elevate, not_x_but_y, profound, nuanced → humans fix despite modest ρ.
- **low ρ / low E** — intricate, landscape → low priority.
- **low support / uncertain** — rich cultural, meticulously, crucial (n < 15).

## Counterfactual E-gating — the decisive finding

Would an E-gating policy actually change enough current slop edits to justify a rewrite run?
**min smoothed_E among all slop patterns = 0.296** — nothing is categorically left alone.

| suppress threshold E_lo | % of current slop edits suppressed | patterns dropped |
|---:|---:|---|
| ≤ 0.25 | **0%** | — |
| 0.30 | 8% | interplay, intricate |
| 0.35 | 10% | + crucial |
| 0.40 | 32% | + bustling, landscape, rich cultural |
| 0.45 | 68% | + not_x_but_y, nuanced, vibrant, meticulously |

**A pattern-level E-gate at any defensible threshold (≤0.25) suppresses 0% of edits.** To suppress
a meaningful fraction you must set a threshold so high it also drops patterns editors fix a third
of the time (bustling 0.37, crucial 0.35). So the count-based "bustling = leave it alone" was an
artifact of undercounting.

## Conclusion — the lever is magnitude, not pattern on/off

At the pattern level there is **no "never edit" class**; editors touch every AI-associated pattern
≥30% of the time. FixMySlop's real divergence from humans is **not** which patterns it edits — it
is **how hard it suppresses overall** (SED → ~0–2 vs the human residual ~10; HCSR). So:

- **Do NOT** add a pattern-level E-gate — the counterfactual shows it would change ~0–8% of cases,
  not worth a rewrite run.
- **DO** pursue **magnitude calibration** toward the human SED residual (HCSR), and target the
  losing CHEA components (syntax on LAMP). E and the quadrants stay as *evidence/priority
  ordering*, not as hard on/off gates.

This is exactly the "see what the data says before touching the skill" step paying off: the
obvious policy (gate by E) is the wrong one. Machine-readable: `annotation-priority-lamp.json`.
