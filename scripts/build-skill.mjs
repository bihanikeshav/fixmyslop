// scripts/build-skill.mjs — regenerate the staggered fix-ai-slop skill from the canonical
// prompts.mjs: a cheap SKILL.md index + design-law.md (full gates) + one file per pass.
import { renderSkill, renderVerbFile, PREAMBLE, VERBS } from "../apps/engine/prompts.mjs";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const dir = resolve(process.cwd(), "skills/fix-ai-slop");
mkdirSync(dir, { recursive: true });
writeFileSync(resolve(dir, "SKILL.md"), renderSkill());
writeFileSync(resolve(dir, "design-law.md"), PREAMBLE);
for (const v of VERBS) writeFileSync(resolve(dir, `${v.name}.md`), renderVerbFile(v.name));
console.log(`wrote skills/fix-ai-slop/ — SKILL.md (index) + design-law.md + ${VERBS.length} passes`);
