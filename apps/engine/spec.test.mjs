import { test } from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "./engine.mjs";
import { styleGenome } from "./genome.mjs";
import { genomeToSpec } from "./spec.mjs";
import { connectedStyleGenome } from "./connected.mjs";
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

test("genomeToSpec names the focal function without treating expression as the product mechanism", () => {
  const genome = styleGenome(engine, intent, { seed: 42 });
  const spec = genomeToSpec(genome);
  const grammar = genome.layout.sectionGrammar;
  const chromeRoles = new Set(["nav", "footer", "topbar", "appbar", "statusbar", "masthead", "page-header", "header", "filter-bar", "table-head", "pagination", "plan-toggle", "reading-header"]);
  const nonChrome = grammar.filter((s) => !chromeRoles.has(s.role));
  const expectedPrimary = nonChrome.reduce((best, s) => (!best || s.heightShare > best.heightShare ? s : best), null);
  assert.ok(expectedPrimary, "fixture layout has no non-chrome focal function");
  assert.match(spec, /FOCAL COMPOSITION/, "no per-row focal annotation found");
  assert.ok(spec.includes(`**${expectedPrimary.role}**`), `focal role "${expectedPrimary.role}" is not named`);
  assert.match(spec, /No empty functions\./, "missing the no-empty-function instruction");
  assert.match(spec, /expression, not the product mechanism/, "expression/mechanism boundary is absent");
  assert.doesNotMatch(spec, /THE CENTREPIECE lives here/, "legacy expression-first wording remains");
});

test("genomeToSpec's Layout section table includes a content-purpose column for every row", () => {
  const genome = styleGenome(engine, intent, { seed: 42 });
  const spec = genomeToSpec(genome);
  assert.match(spec, /\| # \| section role \| relative emphasis \| focal point \| composition \| surface \| content purpose \|/, "Layout table missing content-purpose column header");
  // every section role's purpose text must appear somewhere in the spec (loosely — the row itself)
  for (const s of genome.layout.sectionGrammar) {
    // role appears at least once per row context — cheap smoke check that rows were emitted
    assert.ok(spec.includes(`| ${s.role} |`), `no table row found for section role "${s.role}"`);
  }
});

test("genomeToSpec derives palette-role count and treats the secondary as a harmonious subordinate", () => {
  const genome = styleGenome(engine, intent, { seed: 42 });
  const spec = genomeToSpec(genome);
  assert.match(spec, /supplies 5 palette roles/, "full palette role count is not derived");
  assert.match(spec, /secondary accent is a deliberate counterpoint to the primary/, "secondary harmony guidance absent");
  assert.match(spec, /keep the secondary visibly subordinate/, "secondary hierarchy guidance absent");
  assert.match(spec, /4\.5:1 \(WCAG AA\)/, "body contrast gate absent");

  const compact = structuredClone(genome);
  delete compact.color.surface;
  delete compact.color.accent2;
  delete compact.color.secondary;
  const compactSpec = genomeToSpec(compact);
  assert.match(compactSpec, /supplies 3 palette roles/, "palette count is hard-coded instead of data-driven");
  assert.doesNotMatch(compactSpec, /accent \(secondary\)/, "missing secondary role still emitted");
  assert.match(compactSpec, /No secondary accent is supplied/, "missing-secondary behavior is not explicit");
});

// ── dead-space fix round 2: heightShare reframed as relative emphasis, not a height target ────────
test("genomeToSpec reframes heightShare as relative emphasis, not a pixel/vh height target, and states the no-pad rule", () => {
  const genome = styleGenome(engine, intent, { seed: 42 });
  const spec = genomeToSpec(genome);
  assert.match(spec, /RELATIVE EMPHASIS/, "heightShare not reframed as relative emphasis");
  assert.match(spec, /NOT a pixel or vh height target/, "missing explicit 'not a height' framing");
  assert.match(spec, /Do NOT set a fixed or min-height from it/, "missing the no-fixed-height instruction");
  assert.match(spec, /do NOT pad a region with empty space to reach a size/i, "missing the no-pad instruction");
  assert.match(spec, /~150px of contiguous empty vertical space/, "missing the concrete empty-space ceiling");
  assert.doesNotMatch(spec, /use it to size the section/, "old fixed-height wording for heightShare still present");
  assert.match(spec, /reference sequence, not a wireframe to copy literally/, "grammar is still presented as exact structure");
  assert.match(spec, /merge supporting regions, reorder adjacent support/, "bounded structural adaptation is absent");
  assert.doesNotMatch(spec, /EXACTLY these sections|in this exact order/, "exact-order mandate remains");
});

test("hero type is strictly largest when a hero exists, and no hero is mandated otherwise", () => {
  const base = styleGenome(engine, intent, { seed: 42 });
  const withoutHero = genomeToSpec(base);
  assert.match(withoutHero, /This grammar has no hero\. Do not invent a hero headline/);

  const withHero = structuredClone(base);
  const heroIndex = withHero.layout.sectionGrammar.findIndex((section) => section.role !== "nav");
  withHero.layout.sectionGrammar[heroIndex].role = "hero";
  const heroSpec = genomeToSpec(withHero);
  const match = heroSpec.match(/Hero reference: (\d+)px .* above the (\d+)px scale ceiling/);
  assert.ok(match, "hero/largest-scale relationship is not serialized");
  assert.ok(Number(match[1]) > Number(match[2]), `hero ${match[1]}px is not larger than scale ceiling ${match[2]}px`);
  assert.doesNotMatch(heroSpec, /height must be .*viewport|roughly one screen/);
  assert.match(heroSpec, /Content height wins: never force `100vh`/);
});

test("font delivery uses connected assets and role gates instead of fake fallback stacks", () => {
  const genome = connectedStyleGenome(engine, {
    surface: "app",
    job: "create-and-edit",
    sourceBrief: "a kinetic typography sequencing tool",
  }, { seed: 42 });
  const spec = genomeToSpec(genome);
  assert.match(spec, /licensed local font\/assets explicitly named by the\s+connected handoff/);
  assert.match(spec, /document\.fonts\.ready/);
  assert.match(spec, /document\.fonts\.check\(\)/);
  assert.match(spec, /verified asset record/);
  assert.match(spec, /role suitability gate/);
  assert.doesNotMatch(spec, /may not be locally installed|plausible generic fallback|single, self-contained HTML/);
  assert.ok(genome.type.display.asset.recommendedWeights.includes(Number(spec.match(/Heading \/ display candidate: .* weight (\d+)/)?.[1])), "spec requests an unavailable display weight");
  assert.ok(genome.type.body.asset.recommendedWeights.includes(Number(spec.match(/Body \/ running-text font: .* weight (\d+)/)?.[1])), "spec requests an unavailable body weight");
});

test("dashboard spec stays task-dense, hero-free, and mechanism-first", () => {
  const genome = connectedStyleGenome(engine, {
    surface: "dashboard",
    job: "monitor",
    sourceBrief: "an operations dashboard for a solar microgrid",
  }, { seed: 42 });
  const spec = genomeToSpec(genome);
  assert.equal(genome.layout.pageKind, "dashboard");
  assert.match(spec, /PRIMARY WORK AREA/);
  assert.match(spec, /real product objects, actions, and visible outcomes/);
  assert.match(spec, /Do not add a hero above it/);
  assert.match(spec, /This layout has no hero or single-viewport region/);
  assert.match(spec, /expression treatment may support orientation or feedback, but it cannot count\s+as the product centrepiece/);
  assert.doesNotMatch(spec, /Hero reference:|Hero fits the first screen|height must be .*viewport/);
});

test("creative-tool spec makes the workspace mechanism primary without freezing composition", () => {
  const genome = styleGenome(engine, {
    surface: "app",
    job: "create-and-edit",
    sourceBrief: "a creative tool for sequencing kinetic typography",
  }, { seed: 42 });
  const spec = genomeToSpec(genome);
  assert.equal(genome.layout.pageKind, "app");
  assert.match(spec, /\*\*workspace\*\* is the primary work area/);
  assert.match(spec, /Put real objects, actions, and outcomes in the\s+primary work area/);
  assert.match(spec, /Treat this grammar as a reference sequence/);
  assert.match(spec, /bounded token\s+values when product truth/);
  assert.doesNotMatch(spec, /Build the page as EXACTLY|THE CENTREPIECE lives here|Do not introduce any font-size/);
});
