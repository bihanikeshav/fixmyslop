/**
 * Single source of truth for the crawler's User-Agent string. Every entry
 * point — TypeScript (via user-agent.d.mts) and the plain-JS
 * harvest-gallery-leads.mjs alike — imports this one constant so the
 * project presents one honest, identifiable UA everywhere instead of a
 * per-script guess (some of which used to masquerade as a bare desktop
 * Chrome UA).
 *
 * Format: real browser UA prefix (so sites that gate on browser-shaped UAs
 * still render) + an explicit bot token + version + a link back to the repo,
 * so any site owner who greps their logs can see exactly what crawled them
 * and why.
 */
export const CRAWLER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 fixmyslop/0.2 (+https://github.com/bihanikeshav/fixmyslop)";

/** The bot token portion of CRAWLER_UA, used to match our own group in robots.txt. */
export const CRAWLER_UA_TOKEN = "fixmyslop";
