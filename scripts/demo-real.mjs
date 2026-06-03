// End-to-end on REAL data: index + measured saturation -> anti-inductive picks.
import { readFile } from "node:fs/promises";
import { recommend } from "../packages/core/dist/index.js";

const index = JSON.parse(await readFile("data/fonts.index.json", "utf8"));
const sat = JSON.parse(await readFile("data/saturation.json", "utf8"));
const satById = new Map(sat.map((s) => [s.fontId, s]));

const candidates = (filter) =>
  index.filter(filter).map((f) => ({
    font: f,
    quality: f.quality,
    saturation: satById.get(f.id) ?? { fontId: f.id, display: 0, body: 0, trend: 0 },
  }));

function show(title, cands, query, slopFonts) {
  const ranked = recommend(cands, { ...query, limit: 5000 });
  console.log(`\n=== ${title} ===`);
  console.log("Top anti-inductive picks (quality x low saturation):");
  for (const r of ranked.slice(0, 6)) {
    const sat = r.displaySaturation.toFixed(2);
    console.log(`   ${r.font.family.padEnd(22)} score=${r.score.toFixed(3)}  q=${r.qualityScore.toFixed(2)}  satur=${sat}`);
  }
  for (const name of slopFonts) {
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const pos = ranked.findIndex((r) => r.font.id === id);
    const r = ranked[pos];
    if (pos >= 0) {
      console.log(`   slop "${name}" ranked #${pos + 1}/${ranked.length}  (satur=${r.displaySaturation.toFixed(2)}) — demoted`);
    } else {
      console.log(`   slop "${name}" — excluded (foundational or below quality floor)`);
    }
  }
}

show(
  "LUXURY FASHION display font",
  candidates((f) => f.category === "serif" || f.category === "display"),
  { target: { elegant: 1, dramatic: 0.6 }, role: "display", freshness: 0.9, qualityThreshold: 0.5 },
  ["Playfair Display", "Cormorant Garamond", "Bodoni Moda"],
);

show(
  "AI SaaS display font",
  candidates((f) => f.category === "sans-serif"),
  { target: { professional: 0.8, bold: 0.5 }, role: "display", freshness: 0.9, qualityThreshold: 0.5 },
  ["Inter", "Space Grotesk", "Outfit", "DM Sans"],
);
