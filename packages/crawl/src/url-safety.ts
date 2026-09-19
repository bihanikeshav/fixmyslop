/**
 * Shared SSRF guard for anything that navigates a headless browser (or issues
 * a fetch) to a URL discovered from third-party content — an outbound link
 * on a directory/gallery listing page, a candidate site host, etc. A
 * discovered URL is untrusted input: without this check a crawler can be
 * steered at localhost, a cloud metadata endpoint, or another host on the
 * crawler's own private network.
 *
 * Used by sources.ts (discoverOutboundLinks), collect-sites.ts (toCandidate),
 * and as a pre-navigation guard in extract.ts (crawlUrl/withPage) and every
 * other crawl entry point that calls page.goto() on a discovered URL.
 */

/** Reject any hostname that is (or resolves textually to) a private/loopback/link-local/CGNAT IPv4 literal. */
function isUnsafeIPv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const parts = [m[1], m[2], m[3], m[4]].map((s) => Number(s));
  if (parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true; // malformed -> treat as unsafe
  const [a, b] = parts as [number, number, number, number];
  if (a === 0) return true; // "this network"
  if (a === 10) return true; // RFC1918
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local (incl. 169.254.169.254 cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 168) return true; // RFC1918
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT (RFC6598)
  if (a === 192 && b === 0 && (parts[2] === 0 || parts[2] === 2)) return true; // IETF protocol assignments / TEST-NET-1
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a === 198 && b === 51 && parts[2] === 100) return true; // TEST-NET-2
  if (a === 203 && b === 0 && parts[2] === 113) return true; // TEST-NET-3
  if (a >= 224) return true; // multicast (224-239) + reserved (240-255) + broadcast (255)
  return false;
}

/** Any bracketed/unbracketed IPv6 literal is rejected outright (loopback, ULA, link-local, mapped-v4, all of it). */
function isIPv6Literal(host: string): boolean {
  const h = host.replace(/^\[/, "").replace(/\]$/, "");
  return h.includes(":");
}

export interface UrlSafetyOptions {
  /** Extra host suffixes to reject beyond the built-in private/loopback rules. */
  extraBlockedSuffixes?: string[];
  /** Allowed protocols. Defaults to http/https only. */
  protocols?: string[];
}

export interface UrlSafetyResult {
  safe: boolean;
  reason?: string;
}

/**
 * Is `input` safe to navigate a browser / issue a fetch to? Pure, synchronous,
 * string-based (no DNS resolution — a host can still resolve to a private IP
 * at fetch time via DNS rebinding; this is a best-effort filter on the
 * *literal* URL, not a substitute for network-level egress controls).
 */
export function checkUrlSafety(input: string, options: UrlSafetyOptions = {}): UrlSafetyResult {
  let u: URL;
  try {
    u = new URL(input);
  } catch {
    return { safe: false, reason: "unparseable URL" };
  }

  const allowedProtocols = options.protocols ?? ["http:", "https:"];
  if (!allowedProtocols.includes(u.protocol)) {
    return { safe: false, reason: `protocol ${u.protocol} not allowed` };
  }

  if (u.username || u.password) {
    return { safe: false, reason: "credentials embedded in URL" };
  }

  const host = u.hostname.toLowerCase();
  if (!host) return { safe: false, reason: "empty host" };

  if (host === "localhost" || host === "localhost.localdomain") {
    return { safe: false, reason: "localhost" };
  }
  if (host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".localhost")) {
    return { safe: false, reason: "internal/local TLD" };
  }
  if (!host.includes(".") && !isIPv6Literal(host)) {
    // A bare hostname with no dot (and not an IPv6 literal) is almost always
    // an internal/intranet name (e.g. "printer", "jenkins", "grafana").
    return { safe: false, reason: "hostname has no dot (likely internal)" };
  }
  if (isIPv6Literal(host)) {
    return { safe: false, reason: "IPv6 literal" };
  }
  if (isUnsafeIPv4(host)) {
    return { safe: false, reason: "private/loopback/link-local/reserved IPv4 literal" };
  }

  for (const suffix of options.extraBlockedSuffixes ?? []) {
    const s = suffix.toLowerCase();
    if (host === s || host.endsWith(`.${s}`)) {
      return { safe: false, reason: `blocked suffix ${suffix}` };
    }
  }

  // Non-default ports are unusual for a public marketing site and are a
  // common way to reach an internal admin panel bound on an odd port; treat
  // them as a soft signal rather than a hard reject (some legitimate sites
  // do run on alt ports), so only flag genuinely suspicious ranges here by
  // leaving default behavior permissive. Callers who want a hard port
  // allowlist can pass their own protocols/host checks in addition.

  return { safe: true };
}

/** Convenience boolean wrapper around {@link checkUrlSafety}. */
export function isSafePublicUrl(input: string, options?: UrlSafetyOptions): boolean {
  return checkUrlSafety(input, options).safe;
}
