# Intent, style, and layout space specification

Date: 2026-08-03

Purpose: define the research/data contracts for a connected design engine. This is a representation and collection plan, not a prompt specification.

## Design principle

The engine should not independently recommend a font, a palette, a layout, and a shadow. It should first resolve a coherent style genome from the user’s intent, then retrieve or generate compatible decisions for every layer.

```text
brief + product context + surface context
        |
        v
    StyleIntent
        |
        v
    StyleGenome  <---- controlled variation + previous-output memory
        |
        +--> font query and pairing
        +--> palette and contrast system
        +--> layout-family query and section grammar
        +--> material treatment: radius, shadow, border, texture, accent
        +--> motion and responsive rules
        |
        v
    rendered candidate
        |
        v
    deterministic QA + visual quality/slop review
        |
        v
    accepted/rejected corpus record
```

## StyleIntent

`StyleIntent` is the normalized meaning of the brief. It should preserve the source wording, but expose interpretable fields for retrieval.

Required fields:

```json
{
  "surface": "landing-page",
  "job": "explain-and-convert",
  "audience": ["technical-buyers", "design-conscious-founders"],
  "contentModel": "product-with-proof",
  "trustLevel": 0.72,
  "contentDensity": 0.48,
  "energy": 0.63,
  "warmth": 0.41,
  "formality": 0.54,
  "era": 0.36,
  "craft": 0.86,
  "experimentalism": 0.68,
  "motionIntensity": 0.34,
  "layoutVariance": 0.71,
  "materiality": 0.58,
  "contrastPreference": 0.74,
  "theme": "light-or-dark",
  "references": [],
  "variation": 3,
  "seed": null
}
```

The exact values can change during implementation. The important property is that the fields are semantic and reusable by every downstream subsystem. `intent` must not be reduced to `hash(intent)`.

The three useful user-facing controls from Taste—variance, motion, and density—should be retained, but they should sit alongside audience, job, trust, warmth, era, craft, and materiality. A high-variance page can still have low motion and high trust.

## StyleGenome

`StyleGenome` is the resolved design direction. It is the object that connects color, type, layout, material, and motion.

```json
{
  "id": "style-candidate-...",
  "sourceIntent": "intent-...",
  "seed": "...",
  "variation": 3,
  "personality": {
    "axes": {
      "quiet-loud": 0.62,
      "technical-organic": 0.31,
      "classic-futurist": 0.57,
      "warm-clinical": 0.44,
      "dense-breathing": 0.68
    }
  },
  "type": {
    "display": {"family": "...", "role": "display", "source": "font-neighbor"},
    "body": {"family": "...", "role": "body", "source": "font-neighbor"},
    "mono": null,
    "scale": "...",
    "measure": "...",
    "weightPolicy": "..."
  },
  "color": {
    "mode": "...",
    "background": "...",
    "foreground": "...",
    "accent": "...",
    "support": ["..."],
    "contrastFloor": 4.5,
    "source": "corpus-plus-oklch"
  },
  "layout": {
    "family": "...",
    "sectionGrammar": ["..."],
    "focalPoint": "...",
    "contentWidth": "...",
    "density": 0.48,
    "variance": 0.71
  },
  "material": {
    "radiusLanguage": "...",
    "shadowLanguage": "...",
    "borderLanguage": "...",
    "surfaceTreatment": "...",
    "accentTreatment": "..."
  },
  "motion": {"intensity": 0.34, "families": ["..."], "reducedMotion": "required"},
  "responsive": {"collapseRules": ["..."]},
  "evidence": [],
  "constraints": [],
  "rejectionReasons": []
}
```

Every retrieved decision should carry provenance: corpus record, neighbor distance, rule, or human label. This gives the stronger prompt-writing agent something concrete to explain and gives us a way to debug bad outputs.

## Controlled variation

“Different each time” should mean bounded, intentional variation, not unseeded randomness.

For the same intent:

- keep accessibility, readability, product job, and core brand constraints stable;
- sample from compatible font, palette, layout, and material neighborhoods;
- apply a diversity penalty against prior style fingerprints;
- avoid repeating the same hero grammar, font pair, accent hue, radius language, and focal-point placement;
- expose `seed` for reproducibility;
- expose `variation` for user-controlled distance from the previous candidate.

The fingerprint should include at least font IDs, palette coordinates, layout family, section order, split ratios, radius language, shadow language, accent strategy, and motion family.

## Font space integration

The existing font artifacts should become a first-class retrieval index rather than remaining visualization-only data.

### Retrieval inputs

- display/body role;
- required readability and x-height/width constraints;
- `StyleIntent` personality axes;
- visual similarity target;
- category and script support;
- freshness/overuse penalty;
- previous-output diversity penalty.

### Retrieval outputs

Return multiple candidates, not one answer:

```json
{
  "family": "...",
  "role": "display",
  "featureDistance": 0.18,
  "visualDistance": 0.27,
  "overusePenalty": 0.04,
  "readabilityChecks": {"bodySuitable": false, "displaySuitable": true},
  "neighbors": ["..."],
  "provenance": "font-neighbors.json"
}
```

The existing hybrid neighbor weighting is a useful baseline. It should be evaluated against human pairing judgments before being treated as truth.

## Layout collection gap

The current feature crawl captures visual CSS properties and a few page fingerprints, but it does not capture enough geometry or structure to learn layout. In particular, it lacks reliable element coordinates, dimensions, DOM parent/child relationships, semantic section boundaries, text roles, screenshots, and responsive transformations.

The next crawl should record, for each page and viewport:

- viewport size, page height, and scroll progress;
- section boundaries and semantic roles such as nav, hero, proof, features, pricing, FAQ, CTA, and footer;
- DOM parent/child relationships and repeated-module groups;
- normalized x/y/width/height, z-order, overlap, and visibility;
- grid/flex/block positioning, column count, gap, alignment, max-width, and padding;
- heading, body, label, and CTA boxes with text measure and line count;
- focal visual region, asset role, image aspect ratio, and object position;
- card count, repeated shapes, list rhythm, and section transitions;
- background changes, borders, radii, shadows, gradients, texture, and accent placements;
- interaction/motion markers and reduced-motion behavior;
- mobile/tablet collapse, reorder, hide/show, and density changes;
- screenshot or render reference with capture metadata.

Do not infer quality from CSS frequency alone. Frequency is useful for prevalence and slop detection, not for deciding what is good.

## LayoutGenome

Start with an interpretable genome. A learned embedding can be added after the genome is stable.

```json
{
  "pageKind": "product-with-proof",
  "sectionGrammar": [
    {"role": "nav", "heightShare": 0.06},
    {"role": "hero", "heightShare": 0.25, "focalPoint": "left", "composition": "split"},
    {"role": "proof", "heightShare": 0.12, "composition": "logo-rail"},
    {"role": "features", "heightShare": 0.28, "composition": "asymmetric-stack"},
    {"role": "cta", "heightShare": 0.12, "composition": "contrast-band"}
  ],
  "macro": {
    "contentWidthShare": 0.78,
    "columnCount": 2,
    "splitRatio": 0.58,
    "alignment": "left-led",
    "whitespace": 0.64,
    "contentDensity": 0.43
  },
  "hierarchy": {
    "focalAreaShare": 0.21,
    "headingScaleRatio": 3.2,
    "ctaProminence": 0.79,
    "contrastConcentration": 0.72,
    "repetitionEntropy": 0.61
  },
  "material": {
    "radiusLanguage": "controlled-mixed",
    "shadowLanguage": "soft-low-elevation",
    "borderLanguage": "selective",
    "accentStrategy": "one-primary-plus-signal",
    "surfaceTexture": "none-or-subtle"
  },
  "responsive": {"mobileTransform": "stack-with-focal-reorder"},
  "quality": {"score": null, "confidence": null, "provenance": []},
  "slop": {"score": null, "matchedRules": []}
}
```

The layout embedding, when added, should be learned from these features plus image/DOM representations. It should not be the only representation: an opaque vector cannot explain why a composition was selected or how to safely adapt it to new content.

## Layout generator contract

The generator should compose four things:

1. A layout family retrieved from the positive corpus.
2. A section grammar appropriate to the page job and content model.
3. A style/material genome shared by every section.
4. Responsive and accessibility transforms.

Each layout block needs metadata equivalent to:

```json
{
  "name": "asymmetric-proof-stack",
  "whenToUse": ["explain-and-convert", "product-with-proof"],
  "notFor": ["dense-admin-workflow", "long-form-reading"],
  "dialCompatibility": {"layoutVariance": [0.55, 0.95], "contentDensity": [0.2, 0.7]},
  "requiredContent": ["headline", "proof", "primaryAction"],
  "mobileTransform": "stack-and-preserve-focal-order",
  "materialSlots": ["hero-surface", "proof-surface", "accent-signal"],
  "antiPatterns": ["equal-card-row", "decorative-grid-without-function"]
}
```

Box rounding, shadows, borders, accents, and texture should be material slots attached to hierarchy-bearing nodes. They should not be sprayed across every box. Hierarchy comes first from scale, position, contrast, whitespace, and sequence; material reinforces those relationships.

## Positive quality set and slop set

The current cross-gate set is a candidate pool, not a quality set. Passing font and color gates does not prove that a page has good layout or personality.

Create two related but independent labels:

### Quality label

Score or annotate:

- task clarity and content hierarchy;
- visual hierarchy and focal-point control;
- composition and spacing rhythm;
- typography quality and reading measure;
- subject-specific personality;
- material restraint and consistency;
- responsive integrity;
- interaction and motion quality;
- asset authenticity and usefulness;
- overall craft and memorability.

Store the reviewer, date, evidence, confidence, and whether the judgment is human, deterministic, or model-assisted.

### Slop label

Record concrete matched patterns, severity, and evidence. Initial taxonomy should include:

- generic font monoculture or unearned “premium” pairings;
- flat or interchangeable type hierarchy;
- centered hero as the default when the job calls for a stronger composition;
- equal three-column feature/card rows without meaningful comparison;
- excessive pills, radii, shadows, glow, glass, or gradients;
- decorative grids, halos, sparkle badges, status dots, fake browser/product rectangles;
- hairline-plus-wide-shadow treatment and border decoration without hierarchy;
- accent colors that are oversaturated, repeated everywhere, or disconnected from the subject;
- text occlusion, cramped measure, weak contrast, and inaccessible motion;
- repeated section-number eyebrows, version labels, ornamental strips, or other stock signals;
- “polished” micro-details that do not improve the user’s task.

Use Impeccable’s catalog and Taste’s ban list as seed taxonomies, then validate every rule against our own crawl and accepted/rejected renders. A pattern is not slop merely because it is common; it is slop when it is unmotivated, repeated, interchangeable, or harmful to hierarchy and task clarity.

## Collection and evaluation phases

### Phase A: inventory and schema

Preserve the current crawl. Add geometry/DOM/semantic fields in a versioned schema. Do not overwrite the existing raw records.

### Phase B: candidate labeling

Use the 176 cross-gate sites as a review queue, not as ground truth. Add a smaller manually reviewed positive set, a slop set, and uncertain examples. Capture screenshots at fixed desktop and mobile viewports.

### Phase C: representation

Derive `StyleGenome` and `LayoutGenome` records with provenance. Cluster layout genomes, inspect cluster representatives, and name families only after inspecting their content and hierarchy.

### Phase D: retrieval and composition

Return several compatible candidates, apply hard accessibility/product constraints, then rank for quality, novelty, and fit. Keep the selected candidate and rejected alternatives.

### Phase E: render-based evaluation

Measure deterministic failures, slop matches, visual hierarchy, responsive breakage, and output diversity over batches of the same brief. A five-run test should not repeatedly collapse onto the same font, hue, hero grammar, or radius language.

## Success criteria

The system is materially better when:

- the same intent produces reproducible candidates when seeded;
- unseeded candidates vary in composition, not just color;
- font choices come from visual/feature neighbors and remain readable;
- layout choices explain their page job and required content;
- material treatments are coherent and restrained;
- mobile layout is an intentional transform, not an afterthought;
- accepted pages score higher on hierarchy/personality/craft than baseline pages;
- known slop matches fall without merely moving to a different fashionable cliché;
- a reviewer can inspect evidence and understand every major choice.

## Explicit non-goals for this phase

- Do not write or rewrite generation prompts yet.
- Do not claim the current crawl is a layout corpus.
- Do not call the font embedding a generative model.
- Do not treat Impeccable or Taste’s rules as objective ground truth.
- Do not collapse quality, novelty, and slop into one score.
