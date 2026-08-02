# Design-engine expansion: math domains, MCP tools, and an engine-backed skill

**Date:** 2026-08-03
**Status:** approved — ready for implementation plan

## Problem

The pure engine (`apps/engine/engine.mjs`) already *generates and audits* two design
domains — **color** (`checkColor`/`checkPalette`/`nearestSafe`) and **font**
(`checkFont`/`suggestFonts`) — and the MCP Worker (`apps/worker`) exposes them as 5
tools plus a REST mirror. Every other design decision (spacing, type scale, radius,
shadow, layout, motion, controls) is still made by vibes.

We want those decisions made by **closed-form math, no model** — deterministic in,
deterministic out — surfaced through the MCP so any LLM (and our own skill) can ask
the engine for the *right* value instead of guessing, and audit a submitted value for
slop. Then a **new standalone skill** borrows impeccable's design flow but replaces
every deterministic decision with an engine call, keeping `/personality`'s ideation.

## Non-goals

- No new model / no corpus for the new domains — they are formulas.
- No redesign of the existing color/font logic (only a new palette *generator*, ported
  from proven web-app code).
- No auto-deploy: the final `wrangler deploy` is the user's to run (needs their login).

## Architecture (three layers, bottom-up)

```
apps/engine/system.mjs   (A) new pure math: type/space/radius/shadow/layout/motion/controls
apps/engine/engine.mjs       re-exports system.mjs through createEngine + adds generatePalette
apps/engine/cli.mjs      (A) thin arg parser over the engine — offline front door for the skill
        │
apps/worker/src/tools.mjs (B) new functions → MCP tools + REST mirror
        │
skills/atelier/           (C) impeccable-flavored skill that CALLS the engine for every
                              deterministic decision; keeps /personality's ideation
```

Each layer depends only on the one below. The engine stays pure (no fs / Date.now /
Math.random), so the identical code runs in the browser demo, the Worker, and the CLI.
One source of truth → verdicts can never drift between surfaces.

**Convention:** every new domain function returns the same shape as `checkColor` —
generators return `{ value, tokens, note }`; auditors return
`{ verdict, reason, fix }` — so the MCP and the skill treat all domains uniformly.

## (A) Engine math — `apps/engine/system.mjs`

All functions pure and closed-form. Signatures + the governing formula:

### ① Type
- `typeScale({ base=16, ratio=1.25, up=5, down=1 })` → `[{ step, px, rem }]`.
  `size = base · ratio^step`, snapped to 0.5px. `ratio` accepts a name
  (`minor-third 1.2`, `major-third 1.25`, `perfect-fourth 1.333`, `aug-fourth 1.414`,
  `perfect-fifth 1.5`, `golden 1.618`) or a number.
- `lineHeightFor(px)` → unitless; interpolates between anchors
  (12→1.6, 16→1.5, 24→1.35, 48→1.15, 96→1.02), tighter as size grows.
- `trackingFor(px)` → letter-spacing em: negative on display sizes, ~0 at body,
  slightly positive below ~13px. Smooth curve on log(size).
- `fluidType(minPx, maxPx, minVw=390, maxVw=1440)` → exact CSS `clamp()`:
  slope `= (maxPx−minPx)/(maxVw−minVw)`; `clamp(min, calc(intercept + slope·100vw), max)`.
- `auditTypeScale(sizes[])` → recovers successive ratios; flags **incoherent ratio**,
  **ratio < 1.1** (muddy hierarchy), **> 7 distinct sizes**. `fix` = a clean scale over
  the same range.

### ② Spacing
- `spacingScale({ base=4, steps=9 })` → `base · [1,2,3,4,6,8,12,16,24]` → `{token,px,rem}`.
- `auditSpacing(values[])` → flags **off-grid** (not divisible by base), **one-off
  values**, non-monotonic progression. `fix` = snapped-to-grid scale.

### ③ Radius
- `radiusScale({ base=8 })` → `{ none:0, sm, md, lg, xl, full:9999 }`.
- `nestedRadius(outer, padding)` → `max(0, outer − padding)`; `outerRadius(inner, padding)`
  → `inner + padding` (concentric-corner rule).
- `auditRadius(values[])` → flags scale sprawl; with pairs, **broken concentricity**.

### ④ Shadow / elevation
- `shadow(elevation, { hue=0, alpha=0.18 })` → multi-layer box-shadow. N layers grow with
  elevation; `offsetY_i ≈ elevation·k^i`, `blur_i ≈ 2·offsetY_i`, `alpha_i` decays
  geometrically, tint toward `hue` (not pure black). Returns `{ css, layers }`.
- `auditShadow(css)` → flags **pure-black harsh alpha**, **single flat layer**,
  **glow** (offset 0 + large blur). `fix` = a proper ramp.

### ⑤ Layout + ratios (flagship)
- `grid({ viewport, minCol=280, gutter=24, margin=32, maxCols=12 })` →
  `inner = viewport − 2·margin`; `cols = clamp(1, floor((inner+gutter)/(minCol+gutter)), maxCols)`;
  exact `colW`, `gutter`, `margin`, and a `grid-template-columns`.
- `splitRatio(name)` → golden `38.2/61.8`, thirds `33/67`, half `50/50`;
  `computeSplit(width, ratio)` → `[a,b]`.
- `measure(fontPx, cpl=66)` → column width `≈ cpl · 0.5em`; `auditMeasure(widthPx, fontPx)`
  flags CPL outside 45–75.
- `focalPoints({ w, h })` → rule-of-thirds + golden intersection coordinates.
- `contentBreakpoints({ fontPx, maxCpl=75 })` → viewport widths where the measure would
  exceed `maxCpl` (content-driven, not device-driven).
- `layout(brief)` — composite over the above: `{ viewport, baseFont, columns, split }` →
  grid + measure + margins + recommended split + whitespace-ratio target.
- `auditLayout({...})` → measure out of range, off-grid margins/gutters, inconsistent gutter.

### ⑥ Motion + controls
- `motionTokens()` → curves (`ease-out-quart .25,1,.5,1`; `-quint .22,1,.36,1`;
  `-expo .16,1,.3,1`), durations (150/250/400), `exit = 0.75·enter`.
- `durationFor(px)` → dynamic duration on travel distance (Material curve).
- `stagger(i, base=50)` → per-item delay.
- `auditMotion({ durationMs, easing })` → flags **> 500ms feedback**, **bounce/elastic**.
- `controlSize(fontPx, density='cozy')` → height from type scale + padding by density
  (`compact|cozy|comfortable`), clamped so hit-target ≥ **44px**.
- `zScale()` → `{ base, dropdown, sticky, modal, toast }` named layering tokens.
- `auditControl({ heightPx })` → flags sub-44px targets.

### Flagship composites (in `engine.mjs`)
- `generatePalette(seed)` — port `freshAccent`/`freshNeutral` from `apps/web/app.js`;
  loop until `checkPalette` passes and contrast ≥ 4.5 → `{ ground, ink, accent, accent2 }`.
  Pure (seed-driven, no Math.random — caller supplies a numeric seed / index).
- `designSystem(seed)` — one coherent theme from `{ baseFont, baseUnit, ratio,
  radiusBase, accent? }`: palette + typeScale + spacingScale + radiusScale + shadow ramp
  (elevations 0–5) + motionTokens + controls + zScale.
- `auditSystem(tokens)` — runs every domain auditor over a submitted token set →
  per-domain verdicts + a coherence score.

`createEngine` gains all of the above on its returned object; the stateless ones are
also exported standalone (they need no injected data).

## (A′) CLI — `apps/engine/cli.mjs`
Thin `node cli.mjs <fn> [json-or-positional args]` over the engine. Prints JSON. Offline,
instant, zero deps. Example: `node apps/engine/cli.mjs shadow 4` /
`node apps/engine/cli.mjs check_palette '{"ground":"#eee","ink":"#111","accent":"#c33"}'`.
This is what the skill invokes during a build; the same functions the Worker serves.

## (B) MCP + REST — `apps/worker/src/tools.mjs`

New tools (snake_case), each backed by an engine call, each returning the `checkColor`
shape, each mirrored in `apps/worker/src/index.mjs` REST routing:

**Flagship:** `design_system`, `audit_system`
**Generators:** `type_scale`, `spacing_scale`, `radius_scale`, `shadow`, `layout`,
`palette`, `motion_tokens`
**Auditors:** `check_type`, `check_spacing`, `check_radius`, `check_shadow`,
`check_layout`, `check_motion`

~15 new + existing 5 = ~20 tools. Generate and audit stay separate verbs (clearer to an
LLM than one mode-switched tool). `mcp.mjs` protocol layer is unchanged.

## (C) Skill — `skills/atelier/`

- `SKILL.md` — the impeccable `frontend-design`/`animate`/`polish` *flow*, but every
  deterministic decision routed through a **Decision → Tool table** (need spacing →
  `spacing_scale`; a shadow → `shadow`; is this palette slop → `check_palette`; the whole
  theme → `design_system`). Keeps `/personality`'s ideation (forbid-the-median, the ONE
  standout, the hard gates).
- Calls the engine via the CLI locally (`node apps/engine/cli.mjs …`); documents the MCP
  endpoint for remote/agent use. Both are the same logic.
- **Reuses** `/personality`'s `reference/*` by linking, not copying. Preserves impeccable
  attribution (as `/personality` already does).

## (D) Verify + deploy handoff
- `apps/engine/system.test.mjs` — node asserts: grid columns exactly fill the container;
  `nestedRadius` concentric; `fluidType` clamp bounds; auditors catch known slop
  (`0 4px 6px rgba(0,0,0,.1)`; a 12-size type scale; a 30px hit target). Plain `node`.
- MCP smoke test: `wrangler dev`, curl `/mcp` (`tools/list`, one `tools/call`) + two REST
  routes.
- Handoff commands: `npx wrangler login` (user, via `!`), then
  `cd apps/worker && npx wrangler deploy`; then update `#mcpcfg` URL in
  `apps/web/index.html` and rebuild bundles if data changed.

## File-by-file
| File | Change |
|---|---|
| `apps/engine/system.mjs` | **new** — all six math buckets |
| `apps/engine/engine.mjs` | add `generatePalette`, `designSystem`, `auditSystem`; re-export system fns via `createEngine` |
| `apps/engine/cli.mjs` | **new** — arg parser over the engine |
| `apps/engine/system.test.mjs` | **new** — math asserts |
| `apps/worker/src/tools.mjs` | ~15 new tool defs |
| `apps/worker/src/index.mjs` | REST routes for the new tools |
| `skills/atelier/SKILL.md` | **new** — engine-backed design skill |
| `apps/DEPLOY.md` | note the new tools/endpoints |

## Risks
- **Tool sprawl (~20).** Mitigated by two flagship entry points; per-domain tools are the
  granular layer. Collapsible to mode-switched tools later if it's noisy.
- **CLI vs MCP drift.** Avoided structurally — both call the identical engine module.
- **`generatePalette` purity.** Web-app version uses `Math.random`; the engine port must
  take an explicit numeric seed so it stays deterministic/portable.
