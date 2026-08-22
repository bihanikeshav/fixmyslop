# TextSlopBench card (Iteration 3 — human-edit-grounded)

Ground truth is **what real editors changed in model prose**, not "an LLM says this sounds
human." Axes are reported independently and **not collapsed into one score**. Metric names
follow [METRICS_GLOSSARY.md](METRICS_GLOSSARY.md). LLM judges are **demoted to development use
only** (smoke tests, debugging, regression) and are **never part of the official score** — a
3-model panel on these items disagreed at Fleiss κ=0.23, i.e. models don't agree on what human
writing looks like, so averaging their aesthetics is not ground truth.

## Core axes — deterministic, no LLM judge

| Axis | Source | Status |
|---|---|---|
| Claim Fidelity | source claim set (anchor/claim/contradiction/semantic) | available (deterministic anchor pass; NLI TODO) |
| Human-Edit Alignment | corpus-standardized cosine + direction agreement of ΔF vs ΔH on a ~40-feature vector | available ([HUMAN_EDIT_GROUNDED.md](HUMAN_EDIT_GROUNDED.md)) |
| Conditional Human-Edit Alignment (CHEA) | human majority edit direction per (feature, source-state bucket) | available (LAMP-24; scales with data) |
| **CHEA — dual (Reference + Population)** | `chea.py`, wired into `score()`/`aggregate()`. Reference = vs the one assigned editor (stricter); Population = plausibility vs the human edit distribution. Report BOTH + `mode` (`true_multireference`/`corpus_proxy`/`unavailable`) + `gap` (=Pop−Ref) + `population_support` (coverage, consensus/split counts, threshold, fallbacks) + consensus-only Population | available ([chea.py](textslopbench/chea.py), [METRICS_GLOSSARY.md](METRICS_GLOSSARY.md)). LAMP current FixMySlop below; Population is **corpus_proxy** (single-ref data) |
| Slop Evidence Movement | SED vs the **human residual** (target ≠ 0), Antislop ρ-weighted | available (deterministic) |
| Edit Magnitude / Intervention | normalized edit magnitude, lexical retention, intervention rate | available (LAMP/Beemo held-out) |
| Voice Drift (human-input track) | stylometric distance + LLM-direction drift signature vs human source (Voice Under Revision) | available ([voice_drift.py](textslopbench/voice_drift.py)) |
| Voice Fidelity | dialect / cultural-marker preservation (Cultural Ghosting) | slice pending culturally-marked corpus; general voice drift built |
| Regression Preservation | pass 2 didn't drop a pass-1 anchor or reintroduce a removed finding (DELEGATE-52) | available ([regression.py](skills/fixmyslop-humanizer/scripts/regression.py)) |
| Human Edit Propensity E(p) | P(human edits pattern p \| p occurs), per genre; contrasts with Antislop ρ | available ([human_edit_propensity.py](textslopbench/human_edit_propensity.py); ρ-vs-E Pearson 0.67) |
| Span validation of E | count-based E vs LAMP fine-grained edit spans | available ([SPAN_VALIDATION.md](SPAN_VALIDATION.md)): P 1.0 / R 0.74, E_inf-vs-E_ann Pearson 0.88 — count-based E is a validated **lower bound**; annotation-derived E is authoritative |
| Annotation edit priority + quadrants | ρ×E quadrants + counterfactual E-gating on validated E | available ([ANNOTATION_PRIORITY.md](ANNOTATION_PRIORITY.md)): min slop E=0.30 → a pattern-level E-gate suppresses ~0%; the lever is **magnitude (HCSR)**, not pattern on/off |
| Slop-Specific Edit Lift (SEL) | AI→editor (LAMP) vs human→editor (TETRA) per aspect | available ([TETRA_SEL.md](TETRA_SEL.md)): Redundancy +10.7% AI-specific; Readability +0.3% general. Reward slop-specific edits, discount ordinary ones |
| HCSR (conditional) | `residual_estimator.py`: E[SED_H\|SED_S,genre], PAV-monotone, dev-fit | **metric/diagnostic only** — prompt-policy HCSR control **falsified** (host can't steer a document-level residual; see POLICY_SMOKE.md round 2) |
| Edit-budget counterfactual | per-family budget = occ × E × SEL_weight, span-level | available ([EDIT_BUDGET.md](EDIT_BUDGET.md)): predicts 59% less over-editing, HCSR ~53→~20; model-actionable, no doc-level target |
| Component CHEA | direction agreement split lexical/phrasal/syntax/rhythm/rhetoric/semantic | available (in [human_edit_grounded.py](textslopbench/human_edit_grounded.py)) |
| HCSR | \|SED(system) − SED(human edit)\|; lower better — **not** "SED→0" | available (`sed_target.hcsr`) |

### Dual CHEA — current FixMySlop on LAMP (n=4, Population mode = **corpus_proxy**)

| component | Reference | Population | Consensus-only | Gap (Pop−Ref) |
|---|---:|---:|---:|---:|
| overall | 0.474 | 0.971 | 0.887 | +0.497 |
| lexical | 0.417 | 1.000 | — | +0.583 |
| phrasal | 0.500 | 1.000 | — | +0.500 |
| syntax | 0.393 | 0.914 | 0.500 | +0.521 |
| rhythm | 0.375 | 1.000 | 1.000 | +0.625 |
| rhetoric | 0.695 | 0.969 | 1.000 | +0.274 |
| semantic | — | — | — | — |

`population_support`: corpus LAMP, **100** human edits, **5** consensus / **27** split / 32 scorable
features, threshold 0.70, **discriminative_coverage 0.156**, 3 reference-fallback features. The high
Population scores lean on the 27 split dimensions — read them next to consensus-only (0.887 overall)
and the coverage, never alone. The large positive gap says FixMySlop is broadly human-attested even
where it misses the one assigned editor; it is **diagnostic, not automatically good**. Population is a
**corpus proxy**, never true multi-reference. Machine-readable: `results/chea-dual-lamp.json`.

**Edit priority** = ρ-weight · E · context · repetition. Antislop is an **evidence** layer (ρ),
Human Edit Propensity scores it (E, per genre), the pragmatic layer judges context; the policy
decides. "Detect → remove" over-suppresses (SED→0) and edits *less* like humans. See
[HUMAN_EDIT_PROPENSITY.md](HUMAN_EDIT_PROPENSITY.md).

Fidelity is three dimensions — **Claim**, **Semantic**, **Voice**. The official objective is
**never "Human-likeness"** (Wang et al.): edit-alignment, quality, voice, fidelity, and slop are
independent axes and are not collapsed.

## Gold evaluation

Occasional **human evaluators** — the only judge that outranks the deterministic core. Not LLMs.

## Development-only (never scored)

LLM-judge naturalness / writing-quality / register — smoke tests and regression checks only
(`antislop_judged_smoke.py`, `partial_benchmark_judge.py`). Reported as diagnostics, tagged
non-authoritative.

## Blocked on data

**Human Span Alignment** (detection precision/recall: did the analyzer flag the spans editors
changed?) needs a span-annotated edit corpus. Local LAMP has source→reference pairs + pairwise
preferences, no per-span categories — deferred, not faked.

## Deterministic axes available now

**Human-Edit Alignment & Edit Magnitude** — 24-row held-out slices, `gpt-5.6-terra` host
(see [DATASET_EVAL_RESULTS.md](DATASET_EVAL_RESULTS.md)). Frozen **100-row** stratified subsets
are declared for the next run: [`frozen-lamp-100.json`](textslopbench/results/frozen-lamp-100.json)
(5 genres) and [`frozen-beemo-100.json`](textslopbench/results/frozen-beemo-100.json) (5 use-cases).

| System (LAMP-24) | Normalized edit magnitude | Lexical retention→human (overlap) | Delta cosine (alignment) |
|---|---:|---:|---:|
| baseline_humanizer | 0.6999 | 0.3180 | 0.3825 |
| fixmyslop_old | 0.4643 | 0.4831 | 0.4021 |
| fixmyslop_new | 0.5664 | 0.4193 | **0.4157** |

**Human Intervention Quality** — [DONOHARM_EVAL.md](DONOHARM_EVAL.md) /
[`human-input-track-24.json`](textslopbench/results/human-input-track-24.json).

| System | Intervention rate | Anchor/claim fidelity | Rewrite pref | Tie rate |
|---|---:|---:|---:|---:|
| baseline_humanizer | 100.0% | 20.8% | 44/72 | 11.1% |
| fixmyslop | 0.0% | 100.0% | 0/72 | 100.0% |

**Slop Pattern Suppression** — deterministic, secondary. Weighted overrepresented-pattern
density reduction (source → rewrite), patterns weighted by log2(ρ). Reported per system in the
held-out scorer (`slop_suppression_relative`). **Never used to rank systems on its own:** a
system can suppress slop while damaging quality or lexical diversity, so it sits beside, not
above, naturalness/quality/fidelity. See [RESEARCH_REGISTRY.md](RESEARCH_REGISTRY.md).

## Judge axes (DEVELOPMENT-ONLY diagnostics — not part of the official score)

Naturalness, Writing Quality, Register/Voice Fit, and judge-scored Claim Fidelity are **LLM-judge
diagnostics**, kept for smoke/regression only after the κ=0.23 disagreement (see header). They are
**not authoritative** and never enter the ranking; the deterministic core + gold human evaluation
do. Any pinned `gpt-5.6-terra`/GPT-panel run here is a diagnostic snapshot, not the score.

| System | Naturalness | Writing Quality | Register/Voice | Claim Fidelity (judge) |
|---|---|---|---|---|
| baseline_humanizer | — | — | — | — |
| fixmyslop_new | — | — | — | — |
