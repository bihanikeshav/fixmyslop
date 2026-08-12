import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "./index.mjs";

test("GET /health reports release version", async () => {
  const response = await worker.fetch(new Request("http://x/health"));
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.version, "0.1.4");
});

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

test("GET /skill installs the staggered fixmyslop skill (index + passes)", async () => {
  const s = await worker.fetch(new Request("http://x/skill"));
  assert.equal(s.status, 200);
  const script = await s.text();
  assert.match(script, /NAME=fixmyslop/);
  assert.match(script, /SKILL\.md/);
  assert.match(script, /for V in explore .* polish/);   // fetches the pass files (dynamic from VERBS)
  assert.match(script, /technical-product/);            // fetches the specialized landing reference
  assert.match(script, /grok mcp add/);
  assert.match(script, /opencode mcp add/);
  assert.match(script, /cline mcp add/);
  assert.match(script, /\.vscode\/mcp\.json/);
});

test("staggered skill files: SKILL.md index, a pass, the design law, and 404", async () => {
  const idx = await worker.fetch(new Request("http://x/skill/SKILL.md"));
  assert.equal(idx.status, 200);
  const idxBody = await idx.text();
  assert.match(idxBody, /name:\s*fixmyslop/);
  assert.doesNotMatch(idxBody, /\.\.\/personality/);

  const pass = await worker.fetch(new Request("http://x/skill/polish.md"));
  assert.equal(pass.status, 200);
  assert.match(await pass.text(), /# fixmyslop — polish/);

  const law = await worker.fetch(new Request("http://x/skill/design-law.md"));
  assert.equal(law.status, 200);
  assert.match(await law.text(), /Hard gates/);

  // the index maps the on-demand reference library, and each topic serves
  assert.match(idxBody, /reference\/layout\.md/);
  const ref = await worker.fetch(new Request("http://x/skill/reference/layout.md"));
  assert.equal(ref.status, 200);
  assert.match(await ref.text(), /fixmyslop reference/);

  const technical = await worker.fetch(new Request("http://x/skill/reference/technical-product.md"));
  assert.equal(technical.status, 200);
  assert.match(await technical.text(), /Write the narrative spine before styling/);

  const missing = await worker.fetch(new Request("http://x/skill/nope.md"));
  assert.equal(missing.status, 404);
});

test("GET /install.md covers MCP + skill with the live origin", async () => {
  const res = await worker.fetch(new Request("http://example.test/install.md"));
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /text\/markdown/);
  const md = await res.text();
  assert.match(md, /MCP endpoint/);               // MCP section
  assert.match(md, /Optional skill/);             // skill section
  assert.match(md, /example\.test\/mcp/);         // base URL interpolated from origin
  assert.match(md, /example\.test\/skill/);
  assert.match(md, /grok mcp add/);
  assert.match(md, /\.grok\/config\.toml/);
  assert.match(md, /\.codex\/config\.toml/);
  assert.match(md, /\.cursor\/mcp\.json/);
  assert.match(md, /windsurf\/mcp_config\.json/);
  assert.match(md, /"mcp":\{"servers"/);
  assert.match(md, /\.vscode\/mcp\.json/);
  assert.match(md, /cline mcp add/);
  assert.match(md, /server_url/);
  assert.doesNotMatch(md, /Tool catalog/);         // install page stays lean
  assert.ok(md.length < 5000, `install guide grew to ${md.length} bytes`);
  assert.doesNotMatch(md, /\b\d+ tools\b/, "install guide must not hard-code a drifting tool count");
  const alias = await worker.fetch(new Request("http://example.test/install"));
  assert.equal(alias.status, 200);                // /install alias also works
});
