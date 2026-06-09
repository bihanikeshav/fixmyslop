#!/usr/bin/env node
// structural-check.mjs — STRUCTURAL-SLOP detector.
// Usage: node structural-check.mjs page.html [page2.html ...]
//
// Statically detects which AI-monoculture STRUCTURAL markers a candidate HTML
// carries (class names + computed/inline CSS strings), then scores each present
// marker by how prevalent it is across the 1266-site feature crawl
// (data/structural-prevalence.json). The more "everyone does this" a marker is,
// the more it drags the score up.
//
// Output per file:
//   STRUCTURAL SLOP SCORE  (0-100, weighted by present markers' prevalence)
//   N of M markers hit
//   each present marker with "X% of AI sites do this too"
// Exits non-zero if any file scores above the cutoff (default 35).
//
// Reuses the static-HTML parsing idioms from slop-check.mjs (regex over the raw
// file: class names, computed-CSS strings, gradient endpoints) and the gradient
// hue band from the color work.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");

const CUTOFF = 35; // structural slop score above this => FAIL (nonzero exit)

// ---------------------------------------------------------------------------
// Prevalence table = per-marker weight. Built by build-structural-prevalence.mjs.
// ---------------------------------------------------------------------------
const prevalence = JSON.parse(
  readFileSync(resolve(ROOT, "data/structural-prevalence.json"))
);
const byMarker = Object.fromEntries(prevalence.map((r) => [r.marker, r]));
const W = (marker) => (byMarker[marker] ? byMarker[marker].sitesPct : 0);

// ---------------------------------------------------------------------------
// hex/hsl helpers (same approach as slop-check.mjs)
// ---------------------------------------------------------------------------
function hexToRgb(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}
// Is a color in the blue-purple AI slop band? (matches the crawl's gradient band
// {blue, indigo, violet, cyan} — roughly hue 185..285, saturated, mid-light.)
function inBluePurpleBand([h, s, l]) {
  if (s < 35) return false;
  return h >= 185 && h <= 285 && l >= 30 && l <= 88;
}

// ---------------------------------------------------------------------------
// Detect markers in one file. Returns { file, hits: [{marker,label,pct,why}] }.
// ---------------------------------------------------------------------------
// Resolve simple CSS custom properties (:root vars) so var(--x) references in
// shadows/gradients can still be color-classified. Many hand-built slop pages
// hide their saturated glow/gradient colors behind tokens; without this pass the
// color-band markers silently miss them. One substitution pass is enough for the
// common --token: #hex / rgba(...) case.
function resolveVars(css) {
  const vars = {};
  for (const m of css.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+);/g)) {
    vars[m[1].trim()] = m[2].trim();
  }
  return css.replace(/var\(\s*(--[\w-]+)\s*(?:,[^()]*)?\)/g, (whole, name) =>
    vars[name] !== undefined ? vars[name] : whole
  );
}

function detect(file) {
  const raw = readFileSync(file, "utf8");
  const lc = resolveVars(raw.toLowerCase());
  const hits = [];
  const hit = (marker, why) => {
    const row = byMarker[marker];
    hits.push({ marker, label: row ? row.label : marker, pct: W(marker), group: row ? row.group : "?", why });
  };

  // --- gradient-text: background-clip:text (+ a gradient present) ---
  const hasBgClipText = /-webkit-background-clip\s*:\s*text|background-clip\s*:\s*text|\btext-transparent\b|\bbg-clip-text\b/.test(lc);
  const hasGradient = /linear-gradient|radial-gradient|conic-gradient|\bbg-gradient-to-/.test(lc);
  if (hasBgClipText && hasGradient) hit("gradient-text", "background-clip:text + gradient");

  // --- glass-nav: backdrop-filter: blur (or tailwind backdrop-blur) ---
  if (/backdrop-filter\s*:\s*[^;{}]*blur|\bbackdrop-blur\b/.test(lc)) {
    hit("glass-nav", "backdrop-filter: blur");
  }

  // --- pill / rounded-full: border-radius:9999px|50%|999rem or rounded-full ---
  const pillDecls = (lc.match(/border-radius\s*:\s*(9999px|999rem|50%|50px|100px|100vh|100vmax)/g) || []).length;
  const roundedFullClasses = (lc.match(/\brounded-full\b/g) || []).length;
  if (pillDecls + roundedFullClasses >= 2) {
    hit("pill", `pill radius x${pillDecls + roundedFullClasses}`);
  }

  // --- bento heuristic: a spanning grid of ROUNDED cards. The bento tell is
  // specifically rounded tiles of mixed sizes; a plain spanning grid (sharp
  // tiles) or a grid that just happens to contain a few rounded things is not
  // a bento, so require BOTH the span signature AND multiple rounded cards. ---
  const hasGrid = /display\s*:\s*grid|\bgrid-cols-[2-9]|\bgrid-template-columns\b/.test(lc);
  const spanMix = (lc.match(/\bcol-span-\d|\brow-span-\d|grid-column\s*:|grid-row\s*:/g) || []).length >= 2;
  const roundedCards = (lc.match(/border-radius\s*:\s*(?!0)|rounded-(xl|2xl|3xl)/g) || []).length >= 3;
  if (hasGrid && spanMix && roundedCards) hit("bento", "spanning grid of rounded cards");

  // --- colored glow shadow: box/drop shadow carrying a saturated color ---
  const shadowDecls = [...lc.matchAll(/(box-shadow|drop-shadow|--[\w-]*shadow[\w-]*)[^;{}]*/g)].map((m) => m[0]);
  const coloredGlow = shadowDecls.some((d) => {
    const hs = [...d.matchAll(/#[0-9a-f]{3}(?:[0-9a-f]{3})?\b/g)].map((m) => m[0]);
    const rgbas = [...d.matchAll(/rgba?\(([^)]+)\)/g)].map((m) => m[1]);
    const satHex = hs.some((h) => { const [, s, l] = rgbToHsl(hexToRgb(h)); return s >= 40 && l >= 25; });
    const satRgba = rgbas.some((v) => {
      const p = v.split(",").map((x) => parseFloat(x));
      if (p.length < 3) return false;
      const [, s, l] = rgbToHsl(p.slice(0, 3));
      return s >= 40 && l >= 25;
    });
    return satHex || satRgba;
  });
  if (coloredGlow) hit("colored-glow-shadow", "saturated color in shadow");

  // --- box-shadow everywhere: many distinct box-shadow declarations ---
  const boxShadows = (lc.match(/box-shadow\s*:/g) || []).length + (lc.match(/\bshadow-(sm|md|lg|xl|2xl)\b/g) || []).length;
  if (boxShadows >= 5) hit("box-shadow-everywhere", `${boxShadows} box-shadow uses`);

  // --- ✨ / emoji "AI" badge ---
  const sparkle = /[✨\u{1FAE7}\u{1F31F}❇]/u.test(raw) || /\bsparkle|magicwand|\bai-badge\b/.test(lc);
  if (sparkle && /\bai\b|powered by|gpt|assistant|magic|smart/.test(lc)) {
    hit("sparkle-badge", "sparkle/emoji near AI copy");
  } else if (/[✨]/u.test(raw)) {
    hit("sparkle-badge", "✨ glyph present");
  }

  // --- Tailwind canned animate-*: pulse/ping/spin/bounce/marquee classes ---
  const cannedAnim = lc.match(/\banimate-(pulse|ping|spin|bounce|marquee)\b/g) || [];
  if (cannedAnim.length) hit("tailwind-animate-canned", `${[...new Set(cannedAnim)].join(", ")}`);

  // --- layout-prop animation: transition/animation touching layout props ---
  const animatesLayout =
    /transition\s*:[^;{}]*\b(width|height|top|left|right|bottom|margin|padding)\b/.test(lc) ||
    /transition\s*:\s*all\b/.test(lc) ||
    /@keyframes[^{}]*\{[\s\S]*?\b(width|height|top|left|right|bottom|margin|padding)\s*:/.test(lc);
  if (animatesLayout) hit("layout-prop-animation", "transition/keyframes on layout props");

  // --- bounce / elastic easing (overshoot cubic-bezier or named) ---
  const overshoot = [...lc.matchAll(/cubic-bezier\(([^)]+)\)/g)].some((m) => {
    const p = m[1].split(",").map((x) => parseFloat(x));
    return p.length === 4 && (p[1] > 1.001 || p[1] < -0.001 || p[3] > 1.001 || p[3] < -0.001);
  });
  if (overshoot || /\b(bounce|elastic)\b/.test(lc)) hit("bounce-elastic-easing", "overshoot/elastic easing");

  // --- anim lib: swiper / gsap / framer-motion / aos ---
  if (/\bswiper\b|\bgsap\b|framer-motion|framer\.|data-aos|\baos\b/.test(lc)) {
    hit("anim-lib", "scroll/anim library");
  }

  // --- stack signatures ---
  // shadcn: its data-attrs + the cn() utility-soup + radix primitives.
  const shadcn =
    /data-radix|data-slot=|class="[^"]*\b(inline-flex items-center justify-center|ring-offset-background|text-muted-foreground)\b/.test(lc) ||
    /--radius|hsl\(var\(--/.test(lc) && /\bbg-background\b|\btext-foreground\b/.test(lc);
  if (shadcn) hit("stack-shadcn", "shadcn data-attrs / utility soup");
  // Tailwind utility stack: dense atomic class strings (flex + spacing + color scale).
  const tailwindSoup =
    (lc.match(/class="[^"]*\b(flex|grid)\b[^"]*\b(items-center|justify-center|gap-\d|px-\d|py-\d)\b/g) || []).length >= 3 ||
    /\b(bg-gradient-to-|text-\w+-\d{3}|rounded-(xl|2xl|3xl)|backdrop-blur)\b/.test(lc) && /class="[^"]*\bflex\b/.test(lc);
  if (tailwindSoup) hit("stack-tailwind", "Tailwind atomic class soup");
  // Bootstrap: its DISTINCTIVE grid/component classes. `btn btn-primary` and
  // `d-flex` alone are too generic (hand-rolled BEM uses them too), so require a
  // Bootstrap-specific grid/nav/utility signature.
  const bootstrap =
    /\b(container-fluid|navbar-expand-(sm|md|lg|xl|xxl)|col-(sm|md|lg|xl|xxl)-\d{1,2})\b/.test(lc) ||
    (/\brow\b/.test(lc) && /\bcol-\d{1,2}\b/.test(lc) && /\bbtn-(primary|secondary|outline-)/.test(lc));
  if (bootstrap) hit("stack-bootstrap", "Bootstrap grid/component classes");

  // --- gradient endpoints landing in the blue-purple band ---
  let bandGradient = false;
  for (const m of lc.matchAll(/(linear|radial|conic)-gradient\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g)) {
    const body = m[2];
    const hexes = [...body.matchAll(/#[0-9a-f]{3}(?:[0-9a-f]{3})?\b/g)].map((x) => x[0]);
    const inBand = hexes.some((h) => inBluePurpleBand(rgbToHsl(hexToRgb(h))));
    // also catch tailwind from-/to- blue/indigo/violet/cyan utility gradients
    const utilBand = /\b(from|via|to)-(blue|indigo|violet|purple|cyan)-\d{3}\b/.test(body);
    if (inBand || utilBand) { bandGradient = true; break; }
  }
  if (!bandGradient) {
    bandGradient = /\b(from|via|to)-(blue|indigo|violet|purple|cyan)-\d{3}\b/.test(lc);
  }
  if (bandGradient) hit("gradient-blue-purple-band", "gradient endpoint in blue-purple band");

  return { file, hits };
}

// ---------------------------------------------------------------------------
// Scoring. The score is the weighted presence of markers, normalized 0-100.
// Weight = each marker's crawl prevalence (sitesPct). A page that hits the most
// common tells scores highest. We normalize against the sum of the top-K
// heaviest weights (K = number of markers hit), so a page hitting K markers is
// compared to the worst-case page that hit its K *most prevalent* markers.
// ---------------------------------------------------------------------------
const ALL_WEIGHTS = prevalence.map((r) => r.sitesPct).sort((a, b) => b - a);
function score(hits) {
  const n = hits.length;
  if (n === 0) return 0;
  const got = hits.reduce((s, h) => s + h.pct, 0);
  const worst = ALL_WEIGHTS.slice(0, n).reduce((s, w) => s + w, 0) || 1;
  return Math.round((got / worst) * 100);
}

const GROUP_ORDER = ["style", "gradient", "motion", "stack"];
let anyFail = false;
const total = prevalence.length;

for (const file of process.argv.slice(2)) {
  let r;
  try {
    r = detect(file);
  } catch (e) {
    console.log(`\nERROR  ${file}: ${e.message}`);
    anyFail = true;
    continue;
  }
  const sc = score(r.hits);
  const fail = sc > CUTOFF;
  anyFail = anyFail || fail;
  const tag = fail ? "SLOP" : "ok  ";
  console.log(`\n${tag}  structural score ${String(sc).padStart(3)}/100   ${r.hits.length} of ${total} markers hit   ${file}`);
  const sorted = r.hits.slice().sort(
    (a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) || b.pct - a.pct
  );
  for (const h of sorted) {
    console.log(`   [${h.group.padEnd(8)}] ${h.label} — ${h.pct}% of AI sites do this too  (${h.why})`);
  }
  if (r.hits.length === 0) console.log("   (no structural slop markers detected)");
}
console.log(`\ncutoff: score > ${CUTOFF} => SLOP (nonzero exit)`);
process.exit(anyFail ? 1 : 0);
