// scripts/build-atelier-skill.mjs — regenerate the self-contained atelier skill from the canonical prompts.mjs
import { renderSkill } from "../apps/engine/prompts.mjs";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
mkdirSync(resolve(process.cwd(), "skills/atelier"), { recursive: true });
writeFileSync(resolve(process.cwd(), "skills/atelier/SKILL.md"), renderSkill());
console.log("wrote skills/atelier/SKILL.md from prompts.mjs");
