/**
 * Unified design-feature crawler — ADDITIVE companion to crawl.ts / crawl-colors.ts.
 *
 *   npx tsx src/crawl-features.ts --limit 30      # SMOKE TEST (first 30 sites)
 *   npx tsx src/crawl-features.ts                 # FULL run over data/site-list.json
 *   npx tsx src/crawl-features.ts --concurrency 10 --timeout 15000
 *   npx tsx src/crawl-features.ts --fresh         # ignore prior progress, recrawl all
 *
 * LAYOUT V2 (--layout-v2) also accepts:
 *   --rich-capture     opt-in capture recipe for lazy-load/SPA pages: networkidle
 *                       nav (falls back to domcontentloaded + wait), waits for a
 *                       semantic landmark or text-length stabilization, stubs
 *                       IntersectionObserver to fire immediately, and progressively
 *                       autoscrolls to the document bottom before extracting
 *                       geometry + screenshotting. Does NOT change the default
 *                       recipe or output paths.
 *   --raw-v2 <path>          override the raw NDJSON output path (default geometry-crawl-raw.v2.ndjson)
 *   --screenshot-dir <path>  override the screenshot output dir (default data/layout-crawl/screenshots)
 *   --only-hosts a.com,b.com restrict the run to a comma-separated host allowlist
 *
 *   npx tsx src/crawl-features.ts --layout-v2 --rich-capture --only-hosts adva-soft.com,blink.new \
 *     --raw-v2 data/geometry-crawl-raw.v3.sample.ndjson --screenshot-dir data/layout-crawl/screenshots-v3-sample
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
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { dirname, relative, resolve } from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import { UA } from "./extract.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(HERE, "../../../data");
const PROJECT_DIR = resolve(HERE, "../../..");
const SITE_LIST = resolve(DATA_DIR, "site-list.json");
const RAW_LOG = resolve(DATA_DIR, "feature-crawl-raw.ndjson");
// Versioned layout collection. The original feature crawl above is intentionally untouched.
let LAYOUT_RAW_LOG_V2 = resolve(DATA_DIR, "geometry-crawl-raw.v2.ndjson");
let LAYOUT_SCREENSHOT_DIR_V2 = resolve(DATA_DIR, "layout-crawl/screenshots");

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

type ViewportName = "desktop" | "mobile";

interface NormalizedRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface LayoutRect {
  x: number;
  y: number;
  width: number;
  height: number;
  normalized: NormalizedRect;
  areaShare: number;
}

interface LayoutElement extends ElementStyle {
  id: string;
  tag: string;
  depth: number;
  parentId: string | null;
  childCount: number;
  repeatedGroup: string | null;
  domPath: string;
  zIndex: number;
  stackingOrder: number;
  overlapIds: string[];
  sectionRole: string | null;
  headingLevel: number | null;
  landmarkRole: string | null;
  textRole: string | null;
  lineCount: number;
  measure: { widthPx: number; widthShare: number; charsPerLineEstimate: number };
  textSnippet: string;
  rect: LayoutRect;
  visibility: {
    display: string;
    visibility: string;
    opacity: number;
    inViewport: boolean;
    visibleFraction: number;
    occludedAtCenter: boolean;
  };
}

interface SectionBoundary {
  id: string;
  role: string;
  heading: string | null;
  rect: LayoutRect;
  heightShare: number;
  focalPoint: "left" | "center" | "right";
  composition: string;
}

interface AssetRecord {
  id: string;
  tag: string;
  role: string;
  sectionRole: string | null;
  alt: string | null;
  rect: LayoutRect;
  aspectRatio: number;
  naturalSize: { width: number; height: number } | null;
  objectFit: string;
  objectPosition: string;
  visible: boolean;
}

interface LayoutViewportRecord {
  viewport: { name: ViewportName; width: number; height: number; deviceScaleFactor: number };
  document: { width: number; height: number };
  elements: LayoutElement[];
  sections: SectionBoundary[];
  focalRegion: { elementId: string | null; role: string; rect: LayoutRect | null; reason: string };
  assets: AssetRecord[];
  screenshot: {
    path: string;
    viewport: { width: number; height: number };
    deviceScaleFactor: number;
    fullPage: boolean;
    capturedAt: string;
  };
}

interface ResponsiveTransform {
  desktopViewport: { width: number; height: number };
  mobileViewport: { width: number; height: number };
  stack: { count: number; examples: string[] };
  reorder: { count: number; examples: string[] };
  hideShow: { hiddenOnMobile: string[]; shownOnMobile: string[] };
  density: {
    desktopElementsPerViewport: number;
    mobileElementsPerViewport: number;
    desktopTextAreaShare: number;
    mobileTextAreaShare: number;
    change: number;
  };
  sectionChanges: Array<{ role: string; desktopHeightShare: number; mobileHeightShare: number; mobileComposition: string }>;
  summary: string;
}

interface LayoutSiteRaw {
  schemaVersion: "geometry-crawl.v2";
  host: string;
  url: string;
  ok: boolean;
  error?: string;
  capturedAt: string;
  desktop: LayoutViewportRecord | null;
  mobile: LayoutViewportRecord | null;
  responsiveTransform: ResponsiveTransform | null;
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
// LAYOUT V2 EXTRACTION - versioned geometry/semantics pass. This intentionally
// lives beside (rather than replacing) the original feature extraction above.
// ===========================================================================
async function extractLayoutViewport(page: Page, viewportName: ViewportName): Promise<LayoutViewportRecord> {
  return page.evaluate(({ max, name }) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const docWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0, vw);
    const docHeight = Math.max(
      document.documentElement.scrollHeight,
      document.body?.scrollHeight ?? 0,
      vh,
    );
    const root = document.body || document.documentElement;
    const all = Array.from(document.querySelectorAll("*"));
    const nodePath = (node: Element): string => {
      const parts: string[] = [];
      let current: Element | null = node;
      while (current && current !== document.documentElement && parts.length < 16) {
        let index = 1;
        let sibling = current.previousElementSibling;
        while (sibling) { index++; sibling = sibling.previousElementSibling; }
        parts.unshift(`${current.tagName.toLowerCase()}:nth-child(${index})`);
        current = current.parentElement;
      }
      return parts.join("/") || "body";
    };
    const compactHash = (value: string): string => {
      let hash = 2166136261;
      for (let i = 0; i < value.length; i++) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      return (hash >>> 0).toString(36);
    };
    // Keep domPath for auditability, but use a compact stable ID everywhere it is
    // referenced (parent/overlap/section/asset) so the NDJSON stays bounded.
    const idOf = (node: Element): string => `e${compactHash(nodePath(node))}`;
    const cleanText = (value: string | null | undefined, limit = 240): string =>
      (value || "").replace(/\s+/g, " ").trim().slice(0, limit);
    const metaText = (node: Element): string => cleanText([
      node.tagName,
      node.getAttribute("role"),
      node.getAttribute("aria-label"),
      node.getAttribute("id"),
      node.getAttribute("class"),
      node.getAttribute("data-section"),
      node.textContent,
    ].filter(Boolean).join(" "), 420).toLowerCase();
    const textContent = (node: Element): string => cleanText(node.textContent, 320);
    const isVisible = (node: Element, rect: DOMRect, cs: CSSStyleDeclaration): boolean =>
      cs.display !== "none" && cs.visibility !== "hidden" && parseFloat(cs.opacity || "1") > 0 &&
      rect.width > 0 && rect.height > 0;
    const rectFor = (node: Element): LayoutRect => {
      const r = node.getBoundingClientRect();
      const x = r.left + window.scrollX;
      const y = r.top + window.scrollY;
      const width = Math.max(0, r.width);
      const height = Math.max(0, r.height);
      return {
        x, y, width, height,
        normalized: {
          x: Number((x / vw).toFixed(5)),
          y: Number((y / docHeight).toFixed(5)),
          w: Number((width / vw).toFixed(5)),
          h: Number((height / docHeight).toFixed(5)),
        },
        areaShare: Number(((width * height) / (vw * docHeight)).toFixed(6)),
      };
    };
    const visibleFraction = (rect: DOMRect): number => {
      const left = Math.max(0, rect.left);
      const top = Math.max(0, rect.top);
      const right = Math.min(vw, rect.right);
      const bottom = Math.min(vh, rect.bottom);
      const visible = Math.max(0, right - left) * Math.max(0, bottom - top);
      return rect.width * rect.height ? Number((visible / (rect.width * rect.height)).toFixed(4)) : 0;
    };
    const centerOccluded = (node: Element, rect: DOMRect): boolean => {
      const x = Math.max(0, Math.min(vw - 1, rect.left + rect.width / 2));
      const y = Math.max(0, Math.min(vh - 1, rect.top + rect.height / 2));
      const top = document.elementFromPoint(x, y);
      return !!top && top !== node && !node.contains(top) && !top.contains(node);
    };
    const roleFromText = (node: Element, index: number, rect: LayoutRect): string => {
      const tag = node.tagName.toLowerCase();
      const t = metaText(node);
      if (tag === "nav" || /\b(nav|navbar|navigation|menu|topbar)\b/.test(t)) return "nav";
      if (tag === "header") return "nav";
      if (tag === "footer" || /\b(footer|site-footer)\b/.test(t)) return "footer";
      if (/\b(pric(?:e|ing)|plans?|tiers?|billing|cost)\b/.test(t)) return "pricing";
      if (/\b(faq|frequently asked|questions?|accordion)\b/.test(t)) return "faq";
      if (/\b(proof|trusted|customers?|testimonials?|reviews?|case stud(?:y|ies)|logos?|results?|social proof)\b/.test(t)) return "proof";
      if (/\b(features?|benefits?|capabilities?|use cases?|workflows?|how it works)\b/.test(t)) return "features";
      if (/\b(cta|call.to.action|get started|sign up|signup|book a demo|contact us|try it|start free)\b/.test(t)) return "cta";
      if (/\b(hero|masthead|marquee|banner|above.fold|intro)\b/.test(t)) return "hero";
      if (index === 0 && rect.y < 0.18 && rect.height > 0.08) return "hero";
      return "unknown";
    };
    const focalPointFor = (rect: LayoutRect): "left" | "center" | "right" => {
      const center = rect.x + rect.width / 2;
      if (center < vw * 0.39) return "left";
      if (center > vw * 0.61) return "right";
      return "center";
    };
    const compositionFor = (node: Element, rect: LayoutRect): string => {
      const cs = getComputedStyle(node);
      const children = Array.from(node.children).filter((child) => {
        const r = child.getBoundingClientRect();
        return r.width > 20 && r.height > 20 && getComputedStyle(child).display !== "none";
      });
      const hasImage = !!node.querySelector("img,svg,video,canvas,[role='img']");
      const hasText = !!node.querySelector("h1,h2,h3,h4,h5,h6,p");
      const row = cs.display === "flex" && cs.flexDirection !== "column" ||
        cs.display === "grid" && /repeat|\d+fr|auto auto/.test(cs.gridTemplateColumns);
      if (hasImage && hasText && row) return "figure-plus-text";
      if (row && children.length >= 2) return "split";
      if (hasImage && hasText) return "media-led-stack";
      if (children.length >= 4) return "repeated-module-stack";
      if (node.querySelector("button,a")) return "content-plus-action";
      if (rect.width >= vw * 0.92) return "full-width-band";
      return "stack";
    };
    const sectionSelector = "header,nav,main,section,article,aside,footer,[role='region'],[data-section]";
    const sectionNodes = Array.from(document.querySelectorAll(sectionSelector)).filter((node) => {
      const cs = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return isVisible(node, rect, cs) && rect.height >= 24;
    });
    const sectionByNode = new Map<Element, { id: string; role: string; rect: LayoutRect }>();
    const sectionRecords: SectionBoundary[] = [];
    const seenSections = new Set<string>();
    for (let i = 0; i < sectionNodes.length; i++) {
      const node = sectionNodes[i];
      if (!node) continue;
      const id = idOf(node);
      if (seenSections.has(id)) continue;
      seenSections.add(id);
      const rect = rectFor(node);
      const role = roleFromText(node, i, rect);
      const heading = node.querySelector("h1,h2,h3,h4,h5,h6");
      const record: SectionBoundary = {
        id,
        role,
        heading: heading ? cleanText(heading.textContent, 180) : null,
        rect,
        heightShare: Number((rect.height / docHeight).toFixed(5)),
        focalPoint: focalPointFor(rect),
        composition: compositionFor(node, rect),
      };
      sectionByNode.set(node, { id, role, rect });
      sectionRecords.push(record);
    }
    // A section-like div often carries the actual hero/features boundary. Add only
    // large, direct children of main when semantic sections are absent.
    if (!sectionRecords.some((s) => s.role === "hero")) {
      const heroCandidate = Array.from(root.querySelectorAll("div")).find((node) => {
        const rect = node.getBoundingClientRect();
        return rect.top < vh * 1.4 && rect.height > vh * 0.22 && !!node.querySelector("h1,h2");
      });
      if (heroCandidate) {
        const id = idOf(heroCandidate);
        const rect = rectFor(heroCandidate);
        const hero: SectionBoundary = {
          id,
          role: "hero",
          heading: heroCandidate.querySelector("h1,h2") ? cleanText(heroCandidate.querySelector("h1,h2")!.textContent, 180) : null,
          rect,
          heightShare: Number((rect.height / docHeight).toFixed(5)),
          focalPoint: focalPointFor(rect),
          composition: compositionFor(heroCandidate, rect),
        };
        sectionRecords.push(hero);
        sectionByNode.set(heroCandidate, { id, role: "hero", rect });
      }
    }
    sectionRecords.sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x);
    const sectionFor = (node: Element): { id: string; role: string } | null => {
      let best: { id: string; role: string; area: number } | null = null;
      for (const [section, info] of sectionByNode) {
        if (!section.contains(node) && section !== node) continue;
        const area = info.rect.width * info.rect.height;
        if (!best || area < best.area) best = { ...info, area };
      }
      return best ? { id: best.id, role: best.role } : null;
    };
    const selectedSelector = "body,main,header,nav,section,article,aside,footer,h1,h2,h3,h4,h5,h6,p,a,span,li,button,code,pre,blockquote,div,figcaption,label,img,svg,video,canvas,[role='img']";
    const selectedNodes = Array.from(document.querySelectorAll(selectedSelector)).filter((node) => {
      const rect = node.getBoundingClientRect();
      const cs = getComputedStyle(node);
      const text = textContent(node);
      // Keep semantically meaningful hidden nodes so the desktop/mobile diff can
      // report hide/show transforms instead of silently losing them.
      if (!isVisible(node, rect, cs)) {
        return text.length >= 2 || /^(NAV|HEADER|MAIN|SECTION|ARTICLE|ASIDE|FOOTER|H[1-6]|BUTTON|A|IMG|SVG|VIDEO|CANVAS)$/.test(node.tagName);
      }
      return text.length >= 2 || rect.width * rect.height > 3000 || /^(IMG|SVG|VIDEO|CANVAS)$/.test(node.tagName);
    }).slice(0, max);
    const selectedSet = new Set(selectedNodes);
    const nearestSelectedParent = (node: Element): Element | null => {
      let parent = node.parentElement;
      while (parent) {
        if (selectedSet.has(parent)) return parent;
        parent = parent.parentElement;
      }
      return null;
    };
    const textRoleFor = (node: Element, text: string): string | null => {
      if (!text) return null;
      const tag = node.tagName.toLowerCase();
      if (/^h[1-6]$/.test(tag)) return "heading";
      if (tag === "label" || /\b(label|eyebrow|kicker|caption|meta)\b/.test(metaText(node))) return "label";
      if (tag === "button" || node.getAttribute("role") === "button" ||
        (tag === "a" && /\b(get started|sign up|signup|buy|try|demo|contact|learn more|start)\b/i.test(text))) return "cta";
      if (tag === "p" || tag === "blockquote" || tag === "li" || tag === "article") return "body";
      return text.length > 18 ? "body" : "label";
    };
    const landmarkFor = (node: Element): string | null => {
      const explicit = node.getAttribute("role");
      if (explicit && /^(navigation|banner|main|contentinfo|complementary|region)$/.test(explicit)) return explicit;
      const tag = node.tagName.toLowerCase();
      if (["nav", "header", "main", "footer", "aside"].includes(tag)) return tag === "header" ? "banner" : tag === "footer" ? "contentinfo" : tag;
      return null;
    };
    const headingLevelFor = (node: Element): number | null => {
      const match = node.tagName.toLowerCase().match(/^h([1-6])$/);
      return match ? Number(match[1]) : null;
    };
    const repeatedSignature = (node: Element): string => {
      const cls = cleanText(node.getAttribute("class"), 100).toLowerCase()
        .replace(/[a-f0-9]{5,}/g, "#hash").replace(/\d+/g, "#n");
      const children = Array.from(node.children).slice(0, 8).map((child) => child.tagName.toLowerCase()).join(",");
      return `${node.tagName.toLowerCase()}|${cls}|${children}`;
    };
    const signatures = new Map<string, number>();
    for (const node of selectedNodes) signatures.set(repeatedSignature(node), (signatures.get(repeatedSignature(node)) || 0) + 1);
    const groupIds = new Map<string, string>();
    let groupIndex = 0;
    for (const [signature, count] of signatures) if (count >= 2) groupIds.set(signature, `repeat-${++groupIndex}`);
    const lineMeasure = (node: Element, rect: DOMRect, cs: CSSStyleDeclaration): { lineCount: number; measure: { widthPx: number; widthShare: number; charsPerLineEstimate: number } } => {
      const text = textContent(node);
      let lineCount = 0;
      try {
        const range = document.createRange();
        range.selectNodeContents(node);
        lineCount = range.getClientRects().length;
      } catch { /* some shadow/custom elements do not expose a range */ }
      const lineHeight = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.35 || 16;
      if (!lineCount && text) lineCount = Math.max(1, Math.round(rect.height / lineHeight));
      const fontSize = parseFloat(cs.fontSize) || 16;
      return {
        lineCount: Math.max(0, lineCount),
        measure: {
          widthPx: Number(rect.width.toFixed(2)),
          widthShare: Number((rect.width / vw).toFixed(5)),
          charsPerLineEstimate: text ? Math.max(1, Math.round((rect.width / fontSize) * 1.8)) : 0,
        },
      };
    };
    const rawElements = selectedNodes.map((node, index) => {
      const rectDom = node.getBoundingClientRect();
      const rect = rectFor(node);
      const cs = getComputedStyle(node);
      const directText = Array.from(node.childNodes).filter((child) => child.nodeType === 3).map((child) => child.textContent || "").join(" ");
      const text = textContent(node);
      const parent = nearestSelectedParent(node);
      const section = sectionFor(node);
      const lm = lineMeasure(node, rectDom, cs);
      const borderW = parseFloat(cs.borderTopWidth) || 0;
      const z = cs.zIndex === "auto" ? 0 : parseInt(cs.zIndex) || 0;
      return {
        node,
        id: idOf(node),
        tag: node.tagName.toLowerCase(),
        depth: nodePath(node).split("/").length,
        parentId: parent ? idOf(parent) : null,
        childCount: node.children.length,
        repeatedGroup: groupIds.get(repeatedSignature(node)) || null,
        domPath: nodePath(node),
        zIndex: z,
        stackingOrder: index,
        overlapIds: [] as string[],
        sectionRole: section?.role || null,
        headingLevel: headingLevelFor(node),
        landmarkRole: landmarkFor(node),
        textRole: textRoleFor(node, text),
        lineCount: lm.lineCount,
        measure: lm.measure,
        textSnippet: cleanText(directText || text, 200),
        rect,
        visibility: {
          display: cs.display,
          visibility: cs.visibility,
          opacity: Number((parseFloat(cs.opacity || "1") || 0).toFixed(3)),
          inViewport: rectDom.bottom > 0 && rectDom.top < vh,
          visibleFraction: visibleFraction(rectDom),
          occludedAtCenter: centerOccluded(node, rectDom),
        },
        color: cs.color,
        backgroundColor: cs.backgroundColor,
        borderColor: borderW > 0 ? cs.borderTopColor : null,
        backgroundImage: cs.backgroundImage,
        boxShadow: cs.boxShadow,
        textShadow: cs.textShadow,
        filter: cs.filter,
        backdropFilter: (cs as any).backdropFilter || (cs as any).webkitBackdropFilter || "none",
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
        aboveFold: rectDom.top < vh && rectDom.bottom > 0,
      };
    });
    const overlapArea = (a: LayoutRect, b: LayoutRect): number => {
      const left = Math.max(a.x, b.x);
      const top = Math.max(a.y, b.y);
      const right = Math.min(a.x + a.width, b.x + b.width);
      const bottom = Math.min(a.y + a.height, b.y + b.height);
      return Math.max(0, right - left) * Math.max(0, bottom - top);
    };
    const isAncestor = (a: Element, b: Element): boolean => a !== b && a.contains(b);
    for (let i = 0; i < rawElements.length; i++) {
      for (let j = i + 1; j < rawElements.length; j++) {
        const a = rawElements[i]; const b = rawElements[j];
        if (!a || !b) continue;
        if (isAncestor(a.node, b.node) || isAncestor(b.node, a.node)) continue;
        const inter = overlapArea(a.rect, b.rect);
        const threshold = Math.max(16, Math.min(a.rect.width * a.rect.height, b.rect.width * b.rect.height) * 0.02);
        if (inter > threshold) {
          if (a.overlapIds.length < 12) a.overlapIds.push(b.id);
          if (b.overlapIds.length < 12) b.overlapIds.push(a.id);
        }
      }
    }
    const sectionForRole = (node: Element): string | null => sectionFor(node)?.role || null;
    const assetRoleFor = (node: Element, sectionRole: string | null): string => {
      const text = metaText(node);
      const alt = cleanText(node.getAttribute("alt"), 160).toLowerCase();
      if (/logo|wordmark|brand/.test(text + " " + alt)) return "logo";
      if (/screenshot|mockup|product|ui|dashboard|app/.test(text + " " + alt)) return "product-screenshot";
      if (/diagram|chart|graph|flow|system|architecture/.test(text + " " + alt)) return "diagram";
      if (sectionRole === "proof") return "proof-logo-or-badge";
      if (sectionRole === "hero" || sectionRole === "marquee") return "hero-visual";
      if (!alt) return "decorative-asset";
      return "content-image";
    };
    const assets: AssetRecord[] = [];
    for (const node of Array.from(document.querySelectorAll("img,video,canvas,svg,[role='img']"))) {
      const rectDom = node.getBoundingClientRect();
      const cs = getComputedStyle(node);
      if (!isVisible(node, rectDom, cs)) continue;
      const rect = rectFor(node);
      const image = node as HTMLImageElement;
      const video = node as HTMLVideoElement;
      const naturalWidth = image.naturalWidth || video.videoWidth || 0;
      const naturalHeight = image.naturalHeight || video.videoHeight || 0;
      assets.push({
        id: idOf(node),
        tag: node.tagName.toLowerCase(),
        role: assetRoleFor(node, sectionForRole(node)),
        sectionRole: sectionForRole(node),
        alt: node.getAttribute("alt"),
        rect,
        aspectRatio: Number(((naturalWidth && naturalHeight ? naturalWidth / naturalHeight : rect.width / Math.max(1, rect.height))).toFixed(5)),
        naturalSize: naturalWidth && naturalHeight ? { width: naturalWidth, height: naturalHeight } : null,
        objectFit: cs.objectFit || "fill",
        objectPosition: cs.objectPosition || "50% 50%",
        visible: rectDom.bottom > 0 && rectDom.top < vh,
      });
    }
    const focalCandidates = sectionRecords.filter((s) => ["hero", "marquee", "proof", "features", "cta"].includes(s.role));
    focalCandidates.sort((a, b) => {
      const score = (s: SectionBoundary): number => (s.role === "hero" || s.role === "marquee" ? 1.6 : 1) * s.rect.areaShare;
      return score(b) - score(a);
    });
    const focal = focalCandidates[0] || sectionRecords[0] || null;
    const focalRegion = focal
      ? { elementId: focal.id, role: focal.role, rect: focal.rect, reason: focal.role === "hero" ? "hero-section" : "largest-semantic-section" }
      : { elementId: null, role: "unknown", rect: null, reason: "no-semantic-region" };
    const elements = rawElements.map(({ node: _node, ...element }) => element);
    return {
      viewport: { name, width: vw, height: vh, deviceScaleFactor: window.devicePixelRatio || 1 },
      document: { width: docWidth, height: docHeight },
      elements,
      sections: sectionRecords,
      focalRegion,
      assets,
      screenshot: {
        path: "",
        viewport: { width: vw, height: vh },
        deviceScaleFactor: window.devicePixelRatio || 1,
        fullPage: true,
        capturedAt: "",
      },
    };
  }, { max: MAX_ELEMENTS, name: viewportName });
}

const LAYOUT_VIEWPORTS: Array<{ name: ViewportName; width: number; height: number }> = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

function screenshotSlug(host: string): string {
  return host.toLowerCase().replace(/[^a-z0-9.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 160) || "site";
}

function relativeDataPath(absolutePath: string): string {
  return relative(PROJECT_DIR, absolutePath).replace(/\\/g, "/");
}

async function crawlLayoutViewport(
  browser: Browser,
  host: string,
  url: string,
  viewport: { name: ViewportName; width: number; height: number },
  timeoutMs: number,
  richCapture = false,
): Promise<{ layout: LayoutViewportRecord; fp: PageFingerprint } | null> {
  let context;
  try {
    context = await browser.newContext({
      userAgent: UA,
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
    });
    await context.addInitScript({ content: "window.__name=window.__name||function(f){return f;};" });
    // Keep images and CSS available for truthful geometry, asset metadata, and screenshots.
    // Abort only media streams, which otherwise make long pages hang indefinitely.
    await context.route("**/*", (route) => {
      if (route.request().resourceType() === "media") return route.abort();
      return route.continue();
    });
    const page = await context.newPage();
    if (richCapture) {
      // Belt-and-braces: stub IntersectionObserver so below-the-fold content
      // gated on IO (lazy images, reveal-on-scroll sections) hydrates even on
      // SPAs whose own IO never fires headless without real scroll/paint timing.
      await page.addInitScript(() => {
        class IOStub {
          private cb: IntersectionObserverCallback;
          constructor(cb: IntersectionObserverCallback) {
            this.cb = cb;
          }
          observe(el: Element): void {
            Promise.resolve().then(() => {
              this.cb(
                [
                  {
                    target: el,
                    isIntersecting: true,
                    intersectionRatio: 1,
                    boundingClientRect: el.getBoundingClientRect(),
                    intersectionRect: el.getBoundingClientRect(),
                    rootBounds: null,
                    time: performance.now(),
                  } as IntersectionObserverEntry,
                ],
                this as unknown as IntersectionObserver,
              );
            });
          }
          unobserve(): void {}
          disconnect(): void {}
          takeRecords(): IntersectionObserverEntry[] {
            return [];
          }
        }
        // @ts-expect-error headless lazy-load hydration stub, not a real IO
        window.IntersectionObserver = IOStub;
      });
      // Navigate and wait for network idle so SPA hydration/XHR-driven content
      // has a chance to settle; fall back to domcontentloaded + explicit wait
      // if the site never goes idle (streaming/polling pages, etc).
      try {
        await page.goto(url, { waitUntil: "networkidle", timeout: timeoutMs });
      } catch {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs }).catch(() => undefined);
        await page.waitForTimeout(1200);
      }
      // Wait for real content: race a semantic landmark against the visible
      // text length settling, whichever resolves first.
      await Promise.race([
        page.waitForSelector("h1, main, [role=main]", { timeout: Math.min(timeoutMs, 6000) }).catch(() => undefined),
        (async () => {
          let prevLen = -1;
          for (let i = 0; i < 10; i++) {
            const len = await page.evaluate(() => document.body?.innerText?.length || 0).catch(() => 0);
            if (len > 0 && len === prevLen) return;
            prevLen = len;
            await page.waitForTimeout(300);
          }
        })(),
      ]);
      // Progressive autoscroll to document bottom in viewport-height steps —
      // fires real (non-stubbed) IO callbacks and scroll-keyed lazy-loaders —
      // then settle back at the top before extracting geometry/screenshotting.
      await page
        .evaluate(async () => {
          const step = Math.max(200, window.innerHeight);
          let y = 0;
          const total = () => document.documentElement.scrollHeight;
          while (y < total()) {
            y += step;
            window.scrollTo(0, y);
            await new Promise((r) => setTimeout(r, 220));
          }
          window.scrollTo(0, 0);
        })
        .catch(() => undefined);
      await page.waitForTimeout(500);
    } else {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
      await page.waitForTimeout(1200);
    }
    await page.evaluate(async () => {
      if (document.fonts?.ready) await document.fonts.ready.catch(() => undefined);
    }).catch(() => undefined);
    const layout = await extractLayoutViewport(page, viewport.name);
    // The legacy fingerprint is retained for compatibility, but only compute it
    // once per page (desktop). The v2 geometry pass already owns both viewports.
    const fp = viewport.name === "desktop"
      ? (await extractFeatures(page)).fp
      : { components: [], animationLibs: [], tailwindAnimate: [], gradientText: false, sparkleBadge: false };
    const capturedAt = new Date().toISOString();
    const screenshotDir = resolve(LAYOUT_SCREENSHOT_DIR_V2, screenshotSlug(host));
    await mkdir(screenshotDir, { recursive: true });
    const screenshotPath = resolve(screenshotDir, `${viewport.name}-${viewport.width}x${viewport.height}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true, animations: "disabled" });
    layout.screenshot = {
      path: relativeDataPath(screenshotPath),
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
      fullPage: true,
      capturedAt,
    };
    return { layout, fp };
  } catch {
    return null;
  } finally {
    if (context) await context.close().catch(() => {});
  }
}

function compareResponsive(desktop: LayoutViewportRecord, mobile: LayoutViewportRecord): ResponsiveTransform {
  const desktopMap = new Map(desktop.elements.map((element) => [element.domPath, element]));
  const mobileMap = new Map(mobile.elements.map((element) => [element.domPath, element]));
  const hiddenOnMobile: string[] = [];
  const shownOnMobile: string[] = [];
  for (const [path, element] of desktopMap) {
    const other = mobileMap.get(path);
    if (!other || (element.visibility.opacity > 0 && other.visibility.opacity === 0)) hiddenOnMobile.push(path);
  }
  for (const [path, element] of mobileMap) {
    const other = desktopMap.get(path);
    if (!other || (element.visibility.opacity > 0 && other.visibility.opacity === 0)) shownOnMobile.push(path);
  }
  const stackExamples: string[] = [];
  const common = [...desktopMap.entries()].filter(([path]) => mobileMap.has(path));
  for (const [path, d] of common) {
    const m = mobileMap.get(path)!;
    if (d.rect.width < desktop.viewport.width * 0.72 && m.rect.width > mobile.viewport.width * 0.84 &&
      d.rect.height > 0 && m.rect.height > 0 && (d.sectionRole || "") === (m.sectionRole || "")) {
      stackExamples.push(path);
    }
    if (stackExamples.length >= 24) break;
  }
  const reorderExamples: string[] = [];
  const groups = new Map<string, Array<[string, LayoutElement]>>();
  for (const [path, d] of common) {
    const key = d.sectionRole || "page";
    const list = groups.get(key) || [];
    list.push([path, d]);
    groups.set(key, list);
  }
  for (const [role, entries] of groups) {
    if (entries.length < 2) continue;
    const desktopOrder = [...entries].sort((a, b) => a[1].rect.y - b[1].rect.y || a[1].rect.x - b[1].rect.x).map(([path]) => path);
    const mobileOrder = entries.map(([path]) => [path, mobileMap.get(path)!] as [string, LayoutElement])
      .sort((a, b) => a[1].rect.y - b[1].rect.y || a[1].rect.x - b[1].rect.x).map(([path]) => path);
    if (desktopOrder.join("|") !== mobileOrder.join("|")) {
      reorderExamples.push(`${role}:${desktopOrder.slice(0, 4).join(",")} -> ${mobileOrder.slice(0, 4).join(",")}`);
    }
  }
  const desktopTextArea = Math.min(1, desktop.elements.filter((e) => e.textRole === "heading" || e.textRole === "body")
    .reduce((sum, e) => sum + e.rect.areaShare, 0));
  const mobileTextArea = Math.min(1, mobile.elements.filter((e) => e.textRole === "heading" || e.textRole === "body")
    .reduce((sum, e) => sum + e.rect.areaShare, 0));
  const desktopDensity = desktop.elements.length / Math.max(1, desktop.document.height / desktop.viewport.height);
  const mobileDensity = mobile.elements.length / Math.max(1, mobile.document.height / mobile.viewport.height);
  const sectionChanges: ResponsiveTransform["sectionChanges"] = [];
  const mobileSections = new Map(mobile.sections.map((s) => [s.role, s]));
  for (const section of desktop.sections) {
    const other = mobileSections.get(section.role);
    if (!other) continue;
    sectionChanges.push({
      role: section.role,
      desktopHeightShare: section.heightShare,
      mobileHeightShare: other.heightShare,
      mobileComposition: other.composition,
    });
  }
  const summaryParts: string[] = [];
  if (stackExamples.length) summaryParts.push(`${stackExamples.length} blocks widen/stack`);
  if (reorderExamples.length) summaryParts.push(`${reorderExamples.length} regions reorder`);
  if (hiddenOnMobile.length) summaryParts.push(`${hiddenOnMobile.length} elements hide`);
  if (shownOnMobile.length) summaryParts.push(`${shownOnMobile.length} elements appear`);
  summaryParts.push(`density ${desktopDensity.toFixed(1)} -> ${mobileDensity.toFixed(1)}`);
  return {
    desktopViewport: { width: desktop.viewport.width, height: desktop.viewport.height },
    mobileViewport: { width: mobile.viewport.width, height: mobile.viewport.height },
    stack: { count: stackExamples.length, examples: stackExamples },
    reorder: { count: reorderExamples.length, examples: reorderExamples },
    hideShow: { hiddenOnMobile: hiddenOnMobile.slice(0, 80), shownOnMobile: shownOnMobile.slice(0, 80) },
    density: {
      desktopElementsPerViewport: Number(desktopDensity.toFixed(4)),
      mobileElementsPerViewport: Number(mobileDensity.toFixed(4)),
      desktopTextAreaShare: Number(desktopTextArea.toFixed(5)),
      mobileTextAreaShare: Number(mobileTextArea.toFixed(5)),
      change: Number((mobileDensity - desktopDensity).toFixed(4)),
    },
    sectionChanges,
    summary: summaryParts.join("; "),
  };
}

async function crawlLayoutSite(browser: Browser, host: string, url: string, timeoutMs: number, richCapture = false): Promise<LayoutSiteRaw> {
  const captures: Partial<Record<ViewportName, { layout: LayoutViewportRecord; fp: PageFingerprint }>> = {};
  for (const viewport of LAYOUT_VIEWPORTS) {
    const capture = await crawlLayoutViewport(browser, host, url, viewport, timeoutMs, richCapture);
    if (capture) captures[viewport.name] = capture;
  }
  const desktop = captures.desktop?.layout || null;
  const mobile = captures.mobile?.layout || null;
  const ok = !!desktop || !!mobile;
  return {
    schemaVersion: "geometry-crawl.v2",
    host,
    url,
    ok,
    ...(ok ? {} : { error: "both fixed viewport captures failed" }),
    capturedAt: new Date().toISOString(),
    desktop,
    mobile,
    responsiveTransform: desktop && mobile ? compareResponsive(desktop, mobile) : null,
    fp: captures.desktop?.fp || captures.mobile?.fp || {
      components: [], animationLibs: [], tailwindAnimate: [], gradientText: false, sparkleBadge: false,
    },
  };
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
interface Args {
  limit: number | null;
  concurrency: number;
  timeout: number;
  fresh: boolean;
  layoutV2: boolean;
  rawV2: string | null;
  retryPartial: boolean;
  richCapture: boolean;
  screenshotDir: string | null;
  onlyHosts: string[] | null;
}
function parseArgs(argv: string[]): Args {
  const out: Args = {
    limit: null,
    concurrency: 10,
    timeout: 15000,
    fresh: false,
    layoutV2: false,
    rawV2: null,
    retryPartial: false,
    richCapture: false,
    screenshotDir: null,
    onlyHosts: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--limit") out.limit = parseInt(argv[++i], 10);
    else if (a === "--concurrency") out.concurrency = parseInt(argv[++i], 10);
    else if (a === "--timeout") out.timeout = parseInt(argv[++i], 10);
    else if (a === "--fresh") out.fresh = true;
    else if (a === "--layout-v2") out.layoutV2 = true;
    else if (a === "--raw-v2") out.rawV2 = argv[++i] || null;
    else if (a === "--retry-partial") out.retryPartial = true;
    // New capture recipe (networkidle nav + content wait + autoscroll +
    // IntersectionObserver stub). Opt-in: does not change default behavior
    // or default output paths.
    else if (a === "--rich-capture") out.richCapture = true;
    else if (a === "--screenshot-dir") out.screenshotDir = argv[++i] || null;
    // Comma-separated host allowlist, for targeted re-crawl samples.
    else if (a === "--only-hosts") out.onlyHosts = (argv[++i] || "").split(",").map((h) => h.trim()).filter(Boolean);
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

async function loadDoneLayoutHosts(): Promise<Set<string>> {
  const done = new Set<string>();
  if (!existsSync(LAYOUT_RAW_LOG_V2)) return done;
  const input = createReadStream(LAYOUT_RAW_LOG_V2, { encoding: "utf8" });
  const lines = createInterface({ input, crlfDelay: Infinity });
  for await (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    // Host IDs are intentionally simple site-list hostnames. Extract only the
    // small resume key instead of parsing a potentially multi-megabyte JSON line.
    const host = t.match(/"host":"([^"]+)"/)?.[1];
    if (t.includes('"schemaVersion":"geometry-crawl.v2"') && host) done.add(host);
  }
  return done;
}

async function summarizeLayoutRaw(sites: Array<{ host: string }>): Promise<{ records: number; ok: number; desktop: number; mobile: number; both: number }> {
  const scoped = new Set(sites.map((site) => site.host));
  const counts = { records: 0, ok: 0, desktop: 0, mobile: 0, both: 0 };
  if (!existsSync(LAYOUT_RAW_LOG_V2)) return counts;
  const input = createReadStream(LAYOUT_RAW_LOG_V2, { encoding: "utf8" });
  const lines = createInterface({ input, crlfDelay: Infinity });
  for await (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    const host = t.match(/"host":"([^"]+)"/)?.[1];
    if (!t.includes('"schemaVersion":"geometry-crawl.v2"') || !host || !scoped.has(host)) continue;
    const hasDesktop = t.includes('"desktop":{');
    const hasMobile = t.includes('"mobile":{');
    counts.records++;
    if (t.includes('"ok":true,"capturedAt"')) counts.ok++;
    if (hasDesktop) counts.desktop++;
    if (hasMobile) counts.mobile++;
    if (hasDesktop && hasMobile) counts.both++;
  }
  return counts;
}

async function loadIncompleteLayoutHosts(): Promise<Set<string>> {
  const states = new Map<string, { desktop: boolean; mobile: boolean }>();
  if (!existsSync(LAYOUT_RAW_LOG_V2)) return new Set();
  const input = createReadStream(LAYOUT_RAW_LOG_V2, { encoding: "utf8" });
  const lines = createInterface({ input, crlfDelay: Infinity });
  for await (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    const host = t.match(/"host":"([^"]+)"/)?.[1];
    if (!host || !t.includes('"schemaVersion":"geometry-crawl.v2"')) continue;
    const current = states.get(host) || { desktop: false, mobile: false };
    current.desktop ||= t.includes('"desktop":{');
    current.mobile ||= t.includes('"mobile":{');
    states.set(host, current);
  }
  return new Set([...states].filter(([, state]) => !state.desktop || !state.mobile).map(([host]) => host));
}

async function mainLayoutV2(args: Args): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await mkdir(LAYOUT_SCREENSHOT_DIR_V2, { recursive: true });
  let sites = JSON.parse(await readFile(SITE_LIST, "utf8")) as Array<{ url: string; host: string; source: string }>;
  if (args.onlyHosts && args.onlyHosts.length) {
    const allow = new Set(args.onlyHosts);
    sites = sites.filter((s) => allow.has(s.host));
  }
  if (args.limit != null) sites = sites.slice(0, args.limit);
  if (args.fresh && existsSync(LAYOUT_RAW_LOG_V2)) await writeFile(LAYOUT_RAW_LOG_V2, "");
  const done = await loadDoneLayoutHosts();
  const partial = args.retryPartial ? await loadIncompleteLayoutHosts() : new Set<string>();
  const seenTodo = new Set<string>();
  const todo = sites.filter((site) => {
    if ((done.has(site.host) && !partial.has(site.host)) || seenTodo.has(site.host)) return false;
    seenTodo.add(site.host);
    return true;
  });
  console.log(`Layout v2 crawl: ${sites.length} sites in scope, ${done.size} already done, ${todo.length} to crawl.`);
  console.log(`viewports=1440x900 + 390x844 concurrency=${args.concurrency} timeout=${args.timeout}ms\n`);
  let completed = 0;
  if (todo.length > 0) {
    const browser = await chromium.launch({ headless: true });
    try {
      let index = 0;
      let appendTail = Promise.resolve();
      const worker = async (): Promise<void> => {
        while (true) {
          const myIndex = index++;
          if (myIndex >= todo.length) return;
          const site = todo[myIndex];
          let record: LayoutSiteRaw;
          try {
            record = await crawlLayoutSite(browser, site.host, site.url, args.timeout, args.richCapture);
          } catch (e) {
            record = {
              schemaVersion: "geometry-crawl.v2",
              host: site.host,
              url: site.url,
              ok: false,
              error: ("driver:" + (e as Error).message).slice(0, 240),
              capturedAt: new Date().toISOString(),
              desktop: null,
              mobile: null,
              responsiveTransform: null,
              fp: { components: [], animationLibs: [], tailwindAnimate: [], gradientText: false, sparkleBadge: false },
            };
          }
          // Serialize large NDJSON writes. Concurrent appendFile calls can
          // interleave multi-megabyte records on Windows, corrupting lines.
          const serialized = JSON.stringify(record) + "\n";
          appendTail = appendTail.then(() => appendFile(LAYOUT_RAW_LOG_V2, serialized));
          await appendTail;
          completed++;
          const mark = record.ok ? "ok" : "x ";
          if (completed % 10 === 0 || !record.ok) {
            const captures = [record.desktop ? "D" : "-", record.mobile ? "M" : "-"].join("");
            console.log(`  [${completed}/${todo.length}] ${mark} ${record.host} ${captures}` + (record.error ? ` ${record.error}` : ""));
          }
        }
      };
      const pool = Array.from({ length: Math.max(1, args.concurrency) }, () => worker());
      await Promise.all(pool);
    } finally {
      await browser.close();
    }
  }
  const summary = await summarizeLayoutRaw(sites);
  console.log(`\n=== LAYOUT V2 DONE ===`);
  console.log(`records=${summary.records} ok=${summary.ok} desktop=${summary.desktop} mobile=${summary.mobile} paired=${summary.both}`);
  console.log(`raw=${relativeDataPath(LAYOUT_RAW_LOG_V2)}`);
  console.log(`screenshots=${relativeDataPath(LAYOUT_SCREENSHOT_DIR_V2)}`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.rawV2) LAYOUT_RAW_LOG_V2 = resolve(args.rawV2);
  if (args.screenshotDir) LAYOUT_SCREENSHOT_DIR_V2 = resolve(args.screenshotDir);
  if (args.layoutV2) {
    await mainLayoutV2(args);
    return;
  }
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
