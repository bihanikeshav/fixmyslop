// Deterministic VISUAL embedding: render each font's glyphs ("Rag") to a coverage
// grid via outline rasterization, then k-NN over the grids. Pixel-based, no CNN
// training. Captures shape/contrast/aperture that the feature vector misses.
//
//   node scripts/build-visual.mjs sample        # validate on a curated set
//   node scripts/build-visual.mjs <limit>       # build for top-<limit> by popularity
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import opentype from "opentype.js";

const LEGACY_UA = "Mozilla/5.0 (compatible; fixmyslop/0.1)";
const EM = 100, GW = 32, GH = 24, SAMPLE_TEXT = "Rag";
const CACHE = "data/fonts-cache";

const SAMPLE = ["playfair-display", "bodoni-moda", "prata", "cinzel", "italiana", "gilda-display",
  "arvo", "bevan", "roboto-slab", "zilla-slab", "inter", "roboto", "open-sans",
  "oswald", "bebas-neue", "jetbrains-mono", "roboto-mono", "lobster", "pacifico"];

const index = JSON.parse(await readFile("data/fonts.index.json", "utf8"));
await mkdir(CACHE, { recursive: true });

const arg = process.argv[2] ?? "sample";
let targets;
if (arg === "sample") targets = SAMPLE.map((id) => index.find((f) => f.id === id)).filter(Boolean);
else targets = [...index].sort((a, b) => a.popularityRank - b.popularityRank).slice(0, Number(arg));

const emb = {};
let ok = 0, fail = 0;
const CONC = 6;
for (let i = 0; i < targets.length; i += CONC) {
  await Promise.all(targets.slice(i, i + CONC).map(async (f) => {
    try { emb[f.id] = { family: f.family, v: await embed(f.family, f.id) }; ok++; }
    catch (e) { fail++; if (arg === "sample") console.warn(`  ! ${f.family}: ${e.message}`); }
  }));
}
console.log(`Visual embeddings: ${ok} ok, ${fail} failed.`);

if (arg === "sample") {
  for (const id of ["playfair-display", "inter", "oswald"]) {
    if (!emb[id]) continue;
    const sims = Object.entries(emb).filter(([k]) => k !== id)
      .map(([k, e]) => [e.family, cos(emb[id].v, e.v)]).sort((a, b) => b[1] - a[1]).slice(0, 5);
    console.log(`  ${id} → ${sims.map(([f, s]) => `${f}(${s.toFixed(3)})`).join(", ")}`);
  }
} else {
  await writeFile("data/font-visual.json", JSON.stringify(emb));
  console.log(`Wrote data/font-visual.json (${ok} fonts).`);
}

async function embed(family, id) {
  const buf = await ttf(family, id);
  const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const path = font.getPath(SAMPLE_TEXT, 0, 0, EM);
  const subs = flatten(path);
  const b = bbox(subs);
  const grid = new Float32Array(GW * GH);
  const W = b.x2 - b.x1 || 1, H = b.y2 - b.y1 || 1;
  for (let gy = 0; gy < GH; gy++) {
    for (let s = 0; s < 2; s++) {
      const yFont = b.y1 + ((gy + (s + 0.5) / 2) / GH) * H;
      const xs = scanX(subs, yFont);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const c0 = ((xs[k] - b.x1) / W) * GW, c1 = ((xs[k + 1] - b.x1) / W) * GW;
        for (let c = Math.max(0, Math.floor(c0)); c < Math.min(GW, Math.ceil(c1)); c++) {
          grid[gy * GW + c] += Math.max(0, Math.min(c + 1, c1) - Math.max(c, c0)) * 0.5;
        }
      }
    }
  }
  const aspect = W / H;
  const v = Array.from(grid);
  v.push(Math.min(2, aspect) * 3); // proportion feature, weighted
  return unit(v);
}

async function ttf(family, id) {
  const p = `${CACHE}/${id}.ttf`;
  if (existsSync(p)) return readFile(p);
  const css = await (await fetch(`https://fonts.googleapis.com/css?family=${encodeURIComponent(family)}`, { headers: { "user-agent": LEGACY_UA } })).text();
  const m = css.match(/url\((https:[^)]+\.ttf)\)/);
  if (!m) throw new Error("no ttf");
  const buf = Buffer.from(await (await fetch(m[1], { headers: { "user-agent": LEGACY_UA } })).arrayBuffer());
  await writeFile(p, buf);
  return buf;
}

function flatten(path) {
  const subs = []; let cur = [], p = { x: 0, y: 0 };
  const bez = (a, c1, c2, b2) => { for (let t = 1; t <= 6; t++) { const u = t / 6, m = 1 - u; cur.push({ x: m ** 3 * a.x + 3 * m * m * u * c1.x + 3 * m * u * u * c2.x + u ** 3 * b2.x, y: m ** 3 * a.y + 3 * m * m * u * c1.y + 3 * m * u * u * c2.y + u ** 3 * b2.y }); } };
  const quad = (a, c, b2) => { for (let t = 1; t <= 6; t++) { const u = t / 6, m = 1 - u; cur.push({ x: m * m * a.x + 2 * m * u * c.x + u * u * b2.x, y: m * m * a.y + 2 * m * u * c.y + u * u * b2.y }); } };
  for (const c of path.commands) {
    if (c.type === "M") { if (cur.length) subs.push(cur); cur = [{ x: c.x, y: c.y }]; p = { x: c.x, y: c.y }; }
    else if (c.type === "L") { cur.push({ x: c.x, y: c.y }); p = { x: c.x, y: c.y }; }
    else if (c.type === "C") { bez(p, { x: c.x1, y: c.y1 }, { x: c.x2, y: c.y2 }, { x: c.x, y: c.y }); p = { x: c.x, y: c.y }; }
    else if (c.type === "Q") { quad(p, { x: c.x1, y: c.y1 }, { x: c.x, y: c.y }); p = { x: c.x, y: c.y }; }
    else if (c.type === "Z") { if (cur.length) subs.push(cur); cur = []; }
  }
  if (cur.length) subs.push(cur);
  return subs;
}
function bbox(subs) { let x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9; for (const s of subs) for (const q of s) { x1 = Math.min(x1, q.x); x2 = Math.max(x2, q.x); y1 = Math.min(y1, q.y); y2 = Math.max(y2, q.y); } return { x1, y1, x2, y2 }; }
function scanX(subs, y) { const xs = []; for (const s of subs) for (let i = 0; i < s.length; i++) { const a = s[i], b = s[(i + 1) % s.length]; if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) xs.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x)); } return xs.sort((m, n) => m - n); }
function unit(v) { const n = Math.hypot(...v) || 1; return v.map((x) => x / n); }
function cos(a, b) { let d = 0; for (let i = 0; i < a.length; i++) d += a[i] * b[i]; return d; }
