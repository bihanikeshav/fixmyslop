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

test("GET /skill installs the staggered fix-ai-slop skill (index + passes)", async () => {
  const s = await worker.fetch(new Request("http://x/skill"));
  assert.equal(s.status, 200);
  const script = await s.text();
  assert.match(script, /NAME=fix-ai-slop/);
  assert.match(script, /SKILL\.md/);
  assert.match(script, /for V in improve_design .* polish/);   // fetches the pass files
});

test("staggered skill files: SKILL.md index, a pass, the design law, and 404", async () => {
  const idx = await worker.fetch(new Request("http://x/skill/SKILL.md"));
  assert.equal(idx.status, 200);
  const idxBody = await idx.text();
  assert.match(idxBody, /name:\s*fix-ai-slop/);
  assert.doesNotMatch(idxBody, /\.\.\/personality/);

  const pass = await worker.fetch(new Request("http://x/skill/polish.md"));
  assert.equal(pass.status, 200);
  assert.match(await pass.text(), /# fix-ai-slop — polish/);

  const law = await worker.fetch(new Request("http://x/skill/design-law.md"));
  assert.equal(law.status, 200);
  assert.match(await law.text(), /Hard gates/);

  const missing = await worker.fetch(new Request("http://x/skill/nope.md"));
  assert.equal(missing.status, 404);
});

test("GET /install.md covers MCP + skill with the live origin", async () => {
  const res = await worker.fetch(new Request("http://example.test/install.md"));
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /text\/markdown/);
  const md = await res.text();
  assert.match(md, /Connect the MCP/);            // MCP section
  assert.match(md, /fix-ai-slop skill/);          // skill section
  assert.match(md, /example\.test\/mcp/);         // base URL interpolated from origin
  assert.match(md, /example\.test\/skill/);
  const alias = await worker.fetch(new Request("http://example.test/install"));
  assert.equal(alias.status, 200);                // /install alias also works
});
