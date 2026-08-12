# SPEC: Corpus-grounded direction explorer with measurable anti-sameness

> Implementation spec (Fable-polished, code-grounded). Decisions locked: AUGMENT the 18 authored
> families with corpus archetypes; show 4 options = 1 engine-synthesized + 3 corpus-grounded;
> DINOv2 embeddings used OFFLINE only (clustering aid); perturbation is DETERMINISTIC/parametric,
> NOT an LLM diversity engine. Engine stays pure (no Math.random/Date.now; runs Worker+browser+CLI).

## 0. The two real sameness leaks this spec closes (found in code)

1. **`composeGenome` is a verbatim copy.** A family's `sectionGrammar`/`macro` are copied unchanged
   except `contentDensity`/`whitespace` (genome.mjs → layout-families.mjs ~520–540). Every user whose
   intent selects the same family gets a byte-identical skeleton. Perturbation must run INSIDE
   `composeGenome` (amplitude scaled by `layoutVariance`), not only in explore.
2. **The explore verb outsources diversity to the LLM loop.** `explore.md` tells the agent to call
   `style_genome` 4× and thread fingerprints manually; if it forgets, you get one idea recolored.
   Divergence must move into ONE engine call.

## 1. Archetype extraction (offline, repeatable)

### 1.1 Pre-filter (mandatory — "clean" corpus is not clean enough)
Record 1 of `layout-genomes.v3.ndjson` is literally `[{role:"unknown",heightShare:1}]`. Filter before clustering:
- ≥3 sections; ≥2 sections role≠`unknown`; mean `roleConfidence` ≥0.5
- `macro.contentWidthShare` ∈ [0.3,1.0]; `whitespace` ∉ {0,1} exactly; `contentDensity` ∉ {0,1} exactly
- not in `spam-quarantine.v1.ndjson`; not slop-labeled
- Expect ~900–1,050 survivors. Report the count.

### 1.2 Feature space — two-stage, structure-first
Do NOT concatenate structural+visual into one space (gallery genomes lack embeddings; missing-modality bias).
- **Stage A (structural):** partition by `pageKind` (already the hard gate in `SURFACE_PAGEKINDS`).
  Within each pageKind: agglomerative, average linkage, cosine over `genomeVector()` from
  `viz/layout-embeddings/genome-vector.mjs` (fit `fitGenomeCorpus` on the filtered set). Cut ≈0.35,
  tuned per pageKind → 3–8 clusters; MIN cluster size 8. Reuse `genome-vector.mjs` verbatim.
- **Stage B (visual sharpening, DINOv2 `top` 384-d, offline only):** for clusters with ≥60% embedding
  coverage, mean pairwise cosine on unit-normed `top`. If <~0.55, bisect with 2-means on visual vectors;
  keep split only if both halves keep min size AND structural coherence holds. Use visual-centroid
  proximity to rank exemplars. DINOv2 never enters runtime.
- Supersede `layout-clusters.v1.json` (it's a `pageKind|role|columns` bucketing, not clustering); keep
  its representative-review workflow (`cluster-representative-review.v1.json`).

### 1.3 Selection, count, quality
- Target **15–22 new archetypes** (18 + new = 33–40).
- **Cap 6 archetypes per pageKind** (corpus is ~47% product-with-proof; uncapped → 25 landing variants).
  Docs/dashboard/app are thin → keep mostly authored families. **Defer gallery (313, no embeddings) to a v2 pass.**
- Quality gate/cluster: ≥25% members positively quality-labeled or gallery members, OR human approval of
  representative screenshot. No unreviewed cluster ships.
- **Dedup vs the 18 authored families:** vectorize each authored family with same `genomeVector` (after
  role aliasing §1.5; fill crawl-only fields grid/bandRhythm/headingOutline with corpus medians). Reject
  any mined archetype with cosine ≥0.92 to an existing family.

### 1.4 Encoding a cluster as a LAYOUT_FAMILY object
- `macro`: per-field median. `sectionGrammar`: modal role-sequence; heightShares = medians over members
  sharing that sequence; `focalPoint` modal per position; `composition` strings authored (curation).
- `dialCompatibility.contentDensity`: [p10,p90] of member density. `layoutVariance`: proxy
  `v = clamp01(0.3·|splitRatio−0.5|/0.3 + 0.3·(alignment≠"left-led") + 0.2·stripeAlternation + 0.2·repetitionEntropy)`,
  take [p10,p90], widen to min width 0.3.
- Semantic fields (`name`,`whenToUse`,`notFor`,`requiredContent`,`antiPatterns`,`mobileTransform`,
  `materialSlots`, per-section `composition`): AUTHORED offline (LLM-assist vs representative screenshots,
  human-reviewed) — the `family-proposals.v1.json` pipeline. Names: `<structure>-<intent>` (e.g. `research-index-grid`).
- `provenance:"crawl-derived"`, `evidence:{clusterId, memberCount, representativeHost, galleryShare}`.
- Ship as generated-but-checked-in `apps/engine/layout-families-crawl.mjs`, spread into `LAYOUT_FAMILIES`.

### 1.5 Role-vocabulary mismatch — RESOLVED
Crawl/vectorizer vocab = 10 roles (nav,hero,features,proof,pricing,faq,cta,testimonial,footer,unknown).
Authored families use ~30 bespoke roles → today all map to `unknown` (authored families near-invisible to vectorizer).
**Resolution: `ROLE_ALIASES` map, used ONLY for vectorization + fingerprint distance; bespoke roles stay in
`sectionGrammar` for rendering.** Export `ROLE_ALIASES` from layout-families.mjs:
- nav ← topbar, appbar, masthead, header(top)
- hero ← marquee, opening, lede, page-header, reading-header, summary, intro, intro-band
- features ← chapter-*, body-columns, article-body, spec-groups, workspace, table-body, mosaic, pane-body,
  primary-instrument, secondary-metrics, dark-band, light-band, full-bleed-diagram, annotation-flow,
  comparison-matrix, filter-bar, table-head, toolbar, evidence, selected-detail, diagram
- proof ← status-strip, pull-aside
- cta ← cta-band, resolution-cta, contact, related, plan-toggle, pagination
- faq ← faq
- footer ← statusbar
`hashSections` keeps hashing RAW roles (identity preservation for diversity penalty); only the distance metric (§3) uses canonical.

## 2. Perturbation model (`apps/engine/perturb.mjs`, pure, seeded)
`perturbGenome(genome, family, streamSeed, iv, amplitude=1)`. RNG: `mulberry32(streamSeed)` (export from engine.mjs).
`streamSeed = hashToUint32(`${seed}:${family.name}:${optionIndex}:${rerollCount}`)` (FNV hash from intent.mjs).
**Determinism contract `PERTURB_V1`:** draws consumed in fixed order below; EVERY parameter draws its randoms
even when skipped/clamped (so adding a field later never shifts the stream).

| # | Parameter | Perturbation | Safe range / gate | Rationale |
|---|---|---|---|---|
| 1 | `macro.splitRatio` | ±0.06·amp | clamp [0.34,0.78]; never cross 0.5 if authored≠0.5 | which side leads is family identity |
| 2 | `macro.whitespace` | ±0.08·amp | clamp [0.2,0.85]; \|ws−(1−density)\|≤0.35 | breathing room is expressive not structural |
| 3 | `macro.contentWidthShare` | ±0.05·amp | clamp [0.6,1.0]; TOOL_KINDS floor 0.9 | frame width = taste; tools must stay wide |
| 4 | `macro.columnCount` | ±1 step, p=0.3, only if authored∈[2,6] | never 1 or 12 (regime extremes load-bearing) | 3→4 legit; 1→2 destroys thesis; 12→11 breaks grid |
| 5 | `sectionGrammar[].heightShare` | ×(1+u·0.18·amp) per section, renormalize Σ=1 | nav/footer excluded; no share<0.04; nav≤0.10; footer≤0.18; hero keeps max non-footer if it had it; hero within [0.6×,1.5×] authored | BIGGEST visible differentiator: vertical rhythm |
| 6 | Optional-section drop | drop ONE role from `optionalSections`, p=0.35 | never role implied by requiredContent; never nav/hero/cta/footer; renormalize | identical section outlines = the tell |
| 7 | Adjacent-order swap | swap ONE pair from `swappableAdjacent`, p=0.3 | nav first, footer last, hero before non-nav | only swaps a human editor would accept |
| 8 | `focalPoint` of ONE mid section | rotate {left,center,right}, p=0.3 | never hero/nav/footer | cheap secondary variety |
| 9 | `hierarchy.headingScaleRatio` | ±0.25·amp | clamp [1.4,3.8], floor 1.35 | display scale is a taste dial |
| 10 | `hierarchy.focalAreaShare`/`ctaProminence` | ±0.04 / ±0.08 | existing clamps [0.1,0.5]/[0.2,0.95] | keeps derived numbers from being pure fn of dials |
| 11 | Dark-band inversion | mark 0–2 sections `surface:"inverted"` | never nav; never two adjacent | stripe rhythm = cheap huge differentiator |
| 12 | `macro.grid.gutterShare`/`outerMarginShare` | ±20% rel | gutterShare clamp [0.01,0.05] | micro-texture |

**Never perturbed:** pageKind, alignment, family-required role set, hero position/focal, nav/footer position,
mobileTransform, materialSlots, requiredContent, everything `deriveMaterial` derives.

**`validatePerturbed(genome, family)`** after: Σshares≈1 (renormalize), all gates, dial-coherence (#2). On fail →
redraw `rerollCount+1`, max 4, then return unperturbed base (never throws). Intent-side slop gates untouched
(palette/fonts still pass generatePalette/retrieveFonts gates).

**Wire into `composeGenome`:** amplitude = `0.35 + 0.65·iv.layoutVariance`, streamSeed from resolved seed.
`suggestLayout` gains optional `{seed}` (absent = amplitude 0 = current behavior; existing tests stay green).

## 3. Fingerprint + divergence math
Extend fingerprint (genome.mjs) ADDITIVELY (penaltyFor keeps working — reads layoutFamily/fontPair/sectionOrderHash):
`fingerprint = {...existing, canonicalOrder (via ROLE_ALIASES), splitRatio, whitespace, contentWidthShare,
columnCount, headingScaleRatio, darkBands:"001010"}`.

**Distance `D(a,b)∈[0,1]`** in new `apps/engine/fingerprint.mjs`:

| component | d_i | weight |
|---|---|---|
| layoutFamily | 0 if equal else 1 | 3.0 |
| canonicalOrder | 1 − normalized LCS of role seqs | 2.0 |
| display font | equal?0:1 | 2.0 |
| body font | equal?0:1 | 1.0 |
| paletteHue | circularDiff/180 | 2.0 |
| splitRatio | min(1,\|Δ\|/0.3) | 1.0 |
| whitespace | min(1,\|Δ\|/0.4) | 1.0 |
| headingScaleRatio | min(1,\|Δ\|/2) | 0.5 |
| columnCount | min(1,\|Δ\|/4) | 0.5 |
| darkBands | Hamming/maxlen | 0.5 |
| radius+shadow+motion | mean equal?0:1 | 0.5 |

`D = Σ w_i d_i / Σ w_i` (Σw=14).
**Thresholds:** within shown 4: pairwise D≥0.45 + hard rules (no shared layoutFamily, no shared display font,
hue sep ≥40°). Vs recentFingerprints (last 8): D≥0.30 each, never repeat exact (layoutFamily, sectionOrderHash, display font).
**Re-roll (bounded, deterministic):** greedy — option1 = best-fit perturbed; k=2..4 maximize min-distance among
families with fit≥maxFit−0.25. On D<0.45: (a) re-perturb (rerollCount≤4), (b) swap next family (≤3), (c) accept at
D≥0.35 with `warnings:["divergence-floor-relaxed"]`. Pure fn of (intent, seed, recentFingerprints).

## 4. explore wiring
**New `apps/engine/explore.mjs`** `exploreDirections(engine, intentInput, {seed, recentFingerprints=[], count=4})`:
1. `resolveIntent` → intent+seed.
2. `suggestLayout(intent, {recentFingerprints, seed})` → ranked from ~35 families.
3. **3 corpus slots:** greedy select + `perturbGenome` per §3; each carries `groundedIn = family.evidence?.representativeHost ?? null`, `provenance`.
4. **1 synthesized slot:** `synthesizeGenome(familyA, familyB, iv, streamSeed)` — skeleton from top-fit family not chosen; macro stance blended 60/40 from a second gate-passing family of a DIFFERENT pageKind within SURFACE_PAGEKINDS; perturb amplitude 1.25; validate. `provenance:"engine-synthesized"`, `parents:[a,b]`.
5. **Per-direction assembly — reuse `styleGenome`.** Add `{layout}` override to `styleGenome(engine, intentInput, {seed, recentFingerprints, layout})`: when provided, skip suggestLayout (one-line at `---- layout ----`). explore calls styleGenome 4× with per-option seed (`seed + i·0x9E3779B9 >>>0`), the perturbed layout, and recentFingerprints = caller's + already-assembled-this-call (makes retrieveFonts `exclude` force distinct pairings).
6. **Palette spread:** `generatePalette({energy, seed:optionSeed, hue:optionHue})`, `optionHue=(baseHue+i·112.5)%360`, else re-seed until 40° pairwise holds (≤8 attempts).
7. Run §3 divergence + re-roll; return `{directions:[{name,genome,fingerprint,fit,provenance,groundedIn,parents?}×4], warnings}`.

**Worker:** add `explore_directions` tool in `apps/worker/src/tools.mjs` (INTENT_PROPS + recentFingerprints + count). Keep `style_genome` unchanged.
**Skill:** rewrite `skills/fix-ai-slop/explore.md` → ONE `explore_directions` call; agent jobs = author StyleIntent, name each direction, write centrepiece line, present `groundedIn`. Self-check → "did you present all four + grounding".
**Families file:** add `optionalSections` + `swappableAdjacent` to all 18 families; export `ROLE_ALIASES`; spread `layout-families-crawl.mjs`; extend `LAYOUT_FAMILY_SCHEMA_KEYS` (new fields optional).

## 5. Traps
1. Perturb the NORMAL path too (leak #1) — else projects reconverge at build time.
2. Corpus skew → 6-per-pageKind cap is NOT optional.
3. Gallery has no embeddings yet → v1 mines v3 only; run DINOv2 over gallery screenshots before a v2.
4. Host join is POSITIONAL (v3 genomes carry no host) — zip genomes+manifest, assert equal line counts.
5. Degenerate "clean" records exist — §1.1 pre-filter is load-bearing.
6. Determinism drift — PERTURB_V1 always-draw contract + per-(family,option,reroll) seed; snapshot-test 1000 seeds → zero gate violations, stable outputs.
7. `penaltyFor` matches raw section-order — keep `sectionOrderHash` on raw roles; canonical only in §3 distance.
8. Palette hue can still collide — the 40° loop (§4.6) is required.
9. Do NOT ship corpus/embeddings/NDJSON to the Worker — only the distilled families module (~2–3KB/family).
10. LLM signature-accent garnish: SKIP (breaks purity, regresses to slop tropes). Keep only the existing per-direction centrepiece line (agent-authored, grounded in subject, never mutates genome numbers).

## Build order
1. `ROLE_ALIASES` + vectorize the 18 authored families (sanity: nearest corpus neighbors look right).
2. `packages/crawl/src/mine-archetypes` : pre-filter → pageKind partition → agglomerative → visual sharpen → quality gate → dedup vs 18 → `archetype-proposals.v2.json` + review sheet.
3. Curation (LLM-assist authoring vs screenshots, human review) → `apps/engine/layout-families-crawl.mjs`; add optionalSections/swappableAdjacent to the 18.
4. `apps/engine/perturb.mjs` + determinism/gate/distribution tests; wire into `composeGenome`.
5. `apps/engine/fingerprint.mjs` (extended fingerprint + distance) + threshold tests.
6. `apps/engine/explore.mjs` + `{layout}` override in styleGenome + `explore_directions` tool + rewrite explore.md.
7. Calibration: exploreDirections over 8 surfaces × 20 seeds; tune 0.45/0.30 so re-roll <~20%, relaxed-floor <~2%; snapshot as regression baseline.
