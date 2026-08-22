# TextSlopBench metric glossary

This glossary pins metric names so that overlap and edit-magnitude measures are never
reported as "fidelity." It is the canonical vocabulary for every report and report-writer
script in this repository (Iteration 2, review point 2).

## Reserve "fidelity" for meaning preservation only

**Fidelity** is measured against the *source claim set*, not against a human reference or
any overlap statistic. It covers:

- **Hard-anchor preservation** — numbers, dates, entities, URLs, citations, commands, UI
  labels, quotations reproduced exactly (`anchors.audit_anchor_coverage`, `fidelity.audit`).
- **Claim preservation** — the asserted facts still hold.
- **Contradiction / qualification preservation** — hedges, scope limits, and causal
  relationships are neither dropped nor strengthened.
- **Semantic equivalence** — the revision means the same thing.

A rewrite can have low overlap with the source and still be perfectly faithful (heavy but
meaning-preserving edit), and can have high overlap and still be unfaithful (a single
flipped number). Overlap is therefore never fidelity.

## Do NOT call these "fidelity"

| Canonical name | What it measures | Reference point |
|---|---|---|
| **Lexical retention** | Content-word overlap between **source** and **rewrite** | source (how much wording was kept) |
| **Normalized edit magnitude** | Token edit distance / length, source → rewrite | source (how much changed) |
| **Word-delta (edit magnitude)** | Signed change in word count, source → rewrite | source |
| **Human-edit overlap** | Content-word overlap between **rewrite** and the **human edit** | human reference (did it keep the same words) |
| **Human-edit delta alignment** | Similarity of the *change vector* to the human's change vector; reported as **delta cosine**, **direction agreement**, and **n-gram / lexical delta alignment** | human reference (did it change the same things) |

Human-edit overlap and human-edit delta alignment are *alignment-to-a-reference* diagnostics.
They are not naturalness judgments and not fidelity.

## CHEA — two flavours (Conditional Human-Edit Alignment)

CHEA measures whether a rewrite moves each edit-feature (the `edit_delta` vector) in a human-like
DIRECTION. It comes in two versions; **report both** (`textslopbench/chea.py`):

- **Reference CHEA** — `CHEA_ref(S, H_i, R)`: agreement with the ONE assigned editor's edit
  directions. Objective and reproducible, but penalises a plausible edit merely for differing from
  an arbitrary reference. This is the original CHEA.
- **Population CHEA** — `CHEA_pop(S, {H_1..H_k}, R)`: is each move PLAUSIBLE under the distribution
  of human edits? A system scoring **Reference 0.47 / Population 0.97** (current FixMySlop, LAMP) is
  behaving like humans in general even when it misses the arbitrary reference editor.

**Population proxy (current).** True Population CHEA needs several human edits of the SAME source.
LAMP and Beemo are strictly single-reference (100 unique LAMP sources, 1 edit each — verified), so
we approximate the population with the CORPUS of human edits: per feature, humans are `consensus`
(move it the same way ≥70% of the time) or `split`. A system move is human-attested if it matches a
consensus direction, or the feature is split (either direction plausible), else it falls back to the
reference sign. This is a feature-direction proxy, not the true per-source population — labelled as
such in output.

**Why this matters for E.** With true multi-edit-per-source data we could measure per-occurrence
disagreement `P(edit this exact span | humans)` directly, instead of today's cross-document edit
propensity (`E`, span-validated but pooled across unrelated documents). That is the single most
valuable data acquisition for this benchmark: collect K independent human edits per source, which
simultaneously (a) enables true Population CHEA and (b) upgrades E from a cross-document prior to a
per-span human-disagreement rate.

Population CHEA still discriminates — it did NOT wash out the diff-and-patch rhetoric regression
(0.969 → 0.905), because the culprit `rhet_promotional` is a consensus feature (see
`PATCH_RESTORE.md`).

### Canonical output schema (`aggregate()["chea"]`)

The benchmark scorer (`policy_smoke.score`/`aggregate`, using `chea.py` — no duplicated logic)
emits, for every run with human references, a `chea` block. Reference and Population are **never
collapsed** into one number.

- `mode` — `true_multireference` | `corpus_proxy` | `unavailable`. Report the label explicitly;
  never present `corpus_proxy` as true multi-reference scoring.
- `reference` — Reference CHEA by `overall` + the 6 components (`lexical, phrasal, syntax, rhythm,
  rhetoric, semantic`). The **stricter** benchmark.
- `population` — Population CHEA, same keys.
- `population_consensus_only` — Population scored ONLY on features with a directional consensus.
  This is the discriminative read: if most features are `split`, ordinary Population approaches a
  plausibility check, so consensus-only is the number that resists inflation.
- `gap` — `population − reference`, overall and by component. **Diagnostic, not automatically good:**
  a large gap means the edit is broadly human-attested but differs from this item's specific editor.
- `population_support` — `{corpus, mode, n_human_edits, consensus_features, split_features,
  scorable_features, consensus_threshold (0.70), discriminative_coverage = consensus/scorable,
  fallback_features_total, scored_features_total}`. Never read a Population score without it: LAMP
  has coverage 0.156 (5 consensus / 32 scorable), so a 0.97 leans heavily on split dimensions.

## Judge axes (model-scored, separate from the above)

Naturalness, Writing Quality, Register/Voice Fit, and Claim Fidelity are model-judge scores.
Only the last is a fidelity axis; it is graded against the source claim set, consistent with
the definition above.
