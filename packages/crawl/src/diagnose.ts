/**
 * Diagnose a site: point out the generic patterns, then hand out fresh font
 * groups + palettes. No vanity score — improvements + prescriptions only.
 *
 *   npx tsx src/diagnose.ts https://example.com
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  diagnoseImprovements,
  fontGroupsForVibe,
  palettesForVibe,
} from "@ai-slop-font/core";
import { withBrowser, withPage, extractElements } from "./extract.js";
import { analyzePage } from "./analyze.js";
import { extractStyle } from "./style.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(HERE, "../../../data");
const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const SLOP_CUTOFF = 0.4;

async function main(): Promise<void> {
  const url = process.argv[2];
  if (!url) { console.log("usage: tsx src/diagnose.ts <url>"); return; }

  const { displaySat, foundational } = await loadSignals();

  const result = await withBrowser((browser) =>
    withPage(browser, url, async (page) => {
      const fonts = analyzePage(await extractElements(page));
      const style = await extractStyle(page);
      return { fonts, style };
    }),
  );
  if (!result) { console.log(`Could not load ${url}`); return; }
  const { fonts, style } = result;

  const isSlop = (f: string | null) => (f ? (displaySat.get(slug(f)) ?? 0) >= SLOP_CUTOFF : false);
  const improvements = diagnoseImprovements({
    heroFont: fonts.heroFont,
    heroIsSlop: isSlop(fonts.heroFont),
    heroIsFoundational: fonts.heroFont ? foundational.has(slug(fonts.heroFont)) : false,
    bodyFont: fonts.bodyFont,
    bodyIsSlop: isSlop(fonts.bodyFont) || (fonts.bodyFont ? foundational.has(slug(fonts.bodyFont)) : false),
    tells: {
      aiPurpleGradient: style.aiPurpleGradient,
      gradientText: style.gradientText,
      glassmorphism: style.glassmorphism,
      pillButtons: style.pillButtons,
      heavyRounding: style.avgCornerRadiusPx >= 14,
      uppercaseHeadings: style.uppercaseHeadings,
      tightHeroTracking: style.tightHeroTracking,
    },
  });

  console.log(`\n# Diagnosis — ${url}\n`);
  console.log(`Detected: hero=${fonts.heroFont ?? "?"}  body=${fonts.bodyFont ?? "?"}`);
  console.log(`\n## What's generic (${improvements.length})`);
  if (improvements.length === 0) console.log("  Nothing obvious — this site already dodges the common AI tells. ");
  for (const i of improvements) console.log(`  • ${i.tell}\n      → ${i.fix}`);

  console.log(`\n## Try these font groups instead`);
  for (const g of fontGroupsForVibe().slice(0, 5)) {
    console.log(`  ▸ ${g.name} — ${g.hero} / ${g.body}${g.accent ? " / " + g.accent : ""}  (${g.mood})`);
  }
  console.log(`\n## Fresh palettes (none are the AI default)`);
  for (const p of palettesForVibe().slice(0, 5)) {
    console.log(`  ▸ ${p.name}: ${p.background} ${p.surface} ${p.text} ${p.accent} ${p.accent2}  — avoids ${p.avoids}`);
  }
  console.log();
}

async function loadSignals(): Promise<{ displaySat: Map<string, number>; foundational: Set<string> }> {
  const sat = JSON.parse(await readFile(resolve(DATA_DIR, "saturation.json"), "utf8")) as Array<{ fontId: string; display: number }>;
  const idx = JSON.parse(await readFile(resolve(DATA_DIR, "fonts.index.json"), "utf8")) as Array<{ id: string; isFoundational: boolean }>;
  return {
    displaySat: new Map(sat.map((s) => [s.fontId, s.display])),
    foundational: new Set(idx.filter((f) => f.isFoundational).map((f) => f.id)),
  };
}

main().catch((e) => { console.error(e); process.exit(1); });
