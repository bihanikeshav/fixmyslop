/**
 * Personality matching over the attribute vectors. Cosine similarity, mapped to
 * 0..1. An empty target means "no personality constraint" and matches everything.
 */

import { PERSONALITY_ATTRIBUTES, type PersonalityVector } from "./types.js";

export function personalityMatch(
  target: PersonalityVector,
  font: PersonalityVector,
): number {
  const keys = Object.keys(target) as (keyof PersonalityVector)[];
  if (keys.length === 0) return 1; // no constraint

  let dot = 0;
  let tMag = 0;
  let fMag = 0;
  for (const attr of PERSONALITY_ATTRIBUTES) {
    const t = target[attr] ?? 0;
    const f = font[attr] ?? 0;
    dot += t * f;
    tMag += t * t;
    fMag += f * f;
  }
  if (tMag === 0 || fMag === 0) return 0;
  const cos = dot / (Math.sqrt(tMag) * Math.sqrt(fMag));
  // cosine over non-negative vectors is already in [0,1]
  return cos < 0 ? 0 : cos > 1 ? 1 : cos;
}
