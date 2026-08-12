// apps/engine/prompts.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { PREAMBLE, VERBS, renderPrompt, renderSkill, renderVerbFile } from "./prompts.mjs";
import { renderReference } from "./reference.mjs";

const REAL_TOOLS = new Set(["check_color","check_palette","suggest_fonts","check_font","structure_ideas",
  "design_system","audit_system","type_scale","spacing_scale","radius_scale","shadow","layout",
  "generate_palette","motion_tokens","check_type","check_spacing","check_radius","check_shadow","check_layout","check_motion",
  "resolve_intent","style_genome","suggest_layout","font_neighbors","check_svg","explore_directions",
  "connected_style_genome","connected_explore_directions","connected_build_spec","connected_v2_catalog",
  "dashboard_system","fluid_components","check_dashboard_layout",
  "check_composition","shade_ramp","semantic_colors","audit_microcopy","generate_empty_state",
  "audit_accessibility","audit_form","check_component_states","check_information_architecture"]);

test("exactly the 7 core verbs", () => {
  assert.deepEqual(VERBS.map((v) => v.name).sort(),
    ["colorize","design_review","explore","improve_design","polish","theme","typeset"]);
});

test("every verb body cites only real tool names + asks for direction", () => {
  for (const v of VERBS) {
    // any `code`-quoted token that looks like a tool must be real
    for (const m of v.body.matchAll(/`([a-z_]{4,})`/g)) {
      if (m[1].includes("_") || REAL_TOOLS.has(m[1])) {
        if (/^[a-z_]+$/.test(m[1]) && !m[1].includes(" "))
          assert.ok(REAL_TOOLS.has(m[1]) || !/_/.test(m[1]) || m[1] === "type_scale", `unknown tool ${m[1]} in ${v.name}`);
      }
    }
    assert.match(v.body, /ask|direction|before/i, `${v.name} must gather direction first`);
  }
});

test("PREAMBLE is self-contained + carries the font/layout rules", () => {
  assert.doesNotMatch(PREAMBLE, /\.\.\/personality/);
  assert.match(PREAMBLE, /body/i);
  assert.match(PREAMBLE, /container|margin/i);
});

test("renderPrompt returns a self-contained MCP user message (full gates + verb)", () => {
  const p = renderPrompt("improve_design", {});
  assert.equal(p.messages[0].role, "user");
  assert.match(p.messages[0].content.text, /suggest_fonts|design_system/);
});

test("renderSkill is a cheap staggered index named fixmyslop", () => {
  const skill = renderSkill();
  assert.match(skill, /^---[\s\S]*name:\s*fixmyslop/);   // renamed
  assert.doesNotMatch(skill, /\.\.\/personality/);
  assert.match(skill, /pairing\.body/);                     // the two rules live in the cheap index
  assert.match(skill, /container/);
  assert.match(skill, /improve_design\.md/);                // references on-demand pass files
  assert.match(skill, /design-law\.md/);                    // references the full law
  assert.ok(skill.length < PREAMBLE.length, "index must be cheaper than the full design law");
});

test("renderVerbFile returns one lean pass on demand; null for unknown", () => {
  const f = renderVerbFile("polish");
  assert.match(f, /# fixmyslop — polish/);
  assert.match(f, /design-law\.md/);                        // points back to the full law
  assert.equal(renderVerbFile("nope"), null);
});

test("component craft reference carries interaction quality through composition", () => {
  const components = renderReference("components");
  assert.match(components, /Preview intent before commitment/);
  assert.match(components, /Density is a region decision/);
  assert.match(components, /Surfaces lift relative to their substrate/);
  assert.match(components, /keyboard only/);

  const motion = renderReference("motion");
  assert.match(motion, /One shared motion language/);
  assert.match(motion, /reversal continues from the current value/);
  assert.match(motion, /Reduced motion is reduced displacement/);
});

test("technical product reference turns the reference look into a reusable page grammar", () => {
  const technical = renderReference("technical-product");
  assert.match(technical, /Write the narrative spine before styling/);
  assert.match(technical, /Information is the ornament/);
  assert.match(technical, /Proof has a methodology/);
  assert.match(technical, /Do not clone the reference/);

  const skill = renderSkill();
  assert.match(skill, /reference\/technical-product\.md/);

  const improve = renderVerbFile("improve_design");
  assert.match(improve, /reference\/technical-product\.md/);
});

test("dashboard pass requires computed geometry and genuine Fluid registry components", () => {
  const reference = renderReference("fluid-dashboards");
  assert.match(reference, /Source components, not a borrowed skin/);
  assert.match(reference, /dashboard_system/);
  assert.match(reference, /fluid_components/);
  assert.match(reference, /check_dashboard_layout/);
  assert.match(reference, /@fluid\/\*/);
  assert.match(reference, /Do not recreate lookalike/i);

  const improve = renderVerbFile("improve_design");
  assert.match(improve, /reference\/fluid-dashboards\.md/);
  assert.match(improve, /genuine `@fluid\/\*` registry sources/);
  assert.match(improve, /background fades/);

  const skill = renderSkill();
  assert.match(skill, /reference\/fluid-dashboards\.md/);
});
