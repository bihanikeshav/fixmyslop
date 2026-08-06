/**
 * Mine the clean v3 layout-genome corpus into LAYOUT-ARCHETYPE PROPOSALS (offline, repeatable).
 *
 * Implements docs/layout-explorer-spec.md §1 (extraction). This is a data script, not engine
 * code: it never edits apps/engine, never authors semantic copy (name/whenToUse/notFor/
 * requiredContent/antiPatterns/composition/materialSlots are left as explicit TODO placeholders
 * for a later human-reviewed curation pass), and never commits.
 *
 * Two-stage pipeline:
 *   Stage A (structural) — partition survivors by pageKind; within each, agglomerative
 *     average-linkage clustering, cosine distance over genomeVector() (viz/layout-embeddings/
 *     genome-vector.mjs, reused verbatim, fit once on the filtered corpus). Cut threshold tuned
 *     per pageKind toward ≈0.35 to land 3-8 clusters (min size 8).
 *   Stage B (visual sharpening) — for clusters with ≥60% DINOv2-embedding coverage, check mean
 *     pairwise cosine on unit-normed `top` vectors; bisect via 2-means if incoherent (<~0.55),
 *     keeping the split only if both halves stay ≥ min size. DINOv2 is OFFLINE-only (never enters
 *     runtime); this script does not touch apps/engine or apps/worker.
 *
 * Then: cap 6 archetypes/pageKind, dedup vs the 18 authored families (reject cosine ≥0.92),
 * encode survivors as LAYOUT_FAMILY-shaped proposals (§1.4), and write:
 *   data/layout-crawl/archetype-proposals.v2.json
 *   data/layout-crawl/archetype-review-sheet.v2.json
 *
 * Usage:
 *   npx tsx src/mine-archetypes.ts
 */

import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

// ── genomeVector reused verbatim from the production vectorizer (see spec §1.2). ────────────────
// @ts-ignore no declaration file for the frozen .mjs module.
import { fitGenomeCorpus, genomeVector, cosine, ROLE_VOCAB } from "../../../viz/layout-embeddings/genome-vector.mjs";

const HERE = dirname(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (m) => m.slice(1)));
const ROOT = resolve(HERE, "../../..");
const LC = resolve(ROOT, "data/layout-crawl");
const VIZ = resolve(ROOT, "viz/layout-embeddings");

const GENOMES_PATH = resolve(LC, "layout-genomes.v3.ndjson");
const MANIFEST_PATH = resolve(LC, "layout-genome-manifest.v3.ndjson");
const SPAM_PATH = resolve(LC, "spam-quarantine.v1.ndjson");
const SLOP_LABELS_PATH = resolve(LC, "slop-labels.v1.json");
const QUALITY_LABELS_PATH = resolve(LC, "quality-labels.v1.json");
const VISUAL_EMBEDDINGS_PATH = resolve(VIZ, "layout-visual-embeddings.full.json");
const FAMILIES_PATH = resolve(ROOT, "apps/engine/layout-families.mjs");

const OUT_PROPOSALS = resolve(LC, "archetype-proposals.v2.json");
const OUT_REVIEW = resolve(LC, "archetype-review-sheet.v2.json");

type AnyRecord = Record<string, any>;

// ---------------------------------------------------------------------------
// small numeric utils
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

// ---------------------------------------------------------------------------
// 0. Load inputs
// ---------------------------------------------------------------------------
async function loadNdjson(path: string): Promise<AnyRecord[]> {
  const raw = await readFile(path, "utf8");
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

async function main(): Promise<void> {
  console.log("[mine-archetypes] loading inputs...");
  const [genomes, manifest, spamLines, slopLabelsRaw, qualityLabelsRaw, visualEmbeddings, familiesModule] = await Promise.all([
    loadNdjson(GENOMES_PATH),
    loadNdjson(MANIFEST_PATH),
    loadNdjson(SPAM_PATH),
    readFile(SLOP_LABELS_PATH, "utf8").then(JSON.parse).catch(() => null),
    readFile(QUALITY_LABELS_PATH, "utf8").then(JSON.parse).catch(() => null),
    readFile(VISUAL_EMBEDDINGS_PATH, "utf8").then(JSON.parse),
    // @ts-ignore no declaration file exists for the frozen .mjs module.
    import("../../../apps/engine/layout-families.mjs"),
  ]);

  // trap 4: host join is POSITIONAL — assert equal line counts before zipping.
  if (genomes.length !== manifest.length) {
    throw new Error(`Line-count mismatch: genomes=${genomes.length} manifest=${manifest.length} — refuse to zip positionally.`);
  }
  console.log(`[mine-archetypes] ${genomes.length} genome/manifest lines confirmed aligned.`);

  const spamHosts = new Set<string>(spamLines.map((r) => r.host));
  const slopHosts = new Set<string>(
    (slopLabelsRaw?.records ?? []).filter((r: AnyRecord) => r.set === "slop").map((r: AnyRecord) => r.host),
  );
  const qualityByHost = new Map<string, AnyRecord>(
    (qualityLabelsRaw?.records ?? []).map((r: AnyRecord) => [r.host, r]),
  );

  const zipped: AnyRecord[] = genomes.map((genome, i) => ({
    genome,
    host: manifest[i].host,
    url: manifest[i].url,
    screenshots: manifest[i].screenshots,
  }));

  // ---------------------------------------------------------------------------
  // 1.1 Pre-filter
  // ---------------------------------------------------------------------------
  const dropReasons: Record<string, number> = {};
  const drop = (reason: string) => {
    dropReasons[reason] = (dropReasons[reason] ?? 0) + 1;
  };

  const survivors = zipped.filter((rec) => {
    const g = rec.genome;
    const sg: AnyRecord[] = g.sectionGrammar ?? [];
    if (spamHosts.has(rec.host)) return drop("spam-quarantined"), false;
    if (slopHosts.has(rec.host)) return drop("slop-labeled"), false;
    if (sg.length < 3) return drop("fewer-than-3-sections"), false;
    const nonUnknown = sg.filter((s) => s.role && s.role !== "unknown").length;
    if (nonUnknown < 2) return drop("fewer-than-2-non-unknown"), false;
    const confVals = sg.map((s) => Number(s.roleConfidence ?? 0));
    const meanConf = confVals.reduce((a, b) => a + b, 0) / (confVals.length || 1);
    if (meanConf < 0.5) return drop("mean-roleConfidence-below-0.5"), false;
    const cw = Number(g.macro?.contentWidthShare);
    if (!(cw >= 0.3 && cw <= 1.0)) return drop("contentWidthShare-out-of-range"), false;
    const ws = Number(g.macro?.whitespace);
    if (ws === 0 || ws === 1) return drop("whitespace-degenerate-0-or-1"), false;
    const cd = Number(g.macro?.contentDensity);
    if (cd === 0 || cd === 1) return drop("contentDensity-degenerate-0-or-1"), false;
    return true;
  });

  console.log(`[mine-archetypes] survivors after pre-filter: ${survivors.length} / ${zipped.length}`);
  console.log("[mine-archetypes] drop reasons:", dropReasons);

  // ---------------------------------------------------------------------------
  // 1.2 Fit vectorizer stats once on the filtered corpus; vectorize every survivor.
  // ---------------------------------------------------------------------------
  const stats = fitGenomeCorpus(survivors.map((r) => r.genome));
  for (const rec of survivors) rec.vec = genomeVector(rec.genome, stats);

  // corpus-wide medians for crawl-only fields (used later to fill authored-family vectors, §1.5 dedup).
  const corpusMedians = {
    "macro.grid.gridColumns": median(survivors.map((r) => Number(r.genome.macro?.grid?.gridColumns))),
    "macro.grid.gutterShare": median(survivors.map((r) => Number(r.genome.macro?.grid?.gutterShare))),
    "macro.grid.outerMarginShare": median(survivors.map((r) => Number(r.genome.macro?.grid?.outerMarginShare))),
    "hierarchy.focalAreaShare": median(survivors.map((r) => Number(r.genome.hierarchy?.focalAreaShare))),
    "hierarchy.contrastConcentration": median(survivors.map((r) => Number(r.genome.hierarchy?.contrastConcentration))),
    "hierarchy.headingScaleRatio": median(survivors.map((r) => Number(r.genome.hierarchy?.headingScaleRatio))),
    "hierarchy.ctaProminence": median(survivors.map((r) => Number(r.genome.hierarchy?.ctaProminence))),
    "hierarchy.repetitionEntropy": median(survivors.map((r) => Number(r.genome.hierarchy?.repetitionEntropy))),
    layeringDepth: median(survivors.map((r) => Number(r.genome.layeringDepth))),
    "bandRhythm.darkBandCount": median(survivors.map((r) => Number(r.genome.bandRhythm?.darkBandCount))),
    "bandRhythm.stripeAlternation": median(survivors.map((r) => Number(r.genome.bandRhythm?.stripeAlternation))),
    "bandRhythm.bgHueCount": median(survivors.map((r) => Number(r.genome.bandRhythm?.bgHueCount))),
    "headingOutline.h1Count": median(survivors.map((r) => Number(r.genome.headingOutline?.h1Count))),
    "headingOutline.outlineDepth": median(survivors.map((r) => Number(r.genome.headingOutline?.outlineDepth))),
    "headingOutline.levelSkips": median(survivors.map((r) => Number(r.genome.headingOutline?.levelSkips))),
  };

  // ---------------------------------------------------------------------------
  // Partition by pageKind
  // ---------------------------------------------------------------------------
  const byPageKind = new Map<string, AnyRecord[]>();
  for (const rec of survivors) {
    const pk = rec.genome.pageKind ?? "unknown";
    if (!byPageKind.has(pk)) byPageKind.set(pk, []);
    byPageKind.get(pk)!.push(rec);
  }
  console.log(
    "[mine-archetypes] survivors per pageKind:",
    Object.fromEntries([...byPageKind.entries()].map(([k, v]) => [k, v.length])),
  );

  const MIN_CLUSTER_SIZE = 8;
  const MIN_PARTITION_SIZE = 24; // below this, a pageKind is too thin to cluster meaningfully
  const CAP_PER_PAGEKIND = 6;

  const thinPageKinds: string[] = [];
  const clustersBeforeCap: Record<string, number> = {};
  const clustersAfterCap: Record<string, number> = {};
  const allClusters: AnyRecord[] = [];
  let clusterSeq = 0;

  for (const [pageKind, members] of byPageKind) {
    if (members.length < MIN_PARTITION_SIZE) {
      thinPageKinds.push(`${pageKind} (${members.length} survivors)`);
      clustersBeforeCap[pageKind] = 0;
      clustersAfterCap[pageKind] = 0;
      continue;
    }

    // ---- Stage A: agglomerative average-linkage clustering, cosine distance ----
    const dendrogram = buildDendrogram(members.map((m) => m.vec as number[]));
    const stageAClusters = tuneCut(dendrogram, members.length, MIN_CLUSTER_SIZE);

    // ---- Stage B: visual sharpening ----
    let stageBClusters: number[][] = [];
    for (const idxs of stageAClusters) {
      stageBClusters.push(...visualSharpen(idxs, members, visualEmbeddings, MIN_CLUSTER_SIZE));
    }

    clustersBeforeCap[pageKind] = stageBClusters.length;

    // rank by size desc, cap at 6
    stageBClusters.sort((a, b) => b.length - a.length);
    const capped = stageBClusters.slice(0, CAP_PER_PAGEKIND);
    clustersAfterCap[pageKind] = capped.length;
    if (stageBClusters.length > CAP_PER_PAGEKIND) {
      console.log(
        `[mine-archetypes] ${pageKind}: capped ${stageBClusters.length} -> ${CAP_PER_PAGEKIND} archetypes (dropped ${stageBClusters.length - CAP_PER_PAGEKIND} smallest clusters, sizes ${stageBClusters
          .slice(CAP_PER_PAGEKIND)
          .map((c) => c.length)
          .join(",")})`,
      );
    }

    for (const idxs of capped) {
      clusterSeq++;
      allClusters.push({
        clusterId: `${pageKind}-${clusterSeq}`,
        pageKind,
        memberIdxs: idxs,
        memberRecs: idxs.map((i) => members[i]),
      });
    }
  }

  console.log("[mine-archetypes] clusters per pageKind before cap:", clustersBeforeCap);
  console.log("[mine-archetypes] clusters per pageKind after cap:", clustersAfterCap);
  console.log("[mine-archetypes] pageKinds too thin to mine:", thinPageKinds.length ? thinPageKinds : "none");

  // ---------------------------------------------------------------------------
  // 1.5 Dedup vs the 18 authored families
  // ---------------------------------------------------------------------------
  const ROLE_ALIASES: Record<string, string> = {
    topbar: "nav", appbar: "nav", masthead: "nav", header: "nav",
    marquee: "hero", opening: "hero", lede: "hero", "page-header": "hero", "reading-header": "hero", summary: "hero", intro: "hero", "intro-band": "hero",
    "chapter-1": "features", "chapter-2": "features", "chapter-3": "features",
    "body-columns": "features", "article-body": "features", "spec-groups": "features", workspace: "features", "table-body": "features",
    mosaic: "features", "pane-body": "features", "primary-instrument": "features", "secondary-metrics": "features",
    "dark-band": "features", "light-band": "features", "full-bleed-diagram": "features", "annotation-flow": "features",
    "comparison-matrix": "features", "filter-bar": "features", "table-head": "features", toolbar: "features",
    evidence: "features", "selected-detail": "features", diagram: "features",
    "status-strip": "proof", "pull-aside": "proof",
    "cta-band": "cta", "resolution-cta": "cta", contact: "cta", related: "cta", "plan-toggle": "cta", pagination: "cta",
    faq: "faq",
    statusbar: "footer",
  };
  const canonicalRole = (role: string) => ROLE_ALIASES[role] ?? role;

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
        grid: {
          gridColumns: corpusMedians["macro.grid.gridColumns"],
          gutterShare: corpusMedians["macro.grid.gutterShare"],
          outerMarginShare: corpusMedians["macro.grid.outerMarginShare"],
        },
      },
      hierarchy: {
        focalAreaShare: corpusMedians["hierarchy.focalAreaShare"],
        contrastConcentration: corpusMedians["hierarchy.contrastConcentration"],
        headingScaleRatio: corpusMedians["hierarchy.headingScaleRatio"],
        ctaProminence: corpusMedians["hierarchy.ctaProminence"],
        repetitionEntropy: corpusMedians["hierarchy.repetitionEntropy"],
      },
      layeringDepth: corpusMedians.layeringDepth,
      bandRhythm: {
        darkBandCount: corpusMedians["bandRhythm.darkBandCount"],
        stripeAlternation: corpusMedians["bandRhythm.stripeAlternation"],
        bgHueCount: corpusMedians["bandRhythm.bgHueCount"],
      },
      headingOutline: {
        h1Count: corpusMedians["headingOutline.h1Count"],
        outlineDepth: corpusMedians["headingOutline.outlineDepth"],
        levelSkips: corpusMedians["headingOutline.levelSkips"],
      },
      sectionGrammar: (fam.sectionGrammar ?? []).map((s: AnyRecord) => ({ role: canonicalRole(s.role), heightShare: s.heightShare })),
    };
    return { name: fam.name, vec: genomeVector(syntheticGenome, stats) };
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
      dedupRejections.push({ clusterId: cluster.clusterId, pageKind: cluster.pageKind, memberCount: cluster.memberRecs.length, collidesWith: worstMatch.name, cosine: round(worstMatch.sim, 4) });
      console.log(`[mine-archetypes] REJECT ${cluster.clusterId} (n=${cluster.memberRecs.length}) — cosine ${round(worstMatch.sim, 4)} to authored family "${worstMatch.name}"`);
      continue;
    }
    cluster.nearestAuthored = worstMatch;
    keptClusters.push(cluster);
  }

  console.log(`[mine-archetypes] ${keptClusters.length} clusters survived dedup (${dedupRejections.length} rejected).`);

  // ---------------------------------------------------------------------------
  // 1.4 Encode surviving clusters as LAYOUT_FAMILY-shaped proposals
  // ---------------------------------------------------------------------------
  const proposals = keptClusters.map((cluster) => encodeProposal(cluster, visualEmbeddings));
  const reviewSheet = keptClusters.map((cluster) => buildReviewEntry(cluster, visualEmbeddings, qualityByHost));

  await writeFile(
    OUT_PROPOSALS,
    JSON.stringify(
      {
        schemaVersion: "archetype-proposals.v2",
        generatedAt: new Date().toISOString(),
        source: { genomes: "data/layout-crawl/layout-genomes.v3.ndjson", manifest: "data/layout-crawl/layout-genome-manifest.v3.ndjson" },
        note: "Structure only — semantic fields (name/whenToUse/notFor/requiredContent/antiPatterns/composition/materialSlots/mobileTransform) are TODO placeholders for human-reviewed curation. Not wired into apps/engine.",
        survivorCount: survivors.length,
        totalRecords: zipped.length,
        dropReasons,
        clustersPerPageKindBeforeCap: clustersBeforeCap,
        clustersPerPageKindAfterCap: clustersAfterCap,
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
        schemaVersion: "archetype-review-sheet.v2",
        generatedAt: new Date().toISOString(),
        note: "Human review sheet — inspect representative + sample screenshots per cluster before promoting a proposal to apps/engine/layout-families-crawl.mjs.",
        clusters: reviewSheet,
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(`[mine-archetypes] wrote ${proposals.length} archetype proposals -> ${OUT_PROPOSALS}`);
  console.log(`[mine-archetypes] wrote review sheet -> ${OUT_REVIEW}`);
}

// ---------------------------------------------------------------------------
// Stage A: agglomerative average-linkage clustering
// ---------------------------------------------------------------------------
type Merge = { a: number; b: number; dist: number; size: number };

/**
 * Build a full average-linkage dendrogram over cosine distance. Returns the merge sequence;
 * merges[k] describes the (k)th merge combining active clusters `a` and `b` (cluster ids;
 * original points are ids [0,n), each merge creates a new id n+k) at the given distance.
 */
function buildDendrogram(vectors: number[][]): Merge[] {
  const n = vectors.length;
  // active cluster id -> member point indices (kept only for average-linkage weighting via size)
  const size = new Map<number, number>();
  const alive = new Set<number>();
  for (let i = 0; i < n; i++) {
    size.set(i, 1);
    alive.add(i);
  }
  // pairwise distance matrix keyed by "min,max" id pair, seeded from cosine distance
  const dist = new Map<string, number>();
  const key = (a: number, b: number) => (a < b ? `${a},${b}` : `${b},${a}`);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      dist.set(key(i, j), 1 - cosine(vectors[i], vectors[j]));
    }
  }

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
    // average-linkage update for all other active clusters
    for (const k of alive) {
      if (k === a || k === b) continue;
      const dak = dist.get(key(a, k))!;
      const dbk = dist.get(key(b, k))!;
      const newD = (sa * dak + sb * dbk) / (sa + sb);
      dist.set(key(newId, k), newD);
    }
    alive.delete(a);
    alive.delete(b);
    alive.add(newId);
    size.set(newId, sa + sb);
    merges.push({ a, b, dist: d, size: sa + sb });
  }
  return merges;
}

/** Cut the dendrogram at height `h`: union-find over original n points via merges with dist<=h. */
function cutAt(merges: Merge[], n: number, h: number): number[][] {
  const parent = new Array(n * 2).fill(0).map((_, i) => i); // generous upper bound for synthetic ids
  function find(x: number): number {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  }
  function union(x: number, y: number) {
    const rx = find(x), ry = find(y);
    if (rx !== ry) parent[rx] = ry;
  }
  let nextId = n;
  for (const m of merges) {
    const newId = nextId++;
    if (m.dist <= h) union(m.a, newId), union(m.b, newId);
    else {
      // still need the id mapping consistent even when not merging by distance;
      // give the synthetic id its own root so subsequent merges referencing it still resolve.
      if (parent[newId] === undefined) parent[newId] = newId;
    }
  }
  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(i);
  }
  return [...groups.values()];
}

/** Search cut heights near 0.35 to land 3-8 clusters (size>=minSize) per pageKind (spec §1.2). */
function tuneCut(merges: Merge[], n: number, minSize: number): number[][] {
  const candidates: { h: number; clusters: number[][]; validCount: number }[] = [];
  for (let h = 0.15; h <= 0.6 + 1e-9; h += 0.01) {
    const groups = cutAt(merges, n, round(h, 2));
    const valid = groups.filter((g) => g.length >= minSize);
    candidates.push({ h, clusters: valid, validCount: valid.length });
  }
  // prefer a height whose valid cluster count lands in [3,8], closest to 0.35
  const inRange = candidates.filter((c) => c.validCount >= 3 && c.validCount <= 8);
  const pick = (pool: typeof candidates) => pool.slice().sort((x, y) => Math.abs(x.h - 0.35) - Math.abs(y.h - 0.35))[0];
  if (inRange.length) return pick(inRange).clusters;
  // fallback: closest validCount to the [3,8] band, tie-break by proximity to 0.35
  const scored = candidates.map((c) => ({
    ...c,
    bandDist: c.validCount < 3 ? 3 - c.validCount : c.validCount > 8 ? c.validCount - 8 : 0,
  }));
  scored.sort((x, y) => x.bandDist - y.bandDist || Math.abs(x.h - 0.35) - Math.abs(y.h - 0.35));
  return scored[0].clusters;
}

// ---------------------------------------------------------------------------
// Stage B: visual sharpening (DINOv2 `top`, offline only)
// ---------------------------------------------------------------------------
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

/** Deterministic 2-means (farthest-pair init, cosine distance) over `vecs`; returns 2 index groups (local indices into vecs). */
function kmeans2(vecs: number[][]): number[][] {
  const n = vecs.length;
  // farthest-pair deterministic init
  let seedA = 0, seedB = 1, worstD = -Infinity;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = 1 - cosine(vecs[i], vecs[j]);
      if (d > worstD) {
        worstD = d;
        seedA = i;
        seedB = j;
      }
    }
  }
  let centroidA = vecs[seedA].slice();
  let centroidB = vecs[seedB].slice();
  let assign = new Array(n).fill(0);
  for (let iter = 0; iter < 15; iter++) {
    const next = vecs.map((v) => (cosine(v, centroidA) >= cosine(v, centroidB) ? 0 : 1));
    if (JSON.stringify(next) === JSON.stringify(assign) && iter > 0) {
      assign = next;
      break;
    }
    assign = next;
    const groupA = vecs.filter((_, i) => assign[i] === 0);
    const groupB = vecs.filter((_, i) => assign[i] === 1);
    if (groupA.length) centroidA = meanVector(groupA);
    if (groupB.length) centroidB = meanVector(groupB);
  }
  const idxA: number[] = [], idxB: number[] = [];
  assign.forEach((a, i) => (a === 0 ? idxA : idxB).push(i));
  return [idxA, idxB];
}

/**
 * `idxs` are indices into `members` (the pageKind partition array). Returns an array of one or
 * two clusters (each an array of `members` indices) after optional visual bisection.
 */
function visualSharpen(idxs: number[], members: AnyRecord[], visualEmbeddings: AnyRecord, minSize: number): number[][] {
  const hosts = idxs.map((i) => members[i].host);
  const embedded = idxs.filter((i) => Array.isArray(visualEmbeddings[members[i].host]?.top));
  const coverage = embedded.length / (idxs.length || 1);
  if (coverage < 0.6) return [idxs]; // insufficient embedding coverage — leave structural cluster as-is

  const embVecs = embedded.map((i) => unitNorm(visualEmbeddings[members[i].host].top));
  const coherence = meanPairwiseCosine(embVecs);
  if (coherence >= 0.55) return [idxs]; // already visually coherent

  // bisect via 2-means on the embedded subset's visual vectors
  const [localA, localB] = kmeans2(embVecs);
  const embeddedIdxA = new Set(localA.map((li) => embedded[li]));
  const embeddedIdxB = new Set(localB.map((li) => embedded[li]));

  // structural centroids from the embedded members already assigned, for non-embedded fallback
  const structA = meanVector([...embeddedIdxA].map((i) => members[i].vec));
  const structB = meanVector([...embeddedIdxB].map((i) => members[i].vec));

  const groupA: number[] = [], groupB: number[] = [];
  for (const i of idxs) {
    if (embeddedIdxA.has(i)) {
      groupA.push(i);
    } else if (embeddedIdxB.has(i)) {
      groupB.push(i);
    } else {
      const simA = cosine(members[i].vec, structA);
      const simB = cosine(members[i].vec, structB);
      (simA >= simB ? groupA : groupB).push(i);
    }
  }

  if (groupA.length >= minSize && groupB.length >= minSize) {
    return [groupA, groupB];
  }
  return [idxs]; // split would drop below min size — keep unsplit
}

// ---------------------------------------------------------------------------
// §1.4 Encoding
// ---------------------------------------------------------------------------
const layoutVarianceProxy = (member: AnyRecord): number => {
  const g = member.genome;
  const splitTerm = (0.3 * Math.abs((g.macro?.splitRatio ?? 0.5) - 0.5)) / 0.3;
  const alignTerm = 0.3 * (g.macro?.alignment !== "left-led" ? 1 : 0);
  const stripeTerm = 0.2 * clamp01(g.bandRhythm?.stripeAlternation ?? 0);
  const repTerm = 0.2 * clamp01(g.hierarchy?.repetitionEntropy ?? 0);
  return clamp01(splitTerm + alignTerm + stripeTerm + repTerm);
};

function widenRange(lo: number, hi: number, minWidth: number): [number, number] {
  if (hi - lo >= minWidth) return [round(lo, 3), round(hi, 3)];
  const mid = (lo + hi) / 2;
  return [round(clamp01(mid - minWidth / 2), 3), round(clamp01(mid + minWidth / 2), 3)];
}

function findVisualCentroidHost(recs: AnyRecord[], visualEmbeddings: AnyRecord): { host: string; galleryShare: number } | null {
  const embedded = recs.filter((r) => Array.isArray(visualEmbeddings[r.host]?.top));
  if (!embedded.length) return null;
  const vecs = embedded.map((r) => unitNorm(visualEmbeddings[r.host].top));
  const centroid = unitNorm(meanVector(vecs));
  let best: { host: string; sim: number } | null = null;
  for (let k = 0; k < embedded.length; k++) {
    const sim = cosine(vecs[k], centroid);
    const host = embedded[k].host;
    if (!best || sim > best.sim) best = { host, sim };
  }
  return { host: best!.host, galleryShare: 0 }; // v1 mines v3 only (main crawl) — no gallery members possible (trap 3)
}

function encodeProposal(cluster: AnyRecord, visualEmbeddings: AnyRecord): AnyRecord {
  const recs: AnyRecord[] = cluster.memberRecs;
  const genomes = recs.map((r) => r.genome);

  // macro: per-field median
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

  // sectionGrammar: modal role sequence; heightShares = median over members sharing that sequence
  const sequences = genomes.map((g) => (g.sectionGrammar ?? []).map((s: AnyRecord) => s.role));
  const modalSeq: string[] = mode(sequences.map((seq) => JSON.stringify(seq))) as unknown as string[];
  const modalSeqArr: string[] = JSON.parse(modalSeq as unknown as string);
  const sharing = genomes.filter((g) => JSON.stringify((g.sectionGrammar ?? []).map((s: AnyRecord) => s.role)) === modalSeq);

  const focalModal = (pos: number) => mode(sharing.map((g) => g.sectionGrammar[pos]?.focalPoint ?? "center"));
  const heightMedian = (pos: number) => median(sharing.map((g) => Number(g.sectionGrammar[pos]?.heightShare ?? 0)));

  const rawShares = modalSeqArr.map((_, pos) => heightMedian(pos));
  const shareSum = rawShares.reduce((a, b) => a + b, 0) || 1;
  const sectionGrammar = modalSeqArr.map((role, pos) => ({
    role,
    heightShare: round(rawShares[pos] / shareSum, 4),
    focalPoint: focalModal(pos),
    composition: "TODO: author composition string (human curation)",
  }));

  const densities = genomes.map((g) => Number(g.macro?.contentDensity ?? 0.5));
  const dialCompatibility = {
    contentDensity: widenRange(percentile(densities, 0.1), percentile(densities, 0.9), 0.15),
    layoutVariance: (() => {
      const vs = recs.map((r) => layoutVarianceProxy(r));
      return widenRange(percentile(vs, 0.1), percentile(vs, 0.9), 0.3);
    })(),
  };

  const visualCentroid = findVisualCentroidHost(recs, visualEmbeddings) ??
    // fall back to structural centroid nearest host when no members have embeddings
    (() => {
      const centroid = meanVector(recs.map((r) => r.vec));
      let best: { host: string; sim: number } | null = null;
      for (const r of recs) {
        const sim = cosine(r.vec, centroid);
        if (!best || sim > best.sim) best = { host: r.host, sim };
      }
      return { host: best!.host, galleryShare: 0 };
    })();

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
      galleryShare: visualCentroid.galleryShare,
      nearestAuthoredFamily: cluster.nearestAuthored ? { name: cluster.nearestAuthored.name, cosine: round(cluster.nearestAuthored.sim, 4) } : null,
      memberHosts: sampleHosts,
    },
  };
}

function buildReviewEntry(cluster: AnyRecord, visualEmbeddings: AnyRecord, qualityByHost: Map<string, AnyRecord>): AnyRecord {
  const recs: AnyRecord[] = cluster.memberRecs;
  const visualCentroid = findVisualCentroidHost(recs, visualEmbeddings);
  const repHost = visualCentroid?.host ?? recs[0].host;
  const repRec = recs.find((r) => r.host === repHost) ?? recs[0];

  const embeddedCount = recs.filter((r) => Array.isArray(visualEmbeddings[r.host]?.top)).length;
  const qualityLabeledCount = recs.filter((r) => qualityByHost.has(r.host)).length;

  return {
    clusterId: cluster.clusterId,
    pageKind: cluster.pageKind,
    memberCount: recs.length,
    embeddingCoverage: round(embeddedCount / (recs.length || 1), 3),
    qualityLabeledCount,
    representative: { host: repHost, screenshots: repRec.screenshots, url: repRec.url },
    sampleMembers: recs.slice(0, 10).map((r) => ({ host: r.host, screenshots: r.screenshots, url: r.url })),
  };
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
