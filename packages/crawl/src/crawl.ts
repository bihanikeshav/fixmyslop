/**
 * Crawl CLI — role-aware font extraction over real product sites.
 *
 *   npx tsx src/crawl.ts --urls https://a.com,https://b.com
 *   npx tsx src/crawl.ts --directory futurepedia --limit 15
 *
 * Writes data/crawl-profiles.json (per-site roles) and data/observations.crawl.json
 * (aggregated role-aware saturation observations, signal: "crawl").
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { Observation } from "@ai-slop-font/core";
import { withBrowser, crawlUrl, type SiteProfile } from "./extract.js";
import { discoverOutboundLinks, AI_DIRECTORIES } from "./sources.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(HERE, "../../../data");
const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const indexIds = await loadIndexIds();

  const profiles = await withBrowser(async (browser) => {
    let urls = args.urls;
    if (args.directory) {
      const listing = AI_DIRECTORIES[args.directory] ?? args.directory;
      console.log(`Discovering product sites from ${listing} ...`);
      urls = await discoverOutboundLinks(browser, listing, args.limit);
      console.log(`  found ${urls.length} candidate sites`);
    }
    const results: SiteProfile[] = [];
    for (const url of urls) {
      const p = await crawlUrl(browser, url);
      const heroReal = p.heroFont && indexIds.has(slug(p.heroFont)) ? "" : " (non-GF)";
      console.log(p.ok ? `  ✓ ${url}  hero=${p.heroFont}${p.heroFont ? heroReal : ""}  body=${p.bodyFont}` : `  ✗ ${url}  ${p.error}`);
      results.push(p);
    }
    return results;
  });

  // Aggregate role-aware observations.
  const display = new Map<string, number>();
  const body = new Map<string, number>();
  for (const p of profiles) {
    if (!p.ok) continue;
    for (const f of [p.heroFont, p.headingFont]) if (f) display.set(slug(f), (display.get(slug(f)) ?? 0) + 1);
    if (p.bodyFont) body.set(slug(p.bodyFont), (body.get(slug(p.bodyFont)) ?? 0) + 1);
  }
  const observations: Observation[] = [
    ...[...display].map(([fontId, count]): Observation => ({ fontId, role: "display", window: 0, count, signal: "crawl" })),
    ...[...body].map(([fontId, count]): Observation => ({ fontId, role: "body", window: 0, count, signal: "crawl" })),
  ];

  await writeFile(resolve(DATA_DIR, "crawl-profiles.json"), JSON.stringify(profiles, null, 2));
  await writeFile(resolve(DATA_DIR, "observations.crawl.json"), JSON.stringify(observations, null, 2));

  const ok = profiles.filter((p) => p.ok).length;
  console.log(`\nDone. ${ok}/${profiles.length} sites crawled.`);
  const topDisplay = [...display.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  console.log("Most common HERO/HEADING fonts in the wild:");
  for (const [id, c] of topDisplay) console.log(`   ${String(c).padStart(2)}  ${id}${indexIds.has(id) ? "" : "  (non-Google)"}`);
}

interface Args {
  urls: string[];
  directory?: string;
  limit: number;
}

function parseArgs(argv: string[]): Args {
  const out: Args = { urls: [], limit: 15 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--urls") out.urls = (argv[++i] ?? "").split(",").filter(Boolean);
    else if (argv[i] === "--directory") out.directory = argv[++i];
    else if (argv[i] === "--limit") out.limit = Number(argv[++i] ?? "15");
  }
  return out;
}

async function loadIndexIds(): Promise<Set<string>> {
  try {
    const idx = JSON.parse(await readFile(resolve(DATA_DIR, "fonts.index.json"), "utf8")) as Array<{ id: string }>;
    return new Set(idx.map((f) => f.id));
  } catch {
    return new Set();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
