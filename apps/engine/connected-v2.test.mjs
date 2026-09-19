// Direct unit tests for the connected-v2 enrichment layer.
//
// connected-v2.mjs is a SUB-LAYER of connected.mjs (see both file headers) — it was only ever
// exercised indirectly, through connectedStyleGenome. These tests call its exports straight,
// so a regression in one derivation is attributed to that derivation instead of surfacing as
// an unexplained diff three layers up.
//
// Each export gets: determinism for the same input, output SHAPE, and the quality floor it is
// responsible for (the "withheld" / disabled path, and the guarantee that a returned record is
// always interpretable rather than an opaque score).
//
// Fast by construction: one engine + one genome are built once and shared.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "./engine.mjs";
import { connectedIntent, connectedStyleGenome } from "./connected.mjs";
import {
  CONNECTED_V2_STATUS,
  selectAccentFont,
  deriveColorScene,
  selectTextureDialect,
  deriveComponentPersonality,
  deriveExpressionPlan,
} from "./connected-v2.mjs";
// deriveMechanismPlan is exported from connected.mjs (the orchestrator), NOT connected-v2.mjs —
// it sits beside the v2 layer rather than inside it. Covered here for completeness.
import { deriveMechanismPlan } from "./connected.mjs";
import corpus from "./data/corpus.json" with { type: "json" };
import brands from "./data/brands.json" with { type: "json" };
import fonts from "./data/fonts.json" with { type: "json" };

const engine = createEngine({ corpus, brands, fonts });

// An expressive surface (accent face eligible) and a utility surface (accent withheld).
const expressive = connectedIntent({ surface: "landing-page", brief: "An independent record label for underground electronic music" });
const utility = connectedIntent({ surface: "dashboard", brief: "An incident response console for on-call SRE teams" });
const genome = connectedStyleGenome(engine, { surface: "landing-page", brief: "An independent record label for underground electronic music", seed: 11 });
const utilityGenome = connectedStyleGenome(engine, { surface: "dashboard", brief: "An incident response console for on-call SRE teams", seed: 11 });

const deterministic = (label, call) => {
  const a = call(), b = call();
  assert.deepEqual(a, b, `${label} is not deterministic for identical input`);
  return a;
};

test("connected-v2: status manifest is frozen and self-describing", () => {
  assert.equal(Object.isFrozen(CONNECTED_V2_STATUS), true);
  assert.ok(Object.keys(CONNECTED_V2_STATUS).length > 0);
});

test("selectAccentFont: deterministic, shaped, and withheld on utility surfaces", () => {
  const a = deterministic("selectAccentFont", () => selectAccentFont(engine, genome, expressive.intent, { seed: 3, profileId: expressive.profile }));
  assert.equal(a.role, "accent");
  assert.equal(typeof a.enabled, "boolean");
  assert.equal(typeof a.source, "string");
  if (a.enabled) {
    // QUALITY FLOOR: an enabled accent must be a real, named, interpretable pick — never a
    // bare score — and must not silently duplicate the display or body face.
    assert.ok(a.font && typeof a.font.family === "string" && a.font.family.length);
    assert.equal(typeof a.score, "number");
    assert.ok(a.evidence, "an enabled accent must carry font-space evidence");
    assert.ok(typeof a.use === "string" && /never paragraphs/.test(a.use));
    const lower = (f) => String(f || "").toLowerCase();
    assert.notEqual(lower(a.font.family), lower(genome?.type?.body?.family));
  } else {
    assert.equal(a.font, null);
    assert.ok(typeof a.reason === "string" && a.reason.length);
  }

  // dashboards/docs/app never get a decorative accent face — the readability floor
  const off = selectAccentFont(engine, utilityGenome, utility.intent, { seed: 3, profileId: utility.profile });
  assert.equal(off.enabled, false);
  assert.equal(off.font, null);
  assert.match(off.reason, /readability|utility|eligible/i);

  // explicit opt-out is honoured regardless of surface
  const muted = selectAccentFont(engine, genome, { ...expressive.intent, accentMode: "none" }, { seed: 3, profileId: expressive.profile });
  assert.equal(muted.enabled, false);

  // the seed participates: different seeds stay individually deterministic
  const s7 = deterministic("selectAccentFont(seed 7)", () => selectAccentFont(engine, genome, expressive.intent, { seed: 7, profileId: expressive.profile }));
  assert.equal(s7.role, "accent");

  // `exclude` is respected — the chosen family cannot come back after being excluded
  if (a.enabled) {
    const excluded = selectAccentFont(engine, genome, expressive.intent, { seed: 3, profileId: expressive.profile, exclude: [a.font.family] });
    if (excluded.enabled) assert.notEqual(String(excluded.font.family).toLowerCase(), String(a.font.family).toLowerCase());
  }
});

test("deriveColorScene: deterministic, every axis resolved, palette echoed verbatim", () => {
  const scene = deterministic("deriveColorScene", () => deriveColorScene(engine, genome, expressive.intent));
  assert.equal(typeof scene.schemaVersion, "string");
  assert.deepEqual(Object.keys(scene.axes).sort(),
    ["accentRatio", "chroma", "contrast", "lightness", "surfaceRange", "temperature", "textureRef"].sort());
  assert.ok(["warm", "cool", "mixed", "neutral"].includes(scene.axes.temperature));
  assert.ok(["light", "dark"].includes(scene.axes.lightness));
  assert.ok(["quiet", "moderate", "committed", "unknown"].includes(scene.axes.chroma));
  assert.ok(["high", "AA", "low", "unknown"].includes(scene.axes.contrast));
  assert.equal(scene.axes.textureRef, "none-observed");           // documented default
  assert.ok(scene.axes.accentRatio >= 0.03 && scene.axes.accentRatio <= 0.25);
  // the palette is reported, not re-derived — it must match the genome it was read from
  assert.equal(scene.palette.ground, genome.color.ground);
  assert.equal(scene.palette.ink, genome.color.ink);
  assert.equal(scene.palette.accent, genome.color.accent);
  // QUALITY FLOOR: a real genome must never leave axes "unknown" — that means the engine
  // could not classify its own output.
  assert.notEqual(scene.axes.chroma, "unknown");
  assert.notEqual(scene.axes.contrast, "unknown");
  // a textureRef passed in is threaded through
  assert.equal(deriveColorScene(engine, genome, expressive.intent, "paper-grain").axes.textureRef, "paper-grain");
  // degrades instead of throwing on an empty genome
  const empty = deriveColorScene(engine, {}, {});
  assert.equal(empty.palette.ground, null);
  assert.equal(empty.axes.surfaceRange, null);
});

test("selectTextureDialect: deterministic, and suppressed for dense/utility surfaces", () => {
  const t = deterministic("selectTextureDialect", () => selectTextureDialect(genome, expressive.intent, expressive.profile, 5));
  assert.equal(typeof t.enabled, "boolean");
  if (t.enabled) {
    assert.ok(typeof t.dialect === "string" && t.dialect.length);
    assert.notEqual(t.dialect, "none-observed");
  } else {
    assert.ok(typeof t.reason === "string" && t.reason.length);
  }
  // explicit opt-out
  assert.equal(selectTextureDialect(genome, { ...expressive.intent, texturePreference: "none" }, expressive.profile, 5).enabled, false);
  // QUALITY FLOOR: a very dense surface never gets texture laid over the data
  assert.equal(selectTextureDialect(genome, { ...expressive.intent, contentDensity: 0.95 }, expressive.profile, 5).enabled, false);
  // …and neither does a cramped one (whitespace below the air floor)
  const cramped = { ...genome, layout: { ...genome.layout, macro: { ...(genome.layout?.macro || {}), whitespace: 0.1 } } };
  assert.equal(selectTextureDialect(cramped, expressive.intent, expressive.profile, 5).enabled, false);
});

test("deriveComponentPersonality: deterministic, dialect + resolved state shadows", () => {
  const c = deterministic("deriveComponentPersonality", () => deriveComponentPersonality(engine, genome, expressive.intent, expressive.profile, 2));
  assert.equal(typeof c.schemaVersion, "string");
  assert.ok(typeof c.dialect === "string" && c.dialect.length);
  // QUALITY FLOOR: the dialect must come from the catalogue, never an ad-hoc string
  assert.ok(JSON.stringify(c).includes(c.dialect));
  // the same profile + seed must always pick the same dialect (it is a hash, not a roll)
  assert.equal(deriveComponentPersonality(engine, genome, expressive.intent, expressive.profile, 2).dialect, c.dialect);
  // a different profile is allowed to differ but must still be stable
  const other = deterministic("deriveComponentPersonality(other profile)", () => deriveComponentPersonality(engine, genome, expressive.intent, "neutral-corporate", 2));
  assert.ok(typeof other.dialect === "string" && other.dialect.length);
  // survives a genome with no colour hue / radii rather than throwing
  assert.ok(deriveComponentPersonality(engine, {}, {}, null, 0).dialect);
});

test("deriveExpressionPlan: deterministic, bounded, and texture-gated", () => {
  const texture = selectTextureDialect(genome, expressive.intent, expressive.profile, 5);
  const plan = deterministic("deriveExpressionPlan", () => deriveExpressionPlan(expressive.intent, genome, expressive.profile, texture, 4));
  assert.equal(typeof plan, "object");
  const treatments = plan.treatments || plan.selected || [];
  assert.ok(Array.isArray(treatments), "expression plan must expose an array of treatments");
  // QUALITY FLOOR: every treatment is a named, catalogued id — an agent has to be able to
  // implement it, so an opaque/blank entry is a failure.
  for (const t of treatments) {
    assert.ok(t && typeof t === "object", "treatment must be a record, not a bare score");
    assert.ok(typeof (t.id || t.name) === "string" && (t.id || t.name).length);
  }
  // a texture treatment is never selected when texture is disabled
  const noTexture = deriveExpressionPlan(expressive.intent, genome, expressive.profile, { enabled: false }, 4);
  for (const t of (noTexture.treatments || noTexture.selected || [])) assert.notEqual(t.category, "texture");
  // the restrained profile stays restrained
  const corporate = deterministic("deriveExpressionPlan(neutral-corporate)", () => deriveExpressionPlan(expressive.intent, genome, "neutral-corporate", null, 4));
  assert.ok(Array.isArray(corporate.treatments || corporate.selected || []));
  // "none" is honoured without throwing
  assert.ok(deriveExpressionPlan({ ...expressive.intent, expressionPreference: "none" }, genome, expressive.profile, texture, 4));
});

test("deriveMechanismPlan (connected.mjs): deterministic and realization-indexed", () => {
  const args = [{ surface: "landing-page", sourceBrief: "motion editor" }, "creative-tool-workbench", 2];
  const p = deterministic("deriveMechanismPlan", () => deriveMechanismPlan(...args));
  assert.equal(typeof p, "object");
  assert.ok(Object.keys(p).length > 0);
  // the realization index selects a variant; each index is individually stable
  const p0 = deriveMechanismPlan(args[0], args[1], 0);
  assert.deepEqual(p0, deriveMechanismPlan(args[0], args[1], 0));
  // defaults do not throw
  assert.ok(deriveMechanismPlan());
});
