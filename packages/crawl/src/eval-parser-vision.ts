/**
 * Vision eval harness for the v3 layout parser.
 *
 * Measures STRUCTURAL accuracy: does the parser's sectionGrammar read
 * (ordered roles, hero/nav/footer presence, section count) match what's
 * actually on the screenshot? This is a *sampling + scaffolding* tool —
 * it does NOT do the visual judgment itself. It:
 *
 *   1. Loads the v3 genomes + aligned manifest (host per line, same index).
 *   2. Picks a stratified sample of hosts by section count (small/medium/large),
 *      excluding hosts whose desktop screenshot looks dead/parked (tiny file size).
 *   3. Emits one comparison-scaffold record per sampled host to
 *      data/layout-crawl/parser-eval.v3.ndjson, with the screenshot path,
 *      the parser's ordered role sequence, and key macro fields — plus
 *      empty fields for a human/vision judge to fill in:
 *        heroCorrect, navCorrect, footerCorrect, sectionCountVerdict,
 *        roleAgreement, notes.
 *
 * Re-run later with different N / seed / hosts to re-sample, or point
 * SOURCE_* at a gallery genome set to eval a different population.
 *
 * Usage:
 *   npx tsx packages/crawl/src/eval-parser-vision.ts [--n 20] [--seed 42]
 *
 * This script only READS the v1/v2/v3 genome + manifest files. It never
 * writes to them, and never touches the parser itself.
 */

import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../../");

const GENOMES_PATH = join(REPO_ROOT, "data/layout-crawl/layout-genomes.v3.ndjson");
const MANIFEST_PATH = join(REPO_ROOT, "data/layout-crawl/layout-genome-manifest.v3.ndjson");
const OUT_PATH = join(REPO_ROOT, "data/layout-crawl/parser-eval.v3.ndjson");

// Screenshots this small are almost always dead/parked/blocked pages
// (observed cluster of near-identical ~5.8-8.5KB files across the crawl).
const DEAD_SCREENSHOT_BYTES = 9000;

interface SectionGrammarEntry {
  role: string;
  roleConfidence?: number;
  heightShare?: number;
  heading?: string;
  focalPoint?: string;
  composition?: string;
  featureShape?: string;
}

interface LayoutGenomeV3 {
  pageKind?: string;
  sectionGrammar?: SectionGrammarEntry[];
  macro?: {
    columnCount?: number;
    alignment?: string;
    whitespace?: number;
    contentDensity?: number;
  };
  bandRhythm?: { darkBandCount?: number; bgHueCount?: number };
}

interface ManifestEntry {
  host: string;
  url: string;
  screenshots: { desktop: string; mobile?: string };
  schemaVersion: string;
}

interface EvalRecord {
  host: string;
  url: string;
  screenshotDesktop: string;
  sizeBucket: "small" | "medium" | "large";
  sectionCount: number;
  pageKind: string | undefined;
  parserRoles: string[];
  parserSectionGrammar: Array<{ role: string; roleConfidence?: number; heightShare?: number; heading?: string }>;
  macro: LayoutGenomeV3["macro"];
  bandRhythm: LayoutGenomeV3["bandRhythm"];
  // --- fields for the vision judge to fill in ---
  heroCorrect: boolean | null;
  navCorrect: boolean | null;
  footerCorrect: boolean | null;
  sectionCountVerdict: "about right" | "over-segmented" | "under-segmented" | null;
  roleAgreement: number | null;
  notes: string;
}

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      args[key] = val;
    }
  }
  return args;
}

// Deterministic PRNG (mulberry32) so samples are reproducible given a seed.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function bucketFor(sectionCount: number): "small" | "medium" | "large" | null {
  if (sectionCount >= 4 && sectionCount <= 6) return "small";
  if (sectionCount >= 8 && sectionCount <= 12) return "medium";
  if (sectionCount > 15) return "large";
  return null; // 7 or 13-15: gap bands, not part of any stratum target
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const N = args.n ? parseInt(args.n, 10) : 20;
  const seed = args.seed ? parseInt(args.seed, 10) : 42;

  const genomeLines = readFileSync(GENOMES_PATH, "utf8").trim().split("\n");
  const manifestLines = readFileSync(MANIFEST_PATH, "utf8").trim().split("\n");

  if (genomeLines.length !== manifestLines.length) {
    throw new Error(
      `genome/manifest line count mismatch: ${genomeLines.length} vs ${manifestLines.length} — files are supposed to be aligned by index`,
    );
  }

  const buckets: Record<"small" | "medium" | "large", { genome: LayoutGenomeV3; manifest: ManifestEntry; idx: number }[]> = {
    small: [],
    medium: [],
    large: [],
  };

  let deadSkipped = 0;

  for (let i = 0; i < genomeLines.length; i++) {
    const genome: LayoutGenomeV3 = JSON.parse(genomeLines[i]);
    const manifest: ManifestEntry = JSON.parse(manifestLines[i]);
    const sectionCount = genome.sectionGrammar?.length ?? 0;
    const bucket = bucketFor(sectionCount);
    if (!bucket) continue;

    const shotPath = join(REPO_ROOT, manifest.screenshots.desktop);
    if (!existsSync(shotPath)) {
      deadSkipped++;
      continue;
    }
    const size = statSync(shotPath).size;
    if (size < DEAD_SCREENSHOT_BYTES) {
      deadSkipped++;
      continue;
    }

    buckets[bucket].push({ genome, manifest, idx: i });
  }

  // Target roughly even thirds of N across small/medium/large.
  const perBucket = Math.floor(N / 3);
  const remainder = N - perBucket * 3;
  const targets: Record<"small" | "medium" | "large", number> = {
    small: perBucket + (remainder > 0 ? 1 : 0),
    medium: perBucket + (remainder > 1 ? 1 : 0),
    large: perBucket,
  };

  const rng = mulberry32(seed);
  const sampled: { genome: LayoutGenomeV3; manifest: ManifestEntry; idx: number; bucket: "small" | "medium" | "large" }[] = [];

  for (const bucket of ["small", "medium", "large"] as const) {
    const pool = shuffle(buckets[bucket], rng);
    const take = Math.min(targets[bucket], pool.length);
    for (const entry of pool.slice(0, take)) {
      sampled.push({ ...entry, bucket });
    }
  }

  // If any bucket came up short, backfill from the largest remaining pool
  // (medium is by far the biggest bucket in this dataset) to still hit N.
  if (sampled.length < N) {
    const used = new Set(sampled.map((s) => s.idx));
    const backfillPool = shuffle(
      [...buckets.medium, ...buckets.small, ...buckets.large].filter((e) => !used.has(e.idx)),
      rng,
    );
    for (const entry of backfillPool) {
      if (sampled.length >= N) break;
      sampled.push({ ...entry, bucket: bucketFor(entry.genome.sectionGrammar?.length ?? 0) ?? "medium" });
    }
  }

  const records: EvalRecord[] = sampled.map(({ genome, manifest, bucket }) => {
    const sections = genome.sectionGrammar ?? [];
    return {
      host: manifest.host,
      url: manifest.url,
      screenshotDesktop: manifest.screenshots.desktop,
      sizeBucket: bucket,
      sectionCount: sections.length,
      pageKind: genome.pageKind,
      parserRoles: sections.map((s) => s.role),
      parserSectionGrammar: sections.map((s) => ({
        role: s.role,
        roleConfidence: s.roleConfidence,
        heightShare: s.heightShare,
        heading: s.heading,
      })),
      macro: genome.macro,
      bandRhythm: genome.bandRhythm,
      heroCorrect: null,
      navCorrect: null,
      footerCorrect: null,
      sectionCountVerdict: null,
      roleAgreement: null,
      notes: "",
    };
  });

  const ndjson = records.map((r) => JSON.stringify(r)).join("\n") + "\n";
  writeFileSync(OUT_PATH, ndjson, "utf8");

  console.log(
    `Sampled ${records.length}/${N} hosts (small=${records.filter((r) => r.sizeBucket === "small").length}, ` +
      `medium=${records.filter((r) => r.sizeBucket === "medium").length}, large=${records.filter((r) => r.sizeBucket === "large").length}); ` +
      `skipped ${deadSkipped} dead/missing screenshots. Wrote ${OUT_PATH}`,
  );
  for (const r of records) {
    console.log(`  [${r.sizeBucket.padEnd(6)}] ${r.host} — ${r.sectionCount} sections — ${r.screenshotDesktop}`);
  }
}

main();
