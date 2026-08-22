# Human-edit-grounded TextSlopBench (the new core)

Ground truth is **what professional editors actually did to model prose**, not what an LLM judge
thinks sounds human. For each item: `S` = LLM source, `H` = human edit, `F` = FixMySlop,
`B` = baseline Humanizer. We measure whether a system moves the source in the same
**directions** humans move it — not textual similarity to `H` (two editors rewrite differently).

Implemented deterministically in `textslopbench/human_edit_grounded.py`, zero LLM calls:

1. **Rich feature vector** `f(T)` — ~40 features across lexical (TTR/MATTR/HD-D/distinct-n/hapax),
   phrase repetition, POS, syntax (templates/clauses/nominalization), rhythm, semantic
   redundancy, per-type **Slop Evidence Density** (Antislop ρ-weighted), and rhetorical finding
   densities.
2. **Human Edit Alignment** — corpus-standardized cosine + direction agreement of `ΔF vs ΔH`
   (deltas z-scaled by per-feature human-delta std so risk-in-points doesn't swamp ratios).
3. **CHEA (Conditional Human Edit Alignment)** — bucket items by *source state* (feature
   tertiles), learn the human majority edit direction per (feature, bucket), score whether the
   system moves that feature the human way *given where the source started*. Encodes "if source
   rhythm is already fine, humans leave it alone."
4. **SED-vs-human-target** — compare each system's residual slop density to the **human**
   residual, not to zero.

**Blocked on data:** span-level detection precision/recall needs a span-annotated edit corpus.
Local LAMP has source→reference pairs + pairwise preferences, no per-span DELETE/REWRITE
categories — so that metric is deferred, not faked.

## Results — cross-genre (deterministic, no judge)

**LAMP-24** (literary fiction) and **Beemo-24** (business / QA / instructional). Each cell: the
system whose edit is more human-like is **bold**.

| Metric | | FixMySlop | Humanizer |
|---|---|---:|---:|
| Human-edit cosine | LAMP | 0.177 | **0.323** |
| | Beemo | 0.269 | **0.299** |
| Direction agreement | LAMP | 0.563 | **0.602** |
| | Beemo | 0.564 | **0.617** |
| CHEA (conditional) | LAMP | 0.454 | **0.511** |
| | Beemo | 0.466 | **0.492** |
| Source → **human** SED | LAMP | 12.39 → **10.14** | (same source) |
| | Beemo | 5.38 → **4.69** | (same source) |
| System residual SED | LAMP | 2.23 | 0.91 |
| | Beemo | 0.00 | 0.00 |

## What this says (and why it matters)

1. **Humans barely de-slop — on both genres.** Source→human SED falls only 12.4→10.1 (fiction)
   and 5.4→4.7 (business). Both systems drive SED to ~0. **The human target is the residual, not
   zero, and both systems over-suppress it.** Direct evidence for your point.
2. **Humanizer edits more like humans than FixMySlop on BOTH genres** — all 6 alignment
   comparisons (cosine / direction / CHEA × LAMP / Beemo) favor Humanizer. This is *consistent*,
   not a coin flip, though the margins are modest and n is small. The margin is largest on fiction
   (FixMySlop's aggressive de-slopping diverges most from human fiction editors) and narrows on
   business prose.
3. **The ranking did NOT flip by genre — but the judge does.** 5.6luna preferred FixMySlop ~79%
   on the business/support fixtures, yet human-edit alignment favors Humanizer on business too. So
   the judge is **not** tracking "edits like a human"; it rewards cleaner, more-suppressed text —
   exactly the over-suppression humans don't do. That is the case for grounding the benchmark on
   real edits, sharpened: the LLM judge and human ground truth disagree on *both* genres, and the
   human signal is the consistent one.

## Caveats

n=24 per dataset, **single human reference per item**, two genres. Absolute cosines are low
because human edits are high-variance; the **relative** ranking (Humanizer ≥ FixMySlop, 6/6) is
the signal. Beemo strata were not present in the 24-row slice, so no per-stratum breakdown here.

Machine-readable: `human-edit-grounded-lamp-24.json`, `human-edit-grounded-beemo-24.json`.
Run any dataset: `python textslopbench/human_edit_grounded.py {LAMP|Beemo} 24`.
