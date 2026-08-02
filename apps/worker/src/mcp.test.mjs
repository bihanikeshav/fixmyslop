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
