/**
 * Shared robots.txt parser + checker.
 *
 * Plain ESM JS (not TypeScript) so it can be imported directly, with no
 * loader, by both:
 *   - harvest-gallery-leads.mjs, which is executed with plain `node` and
 *     cannot import .ts source; and
 *   - every TS crawl entry point (extract.ts, crawl.ts, crawl-colors.ts,
 *     crawl-features.ts, collect-sites.ts, scrape-getdesign.ts), which runs
 *     under tsx and imports this file's types from the sibling robots.d.mts
 *     declaration file, transparently, via `import ... from "./robots.js"`
 *     (robots.ts re-exports this module).
 *
 * The pure parsing/matching functions (parseRobotsTxt, selectGroupRules,
 * isPathAllowed, evaluateRobotsAccess) take no network dependency and are
 * unit-tested directly. checkRobotsAllowed is the one network-touching
 * entry point; its fetch implementation and cache are both injectable so
 * tests never hit the network.
 */

/**
 * Parse a robots.txt body into an ordered list of groups, each with its
 * User-agent tokens (lowercased), Allow/Disallow rules in file order, and an
 * optional Crawl-delay. Unknown fields (Sitemap, etc.) are ignored.
 */
export function parseRobotsTxt(text) {
  const groups = [];
  let current = null;
  let lastFieldWasUserAgent = false;
  const lines = String(text || "").split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (field === "user-agent") {
      if (!current || !lastFieldWasUserAgent) {
        current = { agents: [], rules: [], crawlDelay: null };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastFieldWasUserAgent = true;
      continue;
    }
    lastFieldWasUserAgent = false;
    if (field === "allow" || field === "disallow") {
      if (!current) {
        current = { agents: ["*"], rules: [], crawlDelay: null };
        groups.push(current);
      }
      current.rules.push({ type: field, path: value });
    } else if (field === "crawl-delay") {
      if (!current) {
        current = { agents: ["*"], rules: [], crawlDelay: null };
        groups.push(current);
      }
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) current.crawlDelay = n;
    }
    // Sitemap / other fields: ignored, not relevant to allow/disallow.
  }
  return groups;
}

/**
 * Pick the best-matching group for `uaToken`: an exact token match first
 * (our own UA token, e.g. "fixmyslop"), falling back to the wildcard "*"
 * group, else null (no applicable group -> caller should treat as allow-all).
 */
export function selectGroupRules(groups, uaToken) {
  const token = String(uaToken || "").toLowerCase();
  const exact = groups.find((g) => g.agents.includes(token));
  if (exact) return exact;
  const wildcard = groups.find((g) => g.agents.includes("*"));
  return wildcard || null;
}

/**
 * Is `path` allowed by `rules` (from a single selected group)? Longest
 * matching prefix wins; an empty Disallow value ("Disallow:") means "no
 * restriction" per the de-facto spec and is skipped. Equal-length
 * Allow/Disallow matches resolve in favor of Allow (the common convention
 * major crawlers use).
 */
export function isPathAllowed(rules, path) {
  const p = path || "/";
  if (!rules || rules.length === 0) return true;
  let best = null; // { type, length }
  for (const rule of rules) {
    if (rule.type === "disallow" && rule.path === "") continue; // "Disallow:" = allow all
    if (!p.startsWith(rule.path)) continue;
    const length = rule.path.length;
    if (!best || length > best.length || (length === best.length && rule.type === "allow")) {
      best = { type: rule.type, length };
    }
  }
  if (!best) return true;
  return best.type === "allow";
}

/** Parse + select + match in one call, given raw robots.txt text. */
export function evaluateRobotsAccess(robotsText, uaToken, pathAndQuery) {
  const groups = parseRobotsTxt(robotsText);
  const group = selectGroupRules(groups, uaToken);
  const rules = group ? group.rules : [];
  const allowed = isPathAllowed(rules, pathAndQuery || "/");
  const crawlDelay = group ? group.crawlDelay : null;
  return { allowed, crawlDelay };
}

/**
 * Fetch robots.txt for `origin`. Never throws: on any error (network,
 * timeout, non-2xx) returns { ok: false }, which callers treat as fail-open
 * (no robots.txt => nothing disallowed).
 */
export async function fetchRobotsTxt(origin, options = {}) {
  const { fetchImpl = fetch, ua = "fixmyslop", timeoutMs = 8000 } = options;
  try {
    const res = await fetchImpl(`${origin}/robots.txt`, {
      headers: { "user-agent": ua },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return { ok: false, status: res.status };
    const text = await res.text();
    return { ok: true, text };
  } catch (error) {
    return { ok: false, error: String((error && error.message) || error) };
  }
}

/**
 * High-level, cached robots.txt check for a single URL. Fail-open (allowed)
 * when robots.txt can't be fetched/parsed (network error, timeout, non-2xx);
 * fail-closed (disallowed) only on an explicit matching Disallow rule.
 *
 * `cache` is a Map<origin, {text, failOpen}> so a single crawl process only
 * fetches each host's robots.txt once; pass your own Map in tests to avoid
 * cross-test leakage, or the module-level default for normal crawler use.
 */
const DEFAULT_CACHE = new Map();
export async function checkRobotsAllowed(url, options = {}) {
  const {
    ua = "fixmyslop",
    uaToken = "fixmyslop",
    fetchImpl = fetch,
    timeoutMs = 8000,
    cache = DEFAULT_CACHE,
    ignoreRobots = false,
  } = options;

  if (ignoreRobots) return { allowed: true, reason: "--ignore-robots" };

  let origin, pathAndQuery;
  try {
    const u = new URL(url);
    origin = u.origin;
    pathAndQuery = u.pathname + u.search;
  } catch {
    return { allowed: true, reason: "unparseable URL; fail-open" };
  }

  let cached = cache.get(origin);
  if (!cached) {
    const fetched = await fetchRobotsTxt(origin, { fetchImpl, ua, timeoutMs });
    cached = fetched.ok ? { text: fetched.text, failOpen: false } : { text: "", failOpen: true };
    cache.set(origin, cached);
  }
  if (cached.failOpen) return { allowed: true, reason: "robots.txt unavailable; fail-open" };

  const { allowed, crawlDelay } = evaluateRobotsAccess(cached.text, uaToken, pathAndQuery);
  return { allowed, crawlDelay, reason: allowed ? undefined : "disallowed by robots.txt" };
}
