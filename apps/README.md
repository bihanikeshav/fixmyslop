# apps/

| Folder | What | Index |
|---|---|---|
| `engine/` | Pure deterministic design engine (the product's brain) | [`engine/README.md`](engine/README.md) |
| `worker/` | Cloudflare Worker: REST `/api/*`, MCP `/mcp`, `/skill`, `/install`; serves `web/` as static assets | [`worker/README.md`](worker/README.md) |
| `web/` | Static workbench + legacy dashboard | [`web/README.md`](web/README.md) |

[`DEPLOY.md`](DEPLOY.md) — deploy commands and endpoint catalogue.
[`INSTALL.md`](INSTALL.md) — installing the MCP server / skill into agent clients.

The Worker and the web build both import `engine/` directly; there is no second
implementation. Tests for `engine/` and `worker/` are node:test (`npm run test:apps`).
