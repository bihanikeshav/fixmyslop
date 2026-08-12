// index.mjs — the Cloudflare Worker entry.
//
// Exposes the fixmyslop engine as BOTH a REST JSON API (what the web app
// calls) and a remote MCP server (POST /mcp, GET /sse). The engine is pure and
// instantiated once at module scope (see tools.mjs).

import { engine, stats, STRUCTURE_ARCHETYPES, TOOL_BY_NAME } from "./tools.mjs";
import { handleMcpPost, handleSse } from "./mcp.mjs";
import { renderSkill, renderVerbFile, PREAMBLE, VERBS } from "../../engine/prompts.mjs";
import { renderReference, REFERENCE } from "../../engine/reference.mjs";
import { renderInstall } from "./install-doc.mjs";
import { VERSION } from "./version.mjs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, mcp-session-id, mcp-protocol-version",
  "Access-Control-Max-Age": "86400",
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, "content-type": "application/json; charset=utf-8" },
  });

const err = (message, status = 400) => json({ error: message }, status);

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const { pathname } = url;
    const q = url.searchParams;

    // CORS preflight for every route.
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    try {
      // ---- MCP ----
      if (pathname === "/mcp") {
        if (request.method === "POST") return await handleMcpPost(request, CORS);
        // A GET to /mcp (Streamable HTTP "open stream") — we don't keep a server
        // stream open; tell the client to POST instead.
        return json({ error: "Use POST for JSON-RPC, or GET /sse." }, 405);
      }
      if (pathname === "/sse" && request.method === "GET") return handleSse(url, CORS);

      // ---- health ----
      if (pathname === "/health") return json({ ok: true, version: VERSION, fonts: stats.fonts, corpus: stats.corpus });

      // ---- REST API ----
      if (pathname === "/api/color" && request.method === "GET") {
        const hex = q.get("hex");
        if (!hex) return err("missing ?hex");
        return json(engine.checkColor(hex));
      }

      if (pathname === "/api/palette") {
        let body;
        if (request.method === "POST") {
          try { body = await request.json(); } catch { return err("invalid JSON body"); }
        } else if (request.method === "GET") {
          body = {
            ground: q.get("ground"), ink: q.get("ink"),
            accent: q.get("accent"), accent2: q.get("accent2") || undefined,
            surface: q.get("surface") || undefined,
          };
        } else return err("method not allowed", 405);
        const { ground, ink, accent, accent2, surface } = body || {};
        if (!ground || !ink || !accent) return err("need ground, ink, accent");
        return json(engine.checkPalette(ground, ink, accent, accent2, surface));
      }

      if (pathname === "/api/fonts" && request.method === "GET") {
        const n = Number(q.get("n")) || 6;
        const category = q.get("category") || null;
        return json(engine.suggestFonts(n, { category }));
      }

      if (pathname === "/api/font" && request.method === "GET") {
        const family = q.get("family");
        if (!family) return err("missing ?family");
        return json(engine.checkFont(family));
      }

      if (pathname === "/api/structure" && request.method === "GET") {
        return json({ archetypes: STRUCTURE_ARCHETYPES });
      }

      if (pathname.startsWith("/api/tool/")) {
        const name = pathname.slice("/api/tool/".length);
        const tool = TOOL_BY_NAME[name];
        if (!tool) return err(`unknown tool: ${name}`, 404);
        let args = {};
        if (request.method === "POST") {
          try { args = await request.json(); } catch { return err("invalid JSON body"); }
        } else {
          for (const [k, v] of q.entries()) args[k] = /^-?\d+\.?\d*$/.test(v) ? Number(v) : v;
        }
        return json(tool.run(args));
      }

      // ---- skill routes (staggered: index + on-demand pass files) ----
      if (pathname.startsWith("/skill/") && pathname.endsWith(".md")) {
        const name = pathname.slice("/skill/".length, -3); // strip "/skill/" and ".md"
        let md = null;
        if (name === "SKILL") md = renderSkill();
        else if (name === "design-law") md = PREAMBLE;
        else if (name.startsWith("reference/")) md = renderReference(name.slice("reference/".length));
        else md = renderVerbFile(name);
        if (md == null) return err(`unknown skill file: ${name}`, 404);
        return new Response(md, { headers: { ...CORS, "content-type": "text/markdown; charset=utf-8" } });
      }
      if (pathname === "/skill") {
        const base = url.origin;
        const refKeys = REFERENCE.map((r) => r.key).join(" ");
        const verbKeys = VERBS.map((v) => v.name).join(" ");
        const script = `#!/bin/sh
# Install the fixmyslop design skill (staggered: a cheap index + on-demand passes).
# SKILL.md is a cross-agent standard: this writes to ~/.claude/skills (read by Claude
# Code, and by Cursor & Codex for compatibility) and ~/.agents/skills (neutral location).
set -e
NAME=fixmyslop
DIR="$HOME/.claude/skills/$NAME"
mkdir -p "$DIR"
curl -fsSL "${base}/skill/SKILL.md" -o "$DIR/SKILL.md"
curl -fsSL "${base}/skill/design-law.md" -o "$DIR/design-law.md"
for V in ${verbKeys}; do
  curl -fsSL "${base}/skill/$V.md" -o "$DIR/$V.md"
done
mkdir -p "$DIR/reference"
for R in ${refKeys}; do
  curl -fsSL "${base}/skill/reference/$R.md" -o "$DIR/reference/$R.md"
done
mkdir -p "$HOME/.agents/skills/$NAME"
cp -rf "$DIR/." "$HOME/.agents/skills/$NAME/" 2>/dev/null || true
echo "Installed fixmyslop skill (Claude Code / Cursor / Codex) -> $DIR"
echo "Invoke it: /fixmyslop  (full guide, agent picks passes)  or  /fixmyslop:polish  (one pass)"
echo "Connect the tools:"
echo "  Claude Code:  claude mcp add --transport http fixmyslop ${base}/mcp"
echo "  Cursor:       add {\\"fixmyslop\\":{\\"url\\":\\"${base}/mcp\\"}} to ~/.cursor/mcp.json"
`;
        return new Response(script, { headers: { ...CORS, "content-type": "text/x-shellscript; charset=utf-8" } });
      }

      // ---- install guide ----
      if (pathname === "/install" || pathname === "/install.md") {
        return new Response(renderInstall(url.origin), { headers: { ...CORS, "content-type": "text/markdown; charset=utf-8" } });
      }

      // ---- index / 404 ----
      if (pathname === "/" || pathname === "") {
        return json({
          name: "fixmyslop",
          install: "/install.md",
          rest: ["/api/color?hex=", "/api/palette", "/api/fonts?n=&category=", "/api/font?family=", "/api/structure", "/health"],
          mcp: { streamableHttp: "POST /mcp", sse: "GET /sse", prompts: "prompts/list · prompts/get" },
          skill: { install: "GET /skill", raw: "GET /skill/SKILL.md" },
          tools: Object.keys(TOOL_BY_NAME),
          restTool: "/api/tool/<name> (GET query or POST json)",
        });
      }
      return err(`not found: ${pathname}`, 404);
    } catch (e) {
      return err(String((e && e.message) || e), 400);
    }
  },
};
