# Slop-Specific Edit Lift (TETRA vs LAMP)

Not every human edit to AI prose is "slop removal" — some is ordinary editing any mediocre draft
needs. To separate them we contrast two edit distributions:

- **LAMP** — AI → human editor (creative prose, `fine_grained_edits`).
- **TETRA** — human draft → human editor (ACL papers; github.com/chemicaltree/tetra, **CC BY 4.0**,
  cite Ito et al. 2022). Adapter: `textslopbench/adapters/tetra.py` (191 docs, 4,125 aspect-tagged edits).

Both taxonomies are mapped to a shared aspect space, then:

    SEL(aspect) = P(aspect | AI→editor) − P(aspect | human→editor)

`textslopbench/slop_specific_lift.py`.

## Result

| aspect | LAMP (AI) | TETRA (human) | **SEL** | class |
|---|---:|---:|---:|---|
| Cliche/Ornament | 21.6% | 0.0% | **+21.6%** | AI-specific* |
| Specificity | 10.8% | 0.0% | **+10.8%** | AI-specific* |
| Redundancy | 17.3% | 6.7% | **+10.7%** | **AI-specific (robust)** |
| WordChoice | 28.0% | 23.0% | +5.1% | AI-specific |
| Readability | 21.1% | 20.8% | **+0.3%** | **general editing** |
| Consistency | 0.0% | 4.7% | −4.7% | draft-specific |
| Style | 0.0% | 7.3% | −7.3% | draft-specific |
| Clarity | 0.0% | 17.0% | −17.0% | draft-specific* |
| Grammar | 1.1% | 20.5% | −19.4% | draft-specific |

\* taxonomy gap: the aspect isn't a category in one corpus's scheme, so its 0% is partly an
artifact — trust the both-taxonomies-present rows most.

## Reading

- **Redundancy-cutting is the cleanest slop-specific behavior (+10.7%, present in BOTH
  taxonomies)** — editors cut redundancy from AI prose 2.6× as often as from human academic
  drafts. This is genuine humanization, not general editing.
- **Cliche/Ornament (+21.6%) and Specificity (+10.8%)** are directionally strong AI-specific
  signals (fiction editors strip clichés/purple prose and add concrete detail) but are
  taxonomy-gap-confounded — academic editors simply have no such category.
- **Readability / sentence-restructuring (+0.3%) is ordinary editing**, done equally to human and
  AI drafts. A system that mostly restructures sentences is not doing AI-slop removal.
- **Grammar (−19%), Clarity (−17%) are what HUMAN drafts need, not AI prose** — AI text is
  grammatically clean and locally clear, so editors rarely touch those in LAMP.

## Why this matters for TextSlopBench and FixMySlop

The human-edit-alignment axes reward *matching human edits*. Without SEL, a system earns credit
for **ordinary editing** (sentence restructuring, grammar) that isn't AI-slop removal at all. SEL
lets us **weight edit-alignment toward slop-specific aspects** (Redundancy, Cliche/Ornament,
Specificity, WordChoice) and discount general ones (Readability) and draft-specific ones (Grammar,
Clarity). For FixMySlop the priority is now evidence-backed: **cut redundancy, strip
cliché/ornament, add specificity — not grammar/clarity (AI doesn't need them) and not generic
sentence restructuring (that's just editing).**

## Caveats

Genre confound: LAMP is fiction, TETRA is academic — some of the Grammar/Clarity gap reflects that
non-native academic drafts need mechanics help, not that AI prose is uniquely clean. The
taxonomy-mapping is coarse (semicolon-typed TETRA edits, single-category LAMP spans). The robust,
low-confound claim is the **Redundancy** lift and the **Readability = general** finding. A
same-genre human→editor corpus would remove the confound. Machine-readable:
`textslopbench/results/slop-specific-edit-lift.json`.
