# Deploying fixmyslop to Cloudflare

Two independent deploys, both free-tier. One-time: `npx wrangler login`.

```
apps/
  engine/   # pure query engine (createEngine) + data bundles — shared, no deploy
  web/      # static theme-builder site        → Cloudflare PAGES
  worker/   # MCP server + REST API            → Cloudflare WORKERS
```

The **web app is fully self-contained**: it bundles the engine + data and runs the
slop-scoring in the browser, so it works with no backend. The **worker** is the
front door for LLMs (MCP) and any external REST caller. They share `apps/engine`,
so their verdicts can never drift.

## 1. Worker (MCP + REST API)

```bash
cd apps/worker
npx wrangler deploy
```

Gives a URL like `https://fixmyslop.<your-subdomain>.workers.dev`. Endpoints:
- MCP (Streamable HTTP): `POST /mcp` · SSE: `GET /sse`
- REST: `/api/color?hex=` · `/api/palette` · `/api/fonts?n=` · `/api/font?family=` · `/api/structure` · `/health`
- REST (per-tool): `GET|POST /api/tool/<name>` for every MCP tool
  (`design_system`, `type_scale`, `spacing_scale`, `radius_scale`, `shadow`, `layout`,
  `generate_palette`, `motion_tokens`, and the `check_*` / `audit_system` auditors), in addition to
  the named `/api/color`, `/api/palette`, `/api/fonts`, `/api/font`, `/api/structure`.
- Skill install: `GET /skill` (shell installer) · `GET /skill/SKILL.md` (raw, self-contained skill)
- MCP prompts: `prompts/list` (7 canonical verbs: `explore`, `improve_design`,
  `design_review`, `theme`, `colorize`, `typeset`, `polish`) · `prompts/get` (renders one)

The MCP exposes its current catalog through `tools/list`: the color/font and system auditors/generators, the
`design_system` flagship, `check_svg`, and the connected-engine tools
(`resolve_intent`, `style_genome`, `connected_style_genome`,
`connected_explore_directions`, `connected_build_spec`, `connected_v2_catalog`,
`suggest_layout`, `font_neighbors`) plus the dashboard path
(`dashboard_system`, `fluid_components`, `check_dashboard_layout`). Font responses distinguish verified
repository-local assets from publicly loadable URLs. The Worker does not host the
ignored `data/fonts-cache` binaries, so remote callers must provide a licensed
asset host or use a system fallback. SVG output must pass
`check_svg` before it enters a page.
All back onto the single pure `apps/engine` module.

Point an MCP client at `https://fixmyslop.<subdomain>.workers.dev/mcp`.

## 2. Web (theme-builder)

Static — no build step. From the repo root:

```bash
npx wrangler pages deploy apps/web --project-name fixmyslop
```

## 3. Post-deploy wiring (optional)

- The site's MCP panel shows a placeholder URL (`mcp.fixmyslop.dev`). After the
  worker deploys, update the `#mcpcfg` block in `apps/web/index.html` to the real
  workers.dev URL (or attach a custom domain in the Cloudflare dashboard and use that).
- To refresh the data later: re-run the crawl (`packages/crawl`), then
  `node scripts/build-service-bundle.mjs` (rebuilds `apps/engine/data`, which both
  apps consume) and redeploy. Nothing else changes.

## Regenerating the engine bundles

```bash
node scripts/build-service-bundle.mjs   # apps/engine/data/{corpus,brands,fonts}.json
cp apps/engine/data/*.json apps/web/vendor/data/   # web keeps a self-contained copy
```
