# Research registry

External research FixMySlop draws on, and exactly what we adopt from each. The stack is
complementary: hand-curated visible patterns, empirical overrepresentation, stylometry,
grammatical templates, human-edit corpora, and a pragmatic genre layer.

| Source | Contributes | Adopted here | Not adopted |
|---|---|---|---|
| **Humanizer** (Wikipedia "Signs of AI writing") | hand-curated visible AI-writing patterns | `humanstats` PATTERNS families | — |
| **Antislop** (Oct 2025) | empirically overrepresented words / bigrams / trigrams / constructions | `slop_overrepresentation` family + `slop_profile.json` + SPS metric + HD-D/Distinct-n diversity | sampler + FTPO (need logit/weight access; heavy inference overhead) |
| **El Attar** | broad linguistic/stylometric feature families + robustness | `humanstats` lexical/pos/syntax/rhythm sections | — |
| **Shaib syntactic templates** | grammatical construction repetition | `humanstats` template entropy / dominant-template share | — |
| **LAMP / Beemo / Baumler** | what humans actually change | held-out human-edit alignment (`dataset_eval`) | Baumler scoring pending license confirmation |
| **FixMySlop pragmatic layer** | what appropriate writing should do in its genre | `pragmatics` genre profiles | — |

## Antislop — detail

**Paper:** "Antislop: A Comprehensive Framework for Identifying and Eliminating Repetitive
Patterns in Language Models" (Oct 2025). Core statistic: **ρ(p) = f_LLM(p) / f_human(p)** — a
pattern's frequency in model output over its frequency in a human baseline. Some patterns ran
>1,000× a human baseline. Fingerprints cluster by model family. Code/results MIT-licensed
(auto-antislop / slop-forensics).

**What we ported (pattern-profile + scoring only):**
- `slop_overrepresentation` humanstats family: flags overrepresented unigrams, bigrams,
  trigrams, and rhetorical templates, each carrying ρ and a log2(ρ) weight, as
  `review_in_context` evidence — **never bans** (the paper shows blunt token banning causes
  collateral damage; softer/targeted methods preserve quality). Findings flow to the rewriter
  as evidence, then get rewritten contextually.
- **Slop Pattern Suppression (SPS):** weighted reduction in overrepresented-pattern density,
  source → rewrite, patterns weighted ~by ρ so removing a ρ=300 phrase counts more than a ρ=6
  one. **Secondary metric only** — never rank systems by it (a system can suppress slop while
  hurting quality/diversity).
- **Diversity parity:** added HD-D and Distinct-1/2/3 (+ MATTR-500) alongside our existing
  MATTR/root-TTR/hapax, matching Antislop's length-controlled diversity battery so we can
  compare implementations rather than reinvent subtly different ones.

**What we deliberately did NOT port:** the backtracking sampler and FTPO. Both require
model-weight/logit access and add substantial inference overhead; FixMySlop must run as a
post-generation rewriter on arbitrary host models.

**Open items (not blindly copied):**
1. **Genre-conditioned baseline.** Antislop's human baseline (Reddit creative writing +
   Gutenberg, stopwords removed for n-grams) is wrong for support emails / abstracts / READMEs.
   Our ρ table must eventually be `f_LLM(genre) / f_human(genre)`. `slop_profile.json` carries
   `genre_overrides` as the seam; the seed weights are approximate and flagged as such.
2. **Model-aware profile.** Default is a cross-model consensus profile. When the source model
   is known (`source_model`), overlay its family profile. TextSlopBench items often know the
   generating model, so we can test: *does FixMySlop remove the source model's actual
   fingerprint?* (`model_profiles.families` is the seam; empty by default.)
3. **Reuse slop-forensics data** where licensing/provenance permits to replace the seed table.

---

## Sweep 2 (2026-08) — voice, human-editor distributions, regression, perception

Priority-ordered by implementation impact. **Built** = deterministic, runnable now; **pending
data** = code/spec ready, needs an external corpus we don't have locally.

| Paper | Contributes | Status here |
|---|---|---|
| **Voice Under Revision** (van Nuenen, 2026) | LLMs pull human prose in a consistent direction even when told to preserve voice (fewer contractions/function-words/first-person; more diversity/word-length/punctuation); outputs converge | **Built** — `voice_drift.py` (Voice Drift + per-marker deltas + LLM-direction drift signature) on the human-input track |
| **TETRA** (Ito et al. 2022; github.com/chemicaltree/tetra, **CC BY 4.0**) | ACL papers revised by human experts; **human → human-editor** distribution with typed edits | **Built** — `adapters/tetra.py` (191 docs, 4,125 edits) + `slop_specific_lift.py`. Δ(AI→editor) vs Δ(human→editor) → **Slop-Specific Edit Lift**: Redundancy +10.7% is AI-specific; Readability restructuring (+0.3%) is ordinary editing. See [TETRA_SEL.md](TETRA_SEL.md) |
| **Cultural Ghosting** ("When AI Writes, Whose Voice Remains?", 2026) | LLM rewriting preserves semantics while stripping dialect/cultural markers; explicit preservation only partly helps | adds a **Voice Fidelity** dimension to fidelity (Claim / Semantic / **Voice**); marker detection **pending** a culturally-marked corpus; general voice-drift already measured |
| **Is Human-Like Text Liked by Humans?** (Wang et al., ACL 2026) | humans detect machine text well, but do NOT consistently prefer human text blind; differences in concreteness/cultural-nuance/diversity | validates the multi-axis design — **the official objective is never "Human-likeness."** Human-edit alignment, quality, voice, fidelity, and slop stay separate axes |
| **DELEGATE-52** (LLMs Corrupt Your Documents When You Delegate, 2026) | long delegated editing accumulates corruption (~25% by end); worsens with length/distractors | **Built** — `regression.py` (Regression Preservation): did pass 2 drop an anchor pass 1 kept or reintroduce a finding pass 1 removed? Guards the second scan |
| **Padmakumar & He** (ICLR 2024) | model-assisted writing homogenizes ACROSS documents (reduced aggregate diversity) | future TextSlopBench track: same task → N generations → cross-output semantic diversity. **Not v1** |
| **Juzek & Ward "Delve"** (COLING 2025) | 21 focal overrepresented words; overrepresentation traced to post-training/RLHF, not just training data; fingerprints can leak into human language | sits beside **Antislop** — reinforces that the slop profile must be **versioned by model / time / genre**, not "delve = permanently AI" (`slop_profile.json` already carries `profile_version` + `model_profiles` seams) |
| **Sung et al.** (L2 proofreading, BEA 2025) | human vs LLM proofreading interventions differ systematically on the same source | methodology support for source→human vs source→model; **not a main dataset** (L2-narrow) |
| **Chakrabarty & Dhillon** (Can Good Writing Be Generative?, 2026) | expert vs lay preference diverges; fine-tuning shifts it | read-only; another reason to keep TextSlopBench multidimensional (preference ≠ authorship ≠ fidelity ≠ authenticity) |

**Fidelity is now three dimensions:** Claim Fidelity (anchors/claims) · Semantic Fidelity ·
**Voice Fidelity** (voice/dialect/cultural markers). Voice Drift measures the general case;
cultural-marker preservation is a benchmark slice pending the corpus.
