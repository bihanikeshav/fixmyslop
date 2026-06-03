/**
 * The "prescription" side: what we hand out instead of a vanity score.
 *
 *  - diagnoseImprovements(): point out the generic patterns on a site (actionable).
 *  - FONT_GROUPS: curated, cohesive font *pairings* (hero + body + accent), all
 *    real Google Fonts drawn from the under-saturated / model-vouched-fresh pool.
 *  - FRESH_PALETTES: real color palettes that dodge BOTH the indigo default AND
 *    the warm-terracotta escape AND each vibe's measured default.
 */

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
