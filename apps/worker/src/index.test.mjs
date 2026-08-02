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
