import type { FontRecord } from "@fixmyslop/core";

/** A font as stored in the on-disk index: a core FontRecord plus provenance. */
export interface IndexedFont extends FontRecord {
  popularityRank: number; // Google overall-usage rank (1 = most used). Body baseline.
  trendingRank: number; // Google trending rank.
  isBrandFont: boolean;
  dateAdded: string;
  /** Precomputed composite quality (recomputed when better signals land). */
  quality: number;
  /** False until real glyph metrics are extracted from the font file. */
  metricsReal: boolean;
  /** False until O'Donovan / LLM attributes replace the metadata heuristic. */
  personalityReal: boolean;
}
