import { test } from "node:test";
import assert from "node:assert/strict";
import { TOOL_BY_NAME } from "./tools.mjs";

test("new tools exist and run", () => {
  for (const n of ["design_system", "type_scale", "shadow", "layout", "generate_palette", "check_shadow", "check_svg", "audit_system", "connected_style_genome", "connected_explore_directions", "connected_build_spec", "connected_v2_catalog", "dashboard_system", "fluid_components", "check_dashboard_layout"]) {
    assert.ok(TOOL_BY_NAME[n], `missing tool ${n}`);
  }
  assert.ok(TOOL_BY_NAME.type_scale.run({ base: 16, ratio: 1.25 }).length > 1);
  assert.equal(TOOL_BY_NAME.check_shadow.run({ css: "0 4px 6px rgba(0,0,0,0.5)" }).verdict, "SLOP");
  const svg = TOOL_BY_NAME.check_svg.run({ svg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16"/></svg>' });
  assert.equal(svg.pass, true);
  assert.ok(TOOL_BY_NAME.design_system.run({ seed: 2 }).palette.accent);
  const connected = TOOL_BY_NAME.connected_style_genome.run({ surface: "portfolio", sourceBrief: "An editorial art archive", seed: 2 });
  assert.ok(connected.type.accent?.family);
  assert.ok(connected.material.component.dialect);
  assert.ok(connected.expression.schemaVersion);
  assert.ok(TOOL_BY_NAME.connected_v2_catalog.run().fontEntries > 2000);
});

test("dashboard tools expose geometry math, Fluid source installs, and implementation audit", () => {
  const spec = TOOL_BY_NAME.dashboard_system.run({ viewportWidth: 1440, viewportHeight: 900, content: "analytics", density: "compact", personality: "expressive" });
  assert.equal(spec.math.columns, 12);
  assert.equal(spec.controls.visualHeightPx, 28);
  assert.ok(spec.geometry.placements.some((item) => item.id === "primary-chart"));
  assert.ok(spec.fluid.components.every((item) => item.source === "fluid-functionalism-registry"));
  assert.ok(spec.fluid.installAll.some((command) => command.includes("@fluid/button")));
  assert.equal(spec.personality.ambientMotion.reducedMotion, "none");

  const components = TOOL_BY_NAME.fluid_components.run({ preset: "table", primitive: "radix" });
  assert.ok(components.components.some((item) => item.slug === "table"));
  assert.equal(components.provider.license, "MIT");

  const audit = TOOL_BY_NAME.check_dashboard_layout.run({
    viewportWidth: 800,
    viewportHeight: 600,
    regions: [{ id: "main", x: 1, y: 0, width: 799, height: 600 }],
    components: [{ name: "button", source: "lookalike" }],
  });
  assert.equal(audit.verdict, "SLOP");
  assert.ok(audit.issues.some((issue) => issue.code === "NON_FLUID_COMPONENT"));
});

test("layout/color capability tools: check_composition, shade_ramp, semantic_colors", () => {
  // check_composition catches trapped whitespace, passes a well-tiled grammar
  const trapped = TOOL_BY_NAME.check_composition.run({ sectionGrammar: [{ role: "nav", heightShare: 0.06 }, { role: "hero", heightShare: 0.3 }] });
  assert.equal(trapped.verdict, "SLOP");
  const ok = TOOL_BY_NAME.check_composition.run({ sectionGrammar: [
    { role: "nav", heightShare: 0.08 }, { role: "hero", heightShare: 0.42 }, { role: "body", heightShare: 0.35 }, { role: "footer", heightShare: 0.15 },
  ], pageKind: "marketing" });
  assert.equal(ok.verdict, "CLEAN");
  // shade_ramp: right length, all hex, light→dark
  const ramp = TOOL_BY_NAME.shade_ramp.run({ hue: 150, steps: 9 });
  assert.equal(ramp.length, 9);
  assert.ok(ramp[0].L > ramp[ramp.length - 1].L);
  // semantic_colors: four gate-clean roles
  const sem = TOOL_BY_NAME.semantic_colors.run({ accentHue: 150 });
  for (const k of ["error", "success", "warning", "info"]) assert.match(sem[k], /^#[0-9a-f]{6}$/i);
  // check_palette: surface param wired through + dark+neon combination gate
  const neon = TOOL_BY_NAME.check_palette.run({ ground: "#141210", ink: "#f2efe9", accent: "#ff5f1f" });
  assert.equal(neon.pass, false);
  assert.match(neon.issues.join(" "), /dark\+neon/);
  const surfaced = TOOL_BY_NAME.check_palette.run({ ground: "#eceae3", ink: "#17150f", accent: "#b5522f", surface: "#d8d4ca" });
  assert.equal(surfaced.pass, true);
  assert.ok(surfaced.surface.contrastVsGround >= 1.1);
});

test("UX-layer tools: microcopy, empty_state, accessibility, form, component_states, IA", () => {
  for (const n of ["audit_microcopy", "generate_empty_state", "audit_accessibility", "audit_form", "check_component_states", "check_information_architecture"]) {
    assert.ok(TOOL_BY_NAME[n], `missing tool ${n}`);
  }
  assert.equal(TOOL_BY_NAME.audit_microcopy.run({ items: [{ kind: "button", text: "Submit" }] }).verdict, "SLOP");
  assert.ok(TOOL_BY_NAME.generate_empty_state.run({ object: "projects" }).cta);
  assert.equal(TOOL_BY_NAME.audit_accessibility.run({ interactive: [{ type: "button", size: 30, focusVisible: false }] }).verdict, "SLOP");
  assert.equal(TOOL_BY_NAME.audit_form.run({ columns: 3 }).verdict, "SLOP");
  assert.deepEqual(TOOL_BY_NAME.check_component_states.run({ states: ["resting"] }).missingRequired, ["hover", "active", "focus", "disabled"]);
  assert.equal(TOOL_BY_NAME.check_information_architecture.run({ items: ["A", "B", "C", "D", "E", "F", "G", "H"] }).verdict, "SLOP");
});

test("fix_spacing: snaps values + component box models to the grid", () => {
  const r = TOOL_BY_NAME.fix_spacing.run({ values: [13, 17], components: { button: { paddingX: 15, gap: 7 } } });
  assert.equal(r.verdict, "FIXED");
  assert.deepEqual(r.values.map((v) => v.to), [12, 16]);
  assert.equal(r.components.button.paddingX.to, 16);
  assert.equal(r.components.button.gap.to, 8);
});

test("build_page: genome → self-contained, charset-correct HTML", () => {
  const r = TOOL_BY_NAME.build_page.run({ surface: "landing-page", sourceBrief: "a scheduling tool for clinics", seed: 3 });
  assert.match(r.html, /^<!doctype html>/i);
  assert.match(r.html, /<meta charset="utf-8">/);
  assert.match(r.html, /max-width:var\(--maxw\)/);
  assert.ok(r.genome.fonts.body && r.genome.palette.accent);
  // deterministic
  assert.equal(TOOL_BY_NAME.build_page.run({ surface: "landing-page", sourceBrief: "a scheduling tool for clinics", seed: 3 }).html, r.html);
});

test("font recommendations carry a loadable asset and never use a display face as body", () => {
  const result = TOOL_BY_NAME.suggest_fonts.run({ n: 8 });
  assert.ok(result.pairing.display);
  assert.ok(result.pairing.body);
  assert.ok(result.pairing.assets.display.available);
  assert.ok(result.pairing.assets.body.available);
  assert.equal(result.pairing.assets.display.remotelyLoadable, false);
  assert.equal(result.pairing.assets.display.loadSpec.status, "repository-local-only");
  assert.equal(result.pairing.assets.display.loadSpec.faces.length, 0, "remote response must not advertise unserved public URLs");
  assert.ok(result.pairing.assets.display.loadSpec.localFaces.length > 0);
  const body = result.picks.find((pick) => pick.family === result.pairing.body);
  assert.ok(body?.roleSuitability.body);
  assert.match(result.pairing.gate, /asset-present/);
  const riskyDisplay = TOOL_BY_NAME.check_font.run({ family: "Anthony" });
  assert.equal(riskyDisplay.roleSuitability.body, false);
  assert.equal(riskyDisplay.asset.available, true);
  const workhorse = TOOL_BY_NAME.check_font.run({ family: "Bricolage Grotesque" });
  assert.equal(workhorse.roleSuitability.body, true);
});
