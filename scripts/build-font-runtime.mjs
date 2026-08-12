import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const indexPath = resolve(root, "data/fonts.index.json");
const ttfDir = resolve(root, "data/fonts-cache");
const embedDir = resolve(ttfDir, "embed");
const outPath = resolve(root, "apps/engine/data/font-runtime.v1.json");

const index = JSON.parse(await readFile(indexPath, "utf8"));
const ttf = new Set((await readdir(ttfDir)).filter((name) => name.toLowerCase().endsWith(".ttf")));
const woff2 = new Set((await readdir(embedDir)).filter((name) => name.toLowerCase().endsWith(".woff2")));
const slug = (id) => String(id || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const entries = index.map((font) => {
  const id = String(font.id);
  const base = slug(id);
  const ttfName = `${base}.ttf`;
  const weightFiles = [400, 500, 600, 700].map((weight) => `${base}-${weight}.woff2`).filter((name) => woff2.has(name));
  const hasTtf = ttf.has(ttfName);
  return {
    id,
    family: font.family,
    category: font.category,
    supplier: font.supplier,
    metrics: font.metrics || null,
    metricsReal: !!font.metricsReal,
    isFoundational: !!font.isFoundational,
    tags: font.tags || [],
    assetAvailable: hasTtf || weightFiles.length > 0,
    remoteAssetAvailable: false,
    localFormats: {
      ttf: hasTtf ? `data/fonts-cache/${ttfName}` : null,
      woff2: weightFiles.map((name) => `data/fonts-cache/embed/${name}`),
    },
    publicFormats: { ttf: null, woff2: [] },
    recommendedWeights: weightFiles.length ? weightFiles.map((name) => Number(name.match(/-(400|500|600|700)\.woff2$/)?.[1])).filter(Boolean) : [400],
    license: font.license || "catalogue-indexed; verify project license before shipping",
  };
});

const output = {
  schemaVersion: "font-runtime.v1",
  generatedFrom: ["data/fonts.index.json", "data/fonts-cache/"],
  noFontRecrawl: true,
  policy: {
    recommendationRequiresAsset: true,
    assetScope: "repository-local",
    remoteServiceHostsAssets: false,
    bodyRequiresReadableRole: true,
    fallbackWhenUnavailable: "known-local-or-system-pair",
    visualProof: "required-before-ship",
  },
  entries,
};

await writeFile(outPath, JSON.stringify(output, null, 2) + "\n");
console.log(JSON.stringify({ out: relative(root, outPath), entries: entries.length, assetAvailable: entries.filter((entry) => entry.assetAvailable).length }));
