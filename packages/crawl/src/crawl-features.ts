/**
 * Unified design-feature crawler — ADDITIVE companion to crawl.ts / crawl-colors.ts.
 *
 *   npx tsx src/crawl-features.ts --limit 30      # SMOKE TEST (first 30 sites)
 *   npx tsx src/crawl-features.ts                 # FULL run over data/site-list.json
 *   npx tsx src/crawl-features.ts --concurrency 10 --timeout 15000
 *   npx tsx src/crawl-features.ts --fresh         # ignore prior progress, recrawl all
 *
 * GOAL — measure DESIGN SLOP the way crawl.ts measures font overuse: as FREQUENCY
 * ACROSS SITES (the font-saturation parallel). For each site we read computed
 * style off the live DOM (visible elements, cap ~600/site) plus page-level DOM /
 * class / global fingerprints, dedup WITHIN a site, then aggregate every signal as
 * a SITE COUNT (number of distinct sites exhibiting it). This supersedes the
 * 44-site color crawl.
 *
 * RESILIENT + RESUMABLE: per-site try/catch; raw per-site observations are written
 * incrementally to data/feature-crawl-raw.ndjson (one JSON line per finished host),
 * so a crash keeps progress and a re-run SKIPS already-done hosts. The aggregate
 * observations.*.json files are (re)derived from the full raw log at the end of the
 * run (and on resume, from existing lines + new ones).
 *
 * OUTPUTS (all in data/, all keyed by SITE FREQUENCY):
 *   observations.colors.json     — per-site deduped chromatic identity colors -> {hex,sites,count}
 *                                  (REGENERATED at scale; same shape corpus.mjs loads; supersedes 44-site)
 *   observations.accents.json    — per-site dominant chromatic accent -> {hex: siteCount}
 *   observations.styles.json     — % of sites with each style tell
 *   observations.gradients.json  — gradient type + endpoint-hue pair -> siteCount
 *   observations.radii.json      — radius distribution (sharp/rounded/pill)
 *   observations.animation.json  — lib -> siteCount; bounce/elastic, layout-prop, tailwind animate-*
 *   observations.components.json — framework/stack -> siteCount
 *   observations.type.json       — font-family -> siteCount, uppercase, weight distribution
 *
 * Does NOT touch the font path (crawl.ts/analyze.ts) or its outputs
 * (crawl-profiles.json / observations.crawl.json). No Math.random()/Date.now() in
 * the aggregation — deterministic given the raw log.
 */

import { readFile, writeFile, appendFile, mkdir } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import { UA } from "./extract.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(HERE, "../../../data");
const SITE_LIST = resolve(DATA_DIR, "site-list.json");
const RAW_LOG = resolve(DATA_DIR, "feature-crawl-raw.ndjson");

// --- tunables -------------------------------------------------------------
const MAX_ELEMENTS = 600;
const QUANT = 24;          // RGB quantization step for intra-site color dedup (matches crawl-colors.ts)
const CHROMA_CUTOFF = 0.03; // min OKLCH chroma for a chromatic identity color (matches crawl-colors.ts)

// ===========================================================================
// COLOR MATH (mirrors crawl-colors.ts / color-space.mjs) — Node side only.
// ===========================================================================
function srgbToLinearChannel(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function hexToOklch(hex: string): [number, number, number] {
  const h = hex.replace(/^#/, "");
  const n = parseInt(h, 16);
  const r = srgbToLinearChannel(((n >> 16) & 255) / 255);
  const g = srgbToLinearChannel(((n >> 8) & 255) / 255);
  const b = srgbToLinearChannel((n & 255) / 255);
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const aa = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;
  const C = Math.hypot(aa, bb);
  let H = (Math.atan2(bb, aa) * 180) / Math.PI;
  if (H < 0) H += 360;
  return [L, C, H];
}
function parseColor(s: string): { r: number; g: number; b: number; a: number } | null {
  const m = s.match(/rgba?\(([^)]+)\)/i);
  if (!m) return null;
  const parts = m[1].split(",").map((p) => p.trim());
  if (parts.length < 3) return null;
  const r = parseFloat(parts[0]); const g = parseFloat(parts[1]); const b = parseFloat(parts[2]);
  const a = parts.length >= 4 ? parseFloat(parts[3]) : 1;
  if ([r, g, b].some((v) => Number.isNaN(v))) return null;
  return { r, g, b, a: Number.isNaN(a) ? 1 : a };
}
function quantHex(r: number, g: number, b: number): string {
  const q = (v: number): string => {
    const x = Math.max(0, Math.min(255, Math.round(v / QUANT) * QUANT));
    return x.toString(16).padStart(2, "0");
  };
  return `#${q(r)}${q(g)}${q(b)}`;
}

// ===========================================================================
// SHAPES — the raw per-site observation written to the NDJSON log.
// ===========================================================================
interface ElementStyle {
  color: string;
  backgroundColor: string;
  borderColor: string | null; // only when a visible border (width>0) exists
  backgroundImage: string;    // "none" or a gradient string
  boxShadow: string;          // "none" or a shadow
  textShadow: string;         // "none" or a shadow
  filter: string;             // "none" or e.g. drop-shadow(...)
  backdropFilter: string;     // "none" or blur(...)
  borderRadius: number;       // px (top-left)
  transitionProperty: string;
  transitionDuration: string;
  transitionTiming: string;
  animationName: string;      // "none" or a name
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
  textTransform: string;
  letterSpacing: string;
  area: number;
  aboveFold: boolean;
}

interface PageFingerprint {
  components: string[];     // detected CSS/component stacks
  animationLibs: string[];  // detected animation libs
  tailwindAnimate: string[]; // tailwind animate-* utility class names found
  gradientText: boolean;    // background-clip:text + gradient bg present
  sparkleBadge: boolean;    // ✨/emoji "AI-powered"-ish badge text present
}

interface SiteRaw {
  host: string;
  url: string;
  ok: boolean;
  error?: string;
  elements: ElementStyle[];
  fp: PageFingerprint;
}

// ===========================================================================
// IN-PAGE EXTRACTION — single evaluate, returns elements + page fingerprint.
// ===========================================================================
async function extractFeatures(page: Page): Promise<{ elements: ElementStyle[]; fp: PageFingerprint }> {
  return page.evaluate((max: number) => {
    const vh = window.innerHeight;
    const out: ElementStyle[] = [];
    const nodes = document.querySelectorAll(
      "h1,h2,h3,h4,h5,h6,p,a,span,li,button,code,pre,blockquote,div,figcaption,label,nav,header,section,article",
    );
    for (const node of Array.from(nodes)) {
      const el = node as Element;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || parseFloat(cs.opacity) === 0) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      // require either some text OR a visually meaningful box (so nav/section
      // containers carrying glass/gradient still count, but invisible spacers don't)
      let text = "";
      for (const c of Array.from(node.childNodes)) if (c.nodeType === 3) text += c.textContent ?? "";
      text = text.trim();
      const meaningful = text.length >= 2 || rect.width * rect.height > 4000;
      if (!meaningful) continue;

      const borderW = parseFloat(cs.borderTopWidth) || 0;
      out.push({
        color: cs.color,
        backgroundColor: cs.backgroundColor,
        borderColor: borderW > 0 ? cs.borderTopColor : null,
        backgroundImage: cs.backgroundImage,
        boxShadow: cs.boxShadow,
        textShadow: cs.textShadow,
        filter: cs.filter,
        backdropFilter: cs.backdropFilter || (cs as any).webkitBackdropFilter || "none",
        borderRadius: parseFloat(cs.borderTopLeftRadius) || 0,
        transitionProperty: cs.transitionProperty,
        transitionDuration: cs.transitionDuration,
        transitionTiming: cs.transitionTimingFunction,
        animationName: cs.animationName,
        fontFamily: cs.fontFamily,
        fontWeight: parseInt(cs.fontWeight) || 400,
        fontSize: parseFloat(cs.fontSize) || 0,
        textTransform: cs.textTransform,
        letterSpacing: cs.letterSpacing,
        area: rect.width * rect.height,
        aboveFold: rect.top < vh && rect.top >= -rect.height,
      });
      if (out.length >= max) break;
    }

    // ---- page-level fingerprints (DOM / class / global) ----
    const all = Array.from(document.querySelectorAll("*"));
    const classBlob = all.slice(0, 6000).map((e) => (e.getAttribute("class") || "")).join(" ");
    const lc = classBlob.toLowerCase();
    const q = (sel: string): boolean => { try { return !!document.querySelector(sel); } catch { return false; } };
    const w = window as any;
    const scripts = Array.from(document.querySelectorAll("script[src]")).map((s) => (s as HTMLScriptElement).src.toLowerCase()).join(" ");

    // Component / CSS stacks
    const components: string[] = [];
    // Tailwind: utility-class soup — many short atomic classes (flex, px-4, text-lg, gap-2, md:...)
    const tw = /\b(?:flex|grid|hidden|block|inline-flex)\b/.test(lc) &&
      /\b(?:px-\d|py-\d|pt-\d|pb-\d|mx-\d|my-\d|mt-\d|mb-\d)\b/.test(lc) &&
      (/\btext-(?:xs|sm|base|lg|xl|\dxl)\b/.test(lc) || /\b(?:sm|md|lg|xl):\w/.test(lc) || /\bgap-\d/.test(lc));
    if (tw) components.push("tailwind");
    if (q(".btn") && (q(".container") || q(".row") || q(".col") || q('[class*="col-"]'))) components.push("bootstrap");
    if (q('[class*="Mui"]') || q(".MuiButton-root")) components.push("mui");
    if (q('[class*="chakra-"]')) components.push("chakra");
    if (q('[class*="ant-"]') && (q(".ant-btn") || q(".ant-layout") || q(".ant-row"))) components.push("ant");
    if (/\bsc-[a-z0-9]{5,}\b/i.test(classBlob) || /\bcss-[a-z0-9]{5,}\b/i.test(classBlob)) components.push("styled-components/emotion");
    // shadcn: radix data attrs + tailwind, or the telltale class fragments
    if ((q("[data-radix-collection-item]") || q("[data-state]")) && tw) components.push("shadcn");

    // Animation libraries
    const animationLibs: string[] = [];
    if (q("[data-aos]")) animationLibs.push("aos");
    if (/\banimate__/i.test(classBlob) || scripts.includes("animate.css")) animationLibs.push("animate.css");
    if (w.gsap || w.TweenMax || w.ScrollTrigger || scripts.includes("gsap")) animationLibs.push("gsap");
    if (q("[data-framer-name]") || q("[data-projection-id]") || scripts.includes("framer-motion") || w.FramerMotion) animationLibs.push("framer-motion");
    if (w.Lenis || q(".lenis") || q("[data-scroll]") || scripts.includes("lenis") || scripts.includes("locomotive")) animationLibs.push("lenis/locomotive");
    if (q(".swiper") || q(".swiper-slide") || scripts.includes("swiper")) animationLibs.push("swiper");

    // Tailwind animate-* utilities actually present in markup
    const twAnimSet = new Set<string>();
    for (const m of lc.matchAll(/\banimate-(spin|pulse|ping|bounce|[a-z-]+)\b/g)) twAnimSet.add("animate-" + m[1]);
    const tailwindAnimate = Array.from(twAnimSet);

    // Gradient-text: any element with background-clip:text + a gradient background
    let gradientText = false;
    for (const e of all.slice(0, 4000)) {
      const cs = getComputedStyle(e);
      const clip = (cs as any).webkitBackgroundClip || (cs as any).backgroundClip || "";
      if (String(clip).includes("text") &&
          (cs.color === "rgba(0, 0, 0, 0)" || cs.color === "transparent") &&
          cs.backgroundImage.includes("gradient")) { gradientText = true; break; }
    }

    // ✨ / emoji "AI" badge — small element whose text carries a sparkle/emoji and AI-ish wording
    let sparkleBadge = false;
    const sparkleRe = /[✨⚡\u{1F680}\u{1F916}\u{1F31F}\u{1F4A1}]/u; // ✨ ⚡ 🚀 🤖 🌟 💡
    for (const e of all.slice(0, 4000)) {
      const t = (e.textContent || "").trim();
      if (t.length > 0 && t.length < 60 && sparkleRe.test(t)) { sparkleBadge = true; break; }
    }

    return {
      elements: out,
      fp: { components, animationLibs, tailwindAnimate, gradientText, sparkleBadge },
    };
  }, MAX_ELEMENTS);
}

// ===========================================================================
// CRAWL ONE SITE — own context, resource-blocking route (keep CSS+JS).
// ===========================================================================
async function crawlSite(browser: Browser, host: string, url: string, timeoutMs: number): Promise<SiteRaw> {
  let context;
  try {
    context = await browser.newContext({ userAgent: UA, viewport: { width: 1366, height: 900 } });
    await context.addInitScript({ content: "window.__name=window.__name||function(f){return f;};" });
    await context.route("**/*", (route) => {
      const type = route.request().resourceType();
      if (type === "image" || type === "media" || type === "font") return route.abort();
      return route.continue();
    });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForTimeout(1200);
    const { elements, fp } = await extractFeatures(page);
    return { host, url, ok: true, elements, fp };
  } catch (e) {
    return {
      host, url, ok: false, error: (e as Error).message.slice(0, 160),
      elements: [], fp: { components: [], animationLibs: [], tailwindAnimate: [], gradientText: false, sparkleBadge: false },
    };
  } finally {
    if (context) await context.close().catch(() => {});
  }
}

// ===========================================================================
// AGGREGATION — derive all observations.*.json from the raw site records.
// Every signal is a SITE COUNT: we dedup within a site first, then increment.
// ===========================================================================
function isGlow(boxShadow: string): boolean {
  // colored glow = a box-shadow whose color is chromatic (not grey/black) and spread/blur present
  const colors = Array.from(boxShadow.matchAll(/rgba?\([^)]+\)/g)).map((m) => m[0]);
  for (const cs of colors) {
    const c = parseColor(cs);
    if (!c || c.a === 0) continue;
    const hex = quantHex(c.r, c.g, c.b);
    const [, C] = hexToOklch(hex);
    if (C >= 0.06) return true; // chromatic shadow => glow
  }
  return false;
}

function radiusClass(px: number): "sharp" | "rounded" | "pill" {
  if (px >= 100) return "pill";
  if (px >= 8) return "rounded";
  return "sharp";
}

function hueLabel(H: number): string {
  // coarse hue family label for gradient endpoint pairing
  const bands: Array<[number, number, string]> = [
    [0, 15, "red"], [15, 45, "orange"], [45, 70, "yellow"], [70, 110, "lime"],
    [110, 160, "green"], [160, 200, "teal"], [200, 240, "cyan"], [240, 270, "blue"],
    [270, 300, "indigo"], [300, 330, "violet"], [330, 350, "magenta"], [350, 360, "red"],
  ];
  for (const [lo, hi, name] of bands) if (H >= lo && H < hi) return name;
  return "red";
}

interface Aggregates {
  okSites: number;
  totalSites: number;
  colors: Map<string, number>;
  accents: Map<string, number>;
  styleTells: Record<string, number>;
  gradients: Map<string, number>;
  radii: Record<"sharp" | "rounded" | "pill", number>;
  animLibs: Map<string, number>;
  animBounce: number;
  animLayoutProp: number;
  tailwindAnimate: Map<string, number>;
  components: Map<string, number>;
  fonts: Map<string, number>;
  uppercaseSites: number;
  weightBuckets: Map<number, number>;
}

function newAgg(): Aggregates {
  return {
    okSites: 0, totalSites: 0,
    colors: new Map(), accents: new Map(),
    styleTells: { boxShadow: 0, glowShadow: 0, glass: 0, textShadow: 0, gradientText: 0, pill: 0, bento: 0, sparkleBadge: 0, dropShadowFilter: 0 },
    gradients: new Map(),
    radii: { sharp: 0, rounded: 0, pill: 0 },
    animLibs: new Map(), animBounce: 0, animLayoutProp: 0, tailwindAnimate: new Map(),
    components: new Map(), fonts: new Map(),
    uppercaseSites: 0, weightBuckets: new Map(),
  };
}

function firstFamily(stack: string): string {
  const first = (stack.split(",")[0] || "").trim().replace(/^["']|["']$/g, "");
  return first;
}

function isGenericFamily(name: string): boolean {
  const n = name.toLowerCase();
  return ["", "inherit", "initial", "sans-serif", "serif", "monospace", "system-ui",
    "-apple-system", "blinkmacsystemfont", "ui-sans-serif", "ui-serif", "ui-monospace",
    "arial", "helvetica", "roboto", "segoe ui", "tahoma", "verdana"].includes(n);
}

function detectBento(elements: ElementStyle[]): boolean {
  // heuristic: many similar-sized rounded cards with shadow/border in a grid-ish cluster
  const cards = elements.filter((e) =>
    e.borderRadius >= 8 && e.area > 20000 && e.area < 400000 &&
    (e.boxShadow !== "none" || e.borderColor !== null));
  return cards.length >= 6;
}

function aggregateSite(agg: Aggregates, s: SiteRaw): void {
  agg.totalSites++;
  if (!s.ok) return;
  agg.okSites++;

  // --- colors (intra-site deduped chromatic identity hexes) ---
  const siteColors = new Set<string>();
  const considerColor = (str: string, isBg: boolean): void => {
    const c = parseColor(str);
    if (!c) return;
    if (isBg && c.a === 0) return;
    const hex = quantHex(c.r, c.g, c.b);
    const [, C] = hexToOklch(hex);
    if (C < CHROMA_CUTOFF) return;
    siteColors.add(hex);
  };
  // dominant chromatic accent: most-area chromatic color on the site
  const accentArea = new Map<string, number>();

  let hasBoxShadow = false, hasGlow = false, hasGlass = false, hasTextShadow = false,
    hasDropShadowFilter = false;
  const siteGradientPairs = new Set<string>();
  let hasBounceEasing = false, hasLayoutPropAnim = false;
  let uppercaseSeen = false;
  const siteFonts = new Set<string>();
  const siteWeights = new Set<number>();

  for (const e of s.elements) {
    considerColor(e.color, false);
    considerColor(e.backgroundColor, true);
    if (e.borderColor) considerColor(e.borderColor, true);

    // accent area accumulation (chromatic bg or text)
    for (const [str, isBg] of [[e.backgroundColor, true], [e.color, false]] as Array<[string, boolean]>) {
      const c = parseColor(str);
      if (!c || (isBg && c.a === 0)) continue;
      const hex = quantHex(c.r, c.g, c.b);
      const [, C] = hexToOklch(hex);
      if (C < CHROMA_CUTOFF) continue;
      accentArea.set(hex, (accentArea.get(hex) ?? 0) + e.area);
    }

    if (e.boxShadow && e.boxShadow !== "none") {
      hasBoxShadow = true;
      if (isGlow(e.boxShadow)) hasGlow = true;
    }
    if (e.textShadow && e.textShadow !== "none") hasTextShadow = true;
    if (e.backdropFilter && e.backdropFilter !== "none" && e.backdropFilter.includes("blur")) hasGlass = true;
    if (e.filter && e.filter !== "none" && e.filter.includes("drop-shadow")) hasDropShadowFilter = true;

    // radius distribution: classify each element once per site bucket later;
    // here just record presence of pill via styleTells, full dist below.

    // gradients: parse type + endpoint hues
    if (e.backgroundImage && e.backgroundImage.includes("gradient")) {
      const type = e.backgroundImage.match(/(linear|radial|conic)-gradient/)?.[1] ?? "linear";
      const stops = Array.from(e.backgroundImage.matchAll(/rgba?\([^)]+\)/g))
        .map((m) => parseColor(m[0])).filter((c): c is NonNullable<typeof c> => !!c && c.a !== 0);
      const chromatic = stops
        .map((c) => quantHex(c.r, c.g, c.b))
        .filter((hex) => hexToOklch(hex)[1] >= CHROMA_CUTOFF);
      if (chromatic.length >= 2) {
        const h0 = hueLabel(hexToOklch(chromatic[0])[2]);
        const h1 = hueLabel(hexToOklch(chromatic[chromatic.length - 1])[2]);
        const pair = [h0, h1].sort().join("->");
        siteGradientPairs.add(`${type}:${pair}`);
      }
    }

    // animation easing & layout-prop
    const timing = e.transitionTiming || "";
    if (/cubic-bezier\([^)]*-[0-9.]+/i.test(timing)) hasBounceEasing = true; // negative coeff => overshoot/bounce/elastic
    const props = (e.transitionProperty || "") + " " + (e.animationName !== "none" ? e.animationName : "");
    if (/\b(width|height|top|left|right|bottom|margin|padding)\b/i.test(e.transitionProperty || "") &&
        e.transitionProperty !== "all" && e.transitionDuration !== "0s") hasLayoutPropAnim = true;

    // type
    const fam = firstFamily(e.fontFamily);
    if (fam && !isGenericFamily(fam)) siteFonts.add(fam);
    siteWeights.add(e.fontWeight);
    if (e.textTransform === "uppercase" && e.fontSize >= 14) uppercaseSeen = true;
  }

  for (const hex of siteColors) agg.colors.set(hex, (agg.colors.get(hex) ?? 0) + 1);

  // dominant accent for this site
  if (accentArea.size) {
    let best = ""; let bestA = -1;
    for (const [hex, a] of accentArea) if (a > bestA) { bestA = a; best = hex; }
    if (best) agg.accents.set(best, (agg.accents.get(best) ?? 0) + 1);
  }

  // radius distribution: classify the site by its STRONGEST radius signal among
  // interactive/card elements (buttons + meaningfully-sized boxes). A site that
  // uses any pills reads as "pill"; else if it leans on rounded cards it reads as
  // "rounded"; else "sharp". (A page always has many sharp section/div wrappers,
  // so a raw element majority would call everything sharp — we vote by signal.)
  const radBuckets = { sharp: 0, rounded: 0, pill: 0 };
  for (const e of s.elements) {
    if (e.area < 2000) continue; // ignore tiny inline spans
    radBuckets[radiusClass(e.borderRadius)]++;
  }
  const hasPill = radBuckets.pill > 0;
  const domRad: keyof typeof radBuckets =
    hasPill ? "pill" : radBuckets.rounded >= 3 ? "rounded" : "sharp";
  agg.radii[domRad]++;

  // style tells (one vote per site)
  if (hasBoxShadow) agg.styleTells.boxShadow++;
  if (hasGlow) agg.styleTells.glowShadow++;
  if (hasGlass) agg.styleTells.glass++;
  if (hasTextShadow) agg.styleTells.textShadow++;
  if (hasDropShadowFilter) agg.styleTells.dropShadowFilter++;
  if (s.fp.gradientText) agg.styleTells.gradientText++;
  if (hasPill) agg.styleTells.pill++;
  if (detectBento(s.elements)) agg.styleTells.bento++;
  if (s.fp.sparkleBadge) agg.styleTells.sparkleBadge++;

  // gradients
  for (const g of siteGradientPairs) agg.gradients.set(g, (agg.gradients.get(g) ?? 0) + 1);

  // animation
  for (const lib of new Set(s.fp.animationLibs)) agg.animLibs.set(lib, (agg.animLibs.get(lib) ?? 0) + 1);
  for (const a of new Set(s.fp.tailwindAnimate)) agg.tailwindAnimate.set(a, (agg.tailwindAnimate.get(a) ?? 0) + 1);
  if (hasBounceEasing) agg.animBounce++;
  if (hasLayoutPropAnim) agg.animLayoutProp++;

  // components
  for (const c of new Set(s.fp.components)) agg.components.set(c, (agg.components.get(c) ?? 0) + 1);

  // type
  for (const f of siteFonts) agg.fonts.set(f, (agg.fonts.get(f) ?? 0) + 1);
  if (uppercaseSeen) agg.uppercaseSites++;
  for (const w of siteWeights) {
    const bucket = Math.round(w / 100) * 100;
    agg.weightBuckets.set(bucket, (agg.weightBuckets.get(bucket) ?? 0) + 1);
  }
}

// ===========================================================================
// EMIT — write all observations.*.json from the aggregates.
// ===========================================================================
function sortedMap(m: Map<string, number>): Array<[string, number]> {
  return [...m.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
}

async function emit(agg: Aggregates): Promise<void> {
  const ok = agg.okSites || 1;

  // observations.colors.json — same shape corpus.mjs loads.
  const colorRecords = [...agg.colors.entries()]
    .map(([hex, sites]) => ({ hex, sites, count: sites }))
    .sort((a, b) => b.sites - a.sites || (a.hex < b.hex ? -1 : 1));
  await writeFile(resolve(DATA_DIR, "observations.colors.json"), JSON.stringify(colorRecords, null, 2));

  // observations.accents.json — {hex: siteCount}
  const accents: Record<string, number> = {};
  for (const [hex, n] of sortedMap(agg.accents)) accents[hex] = n;
  await writeFile(resolve(DATA_DIR, "observations.accents.json"), JSON.stringify(accents, null, 2));

  // observations.styles.json — % of sites with each tell
  const styles: Record<string, { sites: number; pct: number }> = {};
  for (const [k, v] of Object.entries(agg.styleTells)) {
    styles[k] = { sites: v, pct: Math.round((1000 * v) / ok) / 10 };
  }
  await writeFile(resolve(DATA_DIR, "observations.styles.json"),
    JSON.stringify({ okSites: agg.okSites, totalSites: agg.totalSites, tells: styles }, null, 2));

  // observations.gradients.json — "type:hueA->hueB" -> siteCount
  const grad: Record<string, number> = {};
  for (const [k, v] of sortedMap(agg.gradients)) grad[k] = v;
  await writeFile(resolve(DATA_DIR, "observations.gradients.json"), JSON.stringify(grad, null, 2));

  // observations.radii.json
  const radTotal = agg.radii.sharp + agg.radii.rounded + agg.radii.pill || 1;
  await writeFile(resolve(DATA_DIR, "observations.radii.json"), JSON.stringify({
    sites: agg.radii,
    pct: {
      sharp: Math.round((1000 * agg.radii.sharp) / radTotal) / 10,
      rounded: Math.round((1000 * agg.radii.rounded) / radTotal) / 10,
      pill: Math.round((1000 * agg.radii.pill) / radTotal) / 10,
    },
  }, null, 2));

  // observations.animation.json
  const libs: Record<string, number> = {};
  for (const [k, v] of sortedMap(agg.animLibs)) libs[k] = v;
  const twAnim: Record<string, number> = {};
  for (const [k, v] of sortedMap(agg.tailwindAnimate)) twAnim[k] = v;
  await writeFile(resolve(DATA_DIR, "observations.animation.json"), JSON.stringify({
    okSites: agg.okSites,
    libraries: libs,
    tailwindAnimate: twAnim,
    bounceElasticEasing: agg.animBounce,
    layoutPropAnimation: agg.animLayoutProp,
  }, null, 2));

  // observations.components.json
  const comps: Record<string, number> = {};
  for (const [k, v] of sortedMap(agg.components)) comps[k] = v;
  await writeFile(resolve(DATA_DIR, "observations.components.json"), JSON.stringify({
    okSites: agg.okSites, stacks: comps,
  }, null, 2));

  // observations.type.json
  const fonts: Record<string, number> = {};
  for (const [k, v] of sortedMap(agg.fonts)) fonts[k] = v;
  const weights: Record<string, number> = {};
  for (const [k, v] of [...agg.weightBuckets.entries()].sort((a, b) => a[0] - b[0])) weights[String(k)] = v;
  await writeFile(resolve(DATA_DIR, "observations.type.json"), JSON.stringify({
    okSites: agg.okSites,
    fonts,
    uppercaseSites: agg.uppercaseSites,
    uppercasePct: Math.round((1000 * agg.uppercaseSites) / ok) / 10,
    weightDistribution: weights,
  }, null, 2));
}

// ===========================================================================
// DRIVER — concurrency pool, incremental NDJSON, resume by skipping done hosts.
// ===========================================================================
interface Args { limit: number | null; concurrency: number; timeout: number; fresh: boolean; }
function parseArgs(argv: string[]): Args {
  const out: Args = { limit: null, concurrency: 10, timeout: 15000, fresh: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--limit") out.limit = parseInt(argv[++i], 10);
    else if (a === "--concurrency") out.concurrency = parseInt(argv[++i], 10);
    else if (a === "--timeout") out.timeout = parseInt(argv[++i], 10);
    else if (a === "--fresh") out.fresh = true;
  }
  return out;
}

function loadDoneHosts(): Map<string, SiteRaw> {
  const done = new Map<string, SiteRaw>();
  if (!existsSync(RAW_LOG)) return done;
  const txt = readFileSync(RAW_LOG, "utf8");
  for (const line of txt.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try { const rec = JSON.parse(t) as SiteRaw; done.set(rec.host, rec); } catch { /* skip partial line */ }
  }
  return done;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  await mkdir(DATA_DIR, { recursive: true });

  let sites = JSON.parse(await readFile(SITE_LIST, "utf8")) as Array<{ url: string; host: string; source: string }>;
  if (args.limit != null) sites = sites.slice(0, args.limit);

  if (args.fresh && existsSync(RAW_LOG)) await writeFile(RAW_LOG, "");
  const done = loadDoneHosts();
  const todo = sites.filter((s) => !done.has(s.host));

  console.log(`Feature crawl: ${sites.length} sites in scope, ${done.size} already done, ${todo.length} to crawl.`);
  console.log(`concurrency=${args.concurrency} timeout=${args.timeout}ms\n`);

  let completed = 0;
  if (todo.length > 0) {
    const browser = await chromium.launch({ headless: true });
    try {
      let idx = 0;
      const worker = async (): Promise<void> => {
        while (true) {
          const myIdx = idx++;
          if (myIdx >= todo.length) return;
          const s = todo[myIdx];
          let rec: SiteRaw;
          try {
            rec = await crawlSite(browser, s.host, s.url, args.timeout);
          } catch (e) {
            rec = { host: s.host, url: s.url, ok: false, error: ("driver:" + (e as Error).message).slice(0, 160),
              elements: [], fp: { components: [], animationLibs: [], tailwindAnimate: [], gradientText: false, sparkleBadge: false } };
          }
          await appendFile(RAW_LOG, JSON.stringify(rec) + "\n");
          completed++;
          const mark = rec.ok ? "ok" : "x ";
          if (completed % 10 === 0 || !rec.ok) {
            console.log(`  [${completed}/${todo.length}] ${mark} ${rec.host}${rec.ok ? ` (${rec.elements.length} els)` : " " + (rec.error ?? "")}`);
          }
        }
      };
      const pool = Array.from({ length: Math.max(1, args.concurrency) }, () => worker());
      await Promise.all(pool);
    } finally {
      await browser.close();
    }
  }

  // --- aggregate from the FULL raw log (existing + new) ---
  const all = loadDoneHosts();
  const inScope = new Set(sites.map((s) => s.host));
  const agg = newAgg();
  for (const host of inScope) {
    const rec = all.get(host);
    if (rec) aggregateSite(agg, rec);
  }
  await emit(agg);

  // --- summary ---
  console.log(`\n=== DONE ===`);
  console.log(`Sites crawled ok: ${agg.okSites}/${agg.totalSites}`);
  const ok = agg.okSites || 1;
  const pct = (n: number) => `${Math.round((1000 * n) / ok) / 10}%`;
  console.log(`\n-- headline slop stats (% of ok sites) --`);
  console.log(`  box-shadow ............ ${pct(agg.styleTells.boxShadow)}`);
  console.log(`  colored glow shadow ... ${pct(agg.styleTells.glowShadow)}`);
  console.log(`  glass (backdrop blur) . ${pct(agg.styleTells.glass)}`);
  console.log(`  text-shadow ........... ${pct(agg.styleTells.textShadow)}`);
  console.log(`  gradient-text ......... ${pct(agg.styleTells.gradientText)}`);
  console.log(`  pill / rounded-full ... ${pct(agg.styleTells.pill)}`);
  console.log(`  bento grid ............ ${pct(agg.styleTells.bento)}`);
  console.log(`  ✨ badge .............. ${pct(agg.styleTells.sparkleBadge)}`);
  console.log(`\n-- radius dist (dominant per site) --  sharp ${pct(agg.radii.sharp)}  rounded ${pct(agg.radii.rounded)}  pill ${pct(agg.radii.pill)}`);
  console.log(`\n-- top-10 dominant accent hues (hex — #sites) --`);
  for (const [hex, n] of sortedMap(agg.accents).slice(0, 10)) {
    const [L, C, H] = hexToOklch(hex);
    console.log(`  ${String(n).padStart(3)}  ${hex}  oklch(${L.toFixed(2)} ${C.toFixed(2)} ${H.toFixed(0)}) ${hueLabel(H)}`);
  }
  console.log(`\n-- top-10 fonts (family — #sites) --`);
  for (const [f, n] of sortedMap(agg.fonts).slice(0, 10)) console.log(`  ${String(n).padStart(3)}  ${f}`);
  console.log(`\n-- component stacks --`);
  for (const [c, n] of sortedMap(agg.components)) console.log(`  ${String(n).padStart(3)}  ${c}`);
  console.log(`\n-- animation libs --`);
  for (const [l, n] of sortedMap(agg.animLibs)) console.log(`  ${String(n).padStart(3)}  ${l}`);
  console.log(`\n-- tailwind animate-* --`);
  for (const [a, n] of sortedMap(agg.tailwindAnimate).slice(0, 8)) console.log(`  ${String(n).padStart(3)}  ${a}`);
  console.log(`  bounce/elastic easing: ${agg.animBounce} sites; layout-prop animation: ${agg.animLayoutProp} sites`);
  console.log(`\n-- top gradients (type:hueA->hueB — #sites) --`);
  for (const [g, n] of sortedMap(agg.gradients).slice(0, 10)) console.log(`  ${String(n).padStart(3)}  ${g}`);
  console.log(`\nWrote observations.{colors,accents,styles,gradients,radii,animation,components,type}.json to data/`);
}

main().catch((e) => { console.error(e); process.exit(1); });
