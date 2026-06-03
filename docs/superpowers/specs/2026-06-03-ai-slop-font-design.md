# ai-slop-font — Design Spec

**Date:** 2026-06-03
**Status:** Draft for review
**Working name:** `ai-slop-font`

## 1. Problem

AI coding tools (Claude, GPT) converge on the same handful of fonts (Inter, Geist, and friends) and the same color palettes. Plugins that "fix" this (e.g. impeccable) help briefly, but their picks become the next mainstream as soon as enough people adopt them. The result is homogenized, recognizably "AI-built" websites.

The hard part is not finding a good font once. It is *staying ahead of saturation* — any fixed recommendation list eventually becomes the new slop.

## 2. The core principle: anti-inductive recommendation

Nothing in this system is ever a fixed "good list." Every recommendation is computed as:

> **recommend = high quality × low _current_ saturation**

As soon as a font or palette starts trending in the usage data, the engine automatically de-weights it and rotates to the next under-saturated option. This feedback loop is the actual product. It lives in exactly one place (the Brain), so all four user-facing surfaces stay fresh together rather than each going stale on its own schedule.

This applies to every surface, including the palette picker — a curated "good palettes" list would itself become slop if adopted widely, so palettes are recommended by the same saturation × quality rule, not a static list.

## 3. Architecture: one Brain, four thin surfaces

```
INGEST (scheduled, weekly)
  ├─ Crawler:      Product Hunt + Show HN → live sites → detect fonts & palette colors
  └─ Index builder: all ~1,500 Google Fonts + metadata + computed metrics + ratings
            │
            ▼
THE BRAIN (the actual product)
  Saturation × Quality scoring engine.
  Every font & palette has two live scores:
    - saturation  (how overused right now — from the crawler)
    - quality     (metrics floor → personality/taste layer)
  Serves one answer: "good AND currently under-saturated, appropriate for use-case X."
  Anti-inductive: trending items auto-retire.
            │
   ┌────────┼────────┬───────────────┐
   ▼        ▼        ▼               ▼
 ③ MCP   ④ Discovery ⑤ Slop-o-meter  ⑥ Palette picker
```

The Brain is the only component with opinions. Each surface is a thin client that asks the Brain a question and renders the answer.

## 4. Stack

TypeScript monorepo:

- **Web surfaces:** Next.js
- **Crawler + scoring engine:** Node (TypeScript)
- **Database:** Postgres (saturation + quality + index)
- **AI surface:** official TypeScript MCP SDK
- **Font metrics:** `opentype.js` / `fontkit` for glyph-level measurements

One repo, one Brain, four thin clients.

## 5. Components

### 5.1 Font Index
- Source: Google Fonts Developer API for the family list + metadata (category, variants, subsets).
- Download font files (the O'Donovan `gwfonts.zip` is a convenient seed set) for metric extraction.
- Stores: family, category, available weights/styles, subsets, computed metrics (§7), personality vector (§7), saturation score (§6).

### 5.2 Crawler (saturation signal)
- Weekly scheduled job.
- Sources (v1, empirical): **Product Hunt** (API, dated launches) and **Show HN** via the free Hacker News Algolia API.
- For each discovered site: fetch HTML/CSS, detect `fonts.googleapis.com` `<link>` references (fonts are named in plain text), and extract palette colors from CSS.
- Writes time-stamped usage counts so saturation is a *trend*, not a static count.
- Polite crawling; respect robots/ToS. HN Algolia is open; Product Hunt via its API.
- Design choice (v1): empirical scraping first. Synthetic LLM-sampling ("prompt models to build a landing page, parse their default fonts/colors") is a planned second signal, stored with a `source` tag in the same saturation table.

### 5.3 The Brain (scoring engine + internal API)
- Input: `(personality / attributes, use-case, optional constraints)`.
- Output: ranked fonts and palettes that maximize quality × (1 − saturation), filtered for use-case appropriateness.
- Single source of truth queried by all four surfaces.

### 5.4 Surfaces (thin clients)
- **③ MCP server** — tools for Claude/GPT mid-build: e.g. `suggest_font(personality, use_case)`, `suggest_palette(...)`, `check_slop(url_or_stack)`. The "soul" of the project; small adapter over the Brain.
- **④ Discovery site** — humans browse fonts by personality/attribute.
- **⑤ Slop-o-meter** — paste a URL → slop score. Reuses the crawler's detection code.
- **⑥ Palette picker** — under-used good palettes + an explicit anti-list of the overused ones. Built last because palettes need their own saturation/quality modeling (continuous color space → clustering) and carry the highest paradox risk, so they get the most-mature engine.

## 6. Saturation scoring
- Per font / per palette: frequency of appearance across crawled sites, weighted toward recency (a font trending *up* is penalized faster than one with a flat long tail).
- Stored as a normalized 0–1 score that updates each crawl cycle.

## 7. Quality + personality scoring (the "taste" axis)

Grounded in typography research (§9). A **three-vote pipeline**:

1. **Objective metrics floor** (computed from the font file, no taste):
   - x-height ratio, aperture (openness of c/e/s), counter size, stroke contrast, weight count, has-italics, charset completeness.
   - Acts as a hard filter: kills fonts that are "rare because broken/limited," not rare-and-good.
2. **Personality vector** (seeded from real data):
   - Seed from the **O'Donovan crowdsourced attribute dataset** (ratings on Google Fonts).
   - Extend to unrated/newer fonts via a **visual embedding** (DeepFont-style) → predict attributes from nearest neighbors.
   - Organize the attribute list under **Shaikh & Chaparro's three factors**: Potency (rugged↔delicate), Evaluative (beautiful↔cheap), Activity (loud↔calm).
3. **LLM + curation vote**:
   - LLM-as-judge and human-curation sources (Typewolf, Fonts In Use) as a third vote that breaks ties and adds use-case appropriateness. Never decides alone — metrics + data model can outvote it, which guards against re-introducing AI taste bias.

The "personality" controlled vocabulary is therefore the O'Donovan attribute set, structured by Shaikh's three factors — not invented from scratch.

## 8. Build order (all four ship; this is sequence, not triage)

| # | Milestone | Rationale |
|---|-----------|-----------|
| M1 | Font Index + quality scoring | Foundation; yields a queryable "good fonts" dataset before any crawling. |
| M2 | Crawler + saturation DB | Makes the engine anti-inductive (the whole point). |
| M3 | The Brain (scoring API) | Unifies M1 + M2 into one endpoint. |
| M4 | MCP | The soul; small adapter over the Brain. |
| M5 | Slop-o-meter | Reuses M2 detection; the viral hook. |
| M6 | Discovery site | Most UI work. |
| M7 | Palette picker | Last; palettes get the most-mature engine. |

Implementation plans are written one milestone at a time (M1 first: build → verify → then plan M2), so we never have four half-finished pieces.

## 9. Research foundations

The quality and personality axes are grounded in prior work rather than guessed:

- **O'Donovan, Lībeks, Agarwala, Hertzmann — *Exploratory Font Selection Using Crowdsourced Attributes* (SIGGRAPH 2014).** Crowdsourced descriptive attributes (dramatic, friendly, legible, graceful, …) over Google Fonts, plus a trained model to predict attributes for new fonts. Downloadable: `attribute.zip`, `similarity.zip` (metric-learning code), `gwfonts.zip`. **Directly seeds our personality axis.** https://www.dgp.toronto.edu/~donovan/font/
- **Shaikh & Chaparro — *Perception of Fonts: Perceived Personality Traits and Uses*.** Three-factor model (Potency, Evaluative, Activity) and family-level personality/use associations; congruence finding (mismatched font ↔ content is judged worse). https://soma.sbcc.edu/users/russotti/113/personality_Shaikh.pdf
- **Wang et al. — *DeepFont* (Adobe).** CNN visual font embedding (4096-dim) → font-similarity metric; used to extend attribute prediction to unrated fonts. https://arxiv.org/pdf/1507.03196
- **Gao et al. — *Attribute2Font* (SIGGRAPH 2020).** Attribute-conditioned font modeling; reference for attribute↔glyph relationships. https://yuegao.me/Attr2Font/
- **Vox-ATypI classification.** Established structural taxonomy (serif/sans/contrast/axis) for the metrics layer. https://en.wikipedia.org/wiki/Vox-ATypI_classification
- **Legibility metrics** (x-height, aperture, counter, stroke contrast). https://en.wikipedia.org/wiki/Legibility
- **Morris / Baskerville experiment** (~45,000 participants, p≈.008): identical text trusted more in Baskerville than Helvetica/Comic Sans — justifies returning use-case-appropriate fonts, not just rare ones. https://marketingexperiments.com/value-proposition/importance-of-font

## 10. Known risks

- **Palette modeling ≠ font modeling.** Color is a continuous space; saturation/quality needs clustering, not a simple list. Deferred to M7 deliberately.
- **LLM-as-judge bias.** Mitigated by making it one of three votes, outvotable by metrics + the O'Donovan data model.
- **Crawl politeness / ToS.** HN Algolia is open; Product Hunt via its API; rate-limit and respect robots.
- **Personality vocabulary drift.** Anchored to the O'Donovan attribute set + Shaikh factors to keep it stable and grounded.
- **The paradox at the meta level.** If *this tool itself* becomes ubiquitous, its recommendations trend up and the anti-inductive loop must retire them — which it is designed to do. The system eating its own recommendations is a feature, not a bug.

## 11. Out of scope (v1)

- Non-Google font sources (Adobe Fonts, foundries) — Google Fonts only for v1.
- Synthetic LLM-sampling slop signal — planned second signal, not in M1–M2.
- Accounts/auth, paid tiers — defer until a surface proves traction.
