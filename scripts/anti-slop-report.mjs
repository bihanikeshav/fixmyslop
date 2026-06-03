import { readFile } from "node:fs/promises";

const index = JSON.parse(await readFile("data/fonts.index.json", "utf8"));
const sat = JSON.parse(await readFile("data/saturation.json", "utf8"));
const matrix = JSON.parse(await readFile("data/slop-matrix.json", "utf8"));
const byId = new Map(index.map((f) => [f.id, f]));
const satOf = new Map(sat.map((s) => [s.fontId, s]));
const dsat = (id) => satOf.get(id)?.display ?? 0;
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// 1) GLOBAL SLOP (highest display saturation)
console.log("=== TOP SLOP DISPLAY FONTS (avoid / show in 'before') ===");
for (const s of [...sat].sort((a, b) => b.display - a.display).slice(0, 18)) {
  const f = byId.get(s.fontId);
  if (f) console.log(`  ${s.display.toFixed(2)}  ${f.family.padEnd(22)} ${f.category}`);
}

// 2) ANTI-SLOP POOL: quality, under-saturated, not foundational, real metrics
console.log("\n=== ANTI-SLOP POOL (quality>=0.72, near-zero display saturation, real metrics) ===");
for (const cat of ["display", "serif", "sans-serif", "monospace"]) {
  const pool = index
    .filter((f) => f.category === cat && !f.isFoundational && f.metricsReal && f.quality >= 0.72 && dsat(f.id) < 0.05)
    .sort((a, b) => b.quality - a.quality)
    .slice(0, 22);
  console.log(`\n  [${cat}] ${pool.map((f) => f.family).join(", ")}`);
}

// 3) MODEL-VOUCHED-BUT-FRESH: fonts models named for SOME vibe, but not top slop & low global saturation
console.log("\n=== MODEL-VOUCHED BUT FRESH (named for a vibe, low rank, low global saturation) ===");
const appear = new Map(); // id -> {count, minRank, name}
for (const run of matrix.runs) {
  run.fonts.forEach((name, i) => {
    const id = slug(name);
    const e = appear.get(id) ?? { count: 0, minRank: 99, name };
    e.count++;
    e.minRank = Math.min(e.minRank, i + 1);
    appear.set(id, e);
  });
}
const fresh = [...appear.entries()]
  .filter(([id, e]) => byId.has(id) && dsat(id) < 0.12 && e.minRank >= 6)
  .map(([id, e]) => ({ family: byId.get(id).family, cat: byId.get(id).category, ...e }))
  .sort((a, b) => b.count - a.count)
  .slice(0, 30);
for (const f of fresh) console.log(`  x${f.count} (best rank ${f.minRank})  ${f.family.padEnd(22)} ${f.cat}`);
