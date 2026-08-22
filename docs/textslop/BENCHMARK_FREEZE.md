# BENCHMARK FREEZE — metric set for the frozen-100 comparison

Frozen 2026-08-18, before the frozen-100 run and before seeing which system wins. **After this point,
metrics are not tuned based on results.** Scored deterministically (no LLM judges) against the single
professional human reference. LAMP and Beemo reported separately. Implementation: `chea.py`,
`policy_smoke.score`/`aggregate`, `bootstrap.py`.

## Movement detection (shared by all direction metrics)
A feature counts as "moved" iff `|delta| > MOVE_DEAD_FRAC × median(|human delta| for that feature)`,
with `MOVE_DEAD_FRAC = 0.10` (per-feature dead-zone from the corpus). This removes negligible-delta
false moves. Legacy Reference CHEA keeps its original `|delta| > EPS` definition for continuity.

## Alignment (edit direction)
1. **Reference CHEA** (legacy, EPS-based) — agreement vs the one assigned editor. Kept for continuity;
   structurally rewards heavier editors, so always read with its decomposition.
2. **move_coverage** = (# human-moved features the system also moved) / (# human-moved features).
3. **conditional_direction_agreement** = (# same-direction) / (# features moved by BOTH).
   (Reference CHEA ≈ move_coverage × conditional_direction_agreement.)
4. **conditional_population_chea** — plausibility under `P(human direction | source feature state)`:
   source value binned per feature (3 quantile bins), consensus within bin (≥70% agreement among
   ≥8 movers), backoff bin→global, else **unavailable** (never falls back to the reference sign).
   The scored item's own reference is **excluded** from its population (leave-one-out).
5. **conditional_consensus_only_chea** — (4) scored only on features with a directional consensus
   (the discriminative read; split features excluded rather than auto-credited).
6. **discriminative_coverage** — consensus features / scorable features (per item + corpus summary).

All six reported for `overall, lexical, phrasal, syntax, rhythm, rhetoric, semantic`.

## Fidelity & magnitude
- **fidelity_pass_rate** — deterministic hard-anchor audit pass.
- **exact** — exact-anchor preservation score.
- **edit_magnitude** — 1 − word-level difflib ratio (source→rewrite).
- **jaccard_to_human** — content-token overlap of rewrite vs human reference. **Labeled explicitly as
  lexical overlap, not alignment.**

## Slop residual
- **hcsr** (raw) — `|SED_final − SED_human|`. **Flagged shared-instrument**: FixMySlop edits using the
  same slop-pattern list SED scores with; the humanizer does not. Interpret cross-system HCSR with
  that bias in mind. A held-out SED instrument is future work and does NOT gate frozen-100.
- **normalized_hcsr** — `|SED_final − SED_human| / max(SED_source, 1)`.
- **residual_interval_hit** — 1 if `SED_final ∈ [p25, p75]` of the conditional residual estimator
  `E[SED_H | SED_S, genre]`, else 0.

## Uncertainty
Paired **item-level bootstrap** (2000 iters, seed 1234, 95% CI) on every FixMySlop − Humanizer delta,
with paired **win/loss/tie** counts. A difference is called only when the CI excludes 0.

## Diagnostic
All six CHEA components reported; the smallest set of features explaining meaningful system gaps is
identified (per-feature direction-agreement gap, ranked).

## Replication verdicts
Each n=4 smoke conclusion is graded **replicated** (same direction, CI excludes 0),
**partially replicated** (same direction, CI includes 0), or **failed to replicate** (opposite sign).

No policy, patch-restore, or humanizer-repair changes are made in this pass.
