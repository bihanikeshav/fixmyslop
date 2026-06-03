/**
 * Build the font index from Google Fonts metadata.
 *
 *   npm run index -w @ai-slop-font/pipeline
 *
 * Writes:
 *   data/fonts.index.json     — IndexedFont[] (the Brain's font universe)
 *   data/saturation.seed.json — SaturationStat[] seeded from GF popularity
 *                               (body baseline only; display filled by crawl/synthetic)
 */

import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { SaturationStat } from "@ai-slop-font/core";
import { fetchGoogleFontsMetadata, normalizeFamily } from "./sources/gfonts.js";
import type { IndexedFont } from "./types.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(HERE, "../../../data");

async function main(): Promise<void> {
  console.log("Fetching Google Fonts metadata (keyless)...");
  const raw = await fetchGoogleFontsMetadata();
  console.log(`  ${raw.length} families`);

  const fonts: IndexedFont[] = raw.map(normalizeFamily);
  const maxRank = Math.max(...fonts.map((f) => f.popularityRank));

  // Seed saturation: GF popularity is overall (mostly body) usage -> body baseline.
  // Display saturation starts at 0; it is filled by the crawl + synthetic signals.
  const saturation: SaturationStat[] = fonts.map((f) => ({
    fontId: f.id,
    display: 0,
    body: round(1 - (f.popularityRank - 1) / maxRank),
    trend: 0,
  }));

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(resolve(DATA_DIR, "fonts.index.json"), JSON.stringify(fonts, null, 2));
  await writeFile(
    resolve(DATA_DIR, "saturation.seed.json"),
    JSON.stringify(saturation, null, 2),
  );

  // Summary
  const byCat = new Map<string, number>();
  for (const f of fonts) byCat.set(f.category, (byCat.get(f.category) ?? 0) + 1);
  const foundational = fonts.filter((f) => f.isFoundational).length;

  console.log(`\nWrote ${fonts.length} fonts to data/fonts.index.json`);
  console.log(`  foundational (top ${foundational} by popularity): ${foundational}`);
  console.log(`  by category:`, Object.fromEntries(byCat));
  console.log(`\n  e.g. Inter:`, summarize(fonts.find((f) => f.id === "inter")));
  console.log(`  e.g. Fraunces:`, summarize(fonts.find((f) => f.id === "fraunces")));
}

function summarize(f: IndexedFont | undefined): unknown {
  if (!f) return "(not found)";
  return {
    family: f.family,
    category: f.category,
    popularityRank: f.popularityRank,
    isFoundational: f.isFoundational,
    weights: f.metrics.weightCount,
    italics: f.metrics.hasItalics,
    quality: round(f.quality),
  };
}

const round = (n: number): number => Math.round(n * 1000) / 1000;

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
