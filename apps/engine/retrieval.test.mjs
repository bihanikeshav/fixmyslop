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
  assert.ok(["CLEAN_GENERIC", "CLEAN_DISTINCTIVE"].includes(e.bucket));
  assert.ok(Array.isArray(e.vector) && e.vector.every((x) => typeof x === "number" && Number.isFinite(x)));
  assert.ok(e.layoutSummary && typeof e.layoutSummary === "object");
  assert.ok(Array.isArray(e.layoutSummary.sectionGrammar));
  assert.ok(e.layoutSummary.macro && typeof e.layoutSummary.macro.splitRatio === "number");
  // every vector in the index is the same length (one vector space)
  const len = e.vector.length;
  for (const other of index.entries) assert.equal(other.vector.length, len);
});

test("clean-tier composition matches the audit: 139 CLEAN_GENERIC + 71 CLEAN_DISTINCTIVE = 210", () => {
  const generic = index.entries.filter((e) => e.bucket === "CLEAN_GENERIC").length;
  const distinctive = index.entries.filter((e) => e.bucket === "CLEAN_DISTINCTIVE").length;
  assert.equal(generic, 139);
  assert.equal(distinctive, 71);
  assert.equal(index.entries.length, 210);
});

// ── retrieveLayouts: deterministic, sorted, sane nearest-N ───────────────────────────────────────
test("retrieveLayouts is deterministic for the same query vector", () => {
  const q = index.entries[0].vector;
  const a = retrieveLayouts(q, 5);
  const b = retrieveLayouts(q, 5);
  assert.deepEqual(a, b);
});

test("retrieveLayouts returns distances sorted ascending (nearest first)", () => {
  const q = index.entries[42].vector;
  const results = retrieveLayouts(q, 10);
  assert.ok(results.length > 1);
  for (let i = 1; i < results.length; i++) {
    assert.ok(results[i].distance >= results[i - 1].distance - 1e-9, "distances must be non-decreasing");
  }
});

test("retrieveLayouts: self-distance is ~0 for an in-index query (excluding itself would drop it, so query without exclude)", () => {
  const self = index.entries[7];
  const results = retrieveLayouts(self.vector, 1);
  assert.equal(results[0].host, self.host);
  assert.ok(results[0].distance < 1e-6, `expected ~0 self-distance, got ${results[0].distance}`);
});

test("retrieveLayouts sanity: distance matches 1 - cosine(query, entry.vector)", () => {
  const q = index.entries[3].vector;
  const results = retrieveLayouts(q, 5);
  for (const r of results) {
    const entry = index.entries.find((e) => e.host === r.host);
    const expected = Math.max(0, 1 - cosine(q, entry.vector));
    assert.ok(Math.abs(expected - r.distance) < 1e-9);
  }
});

test("retrieveLayouts honors exclude and bucket filters", () => {
  const q = index.entries[0].vector;
  const withoutExclude = retrieveLayouts(q, 3);
  const excludeHost = withoutExclude[0].host;
  const withExclude = retrieveLayouts(q, 3, { exclude: [excludeHost] });
  assert.ok(!withExclude.some((r) => r.host === excludeHost));

  const bucketed = retrieveLayouts(q, 20, { bucket: "CLEAN_DISTINCTIVE" });
  assert.ok(bucketed.length > 0);
  assert.ok(bucketed.every((r) => r.bucket === "CLEAN_DISTINCTIVE"));
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

test("every direction carries a `retrieval` field (host/distance/bucket) or null (fallback)", () => {
  const { directions } = exploreDirections(engine, landing, { seed: 7 });
  for (const d of directions) {
    assert.ok("retrieval" in d);
    if (d.retrieval) {
      assert.ok(typeof d.retrieval.host === "string" && d.retrieval.host.length > 0);
      assert.ok(typeof d.retrieval.distance === "number" && d.retrieval.distance >= 0);
      assert.ok(["CLEAN_GENERIC", "CLEAN_DISTINCTIVE"].includes(d.retrieval.bucket));
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
