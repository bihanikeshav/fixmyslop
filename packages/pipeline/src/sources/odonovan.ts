/**
 * O'Donovan et al. (SIGGRAPH 2014) crowdsourced font attributes.
 *
 * Loads estimatedAttributes.csv (200 fonts x 37 attributes, 0..100) and maps the
 * 37 attributes onto our 12-attribute personality vocabulary (grounded in Shaikh
 * & Chaparro's three factors). Downloads + extracts the dataset on first run.
 *
 * Source: https://www.dgp.toronto.edu/~donovan/font/
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import AdmZip from "adm-zip";
import {
  PERSONALITY_ATTRIBUTES,
  clamp01,
  type PersonalityAttribute,
  type PersonalityVector,
} from "@fixmyslop/core";

const ZIP_URL = "https://www.dgp.toronto.edu/~donovan/font/attribute.zip";
const CSV_ENTRY = "attributeData/estimatedAttributes.csv";

/**
 * How each of our 12 attributes is composed from O'Donovan columns. Averages of
 * the listed columns. All chosen columns exist in estimatedAttributes.csv.
 */
const ATTR_MAP: Record<PersonalityAttribute, readonly string[]> = {
  strong: ["strong"],
  bold: ["attention-grabbing", "strong"],
  delicate: ["delicate"],
  thin: ["thin"],
  elegant: ["graceful", "attractive"],
  friendly: ["friendly", "warm"],
  professional: ["formal", "legible"],
  playful: ["playful", "happy"],
  dramatic: ["dramatic", "attention-grabbing"],
  calm: ["calm", "gentle"],
  formal: ["formal"],
  technical: ["technical", "monospace"],
};

export interface AttributeTable {
  /** fontId (slugified GF family) -> personality vector (0..1). */
  byFontId: Map<string, PersonalityVector>;
  /** Raw O'Donovan name -> mapped fontId, for diagnostics. */
  nameToId: Map<string, string>;
}

async function ensureCsv(cachePath: string): Promise<string> {
  if (existsSync(cachePath)) return readFile(cachePath, "utf8");
  const res = await fetch(ZIP_URL);
  if (!res.ok) throw new Error(`O'Donovan zip HTTP ${res.status}`);
  const zip = new AdmZip(Buffer.from(await res.arrayBuffer()));
  const entry = zip.getEntry(CSV_ENTRY);
  if (!entry) throw new Error("estimatedAttributes.csv not found in zip");
  const csv = entry.getData().toString("utf8");
  await mkdir(dirname(cachePath), { recursive: true });
  await writeFile(cachePath, csv);
  return csv;
}

export async function loadOdonovan(cachePath: string): Promise<AttributeTable> {
  const csv = await ensureCsv(cachePath);
  // Dataset is Mac-authored and may use lone-CR line endings; handle CR / LF / CRLF.
  const lines = csv.split(/\r\n|\r|\n/).filter((l) => l.trim().length > 0);
  const header = lines[0]!.split(",");
  const cols = header.slice(1); // first column is the font name
  const colIndex = new Map(cols.map((c, i) => [c.trim(), i]));

  // Collect every row per fontId first, then resolve the repeats deterministically
  // (see pickCanonicalVariant) instead of just keeping whichever CSV row happens
  // to appear first.
  const candidatesByFontId = new Map<string, Array<{ rawName: string; vec: PersonalityVector }>>();
  const nameToId = new Map<string, string>();

  for (const line of lines.slice(1)) {
    const parts = line.split(",");
    const rawName = parts[0]!.trim();
    const values = parts.slice(1).map((v) => Number(v));
    const fontId = odonovanNameToId(rawName);
    nameToId.set(rawName, fontId);

    const vec: PersonalityVector = {};
    for (const attr of PERSONALITY_ATTRIBUTES) {
      const sources = ATTR_MAP[attr];
      let sum = 0;
      let n = 0;
      for (const src of sources) {
        const idx = colIndex.get(src);
        if (idx === undefined) continue;
        const val = values[idx];
        if (val === undefined || Number.isNaN(val)) continue;
        sum += val;
        n++;
      }
      if (n > 0) vec[attr] = clamp01(sum / n / 100);
    }
    const list = candidatesByFontId.get(fontId) ?? [];
    list.push({ rawName, vec });
    candidatesByFontId.set(fontId, list);
  }

  const byFontId = new Map<string, PersonalityVector>();
  for (const [fontId, variants] of candidatesByFontId) {
    byFontId.set(fontId, pickCanonicalVariant(variants).vec);
  }

  return { byFontId, nameToId };
}

/**
 * A font id can repeat across several O'Donovan CSV rows (its different
 * weights/styles: "Alegreya-Regular", "Alegreya-BoldItalic", ...) which all
 * fold to the same slugified fontId. Picking "whichever row came first in the
 * CSV" makes the result depend on file row order. Instead:
 *   1. Prefer a Regular/400/(no suffix)/Book variant when one is identifiable
 *      — it's the canonical representative of a family's attributes.
 *   2. Otherwise fall back to the lexicographically smallest raw variant name,
 *      so ties are still resolved the same way on every run.
 */
export function pickCanonicalVariant<T extends { rawName: string }>(variants: readonly T[]): T {
  const regular = variants.filter((v) => isRegularVariantName(v.rawName));
  const pool = regular.length > 0 ? regular : variants;
  return [...pool].sort((a, b) =>
    a.rawName < b.rawName ? -1 : a.rawName > b.rawName ? 1 : 0,
  )[0]!;
}

function isRegularVariantName(rawName: string): boolean {
  const suffix = rawName.split("-").slice(1).join("-").toLowerCase();
  return suffix === "" || suffix === "regular" || suffix === "400" || suffix === "book";
}

/**
 * Map an O'Donovan font name ("ArchivoNarrow-Regular", "Alegreya-BoldItalic") to a
 * Google-Fonts-style id: drop the style suffix, split camelCase, slugify.
 */
export function odonovanNameToId(name: string): string {
  const base = name.split("-")[0]!; // drop -Regular / -BoldItalic / ...
  const spaced = base.replace(/([a-z0-9])([A-Z])/g, "$1-$2");
  return spaced.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
