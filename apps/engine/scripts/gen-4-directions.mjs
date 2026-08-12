// apps/engine/scripts/gen-4-directions.mjs — writes all 4 explore directions for ONE prompt
// (modeled on haiku-val-gen.mjs, but for a single intent × all 4 directions instead of 3 intents ×
// direction 0). Used to eyeball/verify the token-quality overhaul (font/color/material variety
// across a single explore() call) end to end as real genomeToSpec() build-specs, not just the raw
// diagnostic dump.
//
// Run: node apps/engine/scripts/gen-4-directions.mjs
//
// Build-time script (uses fs) — NOT imported by the pure engine at runtime.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createEngine } from "../engine.mjs";
import { exploreDirections } from "../explore.mjs";
import { genomeToSpec } from "../spec.mjs";
import corpus from "../data/corpus.json" with { type: "json" };
import brands from "../data/brands.json" with { type: "json" };
import fonts from "../data/fonts.json" with { type: "json" };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../../../data/tmp/haiku-val");

const SEED = 42;
const intentInput = {
  surface: "landing-page",
  job: "explain-and-convert",
  sourceBrief: "a landing page for a developer API platform / observability tool",
};

const engine = createEngine({ corpus, brands, fonts });

fs.mkdirSync(OUT_DIR, { recursive: true });

const { directions, warnings } = exploreDirections(engine, intentInput, { seed: SEED, count: 4 });
if (!directions.length) {
  throw new Error(`exploreDirections returned zero directions — warnings: ${warnings.join("; ")}`);
}

const genomesOut = [];
for (let i = 0; i < directions.length; i++) {
  const direction = directions[i];
  const genome = direction.genome;
  const spec = genomeToSpec(genome);
  fs.writeFileSync(path.join(OUT_DIR, `spec-d${i}.md`), spec, "utf8");

  genomesOut.push({
    index: i,
    directionName: direction.name,
    fingerprint: direction.fingerprint,
    provenance: direction.provenance,
    groundedIn: direction.groundedIn,
    genome,
  });

  console.log(
    `[d${i}] direction="${direction.name}" layout=${genome.layout?.family} `
    + `fonts=${genome.type?.display?.family}/${genome.type?.body?.family} `
    + `mood=${genome.color?.mood} ground=${genome.color?.ground} accent=${genome.color?.accent} `
    + `hue=${Math.round(genome.color?.hue ?? -1)} material.radiusBase=${genome.material?.radii?.md} `
    + `shadowLang=${genome.material?.shadowLanguage}`,
  );
}

fs.writeFileSync(path.join(OUT_DIR, "genomes-4.json"), JSON.stringify({ intentInput, seed: SEED, warnings, directions: genomesOut }, null, 2), "utf8");
console.log(`\nwarnings=${warnings.join(", ") || "none"}`);
console.log(`Wrote spec-d0..d3.md, genomes-4.json to ${OUT_DIR}`);
