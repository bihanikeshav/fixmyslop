/**
 * Scrape the getdesign.md reference corpus — curated big-brand design analyses.
 *
 * Each brand page has a "DESIGN.md" tab button. We click it, then extract the
 * full text (frontmatter + prose). Tokens (colors, fonts) are regex-parsed from
 * the YAML frontmatter block.
 *
 * Output:
 *   data/reference/getdesign/<slug>.md   — full analysis text
 *   data/reference/getdesign/index.json  — [{slug, name, category, descriptor, url, colors, fonts}]
 *
 * Usage:
 *   npx tsx packages/crawl/src/scrape-getdesign.ts
 */

import { chromium, type Browser, type Page } from "playwright";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(HERE, "../../../data/reference/getdesign");
const BASE_URL = "https://getdesign.md";
const DELAY_MS = 1200; // polite delay between fetches

// ─── Brand catalogue ──────────────────────────────────────────────────────────
// Enumerated from the index page (73 brands). slug = URL path segment.
interface BrandEntry {
  slug: string;
  name: string;
  category: string;
  descriptor: string;
  url: string;
}

const BRANDS: BrandEntry[] = [
  { slug: "bmw-m",        name: "BMW M",          category: "Automotive",       descriptor: "Motorsport automotive. Pure black canvas, M tricolor stripe accents",        url: `${BASE_URL}/bmw-m/design-md` },
  { slug: "dell-1996",    name: "Dell (1996)",     category: "Consumer",         descriptor: "Catalog-era PC retail design",                                              url: `${BASE_URL}/dell-1996/design-md` },
  { slug: "hp",           name: "HP",              category: "Consumer",         descriptor: "Consumer electronics with electric blue accents",                           url: `${BASE_URL}/hp/design-md` },
  { slug: "nintendo-2001",name: "Nintendo (2001)", category: "Consumer",         descriptor: "Y2K console chrome aesthetic",                                              url: `${BASE_URL}/nintendo-2001/design-md` },
  { slug: "airbnb",       name: "Airbnb",          category: "Travel",           descriptor: "Warm coral accent, photography-driven",                                     url: `${BASE_URL}/airbnb/design-md` },
  { slug: "airtable",     name: "Airtable",        category: "Productivity",     descriptor: "Spreadsheet-database hybrid. Colorful, friendly",                          url: `${BASE_URL}/airtable/design-md` },
  { slug: "apple",        name: "Apple",           category: "Consumer",         descriptor: "Premium white space, SF Pro, cinematic imagery",                           url: `${BASE_URL}/apple/design-md` },
  { slug: "binance",      name: "Binance",         category: "Fintech",          descriptor: "Bold yellow accent on monochrome",                                         url: `${BASE_URL}/binance/design-md` },
  { slug: "bmw",          name: "BMW",             category: "Automotive",       descriptor: "Luxury automotive. Dark premium surfaces",                                  url: `${BASE_URL}/bmw/design-md` },
  { slug: "bugatti",      name: "Bugatti",         category: "Automotive",       descriptor: "Cinema-black canvas, monochrome austerity",                                url: `${BASE_URL}/bugatti/design-md` },
  { slug: "cal",          name: "Cal.com",         category: "Developer Tools",  descriptor: "Clean neutral UI, developer-oriented",                                     url: `${BASE_URL}/cal/design-md` },
  { slug: "claude",       name: "Claude",          category: "AI/LLM",          descriptor: "Warm terracotta accent, clean editorial",                                  url: `${BASE_URL}/claude/design-md` },
  { slug: "clay",         name: "Clay",            category: "Design Tools",     descriptor: "Organic shapes, soft gradients",                                           url: `${BASE_URL}/clay/design-md` },
  { slug: "clickhouse",   name: "ClickHouse",      category: "Backend/Database", descriptor: "Yellow-accented, technical documentation",                                 url: `${BASE_URL}/clickhouse/design-md` },
  { slug: "cohere",       name: "Cohere",          category: "AI/LLM",          descriptor: "Vibrant gradients, data-rich dashboard",                                   url: `${BASE_URL}/cohere/design-md` },
  { slug: "coinbase",     name: "Coinbase",        category: "Fintech",          descriptor: "Clean blue identity, trust-focused",                                       url: `${BASE_URL}/coinbase/design-md` },
  { slug: "composio",     name: "Composio",        category: "Developer Tools",  descriptor: "Modern dark with colorful icons",                                          url: `${BASE_URL}/composio/design-md` },
  { slug: "cursor",       name: "Cursor",          category: "Developer Tools",  descriptor: "Sleek dark interface, gradient accents",                                   url: `${BASE_URL}/cursor/design-md` },
  { slug: "elevenlabs",   name: "ElevenLabs",      category: "AI/LLM",          descriptor: "Dark cinematic UI, audio-waveform",                                        url: `${BASE_URL}/elevenlabs/design-md` },
  { slug: "expo",         name: "Expo",            category: "Developer Tools",  descriptor: "Dark theme, tight letter-spacing",                                         url: `${BASE_URL}/expo/design-md` },
  { slug: "ferrari",      name: "Ferrari",         category: "Automotive",       descriptor: "Chiaroscuro editorial, Ferrari Red accents",                               url: `${BASE_URL}/ferrari/design-md` },
  { slug: "figma",        name: "Figma",           category: "Design Tools",     descriptor: "Vibrant multi-color, playful yet professional",                            url: `${BASE_URL}/figma/design-md` },
  { slug: "framer",       name: "Framer",          category: "Design Tools",     descriptor: "Bold black and blue, motion-first",                                        url: `${BASE_URL}/framer/design-md` },
  { slug: "hashicorp",    name: "HashiCorp",       category: "Backend/DevOps",   descriptor: "Enterprise-clean, black and white",                                        url: `${BASE_URL}/hashicorp/design-md` },
  { slug: "ibm",          name: "IBM",             category: "Backend/DevOps",   descriptor: "Carbon design system, structured blue",                                    url: `${BASE_URL}/ibm/design-md` },
  { slug: "intercom",     name: "Intercom",        category: "Productivity",     descriptor: "Friendly blue palette, conversational UI",                                 url: `${BASE_URL}/intercom/design-md` },
  { slug: "kraken",       name: "Kraken",          category: "Fintech",          descriptor: "Purple-accented dark UI, data-dense",                                      url: `${BASE_URL}/kraken/design-md` },
  { slug: "lamborghini",  name: "Lamborghini",     category: "Automotive",       descriptor: "True black surfaces, gold accents",                                        url: `${BASE_URL}/lamborghini/design-md` },
  { slug: "linear.app",   name: "Linear",          category: "Productivity",     descriptor: "Ultra-minimal, precise, purple accent",                                    url: `${BASE_URL}/linear.app/design-md` },
  { slug: "lovable",      name: "Lovable",         category: "AI/LLM",          descriptor: "Playful gradients, friendly dev aesthetic",                                url: `${BASE_URL}/lovable/design-md` },
  { slug: "mastercard",   name: "Mastercard",      category: "Fintech",          descriptor: "Warm cream canvas, orbital pill shapes",                                   url: `${BASE_URL}/mastercard/design-md` },
  { slug: "meta",         name: "Meta",            category: "Media/Consumer",   descriptor: "Photography-first, Meta Blue CTAs",                                       url: `${BASE_URL}/meta/design-md` },
  { slug: "minimax",      name: "MiniMax",         category: "AI/LLM",          descriptor: "Bold dark interface with neon accents",                                    url: `${BASE_URL}/minimax/design-md` },
  { slug: "mintlify",     name: "Mintlify",        category: "Developer Tools",  descriptor: "Clean, green-accented, reading-optimized",                                 url: `${BASE_URL}/mintlify/design-md` },
  { slug: "miro",         name: "Miro",            category: "Productivity",     descriptor: "Bright yellow accent, infinite canvas",                                    url: `${BASE_URL}/miro/design-md` },
  { slug: "mistral.ai",   name: "Mistral AI",      category: "AI/LLM",          descriptor: "French-engineered minimalism, purple-toned",                              url: `${BASE_URL}/mistral.ai/design-md` },
  { slug: "mongodb",      name: "MongoDB",         category: "Backend/Database", descriptor: "Green leaf branding, developer focus",                                     url: `${BASE_URL}/mongodb/design-md` },
  { slug: "nike",         name: "Nike",            category: "Retail",           descriptor: "Monochrome UI, massive uppercase type",                                    url: `${BASE_URL}/nike/design-md` },
  { slug: "notion",       name: "Notion",          category: "Productivity",     descriptor: "Warm minimalism, serif headings",                                          url: `${BASE_URL}/notion/design-md` },
  { slug: "nvidia",       name: "NVIDIA",          category: "Backend/DevOps",   descriptor: "Green-black energy, technical power",                                      url: `${BASE_URL}/nvidia/design-md` },
  { slug: "ollama",       name: "Ollama",          category: "AI/LLM",          descriptor: "Terminal-first, monochrome simplicity",                                    url: `${BASE_URL}/ollama/design-md` },
  { slug: "opencode.ai",  name: "OpenCode",        category: "Developer Tools",  descriptor: "Developer-centric dark theme",                                             url: `${BASE_URL}/opencode.ai/design-md` },
  { slug: "pinterest",    name: "Pinterest",       category: "Media/Consumer",   descriptor: "Red accent, masonry grid, image-first",                                   url: `${BASE_URL}/pinterest/design-md` },
  { slug: "playstation",  name: "PlayStation",     category: "Media/Consumer",   descriptor: "Three-surface channel layout, cyan hover",                                url: `${BASE_URL}/playstation/design-md` },
  { slug: "posthog",      name: "PostHog",         category: "Developer Tools",  descriptor: "Playful hedgehog branding, dark UI",                                       url: `${BASE_URL}/posthog/design-md` },
  { slug: "raycast",      name: "Raycast",         category: "Productivity",     descriptor: "Sleek dark chrome, vibrant accents",                                       url: `${BASE_URL}/raycast/design-md` },
  { slug: "renault",      name: "Renault",         category: "Automotive",       descriptor: "Vibrant aurora gradients, bold energy",                                    url: `${BASE_URL}/renault/design-md` },
  { slug: "replicate",    name: "Replicate",       category: "AI/LLM",          descriptor: "Clean white canvas, code-forward",                                         url: `${BASE_URL}/replicate/design-md` },
  { slug: "resend",       name: "Resend",          category: "Developer Tools",  descriptor: "Minimal dark theme, monospace accents",                                    url: `${BASE_URL}/resend/design-md` },
  { slug: "revolut",      name: "Revolut",         category: "Fintech",          descriptor: "Sleek dark interface, gradient cards",                                     url: `${BASE_URL}/revolut/design-md` },
  { slug: "runwayml",     name: "Runway",          category: "Media/Consumer",   descriptor: "Cinematic dark UI, media-rich layout",                                    url: `${BASE_URL}/runwayml/design-md` },
  { slug: "sanity",       name: "Sanity",          category: "Backend/DevOps",   descriptor: "Red accent, content-first editorial",                                      url: `${BASE_URL}/sanity/design-md` },
  { slug: "sentry",       name: "Sentry",          category: "Backend/DevOps",   descriptor: "Dark dashboard, pink-purple accent",                                       url: `${BASE_URL}/sentry/design-md` },
  { slug: "shopify",      name: "Shopify",         category: "E-commerce",       descriptor: "Dark-first cinematic, neon green accent",                                  url: `${BASE_URL}/shopify/design-md` },
  { slug: "spacex",       name: "SpaceX",          category: "Media/Consumer",   descriptor: "Stark black and white, full-bleed imagery",                               url: `${BASE_URL}/spacex/design-md` },
  { slug: "spotify",      name: "Spotify",         category: "Media/Consumer",   descriptor: "Vibrant green on dark, bold type",                                        url: `${BASE_URL}/spotify/design-md` },
  { slug: "starbucks",    name: "Starbucks",       category: "Retail",           descriptor: "Four-tier green system, warm cream",                                       url: `${BASE_URL}/starbucks/design-md` },
  { slug: "stripe",       name: "Stripe",          category: "Fintech",          descriptor: "Signature purple gradients, weight-300 elegance",                          url: `${BASE_URL}/stripe/design-md` },
  { slug: "supabase",     name: "Supabase",        category: "Backend/Database", descriptor: "Dark emerald theme, code-first",                                           url: `${BASE_URL}/supabase/design-md` },
  { slug: "superhuman",   name: "Superhuman",      category: "Productivity",     descriptor: "Premium dark UI, keyboard-first",                                          url: `${BASE_URL}/superhuman/design-md` },
  { slug: "tesla",        name: "Tesla",           category: "Automotive",       descriptor: "Radical subtraction, full-viewport photography",                           url: `${BASE_URL}/tesla/design-md` },
  { slug: "theverge",     name: "The Verge",       category: "Media/Consumer",   descriptor: "Acid-mint and ultraviolet accents",                                       url: `${BASE_URL}/theverge/design-md` },
  { slug: "together.ai",  name: "Together AI",     category: "AI/LLM",          descriptor: "Technical, blueprint-style design",                                        url: `${BASE_URL}/together.ai/design-md` },
  { slug: "uber",         name: "Uber",            category: "Retail",           descriptor: "Bold black and white, tight type",                                         url: `${BASE_URL}/uber/design-md` },
  { slug: "vercel",       name: "Vercel",          category: "Developer Tools",  descriptor: "Black and white precision, Geist font",                                    url: `${BASE_URL}/vercel/design-md` },
  { slug: "vodafone",     name: "Vodafone",        category: "Retail",           descriptor: "Monumental uppercase, Vodafone Red",                                       url: `${BASE_URL}/vodafone/design-md` },
  { slug: "voltagent",    name: "VoltAgent",       category: "Developer Tools",  descriptor: "Void-black canvas, emerald accent",                                        url: `${BASE_URL}/voltagent/design-md` },
  { slug: "warp",         name: "Warp",            category: "Developer Tools",  descriptor: "Dark IDE-like interface, block-based",                                     url: `${BASE_URL}/warp/design-md` },
  { slug: "webflow",      name: "Webflow",         category: "Design Tools",     descriptor: "Blue-accented, polished marketing",                                        url: `${BASE_URL}/webflow/design-md` },
  { slug: "wired",        name: "WIRED",           category: "Media/Consumer",   descriptor: "Paper-white broadsheet density, serif display",                           url: `${BASE_URL}/wired/design-md` },
  { slug: "wise",         name: "Wise",            category: "Fintech",          descriptor: "Bright green accent, friendly and clear",                                  url: `${BASE_URL}/wise/design-md` },
  { slug: "x.ai",         name: "xAI",             category: "AI/LLM",          descriptor: "Stark monochrome, futuristic minimalism",                                  url: `${BASE_URL}/x.ai/design-md` },
  { slug: "zapier",       name: "Zapier",          category: "Productivity",     descriptor: "Warm orange, friendly illustration-driven",                                url: `${BASE_URL}/zapier/design-md` },
];

// ─── Token extraction helpers ─────────────────────────────────────────────────

/** Extract all #rrggbb and #rrr hex codes from the text. */
function extractColors(text: string): string[] {
  const seen = new Set<string>();
  // Match hex in YAML values: "#533afd", #fff, etc.
  const matches = text.matchAll(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g);
  for (const m of matches) {
    const hex = m[0].toLowerCase();
    // Expand 3-digit to 6-digit
    const full = hex.length === 4
      ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
      : hex;
    seen.add(full);
  }
  return [...seen];
}

const GENERIC_FAMILIES = /^(sans-serif|serif|monospace|system-ui|ui-sans-serif|ui-serif|ui-monospace|-apple-system|blinkmacsystemfont|cursive|fantasy|inherit|initial|revert|unset)$/i;

/** Process a font stack string and add non-generic names to `seen`. */
function addFontStack(stack: string, seen: Set<string>): void {
  // Stack may contain comma-separated items, each optionally quoted
  const parts = stack.split(",").map((f) => f.trim().replace(/^['"]|['"]$/g, ""));
  for (const f of parts) {
    if (f && !GENERIC_FAMILIES.test(f)) {
      seen.add(f);
    }
  }
}

/** Extract font family names from the YAML frontmatter typography section. */
function extractFonts(text: string): string[] {
  const seen = new Set<string>();

  // Generic helper: parse any fontFamily: <value> line
  function parseFontFamilyLine(value: string): void {
    // Strip outer double or single quotes (but keep inner ones)
    let v = value.trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    addFontStack(v, seen);
  }

  // ── YAML-style ────────────────────────────────────────────────────────────

  // Match fontFamily: <rest-of-line>
  for (const m of text.matchAll(/fontFamily:\s*([^\n]+)/g)) {
    parseFontFamilyLine(m[1]);
  }

  // Match font-family: <rest-of-line> (kebab variant)
  for (const m of text.matchAll(/font-family:\s*([^\n]+)/g)) {
    parseFontFamilyLine(m[1]);
  }

  // ── Markdown-prose font mentions ──────────────────────────────────────────
  // Only run these noisier heuristics when the YAML fontFamily: approach found nothing,
  // to avoid polluting clean YAML-based brands with table-header false positives.
  if (seen.size === 0) {
    // Pattern: "uses FontName" / "font is FontName" / "FontName font"
    const proseFontPatterns = [
      /(?:uses?|using|family is|font(?:face)?(?:\s+is)?|typeface(?:\s+is)?)\s+([A-Z][A-Za-z0-9][A-Za-z0-9\s\-]*?)(?:\s+(?:font|typeface|VF|Display|Text|Regular|Bold|Black)|,|\.|—|\()/g,
      /([A-Z][A-Za-z0-9]+(?:Mix|Sans|Serif|Mono|Display|Text|UI|VF|Grotesk|Neue|Pro|Cereal|Circular|Sohne|Geist|Type|Inter)[A-Za-z0-9]*)/g,
    ];
    for (const pat of proseFontPatterns) {
      for (const m of text.matchAll(pat)) {
        const candidate = m[1].trim();
        if (
          candidate.length > 2 &&
          candidate.length < 60 &&
          !GENERIC_FAMILIES.test(candidate) &&
          !/^(Design|System|Visual|Brand|Color|Button|Section|Feature|Product|Image|Icon|Layout|Preview|Live|Copy|Download|Get|Run|Ask|Every|Note|The|This|That|Use|When|If|For|A|An|On|In|At|By|To|Background|Surface|Text|Spacing|Grid|Gradient)$/.test(candidate)
        ) {
          seen.add(candidate);
        }
      }
    }

    // Backtick-quoted font names only when no YAML tokens found
    for (const m of text.matchAll(/`([A-Z][A-Za-z0-9\s\-]+)`/g)) {
      const candidate = m[1].trim();
      if (/^[A-Z]/.test(candidate) && !/[{}:;=@#]/.test(candidate) && candidate.length < 50) {
        if (!GENERIC_FAMILIES.test(candidate) && !/^(Design|System|Color|Button|Section|Feature|Background)$/.test(candidate)) {
          addFontStack(candidate, seen);
        }
      }
    }
  }

  // Final cleanup: remove entries that are clearly not font names
  // (contain spaces + common English words, are too long, etc.)
  const cleaned = new Set<string>();
  for (const f of seen) {
    // Skip if contains " and " (conjunction) — likely a prose clause
    if (/ and /i.test(f)) continue;
    // Skip if it contains words like "decoratively", "backgrounds", "platform", etc.
    if (/decorative|platform|background|hover|active|pressed|gradient|globally|spacing|tracking|weight|design|system|visual|brand|image|icon|layout|preview|live|copy|download|get|run|ask|every|note/i.test(f)) continue;
    // Skip if it's too long (> 50 chars) — probably a sentence fragment
    if (f.length > 50) continue;
    // Skip "OpenType" (a format, not a font family)
    if (/^OpenType$/i.test(f)) continue;
    cleaned.add(f);
  }
  return [...cleaned];
}

// ─── Page scraping ────────────────────────────────────────────────────────────

async function scrapeBrand(
  browser: Browser,
  brand: BrandEntry,
): Promise<{ content: string; colors: string[]; fonts: string[] } | null> {
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    viewport: { width: 1366, height: 900 },
  });

  // Block images/media/fonts for speed; keep JS+CSS (needed for tab interaction)
  await context.route("**/*", (route) => {
    const type = route.request().resourceType();
    if (type === "image" || type === "media" || type === "font") return route.abort();
    return route.continue();
  });

  const page = await context.newPage();
  try {
    await page.goto(brand.url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(1500); // let React/Next render

    // Click the "DESIGN.md" tab button to reveal the full analysis
    const clicked = await page.evaluate(() => {
      var buttons = Array.from(document.querySelectorAll("button"));
      var tab = buttons.find(function (b) {
        return b.textContent !== null && b.textContent.trim() === "DESIGN.md";
      });
      if (tab) {
        tab.click();
        return true;
      }
      return false;
    });

    if (!clicked) {
      console.warn(`  [warn] ${brand.slug}: DESIGN.md tab not found`);
    }

    // Wait for the DESIGN.md content to appear — poll for "---\nversion:" or
    // "---\nname:" in the page text, up to 5 seconds, then fall back to a
    // fixed 2s wait (some older entries use markdown headings, not frontmatter).
    let bodyText = "";
    let found = false;
    for (let attempt = 0; attempt < 10; attempt++) {
      await page.waitForTimeout(500);
      bodyText = await page.evaluate(() => document.body.innerText);
      // Check for YAML frontmatter markers (the definitive sign the tab rendered)
      if (/---\s*\nversion:/.test(bodyText) || /---\s*\nname:/.test(bodyText)) {
        found = true;
        break;
      }
      // If the page has "version: alpha" but maybe the --- separator is on same line
      if (/version:\s*alpha/.test(bodyText)) {
        found = true;
        break;
      }
      // Also accept markdown-header format (some brands use this instead of YAML)
      if (/^# Design System/m.test(bodyText) && /fontFamily|font-family|SpotifyMixUI|CircularSp/i.test(bodyText)) {
        found = true;
        break;
      }
    }

    if (!found) {
      // One last grab after 2s regardless
      await page.waitForTimeout(2000);
      bodyText = await page.evaluate(() => document.body.innerText);
    }

    // Extract the section between the first "---" pair (YAML frontmatter) through
    // the end of the prose, stopping before the footer navigation.
    const content = extractDesignContent(bodyText, brand.name);

    if (!content || content.length < 200) {
      console.warn(`  [warn] ${brand.slug}: content too short (${content?.length ?? 0} chars)`);
      return null;
    }

    const colors = extractColors(content);
    const fonts = extractFonts(content);

    return { content, colors, fonts };
  } catch (err) {
    console.error(`  [error] ${brand.slug}: ${(err as Error).message.slice(0, 200)}`);
    return null;
  } finally {
    await context.close();
  }
}

/**
 * From raw innerText, extract the meaningful design-analysis content.
 * The page structure is:
 *   <nav header> ... DESIGN.md <tab click> ... <yaml frontmatter> ... <prose> ... <footer>
 */
function extractDesignContent(bodyText: string, brandName: string): string {
  const footerMarkers = [
    "\nMaintained by VoltAgent",
    "\ngetdesign.md\nAbout",
    "\nAbout\nTerms\nPrivacy",
  ];

  function trimFooter(s: string): string {
    for (const marker of footerMarkers) {
      const idx = s.indexOf(marker);
      if (idx !== -1) return s.slice(0, idx).trim();
    }
    return s.trim();
  }

  // The content starts at the first "---" (YAML frontmatter delimiter)
  const fmStart = bodyText.indexOf("---\n");
  if (fmStart === -1) {
    // Some brands use markdown headers (no YAML frontmatter).
    // Look for "# Design System" or "Copy\n" as the start of the design content.
    const copyIdx = bodyText.indexOf("\nCopy\n");
    if (copyIdx !== -1) {
      return trimFooter(bodyText.slice(copyIdx + "\nCopy\n".length));
    }
    const mdHeadIdx = bodyText.search(/\n#\s+Design System/);
    if (mdHeadIdx !== -1) {
      return trimFooter(bodyText.slice(mdHeadIdx));
    }
    // Last fallback: brand name paragraph
    const descStart = bodyText.indexOf(brandName);
    if (descStart === -1) return trimFooter(bodyText);
    return trimFooter(bodyText.slice(descStart));
  }

  // Trim at the footer
  return trimFooter(bodyText.slice(fmStart));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface IndexEntry {
  slug: string;
  name: string;
  category: string;
  descriptor: string;
  url: string;
  colors: string[];
  fonts: string[];
}

async function reindexFromSavedFiles(): Promise<void> {
  console.log("\nRe-indexing tokens from saved .md files (no network)...\n");
  const indexPath = resolve(DATA_DIR, "index.json");
  const rebuildIndex: IndexEntry[] = [];

  for (const brand of BRANDS) {
    const mdPath = resolve(DATA_DIR, `${brand.slug}.md`);
    if (!existsSync(mdPath)) {
      console.warn(`  [missing] ${brand.slug}.md`);
      continue;
    }
    const content = await readFile(mdPath, "utf8");
    const colors = extractColors(content);
    const fonts = extractFonts(content);
    rebuildIndex.push({
      slug: brand.slug,
      name: brand.name,
      category: brand.category,
      descriptor: brand.descriptor,
      url: brand.url,
      colors,
      fonts,
    });
    console.log(`  ${brand.name.padEnd(20)}  colors=${colors.length}  fonts=${fonts.length}`);
  }

  await writeFile(indexPath, JSON.stringify(rebuildIndex, null, 2), "utf8");
  console.log(`\nWrote index.json with ${rebuildIndex.length} entries.`);
  await printSummary(rebuildIndex);
}

async function main(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });

  // --reindex: re-parse tokens from already-saved .md files, no network
  if (process.argv.includes("--reindex")) {
    await reindexFromSavedFiles();
    return;
  }

  // Load any existing index so we can resume partial runs
  const indexPath = resolve(DATA_DIR, "index.json");
  const existingIndex: IndexEntry[] = [];
  if (existsSync(indexPath)) {
    try {
      const raw = await readFile(indexPath, "utf8");
      existingIndex.push(...(JSON.parse(raw) as IndexEntry[]));
    } catch { /* start fresh */ }
  }
  const alreadyDone = new Set(existingIndex.map((e) => e.slug));

  const todo = BRANDS.filter((b) => !alreadyDone.has(b.slug));
  console.log(`\ngetdesign.md scraper`);
  console.log(`  Total brands : ${BRANDS.length}`);
  console.log(`  Already done : ${alreadyDone.size}`);
  console.log(`  To fetch     : ${todo.length}`);
  console.log();

  if (todo.length === 0) {
    console.log("Nothing to do — all brands already scraped. Use --reindex to rebuild tokens.");
    await printSummary(existingIndex);
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const newEntries: IndexEntry[] = [];
  let successCount = 0;
  let failCount = 0;

  try {
    for (let i = 0; i < todo.length; i++) {
      const brand = todo[i];
      const progress = `[${i + 1}/${todo.length}]`;
      process.stdout.write(`${progress} ${brand.name.padEnd(20)} `);

      const result = await scrapeBrand(browser, brand);

      if (result) {
        const mdPath = resolve(DATA_DIR, `${brand.slug}.md`);
        await writeFile(mdPath, result.content, "utf8");

        const entry: IndexEntry = {
          slug: brand.slug,
          name: brand.name,
          category: brand.category,
          descriptor: brand.descriptor,
          url: brand.url,
          colors: result.colors,
          fonts: result.fonts,
        };
        newEntries.push(entry);
        existingIndex.push(entry);

        console.log(
          `✓  colors=${result.colors.length}  fonts=${result.fonts.length}  chars=${result.content.length}`,
        );
        successCount++;
      } else {
        console.log(`✗  failed`);
        failCount++;
      }

      // Save index after every brand so progress is preserved on crash
      await writeFile(indexPath, JSON.stringify(existingIndex, null, 2), "utf8");

      // Polite delay between requests (skip after last)
      if (i < todo.length - 1) {
        await new Promise((r) => setTimeout(r, DELAY_MS));
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`\n─── Summary ───────────────────────────────────────────────`);
  console.log(`  Captured this run : ${successCount}/${todo.length}`);
  console.log(`  Failed this run   : ${failCount}`);
  console.log(`  Total in index    : ${existingIndex.length}/${BRANDS.length}`);

  await printSummary(existingIndex);
}

async function printSummary(index: IndexEntry[]): Promise<void> {
  // Categories
  const categories = new Map<string, number>();
  for (const e of index) {
    categories.set(e.category, (categories.get(e.category) ?? 0) + 1);
  }
  console.log(`\n  Categories:`);
  for (const [cat, count] of [...categories.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${count.toString().padStart(2)}  ${cat}`);
  }

  // Brands with usable tokens (has at least 1 color AND 1 font)
  const withTokens = index.filter((e) => e.colors.length > 0 && e.fonts.length > 0);
  console.log(`\n  Brands with usable tokens : ${withTokens.length}/${index.length}`);

  // Sample brand (Stripe)
  const sample = index.find((e) => e.slug === "stripe") ?? index[0];
  if (sample) {
    console.log(`\n  Sample brand: ${sample.name}`);
    console.log(`    Colors (${sample.colors.length}): ${sample.colors.slice(0, 8).join(", ")}${sample.colors.length > 8 ? " …" : ""}`);
    console.log(`    Fonts  (${sample.fonts.length}): ${sample.fonts.slice(0, 5).join(", ")}${sample.fonts.length > 5 ? " …" : ""}`);
  }

  console.log(`\n  Output directory: data/reference/getdesign/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
