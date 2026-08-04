import { test } from "node:test";
import assert from "node:assert/strict";
import { LAYOUT_FAMILIES } from "./layout-families.mjs";
import { SECTION_PURPOSE, DEFAULT_PURPOSE, CHROME_ROLES, purposeForRole, centrepieceRoleOf } from "./section-purpose.mjs";

test("every section role used by a shipped layout family has a real content-purpose entry (not the fallback)", () => {
  const missing = new Set();
  for (const family of LAYOUT_FAMILIES) {
    for (const section of family.sectionGrammar) {
      if (!SECTION_PURPOSE[section.role]) missing.add(`${family.name}:${section.role}`);
    }
  }
  assert.deepEqual([...missing], [], `roles missing a content-purpose entry: ${[...missing].join(", ")}`);
});

test("purposeForRole falls back to DEFAULT_PURPOSE for an unknown role, never throws", () => {
  assert.equal(purposeForRole("totally-unknown-role-xyz"), DEFAULT_PURPOSE);
});

test("centrepieceRoleOf picks the largest non-chrome section for every shipped family", () => {
  for (const family of LAYOUT_FAMILIES) {
    const role = centrepieceRoleOf(family.sectionGrammar);
    assert.ok(role, `${family.name}: no centrepiece role resolved`);
    assert.ok(!CHROME_ROLES.has(role), `${family.name}: centrepiece "${role}" resolved to a chrome role`);
    const chosen = family.sectionGrammar.find((s) => s.role === role);
    const maxNonChrome = Math.max(
      ...family.sectionGrammar.filter((s) => !CHROME_ROLES.has(s.role)).map((s) => s.heightShare),
    );
    assert.equal(chosen.heightShare, maxNonChrome, `${family.name}: "${role}" is not the largest non-chrome section`);
  }
});

test("centrepieceRoleOf returns null for an empty/missing sectionGrammar", () => {
  assert.equal(centrepieceRoleOf([]), null);
  assert.equal(centrepieceRoleOf(), null);
});

test("centrepieceRoleOf never selects a chrome role even if it happens to be tallest", () => {
  const grammar = [
    { role: "nav", heightShare: 0.9 },
    { role: "hero", heightShare: 0.1 },
  ];
  assert.equal(centrepieceRoleOf(grammar), "hero");
});
