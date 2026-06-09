// reindex-getdesign-identity.mjs
//
// ROOT FIX for brand-attribution slop. The old pipeline dumped EVERY hex on a
// brand's page (neutrals, surfaces, link/info/success semantic tokens, chart
// blues) into `colors`, so the "≈ <Brand>'s color — you'd look like a clone"
// warning fired on non-identity colors (e.g. #3d4cb8 matched Airtable's
// `info: #254fad`). That made the "originator" rate meaningless.
//
// This script extracts the IDENTITY-ROLE colors only — the hues a brand would
// actually be cloned by — from the token NAMES, and writes them onto each
// index.json entry as `identityColors`. The greedy `colors` field is preserved
// for reference.
//
// Per brand:
//   - YAML `colors:` block (65 brands): parse key->hex. Keep a hex as IDENTITY
//     iff its key matches an INCLUDE role prefix (primary|brand|accent|signature
//     |cta|key|hero|voltage, incl. shade variants like primary-active,
//     accent-teal, signature-coral) AND none of its hyphen segments hits an
//     EXCLUDE token (surfaces, text, semantics, scales, etc.). Purely numeric
//     scale keys are dropped.
//   - Prose/table brands (8): take hexes that appear under a Brand / Brand &
//     Accent / Accent / Primary / (Secondary &) Accent section; ignore hexes
//     under Surface / Text / Neutral / Semantic / Elevation / Gradient etc.
//   - Drop NEUTRALS from the identity set (OKLCH chroma < 0.04) — a near-black
//     "primary" is not a clone-distinctive hue.
//
// Run: node viz/personality-test/color/reindex-getdesign-identity.mjs

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

import { hexToOklch } from "./color-space.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../../..");
const DIR = resolve(ROOT, "data/reference/getdesign");
const INDEX = join(DIR, "index.json");

const NEUTRAL_CHROMA = 0.04;

// ---------------------------------------------------------------------------
// Token role rules (operate on the key NAME).
// ---------------------------------------------------------------------------
// INCLUDE: a key whose first segment is one of these is an identity-role color.
const INCLUDE_PREFIX = /^(primary|brand|accent|signature|cta|key|hero|voltage)\b/;

// Some brands key their identity color by the COLOR NAME itself (e.g. Cohere's
// `coral: #ff7759`) instead of `accent-coral`. Accept a key whose first segment is
// a DISTINCTIVE chromatic color name. Deliberately EXCLUDES the ambiguous basics
// (red/green/blue/yellow/orange/purple/pink/brown + neutrals) that routinely double
// as semantic states (red=error, green=success) or generic scales — those were the
// source of the original pollution, so we don't re-admit them by name.
const COLOR_NAME_KEYS = new Set([
  "coral", "teal", "amber", "mint", "sage", "lavender", "magenta", "fuchsia",
  "crimson", "scarlet", "vermillion", "vermilion", "ochre", "ocher", "mustard",
  "peach", "apricot", "rose", "blush", "lime", "indigo", "violet", "cyan", "azure",
  "cobalt", "ultramarine", "gold", "olive", "plum", "mauve", "salmon", "turquoise",
  "emerald", "jade", "ruby", "sapphire", "lilac", "periwinkle", "maroon", "burgundy",
  "oxblood", "rust", "terracotta", "tangerine", "marigold", "chartreuse", "aqua",
  "aquamarine", "seafoam", "lemon", "honey", "copper", "bronze", "brass", "claret",
]);

// EXCLUDE tokens. Anchored at the start of the whole key (per spec) OR matching
// any hyphen-delimited segment of the key — so `accent-warning`, `brand-error`,
// `accent-blue-link`, `key-bg-start`, `hero-glow` are correctly rejected even
// though their first segment is an include-prefix. These are semantic / surface
// / structural roles, never clone-distinctive identity hues.
const EXCLUDE_TOKENS = new Set([
  "on", "canvas", "bg", "background", "ink", "body", "text", "muted", "subtle",
  "hairline", "border", "divider", "line", "ring", "shadow", "overlay", "scrim",
  "disabled", "placeholder", "link", "info", "success", "warning", "error",
  "danger", "positive", "negative", "caution", "neutral", "gray", "grey",
  "slate", "stone", "zinc", "code", "syntax", "chart", "data", "graph", "scale",
  "tier", "pricing", "nav", "footer", "focus",
  // semantic/structural roles that appear as include-prefixed shade variants:
  "warn", "secure", "glow", "soft", "pale", "deep", "dark", "elevated",
]);
// NOTE: a handful of shade qualifiers (soft/pale/deep/dark/elevated) are only
// excluded when they DON'T leave an identity hue — but for identity matching we
// keep them in EXCLUDE conservatively only via the dedicated checks below. To
// avoid over-pruning real hue variants like `accent-purple-deep` we DON'T treat
// pure shade qualifiers as disqualifying; remove them from the disqualifier set.
for (const t of ["soft", "pale", "deep", "dark", "elevated", "glow"]) EXCLUDE_TOKENS.delete(t);

// Hard EXCLUDE prefixes per the spec (anchored at the whole-key start).
const EXCLUDE_PREFIX = /^(on-|canvas|surface|bg|background|ink|body|text|muted|subtle|hairline|border|divider|line|ring|shadow|overlay|scrim|disabled|placeholder|link|info|success|warning|error|danger|positive|negative|caution|neutral|gray|grey|slate|stone|zinc|code|syntax|chart|data|graph|scale|tier|pricing|nav|footer|focus)/;

function isIdentityKey(key) {
  const k = key.toLowerCase();
  const seg0 = k.split("-")[0];
  if (!INCLUDE_PREFIX.test(k) && !COLOR_NAME_KEYS.has(seg0)) return false;
  if (EXCLUDE_PREFIX.test(k)) return false;
  // reject if any hyphen segment is a semantic/structural exclude token
  for (const seg of k.split("-")) {
    if (EXCLUDE_TOKENS.has(seg)) return false;
  }
  // reject purely-numeric scale keys (handled by the numeric segment check too)
  if (/^[a-z]+-?\d+$/.test(k)) {
    // e.g. blue-450, brand-blue-700 — only reject if it's a bare scale, but
    // brand-blue-700 is still a brand hue. Keep include-prefixed ones.
    if (!INCLUDE_PREFIX.test(k)) return false;
  }
  return true;
}

const HEX_RE = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/;

function isNeutral(hex) {
  try {
    const [, C] = hexToOklch(hex);
    return C < NEUTRAL_CHROMA;
  } catch {
    return true; // unparseable -> drop
  }
}

function dedupeKeep(hexes) {
  const seen = new Set();
  const out = [];
  for (const h of hexes) {
    const k = h.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

// ---------------------------------------------------------------------------
// YAML colors: block extractor (the 65 frontmatter brands).
// ---------------------------------------------------------------------------
function extractYamlIdentity(md) {
  const m = md.match(/^colors:\n((?:[ \t]+.*\n?)+)/m);
  if (!m) return null;
  const block = m[1];
  const hexes = [];
  for (const line of block.split("\n")) {
    const km = line.match(/^\s+([a-zA-Z0-9_-]+):\s*"?(#[0-9a-fA-F]{3,8})"?/);
    if (!km) continue;
    const [, key, hex] = km;
    if (hex.length !== 7 && hex.length !== 4) continue; // skip 8-digit rgba etc.
    if (!isIdentityKey(key)) continue;
    hexes.push(hex);
  }
  return hexes;
}

// ---------------------------------------------------------------------------
// Prose/table extractor (the 8 prose brands).
// Walk the "## Color" region section by section; collect hexes only while the
// current `### ...` (or sub) section header is an identity section.
// ---------------------------------------------------------------------------
const IDENTITY_SECTION = /^#{2,4}\s+(.*\b(brand|accent|primary)\b.*)$/i;
// sections that explicitly are NOT identity even if they say "accent"
const NONIDENTITY_SECTION =
  /\b(surface|background|neutral|text|semantic|elevation|gradient|shadow|inset|interactive|alpha ladder|black\s*\/\s*white)\b/i;
// any header that ends the color region (typography etc.)
const COLOR_REGION_END = /^#{1,3}\s+\d?\.?\s*(typograph|font|button|component|layout|spacing|grid|principles|do'?s|don'?t|note on font|distinctive|navigation|cards|inputs|image|elevation|known gaps)/i;

function extractProseIdentity(md) {
  const lines = md.split("\n");
  const hexes = [];
  let inColorRegion = false;
  let identityCtx = false;

  for (const raw of lines) {
    const line = raw.trim();

    // enter color region at a "## ... Color ..." header
    if (/^#{1,3}\s+.*\bcolor\b/i.test(line) && /palette|role|color/i.test(line)) {
      inColorRegion = true;
      identityCtx = false;
      continue;
    }
    if (!inColorRegion) continue;

    // leave the color region entirely
    if (COLOR_REGION_END.test(line)) {
      inColorRegion = false;
      identityCtx = false;
      continue;
    }

    // section header -> update identity context
    if (/^#{2,4}\s+/.test(line)) {
      if (NONIDENTITY_SECTION.test(line)) {
        identityCtx = false;
      } else if (IDENTITY_SECTION.test(line)) {
        identityCtx = true;
      } else {
        identityCtx = false; // unknown section -> not identity
      }
      continue;
    }

    if (!identityCtx) continue;

    // collect every hex on identity lines (a line may carry shade variants)
    const all = raw.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g);
    if (all) for (const h of all) hexes.push(h);
  }
  return hexes;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const index = JSON.parse(readFileSync(INDEX, "utf8"));
const bySlug = new Map(index.map((e) => [e.slug, e]));

// also map by filename without extension (slugs may differ, e.g. linear.app)
const files = readdirSync(DIR).filter((f) => f.endsWith(".md"));

let zeroFlags = [];
let proseCount = 0;
let yamlCount = 0;
const report = [];

for (const file of files) {
  const slug = file.replace(/\.md$/, "");
  const md = readFileSync(join(DIR, file), "utf8");

  // find the matching index entry: by slug, else by url containing slug
  let entry = bySlug.get(slug);
  if (!entry) {
    entry = index.find(
      (e) => (e.url || "").includes(slug) || e.slug === slug || e.name.toLowerCase().replace(/[^a-z0-9]/g, "") === slug.replace(/[^a-z0-9]/g, "")
    );
  }
  if (!entry) {
    console.warn(`  [warn] no index entry for ${file}`);
    continue;
  }

  let rawHexes = extractYamlIdentity(md);
  let source;
  if (rawHexes !== null) {
    source = "yaml";
    yamlCount++;
  } else {
    rawHexes = extractProseIdentity(md);
    source = "prose";
    proseCount++;
  }

  // drop neutrals, dedupe
  const identity = dedupeKeep(rawHexes.filter((h) => !isNeutral(h)));

  entry.identityColors = identity;
  report.push({ name: entry.name, slug: entry.slug, source, n: identity.length, identity });
  if (identity.length === 0) zeroFlags.push(`${entry.name} (${source})`);
}

writeFileSync(INDEX, JSON.stringify(index, null, 2) + "\n", "utf8");

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
console.log(`=== reindex-getdesign-identity ===`);
console.log(`brands: ${report.length}  (yaml ${yamlCount}, prose ${proseCount})`);
console.log(`\nper-brand identity counts:`);
report
  .sort((a, b) => a.name.localeCompare(b.name))
  .forEach((r) => {
    console.log(
      `  ${r.name.padEnd(16)} ${String(r.n).padStart(2)}  [${r.source}]  ${r.identity.join(" ")}`
    );
  });

const counts = report.map((r) => r.n).sort((a, b) => a - b);
const median = counts[Math.floor(counts.length / 2)];
console.log(
  `\nidentity count: min ${counts[0]} median ${median} max ${counts[counts.length - 1]}`
);

if (zeroFlags.length) {
  console.log(`\n[FLAG] ${zeroFlags.length} brand(s) with ZERO identity colors:`);
  for (const z of zeroFlags) console.log(`  - ${z}`);
} else {
  console.log(`\nNo brand ended up with zero identity colors.`);
}
console.log(`\nwrote identityColors onto ${INDEX}`);
