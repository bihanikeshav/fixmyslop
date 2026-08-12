// mcp.mjs — a minimal, dependency-free MCP server over JSON-RPC 2.0.
//
// We hand-roll the protocol rather than pull in @modelcontextprotocol/sdk: the
// surface we need (initialize, tools/list, tools/call, ping) is ~100 lines and
// avoids all SDK-on-Workers transport friction. Streamable HTTP lives at
// POST /mcp; each request is a self-contained JSON-RPC message and we answer
// with a single JSON response (no long-lived stream needed for these tools).

import { TOOLS, TOOL_BY_NAME } from "./tools.mjs";
import { VERBS, renderPrompt, INSTRUCTIONS, STRICT_HANDOFF } from "../../engine/prompts.mjs";
import { VERSION } from "./version.mjs";

const PROTOCOL_VERSION = "2024-11-05";
const SERVER_INFO = { name: "fixmyslop", version: VERSION };

const rpcResult = (id, result) => ({ jsonrpc: "2.0", id, result });
const rpcError = (id, code, message, data) => ({
  jsonrpc: "2.0", id: id ?? null, error: { code, message, ...(data ? { data } : {}) },
});

// Dispatch one JSON-RPC message. Returns a response object, or null for
// notifications (no id) which must not be answered.
function handleMessage(msg) {
  if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") {
    return rpcError(msg?.id ?? null, -32600, "Invalid Request");
  }
  const { id, method, params } = msg;
  const isNotification = id === undefined || id === null;

  switch (method) {
    case "initialize":
      return rpcResult(id, {
        protocolVersion: (params && params.protocolVersion) || PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false }, prompts: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: `${INSTRUCTIONS}\n\n${STRICT_HANDOFF.replaceAll("\\\\n", "\\n")}`,
      });

    case "notifications/initialized":
    case "initialized":
      return null; // client notification, no reply

    case "ping":
      return rpcResult(id, {});

    case "tools/list":
      return rpcResult(id, {
        tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
      });

    case "tools/call": {
      const name = params && params.name;
      const args = (params && params.arguments) || {};
      const tool = TOOL_BY_NAME[name];
      if (!tool) return rpcError(id, -32602, `Unknown tool: ${name}`);
      try {
        const result = tool.run(args);
        return rpcResult(id, { content: [{ type: "text", text: JSON.stringify(result) }] });
      } catch (err) {
        // Tool-level failure is reported inside the result with isError, per MCP.
        return rpcResult(id, {
          content: [{ type: "text", text: JSON.stringify({ error: String(err && err.message || err) }) }],
          isError: true,
        });
      }
    }

    case "prompts/list":
      return rpcResult(id, { prompts: VERBS.map(({ name, description, args }) => ({ name, description, arguments: args })) });

    case "prompts/get": {
      const name = params && params.name;
      try { return rpcResult(id, renderPrompt(name, (params && params.arguments) || {})); }
      catch (e) { return rpcError(id, -32602, String(e && e.message || e)); }
    }

    default:
      if (isNotification) return null;
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

// Handle POST /mcp (Streamable HTTP). Supports a single message or a batch.
export async function handleMcpPost(request, cors) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json(rpcError(null, -32700, "Parse error"), 200, cors);
  }

  if (Array.isArray(payload)) {
    const responses = payload.map(handleMessage).filter((r) => r !== null);
    return json(responses.length ? responses : null, 200, cors);
  }
  const response = handleMessage(payload);
  // Notifications get 202 with no body.
  if (response === null) return new Response(null, { status: 202, headers: cors });
  return json(response, 200, cors);
}

// GET /sse — advertise the endpoint for SSE-style clients. We keep this minimal:
// we emit one "endpoint" event pointing clients at POST /mcp, which is where the
// actual JSON-RPC exchange happens. Full bidirectional SSE isn't needed for
// these stateless tools.
export function handleSse(url, cors) {
  const endpoint = new URL("/mcp", url).toString();
  const body = `event: endpoint\ndata: ${endpoint}\n\n`;
  return new Response(body, {
    status: 200,
    headers: { ...cors, "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache" },
  });
}

function json(obj, status, cors) {
  return new Response(obj === null ? "" : JSON.stringify(obj), {
    status,
    headers: { ...cors, "content-type": "application/json; charset=utf-8" },
  });
}
