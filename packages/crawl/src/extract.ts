/**
 * Headless-Chromium extraction. Renders a URL (so JS-rendered + self-hosted fonts
 * can't hide), reads computed font-family off the live DOM, and runs the pure
 * analyzer. Images/media/font *files* are blocked for speed — we read the
 * font-family string, not the rendered glyphs, so the files aren't needed.
 */

import { chromium, type Browser, type Page } from "playwright";
import { analyzePage, type CrawlElement, type PageFontProfile } from "./analyze.js";
import { isSafePublicUrl } from "./url-safety.js";
import { CRAWLER_UA, CRAWLER_UA_TOKEN } from "./user-agent.mjs";
import { checkRobotsAllowed } from "./robots.js";

/** Centralized crawler UA — see user-agent.mjs for the canonical string used by every entry point. */
export const UA = CRAWLER_UA;

export interface SiteProfile extends PageFontProfile {
  url: string;
  ok: boolean;
  error?: string;
}

export async function withBrowser<T>(fn: (b: Browser) => Promise<T>): Promise<T> {
  const browser = await chromium.launch({ headless: true });
  try {
    return await fn(browser);
  } finally {
    await browser.close();
  }
}

/**
 * Navigate with a single bounded retry. Playwright's page.goto() only
 * rejects on navigation-level failures — timeouts and network errors
 * (net::ERR_*, DNS failure, connection reset) — never on an HTTP 4xx/5xx
 * response (those resolve normally with a non-ok status), so a blanket
 * "retry on thrown error" here never retries a real 4xx: there's nothing to
 * retry on since a 4xx doesn't throw. One retry, small fixed backoff — this
 * is meant to absorb a flaky TLS handshake / transient DNS hiccup, not to
 * hammer a genuinely down site.
 */
async function gotoWithRetry(page: Page, url: string, timeoutMs: number): Promise<void> {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  } catch (e) {
    const msg = (e as Error).message || "";
    const isTimeoutOrNetError = /Timeout|net::ERR_|ECONNRESET|ENOTFOUND|EAI_AGAIN/i.test(msg);
    if (!isTimeoutOrNetError) throw e;
    await new Promise((r) => setTimeout(r, 800));
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  }
}

export async function crawlUrl(
  browser: Browser,
  url: string,
  timeoutMs = 20000,
  opts: { ignoreRobots?: boolean } = {},
): Promise<SiteProfile> {
  if (!isSafePublicUrl(url)) {
    return {
      url, ok: false, error: "blocked: unsafe/private/internal URL",
      heroFont: null, headingFont: null, bodyFont: null, monoFont: null, allFonts: [],
    };
  }
  const robots = await checkRobotsAllowed(url, { ua: UA, uaToken: CRAWLER_UA_TOKEN, ignoreRobots: opts.ignoreRobots });
  if (!robots.allowed) {
    return {
      url, ok: false, error: "blocked: disallowed by robots.txt",
      heroFont: null, headingFont: null, bodyFont: null, monoFont: null, allFonts: [],
    };
  }
  const context = await browser.newContext({ userAgent: UA, viewport: { width: 1366, height: 900 } });
  // Block heavy resources we don't need; keep CSS + JS (they carry font-family).
  await context.route("**/*", (route) => {
    const type = route.request().resourceType();
    if (type === "image" || type === "media" || type === "font") return route.abort();
    return route.continue();
  });
  const page = await context.newPage();
  try {
    await gotoWithRetry(page, url, timeoutMs);
    await page.waitForTimeout(1200); // let webfonts/JS settle
    const elements = await extractElements(page);
    const profile = analyzePage(elements);
    return { url, ok: true, ...profile };
  } catch (e) {
    return {
      url, ok: false, error: (e as Error).message.slice(0, 160),
      heroFont: null, headingFont: null, bodyFont: null, monoFont: null, allFonts: [],
    };
  } finally {
    await context.close();
  }
}

/** Open a page (shared context setup) and run `fn` against it. Null on failure. */
export async function withPage<T>(
  browser: Browser,
  url: string,
  fn: (page: Page) => Promise<T>,
  timeoutMs = 20000,
  opts: { ignoreRobots?: boolean } = {},
): Promise<T | null> {
  if (!isSafePublicUrl(url)) {
    if (process.env.CRAWL_DEBUG) console.error(`  [withPage] blocked unsafe URL: ${url}`);
    return null;
  }
  const robots = await checkRobotsAllowed(url, { ua: UA, uaToken: CRAWLER_UA_TOKEN, ignoreRobots: opts.ignoreRobots });
  if (!robots.allowed) {
    if (process.env.CRAWL_DEBUG) console.error(`  [withPage] blocked by robots.txt: ${url}`);
    return null;
  }
  const context = await browser.newContext({ userAgent: UA, viewport: { width: 1366, height: 900 } });
  // Shim the esbuild/tsx __name helper that decorates serialized evaluate functions.
  await context.addInitScript({ content: "window.__name=window.__name||function(f){return f;};" });
  await context.route("**/*", (route) => {
    const type = route.request().resourceType();
    if (type === "image" || type === "media" || type === "font") return route.abort();
    return route.continue();
  });
  const page = await context.newPage();
  try {
    await gotoWithRetry(page, url, timeoutMs);
    await page.waitForTimeout(1200);
    return await fn(page);
  } catch (e) {
    if (process.env.CRAWL_DEBUG) console.error(`  [withPage] ${url}: ${(e as Error).message.slice(0, 200)}`);
    return null;
  } finally {
    await context.close();
  }
}

export async function extractElements(page: Page): Promise<CrawlElement[]> {
  return page.evaluate(() => {
    const vh = window.innerHeight;
    const out: CrawlElement[] = [];
    const nodes = document.querySelectorAll(
      "h1,h2,h3,h4,h5,h6,p,a,span,li,button,code,pre,blockquote,div,figcaption,label",
    );
    for (const node of Array.from(nodes)) {
      let text = "";
      for (const c of Array.from(node.childNodes)) {
        if (c.nodeType === 3) text += c.textContent ?? "";
      }
      text = text.trim();
      if (text.length < 2) continue;
      const cs = getComputedStyle(node as Element);
      if (cs.visibility === "hidden" || cs.display === "none") continue;
      const rect = (node as Element).getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      out.push({
        fontFamilyStack: cs.fontFamily,
        fontSizePx: parseFloat(cs.fontSize) || 0,
        fontWeight: parseInt(cs.fontWeight) || 400,
        textLength: text.length,
        tag: (node as Element).tagName.toLowerCase(),
        aboveFold: rect.top < vh && rect.top >= -rect.height,
      });
      if (out.length >= 600) break;
    }
    return out;
  });
}
