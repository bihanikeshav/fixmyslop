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
| Google Fonts index + O'Donovan attribute seeding | ⬜ next |
| Synthetic saturation signal (sample LLM defaults) | ⬜ |
| Brain API + MCP server + Slop-o-meter | ⬜ |
| Deterministic crawl (headless Chromium) + source registry | ⬜ |
| Discovery site, palette picker | ⬜ |

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
