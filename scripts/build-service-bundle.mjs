// build-service-bundle.mjs — freeze the engine's data into portable JSON bundles
// that run with NO fs (browser + Cloudflare Worker). Reuses the REAL loaders so
// the bundle matches the CLI engine exactly, including the fresh crawl corpus.
//
//   node scripts/build-service-bundle.mjs
//
// Writes apps/engine/data/{corpus,brands,fonts,font-space}.json

import { loadCorpus } from "../viz/personality-test/color/corpus.mjs";
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const OUT = resolve(process.cwd(), "apps/engine/data");
mkdirSync(OUT, { recursive: true });

// 1) KDE corpus — aggregate duplicate hexes to {hex, weight}. density() summed
//    duplicates; weighting by count is mathematically identical, so the calibrated
//    OVERUSE_THRESHOLD still holds — but the bundle is far smaller.
const pts = loadCorpus();
const w = new Map();
for (const p of pts) w.set(p.hex, (w.get(p.hex) || 0) + 1);
const corpus = [...w.entries()].map(([hex, weight]) => ({ hex, weight }));
writeFileSync(resolve(OUT, "corpus.json"), JSON.stringify(corpus));

// 2) brand identity colors (getdesign) — for brand-clone naming.
let brands = [];
try { brands = JSON.parse(readFileSync("data/reference/getdesign/index.json", "utf8")); } catch { /* absent */ }
const brandsTrim = brands
  .map((b) => ({ name: b.name, ic: (b.identityColors || []).map((x) => String(x).toLowerCase()) }))
  .filter((b) => b.ic.length);
writeFileSync(resolve(OUT, "brands.json"), JSON.stringify(brandsTrim));

// 3) fonts index — only the fields the font tools use.
const fonts = JSON.parse(readFileSync("data/fonts.index.json", "utf8"));
const fontsTrim = fonts.map((f) => ({
  id: f.id, family: f.family, supplier: f.supplier, category: f.category,
  popularityRank: f.popularityRank, isFoundational: !!f.isFoundational,
  isBrandFont: !!f.isBrandFont, quality: f.quality || 0,
}));
writeFileSync(resolve(OUT, "fonts.json"), JSON.stringify(fontsTrim));

// 3b) runtime font assets — freshness is not enough to recommend a family.
// Keep this derived from the existing index/cache; no font recrawl is involved.
const fontCache = resolve(process.cwd(), "data/fonts-cache");
const embedCache = resolve(fontCache, "embed");
const ttfNames = new Set(readdirSync(fontCache).filter((name) => name.toLowerCase().endsWith(".ttf")));
const woff2Names = new Set(readdirSync(embedCache).filter((name) => name.toLowerCase().endsWith(".woff2")));
const slug = (id) => String(id || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const runtimeEntries = fonts.map((font) => {
  const base = slug(font.id);
  const ttfName = `${base}.ttf`;
  const weightFiles = [400, 500, 600, 700].map((weight) => `${base}-${weight}.woff2`).filter((name) => woff2Names.has(name));
  return {
    id: font.id, family: font.family, category: font.category, supplier: font.supplier,
    metrics: font.metrics || null, metricsReal: !!font.metricsReal, isFoundational: !!font.isFoundational,
    assetAvailable: ttfNames.has(ttfName) || weightFiles.length > 0,
    remoteAssetAvailable: false,
    localFormats: { ttf: ttfNames.has(ttfName) ? `data/fonts-cache/${ttfName}` : null, woff2: weightFiles.map((name) => `data/fonts-cache/embed/${name}`) },
    publicFormats: { ttf: null, woff2: [] },
    recommendedWeights: weightFiles.length ? weightFiles.map((name) => Number(name.match(/-(400|500|600|700)\.woff2$/)?.[1])).filter(Boolean) : [400],
  };
});
writeFileSync(resolve(OUT, "font-runtime.v1.json"), JSON.stringify({
  schemaVersion: "font-runtime.v1", generatedFrom: ["data/fonts.index.json", "data/fonts-cache/"],
  noFontRecrawl: true, policy: { recommendationRequiresAsset: true, assetScope: "repository-local", remoteServiceHostsAssets: false, bodyRequiresReadableRole: true, fallbackWhenUnavailable: "known-local-or-system-pair", visualProof: "required-before-ship" },
  entries: runtimeEntries,
}));

// 4) font-space — retrieval bundle for `retrieveFonts` (Subsystem 4). Lean: cap
//    neighbors to top 12/font, no raw visual/deep vectors, small feature vectors only.
// Encoding: neighbor ids are stored as integer indices into `ids` (this file's own
// id ordering, positional — not repeating the id string 12 * ~2000 times); `metrics`
// is a fixed-order array (see METRIC_KEYS, mirrored in engine.mjs); and each font's
// `entries` row is itself a positional array (see ENTRY_FIELDS) rather than an
// object, so none of family/category/supplier/... key names repeat 2075 times.
// This is a pure size optimization for a bundle only the engine reads — engine.mjs
// hydrates it back into named records once at load.
let neighborsById = {};
try { neighborsById = JSON.parse(readFileSync("data/font-neighbors.json", "utf8")); } catch { /* absent */ }
const NEIGHBOR_CAP = 12;
const METRIC_KEYS = ["xHeightRatio", "apertureOpenness", "counterSize", "strokeContrast", "weightCount", "hasItalics", "charsetCompleteness"];
const ENTRY_FIELDS = ["family", "category", "supplier", "popularityRank", "trendingRank", "quality", "isFoundational", "isBrandFont", "metrics", "personality", "neighbors"];
const round = (n, d = 3) => (typeof n === "number" ? +n.toFixed(d) : n);
const roundObj = (o, d = 2) => Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [k, round(v, d)]));

const ids = fonts.map((f) => f.id);
const idToIndex = new Map(ids.map((id, i) => [id, i]));
const entries = fonts.map((f) => {
  const neighbors = (neighborsById[f.id] || [])
    .map((n) => [idToIndex.get(n.id), round(n.sim, 2)])
    .filter(([idx]) => idx !== undefined)
    .slice(0, NEIGHBOR_CAP);
  const m = f.metrics || {};
  const row = {
    family: f.family, category: f.category, supplier: f.supplier,
    popularityRank: f.popularityRank, trendingRank: f.trendingRank,
    quality: round(f.quality || 0, 2), isFoundational: !!f.isFoundational, isBrandFont: !!f.isBrandFont,
    metrics: METRIC_KEYS.map((k) => (k === "hasItalics" ? (m[k] ? 1 : 0) : round(m[k], 2) ?? 0)),
    personality: roundObj(f.personality),
    neighbors,
  };
  return ENTRY_FIELDS.map((k) => row[k]);
});
const fontSpace = { metricKeys: METRIC_KEYS, entryFields: ENTRY_FIELDS, ids, entries };
writeFileSync(resolve(OUT, "font-space.json"), JSON.stringify(fontSpace));

const kb = (o) => Math.round(JSON.stringify(o).length / 1024);
console.log(`corpus ${corpus.length} pts (${kb(corpus)}kb) · brands ${brandsTrim.length} (${kb(brandsTrim)}kb) · fonts ${fontsTrim.length} (${kb(fontsTrim)}kb) · font-runtime ${runtimeEntries.filter((entry) => entry.assetAvailable).length}/${runtimeEntries.length} assets · font-space ${Object.keys(fontSpace).length} (${kb(fontSpace)}kb)`);
