# Span / pattern-family edit-budget model + counterfactual (no model calls)

> **2026-08-23 status:** exploratory counterfactual. Predicted HCSR values are not
> observed rewrite outcomes, and comparator language from the earlier scorer should
> not be read as a current superiority result.

Document-level SED failed as a prompt control (`POLICY_SMOKE.md` round 2): the host cannot steer an
abstract residual. This converts the research signals into **discrete local edit decisions**.
`textslopbench/edit_budget.py`.

## The model

For each candidate occurrence we carry: `pattern_id, family, rho, E, E_confidence, SEL aspect,
repetition, local_cluster_density, genre, pragmatic_relevance`. Per family in a document:

    edit_budget = uncertainty_round( occurrences x E(family,genre) x SEL_weight(aspect) )

- **E** = span-validated human edit propensity (annotation-derived, `precision 1.0` vs LAMP spans),
  with backoff `pattern+genre → pattern global → family+genre → family global` and a confidence tag.
- **SEL_weight** down-weights *general* editing: Redundancy **1.0** (robust); Cliche/Ornament &
  Specificity **0.6** (provisional, genre-confounded); Readability **0.15**; Grammar/Clarity **0.0**.
  Pragmatics may restore a single edit for a general family if the genre calls for it.
- Occurrences are **ranked** within the family (per-pattern E, rho, repetition, local clustering);
  the top `edit_budget` become `priority_spans`, tagged `MUST_/SHOULD_EDIT`, the rest
  `OPTIONAL/PRESERVE`. We do **not** just edit the first N.
- **Host-facing plan** (`host_plan`) exposes only `family, occurrences, edit_budget, priority_spans,
  instruction` — never the raw formulas.

Example host-facing entries:
```json
{"family": "slop_overrepresentation", "occurrences": 5, "edit_budget": 1, "priority_spans": [3],
 "instruction": "Replace only the strongest cliched/ornamental phrasings with plain wording; leave the rest if they read naturally."}
{"family": "negative_parallelism", "occurrences": 1, "edit_budget": 1, "priority_spans": [0],
 "instruction": "Rewrite only the strongest repeated contrast construction; preserve the others unless independently awkward."}
```

## Counterfactual on the frozen 8 items (deterministic, NO model calls)

| | value |
|---|---|
| candidate occurrences (current detect→edit-all) | 63 |
| budget requests | 26 |
| **edits prevented** | **37 (59%)** |
| edits by component (current → budget) | rhetoric 60 → 23, syntax 3 → 3 |
| **mean predicted HCSR** | **edit-all ≈ 53 → budget ≈ 20** (measured current-smoke was 41.7) |

Per item (predicted residual SED under budget vs human):

| item | sed_S | sed_H | pred_SED (budget) | HCSR budget | HCSR edit-all | prevented |
|---|---:|---:|---:|---:|---:|---:|
| lamp_high_sed | 105 | 89 | 84.5 | **4.3** | 88.8 | 6 |
| lamp_cliche | 68 | 79 | 50.9 | 28.6 | 79.5 | 8 |
| lamp_over_suppressed | 71 | 69 | 50.4 | 18.6 | 69.0 | 3 |
| beemo_sed1 | 97 | 80 | 73.5 | **6.6** | 80.1 | 6 |
| beemo_cliche | 89 | 25 | 65.9 | **40.7** | 25.3 | 13 |

## Assessment against the success criteria (step 8)

- ✅ **Meaningfully reduces over-editing** — 59% fewer edits; predicted HCSR ~53 → ~20.
- ✅ **Redundancy weight kept full (1.0)** — but redundancy/filler occurrences were ~0 in these 8
  items, so this is untested here, not exercised.
- ⚠️ **Preserve the archived rhetoric advantage** — rhetoric edit **count** is cut 60 → 23
  (toward the human rate; the highest-E patterns like `tapestry` stay in budget, low-E like
  `bustling` are preserved). Direction should hold, but **the rewrite smoke must verify rhetoric
  CHEA does not drop** from the volume reduction.
- ❌ **Target syntax/rhythm where CHEA trails** — NOT addressed here: syntax occurrences are tiny
  (3) and pragmatics kept them. In this data the over-editing is slop/rhetoric *volume*, not syntax;
  the budget fixes the SED/magnitude problem, not the syntax-direction gap. Those are separate.
- ✅ **No reliance on low-support raw E** — uses span-validated annotation E + confidence + backoff.
- ✅ **No HCSR as a host prompt target** — the plan is span-level; HCSR is scoring only.

## `slop_cap_for_floor` short-document caveat (audit fix)

`slop_cap_for_floor` (the slop-family budget cap tied to the conditional human residual floor)
can return `0` for two very different reasons, which the plain `int` return does not
distinguish:
- the source is genuinely already at/under the human-residual floor (editing would push it
  further below — a real zero budget), or
- the document is too short (`< MIN_TOKENS_FOR_SLOP_CAP = 40` tokens) for the per-1000-token
  density the cap is computed from to be a meaningful signal at all — a single removed span can
  swing it by a large amount.

`slop_cap_for_floor_detail(occs, tokens, floor)` returns `(cap, reason)` with
`reason ∈ {"no_occurrences", "short_document", "already_at_floor", "ok"}`; `build_plan`'s
per-family output now carries this as `slop_cap_reason` so a short-document `0` is never
silently read as "the floor forbids editing here." `slop_cap_for_floor` itself is kept as a
backward-compatible cap-only wrapper.

## Caveats (honest)

- **beemo_cliche is over-preserved** (budget leaves 66, human kept 25 → HCSR worse). Beemo E is
  **LAMP-derived** (no Beemo span annotations → genre confound, low confidence); business editors
  de-slop harder than the LAMP-fit predicts. **Beemo budgets are unreliable** until a business
  span corpus exists — treat them as low-confidence.
- Predicted SED is first-order (editing a span removes its full slop weight; preserving keeps it).
- SEL weights for cliche/specificity remain provisional (genre-confounded).

## Recommendation

The counterfactual is **strongly promising for the LAMP/creative items** (large predicted HCSR
gain, model-actionable, no document-level target). A rewrite smoke is now justified — but it must
(a) confirm **rhetoric CHEA does not regress** from the rhetoric-volume cut, (b) confirm fidelity
holds, and (c) treat **Beemo budgets as low-confidence** (the syntax-CHEA gap is out of scope for
this budget and needs separate work). HCSR and the conditional estimator are retained as metrics /
offline budget-calibration inputs, not host instructions. Machine-readable:
`edit-budget-counterfactual.json`.
