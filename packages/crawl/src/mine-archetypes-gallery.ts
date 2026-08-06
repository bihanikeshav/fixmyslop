/**
 * Mine LAYOUT ARCHETYPES from the DESIGN-FORWARD GALLERY corpus (515 curated Awwwards/Godly/
 * Lapa/Httpster/Minimal hosts), VISUAL-PRIMARY.
 *
 * Adapted from packages/crawl/src/mine-archetypes.ts (the main-corpus miner) per instructions:
 * the gallery corpus has genuine layout diversity but a NOISY role parser (bespoke sites don't
 * fit the 10-role SaaS vocabulary), so clustering leans on the DINOv2 visual embedding + a small
 * set of role-INDEPENDENT numeric/structural fields, NOT on role sequences (down-weighted to 0.08).
 *
 * This is a data script: it never edits apps/engine, never authors semantic copy (name/whenToUse/
 * notFor/requiredContent/antiPatterns/composition/materialSlots are TODO placeholders for a later
 * human-reviewed curation pass), and never commits.
 *
 * Pipeline (single-stage, visual-primary — see task instructions, not spec §1.2's two-stage
 * structure-first approach, which assumes reliable role labels this corpus doesn't have):
 *   1. Relaxed pre-filter (rendered real content; NOT the main-corpus role-completeness gate).
 *   2. Partition by pageKind (engine's hard gate).
 *   3. Per pageKind: agglomerative average-linkage clustering over a COMBINED distance:
 *        D = 0.55*(1-cosine(visual `top`)) + 0.25*numericDist + 0.12*featureShapeDist + 0.08*roleSeqDist
 *      Cut tuned per pageKind -> up to 6 clusters, min size 6.
 *   4. Dedup vs the 18 authored families (apps/engine/layout-families.mjs) using genomeVector +
 *      apps/engine/role-aliases.mjs canonicalRole; reject cosine >=0.92. Dedup within the new set too.
 *   5. Encode survivors as LAYOUT_FAMILY-shaped proposals (spec §1.4), representativeHost = nearest
 *      VISUAL centroid.
 *   6. Write data/layout-crawl/archetype-proposals.gallery.v1.json + archetype-review-sheet.gallery.v1.json.
 *
 * Usage:
 *   npx tsx src/mine-archetypes-gallery.ts
 */

import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

// @ts-ignore no declaration file for the frozen .mjs module.
import { fitGenomeCorpus, genomeVector, cosine } from "../../../viz/layout-embeddings/genome-vector.mjs";
// @ts-ignore no declaration file.
import { canonicalRole } from "../../../apps/engine/role-aliases.mjs";

const HERE = dirname(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (m) => m.slice(1)));
const ROOT = resolve(HERE, "../../..");
const LC = resolve(ROOT, "data/layout-crawl");
const VIZ = resolve(ROOT, "viz/layout-embeddings");

const GENOMES_PATH = resolve(LC, "layout-genomes.gallery-final.ndjson");
const MANIFEST_PATH = resolve(LC, "layout-genome-manifest.gallery-final.ndjson");
const VISUAL_EMBEDDINGS_PATH = resolve(VIZ, "layout-visual-embeddings.gallery.json");
const FAMILIES_PATH = resolve(ROOT, "apps/engine/layout-families.mjs");

const OUT_PROPOSALS = resolve(LC, "archetype-proposals.gallery.v1.json");
const OUT_REVIEW = resolve(LC, "archetype-review-sheet.gallery.v1.json");

type AnyRecord = Record<string, any>;

// ---------------------------------------------------------------------------
// numeric utils
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
// role-INDEPENDENT numeric fields (item 2 of task instructions)
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
function dominantFeatureShape(sectionGrammar: AnyRecord[]): string {
  const v = featureShapeVector(sectionGrammar);
  let best = 0;
  for (let i = 1; i < v.length; i++) if (v[i] > v[best]) best = i;
  return FEATURE_SHAPES[best];
}

// ---------------------------------------------------------------------------
// Generalized average-linkage dendrogram over an arbitrary precomputed distance matrix.
// ---------------------------------------------------------------------------
type Merge = { a: number; b: number; dist: number; size: number };

function buildDendrogramFromDistFn(n: number, distFn: (i: number, j: number) => number): Merge[] {
  const size = new Map<number, number>();
  const alive = new Set<number>();
  for (let i = 0; i < n; i++) { size.set(i, 1); alive.add(i); }
  const dist = new Map<string, number>();
  const key = (a: number, b: number) => (a < b ? `${a},${b}` : `${b},${a}`);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) dist.set(key(i, j), distFn(i, j));

  const merges: Merge[] = [];
  let nextId = n;
  while (alive.size > 1) {
    let best: { a: number; b: number; d: number } | null = null;
    const ids = [...alive];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const d = dist.get(key(ids[i], ids[j]))!;
        if (!best || d < best.d) best = { a: ids[i], b: ids[j], d };
      }
    }
    const { a, b, d } = best!;
    const sa = size.get(a)!, sb = size.get(b)!;
    const newId = nextId++;
    for (const k of alive) {
      if (k === a || k === b) continue;
      const dak = dist.get(key(a, k))!;
      const dbk = dist.get(key(b, k))!;
      dist.set(key(newId, k), (sa * dak + sb * dbk) / (sa + sb));
    }
    alive.delete(a); alive.delete(b); alive.add(newId);
    size.set(newId, sa + sb);
    merges.push({ a, b, dist: d, size: sa + sb });
  }
  return merges;
}

function cutAt(merges: Merge[], n: number, h: number): number[][] {
  const parent = new Array(n * 2).fill(0).map((_, i) => i);
  function find(x: number): number {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
    return x;
  }
  function union(x: number, y: number) {
    const rx = find(x), ry = find(y);
    if (rx !== ry) parent[rx] = ry;
  }
  let nextId = n;
  for (const m of merges) {
    const newId = nextId++;
    if (parent[newId] === undefined) parent[newId] = newId;
    if (m.dist <= h) { union(m.a, newId); union(m.b, newId); }
  }
  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(i);
  }
  return [...groups.values()];
}

/** Search cut heights to land <=6 valid clusters (size>=minSize) per pageKind, preferring MORE clusters
 * (richer diversity) within the cap, closest to a moderate cut height. */
function tuneCutGallery(merges: Merge[], n: number, minSize: number, cap: number): number[][] {
  const candidates: { h: number; clusters: number[][]; validCount: number }[] = [];
  for (let h = 0.08; h <= 0.9 + 1e-9; h += 0.01) {
    const groups = cutAt(merges, n, round(h, 2));
    const valid = groups.filter((g) => g.length >= minSize);
    candidates.push({ h, clusters: valid, validCount: valid.length });
  }
  const inRange = candidates.filter((c) => c.validCount >= 2 && c.validCount <= cap);
  if (inRange.length) {
    // prefer the richest split (max validCount); tie-break by proximity to h=0.35
    const maxCount = Math.max(...inRange.map((c) => c.validCount));
    const best = inRange.filter((c) => c.validCount === maxCount);
    best.sort((x, y) => Math.abs(x.h - 0.35) - Math.abs(y.h - 0.35));
    return best[0].clusters;
  }
  // fallback: closest validCount to [2,cap], tie-break by proximity to 0.35
  const scored = candidates.map((c) => ({
    ...c,
    bandDist: c.validCount < 2 ? 2 - c.validCount : c.validCount > cap ? c.validCount - cap : 0,
  }));
  scored.sort((x, y) => x.bandDist - y.bandDist || Math.abs(x.h - 0.35) - Math.abs(y.h - 0.35));
  return scored[0].clusters;
}

// ---------------------------------------------------------------------------
// §1.4-style encoding (adapted from mine-archetypes.ts)
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
  console.log("[mine-archetypes-gallery] loading inputs...");
  const [genomes, manifest, visualEmbeddings, familiesModule] = await Promise.all([
    loadNdjson(GENOMES_PATH),
    loadNdjson(MANIFEST_PATH),
    readFile(VISUAL_EMBEDDINGS_PATH, "utf8").then(JSON.parse),
    // @ts-ignore
    import("../../../apps/engine/layout-families.mjs"),
  ]);

  if (genomes.length !== manifest.length) {
    throw new Error(`Line-count mismatch: genomes=${genomes.length} manifest=${manifest.length} — refuse to zip positionally.`);
  }
  console.log(`[mine-archetypes-gallery] ${genomes.length} genome/manifest lines confirmed aligned.`);

  const zipped: AnyRecord[] = genomes.map((genome, i) => ({
    genome,
    host: manifest[i].host,
    url: manifest[i].url,
    screenshots: manifest[i].screenshots,
  }));
  const manifestByHost = new Map<string, AnyRecord>(manifest.map((m) => [m.host, m]));

  // -------------------------------------------------------------------------
  // Item 1: RELAXED pre-filter (visual-primary — do NOT apply main-corpus role gates)
  // -------------------------------------------------------------------------
  const dropReasons: Record<string, number> = {};
  const drop = (reason: string) => { dropReasons[reason] = (dropReasons[reason] ?? 0) + 1; };

  const survivors = zipped.filter((rec) => {
    const g = rec.genome;
    const sg: AnyRecord[] = g.sectionGrammar ?? [];
    const hasEmbedding = Array.isArray(visualEmbeddings[rec.host]?.top);
    if (!hasEmbedding) return drop("no-visual-embedding"), false;
    const ws = Number(g.macro?.whitespace);
    const cw = Number(g.macro?.contentWidthShare);
    const nonDegenerateMacro = ws !== 0 && ws !== 1 && cw >= 0.2;
    if (!(sg.length >= 2 || nonDegenerateMacro)) return drop("blank-or-broken (fewer-than-2-sections AND degenerate macro)"), false;
    return true;
  });
  console.log(`[mine-archetypes-gallery] survivors after relaxed pre-filter: ${survivors.length} / ${zipped.length}`);
  console.log("[mine-archetypes-gallery] drop reasons:", dropReasons);

  // -------------------------------------------------------------------------
  // Fit stats for the combined visual-primary distance
  // -------------------------------------------------------------------------
  const genomeStats = fitGenomeCorpus(survivors.map((r) => r.genome));
  for (const rec of survivors) rec.vec = genomeVector(rec.genome, genomeStats); // used only for roleSeqDist (0.08) + dedup

  const numericStats = fitNumericStats(survivors.map((r) => r.genome));
  for (const rec of survivors) rec.numVec = numericZVector(rec.genome, numericStats);
  for (const rec of survivors) rec.shapeVec = featureShapeVector(rec.genome.sectionGrammar ?? []);

  const embByHost = new Map<string, number[]>();
  for (const rec of survivors) embByHost.set(rec.host, unitNorm(visualEmbeddings[rec.host].top));

  // calibrate numericDist squashing constant k = median pairwise euclidean distance (global sample)
  const numericPairs: number[] = [];
  for (let i = 0; i < survivors.length; i += 1) {
    for (let j = i + 1; j < survivors.length; j += 3) { // sample every 3rd pair to bound cost
      numericPairs.push(euclid(survivors[i].numVec, survivors[j].numVec));
    }
  }
  const kNumeric = median(numericPairs) || 1;
  console.log(`[mine-archetypes-gallery] numericDist squashing constant k=${round(kNumeric, 4)} (median pairwise euclidean, sampled)`);

  const WEIGHTS = { visual: 0.55, numeric: 0.25, featureShape: 0.12, roleSeq: 0.08 };
  console.log("[mine-archetypes-gallery] combined distance weights:", WEIGHTS);

  function combinedDist(a: AnyRecord, b: AnyRecord): number {
    const visualD = 1 - cosine(embByHost.get(a.host)!, embByHost.get(b.host)!);
    const numRaw = euclid(a.numVec, b.numVec);
    const numericD = numRaw / (numRaw + kNumeric); // squash to [0,1)
    const featD = 1 - cosine(a.shapeVec, b.shapeVec);
    const roleD = 1 - cosine(a.vec, b.vec);
    return WEIGHTS.visual * visualD + WEIGHTS.numeric * numericD + WEIGHTS.featureShape * featD + WEIGHTS.roleSeq * roleD;
  }

  // -------------------------------------------------------------------------
  // Item 3: partition by pageKind, cluster
  // -------------------------------------------------------------------------
  const byPageKind = new Map<string, AnyRecord[]>();
  for (const rec of survivors) {
    const pk = rec.genome.pageKind ?? "unknown";
    if (!byPageKind.has(pk)) byPageKind.set(pk, []);
    byPageKind.get(pk)!.push(rec);
  }
  console.log(
    "[mine-archetypes-gallery] survivors per pageKind:",
    Object.fromEntries([...byPageKind.entries()].map(([k, v]) => [k, v.length])),
  );

  const MIN_CLUSTER_SIZE = 6;
  const MIN_PARTITION_SIZE = 6; // == MIN_CLUSTER_SIZE: a pageKind needs at least one possible cluster's worth of survivors
  const CAP_PER_PAGEKIND = 6;

  const thinPageKinds: string[] = [];
  const clustersPerPageKind: Record<string, number> = {};
  const allClusters: AnyRecord[] = [];
  let clusterSeq = 0;

  for (const [pageKind, members] of byPageKind) {
    if (members.length < MIN_PARTITION_SIZE) {
      thinPageKinds.push(`${pageKind} (${members.length} survivors)`);
      clustersPerPageKind[pageKind] = 0;
      continue;
    }
    const merges = buildDendrogramFromDistFn(members.length, (i, j) => combinedDist(members[i], members[j]));
    const clusters = tuneCutGallery(merges, members.length, MIN_CLUSTER_SIZE, CAP_PER_PAGEKIND);
    clusters.sort((a, b) => b.length - a.length);
    const capped = clusters.slice(0, CAP_PER_PAGEKIND);
    clustersPerPageKind[pageKind] = capped.length;
    if (clusters.length > CAP_PER_PAGEKIND) {
      console.log(`[mine-archetypes-gallery] ${pageKind}: capped ${clusters.length} -> ${CAP_PER_PAGEKIND}`);
    }
    for (const idxs of capped) {
      clusterSeq++;
      allClusters.push({
        clusterId: `gallery-${pageKind}-${clusterSeq}`,
        pageKind,
        memberIdxs: idxs,
        memberRecs: idxs.map((i) => members[i]),
      });
    }
  }
  console.log("[mine-archetypes-gallery] clusters per pageKind:", clustersPerPageKind);
  console.log("[mine-archetypes-gallery] pageKinds too thin to mine:", thinPageKinds.length ? thinPageKinds : "none");

  // -------------------------------------------------------------------------
  // Item 5: dedup vs the 18 authored families (structural genomeVector + ROLE_ALIASES)
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
      console.log(`[mine-archetypes-gallery] REJECT ${cluster.clusterId} (n=${cluster.memberRecs.length}) — cosine ${round(worstMatch.sim, 4)} to authored family "${worstMatch.name}"`);
      continue;
    }
    cluster.nearestAuthored = worstMatch;
    keptClusters.push(cluster);
  }
  console.log(`[mine-archetypes-gallery] ${keptClusters.length} clusters survived authored-family dedup (${dedupRejections.length} rejected).`);

  // dedup WITHIN the new set (reject near-identical new archetypes against each other, cosine >=0.92,
  // keep the larger cluster)
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
      console.log(`[mine-archetypes-gallery] REJECT ${cluster.clusterId} (n=${cluster.memberRecs.length}) — cosine ${round(collision.sim, 4)} to already-kept ${collision.clusterId} (within-new-set dup)`);
      continue;
    }
    finalClusters.push(cluster);
  }
  console.log(`[mine-archetypes-gallery] ${finalClusters.length} final clusters after within-set dedup.`);

  // -------------------------------------------------------------------------
  // Encode
  // -------------------------------------------------------------------------
  const proposals = finalClusters.map((cluster) => encodeProposal(cluster, embByHost));
  const reviewSheet = finalClusters.map((cluster) => buildReviewEntry(cluster, embByHost, manifestByHost));

  await writeFile(
    OUT_PROPOSALS,
    JSON.stringify(
      {
        schemaVersion: "archetype-proposals.gallery.v1",
        generatedAt: new Date().toISOString(),
        source: { genomes: "data/layout-crawl/layout-genomes.gallery-final.ndjson", manifest: "data/layout-crawl/layout-genome-manifest.gallery-final.ndjson", visualEmbeddings: "viz/layout-embeddings/layout-visual-embeddings.gallery.json" },
        note: "VISUAL-PRIMARY mine of the 515-host design-forward gallery corpus. Structure only — semantic fields (name/whenToUse/notFor/requiredContent/antiPatterns/composition/materialSlots/mobileTransform) are TODO placeholders for human-reviewed curation. Not wired into apps/engine.",
        distanceWeights: WEIGHTS,
        numericSquashConstantK: round(kNumeric, 4),
        survivorCount: survivors.length,
        totalRecords: zipped.length,
        dropReasons,
        clustersPerPageKind,
        thinPageKinds,
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
        schemaVersion: "archetype-review-sheet.gallery.v1",
        generatedAt: new Date().toISOString(),
        note: "Human review sheet — inspect representative + sample screenshots per cluster before promoting a proposal.",
        clusters: reviewSheet,
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(`[mine-archetypes-gallery] wrote ${proposals.length} archetype proposals -> ${OUT_PROPOSALS}`);
  console.log(`[mine-archetypes-gallery] wrote review sheet -> ${OUT_REVIEW}`);

  // -------------------------------------------------------------------------
  // Report per instructions
  // -------------------------------------------------------------------------
  console.log("\n=== PER-ARCHETYPE REPORT ===");
  for (const p of proposals) {
    const roles = p.sectionGrammar.map((s: AnyRecord) => s.role).join(">");
    console.log(
      `${p.evidence.clusterId} | pageKind=${p.pageKind} | n=${p.evidence.memberCount} | visualCoherence=${p.evidence.visualCoherence} | rep=${p.evidence.representativeHost} | grammar=${roles} | dominantFeatureShape=${p.evidence.dominantFeatureShape}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
