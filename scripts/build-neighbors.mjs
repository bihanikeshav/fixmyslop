// Deterministic font-closeness index: k-nearest-neighbors over a feature vector
// of category + personality + glyph metrics. No LLM, no visual CNN (that's the
// future DeepFont layer) — but covers all fonts and powers swaps/discovery.
import { readFile, writeFile } from "node:fs/promises";

const index = JSON.parse(await readFile("data/fonts.index.json", "utf8"));
const ATTRS = ["strong", "bold", "delicate", "thin", "elegant", "friendly", "professional", "playful", "dramatic", "calm", "formal", "technical"];
const CATS = ["serif", "sans-serif", "display", "handwriting", "monospace"];

function vec(f) {
  const m = f.metrics ?? {};
  const v = [];
  for (const c of CATS) v.push(f.category === c ? 1.5 : 0);          // category dominates
  for (const a of ATTRS) v.push((f.personality?.[a] ?? 0) * 1.0);     // personality
  v.push((m.xHeightRatio ?? 0.5) * 0.6, (m.strokeContrast ?? 0.3) * 1.5, (m.counterSize ?? 0.5) * 0.6,
         Math.min((m.weightCount ?? 1) / 16, 1) * 0.4, (m.hasItalics ? 1 : 0) * 0.3);
  return v;
}
function unit(v) { const n = Math.hypot(...v) || 1; return v.map((x) => x / n); }

const vecs = index.map((f) => ({ id: f.id, family: f.family, v: unit(vec(f)) }));
const K = 10;
const neighbors = {};
for (let i = 0; i < vecs.length; i++) {
  const a = vecs[i];
  const sims = [];
  for (let j = 0; j < vecs.length; j++) {
    if (i === j) continue;
    const b = vecs[j];
    let dot = 0;
    for (let k = 0; k < a.v.length; k++) dot += a.v[k] * b.v[k];
    sims.push([b.id, b.family, dot]);
  }
  sims.sort((x, y) => y[2] - x[2]);
  neighbors[a.id] = sims.slice(0, K).map(([id, family, sim]) => ({ id, family, sim: Math.round(sim * 1000) / 1000 }));
}

await writeFile("data/font-neighbors.json", JSON.stringify(neighbors, null, 2));
console.log(`Closeness index built: ${vecs.length} fonts, top-${K} neighbors each.`);
for (const id of ["inter", "playfair-display", "orbitron", "lobster", "jetbrains-mono"]) {
  if (neighbors[id]) console.log(`  ${id} → ${neighbors[id].slice(0, 6).map((n) => `${n.family}(${n.sim})`).join(", ")}`);
}
