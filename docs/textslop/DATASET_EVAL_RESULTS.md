# Iteration 1 held-out dataset results

These are first held-out diagnostics, not benchmark-wide claims and not a tuning target. All host outputs used `gpt-5.6-terra`, medium reasoning, priority service tier, inherited/default temperature. The source corpora stay local; reports contain derived metrics only. Metric names follow [METRICS_GLOSSARY.md](METRICS_GLOSSARY.md); none of the overlap or edit-magnitude columns below are fidelity.

## LAMP

The 24-row subset was selected by stable SHA-256 order from the released original `test` split. The participant/professional edit is the reference. The table measures edit magnitude and alignment to the human edit delta, not naturalness.

| System | Normalized edit magnitude | Human-edit overlap | 3-gram delta alignment | Lexical delta alignment | Delta cosine (alignment) | Direction agreement |
|---|---:|---:|---:|---:|---:|---:|
| source AI | 0.0000 | 0.7167 | 0.0000 | 0.0000 | 0.0000 | 0.3365 |
| baseline Humanizer | 0.6999 | 0.3180 | 0.1784 | 0.1601 | 0.3825 | 0.6250 |
| FixMySlop old | 0.4643 | 0.4831 | 0.1712 | 0.1567 | 0.4021 | 0.6410 |
| FixMySlop new | 0.5664 | 0.4193 | 0.1753 | 0.1588 | 0.4157 | 0.5929 |
| professional human edit | 0.2997 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 |

The new system is closer to the human edit than baseline on human-edit overlap and makes fewer edits than baseline. Against old FixMySlop the picture is mixed: new **leads on human-edit delta alignment** (delta cosine 0.4157 vs 0.4021) but **trails on human-edit overlap** (Jaccard 0.4193 vs 0.4831) and makes more edits (normalized edit 0.5664 vs 0.4643). It is not better on phrase-reuse overlap or direction agreement in this small sample. (Correction: an earlier draft of this paragraph said new trailed old on delta cosine; the table above shows the opposite.)

## Beemo

The MIT Parquet release contains one `train` shard with 2,187 rows and no row-level test field. The 24 rows below are a stable held-out-from-this-run slice and are labeled `unspecified`; do not report them as a canonical test score.

| System | Normalized edit magnitude | Human-edit overlap (expert) | 3-gram delta alignment | Lexical delta alignment | Delta cosine (alignment) | Direction agreement |
|---|---:|---:|---:|---:|---:|---:|
| source AI | 0.0000 | 0.5100 | 0.0000 | 0.0000 | 0.0000 | 0.2115 |
| baseline Humanizer | 0.6804 | 0.3296 | 0.2869 | 0.2292 | 0.4417 | 0.6571 |
| FixMySlop old | 0.2513 | 0.4737 | 0.1894 | 0.1597 | 0.3575 | 0.5545 |
| FixMySlop new | 0.4615 | 0.4187 | 0.2417 | 0.1911 | 0.3208 | 0.6186 |
| expert edit | 0.6147 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 |
| independent human output | 0.9804 | 0.2308 | 0.2916 | 0.2592 | 0.2765 | 0.6218 |

Beemo shows a real tradeoff, but not a win for this iteration: new FixMySlop is closer to the expert edit than baseline on content overlap and 3-gram/lexical delta overlap, while its human-delta cosine (0.3208) is below old FixMySlop (0.3575). This supports using multiple delta metrics rather than retention alone and keeping the iteration diagnostic.

## Not scored this iteration

Baumler was retrieved and normalized, including treatment post-edits and independent-control tasks, but its public repository has no explicit license file. It is held locally pending terms confirmation. WQ/WQRM was not scored because a safe usable preference-pair snapshot was not retrieved.

Machine-readable reports: [lamp-eval-24.json](textslopbench/results/lamp-eval-24.json), [beemo-eval-24.json](textslopbench/results/beemo-eval-24.json).

## Do-no-harm human-original slice

The 24 Beemo human outputs were re-used as inputs, not references to optimize toward. FixMySlop preserved all 24 texts exactly and passed all inferred-anchor checks. Baseline Humanizer preserved 0/24 exactly, had mean normalized edit 0.5350, content Jaccard 0.5483, and passed the inferred-anchor check on 5/24. Three diagnostic judges then compared untouched original vs each rewrite. For baseline, the rewrite was preferred 44/72 times, original 20/72, with 8 ties; for FixMySlop, all 72 comparisons were ties because the output was identical. This illustrates why preference and preservation must be reported separately: the judge preference for baseline does not erase its large automatic edits to human-written inputs.

Details: [DONOHARM_EVAL.md](DONOHARM_EVAL.md), [donoharm-eval-24.json](textslopbench/results/donoharm-eval-24.json), and [donoharm-judges-24.json](textslopbench/results/donoharm-judges-24.json).
