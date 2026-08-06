# fixmyslop Worker

A Cloudflare Worker that wraps the pure `apps/engine` query engine and exposes it
two ways:

1. A **REST JSON API** (what the web app calls), and
2. A **remote MCP server** (JSON-RPC 2.0 over Streamable HTTP).

The engine is imported and instantiated **once at module scope**; the corpus,
brands, and fonts JSON are imported directly so wrangler/esbuild bundles them
into the Worker (Workers have no runtime filesystem). Nothing in `apps/engine`
is modified — this package only wraps it.

## Layout

```
apps/worker/
  src/index.mjs   # Worker entry: router for REST + MCP, permissive CORS
  src/tools.mjs   # engine instance + shared tool catalog (REST and MCP share it)
  src/mcp.mjs     # minimal JSON-RPC 2.0 MCP server (no SDK)
  wrangler.toml
  package.json
```

## REST endpoints

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/health` | `{ ok: true, fonts, corpus }` |
| GET | `/api/color?hex=%23ff0000` | `checkColor` — verdict, slop score, OKLCH, reason, alternatives |
| POST | `/api/palette` | body `{ground, ink, accent, accent2?}` → `checkPalette` |
| GET | `/api/palette?ground=&ink=&accent=&accent2=` | same, via query params |
| GET | `/api/fonts?n=6&category=` | `suggestFonts` (category = `display` \| `body`, optional) |
| GET | `/api/font?family=Inter` | `checkFont` |
| GET | `/api/structure` | static list of layout archetypes |

CORS is permissive (`Access-Control-Allow-Origin: *`, `OPTIONS` preflight
handled) so the static site can call it cross-origin.

### Examples

```bash
curl "http://localhost:8788/health"
curl "http://localhost:8788/api/color?hex=%236366f1"   # HARD-BANNED
curl "http://localhost:8788/api/color?hex=%23c8175a"   # SAFE
curl "http://localhost:8788/api/fonts?n=4"
curl "http://localhost:8788/api/font?family=Inter"
curl -X POST "http://localhost:8788/api/palette" \
  -H 'content-type: application/json' \
  -d '{"ground":"#ffffff","ink":"#111111","accent":"#c8175a"}'
```

## MCP server

Implemented as a **minimal JSON-RPC 2.0 handler** (no `@modelcontextprotocol/sdk`
dependency) — the needed surface (`initialize`, `tools/list`, `tools/call`,
`ping`) is small and this avoids SDK-on-Workers transport friction.

- **Streamable HTTP:** `POST /mcp` — send a JSON-RPC request, get a JSON response.
- **SSE discovery:** `GET /sse` — emits an `endpoint` event pointing at `/mcp`.

Tools: `check_color`, `check_palette`, `suggest_fonts`, `check_font`,
`structure_ideas`. Each `tools/call` returns
`{ content: [{ type: "text", text: JSON.stringify(result) }] }`.

```bash
# list tools
curl -X POST http://localhost:8788/mcp -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# call a tool
curl -X POST http://localhost:8788/mcp -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"check_color","arguments":{"hex":"#6366f1"}}}'
```

## Develop

```bash
npm install
npm run dev          # wrangler dev --port 8788
```

## Deploy

The deploy requires your own `wrangler login` (Cloudflare auth):

```bash
npx wrangler login   # one-time, opens a browser
npx wrangler deploy
```

This publishes to `https://fixmyslop.<your-subdomain>.workers.dev`.
