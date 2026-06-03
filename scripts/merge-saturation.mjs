// Merge the real-world crawl signal into display saturation (was synthetic-only).
// merged = weighted blend of synthetic (0.6) and crawl (0.4) where each is present.
import { readFile, writeFile } from "node:fs/promises";

const sat = JSON.parse(await readFile("data/saturation.json", "utf8"));
const crawl = JSON.parse(await readFile("data/observations.crawl.json", "utf8"));
const index = JSON.parse(await readFile("data/fonts.index.json", "utf8"));
const fam = new Map(index.map((f) => [f.id, f.family]));

const crawlDisplay = new Map();
let maxC = 0;
for (const o of crawl) if (o.role === "display") { crawlDisplay.set(o.fontId, o.count); maxC = Math.max(maxC, o.count); }

const byId = new Map(sat.map((s) => [s.fontId, s]));
// ensure crawl-only fonts exist in the model
for (const id of crawlDisplay.keys()) if (!byId.has(id)) { const s = { fontId: id, display: 0, body: 0, trend: 0 }; byId.set(id, s); sat.push(s); }

const before = new Map(sat.map((s) => [s.fontId, s.display]));
for (const s of sat) {
  const syn = before.get(s.fontId) ?? 0;
  const crawlNorm = maxC ? (crawlDisplay.get(s.fontId) ?? 0) / maxC : 0;
  const parts = [];
  if (syn > 0) parts.push([syn, 0.6]);
  if (crawlNorm > 0) parts.push([crawlNorm, 0.4]);
  if (parts.length) {
    const w = parts.reduce((a, [, x]) => a + x, 0);
    s.display = Math.round((parts.reduce((a, [v, x]) => a + v * x, 0) / w) * 1000) / 1000;
  }
}
await writeFile("data/saturation.json", JSON.stringify(sat, null, 2));

// Agreement report
const synTop = [...before.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id]) => id);
const crawlTop = [...crawlDisplay.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id]) => id);
const overlap = synTop.filter((id) => crawlTop.includes(id));
console.log("Synthetic top-10 display:", synTop.map((id) => fam.get(id) ?? id).join(", "));
console.log("\nReal-world (crawl) top:", crawlTop.map((id) => `${fam.get(id) ?? id}`).join(", "));
console.log(`\nOverlap of top-10 sets: ${overlap.length}/10 — ${overlap.map((id) => fam.get(id) ?? id).join(", ")}`);
console.log("\nMerged top display saturation:");
for (const s of [...sat].sort((a, b) => b.display - a.display).slice(0, 12)) console.log(`  ${s.display.toFixed(2)}  ${fam.get(s.fontId) ?? s.fontId}`);
