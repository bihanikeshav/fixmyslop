# ai-slop-font — Design Spec

**Date:** 2026-06-03
**Status:** Draft for review (v2)
**Working name:** `ai-slop-font`

## 1. Problem

AI coding tools (Claude, GPT) converge on the same handful of fonts and color palettes. Plugins that "fix" this help briefly, but their picks become the next mainstream as soon as enough people adopt them. The result is homogenized, recognizably "AI-built" websites.

The hard part is not finding a good font once. It is *staying ahead of saturation* — any fixed recommendation list eventually becomes the new slop.

## 2. The core principle: anti-inductive recommendation

Nothing in this system is ever a fixed "good list." Every recommendation is computed as:

> **recommend = high quality × low _current_ saturation**

As something starts trending in the usage data, the engine de-weights it and rotates toward the next under-saturated option. This feedback loop is the actual product, and it lives in one place (the Brain), so all four surfaces stay fresh together.

**Two hard rules that keep it from feeling erratic or recommending junk:**

1. **Saturation only re-orders _within_ the quality-floored set.** It never pushes a recommendation down into low-quality fonts. Every suggestion is always genuinely good — just less worn. You never get "weird ugly font," only "good and less common."
2. **Stability over a project's lifetime.** Saturation moves at the speed of real adoption (months/quarters), not hours. The recommendation set is cached and *deterministic within a refresh window* (same query → same answer this cycle), refreshed on a slow cadence. A "lock my pick" rule means the engine won't call your chosen font slop mid-project, and a **freshness↔safety dial** lets users choose how aggressively to avoid the mainstream.

## 3. Saturation is role-aware (the key insight)

Font popularity is meaningless without **role**. Foundational body/UI fonts (Inter, Roboto, Open Sans) are *infrastructure* — being common there is neutral, not slop. The slop that hurts is in the **display/hero role**: the H1, the headline, the font meant to carry personality.

So saturation is segmented by role:

- **`body/foundational`** — the dominant font in paragraph/long text. High saturation here is fine.
- **`display/hero`** — the largest above-the-fold font + the first `<h1>`. **This is where slop is measured.**

A font that is a popular *body* font is neutral. A *display* font appearing everywhere this month is the signal we fight.

Consequence: **Google Fonts popularity ranking is NOT the slop detector** (it is dominated by body-text volume and is role-blind). It is demoted to a **"foundational baseline / exclusion list"** — the set of fonts so common they read as invisible, used to exclude from personality recommendations.

## 4. Architecture: one Brain, four thin surfaces

```
INGEST (deterministic, scheduled weekly)
  Reusable new-products pipeline:  discover → store → run analyzers
    ├─ Discovery: feed-first source registry (§7)
    ├─ Crawl:     headless Chromium VM, NO LLM (§6)
    └─ Analyzer #1: fonts (role-aware) + palette.  More analyzers later.
  Plus two more saturation signals:
    ├─ Synthetic: sample LLMs, read their hero-font defaults
    └─ Community: chatter from HN/Reddit (leading-edge trend)
  Plus the Font Index: all Google Fonts + metadata + metrics + ratings
            │
            ▼
THE BRAIN  (the actual product)
  Saturation (role-aware) × Quality (metrics floor → taste) scoring engine.
  Serves: "good AND currently under-saturated in the display role,
           appropriate for use-case X." Anti-inductive; rules in §2.
            │
   ┌────────┼────────┬───────────────┐
   ▼        ▼        ▼               ▼
 ③ MCP   ④ Discovery ⑤ Slop-o-meter  ⑥ Palette picker
```

The Brain is the only component with opinions. Each surface is a thin client.

## 5. Stack

TypeScript monorepo:
- **Web surfaces:** Next.js
- **Crawler + engine:** Node (TypeScript)
- **Headless browser:** Playwright (Chromium) on a single scheduled VM
- **Database:** Postgres
- **AI surface:** official TypeScript MCP SDK
- **Font metrics:** `opentype.js` / `fontkit`

## 6. The crawl is deterministic and LLM-free

The entire empirical pipeline runs on **one scheduled VM with headless Chromium** — no LLM, no GPU, no ML serving. It is reproducible and auditable.

1. **Pull product list** from the source registry (§7) — feed-first.
2. **Render each site** in headless Chromium (defeats JS-rendered + self-hosted-font invisibility).
3. **Extract fonts** via `getComputedStyle` → exact `font-family`, `font-size`, `weight`. Pure DOM measurement.
4. **Classify role by deterministic heuristic** — `display/hero` = largest above-the-fold font + first `<h1>`; `body` = dominant font in long text. Auditable rules, no LLM.
5. **Multi-supplier detection** — read whatever is actually rendered (Adobe Fonts, Fontshare, Fontspring, self-hosted `@font-face`), not just `fonts.googleapis.com`.
6. **Palette extraction** — computed colors weighted by rendered area, clustered with fixed-seed k-means (deterministic).
7. **Aggregate** → role-segmented saturation counts. Snapshot + timestamp each crawl so any result is reproducible from stored data.

Observation is supplier-agnostic; **recommendations bias toward easily-usable sources** (Google Fonts + free Fontshare) so the MCP's suggestions are droppable straight into a build.

## 7. Discovery source registry (feed-first)

Ingest order favors clean APIs/RSS (reproducible) over HTML scraping (fragile).

**Tier 1 — clean APIs/feeds (deterministic backbone):**
- Hacker News (Show HN) — Firebase + Algolia API
- Reddit — r/SideProject, r/SaaS, r/InternetIsBeautiful — official API / `.json` / RSS
- Product Hunt — GraphQL API + RSS
- BetaList — RSS

**Tier 2 — scrape "just launched" pages:** Uneed, Peerlist, Startup Fame, EverFeatured, SaaSHub, Indie Hackers, Makerlog

**Tier 3 — AI-tool directories (scrape "newest" views only):** There's An AI For That, Futurepedia, Toolify, RankmyAI

**Self-seeding:** parse the maintained GitHub "awesome lists" (`best-of-ai/ai-directories`, `DirectorySurf/awesome-producthunt-alternatives`) to auto-discover new aggregators, so the registry is not hardcoded.

**Deliberate gap:** X/Twitter's API is now expensive and locked down; the "build in public" signal there is out of scope for v1 rather than built on fragile infra. Conscious choice, not a silent omission.

## 8. The reusable new-products pipeline

The valuable asset is not "a font counter" — it is a **weekly compiled feed of new products**, with pluggable analyzers:

```
discover products → store → run analyzers[]
```

- **Analyzer #1 (now):** fonts (role-aware) + palette.
- **Later:** additional analyzers (messaging patterns, stack, pricing) plug into the same feed without re-building discovery.

Fonts first; the pipeline is built so the rest can plug in.

## 9. Quality + personality scoring (the "taste" axis)

Grounded in typography research (§12). A **three-vote pipeline**:

1. **Objective metrics floor** (deterministic, from the font file): x-height ratio, aperture, counter size, stroke contrast, weight count, italics, charset completeness. Hard filter that kills "rare because broken/limited" fonts.
2. **Personality vector** (seeded from real data): seed from the **O'Donovan crowdsourced attribute dataset** (ratings on Google Fonts); extend to unrated fonts via a **DeepFont-style visual embedding** (predict attributes from nearest neighbors). Organized under **Shaikh & Chaparro's three factors**: Potency, Evaluative, Activity.
3. **LLM + curation vote** (offline, cached, outvotable): LLM-as-judge + human curation (Typewolf, Fonts In Use) as a third vote for ties and use-case appropriateness. Never decides alone.

**Where the LLM lives:** only here (taste tagging — run once per font, cached forever, outvotable) and in the *separate* synthetic saturation signal. **The crawl and all extraction are LLM-free.**

## 10. Surfaces and their markets (honest per-surface)

- **③ MCP — mass market, invisible.** Claude/GPT call it mid-build (`suggest_font`, `suggest_palette`, `check_slop`); end users get better fonts without caring or installing anything. This is the real distribution play and the soul of the project.
- **⑤ Slop-o-meter — acquisition/viral.** Paste a URL → role-aware slop score. Shares the single-page **role-aware extraction module** (render one URL → hero/body fonts), which is *built here* and then reused at scale by the M3 crawl. At M2 it scores against the synthetic signal + foundational baseline; the score deepens once the real crawl lands in M3.
- **④ Discovery site — niche.** Humans browse by personality. Competes with Typewolf; weakest commercial surface, but cheap once the Brain exists.
- **⑥ Palette picker — last, riskiest.** Continuous color space needs clustering; highest paradox risk → gets the most-mature engine.

## 11. Build order (all four ship; sequence, not triage)

| # | Milestone | Rationale |
|---|-----------|-----------|
| M1 | Font Index + quality scoring + **synthetic signal** | Foundation; synthetic gives a role-aware AI-slop signal in days with no crawl infra. Yields a working Brain fast. |
| M2 | Brain (scoring API) + **role-aware extraction module** + **MCP + Slop-o-meter** | The cheap, high-leverage surfaces ship early (Grok's valid point). The single-page extraction module is built here and reused at scale in M3. |
| M3 | Deterministic crawl + source registry + role-aware saturation | The empirical backbone; reuses M2's extraction module, adds scheduling/sourcing/aggregation. Heavier, lands after the engine is proven. |
| M4 | Discovery site | Most UI work. |
| M5 | Palette picker | Most-mature engine; own color modeling. |

Implementation plans are written one milestone at a time (M1 first: build → verify → then plan M2), so we never have several half-finished pieces.

## 12. Research foundations

- **O'Donovan et al., *Exploratory Font Selection Using Crowdsourced Attributes* (SIGGRAPH 2014).** Crowdsourced attributes over Google Fonts + a model to predict them for new fonts. Downloadable data (`attribute.zip`, `similarity.zip`, `gwfonts.zip`). Seeds our personality axis. https://www.dgp.toronto.edu/~donovan/font/
- **Shaikh & Chaparro, *Perception of Fonts*.** Three-factor model (Potency, Evaluative, Activity) + family/use associations + congruence finding. https://soma.sbcc.edu/users/russotti/113/personality_Shaikh.pdf
- **Wang et al., *DeepFont* (Adobe).** CNN visual font embedding → similarity metric to extend attribute prediction. https://arxiv.org/pdf/1507.03196
- **Gao et al., *Attribute2Font* (SIGGRAPH 2020).** https://yuegao.me/Attr2Font/
- **Vox-ATypI classification.** Structural taxonomy for the metrics layer. https://en.wikipedia.org/wiki/Vox-ATypI_classification
- **Legibility metrics** (x-height, aperture, counter, stroke contrast). https://en.wikipedia.org/wiki/Legibility
- **Morris / Baskerville experiment** (~45k participants, p≈.008): identical text trusted more in Baskerville — justifies use-case-appropriate recommendations. https://marketingexperiments.com/value-proposition/importance-of-font

## 13. Known risks

- **Crawl sample = leading edge, by design.** New products on HN/Reddit/PH are not a bias to correct; they are exactly the population where AI-slop and trends surface first. We want the leading edge, not the whole web.
- **Role heuristic edge cases.** Sites with unusual DOMs may mis-classify hero vs. body; mitigated by simple, auditable rules and snapshotting for review.
- **LLM-as-judge bias.** One of three votes, outvotable by metrics + the O'Donovan model.
- **Palette modeling ≠ font modeling.** Continuous color space; deferred to M5 deliberately.
- **The meta paradox.** If this tool itself becomes ubiquitous, its recommendations trend up and the anti-inductive loop retires them. The system eating its own recommendations is a feature, mitigated by §2's stability rules.

## 14. Out of scope (v1)

- Non-Google font *recommendation* sources (Adobe/foundry) — observed for saturation, but recommendations stay Google Fonts + free Fontshare for usability.
- X/Twitter ingestion (§7).
- Accounts/auth, paid tiers — defer until a surface proves traction.
