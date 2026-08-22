---
name: fixmyslop-humanizer
description: |
  Revise prose to sound natural and context-appropriate while preserving facts,
  meaning, voice, protected quotations, code, URLs, identifiers, numbers, and
  uncertainty. Use for AI-to-natural rewrites, editing already-human prose without
  over-editing, genre-aware cleanup, and TextSlopBench evaluation. Run the bundled
  humanstats analyzer before and after rewriting and the fidelity audit before
  returning a final version.
---

# FixMySlop:Humanizer

Use this skill for revision, not regeneration. Make the smallest useful changes that
remove formulaic or inflated prose while retaining the author's claims and register.
Never invent specificity, personal experience, sources, citations, or sentiment to
make text seem more human. Never optimize for an AI-detector score or report an AI
probability.

## Core workflow

The normal execution path is explicit and ordered:

```text
target extraction
  -> genre/register inference
  -> humanstats(original)
  -> pragmatic profile
  -> rewrite
  -> humanstats(rewrite)
  -> targeted correction
  -> fidelity / hard-anchor audit
```

Run `scripts/humanize.py --json --debug` for a complete structured trace. The
trace records the inferred genre, confidence, pragmatic profile, source-content
map, concise model summary, second scan, correction plan, and fidelity result.

The host rewriting model must receive `rewrite_context.model_summary`, not the full
raw analyzer report. That summary contains genre purpose, register objectives,
actionable findings, measured signal counts, and the hard-anchor policy. The full
context is for audit/debug output only.

1. Extract editable targets and build a source-content map. Hard anchors include
   numbers, dates, entities, URLs, citations, measured results, qualifications,
   causal relationships, quotations, commands, routes, and required UI labels.
2. Infer the genre/register when `genre=auto`; record the confidence and evidence.
   Use `scripts/pragmatics.py` to build a purpose-oriented profile. Profiles guide
   the host model; they are not new banned-word lists.
3. Run `scripts/humanstats.py` on the original text. Treat findings as evidence,
   not verdicts. A single em dash, contraction, nominalization, or unusual word is
   not an error by itself.
4. Give the host model the concise structured context. It may revise soft
   expression—wording, ordering, syntax, rhetorical framing, tone, and paragraph
   boundaries—while preserving hard anchors and the source's certainty.
5. Run a second `humanstats.py` scan. The second scan triggers an edit **only** for a
   finding that (a) maps to a concrete span in the draft, (b) is high confidence
   (severity ≥ 2), (c) can be corrected without threatening a hard anchor, and (d) is
   relevant to the inferred pragmatic profile — plus any hard-anchor failure. Findings
   that miss any gate are recorded under `targeted_correction.diagnostic_findings` and
   the text is left alone; never edit merely because a metric is still unusual. If
   `targeted_correction.needed` is true, send the bounded `targeted_correction_prompt`
   (which lists only `actionable_findings` and forbids touching diagnostic spans) as a
   second host pass, then scan that corrected draft again before fidelity. Do not chase
   a lower risk score by flattening a legitimate genre or personal voice.
6. Run `scripts/fidelity.py` or the structured output from `scripts/humanize.py`.
   A missing or modified hard anchor is a correction failure, not a soft quality
   tradeoff.
7. Finalize editable prose with straight quotation marks and no em/en dashes by
   default. Reframe dash constructions structurally; never blindly substitute a
   dash character. Leave protected quotation/code interiors untouched.

For a deterministic local pass, run:

```text
python scripts/humanize.py input.txt --genre auto --json
```

Use the `rewrite` field as the candidate and inspect `fidelity`, `before`, `after`,
and `deltas`. The CLI is a conservative baseline; a host model may make richer
surgical edits, but it must obey the same protection and fidelity rules.

## Evidence hierarchy

- `HARD`: protected-span and typography policies, exact identifiers, URLs, numbers,
  dates, quotation contents, and code.
- `HIGH-CONFIDENCE`: pasted chat framing, stacked hedging, unsupported vague
  attribution, obvious filler, generic sign-offs, and repeated formulaic wrappers.
- `SOFT`: common vocabulary, contractions, sentence length, passive voice,
  nominalization, punctuation, and rhetorical patterns. Interpret them by genre and
  local distribution.
- `DIAGNOSTIC`: lexical diversity, n-gram concentration, POS mix, template entropy,
  rhythm, paragraph shape, and semantic overlap. Use these to locate passages, not
  to label authorship.

## Output contract

Return the revised prose directly unless the user asks for analysis. When reporting
work, summarize the meaningful changes and mention any fidelity constraint that
limited the rewrite. For benchmark runs, preserve the full JSON report and include
the skill/version, host configuration, genre, original, candidate, and fidelity
result.

## Bundled resources

- [humanstats.py](scripts/humanstats.py): dependency-free lexical (incl. HD-D, Distinct-n,
  MATTR), phrasal, POS, syntax-proxy, rhythm, document, slop-overrepresentation, and finding
  analysis.
- [slop_overrepresentation.py](scripts/slop_overrepresentation.py) + [slop_profile.json](scripts/slop_profile.json):
  Antislop-style empirical overrepresentation scanning (rho = f_LLM/f_human), weighted flags
  (`review_in_context`, never bans), genre/model-aware profile, and the Slop Pattern
  Suppression (SPS) metric. See `../../RESEARCH_REGISTRY.md`. Only high-confidence slop
  (n-grams/templates, via `actionable_slop`) is host-actionable; medium-confidence single-word
  flags stay diagnostic — a judged smoke showed global slop flags induce harmful edits on
  already-clean, register-sensitive genres (`../../ANTISLOP_SMOKE.md`).
- [humanize.py](scripts/humanize.py): conservative local rewrite loop with protected
  spans, typography finalization, before/after scans, and fidelity checks.
- [fidelity.py](scripts/fidelity.py): exact preservation and conservative drift
  checks.
- [patterns.md](references/patterns.md): behavior families and examples.
- [fidelity.md](references/fidelity.md): protected content and benchmark guardrails.

## Evaluation-only modules (not part of the rewrite path)

These support the Iteration 2 analyzer-intervention study; they make no model calls and
do not change rewrite behavior:

- [family_ablation.py](scripts/family_ablation.py): build the nine feature-family arms
  (pragmatics-only through +all-humanstats) with an invariant pragmatics/anchor block, so
  a host runner can isolate each family's marginal effect.
- [causal_trace.py](scripts/causal_trace.py): per-finding trace — source span, whether the
  host acted, and whether the change survived the second pass — aggregated per family to
  learn which families drive kept edits rather than merely correlate with AI authorship.

Fidelity is reserved for hard-anchor/claim/contradiction/semantic preservation; overlap and
edit-magnitude measures are never called fidelity. See `METRICS_GLOSSARY.md`.
