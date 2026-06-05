// Import Fontjoy's 200-dim font vectors (MIT, Jack000/fontjoy) as our visual
// embedding. They render each font to a 224x224 glyph image, push it through a
// frozen VGG, and PCA to 200 dims. One upright representative weight per family.
import { readFile, writeFile } from "node:fs/promises";

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const unit = (v) => { const n = Math.hypot(...v) || 1; return v.map((x) => x / n); };

const meta = (await readFile("data/external/fontjoy/metadata.tsv", "utf8")).split(/\r?\n/).filter(Boolean);
const vecs = (await readFile("data/external/fontjoy/vectors-200.tsv", "utf8")).split(/\r?\n/).filter(Boolean);
const mrows = meta[0].startsWith("name\t") ? meta.slice(1) : meta;
if (mrows.length !== vecs.length) throw new Error(`row mismatch: meta ${mrows.length} vs vec ${vecs.length}`);

// Collect non-italic variants per family, keep the weight closest to 400.
const byFamily = new Map();
for (let i = 0; i < mrows.length; i++) {
  const [name, variant] = mrows[i].split("\t");
  if (variant.includes("italic")) continue;
  const family = name.slice(0, name.length - variant.length).trim();
  const weight = variant === "regular" ? 400 : Number(variant);
  if (!Number.isFinite(weight)) continue;
  const prev = byFamily.get(family);
  if (!prev || Math.abs(weight - 400) < Math.abs(prev.weight - 400)) {
    byFamily.set(family, { weight, v: vecs[i].split("\t").map(Number) });
  }
}

const index = JSON.parse(await readFile("data/fonts.index.json", "utf8"));
const ourIds = new Set(index.map((f) => f.id));
const out = {};
let matched = 0;
for (const [family, { v }] of byFamily) {
  const id = slug(family);
  if (ourIds.has(id)) { out[id] = { family, v: unit(v) }; matched++; }
}
await writeFile("data/font-visual-fontjoy.json", JSON.stringify(out));

const missing = index.filter((f) => !out[f.id]).sort((a, b) => a.popularityRank - b.popularityRank).slice(0, 12).map((f) => f.family);
console.log(`Fontjoy families: ${byFamily.size}. Mapped to our index: ${matched}/${ourIds.size} (${Math.round((matched / ourIds.size) * 100)}%).`);
console.log(`Top fonts NOT covered by fontjoy (newer than 2018): ${missing.join(", ")}`);
