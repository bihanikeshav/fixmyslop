# v2.1 — designing our own Stage 1 (operator audit + Stage-1 benchmark)

Branch `v2.1-stage1`. Dev data only (Beemo dev-40 + LAMP dev-40); the v2 confirmation holdouts are NOT
touched. Goal (per the v2.1 vision): replace the Humanizer Stage-1 with **our own** high-coverage Stage-1,
inspired by Humanizer's operators but better aligned to human editors, benchmarked SEPARATELY from the
repair (Stage-1 judged on coverage / conditional-direction / reference-CHEA / rhetoric, NOT final fidelity).

## Operator audit (`results/v2_1-operator-audit.json`)
Measured each Humanizer operator (= slop feature family) from the cached Humanizer generations vs the human
ground truth. Clean signals = **coverage_contribution** (P hz moves it | human does) and **direction_accuracy**
(P hz sign == human sign | both move). (`fidelity_risk` here is confounded by hz's ~50% base failure rate —
not a clean per-operator signal; the repair stage owns fidelity anyway.)

| operator | cov (B/L) | dir_acc (B/L) | verdict |
|---|---|---|---|
| reduce_repetition | 0.88 / 0.86 | **0.81 / 0.79** | KEEP (star operator) |
| raise_lexical_density | 1.0 / 1.0 | 0.73 / 0.63 | KEEP |
| reduce_subordination | 0.86 / 1.0 | 0.75 / 0.68 | KEEP |
| reduce_template | 0.64 / 0.77 | 0.65 / 0.78 | KEEP |
| reduce_slop_density | 0.53 / 0.96 | 0.59 / 0.81 | KEEP (esp. LAMP) |
| remove_promotional | 1.0 / 1.0 | 1.0 / 0.80 | KEEP (small n) |
| de_nominalize | 0.90 / 1.0 | **0.58 / 0.63** | CONSTRAIN (hz over-applies vs humans) |
| remove_false_range | 0.43 / 0.83 | 0.33 / 0.80 | genre-dependent, noisy |
| hedge_removal | — | — (n=0) | AVOID (humans ~never move it) |
| inflation / vague_attribution / filler / generic_conclusion | — | — (n≈0) | AVOID (wasted budget) |

**Key insight:** the Humanizer wastes edit budget on operators humans don't touch (hedges, inflation,
vague-attribution) and over-applies de-nominalization against the human direction. Concentrating budget on
the high-direction operators should beat Humanizer's direction accuracy.

## Stage-1 benchmark (`results/v2_1-stage1-bench.json`, `-bench2.json`) — our Stage-1 vs Humanizer (pre-repair)

| | Beemo cond_dir | Beemo cov | Beemo edit_mag | LAMP cond_dir | LAMP cov |
|---|---|---|---|---|---|
| Humanizer | 0.636 | 0.884 | 0.497 | 0.675 | 0.959 |
| our targeted Stage-1 | **0.696 (+0.060)** | 0.884 (tie) | 0.401 (−20%) | 0.588 (−0.086) | 0.927 |

**Result: our targeted Stage-1 BEATS Humanizer on Beemo** — +0.06 conditional-direction, better rhetoric,
SAME coverage with ~20% less editing (the operator-audit thesis, proven on light-edit text). **But it LOSES
on LAMP**, and making it more aggressive did not fix it (cond_dir still −0.094).

**Diagnosis — genre-dependent operator set (not just aggressiveness):** Beemo humans (light creative edits)
use a narrow operator set our targeting matches. LAMP humans (professional heavy edits) delete detail and
restructure broadly — exactly what our rules ("don't delete detail", "preserve wording", "don't chase
generic-conclusion") block. A single fixed operator set cannot win both corpora.

## Conclusion / next
Our Stage-1 must be **genre-adaptive**: emphasize the operator set humans actually use for the inferred
genre (FixMySlop already infers genre). Light-edit genres → targeted/narrow; heavy-edit genres → broad,
Humanizer-like aggression with the universal wins kept (skip hedges/inflation/vague-attribution; constrain
de-nom). Also: resolve small Beemo deltas at k>=2 (k=1 generator SD ~0.03 muddies them). Then benchmark
Stage-1 separately again, and only then wire our Stage-1 → 2-round repair as full v2.1 and validate on fresh
untouched data. See [[fixmyslop-v2]].
