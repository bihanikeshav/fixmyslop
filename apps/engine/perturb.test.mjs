// apps/engine/perturb.test.mjs — determinism, gate-compliance, purity, and no-seed-passthrough
// tests for perturb.mjs + the composeGenome/suggestLayout §2 wiring (docs/layout-explorer-spec.md).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolveIntent, hashToUint32 } from "./intent.mjs";
import { suggestLayout, LAYOUT_FAMILIES } from "./layout-families.mjs";
import { perturbGenome, validatePerturbed, perturbAndValidate } from "./perturb.mjs";

const FAMILY_BY_NAME = new Map(LAYOUT_FAMILIES.map((f) => [f.name, f]));
const TOOL_KINDS = new Set(["dashboard", "data-admin", "app"]);

function baseGenomeFor(familyName, intentInput) {
  const { intent } = resolveIntent(intentInput);
  const cands = suggestLayout(intent); // no seed → unperturbed base genomes
  const c = cands.find((x) => x.family === familyName);
  assert.ok(c, `expected ${familyName} to survive gating for ${JSON.stringify(intentInput)}`);
  return c;
}
function ivFor(intentInput) {
  const { intent } = resolveIntent(intentInput);
  return {
    layoutVariance: intent.layoutVariance, contentDensity: intent.contentDensity,
    materiality: intent.materiality, energy: intent.energy,
    contrastPreference: intent.contrastPreference, craft: intent.craft,
  };
}

// ── PURITY — grep the source for Math.random/Date.now/new Date, must be none (code, not comments) ─
test("purity: perturb.mjs and fingerprint.mjs carry no Math.random/Date.now/new Date in executable code", () => {
  for (const file of ["perturb.mjs", "fingerprint.mjs", "role-aliases.mjs"]) {
    const path = fileURLToPath(new URL(file, import.meta.url));
    const src = readFileSync(path, "utf8");
    const codeOnly = src
      .split("\n")
      .map((line) => line.replace(/\/\/.*$/, "")) // strip line comments before checking
      .join("\n");
    assert.ok(!/Math\.random/.test(codeOnly), `${file} calls Math.random`);
    assert.ok(!/Date\.now/.test(codeOnly), `${file} calls Date.now`);
    assert.ok(!/new Date/.test(codeOnly), `${file} calls new Date`);
  }
});

// ── DETERMINISM — same (genome,family,streamSeed,iv,amp) → byte-identical output across runs ────
test("determinism: perturbGenome is byte-identical across repeated calls with the same inputs", () => {
  const family = FAMILY_BY_NAME.get("asymmetric-proof-stack");
  const base = baseGenomeFor("asymmetric-proof-stack", { surface: "landing-page", job: "explain-and-convert" });
  const iv = ivFor({ surface: "landing-page", job: "explain-and-convert" });
  const streamSeed = hashToUint32("42:asymmetric-proof-stack:0:0");
  const runs = Array.from({ length: 5 }, () => perturbGenome(base, family, streamSeed, iv, 0.8));
  const json = runs.map((r) => JSON.stringify(r));
  for (let i = 1; i < json.length; i++) assert.equal(json[i], json[0], `run ${i} diverged from run 0`);
});

test("determinism: suggestLayout({seed}) is byte-identical across repeated calls", () => {
  const { intent } = resolveIntent({ surface: "landing-page", job: "explain-and-convert" });
  const a = suggestLayout(intent, { seed: 777 });
  const b = suggestLayout(intent, { seed: 777 });
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test("determinism: different seeds produce different perturbations (stream actually varies)", () => {
  const { intent } = resolveIntent({ surface: "landing-page", job: "explain-and-convert" });
  const a = suggestLayout(intent, { seed: 1 });
  const b = suggestLayout(intent, { seed: 2 });
  assert.notEqual(JSON.stringify(a), JSON.stringify(b));
});

// ── NO-SEED PASSTHROUGH — the historical call shape must stay byte-for-byte identical ────────────
test("no-seed composeGenome path is byte-identical to the pre-perturbation shape (amplitude 0)", () => {
  const { intent } = resolveIntent({ surface: "landing-page", job: "explain-and-convert" });
  const a = suggestLayout(intent);
  const b = suggestLayout(intent, { seed: null });
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  // and it must equal an unperturbed base genome recomposed by hand (no perturbation artifacts,
  // e.g. no "perturbed" provenance tag, no macro.grid injected)
  for (const c of a) {
    assert.ok(!c.quality.provenance.includes("perturbed"), `${c.family} carries a perturbed marker with no seed`);
  }
});

// ── GATE COMPLIANCE — 1,000 seeds × several families → zero violations, never throws ─────────────
test("gate compliance: 1000 seeds x 6 families never violate a §2 gate and never throw", () => {
  const families = [
    "asymmetric-proof-stack", "contrast-band-flow", "stacked-narrative-scroll",
    "instrument-console", "ledger-table", "pricing-comparison",
  ];
  const intentByFamily = {
    "asymmetric-proof-stack": { surface: "landing-page", job: "explain-and-convert" },
    "contrast-band-flow": { surface: "marketing" },
    "stacked-narrative-scroll": { surface: "landing-page", job: "single-product-launch" },
    "instrument-console": { surface: "dashboard", job: "monitor" },
    "ledger-table": { surface: "dashboard" },
    "pricing-comparison": { surface: "pricing" },
  };
  let checked = 0;
  for (const name of families) {
    const family = FAMILY_BY_NAME.get(name);
    const intentInput = intentByFamily[name];
    const base = baseGenomeFor(name, intentInput);
    const iv = ivFor(intentInput);
    for (let seed = 0; seed < 1000; seed++) {
      let candidate;
      assert.doesNotThrow(() => {
        candidate = perturbGenome(base, family, seed >>> 0, iv, 1);
      }, `perturbGenome threw for ${name} seed ${seed}`);
      const { ok } = validatePerturbed(candidate, family, base);
      // perturbGenome's own internal gates (nav/footer caps, split-side, etc.) should mean the
      // *raw* output already validates; if it doesn't, perturbAndValidate's reroll must recover.
      if (!ok) {
        const streamSeedFor = (reroll) => hashToUint32(`${seed}:${name}:0:${reroll}`);
        const recovered = perturbAndValidate(base, family, streamSeedFor, iv, 1);
        const { ok: recoveredOk } = validatePerturbed(recovered, family, base);
        assert.ok(recoveredOk, `${name} seed ${seed}: reroll never recovered a valid genome`);
      }
      const sumShares = candidate.sectionGrammar.reduce((a, s) => a + s.heightShare, 0);
      assert.ok(Math.abs(sumShares - 1) <= 0.02, `${name} seed ${seed}: Σheightshares=${sumShares}`);
      for (const s of candidate.sectionGrammar) {
        assert.ok(s.heightShare >= 0.03, `${name} seed ${seed}: ${s.role} heightShare ${s.heightShare} < floor`);
      }
      assert.ok(candidate.macro.splitRatio >= 0.33 && candidate.macro.splitRatio <= 0.79, `${name} seed ${seed}: splitRatio ${candidate.macro.splitRatio}`);
      assert.ok(candidate.macro.whitespace >= 0.19 && candidate.macro.whitespace <= 0.86, `${name} seed ${seed}: whitespace ${candidate.macro.whitespace}`);
      const widthFloor = TOOL_KINDS.has(family.pageKind) ? 0.89 : 0.59;
      assert.ok(candidate.macro.contentWidthShare >= widthFloor && candidate.macro.contentWidthShare <= 1.01, `${name} seed ${seed}: contentWidthShare ${candidate.macro.contentWidthShare}`);
      assert.notEqual(candidate.macro.columnCount, 1 === family.macro.columnCount ? undefined : 1);
      checked++;
    }
  }
  assert.equal(checked, 6000);
});

// ── bounded reroll never throws even under an adversarially tiny family ──────────────────────────
test("perturbAndValidate never throws and always returns a valid-shaped genome, worst case falling back to base", () => {
  const family = FAMILY_BY_NAME.get("full-bleed-diagram"); // no footer, tight section count
  const base = baseGenomeFor("full-bleed-diagram", { surface: "landing-page", job: "explain-a-system" });
  const iv = ivFor({ surface: "landing-page", job: "explain-a-system" });
  for (let seed = 0; seed < 200; seed++) {
    const streamSeedFor = (reroll) => hashToUint32(`${seed}:full-bleed-diagram:0:${reroll}`);
    let out;
    assert.doesNotThrow(() => { out = perturbAndValidate(base, family, streamSeedFor, iv, 1); });
    assert.ok(Array.isArray(out.sectionGrammar) && out.sectionGrammar.length > 0);
  }
});

// ── never-perturbed invariants ─────────────────────────────────────────────────────────────────
test("pageKind and mobileTransform are never perturbed", () => {
  const family = FAMILY_BY_NAME.get("asymmetric-proof-stack");
  const base = baseGenomeFor("asymmetric-proof-stack", { surface: "landing-page", job: "explain-and-convert" });
  const iv = ivFor({ surface: "landing-page", job: "explain-and-convert" });
  for (let seed = 0; seed < 50; seed++) {
    const c = perturbGenome(base, family, seed, iv, 1);
    assert.equal(c.pageKind, base.pageKind);
    assert.equal(c.responsive.mobileTransform, base.responsive.mobileTransform);
  }
});
