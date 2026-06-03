// Rebuild display saturation from the current slop-matrix (synthetic) + crawl
// corpus, without re-merging matrix runs. Idempotent.
import { readFile, writeFile } from "node:fs/promises";
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const { runs } = JSON.parse(await readFile("data/slop-matrix.json", "utf8"));
const seed = JSON.parse(await readFile("data/saturation.seed.json", "utf8"));
const body = new Map(seed.map((s) => [s.fontId, s.body]));
let crawl = [];
try { crawl = JSON.parse(await readFile("data/observations.crawl.json", "utf8")); } catch {}

const gp = new Map();
for (const r of runs) r.fonts.forEach((f, i) => gp.set(slug(f), (gp.get(slug(f)) ?? 0) + (20 - i)));
const crawlD = new Map(crawl.filter((o) => o.role === "display").map((o) => [o.fontId, o.count]));
const synMax = Math.max(...gp.values(), 1);
const crawlMax = Math.max(...crawlD.values(), 1);

const ids = new Set([...gp.keys(), ...crawlD.keys(), ...body.keys()]);
const sat = [];
for (const id of ids) {
  const syn = (gp.get(id) ?? 0) / synMax;
  const cr = (crawlD.get(id) ?? 0) / crawlMax;
  const parts = [];
  if (syn > 0) parts.push([syn, 0.6]);
  if (cr > 0) parts.push([cr, 0.4]);
  const display = parts.length ? parts.reduce((a, [v, w]) => a + v * w, 0) / parts.reduce((a, [, w]) => a + w, 0) : 0;
  sat.push({ fontId: id, display: Math.round(display * 1000) / 1000, body: Math.round((body.get(id) ?? 0) * 1000) / 1000, trend: 0 });
}
await writeFile("data/saturation.json", JSON.stringify(sat, null, 2));

const fam = new Map(JSON.parse(await readFile("data/fonts.index.json", "utf8")).map((f) => [f.id, f.family]));
const sites = (await readFile("data/crawl-profiles.json", "utf8").then(JSON.parse).catch(() => [])).length;
console.log(`Saturation rebuilt from ${runs.length} synthetic runs + ${sites} crawled sites.`);
console.log("Top display saturation:");
for (const s of [...sat].sort((a, b) => b.display - a.display).slice(0, 12)) console.log(`  ${s.display.toFixed(2)}  ${fam.get(s.fontId) ?? s.fontId}`);
