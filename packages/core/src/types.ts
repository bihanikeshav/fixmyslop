/**
 * Core domain types for the deterministic Brain.
 *
 * Everything here is pure data. No I/O, no Date.now(), no randomness — callers
 * pass time/window in explicitly so scoring is reproducible within a window.
 */

export type FontRole = "display" | "body";

/**
 * Personality attributes. Subset of the O'Donovan (SIGGRAPH 2014) crowdsourced
 * attribute set, grouped under Shaikh & Chaparro's three factors so the vocabulary
 * is grounded rather than invented. Each value is 0..1.
 */
export const PERSONALITY_ATTRIBUTES = [
  // Potency  (rugged <-> delicate)
  "strong",
  "bold",
  "delicate",
  "thin",
  // Evaluative  (beautiful/valuable <-> cheap)
  "elegant",
  "friendly",
  "professional",
  "playful",
  // Activity  (loud/fast <-> calm)
  "dramatic",
  "calm",
  "formal",
  "technical",
] as const;

export type PersonalityAttribute = (typeof PERSONALITY_ATTRIBUTES)[number];

export type PersonalityVector = Partial<Record<PersonalityAttribute, number>>;

export const SHAIKH_FACTORS = {
  potency: ["strong", "bold", "delicate", "thin"],
  evaluative: ["elegant", "friendly", "professional", "playful"],
  activity: ["dramatic", "calm", "formal", "technical"],
} as const satisfies Record<string, readonly PersonalityAttribute[]>;

/** Raw, objectively-measurable metrics extracted from a font file. */
export interface FontMetrics {
  /** x-height / cap-height. Taller reads better at small sizes. ~0.4..0.8 typical. */
  xHeightRatio: number;
  /** Openness of c/e/s apertures, 0 (closed) .. 1 (open). Open reads better. */
  apertureOpenness: number;
  /** Counter (enclosed white space) size, 0 (clogged) .. 1 (generous). */
  counterSize: number;
  /** Stroke contrast thick:thin. 0 = monoline, 1 = extreme. Extreme hurts at small sizes. */
  strokeContrast: number;
  /** Number of distinct weights available. */
  weightCount: number;
  hasItalics: boolean;
  /** Glyph coverage of a target charset, 0..1. */
  charsetCompleteness: number;
}

/** A font as the Brain knows it. */
export interface FontRecord {
  id: string;
  family: string;
  supplier: "google" | "fontshare" | "adobe" | "self-hosted" | "other";
  category: "serif" | "sans-serif" | "display" | "handwriting" | "monospace";
  metrics: FontMetrics;
  personality: PersonalityVector;
  /**
   * True if this font is so common it reads as invisible infrastructure
   * (the GF-popularity "foundational baseline"). Excluded from display picks.
   */
  isFoundational: boolean;
}

/** Current, role-segmented saturation for a font. 0 = unseen, 1 = everywhere. */
export interface SaturationStat {
  fontId: string;
  /** Saturation in the display/hero role — this is where slop is measured. */
  display: number;
  /** Saturation in the body/foundational role — neutral, informational. */
  body: number;
  /** Positive = rising (trending toward slop), 0 = flat, negative = fading. */
  trend: number;
}

/** A request to the recommender. */
export interface RecommendQuery {
  /** Desired personality. Empty = no personality constraint. */
  target: PersonalityVector;
  /** Which role the caller is filling. Display picks exclude foundational fonts. */
  role: FontRole;
  /** 0 = play it safe (ignore saturation), 1 = maximally avoid the mainstream. */
  freshness: number;
  /** Minimum composite quality a font must clear to be recommended at all. */
  qualityThreshold: number;
  /** How many results to return. */
  limit: number;
}

export interface Recommendation {
  font: FontRecord;
  /** Final ranking score, higher is better. */
  score: number;
  qualityScore: number;
  personalityMatch: number;
  displaySaturation: number;
  reasons: string[];
}
