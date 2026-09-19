// hardening.test.mjs — the guards that stand between a stranger and the engine.
//
// This Worker is PUBLIC and UNAUTHENTICATED. index.test.mjs covers what the routes return;
// this file covers what they REFUSE: oversized bodies (413), per-IP rate limiting (429),
// query coercion by declared schema type, the origin allowlist on the `curl | sh` installer,
// and the security/cache headers. See src/guard.mjs for the reasoning behind each.
import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "./index.mjs";
import { coerceQueryArgs } from "./index.mjs";
import { handleMcpPost } from "./mcp.mjs";
import { TOOL_BY_NAME } from "./tools.mjs";
import { MAX_BODY_BYTES, CANONICAL_ORIGIN, installOrigin, checkRateLimit, clientKey } from "./guard.mjs";

const oversized = () => JSON.stringify({ pad: "x".repeat(MAX_BODY_BYTES + 1024) });

test("413: an oversized POST body is refused on every JSON surface", async () => {
  const body = oversized();
  assert.ok(body.length > MAX_BODY_BYTES);

  for (const path of ["/api/tool/design_system", "/api/palette"]) {
    const res = await worker.fetch(new Request(`http://x${path}`, {
      method: "POST", headers: { "content-type": "application/json" }, body,
    }));
    assert.equal(res.status, 413, path);
    assert.match((await res.json()).error, /exceeds the \d+ byte limit/);
  }

  // …and on the MCP endpoint, which is the real amplification risk (a batch of tools/call
  // messages, each of which runs the engine — capping the body is what bounds the fan-out)
  const mcp = await worker.fetch(new Request("http://x/mcp", {
    method: "POST", headers: { "content-type": "application/json" }, body,
  }));
  assert.equal(mcp.status, 413);

  // handleMcpPost enforces it directly too, not only via the router
  const direct = await handleMcpPost(new Request("http://x/mcp", {
    method: "POST", headers: { "content-type": "application/json" }, body,
  }), {});
  assert.equal(direct.status, 413);
});

test("413: a LYING Content-Length is rejected on the header alone", async () => {
  // Content-Length is the cheap rejection; the measured byte count is the one that holds.
  const res = await worker.fetch(new Request("http://x/api/tool/design_system", {
    method: "POST",
    headers: { "content-type": "application/json", "content-length": String(MAX_BODY_BYTES * 10) },
    body: JSON.stringify({ seed: 2 }),
  }));
  assert.equal(res.status, 413);
});

test("a body under the cap still works", async () => {
  const res = await worker.fetch(new Request("http://x/api/tool/design_system", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ seed: 2, note: "x".repeat(1024) }),
  }));
  assert.equal(res.status, 200);
  assert.ok((await res.json()).palette);
});

test("429: per-IP rate limiting fires when the binding is present, with Retry-After", async () => {
  const seen = [];
  const env = { RATE_LIMITER: { limit: async ({ key }) => { seen.push(key); return { success: false }; } } };

  for (const [path, method] of [["/api/tool/design_system", "GET"], ["/mcp", "POST"], ["/api/color?hex=%23ff0000", "GET"]]) {
    const res = await worker.fetch(new Request(`http://x${path}`, { method, headers: { "cf-connecting-ip": "203.0.113.9" } }), env);
    assert.equal(res.status, 429, path);
    assert.equal(res.headers.get("Retry-After"), "60");
    assert.match((await res.json()).error, /rate limit exceeded/);
  }
  // keyed per IP, and /mcp gets its own bucket so it cannot drain the REST budget
  assert.deepEqual(seen, ["api:203.0.113.9", "mcp:203.0.113.9", "api:203.0.113.9"]);

  // allowed when the limiter says yes
  const allow = { RATE_LIMITER: { limit: async () => ({ success: true }) } };
  assert.equal((await worker.fetch(new Request("http://x/api/tool/shadow?elevation=4"), allow)).status, 200);

  // docs / health are NOT rate limited — they are constant, cheap, and must stay reachable
  const deny = { RATE_LIMITER: { limit: async () => ({ success: false }) } };
  assert.equal((await worker.fetch(new Request("http://x/health"), deny)).status, 200);
  assert.equal((await worker.fetch(new Request("http://x/skill/SKILL.md"), deny)).status, 200);
});

test("rate limiting degrades OPEN: no env, no binding, broken binding", async () => {
  assert.equal((await checkRateLimit(undefined, new Request("http://x/"))).ok, true);
  assert.equal((await checkRateLimit({}, new Request("http://x/"))).ok, true);
  assert.equal((await checkRateLimit({ RATE_LIMITER: {} }, new Request("http://x/"))).ok, true);
  const broken = { RATE_LIMITER: { limit: async () => { throw new Error("limiter down"); } } };
  assert.equal((await checkRateLimit(broken, new Request("http://x/"))).ok, true);
  // a limiter outage must not become an API outage
  assert.equal((await worker.fetch(new Request("http://x/api/tool/shadow?elevation=4"), broken)).status, 200);

  // key derivation prefers the edge-set header over the spoofable one
  assert.equal(clientKey(new Request("http://x/", { headers: { "cf-connecting-ip": "1.2.3.4", "x-forwarded-for": "9.9.9.9" } })), "1.2.3.4");
  assert.equal(clientKey(new Request("http://x/", { headers: { "x-forwarded-for": "9.9.9.9, 8.8.8.8" } })), "9.9.9.9");
  assert.equal(clientKey(new Request("http://x/")), "anonymous");
});

test("GET /api/tool/<name> coerces query args by the DECLARED schema type", async () => {
  // the bug: the old "looks numeric" heuristic turned a hex STRING into a Number
  const colorArgs = coerceQueryArgs(TOOL_BY_NAME.check_color, new URLSearchParams("hex=123456"));
  assert.equal(colorArgs.hex, "123456");
  assert.equal(typeof colorArgs.hex, "string");

  // a font family that happens to be all digits stays a string
  const fontArgs = coerceQueryArgs(TOOL_BY_NAME.check_font, new URLSearchParams("family=1000"));
  assert.equal(typeof fontArgs.family, "string");

  // declared numbers/integers still become numbers
  assert.equal(coerceQueryArgs(TOOL_BY_NAME.shadow, new URLSearchParams("elevation=4")).elevation, 4);
  assert.equal(coerceQueryArgs(TOOL_BY_NAME.suggest_fonts, new URLSearchParams("n=8")).n, 8);
  // a non-numeric value for a numeric field passes through raw, not as a silent NaN
  assert.equal(coerceQueryArgs(TOOL_BY_NAME.shadow, new URLSearchParams("elevation=abc")).elevation, "abc");

  // arrays: repeated params and one comma-separated value both work
  const arrayTool = Object.values(TOOL_BY_NAME).find((t) =>
    Object.values((t.inputSchema && t.inputSchema.properties) || {}).some((p) => p.type === "array"));
  assert.ok(arrayTool, "expected at least one tool with an array input");
  const arrayKey = Object.entries(arrayTool.inputSchema.properties).find(([, p]) => p.type === "array")[0];
  assert.deepEqual(coerceQueryArgs(arrayTool, new URLSearchParams(`${arrayKey}=a&${arrayKey}=b`))[arrayKey], ["a", "b"]);
  assert.deepEqual(coerceQueryArgs(arrayTool, new URLSearchParams(`${arrayKey}=a,b`))[arrayKey], ["a", "b"]);

  // undeclared keys keep the historical numeric heuristic, so nothing relying on it regresses
  assert.equal(coerceQueryArgs(TOOL_BY_NAME.shadow, new URLSearchParams("notInSchema=12")).notInSchema, 12);

  // end to end through the router
  const body = await (await worker.fetch(new Request("http://x/api/tool/check_color?hex=%236366f1"))).json();
  assert.equal(body.hex, "#6366f1");
});

test("install/skill origin is allowlisted, with a canonical fallback and an env override", async () => {
  // allowed: the canonical deployment and local dev (any port)
  assert.equal(installOrigin(new URL("https://fixmyslop.bihanikeshav.workers.dev/skill")), "https://fixmyslop.bihanikeshav.workers.dev");
  assert.equal(installOrigin(new URL("http://localhost:8787/skill")), "http://localhost:8787");
  assert.equal(installOrigin(new URL("http://127.0.0.1:3000/skill")), "http://127.0.0.1:3000");

  // NOT allowed: any other Host header falls back to the canonical origin
  assert.equal(installOrigin(new URL("https://evil.example/skill")), CANONICAL_ORIGIN);
  // …including a suffix that merely LOOKS like the real host
  assert.equal(installOrigin(new URL("https://fixmyslop.bihanikeshav.workers.dev.evil.example/skill")), CANONICAL_ORIGIN);

  // deploy-time override, accepted as bare hosts or as full origins
  assert.equal(installOrigin(new URL("https://design.example/skill"), { SKILL_ORIGIN_ALLOWLIST: "design.example" }), "https://design.example");
  assert.equal(installOrigin(new URL("https://design.example/skill"), { SKILL_ORIGIN_ALLOWLIST: "https://design.example, other.example" }), "https://design.example");
  assert.equal(installOrigin(new URL("https://nope.example/skill"), { SKILL_ORIGIN_ALLOWLIST: "design.example" }), CANONICAL_ORIGIN);
  assert.equal(installOrigin(new URL("https://evil.example/skill"), { SKILL_ORIGIN_ALLOWLIST: "" }), CANONICAL_ORIGIN);

  // end to end: a spoofed Host must not put itself inside a script the reader pipes to sh
  const script = await (await worker.fetch(new Request("http://evil.example/skill"))).text();
  assert.doesNotMatch(script, /evil\.example/);
  assert.ok(script.includes(CANONICAL_ORIGIN));

  const md = await (await worker.fetch(new Request("http://evil.example/install.md"))).text();
  assert.doesNotMatch(md, /evil\.example/);
  assert.ok(md.includes(CANONICAL_ORIGIN));
});

test("security headers everywhere, Cache-Control on the deterministic responses", async () => {
  const cases = [
    ["/health", /max-age=30/],
    ["/api/color?hex=%23c2410c", /max-age=300/],
    ["/api/fonts?n=3", /max-age=300/],
    ["/api/font?family=Inter", /max-age=300/],
    ["/api/structure", /max-age=3600/],
    ["/api/tool/shadow?elevation=4", /max-age=300/],
    ["/skill/SKILL.md", /max-age=3600/],
    ["/skill", /max-age=3600/],
    ["/install.md", /max-age=3600/],
    ["/", /max-age=3600/],
  ];
  for (const [path, cache] of cases) {
    const res = await worker.fetch(new Request(`http://localhost:8787${path}`));
    assert.equal(res.status, 200, path);
    assert.equal(res.headers.get("X-Content-Type-Options"), "nosniff", path);
    assert.equal(res.headers.get("Referrer-Policy"), "no-referrer", path);
    assert.match(res.headers.get("Cache-Control") || "", cache, path);
  }

  // anything with a request body is never cached
  const post = await worker.fetch(new Request("http://x/api/tool/design_system", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ seed: 2 }),
  }));
  assert.equal(post.headers.get("Cache-Control"), "no-store");

  // …and neither is an error
  const notFound = await worker.fetch(new Request("http://x/api/tool/nope"));
  assert.equal(notFound.headers.get("Cache-Control"), "no-store");
  assert.equal(notFound.headers.get("X-Content-Type-Options"), "nosniff");

  // MCP responses carry them too
  const mcp = await worker.fetch(new Request("http://x/mcp", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }),
  }));
  assert.equal(mcp.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(mcp.headers.get("Cache-Control"), "no-store");
});
