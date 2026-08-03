# ai-slop-font — install & use

A remote **MCP server** (and plain REST API) that gives an LLM a deterministic,
math-based design engine: it *judges* colors, fonts, spacing, radius, shadows,
layout and motion for AI-slop, and *generates* fresh, gate-passing values — a whole
coherent theme from one call. No model, no vibes; every verdict is closed-form and
reproducible.

**Endpoint:** `https://ai-slop-font.bihanikeshav.workers.dev`
- MCP (Streamable HTTP): `POST /mcp`  · SSE clients: `GET /sse`
- REST: `GET|POST /api/tool/<name>` (every tool) · `GET /health`

---

## 1. Connect it to an MCP client

### Claude Code (CLI)
```bash
claude mcp add --transport http fix-ai-slop https://ai-slop-font.bihanikeshav.workers.dev/mcp
```
Then in a session: `/mcp` to confirm it's connected. Ask e.g. *"use ai-slop-font to
check if #6366f1 is slop and suggest alternatives."*

### Claude Desktop / Cursor / Windsurf (JSON config)
Clients that speak remote Streamable HTTP directly:
```json
{
  "mcpServers": {
    "fix-ai-slop": { "url": "https://ai-slop-font.bihanikeshav.workers.dev/mcp" }
  }
}
```
Clients that need a stdio bridge (older Claude Desktop): use `mcp-remote`:
```json
{
  "mcpServers": {
    "fix-ai-slop": {
      "command": "npx",
      "args": ["mcp-remote", "https://ai-slop-font.bihanikeshav.workers.dev/mcp"]
    }
  }
}
```
Restart the client after editing its config.

### Verify the connection
```bash
curl -s -X POST https://ai-slop-font.bihanikeshav.workers.dev/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```
You should see **20 tools**.

---

## 2. Or call it as a plain REST API (no MCP client needed)

Every tool is reachable at `/api/tool/<name>` — `GET` with query params, or `POST`
with a JSON body.

```bash
BASE=https://ai-slop-font.bihanikeshav.workers.dev

# Is this color AI-slop? → verdict + fresh alternatives
curl "$BASE/api/tool/check_color?hex=6366f1"

# Generate a whole coherent theme from a seed
curl "$BASE/api/tool/design_system?seed=7&baseFont=18"

# Do the math for a layout
curl "$BASE/api/tool/layout?viewport=1440&baseFont=18&split=golden"

# Judge a full palette (POST a JSON body)
curl -X POST "$BASE/api/tool/check_palette" -H 'content-type: application/json' \
  -d '{"ground":"#f1f1e9","ink":"#0d171c","accent":"#b479af"}'
```

Legacy named routes also exist: `/api/color?hex=`, `/api/palette`, `/api/fonts?n=`,
`/api/font?family=`, `/api/structure`, `/health`.

---

## 3. The 20 tools

**Color & font**
- `check_color` — judge a hex for slop (banned defaults, overused corpus zones, brand
  clones) → verdict + slop score + fresh alternatives.
- `check_palette` — judge ground/ink/accent(/accent2): per-role verdicts, near-dupes,
  contrast, pass/fail.
- `suggest_fonts` — fresh, non-monoculture font families + a display/body pairing.
- `check_font` — judge a family: FRESH / SLOP / SLOP-allowed-foundational / UNKNOWN.
- `structure_ideas` — distinctive page/layout archetypes away from the centered-hero SaaS template.

**Whole-system (flagship)**
- `design_system` — one seed → a complete coherent theme: palette + type scale +
  spacing + radius + shadow ramp + motion + control sizing.
- `audit_system` — judge a submitted token set across domains → per-domain verdicts +
  a 0–100 coherence score.

**Generators** — `type_scale`, `spacing_scale`, `radius_scale`, `shadow`, `layout`,
`generate_palette`, `motion_tokens`.

**Auditors** — `check_type`, `check_spacing`, `check_radius`, `check_shadow`,
`check_layout`, `check_motion`.

Every tool returns the same shape family: generators return the value/tokens;
auditors return `{ verdict, reason, fix }`.

---

## 3b. Prompts (slash-commands)

The MCP server also exposes 6 prompts (`prompts/list` · `prompts/get`) — canonical,
self-contained design workflows an MCP client can surface as slash-commands:

- `improve_design` — take an existing UI through the full audit → fix loop.
- `design_review` — critique a build against the hard gates without changing it.
- `theme` — gather a brief, then call `design_system` for one coherent theme.
- `colorize` — bring a palette to gate-passing FRESH, derived from real material.
- `typeset` — pick a display/body pairing and a modular type scale.
- `polish` — a final pass over spacing, radius, shadow, and motion.

Each prompt embeds the full Atelier design law (hard gates, tool table, self-check),
so it works even without the companion skill installed.

One-line skill install (drops the self-contained `fix-ai-slop` skill into your project):
```bash
curl -fsSL https://ai-slop-font.bihanikeshav.workers.dev/skill | sh
```

---

## 4. Typical LLM workflow

1. `design_system` for a coherent baseline theme (re-roll the seed until you like it).
2. Reach for a single domain when you need one value: `shadow`, `layout`,
   `type_scale`, `generate_palette`…
3. Before shipping, run the `check_*` auditors (or `audit_system`) over what you
   actually wrote — fix anything that comes back `SLOP`.

The companion **`fix-ai-slop`** skill wires exactly this flow into a design process:
deterministic decisions go to these tools, the one bold standout stays human.

---

## Self-host

This server is a Cloudflare Worker in `apps/worker` backed by the pure engine in
`apps/engine`. To run your own: `cd apps/worker && npx wrangler deploy` (see
`apps/DEPLOY.md`). The engine is dependency-free and also runs in the browser and as
a CLI (`node apps/engine/cli.mjs <tool> <args>`).
