// Add cached external fonts (Fontshare, Velvetyne, ...) to fonts.index.json as
// first-class entries: real metrics from local files, source-tagged, fresh by
// default. Personality is filled afterwards by extend-personality-metrics.mjs.
import { readFile, writeFile, readdir } from "node:fs/promises";
import { metricsFromBuffer } from "./extract-metrics.js";

interface Family { id: string; family: string; category: string; source: string; license: string; tags: string[]; slug: string; }

const index = JSON.parse(await readFile("data/fonts.index.json", "utf8")) as Array<Record<string, unknown>>;
const dirs = await readdir("data/external", { withFileTypes: true });
const fams: Family[] = [];
for (const d of dirs) {
  if (!d.isDirectory()) continue;
  try { fams.push(...(JSON.parse(await readFile(`data/external/${d.name}/families.json`, "utf8")) as Family[])); } catch { /* no families.json */ }
}
const have = new Set(index.map((f) => f.id as string));
const maxPop = Math.max(...index.map((f) => (f.popularityRank as number) ?? 0));

let added = 0, failed = 0;
for (const fam of fams) {
  if (have.has(fam.id)) continue;
  try {
    const b = await readFile(`data/fonts-cache/${fam.id}.ttf`);
    const m = metricsFromBuffer(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer);
    index.push({
      id: fam.id, family: fam.family, supplier: fam.source, category: fam.category,
      metrics: { xHeightRatio: m.xHeightRatio, apertureOpenness: 0.5, counterSize: m.counterSize,
        strokeContrast: m.strokeContrast, weightCount: 6, hasItalics: false, charsetCompleteness: m.charsetCompleteness },
      isFoundational: false, popularityRank: maxPop + 1 + added, trendingRank: maxPop + 1 + added,
      isBrandFont: false, dateAdded: "2021-01-01", quality: 0.7,
      metricsReal: true, personalityReal: false, license: fam.license, tags: fam.tags,
    });
    added++;
  } catch (e) {
    failed++; console.warn(`  ! ${fam.family}: ${(e as Error).message}`);
  }
}

await writeFile("data/fonts.index.json", JSON.stringify(index, null, 2));
console.log(`Added ${added} Fontshare fonts (${failed} failed). Index now ${index.length} fonts.`);
