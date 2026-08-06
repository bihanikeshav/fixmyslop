# Competitive skill and engine audit

Date: 2026-08-03

Scope: compare the local `fix-ai-slop` skill/MCP with Impeccable and Taste, record what the current implementation actually does, and identify the data and system work needed before prompt authoring.

Prompt writing is intentionally out of scope for this document.

## Executive conclusion

The idea is strong, but the current product is not yet a complete intent-to-design engine.

- Impeccable is currently stronger at iterative polish, critique, browser feedback, and deterministic QA.
- Taste is currently stronger at explicit aesthetic direction, controlled variance, layout diversification, block-level reuse, and anti-slop constraints.
- Our MCP is stronger where it has empirical and machine-readable primitives: OKLCH palette generation, contrast checks, corpus density, brand collision checks, font inventory, and callable MCP tools.
- Our repository already contains a real font visual-neighbor experiment, but the live MCP does not use it. The deployed font service currently recommends from a pre-baked list using hand-coded ranking and avoidance rules.
- Our layout service is not a layout latent space or generator yet. It exposes five static archetypes and deterministic layout math.

So the honest positioning is: differentiated foundation with a potentially unique direction, not a proven one-of-a-kind MCP yet. The defensible part will be the connected data loop: intent -> style genome -> font/palette/material/layout retrieval -> constrained variation -> rendered QA -> quality/slop feedback.

## Is installation easy?

It is easy once the client and shell are known, but it is not identical for every agent.

The hosted installer can be fetched with a POSIX shell command and the MCP can be registered with client-specific commands. The current installer is Unix-oriented; native PowerShell users may need Git Bash, WSL, or a manually copied skill directory. MCP registration also differs between Claude Code, Cursor, Claude Desktop, and Codex.

The right claim is “low-friction installation with documented client paths,” not “one command works everywhere.” Installation convenience is not the moat. The moat is the quality of the design data, the representations, the generator, and the verification loop.

## Comparison

| Capability | Impeccable | Taste | Current local MCP/skill |
|---|---|---|---|
| Main strength | Inspect, critique, polish, and verify an existing interface | Direct an agent toward a distinctive frontend aesthetic | Deterministic design primitives exposed as MCP tools |
| Design context | `PRODUCT.md`, `DESIGN.md`, surface briefs, and structured `design.json` | Brief inference, design-system mapping, dials, block schema | Thin skill index plus tool/reference files; no connected style genome |
| Variation | Live mode produces three materially different variants for a picked element | `DESIGN_VARIANCE`, `MOTION_INTENSITY`, and `VISUAL_DENSITY` dials | Intent is currently hashed into a seed; no semantic style parsing or diversity memory |
| Layout | Audits and live element-level variants; layout command gives actionable redesign direction | Explicit anti-centered-hero rule, asymmetric options, reusable blocks | Five static archetypes and deterministic math; no corpus retrieval or generator |
| Typography | Context-driven typesetting and hierarchy review | Strong font guidance, anti-monoculture rules, role-aware choices | 2,075-font service list, freshness/body ranking, avoid list; no live visual-neighbor retrieval |
| Color | Critique plus system-aware review | Strong palette discipline and one-accent/one-theme locks | OKLCH math, WCAG checks, corpus KDE, brand collision checks, banned color bands |
| Materials | Critique and polish of radius, shadow, borders, and hierarchy | Explicit radius/material locks and anti-glow guidance | Separate radius/shadow/material checks; not yet linked to intent and hierarchy |
| Anti-slop | 64-pattern catalog, 59 deterministic detector rules, plus LLM critique | Large explicit ban list, redesign protocol, and preflight | Partial anti-slop checks and avoid lists; no unified slop label model |
| QA loop | Detector, browser scan, hooks after edits, prioritized critique | Hard preflight and implementation checklist | Tool checks exist, but no required render/review loop tying output quality to generation |
| Data grounding | Strong operational rules and detector; not an exposed empirical design corpus | Strong authored taste system; not an exposed empirical latent corpus | Existing scraped color/style/font data and experimental font embeddings, not yet joined into the live generator |

## What Impeccable does better

Impeccable treats design quality as an iterative inspection problem rather than only a generation problem. Its context files separate product strategy from the visual system and from individual surfaces. Its critique combines heuristic/persona review with deterministic detector findings. Its hooks create feedback immediately after edits, and its live mode lets an agent compare three variants before accepting one.

The main lesson for us is not to copy its wording. It is to add an operational quality loop:

1. Capture the product and surface intent.
2. Generate a connected style/layout candidate.
3. Render it in a browser.
4. Run deterministic checks and a structured visual review.
5. Record the result as accepted, rejected, or revised training data.

## What Taste does better

Taste makes aesthetic direction explicit before implementation. It infers page kind, vibe, audience, and references from a brief, then uses three dials for variance, motion, and density. It locks a small number of system decisions so a page does not drift. It diversifies hero/layout choices, specifies full UI states, and defines reusable blocks with mobile, motion, dark-mode, and anti-pattern metadata.

The main lessons for us are:

- Add explicit, interpretable style dimensions instead of treating free text as a random seed.
- Make variation a first-class input and enforce diversity across a batch of outputs.
- Attach “when to use,” “not for,” mobile behavior, and state behavior to every layout primitive.
- Treat radius, accent count, theme, material, and density as a coherent system.
- Store positive examples and rejected patterns as structured data, not just prose.

## What our MCP does better today

Our strongest current advantage is grounding where other skills mostly provide instructions:

- The color engine uses OKLab/OKLCH calculations, contrast checks, corpus density, and brand-clone checks.
- The repository contains 1,279 crawled sites, 1,248 usable feature records, 1,971 aggregated color observations, and 2,075 indexed fonts.
- The MCP exposes callable checks for color, typography, spacing, radius, shadows, layout, motion, and design-system consistency.
- The service can make deterministic outputs and can reject known collision zones and common font choices.
- The repository already has experimental 200-dimensional visual glyph embeddings, 384-dimensional DINOv2 visual embeddings, hybrid font neighbors, and a 2D projection.

That is a better foundation for a real engine than a skill that only tells an agent to “make it premium.” The weakness is that most of this evidence is not connected to the generation path yet.

## Font latent-space audit

### What exists in the repository

The root `data/` directory contains:

- `fonts.index.json`: 2,075 fonts with richer glyph metrics and personality flags.
- `font-visual.json`: roughly 1,930 fonts with 200-dimensional rasterized-glyph vectors.
- `font-visual-deep.json`: roughly 2,060 fonts with 384-dimensional DINOv2 glyph-image vectors.
- `font-neighbors.json`: hybrid neighbors for roughly 2,067 fonts, blending feature/personality similarity with visual cosine similarity.
- `font-projection.json`: a 2D visual projection used by the font-map visualizations.

This is a genuine latent-space experiment in the repository, although “latent” here means an engineered visual/feature embedding space, not a generative font model.

### What the live MCP uses

The service bundle currently strips font records to a small catalogue containing family, supplier, category, popularity, foundational/brand flags, and quality. The live suggestion path sorts that catalogue by category and hand-coded freshness/body heuristics. The avoid list and top-font rules are also hand-authored.

Therefore:

- Live font recommendations: pre-baked catalogue plus rules.
- Live color recommendations: corpus-informed mathematical engine.
- Repository font exploration: real visual/feature embeddings and neighbor files.
- Live font latent retrieval: not wired in yet.

The next integration should query the font space with a style vector, retrieve several candidates, apply role/readability constraints, and diversify the final pairings. It should return the evidence and neighbor distance so a stronger agent can understand the decision.

## Why the current output can feel merely “refined”

The lack of gorgeous results is a systems gap, not only a prompt gap. The current skill is a thin index over passes, while the MCP has good local checks but does not yet provide:

- a semantic intent-to-style representation;
- a layout corpus and layout generator;
- a positive-quality dataset distinct from merely non-sloppy pages;
- asset/hero/art-direction decisions;
- a controlled variation mechanism that remembers previous choices;
- a browser render and visual-acceptance loop;
- a unified representation of hierarchy, material, and personality.

Checks can make an existing page less obviously generic. They cannot, by themselves, invent a compelling composition, a subject-specific visual signature, or a strong information hierarchy.

## Recommended borrow list

Borrow the following concepts, but implement them as data and engine contracts rather than copied prompt prose:

1. From Impeccable: product/design/surface context files, deterministic detector output, post-edit hooks, browser scan, three-variant comparison, and prioritized critique.
2. From Taste: brief inference, the three dials, explicit system locks, layout diversification, full states, and the block-library schema.
3. From our own research: corpus density, brand collision, font visual neighbors, site observations, and slop/quality labels with provenance.

Do not copy their assumptions blindly. Frequency is not quality, novelty is not quality, and an anti-pattern ban cannot replace a strong positive model.

## Proposed order of work

1. Freeze the data contracts in `2026-08-03-intent-style-layout-space-spec.md`.
2. Integrate the existing font visual/feature neighbors into a read-only recommendation path.
3. Extend crawling to capture geometry, hierarchy, DOM relationships, semantic regions, responsive behavior, and screenshots.
4. Curate a positive layout set and a separate slop set with provenance and confidence.
5. Build interpretable layout genomes and retrieve/compose layout candidates.
6. Add render-based QA and store accepted/rejected outcomes.
7. Only then have a stronger agent author prompts around the stable contracts.

## Sources

- [Impeccable documentation](https://impeccable.style/docs/impeccable/)
- [Impeccable design context](https://impeccable.style/docs/context/)
- [Impeccable detector](https://impeccable.style/docs/detector/)
- [Impeccable hooks](https://impeccable.style/docs/hooks/)
- [Impeccable critique](https://impeccable.style/docs/critique/)
- [Impeccable live mode](https://impeccable.style/docs/live/)
- [Impeccable slop catalog](https://impeccable.style/slop/)
- [Taste documentation](https://www.tasteskill.dev/docs)
- [Taste source skill](https://github.com/Leonxlnx/taste-skill/blob/main/skills/taste-skill/SKILL.md)
- [Taste changelog](https://github.com/Leonxlnx/taste-skill/blob/main/CHANGELOG.md)
