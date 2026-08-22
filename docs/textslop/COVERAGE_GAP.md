# FixMySlop move-coverage deficit — decomposition + mechanism (pre-intervention)

Diagnostic only. Source: frozen-100 v1 baseline (`frozen-100-report.v1.json`) + cached rewrites, no LLM
calls. `results/coverage-gap-decomposition.json`, `textslopbench/coverage_gap.py`. frozen-100 stays a
reported baseline; policy tuning will use development data, never these items.

## Objective
Raise move_coverage **without** lowering conditional_direction_agreement, fidelity, or anchor
preservation. So we hunt for features where: humans reliably move F **given source state** (high
`cond_dir_conf`), Fix frequently leaves F unmoved (high `fix_missed_rate`), and **when Fix does move F it
already picks the right direction** (high `fix_dir_acc`). Those are safe to intervene on; raising volume
elsewhere would just make Fix Humanizer-like.

## Where the gap actually is
The coverage deficit is **concentrated in Beemo (business prose)**, not LAMP:
- LAMP: Fix already moves most features (fix_move_freq 0.68–0.91); miss rates 0.10–0.36. move_coverage
  0.85 vs humanizer 0.95 — small gap.
- Beemo: fix_move_freq 0.34–0.77; miss rates 0.28–0.64. move_coverage 0.65 vs 0.80 — the real gap.

## Safe coverage targets (thresholds: human_move_freq≥.30, cond_dir_conf≥.70, fix_missed≥.40, fix_dir_acc≥.60, fix_comoved_n≥8)

**Beemo (all thresholds met):**
| feature | family | hFreq | miss | fix_dir_acc (n) | cond_dir_conf | opportunity |
|---|---|---:|---:|---:|---:|---:|
| coordinate_clause_rate | clause | 0.77 | 0.44 | 0.70 (43) | 0.83 | 0.197 |
| formulaic_risk | rhetoric_slop | 0.32 | 0.59 | 1.00 (13) | 1.00 | 0.190 |
| 4_gram_repetition | phrasal_repetition | 0.44 | 0.41 | 0.65 (26) | 0.82 | 0.096 |

**Beemo strong near-misses** (just under one threshold, same families):
2_gram_repetition / distinct_2 (miss 0.38, acc 0.79, conf 0.77, opp 0.195), distinct_3 (opp 0.175),
subordinate_clause_rate (miss 0.38, opp 0.167), sentence_cv (miss 0.30, acc 0.73, conf 0.76, opp 0.150).

**LAMP:** no target clears the bar — Fix already moves these (miss rates too low). Top signals:
subordinate_clause_rate (opp 0.107) and 3-gram repetition (opp 0.096), both low-miss.

## The template correction (why raw frozen-100 gaps mislead)
The frozen-100 headline feature-gap flagged `dominant_template_share` as the top Beemo gap. **It is NOT a
safe target**: conditional direction confidence is only **0.115** — humans do not move it in a
source-predictable direction, so instructing Fix to move it would raise volume without a reliable target
direction (risking the direction-agreement floor). Conditioning on source state, not raw gap magnitude,
is what separates safe targets from noise. `template_entropy` is borderline (cond_dir_conf 0.51).

## Smallest family set explaining the safe gap
The lexical_diversity family has 10 highly-correlated members (ttr≈mattr≈distinct_n≈n-gram_repetition all
measure the same repetition/diversity axis), which inflates its raw rollup. Collapsed to distinct levers,
**three families carry almost all the safe Beemo opportunity:**
1. **Lexical/phrasal repetition & diversity** — break repeated 2/4-grams, lift diversity. Fix misses
   ~38–41%; direction source-predictable; Fix accurate when it acts (0.65–0.79).
2. **Clause structure** — coordinate_clause_rate (ideal target) + subordinate_clause_rate (near-miss).
   Fix misses ~38–44%; cond_dir_conf 0.83/1.0.
3. **formulaic_risk** — Fix misses 59% of the reductions humans make, but is **always** right when it
   acts. A slop feature Fix already "knows," just fires too rarely on Beemo.
(sentence_cv / rhythm is a secondary lever: high frequency, moderate miss.)

## Mechanism — WHY Fix misses these (quantified over 200 items)
`prepare_rewrite_context.model_summary.actionable_findings`:
- **0 / 100 items on EITHER corpus** surface ANY structural feature (clause, repetition, rhythm,
  diversity, template, nominalization) in the findings channel. It carries **only** rhetorical/slop
  patterns.
- **Beemo: 72 / 100 items have EMPTY actionable_findings** (median finding_count 0). LAMP: 30 empty.
  Total findings: Beemo 41, LAMP 155.

So against the diagnostic taxonomy, the cause is:
- **"analyzer detects but doesn't surface it"** — `original_humanstats` computes clause density,
  repetition, rhythm, diversity for every item, but the findings channel never emits them.
- **"host never receives an instruction"** — consequently the host gets no structural directive; on
  low-slop Beemo prose 72% of items yield only "preserve anchors / make high-confidence edits / preserve
  voice," so Fix stays passive and under-moves.

It is NOT pragmatics-suppression, host-ignores-instruction, or second-pass-reversal — the instruction
simply never exists. This also explains the genre split: LAMP has more slop findings (mean 2.45) so the
host is nudged into more editing; Beemo (mean 0.67) leaves the host idle.

## Implied intervention shape (NOT built — for the next step)
A narrow, **source-state-gated** structural-findings path: when the conditional model says humans
reliably move feature F given this source's F-state (the safe targets above), emit a specific finding
("this passage chains coordinate clauses; split the highest-confidence instance" — not "vary your
syntax"). Gate strictly on the conditional consensus so it fires only where direction is predictable and
Fix is already accurate — selective coverage, not Humanizer-like volume. Reject if the smoke shows
conditional_direction_agreement, fidelity, or exact-anchor fall vs old Fix (BENCHMARK_FREEZE stop rule).
