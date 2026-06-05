// Generate the data-backed parts of the /personality skill from this repo's
// font data: per-vibe AVOID + fresh option-sets (type-and-color.md/.json) and the
// "data tells" block injected into reference/slop-manifest.md. Re-run after data changes.
//   node scripts/build-personality-skill.mjs
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const DATA = resolve(ROOT, "data");
const REF = resolve(ROOT, "skills/personality/reference");
const CUTOFF = 0.4;          // matches diagnose.ts SLOP_CUTOFF
const FRESH = 0.12;          // "fresh" = clearly under-used
const read = async (f) => JSON.parse(await readFile(resolve(DATA, f), "utf8"));

const index = await read("fonts.index.json");
const sat = await read("saturation.json");
const paletteSlop = (await read("palette-slop.json")).summary ?? [];
const escapes = (await read("escape-directions.json")).runs ?? [];
let crawl = [];
try { crawl = await read("crawl-profiles.json"); } catch { /* optional */ }

const byId = new Map(index.map((f) => [f.id, f]));
const famById = (id) => byId.get(id)?.family ?? id;
const displaySat = new Map(sat.map((s) => [s.fontId, s.display ?? 0]));

// --- AVOID fonts: most display-saturated, family-named ---
const avoidFonts = [...sat]
  .filter((s) => (s.display ?? 0) >= CUTOFF)
  .sort((a, b) => (b.display ?? 0) - (a.display ?? 0))
  .slice(0, 24)
  .map((s) => ({ id: s.fontId, family: famById(s.fontId), sat: +(s.display ?? 0).toFixed(2) }));

// --- Fresh pool by category (the option-sets the model picks from) ---
const CATS = ["serif", "sans-serif", "display", "monospace", "handwriting"];
const freshByCat = {};
for (const c of CATS) {
  freshByCat[c] = index
    .filter((f) => f.category === c && (displaySat.get(f.id) ?? 0) < FRESH)
    // indie (non-google) first, then alphabetical — surfaces escape-the-default options
    .map((f) => ({ family: f.family, supplier: f.supplier ?? "google", sat: +(displaySat.get(f.id) ?? 0).toFixed(2) }))
    .sort((a, b) => (a.supplier === "google") - (b.supplier === "google") || a.family.localeCompare(b.family))
    .slice(0, 14);
}

// --- Per-intent fresh DIRECTIONS from the escape runs ---
const intents = [...new Set(escapes.map((r) => r.intent))];
const directions = intents.map((intent) => ({
  intent,
  options: escapes
    .filter((r) => r.intent === intent)
    .map((r) => ({ heading: r.headingFont, body: r.bodyFont, accent: r.accentColor, move: r.styleMove })),
}));

// --- Per-vibe AVOID palettes ---
const avoidPalettes = paletteSlop.map((v) => ({ vibe: v.vibe, slopAccent: v.slopAccent, bg: v.bg, examples: v.examples }));

// --- Data tells from the real crawl ---
// Crawl-profile font fields are space-lowercased ("playfair display") while the
// index is hyphen-keyed ("playfair-display"); normalize before resolving, drop
// generic CSS/system stack tokens, and title-case any real font not in the index.
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const GENERIC = new Set([
  "ui-sans-serif", "ui-serif", "ui-monospace", "ui-rounded", "system-ui",
  "sans-serif", "serif", "monospace", "cursive", "fantasy",
  "apple-system", "blinkmacsystemfont", "segoe-ui", "roboto-flex", "inherit", "initial",
]);
const titleCase = (s) => String(s).split(/[\s-]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
// crawl variants sometimes append a 6-hex color/hash token (e.g. "montserrat 7c84aa") — drop those
const isArtifact = (id) => id.split("-").some((seg) => /^[0-9a-f]{6}$/.test(seg));
const siteCount = crawl.length;
const fontSites = new Map();   // normalized id -> Set of site indices (dedupe per site)
crawl.forEach((p, i) => {
  const fams = [p.heroFont, p.headingFont, p.bodyFont, ...((p.allFonts ?? []).map((a) => a.family))].filter(Boolean);
  for (const f of fams) {
    const id = norm(f);
    if (!id || GENERIC.has(id) || isArtifact(id)) continue;
    if (!fontSites.has(id)) fontSites.set(id, new Set());
    fontSites.get(id).add(i);
  }
});
const topCrawl = [...fontSites.entries()]
  .map(([id, sites]) => ({ id, n: sites.size }))
  .sort((a, b) => b.n - a.n)
  .slice(0, 10)
  .map(({ id, n }) => ({ font: byId.get(id)?.family ?? titleCase(id), pct: siteCount ? Math.round((100 * n) / siteCount) : 0, n }));

// --- Render type-and-color.md ---
const fmtFresh = (arr) => arr.map((f) => `${f.family}${f.supplier !== "google" ? ` (${f.supplier})` : ""}`).join(", ");
let md = `# Type & color

Generated from this repo's font data. **Rule: pick the option that fits THIS page's
concept; rotate across builds; never default to the first listed; step outside the
set when your concept demands it.** Listing a font here is permission, not a mandate —
defaulting to one of these is how the next Inter is born.

## Fonts to AVOID (over-used / saturated)
${avoidFonts.map((f) => `- ${f.family} — saturation ${f.sat}`).join("\n")}

## Fresh fonts to pick from (under-used; indie marked)
${CATS.map((c) => `- **${c}**: ${fmtFresh(freshByCat[c])}`).join("\n")}

## Fresh directions by intent (heading / body · accent · move)
${directions.map((d) => `### ${d.intent}\n${d.options.map((o) => `- ${o.heading} / ${o.body} · ${o.accent} · ${o.move}`).join("\n")}`).join("\n\n")}

## Palettes to AVOID by vibe
${avoidPalettes.map((p) => `- **${p.vibe}** (${p.bg} bg): ${p.slopAccent} — e.g. ${p.examples}`).join("\n")}
`;
await writeFile(resolve(REF, "type-and-color.md"), md);

// --- Machine-readable sidecar (the test asserts against this) ---
await writeFile(
  resolve(REF, "type-and-color.json"),
  JSON.stringify({ cutoff: CUTOFF, avoidFonts, freshByCat, directions, avoidPalettes, dataTells: { siteCount, topCrawl } }, null, 2),
);

// --- Inject the data-tells block into slop-manifest.md ---
const manifestPath = resolve(REF, "slop-manifest.md");
const manifest = await readFile(manifestPath, "utf8");
const block = `<!-- GENERATED:data-tells:start -->
## Measured tells (this repo's crawl of ${siteCount} AI-built sites)
The fonts most likely to make a site read as generic, by how many crawled sites use them:
${topCrawl.map((t) => `- ${t.font} — ${t.pct}% of sites (${t.n}/${siteCount})`).join("\n")}

Detectors we flag deterministically: AI purple/violet gradient, gradient text,
glassmorphism (backdrop-blur), pill buttons, extreme corner radius, tight hero
tracking, uppercase headings. See packages/crawl/src/style.ts.
<!-- GENERATED:data-tells:end -->`;
const replaced = manifest.replace(/<!-- GENERATED:data-tells:start -->[\s\S]*<!-- GENERATED:data-tells:end -->/, block);
await writeFile(manifestPath, replaced);

console.log(`Wrote type-and-color.md/.json (${avoidFonts.length} avoid, ${CATS.reduce((n, c) => n + freshByCat[c].length, 0)} fresh, ${directions.length} intents) and injected ${topCrawl.length} data tells.`);
