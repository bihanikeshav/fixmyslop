// apps/engine/retrieval.mjs — Subsystem 3e: the layout RETRIEVAL channel (pure math, no AI, no
// Math.random, no Date.now — deterministic; runs in a Cloudflare Worker, the browser, and the
// CLI).
//
// WHY: layout-families.mjs's ~18 hand-curated LAYOUT_FAMILIES are our only source of "what good
// layout looks like." This module adds a second, complementary source: REAL layouts from a
// design-forward corpus (gallery-corpus-v1 — 509 human-curated sites pulled from Awwwards,
// Minimal.gallery, Httpster, SiteInspire, Land-book, Godly and Lapa, all past the crawl's
// failure+spam gates). At generation time, explore.mjs retrieves the nearest real neighbor(s) to
// whichever family it already selected and uses them to GROUND that direction's macro numbers in
// something a real site actually shipped, instead of only the family's hand-authored numbers.
// Curated families remain the structural skeleton (perturb.mjs's gates only validate against a
// LAYOUT_FAMILIES entry) — retrieval never replaces a family wholesale (see explore.mjs's header
// comment for the (a)-vs-(b) decision).
//
// DATA ARTIFACT: apps/engine/data/retrieval-index.v1.json — built OFFLINE by
// apps/engine/scripts/build-retrieval-index.mjs (a Node/fs script, never imported at runtime).
// Swappable: rebuild the index against a different/better corpus and this module needs zero code
// changes — it only ever reads `entries[].vector` / `.layoutSummary` /  `.centroidSimilarity` and
// `vectorSpace.numericStats` off whatever JSON is bundled here.
//
// VECTOR SPACE: reuses viz/layout-embeddings/genome-vector.mjs verbatim — the SAME production
// vectorizer (z-scored macro/hierarchy numerics + one-hot alignment + role histogram + role-bigram
// histogram, group-weighted, unit-normed per group) the rumik hybrid-retrieval run used. That file
// is pure JS with no fs/node dependency, so importing it here bundles cleanly wherever this module
// runs (Worker/browser/CLI) — same as any other apps/engine import.
//
// RECALIBRATION (2026-08 gallery-corpus-v1 swap): the predecessor 210-host index's own build
// report flagged a fidelity issue — a handful of hosts sitting near the corpus centroid recurred
// as the raw-nearest neighbor across unrelated intents, because cosine similarity in this vector
// space is dominated by the numeric group's unit-normed direction, and "central" vectors are
// cosine-close to almost everything. Fix: the builder now ships each entry's cosine similarity to
// the corpus centroid (`centroidSimilarity`, computed once over the 509-host gallery corpus).
// retrieveLayouts() below applies CENTROID_PENALTY_WEIGHT * centroidSimilarity as a ranking
// penalty on top of the raw cosine distance — central hosts still show up when they're genuinely
// the best match, but no longer dominate every direction just by being everyone's second-closest
// neighbor. `distance` in the returned records stays the PURE 1-cosine metric (never adjusted) —
// the penalty only affects sort order, via the internal `rankScore`.
import index from "./data/retrieval-index.v1.json" with { type: "json" };
import { genomeVector, cosine } from "../../viz/layout-embeddings/genome-vector.mjs";

const EMPTY_INDEX = { entries: [], vectorSpace: null, schemaVersion: null, counts: null };

// Tuned empirically against the 8-intent variety validation (see retrieval.test.mjs / the task's
// validation pass): large enough to break centroid-collapse across distinct intents, small enough
// that a genuinely much-closer central host can still win over a barely-more-distinctive far one.
const CENTROID_PENALTY_WEIGHT = 0.35;

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
 * retrieveLayouts(queryVector, n=3, {exclude=[], source=null}={}) →
 * nearest-N [{host, source, distance, centroidSimilarity, layoutSummary}], ranked nearest-and-most-
 * distinctive first. `distance` = 1 − cosineSimilarity(query, entry.vector), clamped to [0, ∞)
 * against float noise — always the PURE cosine distance, never adjusted. Ranking (and therefore
 * slice order) instead uses `distance + CENTROID_PENALTY_WEIGHT * entry.centroidSimilarity`, the
 * recalibration fix for corpus-central hosts recurring across unrelated queries (see header
 * comment) — entries missing a precomputed `centroidSimilarity` (e.g. an older/foreign index)
 * fall back to a 0 penalty, i.e. pure-distance ranking. Deterministic — a pure function of
 * (queryVector, the bundled index, exclude, source). Returns [] when the index is empty/absent or
 * queryVector is null (fallback path).
 */
export function retrieveLayouts(queryVector, n = 3, { exclude = [], source = null } = {}) {
  const idx = safeIndex();
  if (!queryVector || !idx.entries.length) return [];
  const excludeSet = new Set(exclude);
  const scored = [];
  for (const e of idx.entries) {
    if (excludeSet.has(e.host)) continue;
    if (source && e.source !== source) continue;
    const sim = cosine(queryVector, e.vector);
    const distance = Math.max(0, 1 - sim);
    const centroidSimilarity = Number.isFinite(e.centroidSimilarity) ? e.centroidSimilarity : 0;
    scored.push({
      host: e.host,
      source: e.source,
      distance,
      centroidSimilarity,
      rankScore: distance + CENTROID_PENALTY_WEIGHT * centroidSimilarity,
      layoutSummary: e.layoutSummary,
    });
  }
  scored.sort((a, b) => (a.rankScore - b.rankScore) || (a.host < b.host ? -1 : a.host > b.host ? 1 : 0));
  return scored.slice(0, Math.max(0, n)).map(({ rankScore, ...rest }) => rest);
}
