// Turn the collected slop matrix into per-vibe anti-slop recommendations:
// fonts models vouch FIT a vibe, demoted by global saturation -> fit AND fresh.
import { readFile, writeFile } from "node:fs/promises";

const matrix = JSON.parse(await readFile("data/slop-matrix.json", "utf8"));
const sat = JSON.parse(await readFile("data/saturation.json", "utf8"));
const index = JSON.parse(await readFile("data/fonts.index.json", "utf8"));
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const idIn = new Set(index.map((f) => f.id));
const dsat = new Map(sat.map((s) => [s.fontId, s.display]));

const byVibe = new Map();
for (const run of matrix.runs) {
  const fit = byVibe.get(run.vibe) ?? new Map();
  run.fonts.forEach((name, i) => fit.set(name, (fit.get(name) ?? 0) + (20 - i)));
  byVibe.set(run.vibe, fit);
}

const out = [];
for (const [vibe, fit] of byVibe) {
  const rows = [...fit.entries()]
    .map(([name, points]) => {
      const id = slug(name);
      const gsat = dsat.get(id) ?? 0;
      return { font: name, id, inIndex: idIn.has(id), fit: points, globalSat: Math.round(gsat * 100) / 100, recScore: Math.round(points * (1 - gsat)) };
    })
    .filter((r) => r.inIndex);
  // Hard anti-slop cutoff: a font over the saturation threshold is slop, period —
  // it can never be a recommendation no matter how well it "fits". Among the fresh
  // ones, rank by model-vouched fit.
  const FRESH_CUTOFF = 0.4;
  const recommend = rows
    .filter((r) => r.globalSat < FRESH_CUTOFF)
    .sort((a, b) => b.fit - a.fit || a.globalSat - b.globalSat)
    .slice(0, 8);
  const avoid = [...rows].sort((a, b) => b.globalSat - a.globalSat).slice(0, 3).map((r) => r.font);
  out.push({ vibe, recommend, avoid });
}

await writeFile("data/vibe-recommendations.json", JSON.stringify(out, null, 2));

for (const v of out.filter((v) => ["luxury-fashion", "ai-saas", "magazine-editorial", "gaming-esports"].includes(v.vibe))) {
  console.log(`\n=== ${v.vibe} ===`);
  console.log(`  AVOID (slop): ${v.avoid.join(", ")}`);
  console.log(`  RECOMMEND (fits + fresh):`);
  for (const r of v.recommend) console.log(`     ${r.font.padEnd(22)} fit=${r.fit} sat=${r.globalSat}`);
}
