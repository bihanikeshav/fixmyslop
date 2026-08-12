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

// ── dead-space fix (design directive): every section carries a content purpose, the centrepiece
// section is explicitly named, and a hard no-empty-section instruction is stated. ────────────────
test("genomeToSpec names an explicit centrepiece section and states a no-empty-section rule", () => {
  const genome = styleGenome(engine, intent, { seed: 42 });
  const spec = genomeToSpec(genome);
  const grammar = genome.layout.sectionGrammar;
  // the centrepiece role (largest non-chrome section) must be named verbatim in the Layout section
  const chromeRoles = new Set(["nav", "footer", "topbar", "appbar", "statusbar", "masthead", "page-header", "header", "filter-bar", "table-head", "pagination", "plan-toggle", "reading-header"]);
  const nonChrome = grammar.filter((s) => !chromeRoles.has(s.role));
  const expectedCentrepiece = nonChrome.reduce((best, s) => (!best || s.heightShare > best.heightShare ? s : best), null);
  assert.ok(expectedCentrepiece, "fixture layout has no non-chrome section to be a centrepiece");
  assert.match(spec, /THE CENTREPIECE lives here/, "no per-row centrepiece annotation found");
  assert.ok(spec.includes(`**${expectedCentrepiece.role}**`), `centrepiece role "${expectedCentrepiece.role}" not named in the no-empty-section rule`);
  assert.match(spec, /No empty sections, no exceptions\./, "missing the hard no-empty-section instruction");
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

test("genomeToSpec labels ground/surface as NEUTRAL and instructs against tinting the page with the accent hue", () => {
  const genome = styleGenome(engine, intent, { seed: 42 });
  const spec = genomeToSpec(genome);
  assert.match(spec, /\*\*NEUTRAL\*\*/, "ground/surface not explicitly labeled NEUTRAL");
  assert.match(spec, /Do NOT tint the page with the accent hue/, "missing the explicit no-tint instruction");
  assert.match(spec, /accent appears ONLY on CTAs, key data, and small emphasis/, "missing the 60-30-10 scarce-accent framing");
});

// ── dead-space fix round 2: heightShare reframed as relative emphasis, not a height target ────────
test("genomeToSpec reframes heightShare as relative emphasis, not a pixel/vh height target, and states the no-pad rule", () => {
  const genome = styleGenome(engine, intent, { seed: 42 });
  const spec = genomeToSpec(genome);
  assert.match(spec, /RELATIVE EMPHASIS/, "heightShare not reframed as relative emphasis");
  assert.match(spec, /NOT a pixel or vh height target/, "missing explicit 'not a height' framing");
  assert.match(spec, /Do NOT set a fixed or min-height from it/, "missing the no-fixed-height instruction");
  assert.match(spec, /do NOT pad a section with empty space to reach a size/, "missing the no-pad instruction");
  assert.match(spec, /~150px of contiguous empty vertical space/, "missing the concrete empty-space ceiling");
  assert.doesNotMatch(spec, /use it to size the section/, "old fixed-height wording for heightShare still present");
});
