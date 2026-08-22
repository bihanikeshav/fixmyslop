# v2.1 — the Stage-2 gate, and the decision to ship Option 3

Branch `v2.1-stage1`. Dev data only (LAMP dev-40 + Baumler dev-40); the confirmed-v2 holdouts are **not**
touched or tuned against. This document records the gate that closed the v2.1 first-party investigation and
the decision it produced.

## The question

The confirmed v2 champion is **A_nolock = Humanizer draft → our 2-round fidelity repair** (held-out,
preregistered, Pareto gain over Humanizer; see `V2_CONFIRMATION_PREREG.md`). For an honest **open-source**
release we want a **first-party** Stage-1 built from our own slop taxonomy — not Humanizer's prompt.

Established across ~5 first-party Stage-1 variants (`V2_1_STAGE1.md`, `results/v2_1-*.json`): a first-party
Stage-1 **matches/beats** Humanizer on light-edit creative text (Beemo) and on rhetoric, but **loses on
heavy-edit corpora** (LAMP professional, Baumler correspondence) by ~0.05–0.09 on conditional-direction /
reference-CHEA, and the gap **survives** the repair stage. Before building a new Stage-2 to chase that gap,
we gated it.

## The gate (three deterministic experiments, cached drafts, no holdout inspection)

### 1. Feature-level gap diagnostic (`results/v2_1-gap-diagnostic.json`, `textslopbench/v2_1_gap_diag.py`)
Decomposed the Humanizer-vs-first-party Stage-1 reference-CHEA deficit **feature by feature**, bucketing each:
**A** = fidelity-safe + strong source-state conditional signal + humans move it consistently; **B** =
confident but fidelity-risky; **C** = diffuse (no consistent per-source-state direction, or no local operation).

| bucket | LAMP (deficit 0.082) | Baumler (deficit 0.057) |
|---|---|---|
| A (safe, closeable) | 37.5% | 52.7% |
| B (closeable but risky) | 0% | 29.1% |
| C (diffuse / non-actionable) | 55.3% | 18.2% |

Composition matters more than the percentages: **most of bucket A on both corpora is one lever — lexical
diversification** (TTR / hapax / distinct-n, mutually correlated r≈0.97). That is the *signature of a more
thorough rewrite*, not a local per-span operation. The one clean local safe+confident op is **de-nominalize**
(Baumler only, ~14%). The most confident lever (raise content/lexical density, Baumler) is **fidelity-risky**
(cuts qualifiers/function words). Bucket C — the LAMP majority — has no consistent direction to steer.

### 2. Thoroughness test — Exp 0 (`results/v2_1-exp0-thoroughness.json`, free/deterministic)
Token-level rewrite fraction vs source:

| rewrite fraction | human | Humanizer | first-party |
|---|---|---|---|
| LAMP | 0.30 | 0.62 | 0.52 |
| Baumler | 0.32 | 0.44 | 0.31 |

Humanizer rewrites more than first-party on 39/40 (LAMP) and 38/40 (Baumler) docs — **but both systems already
over-rewrite relative to the human editor**, and first-party is *closer to human volume*, yet still loses CHEA.
Per-doc correlation between the thoroughness gap and the CHEA gap is **weak** (LAMP 0.17, Baumler 0.38). The
deficit is **edit-allocation / direction, not volume.**

### 3. N-pass probe — Exp 1 (`results/v2_1-exp1-npass.json`, the Option-1 gate)
Re-applied the first-party Stage-1 to its own output 2×/3×, then repair:

| | rewrite_frac | cond_dir | reference_chea |
|---|---|---|---|
| **LAMP** hz champion | 0.62 | **0.681** | **0.673** |
| rd 1-pass → 3-pass | 0.52 → 0.54 | 0.626 → 0.623 | 0.596 → 0.607 |
| **Baumler** hz champion | 0.43 | **0.591** | **0.565** |
| rd 1-pass → 3-pass | 0.32 → 0.37 | 0.509 → 0.536 | 0.453 → 0.494 |

Iterating pushes volume **further above** the human editor while alignment barely moves (LAMP flat; Baumler
+0.03) and **never closes** the gap to Humanizer; gains flatten by pass 3; fidelity holds. **Thoroughness is
not the lever.** Option 1 (make our rewriter "more thorough") is bounded as genuinely hard, not a loop-counter.

## Decision (with Fable's adversarial review): **ship Option 3**

- **A per-feature "metric-pushing" Stage-2 is not worth building.** The safe + local + conditionally-confident
  recoverable mass is small (de-nominalize plus minor lexical work). The big safe slice — lexical diversity —
  is holistic, and its only *local* route (forced synonym rotation) is itself a canonical AI-writing tell:
  Goodharting the deterministic metric, not improving the text. We will not do that in an open-source system.
- **"Rewrite more thoroughly under anchor protection" ≈ what Humanizer→repair already does** — our confirmed
  champion. A first-party win would require our own aggressive rewrite to reach Humanizer's *edit-allocation
  quality* without its prompt; every first-party variant so far under-allocates on heavy registers, and Exp 1
  shows volume alone doesn't fix it. That is a real open problem, not a release blocker.

**What ships (wired):**
1. **Champion unchanged:** A_nolock remains the confirmed, held-out v2 (tag `v2-confirmed-baseline`), the
   default in `v2_pipeline.py`. Its Stage-1 prompt is renamed `STAGE1_AGGRESSIVE_SYS` (back-compat alias
   `STAGE1_V2_SYS`); **bytes and the drift-freeze test are unchanged.**
2. **First-party rule Stage-1** is wired as an optional, non-default v2 variant: `run(..., mode="v2",
   variant="rules")` → `STAGE1_RULES_SYS`. It **wins Beemo and Baumler rhetoric**, is non-inferior where it
   can be, and **loses heavy-corpus conditional-direction by ~0.055** — this diagnostic explains *why*
   (holistic edit-allocation, not volume) and why the only local fix is a cheat we decline. Default stays the
   champion; the recommendation is explicit, callers self-route. Bytes frozen by a sha256 drift test.
3. **The open problem is documented**, not hidden: closing the heavy-corpus edit-allocation gap with a
   first-party, non-Goodharting mechanism. If genre-routing is ever pursued, it is a v3 experiment with its own
   preregistration — not release packaging.

## Provenance (RESOLVED — the "dependency" was inflated)
Every Stage-1 prompt in the shipped pipeline is **original text authored in this repo**; none is copied from any
third-party "humanizer" product. Both prompts encode a pattern taxonomy whose ideas trace to the **public,
CC BY-SA "Signs of AI writing"** guidance (see `RESEARCH_REGISTRY.md`). The confirmed Stage-1 was *benchmarked*
under the comparator label "Humanizer" because it emulates that skill's pattern coverage — benchmark lineage,
not authorship. Consequence: there is no third-party prompt text to remove; the champion already is first-party.
Comments/mode vocabulary were de-branded accordingly; prompt bytes were not touched.

## Owner decisions (recorded)
- **Baumler dataset — DO NOT redistribute or ship derived corpus artifacts until licensing/terms are resolved**
  (owner directive). The corpus has no license file (`DATASET_EVAL_RESULTS.md`); it is usable for *local* dev
  scoring only. **Release guard required:** `baumler-corpus.jsonl`, `coverage-dev-baumler.jsonl`, and every
  `policy-smoke-*Baumler*.raw.json` derived cache are currently committed on branch `v2.1-stage1` — they must be
  excluded from any public artifact/push (gitignore going forward does not untrack already-committed files; a
  release requires `git rm --cached` of these paths and/or a scrubbed release branch/export). See the pre-release
  checklist note below. This is the one genuine release blocker.
- **Courtesy credit to Anthropic's humanizer skill: NO** (owner directive). Do not add any credit/attribution to
  the Anthropic humanizer skill. (The prompts are first-party; the comparator label is internal benchmark lineage.)
- **Final licensing/release sign-off** remains the owner's.

### Pre-release hygiene checklist (before any public push/export)
1. Untrack/exclude all Baumler artifacts (corpus, dev split, and `*Baumler*` raw caches) from the public artifact.
2. Confirm no other corpus with an unresolved license (e.g. WQ/WQRM) is present in the export.
3. No Anthropic-skill attribution anywhere in shipped docs/comments.

See [[fixmyslop-v2]] and `V2_1_STAGE1.md`.
