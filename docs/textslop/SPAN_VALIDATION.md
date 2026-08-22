# Span validation — is E(p) trustworthy? (LAMP fine-grained edits)

Before using Human Edit Propensity for policy, validate the count-based inference (compare pattern
counts in source S vs final H) against **ground truth**: LAMP.json's `fine_grained_edits` =
`[{originalText, editedText, categorization}]`, the actual source spans editors changed, with
categories. `textslopbench/validate_spans.py` locates each annotated span in S and asks, per
Antislop pattern occurrence: did the editor actually touch this span, and did our count-based
method agree?

## Result — 911 LAMP test records

- **Annotation localization: 99.9%** (we found nearly every annotated span in the source).
- **Precision 1.00 · Recall 0.74 · F1 0.85** over 1,274 (record, pattern) cells (574 truly edited).
- By family: **slop** F1 0.872 (P 1.0, R 0.773) · **rhetorical** F1 0.822 (P 1.0, R 0.697).
- **E_inferred vs E_annotated Pearson = 0.88.**

## What it means

1. **Precision = 1.0 — our "edited" calls are never wrong.** When counts drop (H < S), an editor
   genuinely touched that pattern's span. So the *positive* signal is fully trustworthy.
2. **Recall = 0.74 — count-based E systematically UNDERCOUNTS by ~26%**, exactly the failure modes
   predicted: an editor rewrote the surrounding sentence while the pattern's surface survived, or
   the same phrase appears twice and only one instance changed. Every pattern's E_inferred <
   E_annotated. So **count-based E is a validated *lower bound*, not the true rate.**
3. **The "never edited" conclusions were artifacts of undercounting.** Annotation-derived E:

   | pattern | count-based E (100-set) | annotation E (911) |
   |---|---:|---:|
   | elevate | 0.19 | **0.52** |
   | crucial | 0.08 | **0.31** |
   | bustling | 0.24 | **0.36** |
   | intricate | 0.15 | **0.27** |
   | tapestry | 1.00 | 0.80 |

   Editors touch bustling/crucial/elevate far more than raw counts implied. Had we wired the
   count-based profile into policy (as almost happened), FixMySlop would have been told to *leave
   these alone* — wrong. **This is why validation came first.**

## Decisions

- **E is defensible for relative prioritization** (ordering preserved, Pearson 0.88) but **not as
  an absolute probability**.
- **Where span annotations exist (LAMP), use the annotation-derived E** —
  `human-edit-E-annotated-lamp.json` is now the authoritative propensity table.
- **Where they don't (e.g. Beemo), count-based E is a lower bound**, now **Beta-smoothed toward a
  family/global backoff with a confidence tag** (`smoothed_E`, `confidence`) so sparse `E=0`
  (n=4) no longer reads as "never edit" — bustling 0.00 → smoothed 0.165 (low confidence).

## Related fixes this pass (the three nuances)

1. **Smoothing:** `raw_E`, `smoothed_E`, `confidence` per pattern (Beta prior, κ=5, family→global backoff).
2. **`edit_priority_v0`** — renamed and documented as a heuristic prototype, not research truth
   (`log2(ρ) · smoothed_E · repetition`). A calibrated logistic model over (ρ, E, genre,
   repetition, position) is the eventual replacement.
3. **Voice Drift | Intervention** — the human-input track now reports `intervention_rate`,
   `voice_drift_all`, and `voice_drift_given_intervention`. FixMySlop: intervention 0.0, so
   VD|intervention = None (a 0 by not editing is trivial — `cat` scores the same). Humanizer:
   intervention 1.0, VD|intervention 3.41, drift signature 0.64.

## The three distinct concepts (the novel core)

The benchmark now separates what detector-score leaderboards conflate:

- **AI Fingerprint** ρ = P(p|AI)/P(p|human) — *does AI overuse it?* (Antislop)
- **Human Edit Propensity** E = P(edit | p, AI source) — *do editors bother to fix it?* (LAMP spans, validated)
- **Human Edit Alignment** CHEA — *does our system edit like humans do?* (component-split)

Machine-readable: `span-validation-lamp.json`, `human-edit-E-annotated-lamp.json`.
