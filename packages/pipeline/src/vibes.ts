/**
 * Exhaustive taxonomy of website "vibes" — the themes we sample model font
 * defaults across. Spans industry x aesthetic register so the synthetic signal
 * isn't biased toward one corner (e.g. only SaaS).
 *
 * Each vibe carries a prompt-ready description used verbatim in the sampling
 * prompts, and a primary aesthetic register for later cross-tabulation.
 */

export type AestheticRegister =
  | "clean-modern"
  | "technical"
  | "elegant-editorial"
  | "bold-expressive"
  | "warm-human"
  | "playful"
  | "edgy-futuristic"
  | "retro-nostalgic"
  | "minimal-refined";

export interface Vibe {
  id: string;
  label: string;
  /** Inlined into the sampling prompt as "...for {description}". */
  description: string;
  register: AestheticRegister;
}

export const VIBES: readonly Vibe[] = [
  // — Software / tech —
  { id: "ai-saas", label: "AI SaaS product", description: "a cutting-edge AI SaaS product — sleek, modern, futuristic but trustworthy", register: "edgy-futuristic" },
  { id: "b2b-saas", label: "B2B SaaS", description: "a B2B SaaS platform for enterprises — clean, professional, credible", register: "clean-modern" },
  { id: "dev-tool", label: "Developer tool", description: "a developer tool / API platform — technical, precise, terminal-flavored", register: "technical" },
  { id: "data-dashboard", label: "Analytics dashboard", description: "a data analytics dashboard product — dense, functional, neutral", register: "clean-modern" },
  { id: "cybersecurity", label: "Cybersecurity", description: "a cybersecurity company — serious, sharp, high-trust", register: "technical" },
  { id: "web3-crypto", label: "Crypto / web3", description: "a crypto / web3 protocol — edgy, neon, techno-futuristic", register: "edgy-futuristic" },

  // — Finance / professional —
  { id: "fintech", label: "Fintech", description: "a consumer fintech / banking app — premium, secure, confident", register: "minimal-refined" },
  { id: "legal-services", label: "Legal services", description: "a law firm or legal services site — authoritative, conservative, established", register: "elegant-editorial" },
  { id: "consulting", label: "Consulting firm", description: "a management consulting firm — corporate, polished, serious", register: "clean-modern" },
  { id: "real-estate", label: "Real estate", description: "a high-end real estate / architecture studio — minimal, refined, spacious", register: "minimal-refined" },

  // — Commerce / brand —
  { id: "dtc-brand", label: "DTC brand", description: "a direct-to-consumer product brand — bold, friendly, approachable", register: "bold-expressive" },
  { id: "luxury-fashion", label: "Luxury fashion", description: "a luxury fashion house — elegant, editorial, high-contrast, refined", register: "elegant-editorial" },
  { id: "beauty-cosmetics", label: "Beauty / cosmetics", description: "a beauty and cosmetics brand — chic, delicate, aspirational", register: "elegant-editorial" },
  { id: "ecommerce-marketplace", label: "E-commerce marketplace", description: "a general e-commerce marketplace — clear, trustworthy, broad-appeal", register: "clean-modern" },
  { id: "food-restaurant", label: "Restaurant / food", description: "a restaurant or food brand — appetizing, characterful, inviting", register: "warm-human" },

  // — Editorial / media —
  { id: "magazine-editorial", label: "Editorial magazine", description: "an online magazine / editorial publication — literary, readable, sophisticated", register: "elegant-editorial" },
  { id: "news-media", label: "News / media", description: "a news and media outlet — dense, legible, authoritative", register: "clean-modern" },
  { id: "personal-blog", label: "Personal blog", description: "a personal blog or newsletter — warm, readable, personable", register: "warm-human" },
  { id: "documentation", label: "Docs / knowledge base", description: "a product documentation site — clean, functional, scannable", register: "technical" },

  // — Creative / culture —
  { id: "creative-portfolio", label: "Creative portfolio", description: "a designer or studio portfolio — expressive, artistic, statement-making", register: "bold-expressive" },
  { id: "design-agency", label: "Design agency", description: "a creative / branding agency — bold, confident, trend-aware", register: "bold-expressive" },
  { id: "music-artist", label: "Music / artist", description: "a musician or record label — energetic, expressive, atmospheric", register: "bold-expressive" },
  { id: "events-conference", label: "Event / conference", description: "a conference or live event — dynamic, modern, high-energy", register: "bold-expressive" },
  { id: "gaming-esports", label: "Gaming / esports", description: "a gaming or esports brand — aggressive, sharp, dynamic", register: "edgy-futuristic" },

  // — Human / lifestyle —
  { id: "health-wellness", label: "Health / wellness", description: "a health and wellness brand — calm, soft, reassuring", register: "warm-human" },
  { id: "healthcare-medical", label: "Healthcare / medical", description: "a healthcare or medical provider — trustworthy, clean, accessible", register: "clean-modern" },
  { id: "nonprofit", label: "Nonprofit", description: "a nonprofit or community cause — warm, human, sincere", register: "warm-human" },
  { id: "education", label: "Education / edtech", description: "an education or edtech product — friendly, clear, encouraging", register: "playful" },
  { id: "kids-family", label: "Kids / family", description: "a kids or family-oriented product — playful, rounded, fun", register: "playful" },
  { id: "travel-hospitality", label: "Travel / hospitality", description: "a travel or hospitality brand — aspirational, airy, inviting", register: "warm-human" },

  // — Aesthetic-led —
  { id: "retro-vintage", label: "Retro / vintage", description: "a retro or vintage-inspired brand — nostalgic, characterful, warm", register: "retro-nostalgic" },
  { id: "brutalist", label: "Brutalist / experimental", description: "a brutalist, experimental statement site — raw, bold, unconventional", register: "bold-expressive" },
  { id: "minimal-portfolio", label: "Minimal portfolio", description: "a minimal personal site — quiet, refined, typographic", register: "minimal-refined" },
];

export function vibeById(id: string): Vibe | undefined {
  return VIBES.find((v) => v.id === id);
}
