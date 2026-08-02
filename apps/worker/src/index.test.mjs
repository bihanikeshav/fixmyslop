import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "./index.mjs";

test("GET /api/tool/shadow?elevation=4 returns a layered shadow", async () => {
  const res = await worker.fetch(new Request("http://x/api/tool/shadow?elevation=4"));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.layers.length >= 2);
});

test("POST /api/tool/design_system returns a theme", async () => {
  const res = await worker.fetch(new Request("http://x/api/tool/design_system", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ seed: 2 }) }));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.palette && body.palette.accent);
});

test("unknown tool → 404", async () => {
  const res = await worker.fetch(new Request("http://x/api/tool/nope"));
  assert.equal(res.status, 404);
});

test("GET /skill returns an install script; /skill/SKILL.md returns the self-contained skill", async () => {
  const s = await worker.fetch(new Request("http://x/skill"));
  assert.equal(s.status, 200);
  const script = await s.text();
  assert.match(script, /mkdir[^\n]*atelier/);
  assert.match(script, /SKILL\.md/);
  const md = await worker.fetch(new Request("http://x/skill/SKILL.md"));
  assert.equal(md.status, 200);
  const body = await md.text();
  assert.match(body, /name:\s*atelier/);
  assert.doesNotMatch(body, /\.\.\/personality/);
});

test("GET /install.md covers MCP + skill with the live origin", async () => {
  const res = await worker.fetch(new Request("http://example.test/install.md"));
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /text\/markdown/);
  const md = await res.text();
  assert.match(md, /Connect the MCP/);            // MCP section
  assert.match(md, /atelier skill/);              // skill section
  assert.match(md, /example\.test\/mcp/);         // base URL interpolated from origin
  assert.match(md, /example\.test\/skill/);
  const alias = await worker.fetch(new Request("http://example.test/install"));
  assert.equal(alias.status, 200);                // /install alias also works
});
