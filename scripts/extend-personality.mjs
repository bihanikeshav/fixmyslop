// Derive personality for matrix fonts from vibe-affinity (which vibes models
// suggest a font for). Fills coverage beyond the 131 O'Donovan fonts. O'Donovan
// vectors are kept; this only fills fonts that don't have one.
import { readFile, writeFile } from "node:fs/promises";

const VIBE_ATTRS = {
  "ai-saas": ["professional", "technical", "calm"],
  "b2b-saas": ["professional", "formal", "calm"],
  "dev-tool": ["technical", "professional"],
  "fintech": ["professional", "formal", "strong"],
  "luxury-fashion": ["elegant", "dramatic", "delicate"],
  "dtc-brand": ["friendly", "bold", "playful"],
  "magazine-editorial": ["elegant", "formal", "professional"],
  "creative-portfolio": ["dramatic", "bold", "playful"],
  "health-wellness": ["calm", "friendly", "delicate"],
  "gaming-esports": ["bold", "strong", "technical", "dramatic"],
  "education": ["friendly", "playful", "calm"],
  "retro-vintage": ["playful", "friendly", "dramatic"],
};

const matrix = JSON.parse(await readFile("data/slop-matrix.json", "utf8"));
const index = JSON.parse(await readFile("data/fonts.index.json", "utf8"));
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const byId = new Map(index.map((f) => [f.id, f]));

// font id -> {vibe -> fit}
const fits = new Map();
for (const run of matrix.runs) {
  run.fonts.forEach((name, i) => {
    const id = slug(name);
    const m = fits.get(id) ?? {};
    m[run.vibe] = (m[run.vibe] ?? 0) + (20 - i);
    fits.set(id, m);
  });
}

let filled = 0;
for (const [id, vibeFits] of fits) {
  const f = byId.get(id);
  if (!f || f.personalityReal) continue; // keep O'Donovan vectors
  const total = Object.values(vibeFits).reduce((a, b) => a + b, 0);
  if (total === 0) continue;
  const pers = {};
  for (const [vibe, fit] of Object.entries(vibeFits)) {
    const share = fit / total;
    for (const attr of VIBE_ATTRS[vibe] ?? []) pers[attr] = (pers[attr] ?? 0) + share;
  }
  const max = Math.max(...Object.values(pers));
  for (const k of Object.keys(pers)) pers[k] = Math.round((pers[k] / max) * 100) / 100;
  f.personality = pers;
  f.personalitySource = "vibe";
  filled++;
}
// tag the existing ones for clarity
for (const f of index) if (f.personalityReal && !f.personalitySource) f.personalitySource = "odonovan";

await writeFile("data/fonts.index.json", JSON.stringify(index, null, 2));
const real = index.filter((f) => f.personalityReal).length;
console.log(`Personality coverage: ${real} O'Donovan + ${filled} vibe-derived = ${real + filled}/${index.length}`);
for (const id of ["orbitron", "cinzel", "bricolage-grotesque", "russo-one", "marcellus"]) {
  const f = byId.get(id);
  if (f) console.log(`  ${f.family.padEnd(20)} [${f.personalitySource}] ${Object.entries(f.personality).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k}:${v}`).join(" ")}`);
}
