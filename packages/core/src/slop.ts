/**
 * Slop scoring — powers the Slop-o-meter and the MCP's check_slop tool.
 *
 * Given the fonts a page actually uses (from deterministic role extraction) and
 * the current saturation model, score how "AI-slop" it is, 0..100. Slop lives in
 * the DISPLAY role: a generic hero font is the offence; a common body font is not.
 */

import type { SaturationStat } from "./types.js";

export interface PageFonts {
  heroFont: string | null;
  bodyFont: string | null;
}

export interface SlopInput {
  page: PageFonts;
  /** Look up current saturation for a (normalized) font family. */
  saturationOf: (fontFamily: string) => SaturationStat | undefined;
  /** Is this font in the foundational-baseline exclusion set? */
  isFoundational: (fontFamily: string) => boolean;
}

export interface SlopResult {
  /** 0 (distinctive) .. 100 (peak slop). */
  score: number;
  verdict: "fresh" | "fine" | "generic" | "peak-slop";
  offenders: string[];
  notes: string[];
}

export function slopScore(input: SlopInput): SlopResult {
  const { page, saturationOf, isFoundational } = input;
  const offenders: string[] = [];
  const notes: string[] = [];

  let score = 0;

  if (page.heroFont) {
    const sat = saturationOf(page.heroFont);
    const heroSat = sat?.display ?? 0;
    // Hero font drives most of the score — this is where slop is felt.
    score += heroSat * 70;
    if (heroSat >= 0.5) offenders.push(page.heroFont);

    if (isFoundational(page.heroFont)) {
      // Using an invisible-infrastructure font AS your hero is peak generic.
      score += 20;
      notes.push(`hero uses a foundational font (${page.heroFont}) — no personality`);
    }
    if ((sat?.trend ?? 0) > 0.3) {
      notes.push(`hero font is trending up — heading toward slop`);
    }
  } else {
    notes.push("no hero font detected");
  }

  // Body font contributes only a little — common body text is fine, not slop.
  if (page.bodyFont) {
    const bodySat = saturationOf(page.bodyFont)?.body ?? 0;
    score += bodySat * 10;
  }

  score = Math.round(Math.max(0, Math.min(100, score)));

  return { score, verdict: verdictFor(score), offenders, notes };
}

function verdictFor(score: number): SlopResult["verdict"] {
  if (score < 20) return "fresh";
  if (score < 45) return "fine";
  if (score < 75) return "generic";
  return "peak-slop";
}
