import { test } from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "./engine.mjs";
import { connectedIntent, connectedStyleGenome, connectedExploreDirections, connectedBuildSpec, CONNECTED_V2_STATUS } from "./connected.mjs";
import corpus from "./data/corpus.json" with { type: "json" };
import brands from "./data/brands.json" with { type: "json" };
import fonts from "./data/fonts.json" with { type: "json" };

const engine = createEngine({ corpus, brands, fonts });

test("connected intent canonicalizes surface aliases and grounds subject signals", () => {
  const { intent, profile } = connectedIntent({
    surface: "landing",
    brief: "A developer observability platform for incident response",
  });
  assert.equal(intent.surface, "landing-page");
  assert.equal(intent.sourceBrief, "A developer observability platform for incident response");
  assert.equal(profile, "technical-observability");
  assert.equal(intent.hue, 164);
  assert.equal(intent.formality, 0.72);
});

test("connected genomes are deterministic and preserve a readable dual-font pair", () => {
  const input = {
    surface: "marketing",
    job: "explain-and-convert",
    sourceBrief: "An independent coffee roastery with tactile origin stories",
  };
  const a = connectedStyleGenome(engine, input, { seed: 1701 });
  const b = connectedStyleGenome(engine, input, { seed: 1701 });
  assert.deepEqual(a, b);
  assert.equal(a.connected.profile, "earth-craft");
  assert.notEqual(a.type.display.family, a.type.body.family);
  assert.equal(a.type.body.category === "serif" || a.type.body.category === "sans-serif", true);
  assert.equal(engine.checkTypeFit({ display: a.type.display.family, body: a.type.body.family }, input).pass, true);
  assert.equal(a.type.pairing.strategy, "subject-register-contrast-v1");
});

test("connected one-shot typography applies the empirical quality floor", () => {
  const genome = connectedStyleGenome(engine, {
    surface: "marketing",
    sourceBrief: "A tactile independent coffee roastery with origin stories",
  }, { seed: 1701 });
  const pair = genome.type.pairing.v2;
  assert.ok(pair.display.asset.available && pair.body.asset.available);
  assert.ok(pair.display.quality >= 0.74, `${pair.display.family} fell below the display quality floor`);
  assert.ok(pair.body.quality >= 0.72, `${pair.body.family} fell below the body quality floor`);
  assert.notEqual(pair.display.family, "Kihim");
  assert.notEqual(pair.body.family, "Rag");
});

test("connected register filter prevents decorative faces on civic and technical subjects", () => {
  for (const sourceBrief of [
    "A climate field journal for public conservation work",
    "A developer API observability console for SRE teams",
  ]) {
    const genome = connectedStyleGenome(engine, { surface: "landing", sourceBrief }, { seed: 7 });
    const genre = engine.classifyFontGenre(genome.type.display);
    assert.ok(!["blackletter", "script", "decorative"].includes(genre), `${sourceBrief} picked ${genre}`);
  }
});

test("connected theme and concept handoff stay coherent for a dark subject", () => {
  const input = {
    surface: "landing-page",
    theme: "dark",
    sourceBrief: "An experimental electronic record launch with a playable sound archive",
  };
  const genome = connectedStyleGenome(engine, input, { seed: 808 });
  const groundL = engine.classify(genome.color.ground).oklch.L;
  const inkL = engine.classify(genome.color.ink).oklch.L;
  assert.equal(genome.color.mood, "dark");
  assert.ok(groundL < 0.35 && inkL > groundL, `dark palette lightness mismatch: ground ${groundL}, ink ${inkL}`);
  const built = connectedBuildSpec(engine, input, { seed: 808 });
  assert.match(built.spec, /Subject concept card/);
  assert.match(built.spec, /playable sound object|track-driven visual instrument/);
});

test("unprofiled pricing uses a restrained register and direction font exclusions", () => {
  const input = {
    surface: "pricing",
    job: "explain-and-convert",
    contentModel: "comparison",
    sourceBrief: "Straightforward pricing for an ethical cooperative software product",
  };
  const one = connectedStyleGenome(engine, input, { seed: 606 });
  assert.equal(one.type.pairing.register, "neutral-corporate");
  assert.ok(!["blackletter", "script", "decorative", "display-other"].includes(one.type.pairing.displayGenre));
  const explored = connectedExploreDirections(engine, input, { seed: 606, count: 4 });
  const displays = explored.directions.map((d) => d.genome.type.display.family);
  assert.equal(new Set(displays).size, displays.length);
});

test("concept card branches by surface for docs and project workspaces", () => {
  const docs = connectedBuildSpec(engine, {
    surface: "docs",
    contentModel: "reference",
    sourceBrief: "Documentation for a small developer tool",
  }, { seed: 44 });
  const workspace = connectedBuildSpec(engine, {
    surface: "app",
    contentModel: "workflow",
    sourceBrief: "A project workspace for handoffs and decisions",
  }, { seed: 45 });
  assert.match(docs.spec, /navigable reference spine/);
  assert.match(docs.spec, /runnable example/);
  assert.match(workspace.spec, /living handoff surface/);
  assert.match(workspace.spec, /owners, deadlines, dependencies/);
});

test("connected explorer keeps the engine's bounded thin-pool behavior but decorates every direction", () => {
  const input = {
    surface: "pricing",
    job: "compare-plans",
    sourceBrief: "An ethical pricing page for a small cooperative",
  };
  const result = connectedExploreDirections(engine, input, { seed: 6006, count: 4 });
  const resolved = connectedIntent(input).intent;
  assert.ok(result.directions.length >= 2 && result.directions.length <= 4);
  assert.equal(result.connected.source, "connected-intent-v1");
  for (const direction of result.directions) {
    assert.ok(direction.genome.connected);
    assert.ok(direction.genome.type.display.family);
    assert.ok(direction.genome.type.body.family);
    assert.equal(engine.checkTypeFit({ display: direction.genome.type.display.family, body: direction.genome.type.body.family }, resolved).pass, true);
  }
});

test("connected v2 returns accent role, material/component personality, and bounded expressions", () => {
  const genome = connectedStyleGenome(engine, {
    surface: "portfolio",
    sourceBrief: "An editorial archive for contemporary art",
    accentMode: "always",
    texturePreference: "paper-grain",
    expressionPreference: "asymmetric-split-pinning",
  }, { seed: 991 });
  assert.equal(genome.connected.v2.schemaVersion, "connected-style-v2");
  assert.ok(genome.type.accent?.family);
  assert.equal(genome.type.roles.body, "running text");
  assert.ok(genome.type.pairing.v2.display.available);
  assert.ok(genome.material.component.dialect);
  assert.equal(genome.material.texture.dialect, "paper-grain");
  assert.equal(genome.expression.centrepiece, "asymmetric-split-pinning");
  assert.match(genome.material.component.button.interaction, /press|lift|underline|state|color/i);
  assert.ok(genome.expression.responsive["asymmetric-split-pinning"]);
  assert.ok(genome.expression.reducedMotion["asymmetric-split-pinning"]);
  const spec = connectedBuildSpec(engine, { surface: "portfolio", sourceBrief: "An art archive" }, { seed: 992 });
  assert.match(spec.spec, /Connected v2 expression handoff/);
  assert.match(spec.spec, /Accent:/);
});

test("connected v2 exposes its empirical catalog and respects an explicit accent opt-out", () => {
  const genome = connectedStyleGenome(engine, {
    surface: "marketing",
    sourceBrief: "A tactile coffee roastery",
    accentMode: "none",
  }, { seed: 992 });
  assert.equal(genome.type.accent, null);
  assert.ok(CONNECTED_V2_STATUS.fontEntries > 2000);
  assert.equal(CONNECTED_V2_STATUS.candidatePairRecords, 41);
  assert.ok(CONNECTED_V2_STATUS.componentDialects.includes("playful"));
  assert.ok(CONNECTED_V2_STATUS.expressionTreatments.includes("cursor-magnetic-action"));
});
