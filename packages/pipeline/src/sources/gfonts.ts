/**
 * Google Fonts source — keyless metadata ingestion.
 *
 * Uses the public `fonts.google.com/metadata/fonts` endpoint (no API key). Yields
 * a normalized IndexedFont per family. Glyph metrics and real personality vectors
 * are filled in by later pipeline steps; what we set here is provisional and
 * flagged as such (metricsReal / personalityReal = false).
 */

import {
  objectiveQuality,
  compositeQuality,
  type FontMetrics,
  type PersonalityVector,
} from "@ai-slop-font/core";
import type { IndexedFont } from "../types.js";

const METADATA_URL = "https://fonts.google.com/metadata/fonts";

/** Top-N most popular fonts are treated as foundational infrastructure. */
export const FOUNDATIONAL_TOP_RANK = 50;

interface RawFamily {
  family: string;
  category: string;
  subsets: string[];
  fonts: string[] | Record<string, unknown>;
  axes: Array<{ tag: string }>;
  popularity: number;
  trending: number;
  dateAdded: string;
  isBrandFont: boolean;
}

export async function fetchGoogleFontsMetadata(): Promise<RawFamily[]> {
  const res = await fetch(METADATA_URL, { headers: { "user-agent": "ai-slop-font/0.1" } });
  if (!res.ok) throw new Error(`Google Fonts metadata HTTP ${res.status}`);
  const text = (await res.text()).replace(/^\)\]\}'\s*/, "");
  const data = JSON.parse(text) as { familyMetadataList: RawFamily[] };
  return data.familyMetadataList;
}

export function normalizeFamily(raw: RawFamily): IndexedFont {
  const id = slugify(raw.family);
  const category = mapCategory(raw.category);
  const weightKeys = Array.isArray(raw.fonts) ? raw.fonts : Object.keys(raw.fonts);
  const weightCount = weightKeys.filter((k) => !k.endsWith("i")).length || 1;
  const hasItalics = weightKeys.some((k) => k.endsWith("i"));
  const charsetCompleteness = charsetProxy(raw.subsets);

  // Provisional metrics: neutral placeholders for glyph-derived values (filled by
  // extract-metrics.ts), real values where metadata gives them.
  const metrics: FontMetrics = {
    xHeightRatio: 0.5,
    apertureOpenness: 0.5,
    counterSize: 0.5,
    strokeContrast: 0.3,
    weightCount,
    hasItalics,
    charsetCompleteness,
  };

  const personality = provisionalPersonality(category);
  const quality = compositeQuality({ objective: objectiveQuality(metrics) });

  return {
    id,
    family: raw.family,
    supplier: "google",
    category,
    metrics,
    personality,
    isFoundational: raw.popularity <= FOUNDATIONAL_TOP_RANK,
    popularityRank: raw.popularity,
    trendingRank: raw.trending,
    isBrandFont: raw.isBrandFont,
    dateAdded: raw.dateAdded,
    quality,
    metricsReal: false,
    personalityReal: false,
  };
}

function mapCategory(c: string): IndexedFont["category"] {
  switch (c.toLowerCase().replace(/\s+/g, "-")) {
    case "serif":
      return "serif";
    case "display":
      return "display";
    case "handwriting":
      return "handwriting";
    case "monospace":
      return "monospace";
    default:
      return "sans-serif";
  }
}

function charsetProxy(subsets: string[]): number {
  let score = 0.6;
  if (subsets.includes("latin")) score += 0.2;
  if (subsets.includes("latin-ext")) score += 0.15;
  return Math.min(1, score);
}

/** Coarse personality from category. Replaced by O'Donovan/LLM attributes later. */
function provisionalPersonality(category: IndexedFont["category"]): PersonalityVector {
  switch (category) {
    case "serif":
      return { elegant: 0.6, formal: 0.6, professional: 0.5 };
    case "display":
      return { bold: 0.7, dramatic: 0.7 };
    case "handwriting":
      return { playful: 0.8, friendly: 0.7 };
    case "monospace":
      return { technical: 0.9, professional: 0.5 };
    default:
      return { professional: 0.6, calm: 0.5 };
  }
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
