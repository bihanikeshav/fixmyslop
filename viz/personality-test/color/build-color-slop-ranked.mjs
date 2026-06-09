// build-color-slop-ranked.mjs
// Builds viz/personality-test/color/color-slop-ranked.html — a self-contained,
// data-inlined visualization of AI color overuse. Three sections:
//   1. Ranked swatch grid (top 60 by crawl site count)
//   2. Hue addiction histogram (24 bins × 15°, weighted by sites)
//   3. Open lanes (SAFE, low-density, chromatic colors AI isn't using)
//
// Run: node viz/personality-test/color/build-color-slop-ranked.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../../..");

// ---------------------------------------------------------------------------
// Imports from the existing color system
// ---------------------------------------------------------------------------
import { classify } from "./density.mjs";
import {
  hexToOklab,
  hexToOklch,
  deltaEok,
  oklchToOklab,
  oklabToSrgb,
  isInGamut,
} from "./color-space.mjs";

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
const brandEntries = []; // [{lab, name}]
for (const brand of getdesign) {
  for (const hex of brand.colors) {
    try {
      brandEntries.push({ lab: hexToOklab(hex), name: brand.name });
    } catch (_) {}
  }
}

function nearestBrand(hex, threshold = 0.05) {
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
  // WCAG relative luminance
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

// Label the top 3 bins (by totalSites)
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
// SECTION 3: Open lanes — SAFE, chromatic, low-density
// ---------------------------------------------------------------------------
// Build brand lab cache for distance check
const brandLabs = brandEntries.map((e) => e.lab);

function nearestBrandDistLab(lab) {
  let best = Infinity;
  for (const bLab of brandLabs) {
    const d = deltaEok(lab, bLab);
    if (d < best) best = d;
  }
  return best;
}

// Banned hue bands (avoid suggesting colors that look like slop)
function isHardBannedHue(H, L, C) {
  if (H >= 245 && H <= 310) return true; // indigo/violet/fintech-blue
  if (H >= 170 && H <= 215 && L >= 0.55 && C >= 0.09) return true; // bright cyan
  return false;
}

const allSafe = [];
for (let H = 0; H < 360; H += 5) {
  for (let L = 0.28; L <= 0.88; L += 0.03) {
    for (let C = 0.05; C <= 0.30; C += 0.02) {
      if (isHardBannedHue(H, L, C)) continue;
      const lab = oklchToOklab([L, C, H]);
      if (!isInGamut(lab)) continue;
      const { hex } = oklabToSrgb(lab);
      try {
        const cl = classify(hex);
        if (cl.verdict !== "SAFE") continue;
        if (cl.oklch.C < 0.06) continue; // need real chroma
        const brandDist = nearestBrandDistLab(lab);
        allSafe.push({ hex, H, L, C, density: cl.density, brandDist });
      } catch (_) {}
    }
  }
}

// Group by 15° hue bins
const safeBins = {};
for (const c of allSafe) {
  const bin = Math.floor(c.H / 15);
  if (!safeBins[bin]) safeBins[bin] = [];
  safeBins[bin].push(c);
}

// Pick up to 12 diverse: one from each hue bin, favor mid-L, decent chroma, low density
const openLaneColors = [];
const binOrder = Object.keys(safeBins)
  .map(Number)
  .sort((a, b) => a - b);

// Score: low density is good, far from brand is good, mid L is good
function laneScore(c) {
  const lPenalty = Math.abs(c.L - 0.55) * 4; // prefer mid lightness
  return c.density * 0.5 - c.brandDist * 25 + lPenalty;
}

const usedLBins = new Set();
for (const binKey of binOrder) {
  const lanes = safeBins[binKey]
    .filter((c) => c.L >= 0.36 && c.L <= 0.78 && c.C >= 0.08)
    .sort((a, b) => laneScore(a) - laneScore(b));
  if (!lanes.length) continue;

  // Pick one or two per hue range to spread visually
  for (const c of lanes.slice(0, 2)) {
    const lBin = Math.floor(c.L / 0.14);
    const key = `${binKey}:${lBin}`;
    if (!usedLBins.has(key)) {
      usedLBins.add(key);
      openLaneColors.push(c);
      if (openLaneColors.length >= 12) break;
    }
  }
  if (openLaneColors.length >= 12) break;
}

// If fewer than 12, fill from the densest hue bin (usually the wine/magenta cluster)
if (openLaneColors.length < 12) {
  const remaining = allSafe
    .filter(
      (c) =>
        !openLaneColors.find((p) => p.hex === c.hex) &&
        c.L >= 0.36 &&
        c.L <= 0.78 &&
        c.C >= 0.08
    )
    .sort((a, b) => laneScore(a) - laneScore(b));
  for (const c of remaining) {
    if (openLaneColors.length >= 12) break;
    openLaneColors.push(c);
  }
}

const openLaneData = openLaneColors.slice(0, 12);

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

console.log("\n=== Open lane colors ===");
openLaneData.forEach((c) => {
  console.log(
    `  ${c.hex}  H=${Math.round(c.H)}° L=${c.L.toFixed(2)} C=${c.C.toFixed(2)}  density=${c.density.toFixed(1)}`
  );
});

// ---------------------------------------------------------------------------
// Build HTML
// ---------------------------------------------------------------------------
function bucketColor(bucket) {
  if (bucket === "BANNED") return "#dc2626";   // red
  if (bucket === "CLONE-RISK") return "#d97706"; // amber
  if (bucket === "NEUTRAL") return "#6b7280";   // gray
  return "#16a34a"; // green for SAFE
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
    const badgeFg = "#fff";
    const brandStr = brand
      ? `<div class="swatch-brand">≈ ${brand}</div>`
      : "";
    return `<div class="swatch-card">
  <div class="swatch-block" style="background:${hex};color:${fg}">
    <span class="swatch-badge" style="background:${badgeBg};color:${badgeFg}">${bucketLabel(bucket)}</span>
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
      // Empty bin — grey placeholder
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

const openHTML = openLaneData
  .map((c) => {
    const fg = fgFor(c.hex);
    return `<div class="open-card">
  <div class="open-block" style="background:${c.hex};color:${fg}">
    <span class="open-density">density ${c.density.toFixed(0)}</span>
  </div>
  <div class="open-hex">${c.hex}</div>
</div>`;
  })
  .join("\n");

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
  .swatch-info {
    padding: 8px 10px 10px;
  }
  .swatch-hex {
    font-family: "SF Mono", "Fira Code", "Fira Mono", monospace;
    font-size: 12px;
    color: var(--accent);
    letter-spacing: 0.5px;
  }
  .swatch-sites {
    font-size: 11px;
    color: var(--muted);
    margin-top: 2px;
  }
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
  .hist-bar:hover {
    opacity: 0.8;
  }
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

  /* ---- SECTION 3: open lanes ---- */
  .open-row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .open-card {
    text-align: center;
  }
  .open-block {
    width: 100px;
    height: 100px;
    border-radius: 8px;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding-bottom: 8px;
    border: 1px solid rgba(255,255,255,0.05);
  }
  .open-density {
    font-size: 9px;
    opacity: 0.7;
    letter-spacing: 0.3px;
  }
  .open-hex {
    font-family: "SF Mono", "Fira Code", "Fira Mono", monospace;
    font-size: 11px;
    color: var(--muted);
    margin-top: 6px;
  }

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
    <h2>Open lanes</h2>
    <p>Colors with real chroma that score SAFE by the density model — low enough heat that using them doesn't look like every other AI product. Mostly deep wine-reds, olive-chartreuse, and vivid magentas: the directions AI systematically skips.</p>
  </div>
  <div class="open-row">
    ${openHTML}
  </div>
</div>

<div class="page-footer">
  Built from data/observations.colors.json (${observations.length} crawl colors) + ${getdesign.length} brand palettes from getdesign.md.
  Density model: Gaussian KDE in OKLab, bandwidth 0.04 ΔEok, overuse threshold 18.0.
</div>

</body>
</html>`;

// ---------------------------------------------------------------------------
// Write output
// ---------------------------------------------------------------------------
const outPath = resolve(HERE, "color-slop-ranked.html");
writeFileSync(outPath, html, "utf8");
console.log(`\nWrote ${outPath}`);
