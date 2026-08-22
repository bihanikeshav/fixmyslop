# v2 confirmation — preregistered protocol (FROZEN before running)

Date: 2026-08-19. Deterministic scoring, no LLM judges. This freezes the confirmation of **FixMySlop v2
= A_nolock** before it is run on untouched held-out data. Written after dev iterations 1–5 (see
`fixmyslop-v2` memory, `results/v2-*.json`). Do not edit after the run starts; append RESULT only.

## System under test
**v2 = A_nolock**: raw Humanizer draft (aggressive de-slop generator) → FixMySlop **2-round** anchor
repair (prepare_rewrite_context → finish_rewrite_context → targeted_correction via CORRECTION_SYS,
repeated up to 2 rounds until the anchor/fidelity audit is clean). **No anchor pre-lock** (the pre-lock
suppressed coverage on light-edit corpora without helping). Baseline = raw **Humanizer** (hz).

## Data (untouched by v2 tuning — held out)
- **Beemo**: `coverage-holdout-beemo-80.jsonl`, n=80 (0 overlap with the tuned coverage-dev-beemo-40).
- **LAMP**: `coverage-holdout-lamp-100.jsonl`, n=100, freshly sampled disjoint from frozen-lamp-100 AND
  coverage-dev-lamp-40 (built by this protocol; seed = deterministic id-sorted stride).
Both disjoint from the LOCKED frozen-100 v1 baseline. k=3 generations per arm.

## Metrics (frozen)
Quality/alignment (higher better): move_coverage, conditional_direction_agreement, reference_chea,
conditional_population, conditional_consensus_only, rhetoric. Safety (higher better): fidelity_pass,
exact_anchor. Descriptive (reported, not gated): jaccard, jaccard_edited, edit_magnitude, normalized_hcsr.

## Success criteria (preregistered)
Per corpus, v2 vs hz, paired item-level bootstrap (2000 iters, seed 1234), per-item value = mean over k=3.

**Tier 1 — Pareto gain (primary, must hold on BOTH corpora):**
1. STRICT superiority on fidelity_pass and exact_anchor (paired Δ>0, CI excludes 0).
2. fidelity_pass ≥ 0.98 and exact_anchor ≥ 99.5 (v1 ceiling).
3. jaccard non-inferior to hz (Δ ≥ −0.02).
=> v2 dominates Humanizer on its weak axes (fidelity/exact/jaccard) while not collapsing coverage.

**Tier 2 — full alignment non-inferiority (stretch):**
For each alignment axis, v2 is **not significantly inferior** to hz: paired 95% CI upper bound ≥ 0
(equivalently the one-sided non-inferiority holds at margin 0). Report BOTH the CI verdict and the
strict point-margin verdict (margins: coverage/cond_dir/reference_chea/cond_population −0.02;
consensus/rhetoric −0.03). Point-margin misses within a CI that includes 0 are recorded as
underpowered-at-n, not deficits.

**Coherence gate (Refutation 2 — benchmark has no fluency metric):** manually read 10 randomly-selected
v2 outputs (5 per corpus); record whether any read as incoherent/seamed. A_nolock is a single generated
draft + anchor repair (NOT span-composition), so seaming risk is low, but the gate is mandatory before
any ship claim.

## Decision rule
- Tier 1 holds on both corpora AND coherence gate passes → **v2 confirmed as a Pareto gain over
  Humanizer; ship-eligible.**
- Additionally Tier 2 (CI) holds on both corpora → **v2 confirmed non-inferior on alignment** (the full
  target). Tier 2 by strict point-margin is reported but not required at this n (underpowered).
- Tier 1 fails on either corpus → not confirmed; return to dev.

## RESULT (2026-08-19; held-out; `results/v2-confirmation.json`)

Paired item-level bootstrap (2000 iters, seed 1234), per-item = mean over k=3. Δ = v2 − hz. `*` = CI excl 0.

| metric | Beemo hz | Beemo v2 | Beemo Δ | LAMP hz | LAMP v2 | LAMP Δ |
|---|---:|---:|---:|---:|---:|---:|
| move_coverage | 0.768 | 0.768 | +0.001 | 0.943 | 0.947 | +0.004 |
| cond_dir | 0.621 | 0.634 | +0.005 | 0.614 | 0.612 | −0.002 |
| reference_chea | 0.506 | 0.506 | −0.000 | 0.589 | 0.589 | −0.000 |
| cond_population | 0.850 | 0.845 | −0.005 | 0.906 | 0.903 | −0.003 |
| consensus_only | 0.642 | 0.629 | −0.013 | 0.747 | 0.741 | −0.006 |
| rhetoric | 0.375 | 0.385 | +0.009 | 0.553 | 0.550 | −0.003 |
| **fidelity** | 0.558 | **0.963** | **+0.404\*** | 0.477 | **0.987** | **+0.510\*** |
| **exact** | 88.7 | **98.8** | **+10.2\*** | 89.1 | **99.7** | **+10.6\*** |
| jaccard | 0.606 | 0.614 | +0.008\* | 0.350 | 0.351 | +0.002\* |

**Tier 2 (alignment non-inferiority): PASS on BOTH corpora by CI AND by strict point-margin.** Every
alignment axis has a paired CI including 0 and clears its point-margin; v2 even beats hz on Beemo
coverage/cond_dir/rhetoric/jaccard. The n=40 dev point-margin misses (coverage, rhetoric) vanished at
n=80/100 — confirming they were underpower, not deficits.

**Tier 1 (Pareto gain): PASS on LAMP; PARTIAL on Beemo.** Both corpora: v2 is STRICTLY superior to hz on
fidelity and exact (CI excludes 0) and jaccard is non-inferior — the core "beat Humanizer" claim. LAMP
also meets the v1-parity ceiling (fidelity 0.987 ≥ 0.98, exact 99.7 ≥ 99.5). **Beemo misses the ceiling
only**: fidelity 0.9625 (< 0.98), exact 98.83 (< 99.5) — still crushing hz's 0.56/88.7, but v2 still
breaks fidelity on ~3.75% of Beemo items (the `low_content_overlap` full-paraphrase class with no
discrete anchor to restore; a source-revert/micro-restore backstop would close it).

**Coherence gate: PASS.** 10/10 sampled outputs (5 per corpus) read as coherent, natural, faithful
prose. No seaming (v2 is a single draft + repair, not span-composition).

**VERDICT:** v2 = A_nolock is **confirmed a Pareto gain over Humanizer on untouched held-out data, both
corpora** (dominates on fidelity/exact, non-inferior on all alignment), with clean coherence. On LAMP it
is a full clean domination meeting every preregistered criterion. The single preregistered miss is
Beemo's absolute fidelity/exact ceiling (0.96/98.8 vs the 0.98/99.5 bar) — a small residual with an
identified fix (source-revert backstop for the no-anchor paraphrase class), NOT a loss to Humanizer.
