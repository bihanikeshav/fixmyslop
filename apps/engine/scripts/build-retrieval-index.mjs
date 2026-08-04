#!/usr/bin/env node
// apps/engine/scripts/build-retrieval-index.mjs — OFFLINE index builder for the layout
// retrieval channel (see apps/engine/retrieval.mjs). Node-only (uses fs) — this script is never
// imported at runtime by engine.mjs/explore.mjs/the Worker; it just emits the bundled data
// artifact those modules read: apps/engine/data/retrieval-index.v1.json.
//
// WHAT: reads the clean-tier host list (audit-buckets.json — CLEAN_GENERIC ∪ CLEAN_DISTINCTIVE,
// 210 hosts total per the 2026-08 corpus-quality audit), looks each host's structural genome up
// in the v1 layout-crawl ndjson pair (genome-per-line, host given by the line-aligned manifest),
// vectorizes it with the SAME genome-vector logic the rumik retrieval run used (REUSE, not a new
// vector space — viz/layout-embeddings/genome-vector.mjs), and writes one compact JSON artifact:
// an array of {host, source, bucket, vector, layoutSummary}. Swappable: when a better
// design-forward corpus lands, point this script at the new audit-buckets.json/genome ndjson and
// rerun — nothing downstream (retrieval.mjs) hardcodes these 210 hosts.
//
// Usage: node apps/engine/scripts/build-retrieval-index.mjs [pathToAuditBucketsJson]

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  fitGenomeCorpus, genomeVector, NUMERIC_FIELDS, ROLE_VOCAB, GROUP_WEIGHTS,
} from "../../../viz/layout-embeddings/genome-vector.mjs";
import { canonicalRole } from "../role-aliases.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../../..");

// Default points at the audit run's scratchpad output (per the task brief). Pass a path as argv[2]
// to point at a fresh audit-buckets.json (e.g. once data/tmp/corpus-quality-audit.md's producing
// script writes one into the repo instead of a session scratchpad).
const DEFAULT_AUDIT_BUCKETS = process.argv[2]
  || "C:/Users/Keshav/AppData/Local/Temp/claude/Z--ai-slop-font/b85c837e-5061-42c0-906b-193b27d64f59/scratchpad/audit-buckets.json";
const MANIFEST_PATH = resolve(ROOT, "data/layout-crawl/layout-genome-manifest.v1.ndjson");
const GENOMES_PATH = resolve(ROOT, "data/layout-crawl/layout-genomes.v1.ndjson");
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
    // v1 crawl schema (data/layout-crawl/layout-genomes.v1.ndjson) carries NO bandRhythm /
    // layeringDepth / headingOutline fields at all — verified 0/1259 lines have any of the three.
    // Those numeric slots in genome-vector.mjs's NUMERIC_FIELDS therefore contribute a constant 0
    // to every vector below (fitGenomeCorpus sees an empty finite-value sample, so mean=0/std
    // guarded to 1 — see genome-vector.mjs). Documented fidelity gap: bandRhythm here is always
    // null until a future crawl pass adds that field to the v1(+) genome schema.
    bandRhythm: null,
  };
}

function main() {
  const buckets = JSON.parse(readFileSync(DEFAULT_AUDIT_BUCKETS, "utf8"));
  const cleanTier = [
    ...(buckets.CLEAN_DISTINCTIVE || []).map((e) => ({ ...e, bucket: "CLEAN_DISTINCTIVE" })),
    ...(buckets.CLEAN_GENERIC || []).map((e) => ({ ...e, bucket: "CLEAN_GENERIC" })),
  ];

  const manifest = loadNdjson(MANIFEST_PATH);
  const genomes = loadNdjson(GENOMES_PATH);
  if (manifest.length !== genomes.length) {
    throw new Error(`manifest/genomes line-count mismatch: ${manifest.length} vs ${genomes.length}`);
  }
  const byHost = new Map();
  for (let i = 0; i < manifest.length; i++) {
    if (manifest[i]?.host) byHost.set(manifest[i].host, genomes[i]);
  }

  const found = [];
  const missing = [];
  for (const entry of cleanTier) {
    const genome = byHost.get(entry.host);
    if (!genome) { missing.push(entry.host); continue; }
    found.push({ entry, genome });
  }

  // Fit z-score stats over the clean-tier corpus itself (this IS the clean, non-quarantined corpus
  // per the audit — fitting on the noisy full 1,259-site pull would let SLOP/FAILURE outliers skew
  // the mean/std this index's vectors — and the query bridge — depend on at runtime).
  const stats = fitGenomeCorpus(found.map((f) => f.genome));

  const entries = found.map(({ entry, genome }) => ({
    host: entry.host,
    source: entry.source ?? null,
    bucket: entry.bucket,
    score: Number.isFinite(entry.score) ? entry.score : null,
    vector: genomeVector(genome, stats).map(round4),
    layoutSummary: buildLayoutSummary(genome),
  }));

  const out = {
    schemaVersion: "retrieval-index.v1",
    builtFrom: {
      auditBuckets: DEFAULT_AUDIT_BUCKETS,
      genomes: "data/layout-crawl/layout-genomes.v1.ndjson",
      manifest: "data/layout-crawl/layout-genome-manifest.v1.ndjson",
      vectorizer: "viz/layout-embeddings/genome-vector.mjs",
    },
    counts: { cleanTierTotal: cleanTier.length, indexed: entries.length, missing: missing.length },
    missingHosts: missing,
    vectorSpace: {
      numericFieldOrder: NUMERIC_FIELDS.map(([name]) => name),
      roleVocab: ROLE_VOCAB,
      groupWeights: GROUP_WEIGHTS,
      numericStats: stats.numericStats,
    },
    entries,
  };

  writeFileSync(OUT_PATH, JSON.stringify(out));
  const preview = missing.slice(0, 10).join(", ") + (missing.length > 10 ? "…" : "");
  console.log(
    `wrote ${entries.length}/${cleanTier.length} clean-tier hosts to ${OUT_PATH}`
    + (missing.length ? ` (${missing.length} missing: ${preview})` : ""),
  );
}

main();
