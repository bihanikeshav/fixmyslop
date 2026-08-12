/**
 * Site-list collector — gather the LARGEST possible corpus of AI-product /
 * AI-style websites (the "slop" corpus we measure overuse against).
 *
 * COLLECTION ONLY: this does NOT feature-crawl or extract colors. It gathers
 * candidate product homepage URLs from several sources, normalizes to origin,
 * dedupes by host, filters out social/infra/noise, validates reachability with
 * a quick GET (HEAD fallback), and writes data/site-list.json.
 *
 *   npx tsx src/collect-sites.ts
 *   npx tsx src/collect-sites.ts --no-reach   # skip reachability (faster)
 *
 * Every source runs inside try/catch and continues on failure — a blocked or
 * dead source never aborts the run. It does NOT touch the font-crawl outputs
 * (crawl-profiles.json / observations.crawl.json).
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { Browser } from "playwright";
import { withBrowser, UA } from "./extract.js";
import { discoverOutboundLinks, AI_DIRECTORIES } from "./sources.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(HERE, "../../../data");

interface Candidate {
  url: string;
  host: string;
  source: string;
}

/**
 * Hosts / host-suffixes that are never the product we're after: social,
 * analytics, ad/affiliate infra, CDNs, the directories' own domains, code
 * hosting, doc/blog platforms, and placeholder app hosts.
 */
const NOISE = [
  // social / community
  "twitter.com", "x.com", "facebook.com", "fb.com", "linkedin.com", "youtube.com",
  "youtu.be", "instagram.com", "tiktok.com", "pinterest.com", "reddit.com",
  "redd.it", "t.me", "telegram.org", "telegram.me", "discord.com", "discord.gg",
  "whatsapp.com", "wa.me", "threads.net", "mastodon.social", "bsky.app",
  "snapchat.com", "twitch.tv", "vk.com", "weibo.com",
  // code / dev infra
  "github.com", "github.io", "gitlab.com", "bitbucket.org", "raw.githubusercontent.com",
  "githubusercontent.com", "gist.github.com", "npmjs.com", "pypi.org", "sourceforge.net",
  "stackoverflow.com", "huggingface.co",
  // doc / blog / content platforms
  "medium.com", "substack.com", "notion.so", "notion.site", "wordpress.com",
  "wordpress.org", "blogspot.com", "wix.com", "squarespace.com", "webflow.io",
  "gitbook.io", "gitbook.com", "readme.io", "readthedocs.io", "readthedocs.org",
  "docs.google.com", "forms.gle", "wikipedia.org", "wikimedia.org", "dev.to",
  "hashnode.dev", "hashnode.com", "ghost.io", "beehiiv.com",
  // ads / affiliate / analytics / marketing infra
  "buysellads.com", "getrewardful.com", "rewardful.com", "carbonads.net",
  "doubleclick.net", "googletagmanager.com", "google-analytics.com",
  "googleadservices.com", "googlesyndication.com", "hubspot.com", "hs-sites.com",
  "mailchimp.com", "convertkit.com", "typeform.com", "calendly.com", "cal.com",
  "stripe.com", "paypal.com", "gumroad.com", "lemonsqueezy.com", "patreon.com",
  "ko-fi.com", "buymeacoffee.com", "linktr.ee", "bit.ly", "tinyurl.com",
  "zapier.com", "intercom.com", "crisp.chat", "tawk.to",
  // big platforms / infra / CDNs (rarely the product itself)
  "google.com", "goo.gl", "apple.com", "apps.apple.com", "itunes.apple.com",
  "play.google.com", "microsoft.com", "azure.com", "amazon.com", "aws.amazon.com",
  "amazonaws.com", "cloudflare.com", "gstatic.com", "googleapis.com", "fbcdn.net",
  "cdn.jsdelivr.net", "jsdelivr.net", "unpkg.com", "fontawesome.com", "gravatar.com",
  // placeholder app hosts (deploy targets, not branded products)
  "vercel.app", "netlify.app", "netlify.com", "herokuapp.com", "pages.dev",
  "web.app", "firebaseapp.com", "github.dev", "replit.app", "repl.co",
  "streamlit.app", "onrender.com", "fly.dev", "glitch.me", "surge.sh",
  // directory / aggregator self-domains (also added dynamically below)
  "producthunt.com", "ph-files.imgix.net", "futurepedia.io", "toolify.ai",
  "theresanaiforthat.com", "g2.com", "capterra.com", "trustpilot.com",
  "saashub.com", "alternativeto.net", "slashdot.org", "crunchbase.com",
];

const isNoise = (host: string): boolean =>
  NOISE.some((n) => host === n || host.endsWith("." + n));

const normHost = (u: URL): string => u.hostname.replace(/^www\./, "").toLowerCase();

/** Try to turn an arbitrary href into a clean https origin candidate. */
function toCandidate(href: string, source: string): Candidate | null {
  let u: URL;
  try {
    u = new URL(href);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = normHost(u);
  if (!host || !host.includes(".")) return null;
  if (host === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return null;
  if (isNoise(host)) return null;
  return { url: `https://${host}/`, host, source };
}

/* ------------------------------------------------------------------ */
/* Source 1: AI directories (futurepedia, toolify, theresanaiforthat)  */
/* ------------------------------------------------------------------ */

/** Extra listing pages per directory to maximize yield. */
const DIR_PAGES: Record<string, string[]> = {
  futurepedia: [
    "https://www.futurepedia.io/ai-tools",
    "https://www.futurepedia.io/ai-tools?sort=newest",
    "https://www.futurepedia.io/ai-tools?sort=popular",
    "https://www.futurepedia.io/ai-tools?sort=verified",
    "https://www.futurepedia.io/ai-tools/productivity",
    "https://www.futurepedia.io/ai-tools/marketing",
    "https://www.futurepedia.io/ai-tools/design",
    "https://www.futurepedia.io/ai-tools/code",
  ],
  toolify: [
    "https://www.toolify.ai/new",
    "https://www.toolify.ai/Best-AI-Tools",
    "https://www.toolify.ai/category",
    "https://www.toolify.ai/most-saved-AI",
    "https://www.toolify.ai/most-used-AI",
    "https://www.toolify.ai/category/text-writing",
    "https://www.toolify.ai/category/image-generation-editing",
    "https://www.toolify.ai/category/ai-detector",
  ],
  theresanaiforthat: [
    "https://theresanaiforthat.com/new/",
    "https://theresanaiforthat.com/",
    "https://theresanaiforthat.com/trending/",
    "https://theresanaiforthat.com/most-saved/",
    "https://theresanaiforthat.com/period/this-month/",
  ],
};

async function fromDirectories(browser: Browser, perPage: number): Promise<Candidate[]> {
  const out: Candidate[] = [];
  for (const [dir, pages] of Object.entries(DIR_PAGES)) {
    for (const page of pages) {
      try {
        const found = await discoverOutboundLinks(browser, page, perPage);
        let kept = 0;
        for (const href of found) {
          const c = toCandidate(href, `dir:${dir}`);
          if (c) { out.push(c); kept++; }
        }
        console.log(`  [dir:${dir}] ${page} -> ${found.length} raw, ${kept} kept`);
      } catch (e) {
        console.log(`  [dir:${dir}] ${page} FAILED: ${(e as Error).message.slice(0, 120)}`);
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Source 2: Product Hunt (listing + topic + leaderboard, follow 1x)   */
/* ------------------------------------------------------------------ */

function recentDailyLeaderboards(n: number): string[] {
  const urls: string[] = [];
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1); // yesterday: today's board may be empty
  for (let i = 0; i < n; i++) {
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    urls.push(`https://www.producthunt.com/leaderboard/daily/${y}/${m}/${day}`);
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return urls;
}

const PH_PAGES = [
  "https://www.producthunt.com/topics/artificial-intelligence",
  "https://www.producthunt.com/categories/artificial-intelligence",
  "https://www.producthunt.com/topics/developer-tools",
  "https://www.producthunt.com/topics/design-tools",
  "https://www.producthunt.com/topics/marketing",
  "https://www.producthunt.com/topics/productivity",
  ...recentDailyLeaderboards(5),
];

/**
 * Product Hunt rewrites real outbound links to /r/ redirects and most links on
 * listing pages are internal (/posts/<slug>, /products/<slug>). We:
 *   1) collect internal product-detail paths from each listing page, and
 *   2) visit a bounded number of detail pages and pull the external "Visit"
 *      link (PH exposes it as an absolute https link, often via /r/ redirect).
 * If PH blocks us, we capture whatever external links the listing pages held
 * and NOTE the shortfall.
 */
async function fromProductHunt(
  browser: Browser,
  maxDetail: number,
): Promise<{ candidates: Candidate[]; note: string }> {
  const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 1366, height: 900 } });
  const candidates: Candidate[] = [];
  const detailPaths = new Set<string>();
  let listingExternal = 0;
  let blocked = false;

  try {
    for (const url of PH_PAGES) {
      try {
        const page = await ctx.newPage();
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
        await page.waitForTimeout(2500);
        const hrefs = await page.evaluate(() =>
          Array.from(document.querySelectorAll("a[href]")).map((a) => (a as HTMLAnchorElement).href),
        );
        await page.close();
        if (hrefs.length === 0) { blocked = true; continue; }
        for (const h of hrefs) {
          // internal product-detail pages to follow
          const m = h.match(/producthunt\.com\/(posts|products)\/[a-z0-9-]+/i);
          if (m) { detailPaths.add(`https://www.producthunt.com/${m[1]}/${h.split("/").pop()!.split("?")[0]}`); continue; }
          // an external link that slipped onto the listing
          const c = toCandidate(h, "producthunt");
          if (c) { candidates.push(c); listingExternal++; }
        }
        console.log(`  [producthunt] ${url} -> ${hrefs.length} links, ${detailPaths.size} detail so far`);
      } catch (e) {
        console.log(`  [producthunt] ${url} FAILED: ${(e as Error).message.slice(0, 120)}`);
      }
    }

    // Follow a bounded number of detail pages for the real "Visit" link.
    const toVisit = [...detailPaths].slice(0, maxDetail);
    let detailExternal = 0;
    for (const dp of toVisit) {
      try {
        const page = await ctx.newPage();
        await page.goto(dp, { waitUntil: "domcontentloaded", timeout: 20000 });
        await page.waitForTimeout(1500);
        // External links on a PH detail page: absolute, non-PH. Prefer the /r/ redirect target if resolvable.
        const ext = await page.evaluate(() => {
          const anchors = Array.from(document.querySelectorAll("a[href]")) as HTMLAnchorElement[];
          return anchors.map((a) => ({ href: a.href, text: (a.textContent || "").trim().toLowerCase() }));
        });
        await page.close();
        for (const { href } of ext) {
          if (/producthunt\.com\/(posts|products|topics|categories|@|collections)/i.test(href)) continue;
          const c = toCandidate(href, "producthunt");
          if (c) { candidates.push(c); detailExternal++; }
        }
      } catch {
        /* skip this detail page */
      }
    }
    console.log(`  [producthunt] listing-external=${listingExternal}, visited ${toVisit.length} detail pages -> ${detailExternal} external`);
  } finally {
    await ctx.close();
  }

  const note = blocked
    ? "Product Hunt returned 0 links on some listing pages (likely bot-blocked); captured what rendered."
    : `Product Hunt OK: ${detailPaths.size} detail pages found.`;
  return { candidates, note };
}

/* ------------------------------------------------------------------ */
/* Source 3: GitHub "awesome" AI-tool lists (raw README markdown)       */
/* ------------------------------------------------------------------ */

const AWESOME_LISTS: Array<{ name: string; raw: string }> = [
  { name: "mahseema/awesome-ai-tools", raw: "https://raw.githubusercontent.com/mahseema/awesome-ai-tools/main/README.md" },
  { name: "ai-collection/ai-collection", raw: "https://raw.githubusercontent.com/ai-collection/ai-collection/main/README.md" },
  { name: "steven2358/awesome-generative-ai", raw: "https://raw.githubusercontent.com/steven2358/awesome-generative-ai/master/README.md" },
  { name: "Hannibal046/Awesome-LLM", raw: "https://raw.githubusercontent.com/Hannibal046/Awesome-LLM/main/README.md" },
  { name: "eudk/awesome-ai-tools", raw: "https://raw.githubusercontent.com/eudk/awesome-ai-tools/main/README.md" },
];

async function fromAwesomeLists(): Promise<Candidate[]> {
  const out: Candidate[] = [];
  // Markdown link target: [text](http...) and bare <http...> and raw http...
  const linkRe = /\((https?:\/\/[^\s)]+)\)|<(https?:\/\/[^\s>]+)>|(?:^|\s)(https?:\/\/[^\s)>\]]+)/g;
  for (const list of AWESOME_LISTS) {
    try {
      const res = await fetch(list.raw, {
        headers: { "user-agent": UA, accept: "text/plain,text/markdown,*/*" },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) { console.log(`  [awesome:${list.name}] HTTP ${res.status}`); continue; }
      const md = await res.text();
      let kept = 0;
      let m: RegExpExecArray | null;
      while ((m = linkRe.exec(md)) !== null) {
        const href = (m[1] || m[2] || m[3] || "").replace(/[.,;]+$/, "");
        const c = toCandidate(href, `awesome:${list.name}`);
        if (c) { out.push(c); kept++; }
      }
      console.log(`  [awesome:${list.name}] ${md.length} bytes -> ${kept} kept`);
    } catch (e) {
      console.log(`  [awesome:${list.name}] FAILED: ${(e as Error).message.slice(0, 120)}`);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Source 4: existing 44 from data/crawl-profiles.json                 */
/* ------------------------------------------------------------------ */

async function fromExistingProfiles(): Promise<Candidate[]> {
  try {
    const raw = await readFile(resolve(DATA_DIR, "crawl-profiles.json"), "utf8");
    const profiles = JSON.parse(raw) as Array<{ url: string }>;
    const out: Candidate[] = [];
    for (const p of profiles) {
      const c = toCandidate(p.url, "existing-corpus");
      if (c) out.push(c);
    }
    return out;
  } catch (e) {
    console.log(`  [existing] FAILED: ${(e as Error).message.slice(0, 120)}`);
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* Reachability: quick GET (HEAD fallback), keep 2xx/3xx HTML          */
/* ------------------------------------------------------------------ */

async function isReachable(url: string): Promise<boolean> {
  const headers = { "user-agent": UA, accept: "text/html,application/xhtml+xml,*/*" };
  // GET first (some servers reject HEAD); we don't read the body fully.
  try {
    const res = await fetch(url, {
      method: "GET",
      headers,
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
    });
    if (res.status >= 200 && res.status < 400) {
      const ct = res.headers.get("content-type") || "";
      // keep HTML (or unknown content-type — many minimal servers omit it)
      if (ct === "" || /text\/html|application\/xhtml/i.test(ct)) {
        try { await res.body?.cancel(); } catch { /* ignore */ }
        return true;
      }
    }
    try { await res.body?.cancel(); } catch { /* ignore */ }
  } catch {
    // fall through to HEAD
  }
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers,
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });
    return res.status >= 200 && res.status < 400;
  } catch {
    return false;
  }
}

/** Bounded-concurrency map. */
async function pool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) break;
      results[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return results;
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const doReach = !args.includes("--no-reach");
  const perPage = 150; // HIGH limit per directory listing page

  // Add the directories' own first-party hosts to the noise filter dynamically.
  for (const url of Object.values(AI_DIRECTORIES)) {
    try { NOISE.push(normHost(new URL(url))); } catch { /* ignore */ }
  }

  const bySource = new Map<string, number>();
  const allRaw: Candidate[] = [];
  const sourceNotes: string[] = [];

  // Sources that need a browser.
  await withBrowser(async (browser) => {
    console.log("== Source 1: AI directories ==");
    try {
      const dirC = await fromDirectories(browser, perPage);
      allRaw.push(...dirC);
    } catch (e) {
      sourceNotes.push(`directories: FAILED ${(e as Error).message.slice(0, 120)}`);
    }

    console.log("\n== Source 2: Product Hunt ==");
    try {
      const { candidates, note } = await fromProductHunt(browser, 60);
      allRaw.push(...candidates);
      sourceNotes.push(note);
    } catch (e) {
      const msg = `producthunt: FAILED ${(e as Error).message.slice(0, 120)}`;
      console.log("  " + msg);
      sourceNotes.push(msg);
    }
  });

  console.log("\n== Source 3: GitHub awesome lists ==");
  try {
    const awesome = await fromAwesomeLists();
    allRaw.push(...awesome);
  } catch (e) {
    sourceNotes.push(`awesome: FAILED ${(e as Error).message.slice(0, 120)}`);
  }

  console.log("\n== Source 4: existing corpus ==");
  const existing = await fromExistingProfiles();
  allRaw.push(...existing);
  console.log(`  [existing] ${existing.length} from crawl-profiles.json`);

  // Tally raw by source.
  for (const c of allRaw) {
    const key = c.source.split(":")[0];
    bySource.set(key, (bySource.get(key) ?? 0) + 1);
  }

  // Dedupe by host (first source wins). Re-filter noise (dir self-hosts added late).
  const byHost = new Map<string, Candidate>();
  for (const c of allRaw) {
    if (isNoise(c.host)) continue;
    if (!byHost.has(c.host)) byHost.set(c.host, c);
  }
  const deduped = [...byHost.values()];

  console.log("\n== Totals ==");
  console.log(`  raw gathered: ${allRaw.length}`);
  for (const [src, n] of [...bySource.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${src.padEnd(14)} ${n}`);
  }
  console.log(`  after dedupe (by host, noise-filtered): ${deduped.length}`);

  // Reachability.
  let final = deduped;
  if (doReach) {
    console.log(`\n== Reachability (GET->HEAD, conc=12) over ${deduped.length} hosts ==`);
    const flags = await pool(deduped, 12, (c) => isReachable(c.url));
    final = deduped.filter((_, i) => flags[i]);
    console.log(`  reachable (2xx/3xx HTML): ${final.length} / ${deduped.length}`);
  } else {
    console.log("\n== Reachability skipped (--no-reach) ==");
  }

  // Write output.
  const outPath = resolve(DATA_DIR, "site-list.json");
  const payload = final
    .map(({ url, host, source }) => ({ url, host, source }))
    .sort((a, b) => a.host.localeCompare(b.host));
  await writeFile(outPath, JSON.stringify(payload, null, 2));

  // Final summary.
  const finalBySource = new Map<string, number>();
  for (const c of final) {
    const key = c.source.split(":")[0];
    finalBySource.set(key, (finalBySource.get(key) ?? 0) + 1);
  }
  console.log("\n=================== SUMMARY ===================");
  console.log(`output: ${outPath}`);
  console.log(`total raw gathered: ${allRaw.length}`);
  console.log(`after dedupe:       ${deduped.length}`);
  console.log(`after reachability: ${final.length}${doReach ? "" : " (not checked)"}`);
  console.log("by source (final):");
  for (const [src, n] of [...finalBySource.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${src.padEnd(14)} ${n}`);
  }
  console.log("notes:");
  for (const n of sourceNotes) console.log(`    - ${n}`);
  const sample = payload.slice(0, 20).map((p) => p.host);
  console.log("~20 sample hosts:");
  for (const h of sample) console.log(`    ${h}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
