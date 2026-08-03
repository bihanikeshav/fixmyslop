// apps/engine/prompts.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { PREAMBLE, VERBS, renderPrompt, renderSkill, renderVerbFile } from "./prompts.mjs";

const REAL_TOOLS = new Set(["check_color","check_palette","suggest_fonts","check_font","structure_ideas",
  "design_system","audit_system","type_scale","spacing_scale","radius_scale","shadow","layout",
  "generate_palette","motion_tokens","check_type","check_spacing","check_radius","check_shadow","check_layout","check_motion",
  "resolve_intent","style_genome","suggest_layout","font_neighbors"]);

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

test("renderSkill is a cheap staggered index named fix-ai-slop", () => {
  const skill = renderSkill();
  assert.match(skill, /^---[\s\S]*name:\s*fix-ai-slop/);   // renamed
  assert.doesNotMatch(skill, /\.\.\/personality/);
  assert.match(skill, /pairing\.body/);                     // the two rules live in the cheap index
  assert.match(skill, /container/);
  assert.match(skill, /improve_design\.md/);                // references on-demand pass files
  assert.match(skill, /design-law\.md/);                    // references the full law
  assert.ok(skill.length < PREAMBLE.length, "index must be cheaper than the full design law");
});

test("renderVerbFile returns one lean pass on demand; null for unknown", () => {
  const f = renderVerbFile("polish");
  assert.match(f, /# fix-ai-slop — polish/);
  assert.match(f, /design-law\.md/);                        // points back to the full law
  assert.equal(renderVerbFile("nope"), null);
});
