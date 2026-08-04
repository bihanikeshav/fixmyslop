// apps/engine/scripts/haiku-val-gen.mjs — Haiku validation A/B test harness (engine side).
//
// Build-time script (uses fs) — NOT imported by the pure engine at runtime. For 3 intents, picks
// explore direction 0 (deterministic seed, stated below) and emits:
//   - the genome-derived build-spec (Arm A input: genome → genomeToSpec() → literal instructions)
//   - a matched bare-control brief (Arm B input: same product, one plain sentence, zero design
//     guidance — same deliverable format so only the design guidance differs between arms)
//   - genomes.json (the 3 raw genomes, for reference/debugging)
//
// Run: node apps/engine/scripts/haiku-val-gen.mjs
//
// This script does NOT call Haiku and does NOT render HTML — that's the main loop's job, driven
// off the files this script writes under data/tmp/haiku-val/.

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

// Deterministic seed for every intent's exploreDirections() call — same seed across all 3 so the
// run is fully reproducible end to end; direction 0 (index 0 of the returned `directions` array)
// is picked for each, per the task spec ("direction 0, deterministic seed").
const SEED = 42;
const DIRECTION_INDEX = 0;

const engine = createEngine({ corpus, brands, fonts });

// The 3 intents (diverse archetypes) + a matched one-sentence bare-control brief for Arm B. The
// bare brief describes the SAME product/site in one plain sentence, asks for the SAME deliverable
// (single self-contained HTML file), and gives ZERO design guidance — no colors, fonts, layout,
// or motion words — so the only variable between Arm A and Arm B is whether the genome build-spec
// was supplied.
const INTENTS = [
  {
    id: "landing-devtool",
    label: "Landing page — developer API platform / observability tool",
    intentInput: {
      surface: "landing-page",
      job: "explain-and-convert",
      sourceBrief: "a landing page for a developer API platform / observability tool",
    },
    briefSentence:
      "Build a landing page for a developer API platform / observability tool that helps engineering teams monitor and debug their production APIs.",
  },
  {
    id: "portfolio-studio",
    label: "Portfolio — independent creative design studio",
    intentInput: {
      surface: "portfolio",
      sourceBrief: "a portfolio site for an independent creative design studio",
    },
    briefSentence:
      "Build a portfolio site for an independent creative design studio that showcases its branding and digital product work for clients.",
  },
  {
    id: "dashboard-saas",
    label: "Dashboard — analytics dashboard for a SaaS product",
    intentInput: {
      surface: "dashboard",
      job: "monitor",
      sourceBrief: "an analytics dashboard for a SaaS product",
    },
    briefSentence:
      "Build an analytics dashboard for a SaaS product that shows a company's key usage and revenue metrics.",
  },
];

const DELIVERABLE_LINE =
  "Build a complete, single-file HTML page for this: inline all CSS in a <style> tag and all JS " +
  "in a <script> tag, no external stylesheets, fonts, scripts, or image requests.";

function bareBrief(entry) {
  return `# Brief

${entry.briefSentence}

${DELIVERABLE_LINE}
`;
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const genomesOut = [];
const summaries = [];

for (let i = 0; i < INTENTS.length; i++) {
  const entry = INTENTS[i];
  const n = i + 1;
  const { directions, warnings } = exploreDirections(engine, entry.intentInput, { seed: SEED, count: 4 });
  if (!directions.length) {
    throw new Error(`[${entry.id}] exploreDirections returned zero directions — warnings: ${warnings.join("; ")}`);
  }
  const direction = directions[DIRECTION_INDEX];
  const genome = direction.genome;

  const spec = genomeToSpec(genome);
  fs.writeFileSync(path.join(OUT_DIR, `spec-${n}.md`), spec, "utf8");
  fs.writeFileSync(path.join(OUT_DIR, `brief-${n}.md`), bareBrief(entry), "utf8");

  genomesOut.push({
    id: entry.id,
    label: entry.label,
    intentInput: entry.intentInput,
    seed: SEED,
    directionIndex: DIRECTION_INDEX,
    directionName: direction.name,
    fingerprint: direction.fingerprint,
    provenance: direction.provenance,
    groundedIn: direction.groundedIn,
    exploreWarnings: warnings,
    genome,
  });

  summaries.push({
    id: entry.id,
    label: entry.label,
    directionName: direction.name,
    layoutFamily: genome.layout?.family,
    displayFont: genome.type?.display?.family,
    bodyFont: genome.type?.body?.family,
    accent: genome.color?.accent,
    ground: genome.color?.ground,
    backgroundTreatment: genome.background?.field?.treatment,
    warnings,
  });
}

fs.writeFileSync(path.join(OUT_DIR, "genomes.json"), JSON.stringify(genomesOut, null, 2), "utf8");

for (const s of summaries) {
  console.log(`[${s.id}] direction="${s.directionName}" layout=${s.layoutFamily} fonts=${s.displayFont}/${s.bodyFont} accent=${s.accent} bg=${s.backgroundTreatment}${s.warnings.length ? ` warnings=${s.warnings.join(",")}` : ""}`);
}
console.log(`\nWrote spec-1..3.md, brief-1..3.md, genomes.json to ${OUT_DIR}`);
