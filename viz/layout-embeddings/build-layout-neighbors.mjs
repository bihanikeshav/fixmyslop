// Hybrid layout-retrieval index: given a query site, return the most similar
// GOOD layouts in the clean corpus, fusing a DINOv2 visual embedding (primary)
// with a real LayoutGenome distance (secondary, via genome-vector.mjs).
//
// This is the connected-design-engine payoff: intent/example -> similar good
// layouts, for both the "explore" verb's centrepiece retrieval and general
// font/layout-neighbor style browsing.
//
// Usage:
//   node viz/layout-embeddings/build-layout-neighbors.mjs [--wv=0.65] [--wg=0.35] [--k=10]
//
// Produces (does NOT touch any existing data/genome/embedding files):
//   viz/layout-embeddings/layout-neighbors.hybrid.json
//     { meta: {...}, neighbors: { host: [{host,hybridScore,visualSim,genomeSim}, ...] } }
//
// Also exports queryByHost() / buildIndex() for reuse (e.g. by the design
// engine or a validation script) without re-running the CLI.
import { readFile, writeFile } from "node:fs/promises";
import { fitGenomeCorpus, genomeVector, cosine as genomeCosine } from "./genome-vector.mjs";

const MANIFEST_PATH = "data/layout-crawl/layout-genome-manifest.v3.ndjson";
const GENOMES_PATH = "data/layout-crawl/layout-genomes.v3.ndjson";
const VISUAL_PATH = "viz/layout-embeddings/layout-visual-embeddings.full.json";
const QUARANTINE_PATH = "data/layout-crawl/spam-quarantine.v1.ndjson";
const OUT_PATH = "viz/layout-embeddings/layout-neighbors.hybrid.json";

function cosine(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // both a,b are already unit-norm visual embeddings
}

// Cosine similarity lives in [-1, 1]; rescale to [0, 1] so visual and genome
// similarity are on a comparable scale before fusing.
function to01(cos) {
  return (cos + 1) / 2;
}

export async function buildIndex() {
  const [manifestRaw, genomesRaw, visualRaw, quarantineRaw] = await Promise.all([
    readFile(MANIFEST_PATH, "utf8"),
    readFile(GENOMES_PATH, "utf8"),
    readFile(VISUAL_PATH, "utf8"),
    readFile(QUARANTINE_PATH, "utf8"),
  ]);

  const manifestLines = manifestRaw.trim().split("\n");
  const genomeLines = genomesRaw.trim().split("\n");
  if (manifestLines.length !== genomeLines.length) {
    throw new Error(`manifest/genome line-count mismatch: ${manifestLines.length} vs ${genomeLines.length}`);
  }

  const quarantinedHosts = new Set(quarantineRaw.trim().split("\n").map((l) => JSON.parse(l).host));
  const visEmb = JSON.parse(visualRaw);

  // Align genome[i] <-> manifest[i].host, keep only hosts that: have a visual
  // embedding, are not quarantined, and (host de-dupe) haven't been seen yet.
  const seen = new Set();
  const records = []; // { host, genome }
  for (let i = 0; i < manifestLines.length; i++) {
    const host = JSON.parse(manifestLines[i]).host;
    if (quarantinedHosts.has(host)) continue;
    if (!visEmb[host]) continue;
    if (seen.has(host)) continue;
    seen.add(host);
    records.push({ host, genome: JSON.parse(genomeLines[i]) });
  }

  console.log(`Manifest/genome lines: ${manifestLines.length}`);
  console.log(`Visual embeddings: ${Object.keys(visEmb).length}`);
  console.log(`Quarantined hosts excluded: ${quarantinedHosts.size}`);
  console.log(`Clean corpus (genome ∩ embedding, minus quarantine): ${records.length}`);

  // Fit genome z-score stats over exactly this clean corpus.
  const stats = fitGenomeCorpus(records.map((r) => r.genome));

  // Surface any field whose raw std is ~0 (constant across the corpus, so
  // z-scoring contributes ~0 signal even though guarded against divide-by-zero).
  for (const s of stats.numericStats) {
    if (s.constant) console.log(`  [warn] numeric field appears constant across corpus: ${s.name}`);
  }

  const index = records.map((r) => ({
    host: r.host,
    visual: visEmb[r.host].top,
    genome: genomeVector(r.genome, stats),
  }));

  const byHost = new Map(index.map((e) => [e.host, e]));

  return { index, byHost, stats };
}

export function queryByHost({ index, byHost }, host, k = 10, wv = 0.65, wg = 0.35) {
  const q = byHost.get(host);
  if (!q) throw new Error(`host not in clean index: ${host}`);
  const scored = [];
  for (const cand of index) {
    if (cand.host === host) continue;
    const visualSim = to01(cosine(q.visual, cand.visual));
    const genomeSim = to01(genomeCosine(q.genome, cand.genome));
    const hybridScore = wv * visualSim + wg * genomeSim;
    scored.push({ host: cand.host, hybridScore, visualSim, genomeSim });
  }
  scored.sort((a, b) => b.hybridScore - a.hybridScore);
  return scored.slice(0, k).map((s) => ({
    host: s.host,
    hybridScore: round(s.hybridScore),
    visualSim: round(s.visualSim),
    genomeSim: round(s.genomeSim),
  }));
}

function round(x) {
  return Math.round(x * 10000) / 10000;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------
async function main() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const m = a.match(/^--([\w-]+)=(.*)$/);
      return m ? [m[1], m[2]] : [a.replace(/^--/, ""), true];
    })
  );
  const wv = args.wv !== undefined ? Number(args.wv) : 0.65;
  const wg = args.wg !== undefined ? Number(args.wg) : 0.35;
  const k = args.k !== undefined ? Number(args.k) : 10;

  console.log(`Fusion weights: WV=${wv} WG=${wg} (K=${k})`);

  const built = await buildIndex();
  const { index } = built;

  const neighbors = {};
  for (const entry of index) {
    neighbors[entry.host] = queryByHost(built, entry.host, k, wv, wg);
  }

  const out = {
    meta: {
      generatedAt: new Date().toISOString(),
      corpusSize: index.length,
      k,
      weights: { visual: wv, genome: wg },
      visualSource: VISUAL_PATH,
      genomeSource: GENOMES_PATH,
      manifestSource: MANIFEST_PATH,
      quarantineSource: QUARANTINE_PATH,
      note: "hybridScore = wv*visualSim01 + wg*genomeSim01, both cosine similarities rescaled from [-1,1] to [0,1]",
    },
    neighbors,
  };

  await writeFile(OUT_PATH, JSON.stringify(out, null, 2));
  console.log(`Wrote ${OUT_PATH} (${index.length} hosts, top-${k} each)`);

  for (const h of ["anthropic.com", "cursor.com"]) {
    if (neighbors[h]) {
      console.log(`\n${h}:`);
      for (const n of neighbors[h].slice(0, 5)) console.log(`  ${n.host.padEnd(30)} hybrid=${n.hybridScore} vis=${n.visualSim} genome=${n.genomeSim}`);
    }
  }
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}` || process.argv[1]?.endsWith("build-layout-neighbors.mjs")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
