# @fixmyslop/crawl

Deterministic, LLM-free crawlers and offline data scripts that measure font,
color, layout, and style overuse ("AI slop") across real product websites —
plus the parsers/miners that turn raw crawl output into reviewable corpora.
No LLM runs at crawl or derivation time; judgment calls are either rule-based
(documented in code comments) or deferred to a human review pass.

## Ethics policy (implemented, not aspirational)

Every entry point below that navigates a headless browser to a third-party
URL goes through the same shared guards:

- **robots.txt** (`src/robots.mjs`, wrapped for TS by `src/robots.ts`): a
  real per-user-agent-group parser with longest-prefix Allow/Disallow
  matching and Crawl-delay support — not a regex. It matches our own UA
  token (`fixmyslop`) first, then falls back to `*`. Fail-open only when
  robots.txt itself can't be fetched/parsed (network error, timeout,
  non-2xx); an explicit matching `Disallow` fails closed. Every entry point
  accepts `--ignore-robots` as an explicit, off-by-default escape hatch.
- **Honest User-Agent** (`src/user-agent.mjs`, `CRAWLER_UA`): one constant,
  imported by every entry point (TS and the plain-JS `harvest-gallery-leads.mjs`
  alike), of the shape `<browser-shaped UA> fixmyslop/<version>
  (+https://github.com/bihanikeshav/fixmyslop)` — identifiable, no scripts
  masquerade as a bare desktop Chrome UA.
- **URL / SSRF safety** (`src/url-safety.ts`, `isSafePublicUrl`): rejects
  non-http(s) protocols, credentials embedded in the URL, localhost/`.local`/
  `.internal`/dotless hosts, and private/loopback/link-local/CGNAT/reserved
  IPv4 literals (including the `169.254.169.254` cloud metadata address) and
  any IPv6 literal, before a discovered URL is ever handed to `page.goto` or
  `fetch`.
- **Rate / concurrency**: each crawler's own bounded worker pool
  (`--concurrency`, default modest) plus per-request timeouts; robots.txt
  `Crawl-delay` is parsed and surfaced (see `checkRobotsAllowed`'s return
  value) for callers that want to honor it.
- **No redistribution of third-party content**: `scrape-getdesign.ts`'s
  output (third-party design-analysis prose) and every raw/screenshot corpus
  live under `data/`, which is entirely gitignored (verified with
  `git check-ignore -v data/reference/getdesign/index.json`) — local
  research only, never committed or re-hosted. Screenshots captured by
  `crawl-features.ts --layout-v2` follow the same rule.
- **Bounded retry**: the shared navigation helpers in `extract.ts`
  (`crawlUrl`/`withPage`, used by `crawl.ts`/`crawl-colors.ts`) and
  `crawl-features.ts`'s `crawlSite` retry navigation exactly once, with a
  short backoff, and only for timeout/network-level errors — never for an
  HTTP 4xx/5xx response, since Playwright's `page.goto()` doesn't throw on
  those in the first place. `crawl-features.ts`'s richer `--layout-v2`
  capture path (multi-step: networkidle-or-fallback nav, content-settle
  wait, autoscroll, screenshot) and `collect-sites.ts`/`scrape-getdesign.ts`'s
  simpler navigations do not have a retry wrapper — each site there is only
  ever visited once per run regardless, so a flaky nav is just a recorded
  failure, and adding a bespoke retry to each would not be a small change.

## Crawlers (headless Chromium, hit third-party sites)

| Script | What it does |
|---|---|
| `src/crawl.ts` | Role-aware font crawler: renders each site, reads computed `font-family`, classifies hero/heading/body/mono fonts. Writes `data/crawl-profiles.json` + `data/observations.crawl.json`. |
| `src/crawl-colors.ts` | Color-density crawler: computed text/background colors per site, deduped to chromatic identity hexes, weighted by site count. Writes `data/observations.colors.json`. |
| `src/crawl-features.ts` | Unified design-feature crawler (glow/glass/pill/bento/gradients/animation/etc.) plus `--layout-v2`, a separate richer geometry+screenshot+responsive-diff capture pass. Writes `data/feature-crawl-raw.ndjson` / `data/observations.*.json`, or (in `--layout-v2`) `data/geometry-crawl-raw.v2.ndjson` + screenshots. |
| `src/collect-sites.ts` | Site-list collector: gathers candidate product-site URLs from AI-tool directories, Product Hunt, GitHub "awesome" lists, and the existing corpus; dedupes, filters noise, checks reachability. Writes `data/site-list.json`. |
| `src/scrape-getdesign.ts` | Scrapes the getdesign.md curated brand-analysis corpus (local research only — see ethics policy above). Writes `data/reference/getdesign/*.md` + `index.json`. |
| `src/harvest-gallery-leads.mjs` | Harvests destination-site leads (host candidates) from design-gallery listing sources; does not touch the main crawl corpus. Writes `data/layout-crawl/master-v2/harvest.gallery-leads.v1.{ndjson,json}`. |
| `src/style-probe.ts` | Ad-hoc CLI: prints the deterministic style fingerprint (`src/style.ts`) for one or more URLs given on the command line. |
| `src/diagnose.ts` | `npx tsx src/diagnose.ts <url>` — deterministic single-site diagnosis: over-used fonts/styles, like-for-like swaps, fresh palettes. |

## Offline derivation (no network — reads raw crawl output)

| Script | What it does |
|---|---|
| `src/recover-layout-raw.ts` | Streams `data/geometry-crawl-raw.v2.ndjson`, drops malformed/duplicate-host lines, writes a clean `data/geometry-crawl-raw.v2.1.ndjson`. Recovery for pre-`createSerialAppender` interleaved-write corruption. |
| `src/derive-layout-data.ts` | The heuristic layout parser: turns raw geometry records into LayoutGenome records, clusters, and positive/slop/uncertain review queues under `data/layout-crawl/`. Exports its pure section-classification helpers (`priceTokenCount`, `hasQuoteAttributionShape`, `reclassifySectionRole`, `dropWrapperSections`, `collapseRepeatedSectionBands`) for unit testing; importing the module does not run its CLI. |
| `src/analyze.ts` | Pure, deterministic multi-role font analyzer (hero/heading/body/mono) used by `extract.ts`. Library only, no CLI. |
| `src/style.ts` | Pure, deterministic style-fingerprint extraction (gradients, glass, shadows, animation libs, etc.) used by `style-probe.ts`. Library only, no CLI. |

## Mining (offline corpus -> layout-archetype proposals)

| Script | What it does |
|---|---|
| `src/mine-archetypes.ts` | Mines the clean v3 layout-genome corpus into layout-archetype proposals (structural + visual clustering). |
| `src/mine-archetypes-gallery.ts` | Same mining approach adapted for the design-forward gallery corpus (visual-primary, role-sequence down-weighted). |
| `src/mine-archetypes-gallery-v2.ts` | v2 re-mine of the gallery pool with a blank/degenerate-screenshot guard and other fixes found in pixel-level review of v1. |
| `src/mine-archetypes-gallery-v2.guard-scan.py` | Scans gallery screenshots with PIL for near-blank/near-uniform pages; feeds the v2 guard above. |
| `src/mine-archetypes-gallery-v2.cluster.py` | Clustering step for the v2 gallery mining pipeline. |
| `src/spam-filter.mjs` | Scores geometry-crawl records for spam/parked-domain/hijacked-WordPress signals (weighted lexicon density, never a bare word alone) and writes an advisory quarantine list for human review. Read-only w.r.t. its inputs. |

## Evaluation

| Script | What it does |
|---|---|
| `src/eval-parser-vision.ts` | Vision-eval scaffolding for the layout parser: samples hosts stratified by section count, emits comparison records for a human/model to check parser output against the actual screenshot. Does not do the visual judgment itself. |

## Shared library modules

| Module | What it does |
|---|---|
| `src/extract.ts` | Shared Playwright navigation helpers (`withBrowser`, `crawlUrl`, `withPage`, `extractElements`) — URL-safety check, robots.txt check, one bounded retry, then extraction. |
| `src/sources.ts` | `discoverOutboundLinks` — reads a directory listing page's outbound links (URL-safety + robots.txt checked before navigating). |
| `src/io.ts` | `createSerialAppender(path)` — chains concurrent NDJSON appends through one promise tail so a bounded-concurrency worker pool never interleaves partial writes (a real, observed Windows `appendFile` failure mode). |
| `src/url-safety.ts` | `isSafePublicUrl` / `checkUrlSafety` — the shared SSRF guard described above. |
| `src/robots.mjs` + `src/robots.d.mts` + `src/robots.ts` | The shared robots.txt parser/checker described above. Implementation is plain ESM JS so `harvest-gallery-leads.mjs` (run via plain `node`) can import it directly with no loader; `robots.ts` re-exports it for the TS entry points (run via `tsx`), typed via the sibling `.d.mts`. |
| `src/user-agent.mjs` + `src/user-agent.d.mts` | The shared `CRAWLER_UA` / `CRAWLER_UA_TOKEN` constants, same dual-import pattern as `robots.mjs`. |

## Data layout (all under the repo-root `data/`, entirely gitignored)

- `data/crawl-profiles.json`, `data/observations.crawl.json` — font crawl output.
- `data/observations.colors.json`, `observations.{accents,styles,gradients,radii,animation,components,type}.json` — color/feature crawl output.
- `data/feature-crawl-raw.ndjson`, `data/geometry-crawl-raw.v2*.ndjson` — raw per-site NDJSON crawl records (resumable; safe to interrupt).
- `data/layout-crawl/` — derived LayoutGenome records, clusters, screenshots, review queues, and gallery-harvest leads.
- `data/reference/getdesign/` — local-only getdesign.md scrape output (never redistribute).
- `data/site-list.json` — the collected candidate site list `crawl-features.ts`/`crawl.ts` crawl against.

## Running tests

```
cd packages/crawl
npx vitest run
```

or from the repo root: `npm run typecheck --workspace=@fixmyslop/crawl` for
the TypeScript check. Tests are plain `vitest` (not `node:test`), colocated
as `*.test.ts` next to the module they cover; the pure helpers in
`crawl-features.ts`, `derive-layout-data.ts`, and `spam-filter.mjs` are
exported specifically so they can be unit-tested with synthetic fixtures —
no network, no browser, no fixtures that touch `data/`.
