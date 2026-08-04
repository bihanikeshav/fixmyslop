#!/usr/bin/env node
// apps/engine/scripts/build-retrieval-index.mjs — OFFLINE index builder for the layout
// retrieval channel (see apps/engine/retrieval.mjs). Node-only (uses fs) — this script is never
// imported at runtime by engine.mjs/explore.mjs/the Worker; it just emits the bundled data
// artifact those modules read: apps/engine/data/retrieval-index.v1.json.
//
// WHAT (2026-08 gallery-corpus-v1 swap): reads the 509-host design-forward gallery corpus Luna's
// crawl track delivered (Awwwards/Minimal.gallery/Httpster/SiteInspire/Land-book/Godly/Lapa —
// data/tmp/gallery-corpus-v1/good-hosts.gallery-corpus-v1.ndjson), looks each host's structural
// genome up in the line-aligned gallery genome stream
// (data/tmp/gallery-corpus-v1/layout-genomes.gallery-corpus-v1.ndjson, schema
// `layout-genome.gallery-corpus-v1` — each host manifest row carries its own
// `genome.recordIndex`, verified 1:1 with the genome stream's line index for all 509 rows),
// vectorizes it with the SAME genome-vector logic the rumik retrieval run used (REUSE, not a new
// vector space — viz/layout-embeddings/genome-vector.mjs), and writes one compact JSON artifact:
// an array of {host, source, vector, centroidSimilarity, distinctiveness, layoutSummary}.
// Swappable: when a better/bigger corpus lands, point this script at the new host manifest +
// genome ndjson and rerun — nothing downstream (retrieval.mjs) hardcodes these 509 hosts.
//
// PREDECESSOR (superseded): the original 210-host clean-tier build read a CLEAN_GENERIC/
// CLEAN_DISTINCTIVE audit-buckets.json over the noisy 1,259-site AI-tool crawl. That build's own
// report flagged a fidelity issue — a few hosts near the corpus centroid recurred as the
// nearest-neighbor across unrelated intents (cosine dominated by the numeric group's unit-normed
// direction) — and recommended retuning once a design-forward corpus replaced it. This build (a)
// fits vector-space stats over the new 509-host corpus itself (not the old 210 or the noisy
// 1,259), and (b) records each entry's cosine-similarity-to-corpus-centroid so retrieval.mjs can
// penalize central hosts at query time (see CENTROID_PENALTY_WEIGHT there) instead of always
// surfacing raw-nearest, which is what caused the recurrence.
//
// FIELD-COMPATIBILITY (documented per the swap task): the v1 crawl schema's genomes carried NO
// bandRhythm/layeringDepth/headingOutline data (those NUMERIC_FIELDS dims were constant-zero for
// all 210 entries). The gallery-corpus-v1 genome schema is RICHER — verified across all 509 rows:
// bandRhythm.{darkBandCount,stripeAlternation,bgHueCount}, layeringDepth, and
// headingOutline.{h1Count,outlineDepth,levelSkips} all vary with real, non-constant distributions
// (e.g. darkBandCount 0–37 across 12 distinct values, layeringDepth 0–0.713 across 167 distinct
// values). Every field genomeVector()/buildLayoutSummary() reads (macro, hierarchy,
// sectionGrammar roles/heightShare/focalPoint/composition, pageKind) is present on every gallery
// genome row. No renames, no gaps — genomeVector()'s `?? 0` guards remain purely defensive here,
// not load-bearing as they were for the v1 corpus.
//
// Usage: node apps/engine/scripts/build-retrieval-index.mjs [pathToHostManifest] [pathToGenomes]

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  fitGenomeCorpus, genomeVector, cosine, NUMERIC_FIELDS, ROLE_VOCAB, GROUP_WEIGHTS,
} from "../../../viz/layout-embeddings/genome-vector.mjs";
import { canonicalRole } from "../role-aliases.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../../..");

// Default points at the gallery-corpus-v1 delivery (509 design-forward gallery hosts). Pass
// paths as argv[2]/argv[3] to point at a future/bigger corpus — nothing else in this script or
// in retrieval.mjs hardcodes these paths or this host count.
const HOSTS_PATH = process.argv[2]
  || resolve(ROOT, "data/tmp/gallery-corpus-v1/good-hosts.gallery-corpus-v1.ndjson");
const GENOMES_PATH = process.argv[3]
  || resolve(ROOT, "data/tmp/gallery-corpus-v1/layout-genomes.gallery-corpus-v1.ndjson");
const OUT_PATH = resolve(ROOT, "apps/engine/data/retrieval-index.v1.json");

function loadNdjson(path) {
  return readFileSync(path, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

const round4 = (n) => (Number.isFinite(n) ? Math.round(n * 10000) / 10000 : n);

// Inverts layout-families.mjs's deriveHierarchy formula (repetitionEntropy =
// clamp01(0.2 + 0.6*layoutVariance)) to recover a layoutVariance-like [0,1] scalar from REAL crawl
// hierarchy data — the v1 crawl schema has no direct layoutVariance field, only its downstream
// effect on repetitionEntropy. Used as the "layoutVariance proxy" the task asks the summary carry.
function layoutVarianceProxy(hierarchy) {
  const re = hierarchy?.repetitionEntropy;
  if (!Number.isFinite(re)) return null;
  return Math.min(1, Math.max(0, (re - 0.2) / 0.6));
}

function buildLayoutSummary(genome) {
  const sectionGrammar = (genome.sectionGrammar || []).map((s) => ({
    role: s.role,
    canonicalRole: canonicalRole(s.role),
    heightShare: s.heightShare,
    focalPoint: s.focalPoint,
    composition: s.composition,
  }));
  return {
    pageKind: genome.pageKind ?? null,
    sectionGrammar,
    macro: genome.macro ? { ...genome.macro } : null,
    hierarchy: genome.hierarchy ? { ...genome.hierarchy } : null,
    layoutVarianceProxy: layoutVarianceProxy(genome.hierarchy),
    // gallery-corpus-v1 genomes carry REAL bandRhythm/headingOutline/layeringDepth (see the
    // FIELD-COMPATIBILITY note up top) — unlike the v1 crawl corpus this index used to be built
    // from, these are not constant-zero, so we carry them through into the summary for downstream
    // consumers (explore.mjs's groundMacroToNeighbor only reads .macro today, but a richer
    // summary costs nothing and documents what the vector space actually saw).
    bandRhythm: genome.bandRhythm ? { ...genome.bandRhythm } : null,
    headingOutline: genome.headingOutline ? { ...genome.headingOutline } : null,
    layeringDepth: Number.isFinite(genome.layeringDepth) ? genome.layeringDepth : null,
  };
}

// Structural-fidelity gate (part of the recalibration): 59/509 gallery genomes have exactly ONE
// sectionGrammar entry with heightShare===1 — the section detector collapsed the whole page into
// a single undifferentiated block (a mix of true parked/blank-ish captures — role "unknown",
// roleConfidence 0 — and heavy-JS/SPA-shell pages the detector couldn't decompose, e.g.
// cloudflare.com, ghostly.com — role assigned but with no real internal structure). With only one
// section, hierarchy numerics collapse to extreme values (focalAreaShare/ctaProminence/
// contrastConcentration all 1, repetitionEntropy 0) that, after z-scoring + unit-norming, produce
// degenerate/extreme-corner vectors. Empirically these entries (verified against darkmofo.net.au,
// archivio-uno.com, martinsilvestre.com — all single-section) were the ones recurring as the
// top-1 nearest neighbor across unrelated synthetic family queries in the 8-intent variety
// validation, EVEN THOUGH their centroidSimilarity is low — i.e. this is a hubness artifact of
// degenerate vectors, not corpus-centroid proximity, so the centroid-penalty alone (below) doesn't
// fix it. Excluding single-section entries from the RETRIEVAL index (not from Luna's corpus
// itself — this is index-build-time curation only) removes the degenerate vectors at the source.
function hasStructuralFidelity(genome) {
  return Array.isArray(genome.sectionGrammar) && genome.sectionGrammar.length >= 2;
}

function main() {
  const hostRows = loadNdjson(HOSTS_PATH);
  const genomes = loadNdjson(GENOMES_PATH);

  const found = [];
  const missing = [];
  const lowFidelity = [];
  for (let i = 0; i < hostRows.length; i++) {
    const row = hostRows[i];
    const recordIndex = Number.isInteger(row?.genome?.recordIndex) ? row.genome.recordIndex : i;
    const genome = genomes[recordIndex];
    if (!row?.host || !genome) { missing.push(row?.host ?? `<row ${i}>`); continue; }
    if (!hasStructuralFidelity(genome)) { lowFidelity.push(row.host); continue; }
    found.push({ row, genome });
  }

  // Fit z-score stats over the gallery corpus itself (509 design-forward hosts) — NOT the old
  // 210-host clean tier and NOT the noisy 1,259-site full pull. The vector space (and every query
  // vectorized against it at runtime via intentToQuery) must be calibrated to the corpus this
  // index actually indexes, or the z-scores are meaningless.
  const stats = fitGenomeCorpus(found.map((f) => f.genome));

  const vectored = found.map(({ row, genome }) => ({
    host: row.host,
    source: row.source ?? null,
    slopCandidateCount: Array.isArray(row.slopCandidates) ? row.slopCandidates.length : 0,
    vector: genomeVector(genome, stats),
    layoutSummary: buildLayoutSummary(genome),
  }));

  // ── recalibration: centroid-similarity per entry ────────────────────────────────────────────
  // The predecessor build's report flagged a few corpus-central hosts recurring as the
  // nearest-neighbor across unrelated intents. Fix: precompute each entry's cosine similarity to
  // the CORPUS CENTROID (mean vector over all 509) and ship it in the index. retrieval.mjs uses
  // this at query time as a penalty term — hosts that sit close to "the average layout" rank
  // worse, all else equal, than hosts that are further from center, breaking the collapse without
  // touching the underlying vector space or genome-vector.mjs (shared with other tracks).
  const dims = vectored[0]?.vector.length ?? 0;
  const centroid = new Array(dims).fill(0);
  for (const v of vectored) for (let i = 0; i < dims; i++) centroid[i] += v.vector[i] / vectored.length;

  const entries = vectored.map((v) => {
    const centroidSimilarity = round4(cosine(v.vector, centroid));
    return {
      host: v.host,
      source: v.source,
      slopCandidateCount: v.slopCandidateCount,
      centroidSimilarity,
      distinctiveness: round4(1 - centroidSimilarity),
      vector: v.vector.map(round4),
      layoutSummary: v.layoutSummary,
    };
  });

  const out = {
    schemaVersion: "retrieval-index.v1",
    builtFrom: {
      corpus: "gallery-corpus-v1",
      hostManifest: "data/tmp/gallery-corpus-v1/good-hosts.gallery-corpus-v1.ndjson",
      genomes: "data/tmp/gallery-corpus-v1/layout-genomes.gallery-corpus-v1.ndjson",
      genomeSchema: "layout-genome.gallery-corpus-v1",
      vectorizer: "viz/layout-embeddings/genome-vector.mjs",
    },
    counts: {
      corpusTotal: hostRows.length, indexed: entries.length, missing: missing.length,
      lowFidelity: lowFidelity.length,
    },
    missingHosts: missing,
    lowFidelityHosts: lowFidelity,
    vectorSpace: {
      numericFieldOrder: NUMERIC_FIELDS.map(([name]) => name),
      roleVocab: ROLE_VOCAB,
      groupWeights: GROUP_WEIGHTS,
      numericStats: stats.numericStats,
      centroid: centroid.map(round4),
    },
    entries,
  };

  writeFileSync(OUT_PATH, JSON.stringify(out));
  const preview = missing.slice(0, 10).join(", ") + (missing.length > 10 ? "…" : "");
  console.log(
    `wrote ${entries.length}/${hostRows.length} gallery hosts to ${OUT_PATH}`
    + (missing.length ? ` (${missing.length} missing genome lookup: ${preview})` : "")
    + ` (${lowFidelity.length} excluded for low structural fidelity — single undifferentiated section)`,
  );
}

main();
