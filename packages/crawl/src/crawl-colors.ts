/**
 * Color-density crawler — ADDITIVE companion to crawl.ts.
 *
 *   npx tsx src/crawl-colors.ts                       # re-crawl the 44 corpus sites
 *   npx tsx src/crawl-colors.ts --urls https://a.com,https://b.com
 *
 * Measures REAL-SITE COLOR the same way crawl.ts measures font overuse:
 * frequency across the crawled AI-product sites. For each site we read the
 * computed text `color` + non-transparent `backgroundColor` off every visible
 * text-ish element (same selector set as extractElements, capped ~600/site),
 * collapse near-identical shades WITHIN a site (so one site's many tints of its
 * brand blue count once), keep only chromatic IDENTITY colors (OKLCH chroma
 * above CHROMA_CUTOFF — neutrals are exempt downstream in the density model),
 * and weight each color by the NUMBER OF DISTINCT SITES it appears on.
 *
 * Output: data/observations.colors.json — `[{ hex, sites, count }]` where
 *   - hex   : the quantized representative hex (lowercase, #rrggbb)
 *   - sites : number of distinct sites the color appears on (== the weight)
 *   - count : same as sites (one corpus point per (site, distinct-color))
 * corpus.mjs expands a color on K sites into K corpus points.
 *
 * Does NOT touch the font path: extractElements, analyze.ts, crawl.ts and their
 * outputs (crawl-profiles.json / observations.crawl.json) are untouched.
 *
 * No Date.now() / Math.random() — deterministic given the live pages.
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { withBrowser, withPage } from "./extract.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(HERE, "../../../data");

// --- tunables -------------------------------------------------------------
// RGB quantization step for intra-site dedup. Rounding each channel to the
// nearest QUANT collapses a site's near-identical shades into one bucket, so
// one site's family of brand-blue tints contributes a single distinct color.
// 24 ≈ a coarse-enough bucket to merge anti-aliasing / hover variants without
// merging genuinely different hues.
const QUANT = 24;
// Minimum OKLCH chroma for a color to count as a deliberate chromatic IDENTITY
// choice. Mirrors density.mjs NEUTRAL_CHROMA (0.04) but is set slightly lower
// (0.03) per the spec so a color sitting right at the neutral line is still
// captured as data; truly grey structure (chroma < 0.03) is dropped here and
// neutrals remain exempt in the density model anyway.
const CHROMA_CUTOFF = 0.03;
// Per-site element cap (matches extractElements).
const MAX_ELEMENTS = 600;

// --- color math (mirrors viz/personality-test/color/color-space.mjs) ------
function srgbToLinearChannel(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function hexToOklch(hex: string): [number, number, number] {
  const h = hex.replace(/^#/, "");
  const n = parseInt(h, 16);
  const r = srgbToLinearChannel(((n >> 16) & 255) / 255);
  const g = srgbToLinearChannel(((n >> 8) & 255) / 255);
  const b = srgbToLinearChannel((n & 255) / 255);
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const aa = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;
  const C = Math.hypot(aa, bb);
  let H = (Math.atan2(bb, aa) * 180) / Math.PI;
  if (H < 0) H += 360;
  return [L, C, H];
}

// rgb()/rgba() string -> {r,g,b,a} ; null if unparseable.
function parseColor(s: string): { r: number; g: number; b: number; a: number } | null {
  const m = s.match(/rgba?\(([^)]+)\)/i);
  if (!m) return null;
  const parts = m[1].split(",").map((p) => p.trim());
  if (parts.length < 3) return null;
  const r = parseFloat(parts[0]);
  const g = parseFloat(parts[1]);
  const b = parseFloat(parts[2]);
  const a = parts.length >= 4 ? parseFloat(parts[3]) : 1;
  if ([r, g, b].some((v) => Number.isNaN(v))) return null;
  return { r, g, b, a: Number.isNaN(a) ? 1 : a };
}

function quantHex(r: number, g: number, b: number): string {
  const q = (v: number): string => {
    const x = Math.max(0, Math.min(255, Math.round(v / QUANT) * QUANT));
    return x.toString(16).padStart(2, "0");
  };
  return `#${q(r)}${q(g)}${q(b)}`;
}

interface RawColor {
  color: string;
  backgroundColor: string;
  area: number;
  aboveFold: boolean;
}

// Collect raw computed colors from a live page (same selector set as
// extractElements; capped). Pure DOM read, no font path involved.
async function collectColors(page: import("playwright").Page): Promise<RawColor[]> {
  return page.evaluate((max: number) => {
    const vh = window.innerHeight;
    const out: RawColor[] = [];
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
        color: cs.color,
        backgroundColor: cs.backgroundColor,
        area: rect.width * rect.height,
        aboveFold: rect.top < vh && rect.top >= -rect.height,
      });
      if (out.length >= max) break;
    }
    return out;
  }, MAX_ELEMENTS);
}

// Reduce one site's raw colors to its set of DISTINCT chromatic identity hexes.
function siteDistinctColors(raws: RawColor[]): Set<string> {
  const buckets = new Set<string>();
  const consider = (s: string, isBg: boolean): void => {
    const c = parseColor(s);
    if (!c) return;
    if (isBg && c.a === 0) return; // drop fully-transparent backgrounds
    const hex = quantHex(c.r, c.g, c.b);
    const [, C] = hexToOklch(hex);
    if (C < CHROMA_CUTOFF) return; // keep only chromatic identity colors
    buckets.add(hex);
  };
  for (const r of raws) {
    consider(r.color, false);
    consider(r.backgroundColor, true);
  }
  return buckets;
}

interface Args {
  urls: string[] | null;
}
function parseArgs(argv: string[]): Args {
  const out: Args = { urls: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--urls") out.urls = (argv[++i] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  }
  return out;
}

async function loadCorpusUrls(): Promise<string[]> {
  const profiles = JSON.parse(
    await readFile(resolve(DATA_DIR, "crawl-profiles.json"), "utf8"),
  ) as Array<{ url: string }>;
  return profiles.map((p) => p.url);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const urls = args.urls ?? (await loadCorpusUrls());
  console.log(`Crawling colors from ${urls.length} sites...\n`);

  // hex -> number of distinct sites it appears on.
  const siteCount = new Map<string, number>();
  let okSites = 0;

  await withBrowser(async (browser) => {
    for (const url of urls) {
      const raws = await withPage(browser, url, collectColors);
      if (!raws) {
        console.log(`  ✗ ${url}`);
        continue;
      }
      okSites++;
      const distinct = siteDistinctColors(raws);
      for (const hex of distinct) siteCount.set(hex, (siteCount.get(hex) ?? 0) + 1);
      console.log(`  ✓ ${url}  ${distinct.size} distinct chromatic colors`);
    }
  });

  // Emit one record per distinct color: weight = site frequency.
  const records = [...siteCount.entries()]
    .map(([hex, sites]) => ({ hex, sites, count: sites }))
    .sort((a, b) => b.sites - a.sites || (a.hex < b.hex ? -1 : 1));

  await writeFile(
    resolve(DATA_DIR, "observations.colors.json"),
    JSON.stringify(records, null, 2),
  );

  // --- summary ---
  console.log(`\nDone. Sites ok: ${okSites}/${urls.length}.`);
  console.log(`Distinct chromatic site-colors: ${records.length}.`);
  console.log(`Quantization step ${QUANT}/channel; chroma cutoff (OKLCH) ${CHROMA_CUTOFF}.`);
  console.log(`\nTop 15 most-common site-colors (hex — # of sites):`);
  for (const r of records.slice(0, 15)) {
    const [L, C, H] = hexToOklch(r.hex);
    console.log(
      `  ${String(r.sites).padStart(2)} sites  ${r.hex}  oklch(${L.toFixed(2)} ${C.toFixed(3)} ${H.toFixed(0)})`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
