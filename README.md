# ai-slop-font

An **anti-inductive saturation engine** that fights font/color homogeneity in
AI-built websites. The core idea: nothing is ever a fixed "good list" — every
recommendation is `high quality × low CURRENT saturation`, and anything trending
toward the mainstream auto-retires. The feedback loop *is* the product.

See the full design in
[`docs/superpowers/specs/2026-06-03-ai-slop-font-design.md`](docs/superpowers/specs/2026-06-03-ai-slop-font-design.md).

## Status

Early. The **deterministic Brain core** is built and tested.

| Part | State |
|------|-------|
| `@ai-slop-font/core` — quality metrics, role classification, anti-inductive recommender, slop scorer | ✅ built, 21 tests passing |
| `@ai-slop-font/pipeline` — Google Fonts index (keyless, 1934 fonts) | ✅ built |
| Real glyph-metric extraction (opentype.js: x-height, stroke contrast, counters) | ✅ built + verified on 30 fonts |
| Synthetic saturation signal (sample LLM defaults) | ✅ built, key-ready (needs `ANTHROPIC_API_KEY` to run) |
| O'Donovan attribute seeding (real personality vectors) | ✅ built, 131/200 study fonts matched to the index |
| Synthetic slop matrix (12 vibes × Opus/Sonnet/Haiku) | ✅ collected; merged into display-saturation for 212 fonts |
| GPT-5.5 (OpenAI) synthetic client | ✅ built, key-ready |
| Deterministic crawl (`@ai-slop-font/crawl`, headless Chromium) | ✅ built + verified; multi-supplier, role-aware, AI-directory discovery |
| Slop-o-meter (paste a URL → score) | ⬜ next |
| Brain API + MCP server | ⬜ |
| Discovery site, palette picker | ⬜ |

## Pipeline

```bash
npm run index   -w @ai-slop-font/pipeline   # fetch Google Fonts -> data/fonts.index.json (keyless)
npm run metrics  -w @ai-slop-font/pipeline 30 # extract real glyph metrics for top N fonts
npm run personality -w @ai-slop-font/pipeline # seed real personality from O'Donovan attributes
ANTHROPIC_API_KEY=... npm run synthetic -w @ai-slop-font/pipeline 20  # sample AI font defaults
```

## What's here now

`packages/core` is the pure, deterministic heart everything else calls. No I/O,
no `Date.now()`, no LLM — same input always yields the same output.

- **`metrics.ts`** — objective quality floor (kills broken/limited fonts).
- **`quality.ts`** — three-vote composite quality; the LLM vote is always outvotable.
- **`role.ts`** — deterministic display/hero vs. body classification.
- **`saturation.ts`** — role-aware, recency-weighted saturation from three signals.
- **`recommend.ts`** — the anti-inductive recommender (quality floor is a hard gate;
  saturation only re-orders *within* it; foundational fonts excluded from display).
- **`slop.ts`** — the Slop-o-meter / `check_slop` scorer.

## Run it

```bash
npm install
npm run build --workspace @ai-slop-font/core
node scripts/demo.mjs          # end-to-end demo on sample data
npx vitest run --root packages/core   # tests
```
