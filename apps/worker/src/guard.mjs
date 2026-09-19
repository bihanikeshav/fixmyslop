// guard.mjs — request-level hardening for a PUBLIC, UNAUTHENTICATED Worker.
//
// Nothing here is business logic: it is the set of things that have to be true before the
// pure engine is allowed to run on a stranger's input. Three concerns, deliberately kept
// in one small module so index.mjs and mcp.mjs cannot drift:
//
//   1. BODY SIZE     — a cap enforced twice (declared Content-Length, then the bytes we
//                      actually read) so neither a lying header nor a chunked body gets past.
//   2. RATE LIMITING — per-IP, via the Cloudflare Rate Limiting binding. The binding is
//                      absent in `node --test` and in plain `wrangler dev` without the
//                      namespace, so every call degrades to "allowed" rather than failing.
//   3. RESPONSE HEADERS — nosniff / Referrer-Policy on everything, and an explicit
//                      Cache-Control on responses that are deterministic functions of the URL.
//
// None of it touches the engine, so engine output for a given input is unchanged.

// 256 KB. Every real request to this API is a small JSON object — the largest legitimate
// body is a page genome, which is a few KB. This is ~2 orders of magnitude of headroom and
// still small enough that parsing it can't be used to burn CPU.
export const MAX_BODY_BYTES = 256 * 1024;

export const SECURITY_HEADERS = {
  // The API serves attacker-influenced strings (hex codes, briefs, font names) inside JSON
  // and markdown. nosniff stops a browser content-sniffing any of it into active HTML.
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

// Cache-Control presets. Everything this Worker serves on GET is a pure function of the URL
// (the engine is deterministic and seeded), so it is genuinely cacheable — the only reason
// it wasn't is that nothing set a header.
export const CACHE = {
  // deterministic engine answers: same query string → same bytes, forever
  deterministic: "public, max-age=300, s-maxage=3600",
  // built-from-source docs (skill files, install guide, the install script)
  doc: "public, max-age=3600, s-maxage=3600",
  // health is a liveness probe: cache briefly so a hot loop can't stampede, but stay fresh
  health: "public, max-age=30",
  // anything with a request body, or an error
  none: "no-store",
};

// --------------------------------------------------------------------------- body size

export class BodyTooLarge extends Error {
  constructor(bytes) {
    super(`request body exceeds the ${MAX_BODY_BYTES} byte limit`);
    this.name = "BodyTooLarge";
    this.bytes = bytes;
  }
}

const declaredLength = (request) => {
  const raw = request.headers?.get?.("content-length");
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/**
 * readBoundedText(request) → string
 *
 * Reads the body as text, refusing anything over MAX_BODY_BYTES. Checked twice on purpose:
 * the Content-Length header is the cheap rejection (we never touch the stream), and the
 * measured byte length is the one that actually holds — a chunked request sends no
 * Content-Length, and a hostile one can simply lie in it.
 *
 * Throws BodyTooLarge, which callers turn into a 413.
 */
export async function readBoundedText(request) {
  const declared = declaredLength(request);
  if (declared != null && declared > MAX_BODY_BYTES) throw new BodyTooLarge(declared);
  const text = await request.text();
  // Measure BYTES, not UTF-16 code units: a body of multi-byte characters is bigger on the
  // wire than `text.length` suggests. The cheap `text.length <= MAX` case short-circuits,
  // since one code unit is never more than 3 bytes of UTF-8 for BMP characters and the
  // encode is only paid for bodies that are actually near the cap.
  const bytes = text.length <= MAX_BODY_BYTES / 3 ? text.length : new TextEncoder().encode(text).length;
  if (bytes > MAX_BODY_BYTES) throw new BodyTooLarge(bytes);
  return text;
}

/** readBoundedJson(request) → parsed JSON. Throws BodyTooLarge, or SyntaxError on bad JSON. */
export async function readBoundedJson(request) {
  const text = await readBoundedText(request);
  return text === "" ? undefined : JSON.parse(text);
}

// --------------------------------------------------------------------------- rate limiting

// Default: 60 compute requests per minute per IP. Generous for an agent driving the MCP
// tools in a loop, low enough that one client cannot monopolise the isolate. The period is
// fixed by the binding's wrangler.toml config; this constant only documents it.
export const RATE_LIMIT = { limit: 60, periodSeconds: 60 };

/**
 * clientKey(request) → a stable per-caller string.
 *
 * CF-Connecting-IP is set by the edge and cannot be spoofed by the client. X-Forwarded-For
 * CAN be, so it is only a local-dev convenience; when neither is present every caller shares
 * the "anonymous" bucket, which is the safe direction (more limiting, not less).
 */
export function clientKey(request) {
  const h = request.headers;
  return h?.get?.("cf-connecting-ip")
    || (h?.get?.("x-forwarded-for") || "").split(",")[0].trim()
    || "anonymous";
}

/**
 * checkRateLimit(env, request, scope) → { ok, retryAfter }
 *
 * Uses env.RATE_LIMITER (the Cloudflare Rate Limiting binding). DEGRADES OPEN when the
 * binding is missing or throws — in `node --test` there is no env at all, and a rate limiter
 * that takes the whole API down when its backing service hiccups is worse than the DoS it
 * prevents. `scope` buckets endpoints separately so /mcp traffic and /api traffic don't
 * consume each other's budget.
 */
export async function checkRateLimit(env, request, scope = "compute") {
  const limiter = env && env.RATE_LIMITER;
  if (!limiter || typeof limiter.limit !== "function") return { ok: true, retryAfter: 0 };
  try {
    const outcome = await limiter.limit({ key: `${scope}:${clientKey(request)}` });
    if (outcome && outcome.success === false) return { ok: false, retryAfter: RATE_LIMIT.periodSeconds };
    return { ok: true, retryAfter: 0 };
  } catch {
    return { ok: true, retryAfter: 0 };          // fail open: never let the limiter be the outage
  }
}

// --------------------------------------------------------------------------- origin allowlist

// The canonical deployment. /skill emits a `curl | sh` installer and /install.md emits copy-paste
// `mcp add` commands, both built from a URL — so whatever host lands in there is a host the
// reader will execute against. url.origin is caller-controlled (any Host header, and any custom
// domain someone points at this Worker), which turned a reflected header into a shell script
// pointing at an arbitrary origin. Anything not on the allowlist falls back to this.
export const CANONICAL_ORIGIN = "https://fixmyslop.bihanikeshav.workers.dev";

const DEFAULT_ALLOWED_HOSTS = new Set([
  "fixmyslop.bihanikeshav.workers.dev",
  // local development
  "localhost", "127.0.0.1", "[::1]",
]);

const hostname = (value) => {
  try { return new URL(value.includes("://") ? value : `https://${value}`).hostname; } catch { return null; }
};

/**
 * installOrigin(url, env) → a trusted origin string.
 *
 * `env.SKILL_ORIGIN_ALLOWLIST` is a comma-separated list of extra hosts or origins, so a fork
 * or a custom domain can be added at deploy time without a code change. Ports are ignored in
 * the comparison (dev runs on :8787, :3000, … ), the host is what matters.
 */
export function installOrigin(url, env) {
  const extra = String((env && env.SKILL_ORIGIN_ALLOWLIST) || "")
    .split(",").map((s) => hostname(s.trim())).filter(Boolean);
  const allowed = new Set([...DEFAULT_ALLOWED_HOSTS, ...extra]);
  try {
    const u = typeof url === "string" ? new URL(url) : url;
    if (allowed.has(u.hostname)) return u.origin;
  } catch { /* fall through */ }
  return CANONICAL_ORIGIN;
}

// --------------------------------------------------------------------------- responses

/** Merge the security headers (and an optional Cache-Control) into a header bag. */
export const headersFor = (base, cacheControl) => ({
  ...base,
  ...SECURITY_HEADERS,
  ...(cacheControl ? { "Cache-Control": cacheControl } : {}),
});
