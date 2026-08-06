// Validation report: for a handful of diverse query hosts, show top-5 nearest
// neighbors under three modes — genome-only, visual-only, hybrid — side by
// side, so a human (or a subsequent screenshot read) can judge coherence.
//
//   node viz/layout-embeddings/validate-layout-neighbors.mjs
import { writeFile } from "node:fs/promises";
import { buildIndex } from "./build-layout-neighbors.mjs";
import { cosine as genomeCosine } from "./genome-vector.mjs";

function to01(cos) {
  return (cos + 1) / 2;
}
function visualCosine(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}
function round(x) {
  return Math.round(x * 10000) / 10000;
}

function topKMode({ index, byHost }, host, k, mode, wv, wg) {
  const q = byHost.get(host);
  const scored = [];
  for (const cand of index) {
    if (cand.host === host) continue;
    const visualSim = to01(visualCosine(q.visual, cand.visual));
    const genomeSim = to01(genomeCosine(q.genome, cand.genome));
    let score;
    if (mode === "genome-only") score = genomeSim;
    else if (mode === "visual-only") score = visualSim;
    else score = wv * visualSim + wg * genomeSim;
    scored.push({ host: cand.host, score: round(score), visualSim: round(visualSim), genomeSim: round(genomeSim) });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

const QUERIES = [
  ["anthropic.com", "AI SaaS / marketing"],
  ["productivity.directory", "directory listing"],
  ["cursor.com", "dev-tool SaaS"],
  ["a16z.com", "bespoke / VC portfolio"],
  ["affogato.ai", "dark SaaS"],
  ["adv-r.hadley.nz", "minimal type / docs"],
];
const WV = 0.65, WG = 0.35, K = 5;

const built = await buildIndex();
const { byHost } = built;

const report = {};
for (const [host, label] of QUERIES) {
  if (!byHost.has(host)) {
    console.log(`SKIP ${host} — not in clean index`);
    continue;
  }
  console.log(`\n=== ${host} (${label}) ===`);
  const modes = {};
  for (const mode of ["genome-only", "visual-only", "hybrid"]) {
    const res = topKMode(built, host, K, mode, WV, WG);
    modes[mode] = res;
    console.log(`  [${mode}]`);
    for (const n of res) console.log(`    ${n.host.padEnd(30)} score=${n.score}  vis=${n.visualSim} genome=${n.genomeSim}`);
  }
  report[host] = { label, modes };
}

await writeFile("viz/layout-embeddings/layout-neighbors-validation.json", JSON.stringify(report, null, 2));
console.log("\nWrote viz/layout-embeddings/layout-neighbors-validation.json");
