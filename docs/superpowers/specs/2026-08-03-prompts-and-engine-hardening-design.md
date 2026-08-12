# Prompt/skill system + engine hardening (fonts & layout)

**Date:** 2026-08-03
**Status:** approved (scope + key decisions locked) — ready for implementation plan

## Problem

An agent built a real site (jayant.wtf) straight from our MCP and it shipped broken,
proving two gaps at once:

1. **The engine hands back foot-guns.** `suggest_fonts` recommended **Kihim** (a rank-2114
   novelty blackletter) as the display face — every heading rendered illegible — and
   **Rowan** (a display serif) as the *body* face — unreadable running text. `layout`
   returned `inner` (viewport minus margins) next to `margin` with no signal that `inner`
   already excludes margins, so the agent double-counted margins and the grid drifted out
   of alignment; it also returns a rigid `repeat(N, Wpx)` fixed-px template.
2. **The MCP ships tools but no process.** Nothing tells the agent *how* to apply the
   values (characterful-but-legible display + readable body; ≥45ch measure; don't
   double-apply margins). That guidance lives only in the `atelier` skill, which most
   clients don't have.

Fix both in one build: **harden the engine output so it's safe by default**, and **ship
the process** as MCP prompts + an installable skill, all from one canonical source.

## Non-goals
- Not fixing jayant.wtf itself (the owner is reverting it).
- No new font data crawl; work with the existing `apps/engine/data/fonts.json` (2075
  fonts, 40 `isFoundational`, `quality`/`popularityRank`/`category` fields).
- No new runtime deps; engine stays pure (no fs/Date/Math.random).

## Decisions (locked)
- Prompt catalog: **6 verbs** (core set).
- `/skill` delivery: **one-line install script** + raw `SKILL.md`.
- Source of truth: **one canonical `prompts.mjs`** → generates both MCP prompts and the skill.
- Font pairing rule: **characterful (but legible) display + readable body.**
- All fixes bundled into **one plan, one deploy** at the end.

---

## Part A — `suggest_fonts` legibility + readable-body (engine.mjs)

Today `freshnessScore` rewards obscurity (supplier≠google, high rank number) and
**penalizes** `isFoundational` and top-100 rank — so it structurally optimizes *away* from
legibility in **both** slots. Split the two slots and add a legibility floor.

- **Display pick — distinctive but legible.** Keep rewarding indie/off-monoculture, but:
  - Penalize *extreme* obscurity: add a rank ceiling so novelty faces (rank ≳ 1400, e.g.
    Kihim 2114) are down-weighted, not top-ranked. (Currently rank ≥ 1400 gets a neutral
    0 — that's the bug that let Kihim win.)
  - Apply a **quality floor**: require `quality ≥ Q` for the *display recommendation*
    (calibrate `Q` against the `quality` distribution in `fonts.json` during
    implementation — pick a floor that excludes the novelty faces while keeping a healthy
    pool). If quality data is too sparse to gate on, fall back to the rank band
    (~100–1200) as the legibility proxy and exclude the ultra-obscure tail.
  - Keep it off the AVOID_LIST and off top-tier popularity (unchanged).
- **Body pick — readable workhorse.** Add a separate `bodyScore` that **rewards**
  `isFoundational` (the flag whose own meaning is "usable as a NEUTRAL body workhorse"),
  rewards text categories (`serif`/`sans-serif`, never `display`/`handwriting`), and a
  sane rank — so the body slot surfaces Lora / Merriweather / Nunito / Roboto Slab, not a
  display serif. `suggestFonts({category:"body"})` uses `bodyScore` too.
- `pairing` becomes `{ display: <legible characterful>, body: <readable workhorse>, note }`
  where `note` states the split ("display carries identity; body carries running text —
  never swap them"). `check_font` unchanged.
- **Tests:** `pairing.body` is `isFoundational` **or** a non-display text face; the display
  pick clears the legibility floor (a Kihim-class rank-2114 novelty face is NOT the top
  display pick); `category:"body"` never returns a `display` face.

## Part B — `layout` output ergonomics (system.mjs)

Math is correct; the *shape* is the foot-gun. Make it un-misusable.

- Add a directly-usable, clearly-labeled **`container`**: `{ maxWidth, paddingInline, note }`
  where `maxWidth` is the recommended max **content** width and `paddingInline` is the page
  gutter — designed so applying both does **not** double-count (padding sits inside
  maxWidth; page margin is `auto`). The `note` says so in one line.
- The recommended `grid.template` becomes **fluid** — `repeat(N, minmax(0, 1fr))` — with the
  fixed-px form demoted to `grid.fixedTemplate` and a note that fixed-px only aligns in a
  container of exactly `inner`.
- Annotate `inner` with a `note` that it already excludes margins (so no one adds them
  again). Keep every existing field for back-compat.
- **Tests:** `container.maxWidth` + `2×paddingInline` never exceeds the viewport;
  `grid.template` is the fluid form; `inner` still equals `viewport − 2·margin`.

## Part C — `apps/engine/prompts.mjs` (NEW, pure canonical source)

Exports:
- `PREAMBLE` — self-contained design law (condensed from `/personality`, no external
  links): the hard gates (color/render/type/assets/contrast), forbid-the-median, the ONE
  standout, and the **Decision→Tool table** — including the new rule *"display = characterful
  but legible; body = a readable workhorse; never a novelty/display face for running text,"*
  and *"use the layout `container` tokens; never re-add margins."*
- `VERBS` — 6 entries `{ name, description, args:[{name,description,required}], body }`:
  1. `improve_design` — full atelier flow end-to-end.
  2. `design_review` — audit an existing page (`audit_system` + `check_*`), report + fixes.
  3. `theme` — whole coherent system from a brief (`design_system`).
  4. `colorize` — palette work (`check_color/palette`, `generate_palette`).
  5. `typeset` — type + spacing + layout (`suggest_fonts` **with the new pairing**,
     `type_scale`, `layout` **using `container`**).
  6. `polish` — finishing pass: motion + shadow/radius/controls (`shadow`, `motion_tokens`,
     `check_*`).
  Each `body` opens by telling the agent to **gather direction from the user** (the right
  questions for that verb) before calling tools.
- `renderPrompt(name, args)` → `{ description, messages:[{role:"user",content:{type:"text",text}}] }`
  (PREAMBLE + verb body + arg substitution).
- `renderSkill()` → the full self-contained `atelier` SKILL.md string (frontmatter +
  PREAMBLE + each verb as a section + self-check). No `../personality/...` links.
- **Tests:** every `VERBS[].body` references only real tool names (assert against the live
  `TOOL_BY_NAME` set); `renderSkill()` contains no `../personality` link; `renderPrompt`
  substitutes args.

## Part D — MCP `prompts` capability (mcp.mjs)

- `initialize` capabilities gains `prompts: { listChanged: false }`.
- `prompts/list` → `{ prompts: VERBS.map(...) }`.
- `prompts/get` (params `{name, arguments}`) → `renderPrompt(name, arguments)`; unknown
  name → JSON-RPC error `-32602`.
- **Tests (node-level, via handleMessage):** `prompts/list` returns 6; `prompts/get` for
  `improve_design` returns a user message whose text includes the tool names.

## Part E — `/skill` routes (index.mjs)

- `GET /skill` → a POSIX `sh` script (content-type `text/x-shellscript`): makes
  `~/.claude/skills/atelier/`, writes `SKILL.md` from `<base>/skill/SKILL.md`, and prints
  the `claude mcp add --transport http fixmyslop <base>/mcp` line for the user to run.
  (Writes the skill only; never auto-runs the MCP add.)
- `GET /skill/SKILL.md` → `renderSkill()` as `text/markdown`.
- **Tests (node fetch of the worker default export):** `GET /skill` returns 200 sh with the
  mkdir + curl lines; `GET /skill/SKILL.md` returns 200 markdown with the frontmatter and
  no `../personality` link.

## Part F — regenerate the repo skill + docs (build script)

- `scripts/build-atelier-skill.mjs` (NEW) — writes `skills/atelier/SKILL.md` from
  `renderSkill()` so the repo skill == the served skill (self-contained; the old
  `../personality/...`-linking version is replaced). Run it as part of the build.
- Update `apps/INSTALL.md`, `apps/DEPLOY.md`, and the published install artifact to add the
  `prompts` catalog and the `/skill` install command.

## Part G — verify + deploy handoff
- Full suites green: `node --test apps/engine/*.test.mjs` and
  `node --test apps/worker/src/*.test.mjs`.
- `cd apps/worker && npx wrangler deploy --dry-run` bundles clean (adds `prompts.mjs` +
  routes).
- Handoff: user runs `npx wrangler deploy`; then I re-verify live (`prompts/list` = 6,
  `GET /skill`, and `suggest_fonts` now returns a legible display + readable body).

## File-by-file
| File | Change |
|---|---|
| `apps/engine/engine.mjs` | split display/body scoring in `suggestFonts`; legible display floor; readable-body pairing |
| `apps/engine/system.mjs` | `layout` gains `container` + fluid `template` + notes |
| `apps/engine/prompts.mjs` | **new** — PREAMBLE + 6 VERBS + renderPrompt + renderSkill |
| `apps/worker/src/mcp.mjs` | `prompts` capability + `prompts/list` + `prompts/get` |
| `apps/worker/src/index.mjs` | `GET /skill` + `GET /skill/SKILL.md` |
| `scripts/build-atelier-skill.mjs` | **new** — regenerate self-contained `skills/atelier/SKILL.md` |
| tests | engine (fonts, layout, prompts), worker (mcp prompts, /skill routes) |
| `apps/INSTALL.md` · `apps/DEPLOY.md` · install artifact | document prompts + `/skill` |

## Risks
- **Quality-floor calibration** (Part A): if `quality` is mostly 0, gate on the rank band
  instead — the plan's first font task inspects the distribution and picks the lever.
- **Prompt bulk in `initialize`/`prompts/get`**: prompts are large by design; fine for
  MCP.
- **Self-contained skill loses `/personality` richness**: acceptable — the full skill stays
  as the local option; `atelier` is the portable one. PREAMBLE must carry the essential gates.
