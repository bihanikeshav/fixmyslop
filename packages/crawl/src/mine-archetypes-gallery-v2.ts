/**
 * Re-mine of the gallery archetype pool, v2 — same corpus/inputs as
 * mine-archetypes-gallery.ts (v1), with TWO fixes a pixel-level review of the v1 output exposed:
 *
 *   FIX 1 (blank/over-tall guard): v1's pre-filter let through screenshots that render as
 *   essentially blank or grossly over-tall/degenerate (font.k95.it: 30k-px page, ~97% uniform
 *   white; drxlr.com: ~99% uniform black; temporaryliveness.org: nav>features only, near-blank).
 *   Blank pages have near-uniform luminance and score falsely HIGH visual coherence (all-white /
 *   all-black screenshots cosine very close to each other), so they masquerade as archetypes.
 *   This version scans every gallery screenshot with PIL (packages/crawl/src/mine-archetypes-
 *   gallery-v2.guard-scan.py -> data/layout-crawl/screenshot-luminance.gallery.v2.json) and drops
 *   any host matching:
 *     (a) near-uniform screenshot: frac(pixels within 10 of black or white) >= 0.95 AND stdev < 45
 *     (b) over-tall + low-density-and-uniform OR over-segmented: page_h > 16000 AND
 *         ((contentDensity < 0.25 AND stdev < 45) OR (>25 sections, >70% features/unknown))
 *     (c) content-starved sectionGrammar: nav/footer-only sequence, OR <=2 non-nav/footer
 *         sections with no hero AND low visual variance (stdev < 30 OR extreme-pixel frac > 0.9)
 *
 *   FIX 2 (non-chaining clustering): v1 used average-linkage, which chained the 200-host portfolio
 *   pool into one 52-member catch-all (portfolio-6). This version clusters with WARD linkage
 *   (resists chaining by minimizing within-cluster variance) over a combined-distance-preserving
 *   Euclidean embedding (see buildCombinedVector below — block-scaled concatenation of the unit
 *   visual embedding, z-scored numeric fields, unit feature-shape vector and unit role-sequence
 *   vector, chosen so squared Euclidean distance in the concatenation approximates the same
 *   0.55/0.25/0.12/0.08 combined distance v1 used). Any Ward cluster landing >20 members is
 *   recursively bisected (2-means) until sub-clusters are <=20 or a half would drop below the
 *   min cluster size. A visualCoherence floor (>=0.5, true DINOv2 cosine, not the approximation)
 *   is applied AFTER clustering to drop forced/incoherent fits (the app-14 failure mode).
 *   The Ward mechanics run in Python (scipy + scikit-learn) via
 *   packages/crawl/src/mine-archetypes-gallery-v2.cluster.py — this file shells out to it.
 *
 * Same non-negotiables as v1: never edits apps/engine, never authors semantic copy, never commits.
 *
 * Usage:
 *   npx tsx src/mine-archetypes-gallery-v2.ts
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

// @ts-ignore no declaration file for the frozen .mjs module.
import { fitGenomeCorpus, genomeVector, cosine } from "../../../viz/layout-embeddings/genome-vector.mjs";
// @ts-ignore no declaration file.
import { canonicalRole } from "../../../apps/engine/role-aliases.mjs";

const HERE = dirname(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (m) => m.slice(1)));
const ROOT = resolve(HERE, "../../..");
const LC = resolve(ROOT, "data/layout-crawl");
const VIZ = resolve(ROOT, "viz/layout-embeddings");
const SCRATCH = resolve(LC, "_scratch-v2");

const GENOMES_PATH = resolve(LC, "layout-genomes.gallery-final.ndjson");
const MANIFEST_PATH = resolve(LC, "layout-genome-manifest.gallery-final.ndjson");
const VISUAL_EMBEDDINGS_PATH = resolve(VIZ, "layout-visual-embeddings.gallery.json");
const FAMILIES_PATH = resolve(ROOT, "apps/engine/layout-families.mjs");
const LUMINANCE_PATH = resolve(LC, "screenshot-luminance.gallery.v2.json");
const CLUSTER_PY = resolve(HERE, "mine-archetypes-gallery-v2.cluster.py");

const OUT_PROPOSALS = resolve(LC, "archetype-proposals.gallery.v2.json");
const OUT_REVIEW = resolve(LC, "archetype-review-sheet.gallery.v2.json");

type AnyRecord = Record<string, any>;

// ---------------------------------------------------------------------------
// numeric utils (unchanged from v1)
// ---------------------------------------------------------------------------
const clamp01 = (x: number, fallback = 0.5): number => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : fallback);
const round = (x: number, d = 4): number => Number(x.toFixed(d));
function median(xs: number[]): number {
  const s = xs.filter(Number.isFinite).slice().sort((a, b) => a - b);
  if (!s.length) return 0;
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}
function percentile(xs: number[], p: number): number {
  const s = xs.filter(Number.isFinite).slice().sort((a, b) => a - b);
  if (!s.length) return 0;
  const idx = clamp01(p) * (s.length - 1);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  if (lo === hi) return s[lo]!;
  const frac = idx - lo;
  return s[lo]! * (1 - frac) + s[hi]! * frac;
}
function mode<T>(xs: T[]): T {
  const counts = new Map<string, { v: T; n: number }>();
  for (const x of xs) {
    const k = JSON.stringify(x);
    const e = counts.get(k);
    if (e) e.n++;
    else counts.set(k, { v: x, n: 1 });
  }
  let best: { v: T; n: number } | null = null;
  for (const e of counts.values()) if (!best || e.n > best.n) best = e;
  return best!.v;
}
function unitNorm(v: number[]): number[] {
  const n = Math.hypot(...v) || 1;
  return v.map((x) => x / n);
}
function meanVector(vecs: number[][]): number[] {
  const n = vecs.length || 1;
  const dim = vecs[0]?.length ?? 0;
  const out = new Array(dim).fill(0);
  for (const v of vecs) for (let i = 0; i < dim; i++) out[i] += v[i] / n;
  return out;
}
function meanPairwiseCosine(vecs: number[][]): number {
  if (vecs.length < 2) return 1;
  let sum = 0, count = 0;
  for (let i = 0; i < vecs.length; i++) {
    for (let j = i + 1; j < vecs.length; j++) {
      sum += cosine(vecs[i], vecs[j]);
      count++;
    }
  }
  return count ? sum / count : 1;
}
function widenRange(lo: number, hi: number, minWidth: number): [number, number] {
  if (hi - lo >= minWidth) return [round(lo, 3), round(hi, 3)];
  const mid = (lo + hi) / 2;
  return [round(clamp01(mid - minWidth / 2), 3), round(clamp01(mid + minWidth / 2), 3)];
}

async function loadNdjson(path: string): Promise<AnyRecord[]> {
  const raw = await readFile(path, "utf8");
  return raw.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => JSON.parse(l));
}

// ---------------------------------------------------------------------------
// role-INDEPENDENT numeric fields (unchanged from v1)
// ---------------------------------------------------------------------------
const NUMERIC_FIELD_GETTERS: [string, (g: AnyRecord) => number][] = [
  ["macro.whitespace", (g) => g.macro?.whitespace],
  ["macro.contentDensity", (g) => g.macro?.contentDensity],
  ["macro.splitRatio", (g) => g.macro?.splitRatio],
  ["macro.columnCount", (g) => g.macro?.columnCount],
  ["macro.contentWidthShare", (g) => g.macro?.contentWidthShare],
  ["macro.grid.gridColumns", (g) => g.macro?.grid?.gridColumns],
  ["macro.grid.gutterShare", (g) => g.macro?.grid?.gutterShare],
  ["macro.grid.outerMarginShare", (g) => g.macro?.grid?.outerMarginShare],
  ["hierarchy.focalAreaShare", (g) => g.hierarchy?.focalAreaShare],
  ["hierarchy.contrastConcentration", (g) => g.hierarchy?.contrastConcentration],
  ["hierarchy.headingScaleRatio", (g) => g.hierarchy?.headingScaleRatio],
  ["hierarchy.ctaProminence", (g) => g.hierarchy?.ctaProminence],
  ["hierarchy.repetitionEntropy", (g) => g.hierarchy?.repetitionEntropy],
  ["layeringDepth", (g) => g.layeringDepth],
  ["bandRhythm.darkBandCount", (g) => g.bandRhythm?.darkBandCount],
  ["bandRhythm.stripeAlternation", (g) => g.bandRhythm?.stripeAlternation],
  ["bandRhythm.bgHueCount", (g) => g.bandRhythm?.bgHueCount],
];

function fitNumericStats(genomes: AnyRecord[]) {
  return NUMERIC_FIELD_GETTERS.map(([name, get]) => {
    const xs = genomes.map((g) => Number(get(g) ?? 0)).filter(Number.isFinite);
    const m = xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
    const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length || 1);
    const s = Math.sqrt(v);
    return { name, m, s: s < 1e-9 ? 1 : s };
  });
}
function numericZVector(g: AnyRecord, stats: ReturnType<typeof fitNumericStats>): number[] {
  return NUMERIC_FIELD_GETTERS.map(([, get], i) => {
    const { m, s } = stats[i];
    return (Number(get(g) ?? 0) - m) / s;
  });
}
function euclid(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

const FEATURE_SHAPES = ["card-grid", "zigzag", "bento", "stat-band", "showcase", "steps", "plain"];
function featureShapeVector(sectionGrammar: AnyRecord[]): number[] {
  const counts = Object.fromEntries(FEATURE_SHAPES.map((s) => [s, 0]));
  for (const s of sectionGrammar ?? []) {
    const shape = FEATURE_SHAPES.includes(s.featureShape) ? s.featureShape : "plain";
    counts[shape] += Number(s.heightShare ?? 1);
  }
  const total = Object.values(counts).reduce((a: number, b) => a + (b as number), 0) || 1;
  return FEATURE_SHAPES.map((s) => counts[s] / total);
}

// ---------------------------------------------------------------------------
// §1.4-style encoding (unchanged from v1)
// ---------------------------------------------------------------------------
const layoutVarianceProxy = (g: AnyRecord): number => {
  const splitTerm = (0.3 * Math.abs((g.macro?.splitRatio ?? 0.5) - 0.5)) / 0.3;
  const alignTerm = 0.3 * (g.macro?.alignment !== "left-led" ? 1 : 0);
  const stripeTerm = 0.2 * clamp01(g.bandRhythm?.stripeAlternation ?? 0);
  const repTerm = 0.2 * clamp01(g.hierarchy?.repetitionEntropy ?? 0);
  return clamp01(splitTerm + alignTerm + stripeTerm + repTerm);
};

function findVisualCentroidHost(recs: AnyRecord[], embByHost: Map<string, number[]>): { host: string; sim: number } {
  const vecs = recs.map((r) => embByHost.get(r.host)!);
  const centroid = unitNorm(meanVector(vecs));
  let best: { host: string; sim: number } | null = null;
  for (let k = 0; k < recs.length; k++) {
    const sim = cosine(vecs[k], centroid);
    if (!best || sim > best.sim) best = { host: recs[k].host, sim };
  }
  return best!;
}

function encodeProposal(cluster: AnyRecord, embByHost: Map<string, number[]>): AnyRecord {
  const recs: AnyRecord[] = cluster.memberRecs;
  const genomes = recs.map((r) => r.genome);

  const macro = {
    contentWidthShare: round(median(genomes.map((g) => g.macro?.contentWidthShare)), 3),
    columnCount: Math.round(median(genomes.map((g) => g.macro?.columnCount))),
    splitRatio: round(median(genomes.map((g) => g.macro?.splitRatio)), 3),
    alignment: mode(genomes.map((g) => g.macro?.alignment)),
    whitespace: round(median(genomes.map((g) => g.macro?.whitespace)), 3),
    contentDensity: round(median(genomes.map((g) => g.macro?.contentDensity)), 3),
    grid: {
      gridColumns: Math.round(median(genomes.map((g) => g.macro?.grid?.gridColumns))),
      gutterShare: round(median(genomes.map((g) => g.macro?.grid?.gutterShare)), 4),
      outerMarginShare: round(median(genomes.map((g) => g.macro?.grid?.outerMarginShare)), 4),
    },
  };

  const sequences = genomes.map((g) => (g.sectionGrammar ?? []).map((s: AnyRecord) => s.role));
  const modalSeqStr = mode(sequences.map((seq) => JSON.stringify(seq))) as unknown as string;
  const modalSeqArr: string[] = JSON.parse(modalSeqStr);
  const sharing = genomes.filter((g) => JSON.stringify((g.sectionGrammar ?? []).map((s: AnyRecord) => s.role)) === modalSeqStr);

  const focalModal = (pos: number) => mode(sharing.map((g) => g.sectionGrammar[pos]?.focalPoint ?? "center"));
  const shapeModal = (pos: number) => mode(sharing.map((g) => g.sectionGrammar[pos]?.featureShape ?? "plain"));
  const heightMedian = (pos: number) => median(sharing.map((g) => Number(g.sectionGrammar[pos]?.heightShare ?? 0)));

  const rawShares = modalSeqArr.map((_, pos) => heightMedian(pos));
  const shareSum = rawShares.reduce((a, b) => a + b, 0) || 1;
  const sectionGrammar = modalSeqArr.map((role, pos) => ({
    role,
    heightShare: round(rawShares[pos] / shareSum, 4),
    focalPoint: focalModal(pos),
    featureShape: shapeModal(pos),
    composition: "TODO: author composition string (human curation)",
  }));

  const densities = genomes.map((g) => Number(g.macro?.contentDensity ?? 0.5));
  const dialCompatibility = {
    contentDensity: widenRange(percentile(densities, 0.1), percentile(densities, 0.9), 0.15),
    layoutVariance: (() => {
      const vs = genomes.map((g) => layoutVarianceProxy(g));
      return widenRange(percentile(vs, 0.1), percentile(vs, 0.9), 0.3);
    })(),
  };

  const visualCentroid = findVisualCentroidHost(recs, embByHost);
  const memberVecs = recs.map((r) => embByHost.get(r.host)!);
  const visualCoherence = round(meanPairwiseCosine(memberVecs), 4);

  const allShapes = genomes.flatMap((g) => (g.sectionGrammar ?? []).map((s: AnyRecord) => s.featureShape ?? "plain"));
  const shapeCounts: Record<string, number> = {};
  for (const s of allShapes) shapeCounts[s] = (shapeCounts[s] ?? 0) + 1;
  const dominantShape = Object.entries(shapeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "plain";

  const sampleHosts = recs.slice(0, 10).map((r) => r.host);

  return {
    name: "TODO: author name (structure-intent convention, e.g. research-index-grid)",
    pageKind: cluster.pageKind,
    whenToUse: ["TODO: author (human curation vs representative screenshots)"],
    notFor: ["TODO: author"],
    dialCompatibility,
    requiredContent: ["TODO: author"],
    antiPatterns: ["TODO: author"],
    mobileTransform: "TODO: author",
    materialSlots: ["TODO: author"],
    sectionGrammar,
    macro,
    provenance: "crawl-derived",
    evidence: {
      clusterId: cluster.clusterId,
      memberCount: recs.length,
      representativeHost: visualCentroid.host,
      sourceGallery: "design-forward-gallery-v1",
      visualCoherence,
      dominantFeatureShape: dominantShape,
      nearestAuthoredFamily: cluster.nearestAuthored ? { name: cluster.nearestAuthored.name, cosine: round(cluster.nearestAuthored.sim, 4) } : null,
      sampleMemberHosts: sampleHosts,
    },
  };
}

function buildReviewEntry(cluster: AnyRecord, embByHost: Map<string, number[]>, manifestByHost: Map<string, AnyRecord>): AnyRecord {
  const recs: AnyRecord[] = cluster.memberRecs;
  const visualCentroid = findVisualCentroidHost(recs, embByHost);
  const repHost = visualCentroid.host;
  const repManifest = manifestByHost.get(repHost);
  const memberVecs = recs.map((r) => embByHost.get(r.host)!);

  return {
    clusterId: cluster.clusterId,
    pageKind: cluster.pageKind,
    memberCount: recs.length,
    visualCoherence: round(meanPairwiseCosine(memberVecs), 4),
    representative: { host: repHost, screenshots: repManifest?.screenshots, url: repManifest?.url },
    sampleMembers: recs.slice(0, 10).map((r) => {
      const mf = manifestByHost.get(r.host);
      return { host: r.host, screenshots: mf?.screenshots, url: mf?.url };
    }),
  };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  console.log("[mine-v2] loading inputs...");
  const [genomes, manifest, visualEmbeddings, luminance, familiesModule] = await Promise.all([
    loadNdjson(GENOMES_PATH),
    loadNdjson(MANIFEST_PATH),
    readFile(VISUAL_EMBEDDINGS_PATH, "utf8").then(JSON.parse),
    readFile(LUMINANCE_PATH, "utf8").then(JSON.parse),
    // @ts-ignore
    import("../../../apps/engine/layout-families.mjs"),
  ]);

  if (genomes.length !== manifest.length) {
    throw new Error(`Line-count mismatch: genomes=${genomes.length} manifest=${manifest.length} — refuse to zip positionally.`);
  }
  console.log(`[mine-v2] ${genomes.length} genome/manifest lines confirmed aligned.`);

  const zipped: AnyRecord[] = genomes.map((genome, i) => ({
    genome,
    host: manifest[i].host,
    url: manifest[i].url,
    screenshots: manifest[i].screenshots,
  }));
  const manifestByHost = new Map<string, AnyRecord>(manifest.map((m) => [m.host, m]));

  // -------------------------------------------------------------------------
  // Item 1: RELAXED pre-filter (same as v1 — visual-primary, not the main-corpus role gate)
  // -------------------------------------------------------------------------
  const dropReasons: Record<string, number> = {};
  const drop = (reason: string) => { dropReasons[reason] = (dropReasons[reason] ?? 0) + 1; };
  const guardDropHosts: string[] = [];
  const guardDropDetail: AnyRecord[] = [];

  const survivors = zipped.filter((rec) => {
    const g = rec.genome;
    const sg: AnyRecord[] = g.sectionGrammar ?? [];
    const hasEmbedding = Array.isArray(visualEmbeddings[rec.host]?.top);
    if (!hasEmbedding) return drop("no-visual-embedding"), false;
    const ws = Number(g.macro?.whitespace);
    const cw = Number(g.macro?.contentWidthShare);
    const nonDegenerateMacro = ws !== 0 && ws !== 1 && cw >= 0.2;
    if (!(sg.length >= 2 || nonDegenerateMacro)) return drop("blank-or-broken (fewer-than-2-sections AND degenerate macro)"), false;

    // -----------------------------------------------------------------------
    // FIX 1: blank/over-tall guard
    // -----------------------------------------------------------------------
    const L = luminance[rec.host];
    if (!L || L.error) return drop("guard: no-luminance-data"), false;

    const roles: string[] = sg.map((s) => s.role);
    const realContent = roles.filter((r) => r !== "nav" && r !== "footer");
    const hasHero = roles.includes("hero");
    const navFooterOnly = roles.length > 0 && roles.every((r) => r === "nav" || r === "footer");
    const lowVisual = L.std < 30 || L.frac_extreme > 0.9;

    const guardA_uniform = L.frac_extreme >= 0.95 && L.std < 45;

    const fu = roles.filter((r) => r === "features" || r === "unknown").length;
    const overSegmented = sg.length > 25 && fu / (sg.length || 1) > 0.7;
    const lowDensity = Number(g.macro?.contentDensity) < 0.25;
    const guardB_overTall = L.page_h > 16000 && ((lowDensity && L.std < 45) || overSegmented);

    const guardC_starved = navFooterOnly || (realContent.length <= 2 && !hasHero && lowVisual);

    if (guardA_uniform || guardB_overTall || guardC_starved) {
      const reasons = [guardA_uniform && "uniform-luminance", guardB_overTall && "over-tall-degenerate", guardC_starved && "content-starved-sections"].filter(Boolean);
      drop(`guard: ${reasons.join("+")}`);
      guardDropHosts.push(rec.host);
      guardDropDetail.push({ host: rec.host, reasons, std: L.std, frac_extreme: L.frac_extreme, page_h: L.page_h, sectionCount: sg.length, contentDensity: g.macro?.contentDensity });
      return false;
    }
    return true;
  });
  console.log(`[mine-v2] survivors after guarded pre-filter: ${survivors.length} / ${zipped.length}`);
  console.log("[mine-v2] drop reasons:", dropReasons);
  const flaggedFromReview = ["font.k95.it", "drxlr.com", "temporaryliveness.org"];
  console.log(
    "[mine-v2] pixel-review-flagged hosts excluded by the guard:",
    flaggedFromReview.filter((h) => guardDropHosts.includes(h)),
    "| still present (NOT excluded):",
    flaggedFromReview.filter((h) => !guardDropHosts.includes(h) && survivors.some((r) => r.host === h)),
  );

  // -------------------------------------------------------------------------
  // Fit stats for the combined visual-primary distance (same fields as v1)
  // -------------------------------------------------------------------------
  const genomeStats = fitGenomeCorpus(survivors.map((r) => r.genome));
  for (const rec of survivors) rec.vec = genomeVector(rec.genome, genomeStats); // roleSeqDist (0.08) + dedup

  const numericStats = fitNumericStats(survivors.map((r) => r.genome));
  for (const rec of survivors) rec.numVec = numericZVector(rec.genome, numericStats);
  for (const rec of survivors) rec.shapeVec = featureShapeVector(rec.genome.sectionGrammar ?? []);

  const embByHost = new Map<string, number[]>();
  for (const rec of survivors) embByHost.set(rec.host, unitNorm(visualEmbeddings[rec.host].top));

  // calibrate numericDist squashing constant k = median pairwise euclidean distance (global sample)
  const numericPairs: number[] = [];
  for (let i = 0; i < survivors.length; i += 1) {
    for (let j = i + 1; j < survivors.length; j += 3) {
      numericPairs.push(euclid(survivors[i].numVec, survivors[j].numVec));
    }
  }
  const kNumeric = median(numericPairs) || 1;
  console.log(`[mine-v2] numericDist squashing constant k=${round(kNumeric, 4)} (median pairwise euclidean, sampled)`);

  const WEIGHTS = { visual: 0.55, numeric: 0.25, featureShape: 0.12, roleSeq: 0.08 };
  console.log("[mine-v2] combined distance weights:", WEIGHTS);

  // -------------------------------------------------------------------------
  // FIX 2 prep: build a Euclidean concatenation whose squared distance approximates the same
  // weighted combined distance v1 used (cosine-based blocks contribute exactly via unit-norm
  // ||a-b||^2 = 2*(1-cos(a,b)); the numeric block uses the same k-scaled z-vector so typical
  // pairwise distances land near the target weight).
  // -------------------------------------------------------------------------
  function unitOrZero(v: number[]): number[] {
    const n = Math.hypot(...v);
    return n < 1e-9 ? v.map(() => 0) : v.map((x) => x / n);
  }
  for (const rec of survivors) {
    const visualBlock = unitOrZero(embByHost.get(rec.host)!).map((x) => x * Math.sqrt(WEIGHTS.visual / 2));
    const numericBlock = rec.numVec.map((x: number) => (x / kNumeric) * Math.sqrt(WEIGHTS.numeric));
    const shapeBlock = unitOrZero(rec.shapeVec).map((x) => x * Math.sqrt(WEIGHTS.featureShape / 2));
    const roleBlock = unitOrZero(rec.vec).map((x) => x * Math.sqrt(WEIGHTS.roleSeq / 2));
    rec.combinedVec = [...visualBlock, ...numericBlock, ...shapeBlock, ...roleBlock];
  }

  // -------------------------------------------------------------------------
  // Item 3: partition by pageKind
  // -------------------------------------------------------------------------
  const byPageKind = new Map<string, AnyRecord[]>();
  for (const rec of survivors) {
    const pk = rec.genome.pageKind ?? "unknown";
    if (!byPageKind.has(pk)) byPageKind.set(pk, []);
    byPageKind.get(pk)!.push(rec);
  }
  console.log(
    "[mine-v2] survivors per pageKind:",
    Object.fromEntries([...byPageKind.entries()].map(([k, v]) => [k, v.length])),
  );

  const MIN_CLUSTER_SIZE = 6;
  const MIN_PARTITION_SIZE = 6;
  const CAP_PER_PAGEKIND = 6;
  const MIN_COHERENCE_FLOOR = 0.5;
  const BISECT_ABOVE = 14;

  const thinPageKinds: string[] = [];
  for (const [pageKind, members] of byPageKind) {
    if (members.length < MIN_PARTITION_SIZE) thinPageKinds.push(`${pageKind} (${members.length} survivors)`);
  }

  // -------------------------------------------------------------------------
  // Shell out to Python for Ward linkage + recursive bisection of oversized clusters
  // -------------------------------------------------------------------------
  await mkdir(SCRATCH, { recursive: true });
  const VISUAL_DIM = embByHost.get(survivors[0].host)!.length;
  const clusterInput = {
    minClusterSize: MIN_CLUSTER_SIZE,
    capPerPageKind: CAP_PER_PAGEKIND,
    bisectAbove: BISECT_ABOVE,
    visualDim: VISUAL_DIM,
    coherenceFloor: MIN_COHERENCE_FLOOR,
    pageKinds: Object.fromEntries(
      [...byPageKind.entries()]
        .filter(([, members]) => members.length >= MIN_PARTITION_SIZE)
        .map(([pk, members]) => [pk, { hosts: members.map((r) => r.host), vectors: members.map((r) => r.combinedVec) }]),
    ),
  };
  const inputPath = resolve(SCRATCH, "ward-input.json");
  const outputPath = resolve(SCRATCH, "ward-output.json");
  await writeFile(inputPath, JSON.stringify(clusterInput), "utf8");
  console.log(`[mine-v2] wrote Ward-clustering input (${Object.keys(clusterInput.pageKinds).length} pageKinds) -> ${inputPath}`);

  const pyResult = spawnSync("python", [CLUSTER_PY, inputPath, outputPath], { stdio: "inherit" });
  if (pyResult.status !== 0) {
    throw new Error(`Ward clustering subprocess failed (exit ${pyResult.status}). See stderr above.`);
  }
  const clusterOutput = JSON.parse(await readFile(outputPath, "utf8")) as AnyRecord;

  // -------------------------------------------------------------------------
  // Rebuild cluster objects from Python's labels; apply the TRUE visual-cosine coherence floor
  // (Python clustered on the approximated combined-Euclidean space; the floor check uses the
  // exact DINOv2 embedding cosine, matching how visualCoherence is reported downstream).
  // -------------------------------------------------------------------------
  const clustersPerPageKind: Record<string, number> = {};
  const coherenceRejections: AnyRecord[] = [];
  const allClusters: AnyRecord[] = [];
  let clusterSeq = 0;

  for (const [pageKind, members] of byPageKind) {
    const pkOut = clusterOutput.pageKinds?.[pageKind];
    clustersPerPageKind[pageKind] = 0;
    if (!pkOut) continue; // thin pageKind, skipped by Python too
    const hostToRec = new Map(members.map((r) => [r.host, r]));
    const groups: AnyRecord[] = pkOut.clusters; // [{ hosts: [...] }, ...]
    const candidateClusters = groups
      .map((grp) => grp.hosts.map((h: string) => hostToRec.get(h)!).filter(Boolean))
      .filter((recs) => recs.length >= MIN_CLUSTER_SIZE);

    const scored = candidateClusters.map((recs) => {
      const vecs = recs.map((r: AnyRecord) => embByHost.get(r.host)!);
      const coherence = meanPairwiseCosine(vecs);
      return { recs, coherence };
    });

    const passFloor = scored.filter((c) => c.coherence >= MIN_COHERENCE_FLOOR);
    for (const c of scored) {
      if (c.coherence < MIN_COHERENCE_FLOOR) {
        coherenceRejections.push({ pageKind, memberCount: c.recs.length, visualCoherence: round(c.coherence, 4), sampleHosts: c.recs.slice(0, 5).map((r: AnyRecord) => r.host) });
      }
    }

    passFloor.sort((a, b) => b.recs.length - a.recs.length);
    const capped = passFloor.slice(0, CAP_PER_PAGEKIND);
    if (passFloor.length > CAP_PER_PAGEKIND) {
      console.log(`[mine-v2] ${pageKind}: capped ${passFloor.length} -> ${CAP_PER_PAGEKIND} (kept largest by member count)`);
    }
    clustersPerPageKind[pageKind] = capped.length;

    for (const { recs } of capped) {
      clusterSeq++;
      allClusters.push({
        clusterId: `gallery-v2-${pageKind}-${clusterSeq}`,
        pageKind,
        memberRecs: recs,
      });
    }
  }
  console.log("[mine-v2] clusters per pageKind (post Ward + bisect + coherence floor):", clustersPerPageKind);
  console.log(`[mine-v2] coherence-floor rejections (visualCoherence < ${MIN_COHERENCE_FLOOR}):`, coherenceRejections.length);
  console.log("[mine-v2] pageKinds too thin to mine:", thinPageKinds.length ? thinPageKinds : "none");

  // -------------------------------------------------------------------------
  // Item 5: dedup vs the 18 authored families (unchanged logic from v1)
  // -------------------------------------------------------------------------
  const corpusMedians = {
    gridColumns: median(survivors.map((r) => Number(r.genome.macro?.grid?.gridColumns))),
    gutterShare: median(survivors.map((r) => Number(r.genome.macro?.grid?.gutterShare))),
    outerMarginShare: median(survivors.map((r) => Number(r.genome.macro?.grid?.outerMarginShare))),
    focalAreaShare: median(survivors.map((r) => Number(r.genome.hierarchy?.focalAreaShare))),
    contrastConcentration: median(survivors.map((r) => Number(r.genome.hierarchy?.contrastConcentration))),
    headingScaleRatio: median(survivors.map((r) => Number(r.genome.hierarchy?.headingScaleRatio))),
    ctaProminence: median(survivors.map((r) => Number(r.genome.hierarchy?.ctaProminence))),
    repetitionEntropy: median(survivors.map((r) => Number(r.genome.hierarchy?.repetitionEntropy))),
    layeringDepth: median(survivors.map((r) => Number(r.genome.layeringDepth))),
    darkBandCount: median(survivors.map((r) => Number(r.genome.bandRhythm?.darkBandCount))),
    stripeAlternation: median(survivors.map((r) => Number(r.genome.bandRhythm?.stripeAlternation))),
    bgHueCount: median(survivors.map((r) => Number(r.genome.bandRhythm?.bgHueCount))),
    h1Count: median(survivors.map((r) => Number(r.genome.headingOutline?.h1Count))),
    outlineDepth: median(survivors.map((r) => Number(r.genome.headingOutline?.outlineDepth))),
    levelSkips: median(survivors.map((r) => Number(r.genome.headingOutline?.levelSkips))),
  };

  const families: AnyRecord[] = (familiesModule as AnyRecord).LAYOUT_FAMILIES;
  const familyVecs = families.map((fam) => {
    const syntheticGenome = {
      pageKind: fam.pageKind,
      macro: {
        whitespace: fam.macro?.whitespace,
        contentDensity: fam.macro?.contentDensity,
        splitRatio: fam.macro?.splitRatio,
        columnCount: fam.macro?.columnCount,
        contentWidthShare: fam.macro?.contentWidthShare,
        alignment: fam.macro?.alignment,
        grid: { gridColumns: corpusMedians.gridColumns, gutterShare: corpusMedians.gutterShare, outerMarginShare: corpusMedians.outerMarginShare },
      },
      hierarchy: {
        focalAreaShare: corpusMedians.focalAreaShare,
        contrastConcentration: corpusMedians.contrastConcentration,
        headingScaleRatio: corpusMedians.headingScaleRatio,
        ctaProminence: corpusMedians.ctaProminence,
        repetitionEntropy: corpusMedians.repetitionEntropy,
      },
      layeringDepth: corpusMedians.layeringDepth,
      bandRhythm: { darkBandCount: corpusMedians.darkBandCount, stripeAlternation: corpusMedians.stripeAlternation, bgHueCount: corpusMedians.bgHueCount },
      headingOutline: { h1Count: corpusMedians.h1Count, outlineDepth: corpusMedians.outlineDepth, levelSkips: corpusMedians.levelSkips },
      sectionGrammar: (fam.sectionGrammar ?? []).map((s: AnyRecord) => ({ role: canonicalRole(s.role), heightShare: s.heightShare })),
    };
    return { name: fam.name, vec: genomeVector(syntheticGenome, genomeStats) };
  });

  const dedupRejections: AnyRecord[] = [];
  const keptClusters: AnyRecord[] = [];
  for (const cluster of allClusters) {
    const centroid = meanVector(cluster.memberRecs.map((r: AnyRecord) => r.vec));
    let worstMatch: { name: string; sim: number } | null = null;
    for (const fv of familyVecs) {
      const sim = cosine(centroid, fv.vec);
      if (!worstMatch || sim > worstMatch.sim) worstMatch = { name: fv.name, sim };
    }
    if (worstMatch && worstMatch.sim >= 0.92) {
      dedupRejections.push({ clusterId: cluster.clusterId, pageKind: cluster.pageKind, memberCount: cluster.memberRecs.length, collidesWith: worstMatch.name, cosine: round(worstMatch.sim, 4), against: "authored-family" });
      console.log(`[mine-v2] REJECT ${cluster.clusterId} (n=${cluster.memberRecs.length}) — cosine ${round(worstMatch.sim, 4)} to authored family "${worstMatch.name}"`);
      continue;
    }
    cluster.nearestAuthored = worstMatch;
    keptClusters.push(cluster);
  }
  console.log(`[mine-v2] ${keptClusters.length} clusters survived authored-family dedup (${dedupRejections.length} rejected).`);

  keptClusters.sort((a, b) => b.memberRecs.length - a.memberRecs.length);
  const finalClusters: AnyRecord[] = [];
  for (const cluster of keptClusters) {
    const centroid = meanVector(cluster.memberRecs.map((r: AnyRecord) => r.vec));
    let collision: { clusterId: string; sim: number } | null = null;
    for (const kept of finalClusters) {
      const keptCentroid = meanVector(kept.memberRecs.map((r: AnyRecord) => r.vec));
      const sim = cosine(centroid, keptCentroid);
      if (sim >= 0.92) { collision = { clusterId: kept.clusterId, sim }; break; }
    }
    if (collision) {
      dedupRejections.push({ clusterId: cluster.clusterId, pageKind: cluster.pageKind, memberCount: cluster.memberRecs.length, collidesWith: collision.clusterId, cosine: round(collision.sim, 4), against: "within-new-set" });
      console.log(`[mine-v2] REJECT ${cluster.clusterId} (n=${cluster.memberRecs.length}) — cosine ${round(collision.sim, 4)} to already-kept ${collision.clusterId} (within-new-set dup)`);
      continue;
    }
    finalClusters.push(cluster);
  }
  console.log(`[mine-v2] ${finalClusters.length} final clusters after within-set dedup.`);

  // -------------------------------------------------------------------------
  // Encode
  // -------------------------------------------------------------------------
  const proposals = finalClusters.map((cluster) => encodeProposal(cluster, embByHost));
  const reviewSheet = finalClusters.map((cluster) => buildReviewEntry(cluster, embByHost, manifestByHost));

  await writeFile(
    OUT_PROPOSALS,
    JSON.stringify(
      {
        schemaVersion: "archetype-proposals.gallery.v2",
        generatedAt: new Date().toISOString(),
        source: { genomes: "data/layout-crawl/layout-genomes.gallery-final.ndjson", manifest: "data/layout-crawl/layout-genome-manifest.gallery-final.ndjson", visualEmbeddings: "viz/layout-embeddings/layout-visual-embeddings.gallery.json", luminance: "data/layout-crawl/screenshot-luminance.gallery.v2.json" },
        note: "v2 re-mine: adds a blank/over-tall screenshot guard to the pre-filter (FIX 1) and replaces average-linkage with Ward linkage + recursive bisection of >20-member clusters + a 0.5 visualCoherence floor (FIX 2), to stop blank captures masquerading as archetypes and stop the portfolio pool chaining into one catch-all. Structure only — semantic fields (name/whenToUse/notFor/requiredContent/antiPatterns/composition/materialSlots/mobileTransform) are TODO placeholders for human-reviewed curation. Not wired into apps/engine.",
        distanceWeights: WEIGHTS,
        numericSquashConstantK: round(kNumeric, 4),
        clusteringMethod: "ward-linkage+recursive-bisection(>20)+coherenceFloor(0.5)",
        survivorCount: survivors.length,
        totalRecords: zipped.length,
        dropReasons,
        guardDropCount: guardDropHosts.length,
        guardFlaggedHostsExcluded: flaggedFromReview.filter((h) => guardDropHosts.includes(h)),
        clustersPerPageKind,
        thinPageKinds,
        coherenceRejections,
        dedupRejections,
        proposals,
      },
      null,
      2,
    ),
    "utf8",
  );

  await writeFile(
    OUT_REVIEW,
    JSON.stringify(
      {
        schemaVersion: "archetype-review-sheet.gallery.v2",
        generatedAt: new Date().toISOString(),
        note: "Human review sheet — inspect representative + sample screenshots per cluster before promoting a proposal.",
        clusters: reviewSheet,
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(`[mine-v2] wrote ${proposals.length} archetype proposals -> ${OUT_PROPOSALS}`);
  console.log(`[mine-v2] wrote review sheet -> ${OUT_REVIEW}`);

  // -------------------------------------------------------------------------
  // Report
  // -------------------------------------------------------------------------
  console.log("\n=== PER-ARCHETYPE REPORT ===");
  for (const p of proposals) {
    const roles = p.sectionGrammar.map((s: AnyRecord) => s.role).join(">");
    console.log(
      `${p.evidence.clusterId} | pageKind=${p.pageKind} | n=${p.evidence.memberCount} | visualCoherence=${p.evidence.visualCoherence} | rep=${p.evidence.representativeHost} | grammar=${roles} | dominantFeatureShape=${p.evidence.dominantFeatureShape}`,
    );
  }

  const coherences = proposals.map((p: AnyRecord) => p.evidence.visualCoherence);
  const meanCoherence = coherences.reduce((a: number, b: number) => a + b, 0) / (coherences.length || 1);
  console.log(`\n[mine-v2] final count=${proposals.length} meanVisualCoherence=${round(meanCoherence, 4)}`);
  console.log(`[mine-v2] guard dropped ${guardDropHosts.length} hosts. Flagged-and-excluded:`, guardDropDetail.filter((d) => flaggedFromReview.includes(d.host)));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
