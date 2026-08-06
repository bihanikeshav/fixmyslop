/**
 * Extract REAL glyph metrics from font files via opentype.js.
 *
 *   npx tsx src/extract-metrics.ts [limit]
 *
 * Downloads each font's TTF (keyless, via the CSS v1 endpoint with a legacy UA),
 * flattens glyph outlines, and measures actual geometry:
 *   - xHeightRatio   : bbox('x').height / bbox('H').height
 *   - strokeContrast : scanline of 'o' — (thick vertical wall - thin horizontal) / thick
 *   - counterSize    : inner-gap / outer-width of 'o'
 *   - charsetCompleteness : cmap coverage of basic Latin + digits + punctuation
 * apertureOpenness stays provisional (outline aperture analysis is a later refinement).
 *
 * Updates data/fonts.index.json in place and recomputes quality.
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import opentype from "opentype.js";
import { objectiveQuality, compositeQuality, type FontMetrics } from "@fixmyslop/core";
import type { IndexedFont } from "./types.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(HERE, "../../../data");
const LEGACY_UA = "Mozilla/5.0 (compatible; fixmyslop/0.1)";
const CONCURRENCY = 6;

interface Pt {
  x: number;
  y: number;
}

async function main(): Promise<void> {
  const limit = Number(process.argv[2] ?? "30");
  const indexPath = resolve(DATA_DIR, "fonts.index.json");
  const fonts: IndexedFont[] = JSON.parse(await readFile(indexPath, "utf8"));

  // Process the most-popular first (most worth measuring well).
  const targets = [...fonts].sort((a, b) => a.popularityRank - b.popularityRank).slice(0, limit);
  console.log(`Extracting metrics for ${targets.length} fonts...\n`);

  let ok = 0;
  let failed = 0;
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const batch = targets.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (f) => {
        try {
          const m = await extractFor(f.family);
          f.metrics = { ...f.metrics, ...m };
          f.quality = compositeQuality({ objective: objectiveQuality(f.metrics) });
          f.metricsReal = true;
          ok++;
        } catch (e) {
          failed++;
          console.warn(`  ! ${f.family}: ${(e as Error).message}`);
        }
      }),
    );
  }

  await writeFile(indexPath, JSON.stringify(fonts, null, 2));
  console.log(`\nDone. measured=${ok} failed=${failed}`);
  for (const id of ["inter", "playfair-display", "lora", "oswald"]) {
    const f = fonts.find((x) => x.id === id);
    if (f?.metricsReal) {
      console.log(
        `  ${f.family.padEnd(18)} xH=${r(f.metrics.xHeightRatio)} contrast=${r(
          f.metrics.strokeContrast,
        )} counter=${r(f.metrics.counterSize)} quality=${r(f.quality)}`,
      );
    }
  }
}

/** Compute glyph metrics from a raw font buffer (works for any TTF/OTF, local or remote). */
export function metricsFromBuffer(buf: ArrayBuffer): Partial<FontMetrics> {
  const font = opentype.parse(buf);
  const xH = glyphBBoxHeight(font, "x");
  const capH = glyphBBoxHeight(font, "H");
  const xHeightRatio = xH && capH ? clamp01(xH / capH) : 0.5;
  const { strokeContrast, counterSize } = measureO(font);
  const charsetCompleteness = cmapCoverage(font);
  return { xHeightRatio, strokeContrast, counterSize, charsetCompleteness };
}

async function extractFor(family: string): Promise<Partial<FontMetrics>> {
  const ttfUrl = await resolveTtfUrl(family);
  const buf = await (await fetch(ttfUrl, { headers: { "user-agent": LEGACY_UA } })).arrayBuffer();
  return metricsFromBuffer(buf);
}

async function resolveTtfUrl(family: string): Promise<string> {
  const css = await (
    await fetch(`https://fonts.googleapis.com/css?family=${encodeURIComponent(family)}`, {
      headers: { "user-agent": LEGACY_UA },
    })
  ).text();
  const m = css.match(/url\((https:[^)]+\.ttf)\)/);
  if (!m) throw new Error("no ttf url");
  return m[1]!;
}

function flatten(font: opentype.Font, char: string): Pt[][] {
  const glyph = font.charToGlyph(char);
  const path = glyph.getPath(0, 0, font.unitsPerEm);
  const subpaths: Pt[][] = [];
  let cur: Pt[] = [];
  let p: Pt = { x: 0, y: 0 };
  const cubic = (a: Pt, c1: Pt, c2: Pt, b: Pt) => {
    for (let t = 1; t <= 8; t++) {
      const u = t / 8;
      const m = 1 - u;
      cur.push({
        x: m ** 3 * a.x + 3 * m ** 2 * u * c1.x + 3 * m * u ** 2 * c2.x + u ** 3 * b.x,
        y: m ** 3 * a.y + 3 * m ** 2 * u * c1.y + 3 * m * u ** 2 * c2.y + u ** 3 * b.y,
      });
    }
  };
  const quad = (a: Pt, c: Pt, b: Pt) => {
    for (let t = 1; t <= 8; t++) {
      const u = t / 8;
      const m = 1 - u;
      cur.push({
        x: m ** 2 * a.x + 2 * m * u * c.x + u ** 2 * b.x,
        y: m ** 2 * a.y + 2 * m * u * c.y + u ** 2 * b.y,
      });
    }
  };
  for (const cmd of path.commands) {
    if (cmd.type === "M") {
      if (cur.length) subpaths.push(cur);
      cur = [{ x: cmd.x, y: cmd.y }];
      p = { x: cmd.x, y: cmd.y };
    } else if (cmd.type === "L") {
      cur.push({ x: cmd.x, y: cmd.y });
      p = { x: cmd.x, y: cmd.y };
    } else if (cmd.type === "C") {
      cubic(p, { x: cmd.x1, y: cmd.y1 }, { x: cmd.x2, y: cmd.y2 }, { x: cmd.x, y: cmd.y });
      p = { x: cmd.x, y: cmd.y };
    } else if (cmd.type === "Q") {
      quad(p, { x: cmd.x1, y: cmd.y1 }, { x: cmd.x, y: cmd.y });
      p = { x: cmd.x, y: cmd.y };
    } else if (cmd.type === "Z") {
      if (cur.length) subpaths.push(cur);
      cur = [];
    }
  }
  if (cur.length) subpaths.push(cur);
  return subpaths;
}

function bbox(pts: Pt[][]): { x1: number; y1: number; x2: number; y2: number } {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const sp of pts) for (const q of sp) {
    if (q.x < x1) x1 = q.x;
    if (q.x > x2) x2 = q.x;
    if (q.y < y1) y1 = q.y;
    if (q.y > y2) y2 = q.y;
  }
  return { x1, y1, x2, y2 };
}

function glyphBBoxHeight(font: opentype.Font, char: string): number {
  const pts = flatten(font, char);
  if (!pts.length) return 0;
  const b = bbox(pts);
  return b.y2 - b.y1;
}

/** Horizontal scanline: x-intersections of all edges at height y, sorted. */
function scanX(pts: Pt[][], y: number): number[] {
  const xs: number[] = [];
  for (const sp of pts) {
    for (let i = 0; i < sp.length; i++) {
      const a = sp[i]!;
      const b = sp[(i + 1) % sp.length]!;
      if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
        xs.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x));
      }
    }
  }
  return xs.sort((m, n) => m - n);
}

/** Vertical scanline: y-intersections at x, sorted. */
function scanY(pts: Pt[][], x: number): number[] {
  const ys: number[] = [];
  for (const sp of pts) {
    for (let i = 0; i < sp.length; i++) {
      const a = sp[i]!;
      const b = sp[(i + 1) % sp.length]!;
      if ((a.x <= x && b.x > x) || (b.x <= x && a.x > x)) {
        ys.push(a.y + ((x - a.x) / (b.x - a.x)) * (b.y - a.y));
      }
    }
  }
  return ys.sort((m, n) => m - n);
}

/** Measure 'o': thick vertical walls vs thin horizontal strokes -> contrast + counter. */
function measureO(font: opentype.Font): { strokeContrast: number; counterSize: number } {
  const pts = flatten(font, "o");
  if (pts.length < 2) return { strokeContrast: 0.3, counterSize: 0.5 };
  const b = bbox(pts);
  const midY = (b.y1 + b.y2) / 2;
  const midX = (b.x1 + b.x2) / 2;
  const xs = scanX(pts, midY); // expect 4: outerL, innerL, innerR, outerR
  const ys = scanY(pts, midX); // expect 4: top-out, top-in, bot-in, bot-out
  if (xs.length < 4 || ys.length < 4) return { strokeContrast: 0.3, counterSize: 0.5 };

  const leftWall = xs[1]! - xs[0]!;
  const rightWall = xs[3]! - xs[2]!;
  const thick = (leftWall + rightWall) / 2;
  const topStroke = ys[1]! - ys[0]!;
  const botStroke = ys[3]! - ys[2]!;
  const thin = (topStroke + botStroke) / 2;

  const strokeContrast = thick > 0 ? clamp01((thick - thin) / thick) : 0.3;
  const outerW = xs[3]! - xs[0]!;
  const innerGap = xs[2]! - xs[1]!;
  const counterSize = outerW > 0 ? clamp01(innerGap / outerW) : 0.5;
  return { strokeContrast, counterSize };
}

function cmapCoverage(font: opentype.Font): number {
  const need = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,;:!?'\"()-";
  let have = 0;
  for (const ch of need) if (font.charToGlyphIndex(ch) > 0) have++;
  return clamp01(have / need.length);
}

const clamp01 = (n: number): number => (Number.isFinite(n) ? (n < 0 ? 0 : n > 1 ? 1 : n) : 0.5);
const r = (n: number): number => Math.round(n * 100) / 100;

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
