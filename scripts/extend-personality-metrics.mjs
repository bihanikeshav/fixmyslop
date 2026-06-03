// Deterministic personality from glyph metrics + category, for every font that
// still lacks an O'Donovan (human) or vibe-derived vector. No LLM. Full coverage.
import { readFile, writeFile } from "node:fs/promises";

const index = JSON.parse(await readFile("data/fonts.index.json", "utf8"));

const base = (cat) => ({
  serif: { elegant: 0.5, formal: 0.5 },
  display: { bold: 0.6, dramatic: 0.6 },
  handwriting: { playful: 0.7, friendly: 0.6 },
  monospace: { technical: 0.8, professional: 0.4 },
  "sans-serif": { professional: 0.5, calm: 0.4 },
}[cat] ?? { professional: 0.5 });

const add = (p, k, v) => { p[k] = Math.min(1, (p[k] ?? 0) + v); };

let filled = 0;
for (const f of index) {
  if (f.personalitySource === "odonovan" || f.personalitySource === "vibe") continue;
  const m = f.metrics ?? {};
  const p = { ...base(f.category) };
  // Stroke contrast -> elegance/drama (high) or calm/professional (monoline)
  if (m.strokeContrast > 0.55) { add(p, "elegant", 0.4); add(p, "dramatic", 0.3); add(p, "delicate", 0.2); }
  else if (m.strokeContrast < 0.15) { add(p, "calm", 0.2); add(p, "professional", 0.2); }
  if (f.category === "serif" && m.strokeContrast > 0.4) add(p, "formal", 0.2);
  // x-height -> modern/friendly (tall) vs classical/elegant (short)
  if (m.xHeightRatio > 0.72) add(p, "friendly", 0.2);
  else if (m.xHeightRatio < 0.45) add(p, "elegant", 0.2);
  // weights -> versatility reads as professional
  if (m.weightCount >= 8) add(p, "professional", 0.15);

  const max = Math.max(...Object.values(p), 0.0001);
  for (const k of Object.keys(p)) p[k] = Math.round((p[k] / max) * 100) / 100;
  f.personality = p;
  f.personalitySource = "metrics";
  filled++;
}

await writeFile("data/fonts.index.json", JSON.stringify(index, null, 2));
const by = {};
for (const f of index) by[f.personalitySource ?? "none"] = (by[f.personalitySource ?? "none"] ?? 0) + 1;
console.log("Personality coverage by source:", by, "= 100% of", index.length);
for (const id of ["dela-gothic-one", "abril-fatface", "yeseva-one", "space-mono", "caveat"]) {
  const f = index.find((x) => x.id === id);
  if (f) console.log(`  ${f.family.padEnd(18)} [${f.personalitySource}] ${Object.entries(f.personality).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k}:${v}`).join(" ")}`);
}
