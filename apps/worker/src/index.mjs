// index.mjs — the Cloudflare Worker entry.
//
// Exposes the ai-slop-font engine as BOTH a REST JSON API (what the web app
// calls) and a remote MCP server (POST /mcp, GET /sse). The engine is pure and
// instantiated once at module scope (see tools.mjs).

import { engine, stats, STRUCTURE_ARCHETYPES, TOOL_BY_NAME } from "./tools.mjs";
import { handleMcpPost, handleSse } from "./mcp.mjs";
import { renderSkill } from "../../engine/prompts.mjs";
import { renderInstall } from "./install-doc.mjs";

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
      if (pathname === "/health") return json({ ok: true, fonts: stats.fonts, corpus: stats.corpus });

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
          };
        } else return err("method not allowed", 405);
        const { ground, ink, accent, accent2 } = body || {};
        if (!ground || !ink || !accent) return err("need ground, ink, accent");
        return json(engine.checkPalette(ground, ink, accent, accent2));
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

      // ---- skill routes ----
      if (pathname === "/skill/SKILL.md") {
        return new Response(renderSkill(), { headers: { ...CORS, "content-type": "text/markdown; charset=utf-8" } });
      }
      if (pathname === "/skill") {
        const base = url.origin;
        const script = `#!/bin/sh
# Install the ai-slop-font 'atelier' design skill for Claude Code.
set -e
mkdir -p "$HOME/.claude/skills/atelier"
curl -fsSL "${base}/skill/SKILL.md" -o "$HOME/.claude/skills/atelier/SKILL.md"
echo "Installed atelier skill -> $HOME/.claude/skills/atelier/SKILL.md"
echo "Now connect the tools:  claude mcp add --transport http ai-slop-font ${base}/mcp"
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
          name: "ai-slop-font",
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
