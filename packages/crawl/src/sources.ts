/**
 * Source discovery — turn an AI-tool directory listing into a list of product
 * websites to crawl. Generic: load the listing, collect outbound links, drop the
 * directory's own domain + social/infra hosts, dedupe by host, return homepages.
 */

import type { Browser } from "playwright";
import { UA } from "./extract.js";

/** Hosts that are never the product we're after. */
const SOCIAL_INFRA = [
  "twitter.com", "x.com", "facebook.com", "linkedin.com", "youtube.com", "instagram.com",
  "github.com", "google.com", "apple.com", "play.google.com", "t.co", "reddit.com",
  "discord.com", "discord.gg", "medium.com", "producthunt.com", "tiktok.com", "pinterest.com",
  "gstatic.com", "googletagmanager.com", "cloudflare.com", "vercel.app", "notion.so",
];

/** A few AI-tool-directory "newest" listing pages to seed discovery. */
export const AI_DIRECTORIES: Record<string, string> = {
  futurepedia: "https://www.futurepedia.io/ai-tools",
  toolify: "https://www.toolify.ai/new",
  theresanaiforthat: "https://theresanaiforthat.com/new/",
};

export async function discoverOutboundLinks(
  browser: Browser,
  listingUrl: string,
  limit = 20,
): Promise<string[]> {
  const ctx = await browser.newContext({ userAgent: UA });
  const page = await ctx.newPage();
  let hrefs: string[] = [];
  try {
    await page.goto(listingUrl, { waitUntil: "domcontentloaded", timeout: 25000 });
    await page.waitForTimeout(2000);
    hrefs = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a[href]")).map((a) => (a as HTMLAnchorElement).href),
    );
  } catch {
    /* return whatever we got */
  } finally {
    await ctx.close();
  }

  const dirHost = hostOf(listingUrl);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const h of hrefs) {
    let host: string;
    try {
      const u = new URL(h);
      if (u.protocol !== "https:" && u.protocol !== "http:") continue;
      host = u.hostname.replace(/^www\./, "");
    } catch {
      continue;
    }
    if (host === dirHost || host.endsWith("." + dirHost)) continue;
    if (SOCIAL_INFRA.some((s) => host === s || host.endsWith("." + s))) continue;
    if (seen.has(host)) continue;
    seen.add(host);
    out.push(`https://${host}/`);
    if (out.length >= limit) break;
  }
  return out;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
