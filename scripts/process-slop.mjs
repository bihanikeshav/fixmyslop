// Process the collect-slop-matrix workflow result into saturation data + a report.
import { readFile, writeFile } from "node:fs/promises";

const outPath = process.argv[2];
const raw = await readFile(outPath, "utf8");
const json = raw.match(/\{[\s\S]*\}/);
if (!json) throw new Error("no JSON in output file");
const parsed = JSON.parse(json[0]);
const { runs, perVibe, observations } = parsed.result ?? parsed;

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const index = JSON.parse(await readFile("data/fonts.index.json", "utf8"));
const indexIds = new Set(index.map((f) => f.id));

// Persist raw matrix + observations
await writeFile("data/slop-matrix.json", JSON.stringify({ runs, perVibe }, null, 2));

// Global slop ranking, normalized to a 0..1 display-saturation.
const sorted = [...observations].sort((a, b) => b.count - a.count);
const maxCount = sorted[0]?.count ?? 1;
const inIndex = sorted.filter((o) => indexIds.has(o.fontId));

console.log("=== GLOBAL AI SLOP (display role, across 12 vibes x 3 models) ===");
for (const o of sorted.slice(0, 20)) {
  const mark = indexIds.has(o.fontId) ? " " : "✗"; // ✗ = not a real Google Font
  console.log(`  ${mark} ${String(o.count).padStart(4)}  ${o.rawName ?? o.fontId}`);
}
console.log(`\n(✗ = model-invented / non-Google font. ${sorted.length - inIndex.length}/${sorted.length} unique names are not in our index.)`);

// Per-vibe rank-1 unanimity
console.log("\n=== RANK-1 PICK PER VIBE (the peak slop) ===");
for (const pv of perVibe) {
  const picks = Object.entries(pv.rank1).map(([m, f]) => `${m}:${f}`).join("  ");
  const unanimous = new Set(Object.values(pv.rank1)).size === 1 ? "  ← UNANIMOUS" : "";
  console.log(`  ${pv.vibe.padEnd(20)} ${picks}${unanimous}`);
}

// Build merged saturation model: body baseline from seed, display from synthetic.
const seed = JSON.parse(await readFile("data/saturation.seed.json", "utf8"));
const byId = new Map(seed.map((s) => [s.fontId, s]));
let matched = 0;
for (const o of observations) {
  const s = byId.get(o.fontId);
  if (!s) continue;
  s.display = Math.round((o.count / maxCount) * 1000) / 1000;
  matched++;
}
await writeFile("data/saturation.json", JSON.stringify([...byId.values()], null, 2));
console.log(`\nMerged synthetic display-saturation into ${matched} indexed fonts -> data/saturation.json`);
