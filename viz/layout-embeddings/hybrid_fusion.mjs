// Late-fusion sketch: visual cosine (DINOv2, top-viewport strategy) + rough
// genome-cosine, at a couple of weightings. Compares hybrid NN vs pure-visual NN.
//
//   node viz/layout-embeddings/hybrid_fusion.mjs
import { readFile, writeFile } from "node:fs/promises";
import { genomeVec, cos } from "./genome_vec.mjs";

const visEmb = JSON.parse(await readFile("viz/layout-embeddings/layout-visual-embeddings.json", "utf8"));
const manifestLines = (await readFile("data/layout-crawl/layout-genome-manifest.v3.ndjson", "utf8")).trim().split("\n");
const genomeLines = (await readFile("data/layout-crawl/layout-genomes.v3.ndjson", "utf8")).trim().split("\n");

const hostAtLine = manifestLines.map((l) => JSON.parse(l).host);
const genomeByHost = {};
for (let i = 0; i < hostAtLine.length; i++) {
  const h = hostAtLine[i];
  if (visEmb[h]) genomeByHost[h] = genomeVec(JSON.parse(genomeLines[i]));
}

const hosts = Object.keys(visEmb).filter((h) => genomeByHost[h]);
console.log(`Hosts with both visual + genome vec: ${hosts.length}`);

function nn(strategy, wVisual, wGenome, queryHost, k = 5) {
  const qv = visEmb[queryHost][strategy];
  const qg = genomeByHost[queryHost];
  const sims = hosts
    .filter((h) => h !== queryHost)
    .map((h) => {
      const sv = cos(qv, visEmb[h][strategy]);
      const sg = cos(qg, genomeByHost[h]);
      return [h, wVisual * sv + wGenome * sg, sv, sg];
    })
    .sort((a, b) => b[1] - a[1])
    .slice(0, k);
  return sims;
}

const QUERIES = ["anthropic.com", "agenta.ai", "cursor.com"].filter((h) => hosts.includes(h));
const WEIGHTS = [
  [1.0, 0.0], // pure visual, baseline
  [0.5, 0.5],
  [0.7, 0.3],
];

const report = {};
for (const q of QUERIES) {
  console.log(`\n=== ${q} ===`);
  report[q] = {};
  for (const [wv, wg] of WEIGHTS) {
    const label = wg === 0 ? "pure-visual" : `${wv}/${wg}`;
    const res = nn("top", wv, wg, q);
    console.log(`  [${label}]`);
    for (const [h, s, sv, sg] of res) console.log(`    ${h.padEnd(30)} fused=${s.toFixed(4)}  vis=${sv.toFixed(3)} genome=${sg.toFixed(3)}`);
    report[q][label] = res.map(([h, s, sv, sg]) => ({ host: h, fused: s, visual: sv, genome: sg }));
  }
}

await writeFile("viz/layout-embeddings/hybrid-fusion-report.json", JSON.stringify(report, null, 2));
console.log("\nWrote viz/layout-embeddings/hybrid-fusion-report.json");
