// index.mjs — the Cloudflare Worker entry.
//
// Exposes the fixmyslop engine as BOTH a REST JSON API (what the web app
// calls) and a remote MCP server (POST /mcp, GET /sse). The engine is pure and
// instantiated once at module scope (see tools.mjs).
//
// This endpoint is PUBLIC and UNAUTHENTICATED, so every request passes through
// ./guard.mjs before it reaches the engine: a 256 KB body cap (413), per-IP rate
// limiting on the compute routes (429, via the Cloudflare Rate Limiting binding,
// degrading open when the binding is absent), security headers on every response,
// Cache-Control on the deterministic ones, and an allowlist on the origin that
// gets baked into the `curl | sh` installer. See guard.mjs for the reasoning.

import { engine, stats, STRUCTURE_ARCHETYPES, TOOL_BY_NAME } from "./tools.mjs";
import { handleMcpPost, handleSse } from "./mcp.mjs";
import { renderSkill, renderVerbFile, PREAMBLE, VERBS } from "../../engine/prompts.mjs";
import { renderReference, REFERENCE } from "../../engine/reference.mjs";
import { renderInstall } from "./install-doc.mjs";
import { VERSION } from "./version.mjs";
import {
  BodyTooLarge, readBoundedJson, checkRateLimit, installOrigin, headersFor, CACHE, RATE_LIMIT,
} from "./guard.mjs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, mcp-session-id, mcp-protocol-version",
  "Access-Control-Max-Age": "86400",
};

// `cache` defaults to no-store: a route has to opt IN to being cacheable, so a new
// route can never accidentally ship a stale or shared answer.
const json = (obj, status = 200, cache = CACHE.none) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: headersFor({ ...CORS, "content-type": "application/json; charset=utf-8" }, cache),
  });

const text = (body, contentType, cache = CACHE.none, status = 200) =>
  new Response(body, { status, headers: headersFor({ ...CORS, "content-type": contentType }, cache) });

const err = (message, status = 400) => json({ error: message }, status);

// Routes that actually run the engine. Everything here is rate limited; the docs, the
// health probe and the static archetype list are not (they are constant and cheap).
const isComputeRoute = (pathname, method) =>
  pathname === "/mcp"
  || pathname.startsWith("/api/tool/")
  || pathname === "/api/color"
  || pathname === "/api/palette"
  || pathname === "/api/fonts"
  || pathname === "/api/font"
  || (method === "POST" && pathname.startsWith("/api/"));

/**
 * coerceQueryArgs(tool, searchParams) → args
 *
 * A query string is all strings; the tools want typed values. This used to guess with
 * `/^-?\d+\.?\d*$/.test(v) ? Number(v) : v`, which is wrong in both directions: a
 * `hex=123456` or a font `family=1000` became a NUMBER (String(a.hex) then produced
 * "123456" — no "#", a different colour), while a declared boolean or array stayed a
 * string the tool never understood. Coerce by the tool's DECLARED schema type instead.
 *
 * Keys the schema does not declare keep the old numeric heuristic, so any tool reading an
 * undeclared parameter behaves exactly as before.
 */
function coerceScalar(raw, type) {
  switch (type) {
    case "number":
    case "integer": {
      const n = Number(raw);
      // Not a number? Hand the raw string through so the tool's own validation produces a
      // meaningful error instead of a silent NaN.
      return Number.isFinite(n) ? n : raw;
    }
    case "boolean": {
      const v = raw.trim().toLowerCase();
      if (v === "true" || v === "1" || v === "yes" || v === "") return true;
      if (v === "false" || v === "0" || v === "no") return false;
      return raw;
    }
    case "string":
      return raw;
    case "object":
      try { return JSON.parse(raw); } catch { return raw; }
    default:
      return raw;
  }
}

export function coerceQueryArgs(tool, searchParams) {
  const props = (tool && tool.inputSchema && tool.inputSchema.properties) || {};
  const args = {};
  for (const key of new Set([...searchParams.keys()])) {
    const schema = props[key];
    if (!schema) {
      // undeclared: preserve the historical "looks numeric" behaviour
      const v = searchParams.get(key);
      args[key] = /^-?\d+\.?\d*$/.test(v) ? Number(v) : v;
      continue;
    }
    if (schema.type === "array") {
      const all = searchParams.getAll(key);
      // repeated params (?needs=a&needs=b) OR one comma-separated value (?needs=a,b)
      const parts = all.length > 1 ? all : String(all[0] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      const itemType = (schema.items && schema.items.type) || "string";
      args[key] = parts.map((p) => coerceScalar(p, itemType));
      continue;
    }
    args[key] = coerceScalar(searchParams.get(key), schema.type);
  }
  return args;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    const q = url.searchParams;

    // CORS preflight for every route.
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    try {
      // ---- per-IP rate limiting on the compute surface ----
      // No-ops when the RATE_LIMITER binding is absent (tests, plain `wrangler dev`).
      if (isComputeRoute(pathname, request.method)) {
        const gate = await checkRateLimit(env, request, pathname === "/mcp" ? "mcp" : "api");
        if (!gate.ok) {
          return new Response(
            JSON.stringify({ error: `rate limit exceeded — max ${RATE_LIMIT.limit} requests per ${RATE_LIMIT.periodSeconds}s`, retryAfter: gate.retryAfter }),
            {
              status: 429,
              headers: headersFor({ ...CORS, "content-type": "application/json; charset=utf-8", "Retry-After": String(gate.retryAfter) }, CACHE.none),
            },
          );
        }
      }

      // ---- MCP ----
      if (pathname === "/mcp") {
        if (request.method === "POST") return await handleMcpPost(request, CORS);
        // A GET to /mcp (Streamable HTTP "open stream") — we don't keep a server
        // stream open; tell the client to POST instead.
        return json({ error: "Use POST for JSON-RPC, or GET /sse." }, 405);
      }
      if (pathname === "/sse" && request.method === "GET") return handleSse(url, CORS);

      // ---- health ----
      if (pathname === "/health") return json({ ok: true, version: VERSION, fonts: stats.fonts, corpus: stats.corpus }, 200, CACHE.health);

      // ---- REST API ----
      if (pathname === "/api/color" && request.method === "GET") {
        const hex = q.get("hex");
        if (!hex) return err("missing ?hex");
        return json(engine.checkColor(hex), 200, CACHE.deterministic);
      }

      if (pathname === "/api/palette") {
        let body;
        if (request.method === "POST") {
          try { body = await readBoundedJson(request); }
          catch (e) { if (e instanceof BodyTooLarge) throw e; return err("invalid JSON body"); }
        } else if (request.method === "GET") {
          body = {
            ground: q.get("ground"), ink: q.get("ink"),
            accent: q.get("accent"), accent2: q.get("accent2") || undefined,
            surface: q.get("surface") || undefined,
          };
        } else return err("method not allowed", 405);
        const { ground, ink, accent, accent2, surface } = body || {};
        if (!ground || !ink || !accent) return err("need ground, ink, accent");
        // GET is a pure function of the query string; POST carries a body, so it is not cached.
        return json(engine.checkPalette(ground, ink, accent, accent2, surface), 200,
          request.method === "GET" ? CACHE.deterministic : CACHE.none);
      }

      if (pathname === "/api/fonts" && request.method === "GET") {
        const n = Number(q.get("n")) || 6;
        const category = q.get("category") || null;
        return json(engine.suggestFonts(n, { category }), 200, CACHE.deterministic);
      }

      if (pathname === "/api/font" && request.method === "GET") {
        const family = q.get("family");
        if (!family) return err("missing ?family");
        return json(engine.checkFont(family), 200, CACHE.deterministic);
      }

      if (pathname === "/api/structure" && request.method === "GET") {
        return json({ archetypes: STRUCTURE_ARCHETYPES }, 200, CACHE.doc);   // a constant list
      }

      if (pathname.startsWith("/api/tool/")) {
        const name = pathname.slice("/api/tool/".length);
        const tool = TOOL_BY_NAME[name];
        if (!tool) return err(`unknown tool: ${name}`, 404);
        let args = {};
        if (request.method === "POST") {
          try { args = (await readBoundedJson(request)) ?? {}; }
          catch (e) { if (e instanceof BodyTooLarge) throw e; return err("invalid JSON body"); }
        } else {
          args = coerceQueryArgs(tool, q);
        }
        return json(tool.run(args), 200, request.method === "GET" ? CACHE.deterministic : CACHE.none);
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
        return text(md, "text/markdown; charset=utf-8", CACHE.doc);
      }
      if (pathname === "/skill") {
        // NOT url.origin: this script is piped into a shell, so the host inside it must be
        // one we trust, not one the caller put in the Host header. See guard.mjs.
        const base = installOrigin(url, env);
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
echo "  Grok CLI:     grok mcp add --transport http fixmyslop ${base}/mcp"
echo "  OpenCode:     opencode mcp add fixmyslop --url ${base}/mcp"
echo "  Cline:        cline mcp add fixmyslop ${base}/mcp --type http"
echo "  VS Code:      add a fixmyslop http server to .vscode/mcp.json"
`;
        return text(script, "text/x-shellscript; charset=utf-8", CACHE.doc);
      }

      // ---- install guide ----
      if (pathname === "/install" || pathname === "/install.md") {
        // Same allowlist as /skill — this page's `mcp add` commands are copy-pasted verbatim.
        return text(renderInstall(installOrigin(url, env)), "text/markdown; charset=utf-8", CACHE.doc);
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
        }, 200, CACHE.doc);
      }
      return err(`not found: ${pathname}`, 404);
    } catch (e) {
      // An oversized body is a client error with its own status — everything else stays 400.
      if (e instanceof BodyTooLarge) return err(e.message, 413);
      return err(String((e && e.message) || e), 400);
    }
  },
};
