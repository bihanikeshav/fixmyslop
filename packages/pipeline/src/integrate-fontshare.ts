/**
 * Add cached external fonts (Fontshare, Velvetyne, ...) to fonts.index.json as
 * first-class entries: real metrics from local files, source-tagged, fresh by
 * default. Personality is filled afterwards by extend-personality-metrics.mjs.
 *
 *   npx tsx src/integrate-fontshare.ts
 *
 * Only ingests fonts whose declared `license` clears LICENSE_ALLOWLIST (free
 * for commercial use); anything else is SKIPPED and logged rather than
 * silently imported, since this index feeds recommendations users act on.
 */
import { readFile, writeFile, readdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { metricsFromBuffer } from "./extract-metrics.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(HERE, "../../../data");
const INDEX_PATH = resolve(DATA_DIR, "fonts.index.json");
const EXTERNAL_DIR = resolve(DATA_DIR, "external");
const FONTS_CACHE_DIR = resolve(DATA_DIR, "fonts-cache");

interface Family {
  id: string;
  family: string;
  category: string;
  source: string;
  license: string;
  tags: string[];
  slug: string;
}

/**
 * Licences that are free for commercial use, in their normalized (lowercase,
 * whitespace-collapsed) form. Anything not on this list is skipped, not
 * guessed-at — a mislabeled or restrictive licence must never make it into a
 * font index users are recommended fonts from.
 */
export const LICENSE_ALLOWLIST: readonly string[] = [
  "ofl",
  "sil open font license",
  "apache-2.0",
  "apache 2.0",
  "itf free font license",
  "cc0",
  "mit",
  "ufl",
];

/** Lowercase, trim, collapse whitespace, normalize underscores to hyphens. */
export function normalizeLicense(license: string): string {
  return license.toLowerCase().trim().replace(/_/g, "-").replace(/\s+/g, " ");
}

/**
 * Is `license` on the free-for-commercial-use allowlist? Tolerates a trailing
 * version number ("SIL Open Font License 1.1" -> "sil open font license").
 */
export function isAllowedLicense(license: string | null | undefined): boolean {
  if (!license) return false;
  const normalized = normalizeLicense(license);
  if (LICENSE_ALLOWLIST.includes(normalized)) return true;
  const withoutVersion = normalized.replace(/\s+v?\d+(\.\d+)*$/, "").trim();
  return LICENSE_ALLOWLIST.includes(withoutVersion);
}

async function main(): Promise<void> {
  const index = JSON.parse(await readFile(INDEX_PATH, "utf8")) as Array<Record<string, unknown>>;
  const dirs = await readdir(EXTERNAL_DIR, { withFileTypes: true });
  const fams: Family[] = [];
  for (const d of dirs) {
    if (!d.isDirectory()) continue;
    try {
      const raw = await readFile(resolve(EXTERNAL_DIR, d.name, "families.json"), "utf8");
      fams.push(...(JSON.parse(raw) as Family[]));
    } catch {
      /* no families.json */
    }
  }
  const have = new Set(index.map((f) => f.id as string));
  const maxPop = Math.max(...index.map((f) => (f.popularityRank as number) ?? 0));

  let added = 0;
  let failed = 0;
  let skippedLicense = 0;
  for (const fam of fams) {
    if (have.has(fam.id)) continue;
    if (!isAllowedLicense(fam.license)) {
      skippedLicense++;
      console.warn(`  ! ${fam.family}: skipped, licence "${fam.license}" is not on the free-for-commercial allowlist`);
      continue;
    }
    try {
      const b = await readFile(resolve(FONTS_CACHE_DIR, `${fam.id}.ttf`));
      const m = metricsFromBuffer(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer);
      index.push({
        id: fam.id,
        family: fam.family,
        supplier: fam.source,
        category: fam.category,
        metrics: {
          xHeightRatio: m.xHeightRatio,
          // Unmeasured — no source in this pipeline currently computes real
          // aperture openness from the glyph outline. `null`, not a fabricated
          // placeholder; see FontMetrics doc in @fixmyslop/core.
          apertureOpenness: null,
          counterSize: m.counterSize,
          strokeContrast: m.strokeContrast,
          weightCount: 6,
          hasItalics: false,
          charsetCompleteness: m.charsetCompleteness,
        },
        isFoundational: false,
        popularityRank: maxPop + 1 + added,
        trendingRank: maxPop + 1 + added,
        isBrandFont: false,
        dateAdded: "2021-01-01",
        quality: 0.7,
        metricsReal: true,
        personalityReal: false,
        license: fam.license,
        tags: fam.tags,
      });
      added++;
    } catch (e) {
      failed++;
      console.warn(`  ! ${fam.family}: ${(e as Error).message}`);
    }
  }

  await writeFile(INDEX_PATH, JSON.stringify(index, null, 2));
  console.log(
    `Added ${added} Fontshare fonts (${failed} failed, ${skippedLicense} skipped on licence). Index now ${index.length} fonts.`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
