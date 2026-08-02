import { test } from "node:test";
import assert from "node:assert/strict";
import { TOOL_BY_NAME } from "./tools.mjs";

test("new tools exist and run", () => {
  for (const n of ["design_system", "type_scale", "shadow", "layout", "generate_palette", "check_shadow", "audit_system"]) {
    assert.ok(TOOL_BY_NAME[n], `missing tool ${n}`);
  }
  assert.ok(TOOL_BY_NAME.type_scale.run({ base: 16, ratio: 1.25 }).length > 1);
  assert.equal(TOOL_BY_NAME.check_shadow.run({ css: "0 4px 6px rgba(0,0,0,0.5)" }).verdict, "SLOP");
  assert.ok(TOOL_BY_NAME.design_system.run({ seed: 2 }).palette.accent);
});
