// Retrieval sanity check: for a handful of query hosts, print top-5 nearest
// neighbors under strategy A (top-viewport) vs strategy B (tiled mean-pool).
//
//   node viz/layout-embeddings/query_nn.mjs
import { readFile, writeFile } from "node:fs/promises";

const emb = JSON.parse(await readFile("viz/layout-embeddings/layout-visual-embeddings.json", "utf8"));
const hosts = Object.keys(emb);
console.log(`Loaded ${hosts.length} hosts`);

function cos(a, b) {
  let d = 0;
  for (let i = 0; i < a.length; i++) d += a[i] * b[i];
  return d;
}

function topK(strategy, queryHost, k = 5) {
  const q = emb[queryHost][strategy];
  const sims = hosts
    .filter((h) => h !== queryHost)
    .map((h) => [h, cos(q, emb[h][strategy])])
    .sort((a, b) => b[1] - a[1])
    .slice(0, k);
  return sims;
}

const QUERIES = ["anthropic.com", "agenta.ai", "adva-soft.com", "productivity.directory", "cursor.com"].filter((h) => emb[h]);

const report = {};
for (const q of QUERIES) {
  console.log(`\n=== ${q} ===`);
  const top = topK("top", q);
  const tiled = topK("tiled", q);
  console.log("  Strategy A (top-viewport):");
  for (const [h, s] of top) console.log(`    ${h.padEnd(30)} ${s.toFixed(4)}`);
  console.log("  Strategy B (tiled mean-pool):");
  for (const [h, s] of tiled) console.log(`    ${h.padEnd(30)} ${s.toFixed(4)}`);
  report[q] = { top, tiled };
}

await writeFile("viz/layout-embeddings/nn-report.json", JSON.stringify(report, null, 2));
console.log("\nWrote viz/layout-embeddings/nn-report.json");
