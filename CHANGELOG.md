# Changelog

User-visible changes. Newest first. Dates are ISO.

## Unreleased — 2026-09-19 audit fixes

### Fixed
- **Fresh clones could not run.** `apps/engine/data/*.json` and the six
  `data/research/master-v2/*.json` files the engine imports were gitignored. They are now
  tracked, and `scripts/check-repo-hygiene.mjs` fails CI if tracked code imports an
  untracked file.
- Engine: `auditSystem()` crashed on `designSystem()` output (`radius` object vs array).
- Engine: `checkPalette` / `checkColor` / `nearestSafe` cost up to ~250–500 ms per call on
  banned input; now one KDE pass per candidate plus bounded memoisation. Outputs are
  byte-identical.
- Engine: unmeasured (`null`) font aperture no longer reads as `0`.
- Web: DOM XSS in the dashboard font checker (`innerHTML` echoing user input).
- Web: mislabelled "Watch the Slop-o-meter" button; silent clipboard failure.
- Core: `apertureOpenness` was a constant 0.5 carrying 20% of the quality score — now
  `null` (unmeasured) and excluded from score and floor gate. **Rebuild the font index.**
- Core: a single sighting could produce a maximal saturation trend.
- Pipeline: personality seeding now recomputes quality with the attribute vote; synthetic
  samplers accumulate windows instead of overwriting (`--fresh` for the old behaviour).
- Crawl: concurrent NDJSON appends could interleave on Windows in the default
  `crawl-features` path.
- Humanizer skill: bridge scripts raised `ModuleNotFoundError` outside the repo.
- Personality skill: directions recommended heading fonts the same skill bans (generator
  fixed too).
- TextSlopBench: three scripts hard-coded another machine's path; judgment scorers could
  misattribute when two systems emitted identical text.

### Security
- Worker: 256 KB body cap (413), per-IP rate limiting via the Rate Limiting binding (429),
  schema-typed query coercion, `nosniff` / `Referrer-Policy`, cache headers, and an origin
  allowlist for the `curl | sh` install script.
- Web: Content-Security-Policy and security headers via `apps/web/_headers`.
- Crawl: shared URL-safety filter (no private/IP-literal hosts), real robots.txt parser
  honoured by every entry point, one honest user agent.
- CI actions pinned by commit SHA.

### Changed
- `apps/engine/genome-vector.mjs` is now the implementation; the `viz/` file re-exports it
  (removes the engine ↔ viz import cycle).
- Fontshare/libre-foundry ingest enforces a free-for-commercial-use licence allowlist.
- The Slop-o-meter demo and ~20 files only it used moved to `archive/` (not built or deployed).
- Web build compiles only what the live page loads and stamps a content-hash cache-buster.

### Added
- `LICENSE` (Apache-2.0), `NOTICE`, `CONTRIBUTING.md`, `.editorconfig`, this changelog.
- `AGENTS.md` / `CLAUDE.md` orientation, `docs/README.md` index, `docs/DATA-AND-LICENSING.md`,
  READMEs for `scripts/`, `viz/`, `benchmarks/`, `apps/web/`, `packages/*`, `archive/`,
  `docs/textslop/`, `textslopbench/experiments/`.
- ~230 new tests (crawl 4 → 122, core 32 → 48, pipeline 47 → 75, apps 329 → 350, pytest 135 → 165).

### Known open items
- TextSlopBench v2 superiority/non-inferiority verdicts remain **withdrawn** until a
  cluster-valid bootstrap rerun (needs the local corpora and model outputs).
- `apertureOpenness` is unmeasured; implementing real outline aperture analysis is future work.
- `dashboard.html` predates `DESIGN.md` and uses a different palette/type system.
- No linter/formatter is configured yet.
