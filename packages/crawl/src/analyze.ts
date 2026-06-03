/**
 * Pure, deterministic multi-role font analysis.
 *
 * Takes the rendered elements of a page and decides which font fills each role:
 * hero, secondary heading, body, mono/code, plus the full set of fonts in use.
 * No browser, no LLM — same elements in, same profile out. Unit-tested.
 */

import { classifyRoles, normalizeFamily, type RenderedElement } from "@ai-slop-font/core";

export interface CrawlElement {
  /** Raw computed font-family stack. */
  fontFamilyStack: string;
  fontSizePx: number;
  fontWeight: number;
  textLength: number;
  /** lowercased tag name: h1, h2, p, code, ... */
  tag: string;
  aboveFold: boolean;
}

export interface FontUsage {
  family: string;
  /** Roles this font appears in. */
  roles: string[];
  /** Total visible text length set in this font. */
  weight: number;
  /** Largest font-size this font appears at (px). */
  maxSizePx: number;
}

export interface PageFontProfile {
  heroFont: string | null;
  headingFont: string | null;
  bodyFont: string | null;
  monoFont: string | null;
  allFonts: FontUsage[];
}

const HEADING_TAGS = new Set(["h2", "h3", "h4"]);
const MONO_TAGS = new Set(["code", "pre", "kbd", "samp"]);

export function analyzePage(elements: readonly CrawlElement[]): PageFontProfile {
  const normalized = elements
    .map((e) => ({ ...e, family: normalizeFamily(e.fontFamilyStack) }))
    .filter((e) => e.family.length > 0 && e.textLength > 0);

  if (normalized.length === 0) {
    return { heroFont: null, headingFont: null, bodyFont: null, monoFont: null, allFonts: [] };
  }

  // hero + body via the shared core classifier
  const rendered: RenderedElement[] = normalized.map((e) => ({
    fontFamily: e.family,
    fontSizePx: e.fontSizePx,
    textLength: e.textLength,
    isH1: e.tag === "h1",
    aboveFold: e.aboveFold,
  }));
  const { heroFont, bodyFont } = classifyRoles(rendered);

  const headingFont = dominantFamily(normalized.filter((e) => HEADING_TAGS.has(e.tag)));
  const monoFont = dominantFamily(
    normalized.filter((e) => MONO_TAGS.has(e.tag) || e.family.includes("mono")),
  );

  // Aggregate all fonts in use.
  const usage = new Map<string, FontUsage>();
  for (const e of normalized) {
    const u = usage.get(e.family) ?? { family: e.family, roles: [], weight: 0, maxSizePx: 0 };
    u.weight += e.textLength;
    u.maxSizePx = Math.max(u.maxSizePx, e.fontSizePx);
    usage.set(e.family, u);
  }
  // Tag roles onto each font.
  for (const u of usage.values()) {
    if (u.family === heroFont) u.roles.push("hero");
    if (u.family === headingFont) u.roles.push("heading");
    if (u.family === bodyFont) u.roles.push("body");
    if (u.family === monoFont) u.roles.push("mono");
  }
  const allFonts = [...usage.values()].sort((a, b) => b.weight - a.weight || cmp(a.family, b.family));

  return { heroFont, headingFont, bodyFont, monoFont, allFonts };
}

/** Dominant family by total text length (deterministic tiebreak by name). */
function dominantFamily(els: ReadonlyArray<{ family: string; textLength: number }>): string | null {
  if (els.length === 0) return null;
  const by = new Map<string, number>();
  for (const e of els) by.set(e.family, (by.get(e.family) ?? 0) + e.textLength);
  return [...by.entries()].sort((a, b) => b[1] - a[1] || cmp(a[0], b[0]))[0]![0];
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
