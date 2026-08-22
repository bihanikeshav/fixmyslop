# Human Edit Propensity — what editors actually fix (ρ ≠ E)

Deterministic corpus analysis, no LLM judge, no rewrite calls. For every Antislop pattern
occurrence (plus key rhetorical constructs) in an LLM source S, classify its fate in the
professional human edit H: **REMOVED** (gone), **MODIFIED** (fewer, not gone), **PRESERVED**
(kept ≥ as often). Then **E(p) = P(human edits p | p occurs)**.

`textslopbench/human_edit_propensity.py` — run: `python … {LAMP|Beemo} 100`.

## ρ (fingerprint) and E (what editors fix) are different quantities

LAMP-100, slop patterns with known Antislop ρ, ranked by the derived **edit priority**
(`log2(ρ) · edit% · repetition`):

| pattern | ρ | edit % | keep % | priority |
|---|---:|---:|---:|---:|
| tapestry | 15 | 1.00 | 0.00 | 3.91 |
| realm | 7 | 0.67 | 0.33 | 1.87 |
| not_x_but_y | 6 | 0.60 | 0.40 | 1.71 |
| testament | 8 | 0.46 | 0.54 | 1.44 |
| vibrant | 7 | 0.31 | 0.69 | 0.88 |
| nuanced | 5 | 0.17 | 0.83 | 0.39 |
| **bustling** | **9** | **0.00** | **1.00** | **0.00** |
| **intricate** | **6** | **0.00** | **1.00** | **0.00** |
| crucial / moreover / elevate / landscape | 4–5 | 0.00 | 1.00 | 0.00 |

**ρ vs edit% Pearson = 0.67** — overrepresentation predicts editing *decently but imperfectly*.
The residual is the whole point: **bustling (ρ=9) and intricate (ρ=6) are strong AI fingerprints
that fiction editors never touch.** ρ says "model-ish"; E says "editors don't care here." Only
both together give an edit priority. Rule-of-three is edited just 19% (kept 81%); participial
tails kept 78% — both far below what a "detect → remove" policy assumes.

## Genre matters (LAMP fiction vs Beemo business)

Editors **keep** "moreover" / "crucial" in fiction but **remove** "additionally" (100%) and
"when it comes to" (67%) in business prose. E must be genre-conditioned — a single global table
would mis-prioritize both genres. Per-genre learned E-profiles are written to
`human-edit-propensity-profile-{lamp,beemo}-100.json` for the policy layer.

## The policy shift this enables

Antislop moves from an **execution** layer to an **evidence** layer:

```
Antislop: "this looks statistically model-ish"  (ρ)
   → Human-edit model: "editors usually do / don't fix this"  (E, per genre)
   → Pragmatic layer: "in THIS context it is / isn't awkward"
   → rewrite policy decides   (priority = ρ-weight · E · context · repetition)
```

"detect → remove" is what made FixMySlop over-suppress (SED → ~0) and edit *less* like humans.
Priority-gating by E fixes that directly.

## Component CHEA — where the alignment gap actually is

Splitting CHEA/direction agreement by feature family (was hidden in one number):

| component | LAMP Fix | LAMP Human | Beemo Fix | Beemo Human |
|---|---:|---:|---:|---:|
| lexical | 0.57 | **0.61** | 0.61 | **0.67** |
| phrasal | **0.41** | 0.35 | 0.64 | **0.78** |
| syntax | 0.54 | **0.65** | **0.52** | 0.50 |
| rhythm | 0.67 | 0.67 | 0.54 | **0.69** |
| rhetoric | **0.67** | 0.60 | 0.56 | **0.59** |

**FixMySlop already edits rhetoric more like humans than Humanizer on LAMP (.67 vs .60)** — its
analyzer is not the problem. The overall Humanizer lead comes from **syntax (LAMP)** and
**rhythm/phrasal (Beemo)**. That is the concrete tuning list, invisible in the scalar CHEA.

## HCSR — Human-Calibrated Slop Residual

`sed_target.hcsr` = |SED(system) − SED(human edit)|. Lower is better; **driving SED to 0 is
penalized because humans don't** (LAMP human residual ≈10.1, Beemo ≈4.7). LAMP: Fix 10.36 vs
Humanizer 11.05 (Fix marginally closer); Beemo: both 4.69 (both over-suppress to 0). Replaces
"maximize slop suppression" with "resemble human editorial suppression."

Caveats: count-based per-item classification (presence/reduction), not span alignment; n=100 (LAMP)
/ smaller stable set (Beemo); single human reference; seed ρ table. The **Δ(AI→editor) vs
Δ(human→editor)** contrast (is this AI-cleanup or ordinary editing?) needs TETRA — adapter
scaffolded, pending data.
