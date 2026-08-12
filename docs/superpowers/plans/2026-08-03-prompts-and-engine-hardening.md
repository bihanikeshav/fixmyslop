# Prompt/skill system + engine hardening — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Stop the MCP shipping unreadable fonts and misusable layout numbers, and ship the design *process* as 6 MCP prompts + an installable self-contained skill — all from one canonical source.

**Architecture:** Harden `engine.mjs` (font pairing) and `system.mjs` (layout output). Add pure `apps/engine/prompts.mjs` as the single source for both the MCP `prompts/*` handlers and the generated `atelier` skill. Worker gains `prompts` capability + `/skill` routes. One deploy at the end.

**Tech Stack:** ES modules, `node --test` + `node:assert/strict`, Cloudflare Worker (hand-rolled JSON-RPC), no new deps.

## Global Constraints
- Engine purity: no `fs`/`Date.now`/`Math.random` in `engine.mjs`, `system.mjs`, `prompts.mjs`.
- Auditors keep `{verdict∈{"CLEAN","SLOP"}, reason, fix}`.
- Font data is fixed (`apps/engine/data/fonts.json`): 2075 fonts, 40 `isFoundational`, `quality` nonzero for all (median ~0.66, Kihim=0.70 → quality can't gate novelty). Levers are `popularityRank` + supplier + category + `isFoundational`.
- MCP tool/prompt names snake_case. Prompt catalog = exactly 6: `improve_design`, `design_review`, `theme`, `colorize`, `typeset`, `polish`.
- Every `VERBS[].body` may reference ONLY real tool names from `TOOL_BY_NAME`.

---

### Task 1: `suggest_fonts` — legible display + readable body

**Files:** Modify `apps/engine/engine.mjs`; Test `apps/engine/fonts.test.mjs` (new).

**Interfaces:**
- Consumes: existing `AVOID_LIST`, `POPULARITY_SLOP_TOP_N`, the `fonts` array in `createEngine`.
- Produces (behavior change, same signatures): `engine.suggestFonts(n, {category})` returns `{picks, pairing}` where `pairing = {display, body, note}`, `pairing.body` is a readable workhorse (never a `display`/`handwriting` face), and a rank-≥1800 novelty face (Kihim/Boxing/Striper) is NOT the top display pick.

- [ ] **Step 1: Write the failing test**

```js
// apps/engine/fonts.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createEngine } from "./engine.mjs";
const dir = dirname(fileURLToPath(import.meta.url));
const load = (f) => JSON.parse(readFileSync(resolve(dir, "data", f), "utf8"));
const eng = createEngine({ corpus: load("corpus.json"), brands: load("brands.json"), fonts: load("fonts.json") });
const cat = (fam) => (load("fonts.json").find((f) => f.family === fam) || {}).category;

test("pairing.body is a readable workhorse, never a display/handwriting face", () => {
  const { pairing } = eng.suggestFonts(8);
  assert.ok(pairing.body, "has a body face");
  const c = cat(pairing.body);
  assert.ok(c === "serif" || c === "sans-serif", `body ${pairing.body} category ${c} must be text, not ${c}`);
  assert.notEqual(pairing.body, "Rowan"); // the regression: display serif was picked as body
});

test("top display pick is not an ultra-obscure novelty face", () => {
  const { pairing } = eng.suggestFonts(8);
  for (const bad of ["Kihim", "Boxing", "Striper"]) assert.notEqual(pairing.display, bad);
});

test("category:body never returns a display face; still avoids the monoculture", () => {
  const body = eng.suggestFonts(6, { category: "body" });
  for (const p of body.picks) assert.notEqual(p.category, "display");
  const fams = body.picks.map((p) => p.family.toLowerCase());
  for (const slop of ["inter", "poppins", "roboto"]) assert.ok(!fams.includes(slop));
});

test("pairing.note warns display != body", () => {
  assert.match(eng.suggestFonts(6).pairing.note, /body|running text/i);
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `node --test apps/engine/fonts.test.mjs`
Expected: FAIL — `pairing.body` is `Rowan` (a serif *display* face); body category assertion / notEqual("Rowan") fails.

- [ ] **Step 3: Implement**

In `apps/engine/engine.mjs`, inside `createEngine`, adjust the font logic:

1. Add an **obscurity penalty** and **reduce the indie bonus** in `freshnessScore` (used for the *display* pick). Replace the current supplier/rank scoring with:

```js
  function freshnessScore(f) {
    if (!f) return -Infinity;
    if (AVOID_LIST.has(f.family.toLowerCase())) return -Infinity;
    if (f.isBrandFont) return -Infinity;
    let s = 0;
    if (f.supplier && f.supplier !== "google") s += 1.0;   // was 2.5 — stop chasing the obscure indie tail
    if (!f.isFoundational) s += 0.6;
    const rank = f.popularityRank || 9999;
    if (rank > 100 && rank < 900) s += 1.5;
    else if (rank >= 900 && rank < 1400) s += 0.6;
    else if (rank >= 1400 && rank < 1800) s -= 1.0;         // NEW: distinctive fades into novelty
    else if (rank >= 1800) s -= 2.5;                        // NEW: the novelty tail (Kihim 2114) is demoted
    else if (rank <= 100) s -= 2.0;
    s += (f.quality || 0) * 1.2;
    return s;
  }
```

2. Add a **`bodyScore`** that rewards readability (used for the *body* pick and `category:"body"`):

```js
  function bodyScore(f) {
    if (!f) return -Infinity;
    if (AVOID_LIST.has(f.family.toLowerCase())) return -Infinity;
    if (f.isBrandFont) return -Infinity;
    if (!["serif", "sans-serif"].includes(f.category)) return -Infinity; // never display/handwriting/mono for running text
    let s = 0;
    if (f.isFoundational) s += 3.0;          // the flag literally means "usable as a NEUTRAL body workhorse"
    const rank = f.popularityRank || 9999;
    if (rank > 40 && rank < 1200) s += 1.0;  // distinctive but vetted enough to read
    else if (rank <= 40) s -= 1.0;           // the monoculture floor
    s += (f.quality || 0) * 1.5;
    if (f.supplier && f.supplier !== "google") s += 0.4;
    return s;
  }
```

3. Rewrite `suggestFonts` to use `bodyScore` for the body track and `freshnessScore` for display:

```js
  function suggestFonts(n = 4, { category = null } = {}) {
    const disp = fonts.map((f) => ({ f, score: freshnessScore(f) })).filter((x) => x.score > -Infinity)
      .filter((x) => x.f.category === "display").sort((a, b) => b.score - a.score);
    const body = fonts.map((f) => ({ f, score: bodyScore(f) })).filter((x) => x.score > -Infinity)
      .sort((a, b) => b.score - a.score);
    const pickOf = (arr) => arr.map((x) => ({
      family: x.f.family, supplier: x.f.supplier, category: x.f.category, popularityRank: x.f.popularityRank,
      isFoundational: !!x.f.isFoundational,
      why: `${x.f.category === "display" ? "characterful display" : "readable body workhorse"}: rank ${x.f.popularityRank}, ${x.f.supplier}`,
    }));
    if (category === "display") return { picks: pickOf(disp).slice(0, n), pairing: pairFrom(disp, body) };
    if (category === "body") return { picks: pickOf(body).slice(0, n), pairing: pairFrom(disp, body) };
    const half = Math.max(1, Math.ceil(n / 2));
    const picks = [...pickOf(disp).slice(0, half), ...pickOf(body).slice(0, n - half)].slice(0, n);
    return { picks, pairing: pairFrom(disp, body) };
  }
  function pairFrom(disp, body) {
    return {
      display: disp[0]?.f.family || null,
      body: body[0]?.f.family || null,
      note: "Display face carries identity (headings, name); body face carries running text — never swap them. The display pick is distinctive; confirm it reads for your context.",
    };
  }
```

Keep `checkFont` and `freshnessScore`'s use in `checkFont.alternatives` working (they call `suggestFonts`). Ensure `pairFrom`/`bodyScore`/`freshnessScore` are all in `createEngine` scope.

- [ ] **Step 4: Run to green**

Run: `node --test apps/engine/fonts.test.mjs` — PASS.
Also run `node --test apps/engine/engine.test.mjs` — the existing engine tests still pass (suggestFonts shape unchanged: `{picks, pairing}`).

- [ ] **Step 5: Commit**

```bash
git add apps/engine/engine.mjs apps/engine/fonts.test.mjs
git commit -m "fix(engine): suggest_fonts — legible display (demote novelty tail) + readable-workhorse body pairing"
```

---

### Task 2: `layout` output ergonomics

**Files:** Modify `apps/engine/system.mjs`; Test append to `apps/engine/system.test.mjs`.

**Interfaces:**
- Consumes: existing `grid`, `measure`, `round`.
- Produces: `layout(brief)` gains `container: {maxWidth, paddingInline, note}`; `grid.template` becomes the fluid `repeat(N, minmax(0, 1fr))` and a new `grid.fixedTemplate` holds the old `repeat(N, Wpx)`; `grid.innerNote` string. `grid` keeps every existing field.

- [ ] **Step 1: Write the failing test** (append to `system.test.mjs`)

```js
test("layout: usable container tokens that don't double-count margins", () => {
  const L = layout({ viewport: 1440, baseFont: 18, split: "golden" });
  assert.ok(L.container && typeof L.container.maxWidth === "number");
  // applying maxWidth + padding on both sides must fit the viewport
  assert.ok(L.container.maxWidth + 2 * L.container.paddingInline <= 1440);
  assert.match(L.grid.template, /minmax\(0, 1fr\)/);        // fluid, not fixed-px
  assert.match(L.grid.fixedTemplate, /px\)/);               // fixed form preserved separately
  assert.equal(L.grid.inner, 1440 - 2 * L.grid.margin);     // math unchanged
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `node --test apps/engine/system.test.mjs`
Expected: FAIL — `L.container` undefined.

- [ ] **Step 3: Implement**

In `apps/engine/system.mjs`, change `grid()` so `template` is fluid and add `fixedTemplate` + `innerNote`:

```js
export function grid({ viewport, minCol = 280, gutter = 24, margin = 32, maxCols = 12 } = {}) {
  const inner = viewport - 2 * margin;
  let cols = Math.floor((inner + gutter) / (minCol + gutter));
  cols = Math.max(1, Math.min(maxCols, cols));
  const colW = round((inner - (cols - 1) * gutter) / cols, 2);
  return {
    viewport, inner, cols, colW, gutter, margin,
    template: `repeat(${cols}, minmax(0, 1fr))`,
    fixedTemplate: `repeat(${cols}, ${colW}px)`,
    innerNote: "`inner` already excludes margins — do not subtract or re-pad by `margin` again.",
  };
}
```

Then in `layout()`, add the `container` block (place after computing `g`):

```js
export function layout({ viewport = 1440, baseFont = 18, columns, split } = {}) {
  const g = grid({ viewport, ...(columns ? { maxCols: columns } : {}) });
  const sp = split ? computeSplit(g.inner, split) : null;
  const container = {
    maxWidth: g.inner,
    paddingInline: g.margin,
    note: "Set the container `max-width: maxWidth; margin-inline: auto; padding-inline: paddingInline`. Do NOT also cap width by `inner` and re-add `margin` — that double-counts.",
  };
  return {
    grid: g, container, measurePx: measure(baseFont), measureCh: 66, margins: g.margin,
    split: split ? { name: split, widths: sp } : null, whitespaceRatioTarget: 0.4,
  };
}
```

Note: `maxWidth + 2·paddingInline = inner + 2·margin = viewport`, so the test's `<= 1440` holds with equality.

- [ ] **Step 4: Run to green**

Run: `node --test apps/engine/system.test.mjs` — PASS. Re-run `node --test apps/engine/engine.test.mjs` (designSystem uses SYS — unaffected).

- [ ] **Step 5: Commit**

```bash
git add apps/engine/system.mjs apps/engine/system.test.mjs
git commit -m "fix(engine): layout emits usable container tokens + fluid grid template (no margin double-count)"
```

---

### Task 3: `prompts.mjs` — canonical source (PREAMBLE + 6 VERBS + renderers)

**Files:** Create `apps/engine/prompts.mjs`, `apps/engine/prompts.test.mjs`.

**Interfaces:**
- Produces: `PREAMBLE` (string), `VERBS` (array of `{name, description, args:[{name,description,required}], body}`), `TOOL_NAMES` (the set of tool names the bodies may cite — passed in or hard-listed), `renderPrompt(name, args)→{description, messages:[{role:"user",content:{type:"text",text}}]}`, `renderSkill()→string`.

**Content requirements (author the prose to satisfy these — no placeholders):**
- `PREAMBLE` is self-contained (NO `../personality/...` links). It MUST include: the hard gates (color: nothing from the banned bands; render: content visible without JS; type: **display = characterful but legible, body = a readable workhorse — never a novelty/display face for running text**; assets: premade components/icons, no hand-drawn SVG; contrast: AA computed), the forbid-the-median step, the ONE-standout requirement, and a **Decision→Tool table** citing the real tools, with two explicit rules: *"fonts: use `suggest_fonts` — the `pairing.body` is the readable face, never set a display face as body"* and *"layout: use the `container` tokens from `layout`; never re-add `margin` on top of `inner`."*
- Each of the 6 `VERBS[].body` MUST (a) open by instructing the agent to ask the user the right direction questions for that verb before any tool call, (b) reference only real tool names, (c) end with a self-check.

- [ ] **Step 1: Write the failing test**

```js
// apps/engine/prompts.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { PREAMBLE, VERBS, renderPrompt, renderSkill } from "./prompts.mjs";

const REAL_TOOLS = new Set(["check_color","check_palette","suggest_fonts","check_font","structure_ideas",
  "design_system","audit_system","type_scale","spacing_scale","radius_scale","shadow","layout",
  "generate_palette","motion_tokens","check_type","check_spacing","check_radius","check_shadow","check_layout","check_motion"]);

test("exactly the 6 core verbs", () => {
  assert.deepEqual(VERBS.map((v) => v.name).sort(),
    ["colorize","design_review","improve_design","polish","theme","typeset"]);
});

test("every verb body cites only real tool names + asks for direction", () => {
  for (const v of VERBS) {
    // any `code`-quoted token that looks like a tool must be real
    for (const m of v.body.matchAll(/`([a-z_]{4,})`/g)) {
      if (m[1].includes("_") || REAL_TOOLS.has(m[1])) {
        if (/^[a-z_]+$/.test(m[1]) && !m[1].includes(" "))
          assert.ok(REAL_TOOLS.has(m[1]) || !/_/.test(m[1]) || m[1] === "type_scale", `unknown tool ${m[1]} in ${v.name}`);
      }
    }
    assert.match(v.body, /ask|direction|before/i, `${v.name} must gather direction first`);
  }
});

test("PREAMBLE is self-contained + carries the font/layout rules", () => {
  assert.doesNotMatch(PREAMBLE, /\.\.\/personality/);
  assert.match(PREAMBLE, /body/i);
  assert.match(PREAMBLE, /container|margin/i);
});

test("renderPrompt returns an MCP user message; renderSkill is self-contained md", () => {
  const p = renderPrompt("improve_design", {});
  assert.equal(p.messages[0].role, "user");
  assert.match(p.messages[0].content.text, /suggest_fonts|design_system/);
  const skill = renderSkill();
  assert.match(skill, /^---[\s\S]*name:\s*atelier/);
  assert.doesNotMatch(skill, /\.\.\/personality/);
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `node --test apps/engine/prompts.test.mjs`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `apps/engine/prompts.mjs`**

Author the module with the structure below; write the PREAMBLE and each verb `body` as real, complete prose satisfying the Content requirements above (draw from `skills/atelier/SKILL.md` and `skills/personality/reference/*` for the gates, condensing — do NOT link them).

```js
// prompts.mjs — the canonical design process. Pure. Source for BOTH the MCP prompts
// and the generated atelier skill, so they can never drift.
export const PREAMBLE = `... self-contained design law: gates, forbid-the-median, ONE standout,
Decision→Tool table with the fonts rule (pairing.body is the readable face; never a display
face for body) and the layout rule (use the container tokens; never re-add margin). ...`;

export const VERBS = [
  { name: "improve_design", description: "Full flow: audit the current design and rebuild it distinctive + readable.",
    args: [{ name: "target", description: "File or URL to improve (optional).", required: false }],
    body: `Before anything, ask the user: what is this, who is it for, one-word vibe. Then ... use
suggest_fonts (body = the readable face), design_system, layout (container tokens), check_* ... Self-check: ...` },
  { name: "design_review", description: "Audit an existing page for slop and give fixes.",
    args: [{ name: "target", description: "File or URL to review.", required: false }], body: `Ask ... use audit_system + check_* ...` },
  { name: "theme", description: "Generate one coherent token system from a brief.",
    args: [{ name: "brief", description: "What the theme is for.", required: false }], body: `Ask ... use design_system ...` },
  { name: "colorize", description: "Palette work: judge and generate gate-passing colors.",
    args: [{ name: "seed", description: "Numeric seed / existing hex.", required: false }], body: `Ask ... use check_color, check_palette, generate_palette ...` },
  { name: "typeset", description: "Typography, spacing and layout math.",
    args: [{ name: "context", description: "Content type.", required: false }], body: `Ask ... use suggest_fonts (readable body!), type_scale, spacing_scale, layout (container) ...` },
  { name: "polish", description: "Finishing pass: motion, shadow, radius, controls.",
    args: [], body: `Ask ... use shadow, motion_tokens, radius_scale, check_shadow, check_motion ...` },
];

export function renderPrompt(name, args = {}) {
  const v = VERBS.find((x) => x.name === name);
  if (!v) throw new Error(`unknown prompt: ${name}`);
  let body = v.body;
  for (const [k, val] of Object.entries(args || {})) body = body.split(`{{${k}}}`).join(String(val));
  return { description: v.description, messages: [{ role: "user", content: { type: "text", text: `${PREAMBLE}\n\n## ${v.name}\n${body}` } }] };
}

export function renderSkill() {
  const front = `---\nname: atelier\ndescription: Engine-backed design process — gather direction, forbid the median, one bold standout, and route every deterministic decision (color, fonts, spacing, radius, shadow, layout, motion) to the fixmyslop engine. Self-contained.\nlicense: Apache-2.0. Adapted from impeccable.style and the personality skill.\n---\n`;
  const verbs = VERBS.map((v) => `## ${v.name}\n${v.body}`).join("\n\n");
  return `${front}\n${PREAMBLE}\n\n# Verbs\n\n${verbs}\n`;
}
```

Replace every `...` with real, complete prose meeting the Content requirements. Cite only real tool names.

- [ ] **Step 4: Run to green**

Run: `node --test apps/engine/prompts.test.mjs` — PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/engine/prompts.mjs apps/engine/prompts.test.mjs
git commit -m "feat(engine): prompts.mjs — canonical design process (PREAMBLE + 6 verbs + renderers)"
```

---

### Task 4: MCP `prompts` capability (mcp.mjs)

**Files:** Modify `apps/worker/src/mcp.mjs`; Test append/create `apps/worker/src/mcp.test.mjs`.

**Interfaces:**
- Consumes: `VERBS`, `renderPrompt` from `../../engine/prompts.mjs`.
- Produces: `initialize` advertises `prompts`; `prompts/list` + `prompts/get` handled in `handleMessage`.

- [ ] **Step 1: Write the failing test**

```js
// apps/worker/src/mcp.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { handleMcpPost } from "./mcp.mjs";
const call = async (msg) => JSON.parse(await (await handleMcpPost(new Request("http://x/mcp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(msg) }), {})).text());

test("initialize advertises prompts", async () => {
  const r = await call({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
  assert.ok(r.result.capabilities.prompts);
});
test("prompts/list returns 6; prompts/get renders a message", async () => {
  const l = await call({ jsonrpc: "2.0", id: 2, method: "prompts/list" });
  assert.equal(l.result.prompts.length, 6);
  const g = await call({ jsonrpc: "2.0", id: 3, method: "prompts/get", params: { name: "improve_design", arguments: {} } });
  assert.equal(g.result.messages[0].role, "user");
  assert.match(g.result.messages[0].content.text, /suggest_fonts|design_system/);
});
```

- [ ] **Step 2: Run to confirm it fails** — `node --test apps/worker/src/mcp.test.mjs` → FAIL (prompts not advertised / method not found).

- [ ] **Step 3: Implement** — in `mcp.mjs`:
  1. `import { VERBS, renderPrompt } from "../../engine/prompts.mjs";`
  2. In `initialize`'s result `capabilities`, add `prompts: { listChanged: false }` alongside `tools`.
  3. Add cases to the `handleMessage` switch:

```js
    case "prompts/list":
      return rpcResult(id, { prompts: VERBS.map(({ name, description, args }) => ({ name, description, arguments: args })) });
    case "prompts/get": {
      const name = params && params.name;
      try { return rpcResult(id, renderPrompt(name, (params && params.arguments) || {})); }
      catch (e) { return rpcError(id, -32602, String(e && e.message || e)); }
    }
```

- [ ] **Step 4: Run to green** — `node --test apps/worker/src/mcp.test.mjs` PASS; re-run `apps/worker/src/tools.test.mjs` (unaffected).

- [ ] **Step 5: Commit**
```bash
git add apps/worker/src/mcp.mjs apps/worker/src/mcp.test.mjs
git commit -m "feat(mcp): prompts capability — prompts/list + prompts/get from prompts.mjs"
```

---

### Task 5: `/skill` routes (index.mjs)

**Files:** Modify `apps/worker/src/index.mjs`; Test append to `apps/worker/src/index.test.mjs`.

**Interfaces:**
- Consumes: `renderSkill` from `../../engine/prompts.mjs`.
- Produces: `GET /skill` (sh install script), `GET /skill/SKILL.md` (markdown).

- [ ] **Step 1: Write the failing test** (append to `index.test.mjs`)

```js
test("GET /skill returns an install script; /skill/SKILL.md returns the self-contained skill", async () => {
  const s = await worker.fetch(new Request("http://x/skill"));
  assert.equal(s.status, 200);
  const script = await s.text();
  assert.match(script, /mkdir[^\n]*atelier/);
  assert.match(script, /SKILL\.md/);
  const md = await worker.fetch(new Request("http://x/skill/SKILL.md"));
  assert.equal(md.status, 200);
  const body = await md.text();
  assert.match(body, /name:\s*atelier/);
  assert.doesNotMatch(body, /\.\.\/personality/);
});
```

- [ ] **Step 2: Run to confirm it fails** — FAIL (404).

- [ ] **Step 3: Implement** — in `index.mjs`:
  1. `import { renderSkill } from "../../engine/prompts.mjs";`
  2. Add routes before the `index / 404` block (use `url.origin` for the base):

```js
      if (pathname === "/skill/SKILL.md") {
        return new Response(renderSkill(), { headers: { ...CORS, "content-type": "text/markdown; charset=utf-8" } });
      }
      if (pathname === "/skill") {
        const base = url.origin;
        const script = `#!/bin/sh
# Install the fixmyslop 'atelier' design skill for Claude Code.
set -e
DIR="$HOME/.claude/skills/atelier"
mkdir -p "$DIR"
curl -fsSL "${base}/skill/SKILL.md" -o "$DIR/SKILL.md"
echo "Installed atelier skill -> $DIR/SKILL.md"
echo "Now connect the tools:  claude mcp add --transport http fixmyslop ${base}/mcp"
`;
        return new Response(script, { headers: { ...CORS, "content-type": "text/x-shellscript; charset=utf-8" } });
      }
```

- [ ] **Step 4: Run to green** — `node --test apps/worker/src/index.test.mjs` PASS.

- [ ] **Step 5: Commit**
```bash
git add apps/worker/src/index.mjs apps/worker/src/index.test.mjs
git commit -m "feat(mcp): GET /skill install script + /skill/SKILL.md (self-contained atelier)"
```

---

### Task 6: Regenerate the repo skill from the canonical source

**Files:** Create `scripts/build-atelier-skill.mjs`; overwrite `skills/atelier/SKILL.md`.

**Interfaces:** Consumes `renderSkill()`; writes `skills/atelier/SKILL.md`.

- [ ] **Step 1: Write the build script**

```js
// scripts/build-atelier-skill.mjs — regenerate the self-contained atelier skill from the canonical prompts.mjs
import { renderSkill } from "../apps/engine/prompts.mjs";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
mkdirSync(resolve(process.cwd(), "skills/atelier"), { recursive: true });
writeFileSync(resolve(process.cwd(), "skills/atelier/SKILL.md"), renderSkill());
console.log("wrote skills/atelier/SKILL.md from prompts.mjs");
```

- [ ] **Step 2: Run it**

Run: `node scripts/build-atelier-skill.mjs`
Expected: writes the file. Then confirm it's self-contained: `grep -c "personality" skills/atelier/SKILL.md` → `0`.

- [ ] **Step 3: Sanity check the generated skill** has the frontmatter `name: atelier` and the 6 verb sections (`grep -c "^## " skills/atelier/SKILL.md` ≥ 6).

- [ ] **Step 4: Commit**
```bash
git add scripts/build-atelier-skill.mjs skills/atelier/SKILL.md
git commit -m "build: regenerate skills/atelier/SKILL.md self-contained from prompts.mjs"
```

---

### Task 7: Docs + full verify + deploy handoff

**Files:** Modify `apps/INSTALL.md`, `apps/DEPLOY.md`.

- [ ] **Step 1: Full engine + worker suites**

Run: `node --test apps/engine/system.test.mjs apps/engine/engine.test.mjs apps/engine/cli.test.mjs apps/engine/fonts.test.mjs apps/engine/prompts.test.mjs` and `node --test apps/worker/src/tools.test.mjs apps/worker/src/index.test.mjs apps/worker/src/mcp.test.mjs`. All green. (Use explicit file globs — `node --test <dir>/` is flaky in git-bash here.)

- [ ] **Step 2: Wrangler bundles clean**

Run: `cd apps/worker && npx --yes wrangler deploy --dry-run --outdir .wrangler/dryrun 2>&1 | tail -20`
Expected: "Total Upload …" / "--dry-run: exiting now.", no error importing `../../engine/prompts.mjs`. (If esbuild rejects the import, confirm the relative path resolves from `apps/worker/src/`.)

- [ ] **Step 3: Update docs** — in `apps/INSTALL.md` add a "Prompts (slash-commands)" section listing the 6 verbs and a "One-line skill install: `curl -fsSL <base>/skill | sh`" line. In `apps/DEPLOY.md` add `/skill`, `/skill/SKILL.md`, and the `prompts/list`·`prompts/get` MCP methods to the endpoint list.

- [ ] **Step 4: Commit**
```bash
git add apps/INSTALL.md apps/DEPLOY.md
git commit -m "docs: prompts catalog + /skill install in INSTALL/DEPLOY"
```

- [ ] **Step 5: Deploy handoff (USER runs)** — `cd apps/worker && npx wrangler deploy`. Then controller re-verifies live: `prompts/list` = 6, `GET /skill` returns the script, and `suggest_fonts` returns a legible display + readable (foundational/text) body.

---

## Self-Review
- Spec coverage: A→T1, B→T2, C→T3, D→T4, E→T5, F→T6, G→T7. All parts mapped.
- Placeholder scan: the only intentional `...` are inside Task 3's `prompts.mjs` prose, which Step 3 explicitly instructs the implementer to replace with complete prose meeting the enumerated Content requirements; the test enforces real-tool-names + direction-gathering + self-containment.
- Type consistency: `renderPrompt`/`renderSkill`/`VERBS`/`PREAMBLE` names identical across T3/T4/T5/T6. `pairing.{display,body,note}` used consistently. `container.{maxWidth,paddingInline,note}` consistent T2. Font levers (obscurity penalty rank≥1800; `bodyScore` foundational reward) are concrete, data-grounded (Kihim rank 2114 → −2.5).
