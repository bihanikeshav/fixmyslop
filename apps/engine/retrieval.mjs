// apps/engine/retrieval.mjs — Subsystem 3e: the layout RETRIEVAL channel (pure math, no AI, no
// Math.random, no Date.now — deterministic; runs in a Cloudflare Worker, the browser, and the
// CLI).
//
// WHY: layout-families.mjs's ~18 hand-curated LAYOUT_FAMILIES are our only source of "what good
// layout looks like." This module adds a second, complementary source: REAL layouts from the
// clean-tier corpus (a 2026-08 audit of the 1,259-site geometry crawl found 210 sites — 139
// CLEAN_GENERIC + 71 CLEAN_DISTINCTIVE — that pass the failure+slop gates). At generation time,
// explore.mjs retrieves the nearest real neighbor(s) to whichever family it already selected and
// uses them to GROUND that direction's macro numbers in something a real site actually shipped,
// instead of only the family's hand-authored numbers. Curated families remain the structural
// skeleton (perturb.mjs's gates only validate against a LAYOUT_FAMILIES entry) — retrieval never
// replaces a family wholesale (see explore.mjs's header comment for the (a)-vs-(b) decision).
//
// DATA ARTIFACT: apps/engine/data/retrieval-index.v1.json — built OFFLINE by
// apps/engine/scripts/build-retrieval-index.mjs (a Node/fs script, never imported at runtime).
// Swappable: rebuild the index against a different/better corpus and this module needs zero code
// changes — it only ever reads `entries[].vector` / `.layoutSummary` and `vectorSpace.numericStats`
// off whatever JSON is bundled here.
//
// VECTOR SPACE: reuses viz/layout-embeddings/genome-vector.mjs verbatim — the SAME production
// vectorizer (z-scored macro/hierarchy numerics + one-hot alignment + role histogram + role-bigram
// histogram, group-weighted, unit-normed per group) the rumik hybrid-retrieval run used. That file
// is pure JS with no fs/node dependency, so importing it here bundles cleanly wherever this module
// runs (Worker/browser/CLI) — same as any other apps/engine import.
import index from "./data/retrieval-index.v1.json" with { type: "json" };
import { genomeVector, cosine } from "../../viz/layout-embeddings/genome-vector.mjs";

const EMPTY_INDEX = { entries: [], vectorSpace: null, schemaVersion: null, counts: null };

// The bundled index may be absent/empty (e.g. a build that strips apps/engine/data, or a future
// rebuild that produced zero entries) — every export below degrades to "no retrieval happened"
// rather than throwing, per the task's fallback requirement.
function safeIndex() {
  return index && Array.isArray(index.entries) ? index : EMPTY_INDEX;
}

/** hasIndex() → true when the bundled retrieval index has at least one entry. */
export function hasIndex() {
  return safeIndex().entries.length > 0;
}

/** indexStats() → { size, schemaVersion, counts } — introspection for tests/callers. */
export function indexStats() {
  const idx = safeIndex();
  return { size: idx.entries.length, schemaVersion: idx.schemaVersion ?? null, counts: idx.counts ?? null };
}

/**
 * intentToQuery(iv, layoutCandidate) → vector | null
 *
 * The intent→structure bridge (documented per the task's decision point). `layoutCandidate` is a
 * composed LayoutGenome — the shape suggestLayout()/composeSlotGenome already produce, carrying
 * `.macro`/`.hierarchy`/`.sectionGrammar`/`.pageKind` — exactly what genomeVector() expects. The
 * bridge is deliberately the SIMPLEST robust one: vectorize the family/candidate the intent has
 * ALREADY selected (suggestLayout's dial-fit ranking already did the intent→family work) in this
 * same index space, then retrieveLayouts() below pulls real neighbors to it. This sidesteps
 * building a second, separate intent-only embedding that would need its own calibration against
 * the crawl corpus — the family selection IS the intent signal, retrieval just grounds it in real
 * structure.
 *
 * `iv` (the intent-values bag suggestLayout/perturbGenome pass around) is accepted for signature
 * symmetry with the rest of the engine and reserved for a future direct intent-dial embedding
 * should the family-proxy bridge prove too coarse; it is not read here.
 */
export function intentToQuery(iv, layoutCandidate) {
  const idx = safeIndex();
  if (!idx.vectorSpace || !layoutCandidate) return null;
  const stats = { numericStats: idx.vectorSpace.numericStats };
  return genomeVector(layoutCandidate, stats);
}

/**
 * retrieveLayouts(queryVector, n=3, {exclude=[], bucket=null}={}) →
 * nearest-N [{host, source, bucket, distance, layoutSummary}], distance ascending (nearest first).
 * distance = 1 − cosineSimilarity(query, entry.vector), clamped to [0, ∞) against float noise.
 * Deterministic — a pure function of (queryVector, the bundled index, exclude, bucket). Returns []
 * when the index is empty/absent or queryVector is null (fallback path).
 */
export function retrieveLayouts(queryVector, n = 3, { exclude = [], bucket = null } = {}) {
  const idx = safeIndex();
  if (!queryVector || !idx.entries.length) return [];
  const excludeSet = new Set(exclude);
  const scored = [];
  for (const e of idx.entries) {
    if (excludeSet.has(e.host)) continue;
    if (bucket && e.bucket !== bucket) continue;
    const sim = cosine(queryVector, e.vector);
    scored.push({
      host: e.host,
      source: e.source,
      bucket: e.bucket,
      distance: Math.max(0, 1 - sim),
      layoutSummary: e.layoutSummary,
    });
  }
  scored.sort((a, b) => (a.distance - b.distance) || (a.host < b.host ? -1 : a.host > b.host ? 1 : 0));
  return scored.slice(0, Math.max(0, n));
}
