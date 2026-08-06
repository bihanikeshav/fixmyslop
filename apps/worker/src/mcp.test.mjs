import { test } from "node:test";
import assert from "node:assert/strict";
import { handleMcpPost } from "./mcp.mjs";

const call = async (msg) => JSON.parse(await (await handleMcpPost(new Request("http://x/mcp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(msg) }), {})).text());

test("initialize advertises prompts + carries server instructions with the two hard rules", async () => {
  const r = await call({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
  assert.ok(r.result.capabilities.prompts);
  assert.equal(typeof r.result.instructions, "string");
  assert.match(r.result.instructions, /pairing\.body/);   // fonts rule rides along
  assert.match(r.result.instructions, /container|margin/); // layout rule rides along
});

test("prompts/list returns 7; prompts/get renders a message", async () => {
  const l = await call({ jsonrpc: "2.0", id: 2, method: "prompts/list" });
  assert.equal(l.result.prompts.length, 7);
  const g = await call({ jsonrpc: "2.0", id: 3, method: "prompts/get", params: { name: "improve_design", arguments: {} } });
  assert.equal(g.result.messages[0].role, "user");
  assert.match(g.result.messages[0].content.text, /suggest_fonts|design_system/);
});
