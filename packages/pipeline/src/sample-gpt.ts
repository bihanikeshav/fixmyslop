/**
 * Sample GPT-5.5 font defaults across the vibe taxonomy (OpenAI API).
 *
 *   OPENAI_API_KEY=... npx tsx src/sample-gpt.ts [vibeLimit]
 *
 * Produces the same observation shape as the Anthropic subagent collection, so
 * the two merge into one synthetic display-saturation signal. Skips (exit 0)
 * when no key is set.
 */

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { Observation } from "@fixmyslop/core";
import { VIBES } from "./vibes.js";
import { slugify } from "./sources/gfonts.js";
import {
  resolveOpenAiConfig,
  buildRankedPrompt,
  parseRankedList,
  callOpenAI,
} from "./signals/openai.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(HERE, "../../../data");

async function main(): Promise<void> {
  const cfg = resolveOpenAiConfig(process.env);
  if (!cfg) {
    console.log("No OPENAI_API_KEY set — skipping GPT sampling (key-ready, not run).");
    return;
  }
  const vibeLimit = Number(process.argv[2] ?? "12");
  const vibes = VIBES.slice(0, vibeLimit);
  console.log(`Sampling GPT (${cfg.model}) across ${vibes.length} vibes...`);

  const points = new Map<string, number>();
  let ok = 0;
  for (const v of vibes) {
    try {
      const text = await callOpenAI(buildRankedPrompt(v.description), cfg);
      const ranked = parseRankedList(text);
      if (ranked.length === 0) continue;
      ranked.forEach((rf, i) => points.set(slugify(rf.font), (points.get(slugify(rf.font)) ?? 0) + (20 - i)));
      ok++;
      console.log(`  ${v.id}: ${ranked[0]?.font} (#1)`);
    } catch (e) {
      console.warn(`  ! ${v.id}: ${(e as Error).message}`);
    }
  }

  const observations: Observation[] = [...points].map(([fontId, count]) => ({
    fontId, role: "display", window: 0, count, signal: "synthetic",
  }));
  await writeFile(resolve(DATA_DIR, "observations.gpt.json"), JSON.stringify(observations, null, 2));
  console.log(`\nDone. ${ok}/${vibes.length} vibes sampled -> data/observations.gpt.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
