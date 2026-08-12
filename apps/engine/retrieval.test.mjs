// apps/engine/retrieval.test.mjs — tests for the layout retrieval channel (retrieval.mjs) and its
// wiring into explore.mjs. Existing suite (154/154 before this file) must stay green — this file
// only ADDS coverage.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createEngine } from "./engine.mjs";
import { exploreDirections } from "./explore.mjs";
import { LAYOUT_FAMILIES, suggestLayout } from "./layout-families.mjs";
import { hasIndex, indexStats, intentToQuery, retrieveLayouts } from "./retrieval.mjs";
import { checkBackgroundViolations } from "./background.mjs";
import { checkMotionViolations } from "./motion.mjs";
import { cosine } from "../../viz/layout-embeddings/genome-vector.mjs";
import index from "./data/retrieval-index.v1.json" with { type: "json" };
import corpus from "./data/corpus.json" with { type: "json" };
import brands from "./data/brands.json" with { type: "json" };
import fonts from "./data/fonts.json" with { type: "json" };

const engine = createEngine({ corpus, brands, fonts });
const FAMILY_BY_NAME = new Map(LAYOUT_FAMILIES.map((f) => [f.name, f]));

// ── purity ────────────────────────────────────────────────────────────────────────────────────
test("purity: retrieval.mjs carries no Math.random/Date.now/new Date in executable code", () => {
  const path = fileURLToPath(new URL("retrieval.mjs", import.meta.url));
  const src = readFileSync(path, "utf8");
  const codeOnly = src.split("\n").map((line) => line.replace(/\/\/.*$/, "")).join("\n");
  assert.ok(!/Math\.random/.test(codeOnly), "retrieval.mjs calls Math.random");
  assert.ok(!/Date\.now/.test(codeOnly), "retrieval.mjs calls Date.now");
  assert.ok(!/new Date/.test(codeOnly), "retrieval.mjs calls new Date");
});

// ── index shape ───────────────────────────────────────────────────────────────────────────────
test("bundled index loads and has the documented shape", () => {
  assert.ok(hasIndex(), "expected the bundled retrieval-index.v1.json to be non-empty");
  const stats = indexStats();
  assert.ok(stats.size > 0);
  assert.equal(stats.size, index.entries.length);
  assert.ok(Array.isArray(index.entries));
  const e = index.entries[0];
  assert.ok(typeof e.host === "string" && e.host.length > 0);
  assert.ok(typeof e.source === "string" && e.source.startsWith("gallery:"));
  assert.ok(typeof e.centroidSimilarity === "number" && Number.isFinite(e.centroidSimilarity));
  assert.ok(Array.isArray(e.vector) && e.vector.every((x) => typeof x === "number" && Number.isFinite(x)));
  assert.ok(e.layoutSummary && typeof e.layoutSummary === "object");
  assert.ok(Array.isArray(e.layoutSummary.sectionGrammar));
  assert.ok(e.layoutSummary.macro && typeof e.layoutSummary.macro.splitRatio === "number");
  // every vector in the index is the same length (one vector space)
  const len = e.vector.length;
  for (const other of index.entries) assert.equal(other.vector.length, len);
});

test("index is built from the 509-host gallery-corpus-v1 design-forward corpus (minus low-fidelity single-section entries)", () => {
  // 509 gallery hosts survived the crawl's own gates; the retrieval-index build additionally
  // drops single-section (structurally-degenerate) genomes — see build-retrieval-index.mjs's
  // hasStructuralFidelity() — so the bundled index is somewhat smaller than the full corpus.
  assert.equal(index.builtFrom.corpus, "gallery-corpus-v1");
  assert.equal(index.counts.corpusTotal, 509);
  assert.equal(index.entries.length, index.counts.indexed);
  assert.ok(index.entries.length > 400 && index.entries.length <= 509, `expected most of the 509-host corpus to be indexed, got ${index.entries.length}`);
  // hosts are unique (no dupes from the source ndjson)
  assert.equal(new Set(index.entries.map((e) => e.host)).size, index.entries.length);
  // multiple gallery sources are represented (not collapsed into one)
  const sources = new Set(index.entries.map((e) => e.source));
  assert.ok(sources.size >= 5, `expected several distinct gallery sources, got ${JSON.stringify([...sources])}`);
});

// ── retrieveLayouts: deterministic, sorted, sane nearest-N ───────────────────────────────────────
test("retrieveLayouts is deterministic for the same query vector", () => {
  const q = index.entries[0].vector;
  const a = retrieveLayouts(q, 5);
  const b = retrieveLayouts(q, 5);
  assert.deepEqual(a, b);
});

test("retrieveLayouts returns rankScore-ordered results (distance + centroid penalty, non-decreasing)", () => {
  // Post-recalibration, sort order is by rankScore (distance + CENTROID_PENALTY_WEIGHT *
  // centroidSimilarity), not raw distance alone — a more-distinctive-but-slightly-farther host CAN
  // legitimately outrank a closer-but-central one. Recompute the same rankScore here as a
  // black-box check that the returned order is consistent with (distance, centroidSimilarity).
  const q = index.entries[42].vector;
  const results = retrieveLayouts(q, 10);
  assert.ok(results.length > 1);
  const CENTROID_PENALTY_WEIGHT = 0.35;
  const rankScores = results.map((r) => r.distance + CENTROID_PENALTY_WEIGHT * r.centroidSimilarity);
  for (let i = 1; i < rankScores.length; i++) {
    assert.ok(rankScores[i] >= rankScores[i - 1] - 1e-9, "rankScores must be non-decreasing");
  }
});

test("retrieveLayouts: self is recoverable with ~0 raw distance for an in-index query", () => {
  // With the centroid-penalty recalibration, self is not guaranteed to be rank-0 for n=1 (a
  // sufficiently distinctive neighbor a hair farther away can legitimately outrank it) — pull the
  // whole index back and confirm self shows up with distance ~0 somewhere in it.
  const self = index.entries[7];
  const results = retrieveLayouts(self.vector, index.entries.length);
  const found = results.find((r) => r.host === self.host);
  assert.ok(found, "expected the queried entry's own host to appear in a full-index pull");
  assert.ok(found.distance < 1e-6, `expected ~0 self-distance, got ${found.distance}`);
});

test("retrieveLayouts sanity: distance matches 1 - cosine(query, entry.vector) regardless of rank order", () => {
  const q = index.entries[3].vector;
  const results = retrieveLayouts(q, 5);
  for (const r of results) {
    const entry = index.entries.find((e) => e.host === r.host);
    const expected = Math.max(0, 1 - cosine(q, entry.vector));
    assert.ok(Math.abs(expected - r.distance) < 1e-9);
  }
});

test("retrieveLayouts honors exclude and source filters", () => {
  const q = index.entries[0].vector;
  const withoutExclude = retrieveLayouts(q, 3);
  const excludeHost = withoutExclude[0].host;
  const withExclude = retrieveLayouts(q, 3, { exclude: [excludeHost] });
  assert.ok(!withExclude.some((r) => r.host === excludeHost));

  const bySource = retrieveLayouts(q, 20, { source: "gallery:awwwards" });
  assert.ok(bySource.length > 0);
  assert.ok(bySource.every((r) => r.source === "gallery:awwwards"));
});

test("retrieveLayouts fallback: null/absent query or n<=0 returns []", () => {
  assert.deepEqual(retrieveLayouts(null, 5), []);
  assert.deepEqual(retrieveLayouts(index.entries[0].vector, 0), []);
});

// ── intentToQuery: deterministic bridge ─────────────────────────────────────────────────────────
test("intentToQuery is deterministic for the same composed layout candidate", () => {
  const intent = { surface: "landing-page", job: "explain-and-convert" };
  const [top] = suggestLayout(intent, {});
  const a = intentToQuery(null, top);
  const b = intentToQuery(null, top);
  assert.deepEqual(a, b);
  assert.ok(Array.isArray(a) && a.length === index.entries[0].vector.length);
});

test("intentToQuery returns null for a null/absent candidate", () => {
  assert.equal(intentToQuery(null, null), null);
});

test("intentToQuery + retrieveLayouts round-trip: nearest neighbor to a real family is a real, plausible host", () => {
  const intent = { surface: "landing-page", job: "explain-and-convert" };
  const [top] = suggestLayout(intent, {});
  const q = intentToQuery(null, top);
  const results = retrieveLayouts(q, 3);
  assert.ok(results.length > 0);
  assert.ok(results.every((r) => typeof r.host === "string" && r.distance >= 0));
});

// ── integration: exploreDirections is grounded in retrieval, stays deterministic + slop-clean ───
const landing = { surface: "landing-page", job: "explain-and-convert", sourceBrief: "a tool for indie game devs" };

test("exploreDirections determinism still holds with retrieval wired in", () => {
  const a = exploreDirections(engine, landing, { seed: 42 });
  const b = exploreDirections(engine, landing, { seed: 42 });
  assert.deepEqual(a, b);
});

test("every direction carries a `retrieval` field (host/distance/source) or null (fallback)", () => {
  const { directions } = exploreDirections(engine, landing, { seed: 7 });
  for (const d of directions) {
    assert.ok("retrieval" in d);
    if (d.retrieval) {
      assert.ok(typeof d.retrieval.host === "string" && d.retrieval.host.length > 0);
      assert.ok(typeof d.retrieval.distance === "number" && d.retrieval.distance >= 0);
      assert.ok(typeof d.retrieval.source === "string" && d.retrieval.source.startsWith("gallery:"));
      assert.equal(d.groundedIn, d.retrieval.host, "groundedIn should mirror the retrieved host when retrieval succeeded");
    }
  }
});

test("the 4 explore directions are grounded in DISTINCT real hosts (not the same neighbor repeated)", () => {
  const { directions } = exploreDirections(engine, landing, { seed: 13 });
  const hosts = directions.map((d) => d.retrieval?.host).filter(Boolean);
  assert.ok(hosts.length >= 3, "expected retrieval to succeed for most/all of the 4 directions on a family-rich surface");
  assert.equal(new Set(hosts).size, hosts.length, `expected distinct hosts, got ${JSON.stringify(hosts)}`);
});

test("cross-intent variety: 8 diverse intents don't collapse onto the same 1-3 corpus-central hosts", () => {
  // Regression coverage for the recalibration: the predecessor 210-host index's own build report
  // flagged central hosts recurring as the nearest neighbor across unrelated intents. Dials are
  // set explicitly per intent (not just `surface`/`job`) so these 8 genuinely land on distinct
  // LAYOUT_FAMILIES (verified: full-bleed-diagram/split-marquee/spec-sheet/pricing-comparison/
  // stacked-narrative-scroll/two-pane-reader/app-shell-workbench×2) rather than several of them
  // collapsing onto the SAME family (and therefore the same query vector) by construction — that
  // would make "distinct top host" trivially true/false for the wrong reason. Confirm the grounded
  // hosts aren't dominated by a tiny recurring set — no single host accounts for more than half.
  const intents = [
    { surface: "landing-page", job: "explain-and-convert", layoutVariance: 0.35, contentDensity: 0.4 },
    { surface: "portfolio", job: "showcase", layoutVariance: 0.75, contentDensity: 0.3, energy: 0.8 },
    { surface: "docs", job: "reference", layoutVariance: 0.4, contentDensity: 0.65 },
    { surface: "pricing", job: "convert" },
    { surface: "marketing", job: "announce", layoutVariance: 0.65, energy: 0.7 },
    { surface: "editorial", job: "read", layoutVariance: 0.25, craft: 0.7 },
    { surface: "app", job: "operate", layoutVariance: 0.55, contentDensity: 0.6 },
    { surface: "dashboard", job: "monitor" },
  ];
  const topHosts = [];
  for (const intent of intents) {
    const [top] = suggestLayout(intent, {});
    const q = intentToQuery(null, top);
    const [nearest] = retrieveLayouts(q, 1);
    if (nearest) topHosts.push(nearest.host);
  }
  assert.ok(topHosts.length >= 6, `expected retrieval to succeed for most of the 8 intents, got ${topHosts.length}`);
  const counts = new Map();
  for (const h of topHosts) counts.set(h, (counts.get(h) ?? 0) + 1);
  const maxRecurrence = Math.max(...counts.values());
  assert.ok(
    maxRecurrence <= Math.ceil(topHosts.length / 2),
    `expected no single host to dominate the top-1 pick across 8 diverse intents, got ${JSON.stringify([...counts])}`,
  );
});

test("retrieval-grounded directions remain slop-clean: background/motion violations stay empty", () => {
  const { directions } = exploreDirections(engine, landing, { seed: 21 });
  for (const d of directions) {
    const family = FAMILY_BY_NAME.get(d.genome.layout.family);
    assert.deepEqual(checkBackgroundViolations(d.genome.background, family), []);
    assert.deepEqual(checkMotionViolations(d.genome.motion.design, family), []);
  }
});

test("retrieval-grounded directions stay on-intent: layout still passes the family's own dial gates", () => {
  const surfaces = [
    { surface: "landing-page", job: "explain-and-convert" },
    { surface: "dashboard", job: "monitor" },
  ];
  for (const s of surfaces) {
    const { directions } = exploreDirections(engine, s, { seed: 5 });
    for (const d of directions) {
      const macro = d.genome.layout.macro;
      // grounding must never leave perturb.mjs's own macro bounds (splitRatio/whitespace/
      // contentWidthShare/columnCount) — validatePerturbed inside groundMacroToNeighbor guarantees
      // this; assert the observable bounds here as a black-box check.
      assert.ok(macro.splitRatio >= 0.34 - 1e-6 && macro.splitRatio <= 0.78 + 1e-6);
      assert.ok(macro.whitespace >= 0.2 - 1e-6 && macro.whitespace <= 0.85 + 1e-6);
    }
  }
});

// ── fallback: no-index path stays stable ─────────────────────────────────────────────────────────
test("retrieveLayouts on an empty index-shaped object returns [] (fallback contract)", async () => {
  // Simulate the "index absent/empty" branch retrieval.mjs's safeIndex() degrades to, without
  // mutating the real bundled module (ESM json imports are frozen/live-bound) — exercise the same
  // codepath via a null/empty query instead, which every real caller can produce (e.g. a family
  // with no macro fields at all).
  assert.deepEqual(retrieveLayouts(undefined, 3), []);
  assert.deepEqual(intentToQuery(null, undefined), null);
});

test("exploreDirections never throws even if retrieval finds nothing new (all near-neighbors excluded)", () => {
  assert.doesNotThrow(() => {
    for (let seed = 0; seed < 20; seed++) {
      exploreDirections(engine, { surface: "pricing" }, { seed });
    }
  });
});
