// Hybrid closeness index: blend feature-cosine (category+personality+metrics)
// with visual-cosine (rasterized-glyph embedding). Category keeps clusters clean;
// the visual embedding refines sub-style (Didone vs slab). Overwrites font-neighbors.json.
import { readFile, writeFile } from "node:fs/promises";

const WF = 0.5, WV = 0.5, K = 40;
const VISUAL_PATH = process.argv[2] ?? "data/font-visual.json";
const index = JSON.parse(await readFile("data/fonts.index.json", "utf8"));
const visualRaw = JSON.parse(await readFile(VISUAL_PATH, "utf8"));
// Accept either {id: {family, v}} (grid) or {id: [floats]} (deep) shape.
const visual = Object.fromEntries(Object.entries(visualRaw).map(([k, val]) => [k, Array.isArray(val) ? { v: val } : val]));
console.log(`Visual source: ${VISUAL_PATH}`);

const ATTRS = ["strong", "bold", "delicate", "thin", "elegant", "friendly", "professional", "playful", "dramatic", "calm", "formal", "technical"];
const CATS = ["serif", "sans-serif", "display", "handwriting", "monospace"];
function fvec(f) {
  const m = f.metrics ?? {}, v = [];
  for (const c of CATS) v.push(f.category === c ? 1.5 : 0);
  for (const a of ATTRS) v.push(f.personality?.[a] ?? 0);
  v.push((m.xHeightRatio ?? 0.5) * 0.6, (m.strokeContrast ?? 0.3) * 1.5, (m.counterSize ?? 0.5) * 0.6, Math.min((m.weightCount ?? 1) / 16, 1) * 0.4, (m.hasItalics ? 1 : 0) * 0.3);
  return unit(v);
}
function unit(v) { const n = Math.hypot(...v) || 1; return v.map((x) => x / n); }
function cos(a, b) { let d = 0; for (let i = 0; i < a.length; i++) d += a[i] * b[i]; return d; }

const fonts = index.map((f) => ({ id: f.id, family: f.family, f: fvec(f), v: visual[f.id]?.v ?? null }));
const withV = fonts.filter((x) => x.v).length;
console.log(`Fonts: ${fonts.length}, with visual embedding: ${withV}`);

const neighbors = {};
for (let i = 0; i < fonts.length; i++) {
  const a = fonts[i], sims = [];
  for (let j = 0; j < fonts.length; j++) {
    if (i === j) continue;
    const b = fonts[j];
    const sF = cos(a.f, b.f);
    const sim = a.v && b.v ? WF * sF + WV * cos(a.v, b.v) : sF;
    sims.push([b.id, b.family, sim]);
  }
  sims.sort((x, y) => y[2] - x[2]);
  neighbors[a.id] = sims.slice(0, K).map(([id, family, sim]) => ({ id, family, sim: Math.round(sim * 1000) / 1000 }));
}
await writeFile("data/font-neighbors.json", JSON.stringify(neighbors, null, 2));
console.log("Hybrid closeness index written to data/font-neighbors.json");
for (const id of ["playfair-display", "inter", "oswald", "orbitron", "lobster"]) {
  if (neighbors[id]) console.log(`  ${id} → ${neighbors[id].slice(0, 6).map((n) => `${n.family}(${n.sim})`).join(", ")}`);
}
