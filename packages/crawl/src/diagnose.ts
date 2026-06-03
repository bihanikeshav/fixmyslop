/**
 * Diagnose a site — fully deterministic, no LLM at runtime.
 *
 *   npx tsx src/diagnose.ts https://example.com
 *
 * Output: stats on the over-used fonts/styles the site uses, like-for-like font
 * swaps (same vibe, more character, far fresher), plus cohesive font groups and
 * fresh palettes. Style tells are flagged to AVOID — we don't synthesize new
 * styles (that would need an LLM).
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  diagnoseImprovements,
  suggestReplacements,
  fontGroupsForVibe,
  palettesForVibe,
  type SwapCandidate,
  type PersonalityVector,
} from "@ai-slop-font/core";
import { withBrowser, withPage, extractElements } from "./extract.js";
import { analyzePage } from "./analyze.js";
import { extractStyle } from "./style.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(HERE, "../../../data");
const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const SLOP_CUTOFF = 0.4;

interface FontRec { id: string; family: string; category: string; personality: PersonalityVector; isFoundational: boolean; metrics: { strokeContrast: number; xHeightRatio: number } }

async function main(): Promise<void> {
  const url = process.argv[2];
  if (!url) { console.log("usage: tsx src/diagnose.ts <url>"); return; }

  const { index, displaySat, crawlCount, rankOf, totalRanked } = await loadSignals();
  const recById = new Map(index.map((f) => [f.id, f]));
  const candidates: SwapCandidate[] = index.map((f) => ({
    id: f.id, family: f.family, category: f.category, personality: f.personality,
    displaySaturation: displaySat.get(f.id) ?? 0,
    strokeContrast: f.metrics?.strokeContrast, xHeightRatio: f.metrics?.xHeightRatio,
  }));

  const result = await withBrowser((browser) =>
    withPage(browser, url, async (page) => ({
      fonts: analyzePage(await extractElements(page)),
      style: await extractStyle(page),
    })),
  );
  if (!result) { console.log(`Could not load ${url}`); return; }
  const { fonts, style } = result;

  console.log(`\n# Diagnosis — ${url}   (deterministic, no LLM)\n`);
  console.log(`Detected: hero = ${fonts.heroFont ?? "?"}   body = ${fonts.bodyFont ?? "?"}\n`);

  console.log("## Your fonts — the stats");
  for (const [role, font] of [["hero", fonts.heroFont], ["body", fonts.bodyFont]] as const) {
    if (!font) continue;
    const id = slug(font);
    const rec = recById.get(id);
    const sat = displaySat.get(id) ?? 0;
    if (!rec) { console.log(`  • ${role}: "${font}" — not a Google Font (custom/self-hosted). Can't stat it.`); continue; }
    const overused = rec.isFoundational || sat >= SLOP_CUTOFF;
    const stat = `saturation ${sat.toFixed(2)}` + (sat > 0 ? `, #${rankOf(id)} most over-used of ${totalRanked}` : "") + (crawlCount.get(id) ? `, seen on ${crawlCount.get(id)} crawled sites` : "");
    console.log(`  • ${role}: "${rec.family}" — ${overused ? "OVER-USED" : "okay"}. ${stat}`);
    if (overused) {
      const swaps = suggestReplacements({ personality: rec.personality, category: rec.category, strokeContrast: rec.metrics?.strokeContrast, xHeightRatio: rec.metrics?.xHeightRatio, family: rec.family }, candidates, { limit: 3 });
      for (const s of swaps) console.log(`        ↳ try ${s.family.padEnd(20)} — ${s.reason}`);
      if (swaps.length === 0) console.log("        ↳ (no close fresh match found)");
    }
  }

  const tells = {
    aiPurpleGradient: style.aiPurpleGradient, gradientText: style.gradientText,
    glassmorphism: style.glassmorphism, pillButtons: style.pillButtons,
    heavyRounding: style.avgCornerRadiusPx >= 14, uppercaseHeadings: style.uppercaseHeadings,
    tightHeroTracking: style.tightHeroTracking,
  };
  const styleImps = diagnoseImprovements({ heroFont: null, heroIsSlop: false, heroIsFoundational: false, bodyFont: null, bodyIsSlop: false, tells });
  console.log("\n## Your style — over-used moves to AVOID");
  if (styleImps.length === 0) console.log("  Nothing obvious — this site already dodges the common tells.");
  for (const i of styleImps) console.log(`  • ${i.tell}  →  ${i.fix}`);
  console.log("  (We flag over-used styles; we don't auto-generate a new one — that would need an LLM.)");

  console.log("\n## Cohesive font groups to consider");
  for (const g of fontGroupsForVibe().slice(0, 5)) console.log(`  ▸ ${g.name}: ${g.hero} / ${g.body}${g.accent ? " / " + g.accent : ""}  (${g.mood})`);
  console.log("\n## Fresh palettes (none are an AI default)");
  for (const p of palettesForVibe().slice(0, 5)) console.log(`  ▸ ${p.name}: ${p.accent} on ${p.background}  — avoids ${p.avoids}`);
  console.log();
}

async function loadSignals() {
  const index = JSON.parse(await readFile(resolve(DATA_DIR, "fonts.index.json"), "utf8")) as FontRec[];
  const sat = JSON.parse(await readFile(resolve(DATA_DIR, "saturation.json"), "utf8")) as Array<{ fontId: string; display: number }>;
  let crawl: Array<{ fontId: string; role: string; count: number }> = [];
  try { crawl = JSON.parse(await readFile(resolve(DATA_DIR, "observations.crawl.json"), "utf8")); } catch { /* optional */ }

  const displaySat = new Map(sat.map((s) => [s.fontId, s.display]));
  const crawlCount = new Map(crawl.filter((o) => o.role === "display").map((o) => [o.fontId, o.count]));
  const ranked = [...sat].filter((s) => s.display > 0).sort((a, b) => b.display - a.display);
  const rankIndex = new Map(ranked.map((s, i) => [s.fontId, i + 1]));
  return {
    index, displaySat, crawlCount,
    rankOf: (id: string) => rankIndex.get(id) ?? ranked.length,
    totalRanked: ranked.length,
  };
}

main().catch((e) => { console.error(e); process.exit(1); });
