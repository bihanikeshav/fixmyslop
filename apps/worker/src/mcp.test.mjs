import { test } from "node:test";
import assert from "node:assert/strict";
import { handleMcpPost } from "./mcp.mjs";

const call = async (msg) => JSON.parse(await (await handleMcpPost(new Request("http://x/mcp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(msg) }), {})).text());

test("initialize advertises prompts + carries server instructions with the two hard rules", async () => {
  const r = await call({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
  assert.ok(r.result.capabilities.prompts);
  assert.equal(r.result.serverInfo.version, "0.1.1");
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

test("MCP tools/list exposes connected, dashboard, Fluid, and validation paths", async () => {
  const list = await call({ jsonrpc: "2.0", id: 4, method: "tools/list" });
  const names = new Set(list.result.tools.map((tool) => tool.name));
  for (const name of ["connected_style_genome", "connected_build_spec", "connected_v2_catalog", "check_svg", "dashboard_system", "fluid_components", "check_dashboard_layout"]) assert.ok(names.has(name), name);
});

test("MCP tools/call returns computed dashboard geometry and Fluid registry URLs", async () => {
  const result = await call({
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: { name: "dashboard_system", arguments: { viewportWidth: 1440, viewportHeight: 900, content: "table" } },
  });
  const payload = JSON.parse(result.result.content[0].text);
  assert.equal(payload.schemaVersion, "dashboard-system.v1");
  assert.equal(payload.math.columns, 12);
  assert.ok(payload.fluid.components.every((item) => item.registryUrl.startsWith("https://www.fluidfunctionalism.com/r/")));
});
