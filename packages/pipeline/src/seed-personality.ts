/**
 * Seed real personality vectors from O'Donovan into the font index.
 *
 *   npx tsx src/seed-personality.ts
 *
 * Replaces the category heuristic with crowdsourced attributes for every font that
 * matches the O'Donovan study set; leaves the rest provisional (personalityReal=false).
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { loadOdonovan } from "./sources/odonovan.js";
import type { IndexedFont } from "./types.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(HERE, "../../../data");

async function main(): Promise<void> {
  const indexPath = resolve(DATA_DIR, "fonts.index.json");
  const fonts: IndexedFont[] = JSON.parse(await readFile(indexPath, "utf8"));
  const byId = new Map(fonts.map((f) => [f.id, f]));

  console.log("Loading O'Donovan attributes...");
  const { byFontId } = await loadOdonovan(resolve(DATA_DIR, "odonovan/estimatedAttributes.csv"));
  console.log(`  ${byFontId.size} fonts in the study set`);

  let matched = 0;
  for (const [fontId, vec] of byFontId) {
    const f = byId.get(fontId);
    if (!f) continue;
    if (Object.keys(vec).length === 0) continue;
    f.personality = vec;
    f.personalityReal = true;
    matched++;
  }

  await writeFile(indexPath, JSON.stringify(fonts, null, 2));
  console.log(`\nSeeded ${matched} fonts with real personality vectors.`);
  for (const id of ["lobster", "playfair-display", "oswald", "pacifico", "lora"]) {
    const f = byId.get(id);
    if (f?.personalityReal) {
      console.log(`  ${f.family.padEnd(18)} ${topAttrs(f.personality)}`);
    }
  }
}

function topAttrs(p: IndexedFont["personality"]): string {
  return Object.entries(p)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, 3)
    .map(([k, v]) => `${k}:${(v ?? 0).toFixed(2)}`)
    .join("  ");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
