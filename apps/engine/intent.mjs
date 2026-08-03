// apps/engine/intent.mjs — Subsystem 1: intent detection → StyleIntent (pure math, no AI, no
// Math.random, no Date.now — deterministic; runs in a Cloudflare Worker and the browser).
//
// Architecture principle: the calling agent (Claude/Cursor) does the semantics — it reads free
// text and produces a StyleIntent. This module never guesses meaning; it validates, fills gaps
// from hand-authored priors, flags contradictions, and derives a reproducible seed.

export const clamp01 = (n, fallback = 0.5) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.min(1, Math.max(0, x));
};

// The continuous dials, all clamped to [0,1].
export const DIALS = [
  "trustLevel", "contentDensity", "energy", "warmth", "formality", "era",
  "craft", "experimentalism", "motionIntensity", "layoutVariance",
  "materiality", "contrastPreference",
];

// Schema descriptor: dials + categorical/other fields. Consumers (skills, docs, validators) can
// read this instead of hard-coding the field list.
export const STYLE_INTENT_FIELDS = {
  dials: DIALS,
  categorical: ["surface", "job", "contentModel", "theme"],
  lists: ["audience", "references"],
  other: ["variation", "seed", "sourceBrief"],
};

// Hand-authored surface/job priors — a small constant lookup, not a model. `default` covers any
// job not explicitly listed for that surface. Only dials that matter for the surface's character
// are set; anything left out falls through to the neutral 0.5 default in resolveIntent.
export const SURFACE_JOB_PRIORS = {
  "landing-page": {
    default: {
      contentDensity: 0.45, energy: 0.6, warmth: 0.55, formality: 0.45,
      craft: 0.65, experimentalism: 0.6, motionIntensity: 0.5,
      layoutVariance: 0.6, materiality: 0.55, contrastPreference: 0.6,
    },
    "explain-and-convert": { contentDensity: 0.48, trustLevel: 0.7, energy: 0.63, experimentalism: 0.55 },
  },
  dashboard: {
    default: {
      contentDensity: 0.8, energy: 0.35, warmth: 0.3, formality: 0.7,
      craft: 0.5, experimentalism: 0.2, motionIntensity: 0.2,
      layoutVariance: 0.25, materiality: 0.35, contrastPreference: 0.75,
    },
    monitor: { contentDensity: 0.85, motionIntensity: 0.15, contrastPreference: 0.8 },
  },
  docs: {
    default: {
      contentDensity: 0.35, energy: 0.3, warmth: 0.4, formality: 0.6,
      craft: 0.75, experimentalism: 0.2, motionIntensity: 0.15,
      layoutVariance: 0.25, materiality: 0.3, contrastPreference: 0.7,
    },
    "long-form": { contentDensity: 0.3, craft: 0.8, contrastPreference: 0.75, layoutVariance: 0.2 },
  },
  app: {
    default: {
      contentDensity: 0.6, energy: 0.4, warmth: 0.4, formality: 0.55,
      craft: 0.55, experimentalism: 0.3, motionIntensity: 0.35,
      layoutVariance: 0.3, materiality: 0.4, contrastPreference: 0.65,
    },
  },
  marketing: {
    default: {
      contentDensity: 0.4, energy: 0.7, warmth: 0.6, formality: 0.4,
      craft: 0.6, experimentalism: 0.65, motionIntensity: 0.55,
      layoutVariance: 0.65, materiality: 0.55, contrastPreference: 0.6,
    },
  },
  portfolio: {
    default: {
      contentDensity: 0.35, energy: 0.55, warmth: 0.5, formality: 0.35,
      craft: 0.8, experimentalism: 0.7, motionIntensity: 0.45,
      layoutVariance: 0.7, materiality: 0.6, contrastPreference: 0.6,
    },
  },
  pricing: {
    default: {
      contentDensity: 0.55, energy: 0.4, warmth: 0.45, formality: 0.55,
      craft: 0.6, experimentalism: 0.25, motionIntensity: 0.25,
      layoutVariance: 0.3, materiality: 0.4, contrastPreference: 0.7,
    },
  },
  editorial: {
    default: {
      contentDensity: 0.5, energy: 0.35, warmth: 0.5, formality: 0.6,
      craft: 0.8, experimentalism: 0.35, motionIntensity: 0.2,
      layoutVariance: 0.35, materiality: 0.35, contrastPreference: 0.75,
    },
  },
};

const NEUTRAL = 0.5;

// FNV-1a-ish small string hash → uint32. Deterministic, no Math.random.
function hashToUint32(str) {
  let h = 0x811c9dc5;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function deriveSeed(intent) {
  if (typeof intent.seed === "number" && Number.isFinite(intent.seed)) return intent.seed;
  const variation = Number.isFinite(Number(intent.variation)) ? Number(intent.variation) : 0;
  if (intent.nonce != null) return hashToUint32(`${variation}:${intent.nonce}`);
  return hashToUint32(`variation:${variation}`);
}

function priorsFor(surface, job) {
  const bySurface = SURFACE_JOB_PRIORS[surface];
  if (!bySurface) return null;
  const base = bySurface.default || {};
  const jobOverride = job && bySurface[job] ? bySurface[job] : {};
  return { ...base, ...jobOverride };
}

/**
 * resolveIntent(intent) → { intent: normalized, seed, warnings }
 * Pure, deterministic. Never throws — contradictions and unknown surfaces become warnings.
 */
export function resolveIntent(intent = {}) {
  const warnings = [];
  const surface = intent.surface != null ? String(intent.surface) : undefined;
  const job = intent.job != null ? String(intent.job) : undefined;

  const priors = priorsFor(surface, job);
  if (surface && !priors) {
    warnings.push(`unknown surface "${surface}" — using neutral (0.5) dial defaults`);
  }

  const normalized = {
    surface,
    job,
    audience: Array.isArray(intent.audience) ? intent.audience : [],
    contentModel: intent.contentModel != null ? String(intent.contentModel) : undefined,
    theme: intent.theme === "dark" ? "dark" : intent.theme === "light" ? "light" : "light",
    references: Array.isArray(intent.references) ? intent.references : [],
    variation: Number.isFinite(Number(intent.variation)) ? Math.trunc(Number(intent.variation)) : 0,
    seed: typeof intent.seed === "number" && Number.isFinite(intent.seed) ? intent.seed : null,
    sourceBrief: intent.sourceBrief != null ? String(intent.sourceBrief) : "",
  };

  for (const dial of DIALS) {
    const raw = intent[dial];
    if (raw === null || raw === undefined || raw === "") {
      const fromPriors = priors && priors[dial] != null ? priors[dial] : NEUTRAL;
      normalized[dial] = clamp01(fromPriors, NEUTRAL);
    } else {
      normalized[dial] = clamp01(raw, priors && priors[dial] != null ? priors[dial] : NEUTRAL);
    }
  }

  // Contradiction detection — never throws, just warns.
  if (normalized.craft > 0.8 && normalized.era < 0.15 && normalized.experimentalism > 0.85) {
    warnings.push("high craft + very-low era + very-high experimentalism — contradictory: verify intent (extreme novelty rarely reads as high-craft/heritage)");
  }
  if (normalized.contentDensity > 0.8 && normalized.motionIntensity > 0.7) {
    warnings.push("high contentDensity + high motionIntensity — contradictory: dense layouts with heavy motion hurt scanability");
  }
  if (normalized.theme === "dark" && normalized.contrastPreference < 0.3) {
    warnings.push("dark theme + low contrastPreference — contradictory: dark surfaces need higher contrast to stay legible");
  }

  const seed = deriveSeed({ ...intent, variation: normalized.variation });

  return { intent: normalized, seed, warnings };
}
