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
  const existing = await loadExistingProfiles();
  const existingUrls = new Set(existing.map((p) => p.url));

  const fresh = await withBrowser(async (browser) => {
    const urls = [...args.urls];
    for (const dir of args.directories) {
      const listing = AI_DIRECTORIES[dir] ?? dir;
      console.log(`Discovering product sites from ${listing} ...`);
      const found = await discoverOutboundLinks(browser, listing, args.limit);
      console.log(`  found ${found.length} candidate sites`);
      urls.push(...found);
    }
    // Dedupe, and skip anything already in the corpus (accumulate, don't re-crawl).
    const seen = new Set(existingUrls);
    const todo: string[] = [];
    for (const u of urls) if (!seen.has(u)) { seen.add(u); todo.push(u); }

    const results: SiteProfile[] = [];
    for (const url of todo) {
      const p = await crawlUrl(browser, url);
      const heroReal = p.heroFont && indexIds.has(slug(p.heroFont)) ? "" : " (non-GF)";
      console.log(p.ok ? `  ✓ ${url}  hero=${p.heroFont}${p.heroFont ? heroReal : ""}  body=${p.bodyFont}` : `  ✗ ${url}  ${p.error}`);
      results.push(p);
    }
    return results;
  });

  const profiles = [...existing, ...fresh]; // accumulate across runs

  // Aggregate role-aware observations over the FULL corpus.
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
  console.log(`\nDone. +${fresh.length} new this run. Corpus: ${ok}/${profiles.length} sites.`);
  const topDisplay = [...display.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  console.log("Most common HERO/HEADING fonts in the wild:");
  for (const [id, c] of topDisplay) console.log(`   ${String(c).padStart(2)}  ${id}${indexIds.has(id) ? "" : "  (non-Google)"}`);
}

interface Args {
  urls: string[];
  directories: string[];
  limit: number;
}

async function loadExistingProfiles(): Promise<SiteProfile[]> {
  try {
    return JSON.parse(await readFile(resolve(DATA_DIR, "crawl-profiles.json"), "utf8")) as SiteProfile[];
  } catch {
    return [];
  }
}

function parseArgs(argv: string[]): Args {
  const out: Args = { urls: [], directories: [], limit: 15 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--urls") out.urls = (argv[++i] ?? "").split(",").filter(Boolean);
    else if (argv[i] === "--directory") out.directories.push(argv[++i] ?? "");
    else if (argv[i] === "--directories") out.directories.push(...(argv[++i] ?? "").split(",").filter(Boolean));
    else if (argv[i] === "--limit") out.limit = Number(argv[++i] ?? "15");
  }
  out.directories = out.directories.filter(Boolean);
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
