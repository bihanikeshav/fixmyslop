/**
 * The "prescription" side: what we hand out instead of a vanity score.
 *
 *  - diagnoseImprovements(): point out the generic patterns on a site (actionable).
 *  - FONT_GROUPS: curated, cohesive font *pairings* (hero + body + accent), all
 *    real Google Fonts drawn from the under-saturated / model-vouched-fresh pool.
 *  - FRESH_PALETTES: real color palettes that dodge BOTH the indigo default AND
 *    the warm-terracotta escape AND each vibe's measured default.
 *  - suggestReplacements(): deterministic "same vibe, fresher" font swaps.
 */

import { personalityMatch } from "./personality.js";

export interface Improvement {
  /** What's generic about it. */
  tell: string;
  /** What to do instead. */
  fix: string;
}

export interface StyleTells {
  aiPurpleGradient?: boolean;
  gradientText?: boolean;
  glassmorphism?: boolean;
  pillButtons?: boolean;
  heavyRounding?: boolean;
  uppercaseHeadings?: boolean;
  tightHeroTracking?: boolean;
}

export interface DiagnoseInput {
  heroFont: string | null;
  heroIsSlop: boolean;
  heroIsFoundational: boolean;
  bodyFont: string | null;
  bodyIsSlop: boolean;
  tells: StyleTells;
}

/** Deterministic: map detected slop signals to concrete improvements. */
export function diagnoseImprovements(input: DiagnoseInput): Improvement[] {
  const out: Improvement[] = [];
  const { heroFont, bodyFont, tells } = input;

  if (heroFont && (input.heroIsFoundational || input.heroIsSlop)) {
    out.push({
      tell: `Hero set in "${heroFont}" — one of the most over-used AI-default fonts.`,
      fix: "Swap the display face for something distinctive (see font groups below).",
    });
  }
  if (bodyFont && input.bodyIsSlop) {
    out.push({
      tell: `Body text in "${bodyFont}" — the universal AI default.`,
      fix: "Keep a clean body face, but pick a fresher one (Hanken Grotesk, Public Sans, Spline Sans).",
    });
  }
  if (tells.aiPurpleGradient) {
    out.push({ tell: "The AI indigo/violet gradient.", fix: "Drop the gradient for one flat, unexpected accent (acid lime, cobalt, plum)." });
  }
  if (tells.gradientText) {
    out.push({ tell: "Gradient-text heading.", fix: "Use solid heavy color, or a knockout on a color block." });
  }
  if (tells.glassmorphism) {
    out.push({ tell: "Glassmorphic blurred nav.", fix: "Use an opaque panel with a visible border or rule." });
  }
  if (tells.pillButtons) {
    out.push({ tell: "Fully-rounded pill buttons.", fix: "Use a sharper, intentional radius (or none)." });
  }
  if (tells.heavyRounding) {
    out.push({ tell: "Everything is rounded the same.", fix: "Mix in sharp corners; let radius mean something." });
  }
  if (tells.uppercaseHeadings && tells.tightHeroTracking) {
    out.push({ tell: "Uppercase + tight-tracked hero — the default 'bold SaaS' look.", fix: "Try real type contrast: a characterful display over a quiet body." });
  }
  return out;
}

/**
 * Like-for-like swap: given the font a site uses, find fresh fonts with a SIMILAR
 * vibe (personality) but more character and far lower saturation. Deterministic
 * nearest-neighbour in personality space, filtered by freshness. No LLM.
 */
export interface SwapCandidate {
  id: string;
  family: string;
  personality: import("./types.js").PersonalityVector;
  category: string;
  displaySaturation: number;
  /** Visual sub-style signals — keep a Didone matching Didones, not slabs. */
  strokeContrast?: number;
  xHeightRatio?: number;
}

export interface SwapSuggestion {
  family: string;
  similarity: number;
  saturation: number;
  reason: string;
}

export function suggestReplacements(
  target: { personality: import("./types.js").PersonalityVector; category: string; strokeContrast?: number; xHeightRatio?: number; family?: string },
  candidates: readonly SwapCandidate[],
  opts: { freshCutoff?: number; limit?: number } = {},
): SwapSuggestion[] {
  const freshCutoff = opts.freshCutoff ?? 0.35;
  const limit = opts.limit ?? 3;
  const hasPersonality = Object.keys(target.personality).length > 0;
  const targetBase = (target.family ?? "").toLowerCase().split(/\s+/)[0] ?? "";

  const scored = candidates
    // Same category only — a strong/bold *serif* must not be "replaced" by a
    // strong/bold *stencil*. Category is the coarse visual class personality misses.
    // Also exclude same-family variants (Inter -> "Inter Tight" is not a swap).
    .filter((c) => c.displaySaturation < freshCutoff && c.category === target.category &&
      (!targetBase || (c.family.toLowerCase().split(/\s+/)[0] ?? "") !== targetBase))
    .map((c) => {
      const sim = hasPersonality ? personalityMatch(target.personality, c.personality) : 0.6;
      const character = magnitude(c.personality);
      // Visual proximity: stroke contrast + x-height. Keeps Didone~Didone.
      const metricSim =
        target.strokeContrast !== undefined && c.strokeContrast !== undefined
          ? Math.max(0, 1 - (Math.abs(target.strokeContrast - c.strokeContrast) + 0.5 * Math.abs((target.xHeightRatio ?? 0.5) - (c.xHeightRatio ?? 0.5))))
          : 1;
      const score = sim * metricSim * (1 - c.displaySaturation) * (0.6 + 0.4 * character);
      return { c, sim, score };
    })
    .filter((x) => x.sim > 0.35)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map(({ c, sim }) => ({
    family: c.family,
    similarity: Math.round(sim * 100) / 100,
    saturation: Math.round(c.displaySaturation * 100) / 100,
    reason: `same vibe (${Math.round(sim * 100)}% personality match), far less common (saturation ${c.displaySaturation.toFixed(2)})`,
  }));
}

function magnitude(p: import("./types.js").PersonalityVector): number {
  const sum = Object.values(p).reduce((a, b) => a + (b ?? 0), 0);
  return Math.min(1, sum / 3);
}

/** Classify a site's accent color against the measured palette slop. Deterministic. */
export interface AccentVerdict {
  hex: string;
  family: string;
  status: "default-slop" | "escape-slop" | "vibe-default" | "fresh" | "neutral";
  note: string;
}

export function classifyAccent(hex: string): AccentVerdict {
  const n = hex.replace("#", "");
  if (n.length < 6) return { hex, family: "?", status: "neutral", note: "couldn't parse" };
  const r = parseInt(n.slice(0, 2), 16) / 255, g = parseInt(n.slice(2, 4), 16) / 255, b = parseInt(n.slice(4, 6), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  const lum = (mx + mn) / 2;
  const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * lum - 1));
  if (sat < 0.18 || lum < 0.06 || lum > 0.96) return { hex, family: "neutral", status: "neutral", note: "neutral — not really an accent" };
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = ((h * 60) + 360) % 360;

  if (h >= 200 && h < 300) return { hex, family: "blue/indigo", status: "default-slop", note: "the #1 AI-default accent (Tailwind blue/indigo) — the SaaS/dev/fintech default in our data" };
  if ((h >= 345 || h < 40) && sat > 0.45) return { hex, family: "warm red/coral", status: "escape-slop", note: "the most common 'de-slop escape' accent — still a tell" };
  if (h >= 40 && h < 60 && lum < 0.7) return { hex, family: "gold", status: "vibe-default", note: "the default 'luxury' accent" };
  if (h >= 90 && h < 160 && sat < 0.45) return { hex, family: "sage green", status: "vibe-default", note: "the default 'wellness' accent" };
  if (h >= 130 && h < 175 && sat > 0.6) return { hex, family: "neon green", status: "vibe-default", note: "the default 'gaming' accent" };
  return { hex, family: hueName(h), status: "fresh", note: "not a common AI default — good" };
}

function hueName(h: number): string {
  if (h < 18) return "red";
  if (h < 45) return "orange";
  if (h < 70) return "lime";
  if (h < 160) return "green";
  if (h < 200) return "teal";
  if (h < 300) return "blue";
  if (h < 330) return "magenta";
  return "pink";
}

export interface FontGroup {
  id: string;
  name: string;
  hero: string;
  body: string;
  accent?: string; // usually a mono or secondary face
  vibes: string[];
  mood: string;
  why: string;
}

/** Curated cohesive pairings. All real Google Fonts, all from the fresh pool. */
export const FONT_GROUPS: readonly FontGroup[] = [
  { id: "editorial-revival", name: "Editorial Revival", hero: "Fraunces", body: "Newsreader", vibes: ["magazine-editorial", "personal-blog", "premium"], mood: "warm editorial", why: "Soft-serif character without defaulting to Playfair." },
  { id: "brutalist-press", name: "Brutalist Press", hero: "Big Shoulders Display", body: "Hanken Grotesk", accent: "Martian Mono", vibes: ["bold", "creative-portfolio", "design-agency"], mood: "loud newsroom", why: "Condensed poster headline + clean grotesk + technical mono." },
  { id: "quiet-luxe", name: "Quiet Luxe", hero: "Marcellus", body: "Spectral", vibes: ["luxury-fashion", "beauty-cosmetics", "minimal"], mood: "refined, airy", why: "Roman caps elegance that isn't Cormorant/Playfair." },
  { id: "terminal-future", name: "Terminal Future", hero: "Tektur", body: "Public Sans", accent: "JetBrains Mono", vibes: ["dev-tool", "ai-saas", "gaming-esports"], mood: "techy, mechanical", why: "Blocky techno-display over a neutral civic sans." },
  { id: "pixel-punk", name: "Pixel Punk", hero: "Bitcount", body: "Hanken Grotesk", vibes: ["creative-portfolio", "gaming-esports", "retro-vintage"], mood: "rebellious", why: "A pixel/dot display — the literal opposite of a safe grotesk." },
  { id: "display-cut", name: "Display Cut", hero: "Unbounded", body: "Schibsted Grotesk", vibes: ["bold", "creative-portfolio", "events-conference"], mood: "geometric statement", why: "Heavy geometric voice with a crisp Scandinavian body." },
  { id: "modern-serif", name: "Modern Serif", hero: "Instrument Serif", body: "Spline Sans", vibes: ["unique", "magazine-editorial", "minimal-portfolio"], mood: "elegant, fresh", why: "High-contrast serif display, fresher than the Didone defaults." },
  { id: "esports-edge", name: "Esports Edge", hero: "Russo One", body: "Saira", vibes: ["gaming-esports", "events-conference"], mood: "aggressive", why: "Heavy techno display + condensed body, no Orbitron cliché." },
  { id: "gazette", name: "Gazette", hero: "Cinzel", body: "EB Garamond", vibes: ["luxury-fashion", "magazine-editorial"], mood: "classical", why: "Inscriptional caps over a workhorse garalde." },
  { id: "art-tech", name: "Art-Tech", hero: "Syne", body: "Hanken Grotesk", accent: "Syne Mono", vibes: ["ai-saas", "creative-portfolio", "design-agency"], mood: "art-world", why: "Wide art-school display + grotesk + matching mono." },
];

export interface Palette {
  id: string;
  name: string;
  background: string;
  surface: string;
  text: string;
  accent: string;
  accent2: string;
  avoids: string; // which measured slop default this dodges
  vibes: string[];
}

/** Real palettes that dodge the indigo default, the terracotta escape, and per-vibe defaults. */
export const FRESH_PALETTES: readonly Palette[] = [
  { id: "acid-lab", name: "Acid Lab", background: "#14140F", surface: "#1E1E16", text: "#ECE7D9", accent: "#C6F432", accent2: "#FF3D7F", avoids: "indigo-on-navy (AI SaaS default)", vibes: ["ai-saas", "dev-tool", "creative-portfolio"] },
  { id: "bone-cobalt", name: "Bone & Cobalt", background: "#F4EFE6", surface: "#FFFFFF", text: "#14140F", accent: "#1454FF", accent2: "#14140F", avoids: "Tailwind blue (deeper, flatter cobalt instead)", vibes: ["b2b-saas", "fintech", "education"] },
  { id: "plum-soda", name: "Plum Soda", background: "#FBF6EF", surface: "#FFFFFF", text: "#2A0E26", accent: "#5A1E50", accent2: "#C6F432", avoids: "coral + teal (DTC default)", vibes: ["dtc-brand", "education", "events-conference"] },
  { id: "dusty-calm", name: "Dusty Calm", background: "#EDE6D8", surface: "#F6F1E7", text: "#2C2A26", accent: "#7C6BB0", accent2: "#2C2A26", avoids: "sage green (wellness default)", vibes: ["health-wellness", "beauty-cosmetics"] },
  { id: "forest-luxe", name: "Forest Luxe", background: "#F2ECE0", surface: "#FFFFFF", text: "#14201C", accent: "#0E3B36", accent2: "#B08D57", avoids: "gold (luxury default)", vibes: ["luxury-fashion", "real-estate"] },
  { id: "ink-teal", name: "Ink & Teal", background: "#F2EBDD", surface: "#FFFFFF", text: "#14140F", accent: "#0E5C53", accent2: "#14140F", avoids: "oxblood/ink-red (editorial default)", vibes: ["magazine-editorial", "personal-blog"] },
  { id: "hi-vis", name: "Hi-Vis", background: "#121212", surface: "#1C1C1C", text: "#F2F2F2", accent: "#C6F432", accent2: "#FF1F6B", avoids: "neon-green-on-black (gaming default)", vibes: ["gaming-esports", "events-conference"] },
  { id: "fuchsia-ink", name: "Fuchsia Ink", background: "#FBF6EF", surface: "#FFFFFF", text: "#16121A", accent: "#FF1F6B", accent2: "#1454FF", avoids: "both indigo default and warm-terracotta escape", vibes: ["dtc-brand", "creative-portfolio", "music-artist"] },
];

export function fontGroupsForVibe(vibe?: string): FontGroup[] {
  if (!vibe) return [...FONT_GROUPS];
  const hit = FONT_GROUPS.filter((g) => g.vibes.includes(vibe));
  return hit.length ? hit : [...FONT_GROUPS];
}

export function palettesForVibe(vibe?: string): Palette[] {
  if (!vibe) return [...FRESH_PALETTES];
  const hit = FRESH_PALETTES.filter((p) => p.vibes.includes(vibe));
  return hit.length ? hit : [...FRESH_PALETTES];
}
