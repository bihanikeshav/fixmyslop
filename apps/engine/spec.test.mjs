import { test } from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "./engine.mjs";
import { styleGenome } from "./genome.mjs";
import { genomeToSpec } from "./spec.mjs";
import corpus from "./data/corpus.json" with { type: "json" };
import brands from "./data/brands.json" with { type: "json" };
import fonts from "./data/fonts.json" with { type: "json" };

const engine = createEngine({ corpus, brands, fonts });
const intent = { surface: "landing-page", job: "explain-and-convert", sourceBrief: "a tool for indie game devs" };

test("genomeToSpec is deterministic — same genome → identical spec string", () => {
  const genome = styleGenome(engine, intent, { seed: 42 });
  const a = genomeToSpec(genome);
  const b = genomeToSpec(genome);
  assert.equal(a, b);
});

test("genomeToSpec includes every required build-spec section", () => {
  const genome = styleGenome(engine, intent, { seed: 42 });
  const spec = genomeToSpec(genome);
  for (const heading of ["## Layout", "## Type", "## Color", "## Background", "## Motion", "## Spacing & Material"]) {
    assert.ok(spec.includes(heading), `missing section: ${heading}`);
  }
  // concrete, non-vague values present — real font families, hex colors, px sizes
  assert.ok(genome.type.display && spec.includes(genome.type.display.family), "display font family named");
  assert.ok(spec.includes(genome.color.accent), "accent hex present verbatim");
  assert.match(spec, /\d+px/, "at least one literal px value");
  assert.match(spec, /prefers-reduced-motion/, "reduced-motion guarantee stated");
});

test("genomeToSpec is a pure function of its genome argument (no genome mutation)", () => {
  const genome = styleGenome(engine, intent, { seed: 7 });
  const before = JSON.stringify(genome);
  genomeToSpec(genome);
  assert.equal(JSON.stringify(genome), before);
});
