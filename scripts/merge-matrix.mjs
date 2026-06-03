// Merge a second slop-matrix collection into slop-matrix.json and rebuild the
// synthetic display saturation (then re-blend the crawl signal).
import { readFile, writeFile } from "node:fs/promises";

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const newOut = JSON.parse((await readFile(process.argv[2], "utf8")).match(/\{[\s\S]*\}/)[0]);
const newRuns = (newOut.result ?? newOut).runs;
const existing = JSON.parse(await readFile("data/slop-matrix.json", "utf8"));

const runs = [...existing.runs, ...newRuns];
const vibes = [...new Set(runs.map((r) => r.vibe))];

// perVibe
const perVibe = vibes.map((vibe) => {
  const rows = runs.filter((r) => r.vibe === vibe);
  const points = new Map();
  const rank1 = {};
  for (const r of rows) { rank1[r.model] = r.fonts[0]; r.fonts.forEach((f, i) => points.set(f, (points.get(f) ?? 0) + (20 - i))); }
  const top = [...points.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([font, pts]) => ({ font, pts }));
  return { vibe, rank1, top };
});

// global synthetic display points
const gp = new Map();
for (const r of runs) r.fonts.forEach((f, i) => gp.set(slug(f), (gp.get(slug(f)) ?? 0) + (20 - i)));
await writeFile("data/slop-matrix.json", JSON.stringify({ runs, perVibe }, null, 2));

// rebuild saturation: body from seed, display = blend(synthetic 0.6, crawl 0.4)
const seed = JSON.parse(await readFile("data/saturation.seed.json", "utf8"));
const body = new Map(seed.map((s) => [s.fontId, s.body]));
let crawl = [];
try { crawl = JSON.parse(await readFile("data/observations.crawl.json", "utf8")); } catch {}
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

const index = JSON.parse(await readFile("data/fonts.index.json", "utf8"));
const fam = new Map(index.map((f) => [f.id, f.family]));
console.log(`Merged: ${runs.length} runs across ${vibes.length} vibes; ${gp.size} unique fonts sampled.`);
console.log("Top display saturation (synthetic + crawl):");
for (const s of [...sat].sort((a, b) => b.display - a.display).slice(0, 12)) console.log(`  ${s.display.toFixed(2)}  ${fam.get(s.fontId) ?? s.fontId}`);
