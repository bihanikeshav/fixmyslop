// scripts/build-skill.mjs — regenerate the staggered fix-ai-slop skill from the canonical
// sources: a cheap SKILL.md index + design-law.md + one file per pass + a reference/ library
// (loaded on demand). All content comes from prompts.mjs + reference.mjs.
import { renderSkill, renderVerbFile, PREAMBLE, VERBS } from "../apps/engine/prompts.mjs";
import { REFERENCE, renderReference } from "../apps/engine/reference.mjs";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const dir = resolve(process.cwd(), "skills/fix-ai-slop");
mkdirSync(dir, { recursive: true });
writeFileSync(resolve(dir, "SKILL.md"), renderSkill());
writeFileSync(resolve(dir, "design-law.md"), PREAMBLE);
for (const v of VERBS) writeFileSync(resolve(dir, `${v.name}.md`), renderVerbFile(v.name));

const refDir = resolve(dir, "reference");
mkdirSync(refDir, { recursive: true });
for (const r of REFERENCE) writeFileSync(resolve(refDir, `${r.key}.md`), renderReference(r.key));

console.log(`wrote skills/fix-ai-slop/ — SKILL.md (index) + design-law.md + ${VERBS.length} passes + reference/ (${REFERENCE.length} topics)`);
