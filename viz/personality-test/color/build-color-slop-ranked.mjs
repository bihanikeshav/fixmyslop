// build-color-slop-ranked.mjs
// Builds viz/personality-test/color/color-slop-ranked.html — a self-contained,
// data-inlined visualization of AI color overuse. Sections:
//   0. CHECK A COLOR — interactive client-side tool (slop rating + alternatives)
//   1. Ranked swatch grid (top 60 by crawl site count)
//   2. Hue addiction histogram (24 bins × 15°, weighted by sites)
//   3. Open lanes — BALANCED across the hue wheel (freshest safe color per family)
//
// The Check-a-color tool runs entirely client-side: this build step inlines the
// corpus OKLab points (deduped to unique hex+weight), the hard-ban tokens/bands,
// and the getdesign brand colors+names, then PORTS density()/classify()/
// nearestSafe()/hex↔oklab↔oklch/isInGamut/deltaEok into browser JS so the rating
// agrees with the CLI (same CONFIG: bandwidth 0.02, threshold 40).
//
// Run: node viz/personality-test/color/build-color-slop-ranked.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../../..");

// ---------------------------------------------------------------------------
// Imports from the existing color system (build-time only; the runtime port is
// a duplicate of this math, inlined into the HTML).
// ---------------------------------------------------------------------------
import { classify, CONFIG, density, nearestSafe, hardBanned } from "./density.mjs";
import {
  hexToOklab,
  hexToOklch,
  deltaEok,
  oklchToOklab,
  oklabToSrgb,
  isInGamut,
} from "./color-space.mjs";
import { loadCorpus } from "./corpus.mjs";

// ---------------------------------------------------------------------------
// Load data
// ---------------------------------------------------------------------------
const observations = JSON.parse(
  readFileSync(resolve(ROOT, "data/observations.colors.json"))
);
const getdesign = JSON.parse(
  readFileSync(resolve(ROOT, "data/reference/getdesign/index.json"))
);

// ---------------------------------------------------------------------------
// Build brand lookup: lab → brand name, for ΔEok nearest-brand match
// ---------------------------------------------------------------------------
// Use IDENTITY-ROLE colors only (identityColors), not the greedy `colors` dump.
// The greedy field included neutrals/surfaces/link/info/success/chart tokens, so
// the "≈ brand" clone warning fired on non-identity colors (e.g. #3d4cb8 matched
// Airtable's info:#254fad). Identity colors are the clone-distinctive hues only.
const brandEntries = []; // [{lab, name, hex}]
for (const brand of getdesign) {
  for (const hex of brand.identityColors || []) {
    try {
      brandEntries.push({ lab: hexToOklab(hex), name: brand.name, hex });
    } catch (_) {}
  }
}

// ΔEok 0.04 — tightened from 0.05. ~just-noticeable; only a near-exact identity
// match counts as "you'd look like a clone."
function nearestBrand(hex, threshold = 0.04) {
  const lab = hexToOklab(hex);
  let best = null;
  let bestDist = threshold;
  for (const entry of brandEntries) {
    const d = deltaEok(lab, entry.lab);
    if (d < bestDist) {
      bestDist = d;
      best = entry.name;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Helper: readable foreground for a given background hex
// ---------------------------------------------------------------------------
function fgFor(hex) {
  const [r, g, b] = hex
    .replace(/^#/, "")
    .match(/../g)
    .map((h) => parseInt(h, 16));
  const ch = (v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
  return L > 0.18 ? "#111111" : "#ffffff";
}

// ---------------------------------------------------------------------------
// SECTION 1: Top 60 crawl colors ranked by sites
// ---------------------------------------------------------------------------
const top60 = observations
  .slice()
  .sort((a, b) => b.sites - a.sites)
  .slice(0, 60);

const swatchData = top60.map(({ hex, sites }) => {
  const cl = classify(hex);
  let bucket;
  if (cl.ban) bucket = "BANNED";
  else if (cl.verdict === "OVERUSED") bucket = "CLONE-RISK";
  else if (cl.verdict === "NEUTRAL-ok") bucket = "NEUTRAL";
  else bucket = "SAFE";

  const brand = nearestBrand(hex);
  return { hex, sites, bucket, brand };
});

// ---------------------------------------------------------------------------
// SECTION 2: Hue histogram — 24 bins of 15°, weighted by sites
// ---------------------------------------------------------------------------
const NUM_BINS = 24;
const BIN_DEG = 15;

const hueNames = [
  "red", "red-orange", "orange", "amber",
  "yellow", "yellow-green", "chartreuse", "green",
  "green", "sea-green", "teal", "teal",
  "cyan", "sky", "sky-blue", "blue",
  "blue", "blue-indigo", "indigo", "violet",
  "purple", "pink", "rose", "red",
];

const bins = Array.from({ length: NUM_BINS }, (_, i) => ({
  hue: i * BIN_DEG,
  label: hueNames[i],
  totalSites: 0,
  repHex: null,
  repMaxSites: 0,
}));

for (const { hex, sites } of observations) {
  try {
    const [L, C, H] = hexToOklch(hex);
    if (C < 0.04) continue; // skip neutrals
    const binIdx = Math.floor(H / BIN_DEG) % NUM_BINS;
    bins[binIdx].totalSites += sites;
    if (sites > bins[binIdx].repMaxSites) {
      bins[binIdx].repMaxSites = sites;
      bins[binIdx].repHex = hex;
    }
  } catch (_) {}
}

const maxBinSites = Math.max(...bins.map((b) => b.totalSites));

const topBinIdxs = bins
  .map((b, i) => ({ i, s: b.totalSites }))
  .sort((a, b) => b.s - a.s)
  .slice(0, 3)
  .map((x) => x.i);

const histData = bins.map((b, i) => ({
  ...b,
  pct: maxBinSites > 0 ? (b.totalSites / maxBinSites) * 100 : 0,
  isTop: topBinIdxs.includes(i),
}));

// ---------------------------------------------------------------------------
// SECTION 3: BALANCED open lanes — freshest SAFE color in EACH hue family.
// For each of ~11 OKLCH-hue families, scan a grid of usable mid-L / real-chroma
// colors, keep only classify()===SAFE (so not banned/overused/neutral), and pick
// the lowest-density 1–2 (spread by lightness). If a family has no SAFE option,
// emit it as "no open lane, too crowded".
// ---------------------------------------------------------------------------
// OKLCH hue ranges per named family (degrees). Calibrated against Tailwind anchors:
// red 18, orange 48, amber/yellow 70-86, lime 131, green 150, teal 183, cyan 215,
// blue 260, indigo 277, violet 293, magenta/pink 322-354.
const HUE_FAMILIES = [
  { name: "red",          lo: 5,   hi: 35 },
  { name: "orange",       lo: 35,  hi: 60 },
  { name: "amber/yellow", lo: 60,  hi: 105 },
  { name: "lime",         lo: 105, hi: 140 },
  { name: "green",        lo: 140, hi: 168 },
  { name: "teal",         lo: 168, hi: 200 },
  { name: "cyan",         lo: 200, hi: 235 },
  { name: "blue",         lo: 235, hi: 268 },
  { name: "indigo",       lo: 268, hi: 285 },
  { name: "violet",       lo: 285, hi: 308 },
  { name: "magenta/pink", lo: 308, hi: 354 },
];

const MIN_LANE_CHROMA = 0.10; // high enough to read as an intentional hue

function familyOf(H) {
  for (const f of HUE_FAMILIES) {
    if (H >= f.lo && H < f.hi) return f.name;
  }
  // wrap: 354..360 and 0..5 → red
  return "red";
}

// Collect all SAFE, chromatic, usable-mid-L colors, grouped by family.
const laneCandidates = {};
for (const f of HUE_FAMILIES) laneCandidates[f.name] = [];

for (let H = 0; H < 360; H += 2) {
  for (let L = 0.45; L <= 0.68; L += 0.02) {
    for (let C = MIN_LANE_CHROMA; C <= 0.32; C += 0.01) {
      const lab = oklchToOklab([L, C, H]);
      if (!isInGamut(lab)) continue;
      const { hex } = oklabToSrgb(lab);
      const cl = classify(hex);
      if (cl.verdict !== "SAFE") continue;
      if (cl.oklch.C < MIN_LANE_CHROMA) continue;
      const fam = familyOf(cl.oklch.H);
      laneCandidates[fam].push({
        hex,
        H: cl.oklch.H,
        L: cl.oklch.L,
        C: cl.oklch.C,
        density: cl.density,
      });
    }
  }
}

// For each family pick up to 2: lowest density first, then a second pick in a
// distinctly different lightness band (so the pair is visually distinct).
const openLaneFamilies = HUE_FAMILIES.map((f) => {
  const list = laneCandidates[f.name];
  if (!list.length) {
    return { name: f.name, picks: [], crowded: true };
  }
  list.sort(
    (a, b) =>
      a.density - b.density ||
      Math.abs(a.L - 0.55) - Math.abs(b.L - 0.55) ||
      b.C - a.C
  );
  const picks = [list[0]];
  // second pick: lowest density whose lightness differs by >= 0.06 from first
  const second = list.find((c) => Math.abs(c.L - list[0].L) >= 0.06);
  if (second) picks.push(second);
  return { name: f.name, picks, crowded: false };
});

// ---------------------------------------------------------------------------
// Emit report to stdout
// ---------------------------------------------------------------------------
console.log("\n=== Top 10 colors (hex / sites / bucket / brand) ===");
swatchData.slice(0, 10).forEach((d, i) => {
  console.log(
    `  ${i + 1}. ${d.hex}  ${d.sites} sites  [${d.bucket}]${d.brand ? `  ≈ ${d.brand}` : ""}`
  );
});

console.log("\n=== Top 3 hue bins ===");
histData
  .filter((b) => b.isTop)
  .sort((a, b) => b.totalSites - a.totalSites)
  .forEach((b) => {
    console.log(
      `  ${b.hue}°–${b.hue + BIN_DEG}° (${b.label}): ${b.totalSites} sites`
    );
  });

console.log("\n=== Balanced open lanes (per hue family) ===");
for (const fam of openLaneFamilies) {
  if (fam.crowded) {
    console.log(`  ${fam.name.padEnd(14)} no open lane, too crowded`);
  } else {
    console.log(
      `  ${fam.name.padEnd(14)} ${fam.picks
        .map(
          (p) =>
            `${p.hex} (density ${p.density.toFixed(1)}, H${Math.round(p.H)}°)`
        )
        .join("  ")}`
    );
  }
}

// ===========================================================================
// CLIENT-SIDE INLINE DATA
// ===========================================================================
// Corpus: dedupe the full corpus to unique hex → weight. density() is a sum of
// unit-peak Gaussian blobs; N identical points at one hex == weight·(one blob),
// so weights reproduce the exact CLI density without inlining 8k+ duplicates.
const corpus = loadCorpus();
const weightByHex = new Map();
for (const p of corpus) {
  weightByHex.set(p.hex, (weightByHex.get(p.hex) || 0) + 1);
}
// Inline as parallel arrays of OKLab triples + weights (compact).
const corpusLab = [];
const corpusW = [];
for (const [hex, w] of weightByHex) {
  try {
    const [L, a, b] = hexToOklab(hex);
    corpusLab.push([
      +L.toFixed(5),
      +a.toFixed(5),
      +b.toFixed(5),
    ]);
    corpusW.push(w);
  } catch (_) {}
}

// Hard-ban tokens (literal hexes) — must mirror density.mjs BANNED_HEXES.
const BANNED_HEXES = [
  "#6366f1", "#7c3aed", "#8b5cf6", "#818cf8", "#a78bfa", "#a855f7",
  "#2563eb", "#3b82f6",
  "#22d3ee", "#2dd4bf", "#67e8f9", "#5eead4",
];

// Identity brand colors+names for the clone-risk check (≈ within ΔEok 0.04).
const brandData = brandEntries.map((e) => ({
  lab: [+e.lab[0].toFixed(5), +e.lab[1].toFixed(5), +e.lab[2].toFixed(5)],
  name: e.name,
}));

// Sanity-check the build-time and (conceptual) runtime agree for the test colors.
function reportCheck(hex) {
  const cl = classify(hex);
  const slop = Math.min(100, Math.round((cl.density / CONFIG.OVERUSE_THRESHOLD) * 100));
  let label;
  if (cl.ban) label = "BANNED";
  else if (cl.verdict === "OVERUSED") label = "CLONE-RISK";
  else if (cl.verdict === "NEUTRAL-ok") label = "NEUTRAL";
  else label = "FRESH";
  const alts = nearestSafe(hex, { count: 3 });
  return { hex, verdict: cl.verdict, label, slop, density: cl.density, ban: cl.ban, brand: nearestBrand(hex), alts };
}
console.log("\n=== Check-a-color (build-time reference) ===");
for (const hex of ["#6366f1", "#8a2e5e"]) {
  const r = reportCheck(hex);
  console.log(
    `  ${hex}  ${r.label}  slop=${r.slop}  density=${r.density.toFixed(2)}` +
      (r.brand ? `  ≈ ${r.brand}` : "") +
      `  alts: ${r.alts.map((a) => `${a.hex} ΔEok${a.delta.toFixed(2)}`).join(", ")}`
  );
}

// ---------------------------------------------------------------------------
// Build HTML helpers
// ---------------------------------------------------------------------------
function bucketColor(bucket) {
  if (bucket === "BANNED") return "#dc2626";
  if (bucket === "CLONE-RISK") return "#d97706";
  if (bucket === "NEUTRAL") return "#6b7280";
  return "#16a34a";
}
function bucketLabel(bucket) {
  if (bucket === "BANNED") return "BANNED";
  if (bucket === "CLONE-RISK") return "CLONE-RISK";
  if (bucket === "NEUTRAL") return "NEUTRAL";
  return "SAFE";
}

const swatchHTML = swatchData
  .map(({ hex, sites, bucket, brand }) => {
    const fg = fgFor(hex);
    const badgeBg = bucketColor(bucket);
    const brandStr = brand ? `<div class="swatch-brand">≈ ${brand}</div>` : "";
    return `<div class="swatch-card">
  <div class="swatch-block" style="background:${hex};color:${fg}">
    <span class="swatch-badge" style="background:${badgeBg};color:#fff">${bucketLabel(bucket)}</span>
  </div>
  <div class="swatch-info">
    <div class="swatch-hex">${hex}</div>
    <div class="swatch-sites">${sites} sites</div>
    ${brandStr}
  </div>
</div>`;
  })
  .join("\n");

const histHTML = histData
  .map((b) => {
    if (!b.repHex) {
      return `<div class="hist-bar-wrap">
  <div class="hist-bar-col">
    <div class="hist-bar" style="height:2px;background:#e5e7eb"></div>
  </div>
  <div class="hist-label">${b.hue}°</div>
</div>`;
    }
    const pct = Math.max(b.pct, 2);
    const barH = Math.round((pct / 100) * 220);
    const isTop = b.isTop;
    return `<div class="hist-bar-wrap${isTop ? " hist-top" : ""}">
  <div class="hist-bar-col">
    ${isTop ? `<div class="hist-value">${b.totalSites.toLocaleString()}</div>` : ""}
    <div class="hist-bar" style="height:${barH}px;background:${b.repHex}" title="${b.label}: ${b.totalSites} sites"></div>
  </div>
  <div class="hist-label">${isTop ? `<strong>${b.label}</strong>` : b.hue + "°"}</div>
</div>`;
  })
  .join("\n");

// Balanced open lanes — one labeled row per hue family.
const openHTML = openLaneFamilies
  .map((fam) => {
    if (fam.crowded) {
      return `<div class="lane-row lane-crowded">
  <div class="lane-name">${fam.name}</div>
  <div class="lane-none">no open lane — too crowded</div>
</div>`;
    }
    const swatches = fam.picks
      .map((p) => {
        const fg = fgFor(p.hex);
        return `<div class="lane-card">
    <div class="lane-block" style="background:${p.hex};color:${fg}">
      <span class="lane-density">density ${p.density.toFixed(0)}</span>
    </div>
    <div class="lane-hex">${p.hex}</div>
  </div>`;
      })
      .join("\n");
    return `<div class="lane-row">
  <div class="lane-name">${fam.name}</div>
  <div class="lane-swatches">
${swatches}
  </div>
</div>`;
  })
  .join("\n");

// ===========================================================================
// CLIENT RUNTIME — ported math (duplicate of color-space.mjs + density.mjs core)
// ===========================================================================
const clientScript = `
"use strict";
// ---- inlined data ----
const CORPUS_LAB = ${JSON.stringify(corpusLab)};
const CORPUS_W = ${JSON.stringify(corpusW)};
const BANNED_HEXES = new Set(${JSON.stringify(BANNED_HEXES)});
const BRANDS = ${JSON.stringify(brandData)};
const CONFIG = {
  BANDWIDTH: ${CONFIG.BANDWIDTH},
  OVERUSE_THRESHOLD: ${CONFIG.OVERUSE_THRESHOLD},
  NEUTRAL_CHROMA: ${CONFIG.NEUTRAL_CHROMA},
  MIN_INTENTIONAL_CHROMA: ${CONFIG.MIN_INTENTIONAL_CHROMA},
  DUPLICATE_DELTA: ${CONFIG.DUPLICATE_DELTA},
};

// ---- color-space (ported, verbatim math) ----
function hexToRgb(hex) {
  let h = String(hex).trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error("bad hex: " + hex);
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(rgb) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return "#" + c(rgb[0]) + c(rgb[1]) + c(rgb[2]);
}
function srgbToLinearChannel(c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function linearToSrgbChannel(c) { return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; }
function srgbToLinear(a) { return [srgbToLinearChannel(a[0]), srgbToLinearChannel(a[1]), srgbToLinearChannel(a[2])]; }
function linearToSrgb(a) { return [linearToSrgbChannel(a[0]), linearToSrgbChannel(a[1]), linearToSrgbChannel(a[2])]; }
function linearToOklab(rgb) {
  const r = rgb[0], g = rgb[1], b = rgb[2];
  const l = 0.4122214708*r + 0.5363325363*g + 0.0514459929*b;
  const m = 0.2119034982*r + 0.6806995451*g + 0.1073969566*b;
  const s = 0.0883024619*r + 0.2817188376*g + 0.6299787005*b;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  return [
    0.2104542553*l_ + 0.7936177850*m_ - 0.0040720468*s_,
    1.9779984951*l_ - 2.4285922050*m_ + 0.4505937099*s_,
    0.0259040371*l_ + 0.7827717662*m_ - 0.8086757660*s_,
  ];
}
function oklabToLinear(lab) {
  const L = lab[0], a = lab[1], b = lab[2];
  const l_ = L + 0.3963377774*a + 0.2158037573*b;
  const m_ = L - 0.1055613458*a - 0.0638541728*b;
  const s_ = L - 0.0894841775*a - 1.2914855480*b;
  const l = l_*l_*l_, m = m_*m_*m_, s = s_*s_*s_;
  return [
    +4.0767416621*l - 3.3077115913*m + 0.2309699292*s,
    -1.2684380046*l + 2.6097574011*m - 0.3413193965*s,
    -0.0041960863*l - 0.7034186147*m + 1.7076147010*s,
  ];
}
function hexToOklab(hex) { return linearToOklab(srgbToLinear(hexToRgb(hex).map((c) => c / 255))); }
function oklabToSrgb(lab) {
  const lin = oklabToLinear(lab);
  const srgb = linearToSrgb(lin);
  const eps = 1e-4;
  const inGamut = srgb.every((c) => c >= -eps && c <= 1 + eps);
  const hex = rgbToHex(srgb.map((c) => c * 255));
  return { hex: hex, inGamut: inGamut, srgb: srgb };
}
function isInGamut(lab) { return oklabToSrgb(lab).inGamut; }
function oklabToOklch(lab) {
  const C = Math.hypot(lab[1], lab[2]);
  let H = Math.atan2(lab[2], lab[1]) * 180 / Math.PI;
  if (H < 0) H += 360;
  return [lab[0], C, H];
}
function oklchToOklab(lch) {
  const r = lch[2] * Math.PI / 180;
  return [lch[0], lch[1] * Math.cos(r), lch[1] * Math.sin(r)];
}
function hexToOklch(hex) { return oklabToOklch(hexToOklab(hex)); }
function deltaEok(p, q) { return Math.hypot(p[0]-q[0], p[1]-q[1], p[2]-q[2]); }

// ---- density / classify (ported) ----
function density(lab, bandwidth) {
  if (bandwidth === undefined) bandwidth = CONFIG.BANDWIDTH;
  const twoSigma2 = 2 * bandwidth * bandwidth;
  let sum = 0;
  for (let i = 0; i < CORPUS_LAB.length; i++) {
    const p = CORPUS_LAB[i];
    const d2 = (lab[0]-p[0])**2 + (lab[1]-p[1])**2 + (lab[2]-p[2])**2;
    sum += CORPUS_W[i] * Math.exp(-d2 / twoSigma2);
  }
  return sum;
}
function densityHex(hex) { return density(hexToOklab(hex)); }

function hardBanned(hex) {
  const h = hex.toLowerCase();
  if (BANNED_HEXES.has(h)) return "literal slop hex " + h;
  const lch = hexToOklch(hex), L = lch[0], C = lch[1], H = lch[2];
  if (C > 0.18 && H >= 264 && H <= 310) return "1A indigo/violet";
  if (C > 0.18 && H >= 245 && H < 264 && L >= 0.45) return "1E fintech blue";
  if (C >= 0.10 && H >= 170 && H <= 215 && L >= 0.65) return "1B electric cyan/mint";
  return null;
}
function inBannedHueBand(lch) {
  const L = lch[0], C = lch[1], H = lch[2];
  if (C < CONFIG.NEUTRAL_CHROMA) return false;
  if (H >= 250 && H <= 310) return true;
  if (H >= 245 && H < 250 && L >= 0.45) return true;
  if (H >= 165 && H <= 222 && L >= 0.5) return true;
  return false;
}
function classify(hex) {
  const lch = hexToOklch(hex), L = lch[0], C = lch[1], H = lch[2];
  const ban = hardBanned(hex);
  const neutral = C < CONFIG.NEUTRAL_CHROMA;
  const d = densityHex(hex);
  let verdict;
  if (ban) verdict = "HARD-BANNED";
  else if (neutral) verdict = "NEUTRAL-ok";
  else if (d >= CONFIG.OVERUSE_THRESHOLD) verdict = "OVERUSED";
  else verdict = "SAFE";
  return { hex: hex.toLowerCase(), oklch: { L: L, C: C, H: H }, verdict: verdict, density: d, ban: ban, neutral: neutral };
}

// ---- nearestSafe (ported) ----
function isSafeAccentLab(lab, minChroma) {
  if (!isInGamut(lab)) return false;
  const hx = oklabToSrgb(lab).hex;
  if (hardBanned(hx)) return false;
  const lch = oklabToOklch(lab);
  if (inBannedHueBand(lch)) return false;
  if (density(lab) >= CONFIG.OVERUSE_THRESHOLD) return false;
  if (lch[1] < minChroma) return false;
  return true;
}
function nearestSafe(hex, count, maxDelta) {
  if (count === undefined) count = 3;
  if (maxDelta === undefined) maxDelta = 0.6;
  const startLab = hexToOklab(hex);
  const start = oklabToOklch(startLab), L0 = start[0], C0 = start[1], H0 = start[2];
  const neutralInput = C0 < CONFIG.NEUTRAL_CHROMA;
  const minChroma = neutralInput ? 0 : CONFIG.MIN_INTENTIONAL_CHROMA;
  const dLs = [0, 0.04, -0.04, 0.08, -0.08, 0.12, -0.12, 0.16, -0.16];
  const dCs = [0, 0.03, -0.03, 0.06, -0.06, 0.09, -0.09, 0.12, -0.12, 0.15];
  const dHs = [0];
  for (let s = 5; s <= 60; s += 5) { dHs.push(s); dHs.push(-s); }
  const seen = new Set();
  const candidates = [];
  for (const dH of dHs) {
    for (const dL of dLs) {
      for (const dC of dCs) {
        const L = L0 + dL;
        const C = Math.max(0, C0 + dC);
        const H = (H0 + dH + 360) % 360;
        if (L <= 0.05 || L >= 0.99) continue;
        const lab = oklchToOklab([L, C, H]);
        if (!isSafeAccentLab(lab, minChroma)) continue;
        const chex = oklabToSrgb(lab).hex;
        if (seen.has(chex)) continue;
        seen.add(chex);
        const delta = deltaEok(startLab, lab);
        if (delta > maxDelta) continue;
        const huePenalty = Math.abs(dH) / 360;
        candidates.push({ hex: chex, lab: lab, L: L, C: C, H: H, dH: dH, delta: delta, sort: delta + huePenalty });
      }
    }
  }
  candidates.sort((a, b) => a.sort - b.sort);
  const picked = [];
  for (const c of candidates) {
    if (picked.some((p) => deltaEok(p.lab, c.lab) < CONFIG.DUPLICATE_DELTA)) continue;
    picked.push({ hex: c.hex, lab: c.lab, oklch: { L: c.L, C: c.C, H: c.H }, density: density(c.lab), delta: c.delta });
    if (picked.length >= count) break;
  }
  return picked;
}

// ---- nearest brand within ΔEok 0.05 ----
function nearestBrandName(hex, threshold) {
  if (threshold === undefined) threshold = 0.04;
  const lab = hexToOklab(hex);
  let best = null, bestDist = threshold;
  for (const b of BRANDS) {
    const d = deltaEok(lab, b.lab);
    if (d < bestDist) { bestDist = d; best = b.name; }
  }
  return best;
}

// ---- readable fg ----
function fgFor(hex) {
  const rgb = hexToRgb(hex);
  const ch = (v) => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  const L = 0.2126*ch(rgb[0]) + 0.7152*ch(rgb[1]) + 0.0722*ch(rgb[2]);
  return L > 0.18 ? "#111111" : "#ffffff";
}

// ---- UI wiring ----
const hexInput = document.getElementById("check-hex");
const picker = document.getElementById("check-picker");
const out = document.getElementById("check-out");

function normalizeHex(v) {
  v = String(v).trim();
  if (!v) return null;
  if (v[0] !== "#") v = "#" + v;
  let h = v.replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return "#" + h.toLowerCase();
}

function labelMeta(label) {
  if (label === "BANNED")     return { color: "#dc2626", text: "BANNED" };
  if (label === "CLONE-RISK") return { color: "#d97706", text: "CLONE-RISK" };
  if (label === "CROWDED")    return { color: "#d97706", text: "CROWDED" };
  if (label === "NEUTRAL")    return { color: "#6b7280", text: "NEUTRAL" };
  return { color: "#16a34a", text: "FRESH" };
}

function render(hex) {
  const cl = classify(hex);
  // slop score 0–100, density relative to threshold, capped
  const slop = Math.min(100, Math.round((cl.density / CONFIG.OVERUSE_THRESHOLD) * 100));

  // label from verdict
  let label;
  if (cl.ban) label = "BANNED";
  else if (cl.verdict === "OVERUSED") label = "CLONE-RISK";
  else if (cl.verdict === "NEUTRAL-ok") label = "NEUTRAL";
  else label = "FRESH";

  // one-line reason
  let reason;
  const brand = nearestBrandName(hex, 0.04);
  if (cl.ban && cl.ban.indexOf("literal slop hex") === 0) {
    reason = "Tailwind/framework default token — every boilerplate ships it";
  } else if (cl.ban) {
    reason = "Sits inside a hard-banned slop hue band (" + cl.ban + ")";
  } else if (brand) {
    reason = "≈ " + brand + "'s color — you'd look like a clone";
  } else if (label === "CLONE-RISK") {
    reason = "Statistically crowded — many AI sites already land here";
  } else if (label === "NEUTRAL") {
    reason = "Reads as a neutral — exempt from the chromatic slop penalty";
  } else {
    reason = "Wide open — the density model sees almost nothing here";
  }

  const m = labelMeta(label);
  const fg = fgFor(hex);

  // alternatives
  const alts = nearestSafe(hex, 3);
  let altsHTML = "";
  if (alts.length) {
    altsHTML = alts.map(function (a) {
      const af = fgFor(a.hex);
      const same = a.delta < 0.005;
      return '<div class="alt-card">' +
        '<div class="alt-block" style="background:' + a.hex + ';color:' + af + '"></div>' +
        '<div class="alt-hex">' + a.hex + '</div>' +
        '<div class="alt-delta">' + (same ? "this color" : "ΔEok " + a.delta.toFixed(2) + " away") + '</div>' +
        '</div>';
    }).join("");
  } else {
    altsHTML = '<div class="alt-none">No safe alternative found nearby.</div>';
  }

  out.innerHTML =
    '<div class="check-grid">' +
      '<div class="check-big" style="background:' + hex + ';color:' + fg + '">' +
        '<span class="check-big-hex">' + hex + '</span>' +
      '</div>' +
      '<div class="check-detail">' +
        '<div class="check-rating">' +
          '<span class="check-label" style="background:' + m.color + '">' + m.text + '</span>' +
          '<span class="check-score">slop <strong>' + slop + '</strong>/100</span>' +
        '</div>' +
        '<div class="check-meter"><div class="check-meter-fill" style="width:' + slop + '%;background:' + m.color + '"></div></div>' +
        '<div class="check-reason">' + reason + '</div>' +
        '<div class="check-stats">density ' + cl.density.toFixed(1) +
          ' · OKLCH L ' + cl.oklch.L.toFixed(2) + ' C ' + cl.oklch.C.toFixed(2) + ' H ' + Math.round(cl.oklch.H) + '°</div>' +
      '</div>' +
    '</div>' +
    '<div class="alt-head">Try instead</div>' +
    '<div class="alt-row">' + altsHTML + '</div>';
}

function update(source) {
  const raw = source === "picker" ? picker.value : hexInput.value;
  const hex = normalizeHex(raw);
  if (!hex) {
    out.innerHTML = '<div class="check-empty">Enter a 6-digit hex (e.g. #6366f1) to rate it.</div>';
    return;
  }
  // keep both controls in sync
  hexInput.value = hex;
  picker.value = hex;
  try {
    render(hex);
  } catch (e) {
    out.innerHTML = '<div class="check-empty">Could not parse that color.</div>';
  }
}

hexInput.addEventListener("input", function () { update("hex"); });
picker.addEventListener("input", function () { update("picker"); });

// initial render
update("hex");
`;

// ---------------------------------------------------------------------------
// Build HTML
// ---------------------------------------------------------------------------
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Color Slop: What AI Reaches For</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #0f0f0f;
    --surface: #1a1a1a;
    --surface2: #222;
    --border: #2d2d2d;
    --text: #e8e8e8;
    --muted: #888;
    --accent: #f5f5f5;
    --radius: 10px;
  }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    padding: 0 0 80px;
  }

  /* ---- header ---- */
  .page-header {
    padding: 56px 48px 40px;
    max-width: 1200px;
    margin: 0 auto;
  }
  .page-header h1 {
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.5px;
    color: var(--accent);
    margin-bottom: 10px;
  }
  .page-header .subtitle {
    color: var(--muted);
    font-size: 15px;
    max-width: 600px;
  }

  /* ---- sections ---- */
  .section {
    max-width: 1200px;
    margin: 0 auto 64px;
    padding: 0 48px;
  }
  .section-head {
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--border);
  }
  .section-head h2 {
    font-size: 20px;
    font-weight: 600;
    color: var(--accent);
    margin-bottom: 6px;
  }
  .section-head p {
    color: var(--muted);
    font-size: 14px;
  }

  /* ---- SECTION 0: check a color ---- */
  .check-controls {
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
    margin-bottom: 20px;
  }
  .check-controls label {
    font-size: 12px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.6px;
  }
  #check-hex {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--accent);
    font-family: "SF Mono", "Fira Code", "Fira Mono", monospace;
    font-size: 15px;
    padding: 10px 14px;
    width: 160px;
    letter-spacing: 0.5px;
  }
  #check-hex:focus { outline: 2px solid #555; }
  #check-picker {
    width: 48px;
    height: 44px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    cursor: pointer;
    padding: 2px;
  }
  .check-panel {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 24px;
  }
  .check-empty { color: var(--muted); font-size: 14px; }
  .check-grid {
    display: flex;
    gap: 24px;
    align-items: stretch;
    flex-wrap: wrap;
  }
  .check-big {
    width: 200px;
    height: 200px;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.08);
    display: flex;
    align-items: flex-end;
    padding: 12px;
    flex-shrink: 0;
  }
  .check-big-hex {
    font-family: "SF Mono", "Fira Code", "Fira Mono", monospace;
    font-size: 14px;
    letter-spacing: 0.5px;
  }
  .check-detail {
    flex: 1;
    min-width: 240px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 14px;
  }
  .check-rating {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .check-label {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    color: #fff;
    padding: 5px 12px;
    border-radius: 6px;
  }
  .check-score { font-size: 15px; color: var(--text); }
  .check-score strong { font-size: 22px; color: var(--accent); }
  .check-meter {
    height: 8px;
    background: var(--surface2);
    border-radius: 4px;
    overflow: hidden;
  }
  .check-meter-fill { height: 100%; transition: width 0.2s; }
  .check-reason { font-size: 15px; color: var(--text); }
  .check-stats {
    font-family: "SF Mono", "Fira Code", "Fira Mono", monospace;
    font-size: 11px;
    color: var(--muted);
  }
  .alt-head {
    margin-top: 24px;
    margin-bottom: 12px;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: var(--muted);
  }
  .alt-row { display: flex; gap: 12px; flex-wrap: wrap; }
  .alt-card { text-align: center; }
  .alt-block {
    width: 84px;
    height: 84px;
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.06);
  }
  .alt-hex {
    font-family: "SF Mono", "Fira Code", "Fira Mono", monospace;
    font-size: 11px;
    color: var(--accent);
    margin-top: 6px;
  }
  .alt-delta { font-size: 10px; color: var(--muted); margin-top: 2px; }
  .alt-none { color: var(--muted); font-size: 13px; }

  /* ---- SECTION 1: swatch grid ---- */
  .swatch-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 12px;
  }
  .swatch-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
  }
  .swatch-block {
    height: 88px;
    display: flex;
    align-items: flex-end;
    padding: 8px;
    position: relative;
  }
  .swatch-badge {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    padding: 2px 6px;
    border-radius: 4px;
    line-height: 1.6;
  }
  .swatch-info { padding: 8px 10px 10px; }
  .swatch-hex {
    font-family: "SF Mono", "Fira Code", "Fira Mono", monospace;
    font-size: 12px;
    color: var(--accent);
    letter-spacing: 0.5px;
  }
  .swatch-sites { font-size: 11px; color: var(--muted); margin-top: 2px; }
  .swatch-brand {
    font-size: 10px;
    color: #a78bfa;
    margin-top: 3px;
    font-style: italic;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ---- SECTION 2: hue histogram ---- */
  .hist-container {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 32px 24px 20px;
    overflow-x: auto;
  }
  .hist-bars {
    display: flex;
    align-items: flex-end;
    gap: 6px;
    height: 260px;
    min-width: 600px;
  }
  .hist-bar-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 1;
    height: 100%;
    justify-content: flex-end;
  }
  .hist-bar-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    flex: 1;
    width: 100%;
  }
  .hist-bar {
    width: 100%;
    border-radius: 4px 4px 0 0;
    transition: opacity 0.15s;
    min-height: 2px;
  }
  .hist-bar:hover { opacity: 0.8; }
  .hist-value {
    font-size: 10px;
    font-weight: 700;
    color: var(--accent);
    margin-bottom: 4px;
    white-space: nowrap;
  }
  .hist-label {
    margin-top: 8px;
    font-size: 10px;
    color: var(--muted);
    text-align: center;
    line-height: 1.2;
  }
  .hist-top .hist-label strong {
    color: var(--accent);
    font-size: 10px;
    display: block;
    white-space: nowrap;
  }
  .hist-axis-label {
    text-align: center;
    font-size: 12px;
    color: var(--muted);
    margin-top: 12px;
  }

  /* ---- SECTION 3: open lanes (balanced per hue) ---- */
  .lane-row {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 0;
    border-bottom: 1px solid var(--border);
  }
  .lane-row:last-child { border-bottom: none; }
  .lane-name {
    width: 130px;
    flex-shrink: 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--accent);
    text-transform: capitalize;
  }
  .lane-swatches { display: flex; gap: 12px; flex-wrap: wrap; }
  .lane-card { text-align: center; }
  .lane-block {
    width: 84px;
    height: 64px;
    border-radius: 8px;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding-bottom: 6px;
    border: 1px solid rgba(255,255,255,0.05);
  }
  .lane-density { font-size: 9px; opacity: 0.75; letter-spacing: 0.3px; }
  .lane-hex {
    font-family: "SF Mono", "Fira Code", "Fira Mono", monospace;
    font-size: 11px;
    color: var(--muted);
    margin-top: 5px;
  }
  .lane-none {
    font-size: 13px;
    color: #d97706;
    font-style: italic;
  }
  .lane-crowded .lane-name { color: var(--muted); }

  /* ---- footer ---- */
  .page-footer {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 48px;
    color: var(--muted);
    font-size: 12px;
    border-top: 1px solid var(--border);
    padding-top: 24px;
  }

  @media (max-width: 600px) {
    .page-header, .section, .page-footer { padding-left: 20px; padding-right: 20px; }
    .page-header h1 { font-size: 22px; }
    .swatch-grid { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); }
    .lane-row { flex-direction: column; align-items: flex-start; }
  }
</style>
</head>
<body>

<div class="page-header">
  <h1>Color Slop: What AI Reaches For</h1>
  <p class="subtitle">
    1,083 colors extracted from AI-generated sites, ranked by how many sites used each one.
    The pattern is stark — one narrow corner of the color wheel, over and over.
  </p>
</div>

<div class="section">
  <div class="section-head">
    <h2>Check a color</h2>
    <p>Paste any hex (or use the picker). The rating runs entirely in your browser using the same density model as the CLI — bandwidth ${CONFIG.BANDWIDTH}, overuse threshold ${CONFIG.OVERUSE_THRESHOLD}. It tells you how crowded the color is, why, and what to use instead.</p>
  </div>
  <div class="check-controls">
    <label for="check-hex">Hex</label>
    <input id="check-hex" type="text" value="#6366f1" spellcheck="false" autocomplete="off">
    <input id="check-picker" type="color" value="#6366f1" aria-label="Color picker">
  </div>
  <div class="check-panel">
    <div id="check-out"><div class="check-empty">Enter a 6-digit hex to rate it.</div></div>
  </div>
</div>

<div class="section">
  <div class="section-head">
    <h2>The colors AI overuses</h2>
    <p>Top 60 crawl colors sorted by site count. Badge shows the verdict — CLONE-RISK means statistically crowded, BANNED means a hard-blocked framework default. Purple label names the nearest recognizable brand.</p>
  </div>
  <div class="swatch-grid">
    ${swatchHTML}
  </div>
</div>

<div class="section">
  <div class="section-head">
    <h2>AI's hue addiction</h2>
    <p>Every crawl color binned by hue (15° each), bar height = total sites in that slice. Three spikes dominate — blue-indigo, indigo, and plain blue — crowding out the rest of the wheel.</p>
  </div>
  <div class="hist-container">
    <div class="hist-bars">
      ${histHTML}
    </div>
    <div class="hist-axis-label">Hue angle (0° = red · 120° = green · 240° = blue · 360° = red)</div>
  </div>
</div>

<div class="section">
  <div class="section-head">
    <h2>Open lanes — one per hue</h2>
    <p>The freshest USABLE color in every hue family: in-gamut, real chroma, mid lightness, and SAFE by the density model (not banned, not crowded). Where a family has no safe option left, it says so — that direction is genuinely crowded out.</p>
  </div>
  <div class="open-lanes">
    ${openHTML}
  </div>
</div>

<div class="page-footer">
  Built from data/observations.colors.json (${observations.length} crawl colors) + ${getdesign.length} brand palettes from getdesign.md.
  Density model: Gaussian KDE in OKLab, bandwidth ${CONFIG.BANDWIDTH} ΔEok, overuse threshold ${CONFIG.OVERUSE_THRESHOLD}.
  The Check-a-color tool runs client-side from ${corpusLab.length} inlined corpus points.
</div>

<script>
${clientScript}
</script>

</body>
</html>`;

// ---------------------------------------------------------------------------
// Write output
// ---------------------------------------------------------------------------
const outPath = resolve(HERE, "color-slop-ranked.html");
writeFileSync(outPath, html, "utf8");
console.log(`\nWrote ${outPath}`);
