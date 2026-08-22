# Frozen-100 results — FixMySlop vs baseline Humanizer

Scored by the frozen metric set (BENCHMARK_FREEZE.md) on the full held-out sets: LAMP n=98 (2 lost to a
model JSON error, salvaged 11/12 of one chunk), Beemo n=100. Deterministic; no LLM judges. Paired
item-level bootstrap (2000 iters, seed 1234); `*` = 95% CI excludes 0. Δ = FixMySlop − Humanizer.
Source: `results/frozen-100-report.json`.

## Headline

| metric | LAMP fx | LAMP hz | LAMP Δ | Beemo fx | Beemo hz | Beemo Δ |
|---|---:|---:|---:|---:|---:|---:|
| reference CHEA | 0.557 | 0.614 | **−0.057*** | 0.485 | 0.555 | **−0.070*** |
| ├ move_coverage | 0.85 | 0.95 | **−0.100*** | 0.653 | 0.803 | **−0.150*** |
| └ conditional_direction_agreement | 0.621 | 0.639 | −0.017 | 0.657 | 0.654 | −0.019 |
| conditional_population | 0.858 | 0.892 | **−0.035*** | 0.821 | 0.865 | **−0.045*** |
| conditional_consensus_only | 0.674 | 0.764 | **−0.090*** | 0.507 | 0.623 | **−0.116*** |
| fidelity_pass | 0.929 | 0.49 | **+0.439*** | 0.87 | 0.47 | **+0.400*** |
| exact_anchor | 98.6 | 88.6 | **+10.0*** | 96.8 | 86.0 | **+10.8*** |
| edit_magnitude | 0.292 | 0.66 | **−0.368*** | 0.154 | 0.422 | **−0.269*** |
| jaccard_to_human (lexical overlap) | 0.537 | 0.335 | **+0.202*** | 0.469 | 0.399 | **+0.069*** |
| hcsr (raw, shared-instrument) | 11.83 | 13.81 | **−1.98*** | 3.60 | 3.24 | +0.352 |
| normalized_hcsr | 0.778 | 0.812 | −0.034 | 1.616 | 1.302 | +0.314 |
| residual_interval_hit | 0.684 | 0.633 | +0.051 | 0.97 | 0.99 | −0.020 |
| sed_final | 2.66 | 0.71 | **+1.95*** | 0.695 | 0.32 | +0.375 |

## The headline reframing (Fable's W2, confirmed at scale)

**The humanizer's entire alignment "edge" is edit VOLUME, not edit QUALITY.** Decomposing Reference
CHEA proves it:
- **move_coverage** — humanizer moves far more of the human-moved features (0.95 vs 0.85 LAMP; 0.80
  vs 0.65 Beemo), because it edits ~2–3× more (edit_magnitude 0.66 vs 0.29 LAMP).
- **conditional_direction_agreement** — among features BOTH systems moved, agreement with the human is
  a **statistical tie on both corpora** (Δ −0.017 CI [−0.054,+0.017]; Δ −0.019 CI [−0.065,+0.024]).

So once you control for coverage, the two systems pick the human's direction **equally well**. Every
CHEA metric where the humanizer "wins" (reference, conditional_population, consensus_only) is riding on
coverage — it moves more features, so it collects more human-moved features by default. This is exactly
the magnitude confound Fable predicted, and it dissolves the n=4 story that the humanizer had "better
edit-direction sense."

## Replication verdicts (n=4 smoke → n≈100)

| conclusion | verdict | scale Δ |
|---|---|---|
| FixMySlop is lighter-touch (edit magnitude) | **replicated** | −0.37 / −0.27 |
| Humanizer aligns better on Reference CHEA | **replicated** — but coverage-driven (see above) | −0.057 / −0.070 |
| FixMySlop preserves fidelity, humanizer breaks it | **replicated** (strong) | +0.44 / +0.40 |
| FixMySlop stays closer to human wording (jaccard) | **replicated** | +0.20 / +0.069 |
| FixMySlop better HCSR on LAMP | **replicated** (LAMP only) | −1.98 |
| Humanizer over-suppresses on LAMP (lower SED) | **replicated** (LAMP only) | +1.95 |
| FixMySlop wins consensus-only Population on LAMP | **FAILED — reverses** | −0.090 (humanizer wins) |

The one failure matters: at n=4 FixMySlop appeared to win the discriminative population read on LAMP
(0.887 vs 0.775); at n=98 under the frozen conditional metric it **reverses** — humanizer wins
consensus-only (CI excludes 0). That n=4 result was noise. Consistent with the reframing: humanizer's
higher coverage lifts it on the consensus features too.

## What's genuinely FixMySlop's (survives scale, not coverage artifacts)
Fidelity (+0.44/+0.40, near-perfect vs humanizer's coin-flip), exact-anchor (+10 pts), lightness
(edit_magnitude), and staying closer to the human's actual wording (jaccard). On LAMP it also lands
closer to the human slop residual (HCSR −1.98) because the humanizer over-strips (SED 0.71 vs human
residual ~2–3). **On Beemo the HCSR/SED gaps vanish** (all CIs include 0; both hit the residual band
0.97/0.99) — the n=4 Beemo differences were noise.

## Smallest feature set driving the gaps
LAMP: `lexical_density` / `content_function_ratio` (n=90), `subordinate_clause_rate` (n=71),
`nominalization_proxy_rate` (n=85). Beemo: `dominant_template_share` (n=61), `template_entropy` (n=63),
`nominalization_proxy_rate` (n=67), `unique_template_ratio` (n=20). In every high-n case the humanizer
"agrees more with the human" purely because it moves the feature and FixMySlop leaves it — coverage,
not direction (conditional_direction_agreement is tied). Moving these in FixMySlop would raise coverage
but, on this evidence, not necessarily direction quality.

## Measurement changes that made this readable
Source-state-conditioned consensus lifted discriminative coverage 0.156 → 0.453; the Reference
decomposition separated the coverage confound from direction quality; paired bootstrap gave every
delta a CI so noise (the consensus-only reversal, the Beemo HCSR nulls) is visible instead of asserted.
