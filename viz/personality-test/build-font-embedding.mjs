#!/usr/bin/env node
// build-font-embedding.mjs
// Joins font-projection.json + fonts.index.json, inlines joined data into font-embedding.html
// Usage: node viz/personality-test/build-font-embedding.mjs

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');

const projRaw = JSON.parse(readFileSync(join(ROOT, 'data', 'font-projection.json'), 'utf8'));
const indexRaw = JSON.parse(readFileSync(join(ROOT, 'data', 'fonts.index.json'), 'utf8'));

// Build lookup by family name
const byFamily = {};
indexRaw.forEach(f => { byFamily[f.family] = f; });

// Join projection entries to index metadata
let matched = 0, unmatched = 0;
const fonts = projRaw.map(p => {
  const [x, y, , , , family] = p;
  const meta = byFamily[family];
  if (meta) {
    matched++;
    return {
      x,
      y,
      family,
      supplier: meta.supplier,
      category: meta.category,
      popularityRank: meta.popularityRank,
      trendingRank: meta.trendingRank,
      quality: meta.quality,
    };
  } else {
    unmatched++;
    return { x, y, family, supplier: 'unknown', category: 'unknown', popularityRank: null, trendingRank: null, quality: null };
  }
});

// De-overlap: spread very-similar fonts (near-identical embedding positions) so they
// don't pile into an unreadable blob. Local collision relaxation — preserves macro structure.
spaceOut(fonts, 0.85, 160);

// Supplier breakdown
const supplierCounts = {};
fonts.forEach(f => { supplierCounts[f.supplier] = (supplierCounts[f.supplier] || 0) + 1; });

console.log(`Fonts plotted: ${fonts.length}`);
console.log(`Matched to metadata: ${matched} | Unmatched: ${unmatched}`);
console.log('Supplier breakdown:', supplierCounts);

// Landmarks: these must be in the projection data
const LANDMARKS = ['Inter', 'Playfair Display', 'Space Grotesk', 'Poppins', 'General Sans', 'Pretendard', 'Overused Grotesk'];
const landmarkSet = new Set(LANDMARKS);
const foundLandmarks = fonts.filter(f => landmarkSet.has(f.family)).map(f => f.family);
console.log('Landmarks found:', foundLandmarks);
const missingLandmarks = LANDMARKS.filter(l => !foundLandmarks.includes(l));
if (missingLandmarks.length) console.log('Missing landmarks (will be skipped):', missingLandmarks);

const dataJSON = JSON.stringify(fonts);
const landmarksJSON = JSON.stringify(LANDMARKS.filter(l => foundLandmarks.includes(l)));

// Read the HTML template (this script regenerates it inline — HTML is generated programmatically)
const html = generateHTML(dataJSON, landmarksJSON, matched, unmatched, supplierCounts);

const OUT = join(__dirname, 'font-embedding.html');
writeFileSync(OUT, html, 'utf8');
console.log(`Written: ${OUT}`);

// Local collision relaxation in projection space [0,100]. Points closer than minDist are
// pushed apart (half each) over `iters` passes, so very-similar fonts get breathing room
// without disturbing the global layout. Deterministic (golden-angle for exact overlaps).
function spaceOut(fonts, minDist = 0.85, iters = 160) {
  const cell = minDist;
  const key = (gx, gy) => gx + ',' + gy;
  for (let it = 0; it < iters; it++) {
    const grid = new Map();
    for (let i = 0; i < fonts.length; i++) {
      const gx = Math.floor(fonts[i].x / cell), gy = Math.floor(fonts[i].y / cell);
      const k = key(gx, gy);
      (grid.get(k) || grid.set(k, []).get(k)).push(i);
    }
    let moved = 0;
    for (let i = 0; i < fonts.length; i++) {
      const a = fonts[i];
      const gx = Math.floor(a.x / cell), gy = Math.floor(a.y / cell);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        const arr = grid.get(key(gx + dx, gy + dy));
        if (!arr) continue;
        for (const j of arr) {
          if (j <= i) continue;
          const b = fonts[j];
          let ddx = b.x - a.x, ddy = b.y - a.y;
          let d = Math.hypot(ddx, ddy);
          if (d === 0) { // exact overlap → deterministic golden-angle nudge
            const ang = i * 2.399963229728653, p = minDist / 2;
            ddx = Math.cos(ang); ddy = Math.sin(ang); d = 1;
            a.x -= ddx * p; a.y -= ddy * p; b.x += ddx * p; b.y += ddy * p; moved++;
          } else if (d < minDist) {
            const push = (minDist - d) / 2, ux = ddx / d, uy = ddy / d;
            a.x -= ux * push; a.y -= uy * push; b.x += ux * push; b.y += uy * push; moved++;
          }
        }
      }
    }
    for (const f of fonts) { f.x = Math.max(0, Math.min(100, f.x)); f.y = Math.max(0, Math.min(100, f.y)); }
    if (moved === 0) break;
  }
}

function generateHTML(dataJSON, landmarksJSON, matched, unmatched, supplierCounts) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Font Latent Space</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #0e0e10;
    --surface: #18181c;
    --border: #2a2a30;
    --text: #d4d4dc;
    --text-dim: #6b6b78;
    --accent: #a78bfa;
    --google-color: #4b5563;
    --indie-color: #a78bfa;
    --sans-color: #60a5fa;
    --serif-color: #f59e0b;
    --display-color: #f472b6;
    --mono-color: #34d399;
    --hand-color: #fb923c;
  }

  html, body {
    width: 100%; height: 100%;
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    overflow: hidden;
  }

  #app {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }

  /* Header */
  #header {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 10px 16px;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    z-index: 10;
  }

  #header h1 {
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
    letter-spacing: 0.02em;
    flex: 0 0 auto;
  }

  #header .subtitle {
    font-size: 11px;
    color: var(--text-dim);
  }

  .spacer { flex: 1; }

  /* Controls */
  .ctrl-group {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 0 0 auto;
  }

  .ctrl-label {
    font-size: 11px;
    color: var(--text-dim);
    white-space: nowrap;
  }

  .toggle-btn {
    display: flex;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
  }

  .toggle-btn button {
    padding: 5px 10px;
    font-size: 11px;
    font-weight: 500;
    color: var(--text-dim);
    background: transparent;
    border: none;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }

  .toggle-btn button.active {
    background: var(--accent);
    color: #0e0e10;
  }

  .icon-btn {
    width: 28px; height: 28px;
    display: flex; align-items: center; justify-content: center;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-dim);
    cursor: pointer;
    font-size: 14px;
    transition: all 0.15s;
  }
  .icon-btn:hover { color: var(--text); border-color: var(--text-dim); }

  /* Canvas container */
  #canvas-wrap {
    flex: 1 1 auto;
    position: relative;
    overflow: hidden;
    cursor: grab;
  }
  #canvas-wrap.panning { cursor: grabbing; }

  #canvas {
    position: absolute;
    top: 0; left: 0;
    display: block;
  }

  /* Tooltip */
  #tooltip {
    position: fixed;
    pointer-events: none;
    z-index: 100;
    display: none;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 12px 14px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.6);
    max-width: 240px;
    min-width: 160px;
  }

  #tooltip .tt-family {
    font-size: 18px;
    font-weight: 700;
    color: #fff;
    line-height: 1.2;
    margin-bottom: 2px;
    white-space: nowrap;
  }

  #tooltip .tt-meta {
    font-size: 11px;
    color: var(--text-dim);
    margin-top: 6px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  #tooltip .tt-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 7px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 4px;
  }

  /* Legend */
  #legend {
    position: absolute;
    bottom: 16px;
    right: 16px;
    background: rgba(14,14,16,0.85);
    backdrop-filter: blur(8px);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 12px 14px;
    z-index: 10;
    pointer-events: none;
  }

  #legend .leg-title {
    font-size: 10px;
    font-weight: 600;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 8px;
  }

  .leg-row {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 11px;
    color: var(--text);
    margin-bottom: 4px;
  }

  .leg-dot {
    width: 9px; height: 9px;
    border-radius: 50%;
    flex: 0 0 auto;
  }

  /* Stats bar */
  #stats {
    position: absolute;
    bottom: 16px;
    left: 16px;
    font-size: 11px;
    color: var(--text-dim);
    pointer-events: none;
    line-height: 1.6;
  }

  /* Zoom indicator */
  #zoom-indicator {
    position: absolute;
    top: 12px;
    right: 16px;
    font-size: 11px;
    color: var(--text-dim);
    pointer-events: none;
    font-variant-numeric: tabular-nums;
  }
</style>
</head>
<body>
<div id="app">
  <div id="header">
    <h1>Font Latent Space</h1>
    <span class="subtitle">DINOv2 visual embeddings · t-SNE 2D projection</span>
    <div class="spacer"></div>

    <div class="ctrl-group">
      <span class="ctrl-label">Color by</span>
      <div class="toggle-btn">
        <button id="btn-supplier" class="active" onclick="setColorMode('supplier')">Supplier</button>
        <button id="btn-category" onclick="setColorMode('category')">Category</button>
      </div>
    </div>

    <div class="ctrl-group" style="margin-left:8px;">
      <button class="icon-btn" onclick="zoomIn()" title="Zoom in">+</button>
      <button class="icon-btn" onclick="zoomOut()" title="Zoom out">−</button>
      <button class="icon-btn" onclick="resetView()" title="Reset view" style="font-size:11px;font-weight:600;">⌂</button>
    </div>
  </div>

  <div id="canvas-wrap">
    <canvas id="canvas"></canvas>
    <div id="legend"></div>
    <div id="stats"></div>
    <div id="zoom-indicator"></div>
  </div>
</div>

<div id="tooltip">
  <div class="tt-family" id="tt-family">Family</div>
  <span class="tt-badge" id="tt-badge"></span>
  <div class="tt-meta" id="tt-meta"></div>
</div>

<script>
// ─── Inline data ─────────────────────────────────────────────────────────────
const FONTS = ${dataJSON};
const LANDMARKS = ${landmarksJSON};
// Build lookup for fast hover
const byFamily = Object.fromEntries(FONTS.map(f => [f.family, f]));

// ─── Color palettes ───────────────────────────────────────────────────────────
const SUPPLIER_COLORS = {
  google:     '#4a5568',   // muted slate — the monoculture
  fontshare:  '#a78bfa',   // violet
  velvetyne:  '#f472b6',   // pink
  uncut:      '#34d399',   // emerald
  unknown:    '#6b7280',
};
const SUPPLIER_LABELS = {
  google:     'Google Fonts (monoculture)',
  fontshare:  'Fontshare',
  velvetyne:  'Velvetyne',
  uncut:      'Uncut',
  unknown:    'Unknown',
};

const CATEGORY_COLORS = {
  'sans-serif':  '#60a5fa',   // blue
  'serif':       '#f59e0b',   // amber
  'display':     '#f472b6',   // pink
  'monospace':   '#34d399',   // green
  'handwriting': '#fb923c',   // orange
  'unknown':     '#6b7280',
};
const CATEGORY_LABELS = {
  'sans-serif':  'Sans-serif',
  'serif':       'Serif',
  'display':     'Display',
  'monospace':   'Monospace',
  'handwriting': 'Handwriting',
};

// ─── State ────────────────────────────────────────────────────────────────────
let colorMode = 'supplier';
let transform = { x: 0, y: 0, scale: 1 };  // canvas-space pan/zoom
let hoveredFont = null;
let loadedFonts = new Set();
let loadingFonts = new Set();

// ─── Canvas setup ─────────────────────────────────────────────────────────────
const wrap = document.getElementById('canvas-wrap');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let W, H;
// Margins so points aren't right at the edge
const PAD = 48;

function resize() {
  const dpr = window.devicePixelRatio || 1;
  W = wrap.clientWidth;
  H = wrap.clientHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.scale(dpr, dpr);
  draw();
}

// Map data coords [0,100] → canvas pixels via current transform
function dataToCanvas(x, y) {
  const cx = PAD + (x / 100) * (W - 2 * PAD);
  const cy = PAD + ((100 - y) / 100) * (H - 2 * PAD);  // invert Y
  return [
    cx * transform.scale + transform.x,
    cy * transform.scale + transform.y,
  ];
}

function canvasToData(px, py) {
  const cx = (px - transform.x) / transform.scale;
  const cy = (py - transform.y) / transform.scale;
  const x = (cx - PAD) / (W - 2 * PAD) * 100;
  const y = 100 - (cy - PAD) / (H - 2 * PAD) * 100;
  return [x, y];
}

// ─── Drawing ──────────────────────────────────────────────────────────────────
const POINT_RADIUS = 3.5;
const GOOGLE_ALPHA = 0.55;
const INDIE_ALPHA = 0.85;

function getColor(font) {
  if (colorMode === 'supplier') {
    return SUPPLIER_COLORS[font.supplier] || SUPPLIER_COLORS.unknown;
  } else {
    return CATEGORY_COLORS[font.category] || CATEGORY_COLORS.unknown;
  }
}

function getAlpha(font) {
  if (colorMode === 'supplier') {
    return font.supplier === 'google' ? GOOGLE_ALPHA : INDIE_ALPHA;
  }
  return 0.8;
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return \`rgba(\${r},\${g},\${b},\${alpha})\`;
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  // Background grid (subtle)
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let gx = 0; gx <= 100; gx += 10) {
    const [cx] = dataToCanvas(gx, 0);
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke();
  }
  for (let gy = 0; gy <= 100; gy += 10) {
    const [, cy] = dataToCanvas(0, gy);
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.stroke();
  }
  ctx.restore();

  // Draw google points first (bottom layer), then indie
  const google = FONTS.filter(f => f.supplier === 'google');
  const indie = FONTS.filter(f => f.supplier !== 'google');

  function drawPoints(list) {
    list.forEach(font => {
      if (font === hoveredFont) return; // draw hovered separately
      const [cx, cy] = dataToCanvas(font.x, font.y);
      // Clip — skip if way off screen
      if (cx < -20 || cx > W + 20 || cy < -20 || cy > H + 20) return;

      const color = getColor(font);
      const alpha = getAlpha(font);
      ctx.beginPath();
      ctx.arc(cx, cy, POINT_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(color, alpha);
      ctx.fill();
    });
  }

  if (colorMode === 'supplier') {
    drawPoints(google);
    drawPoints(indie);
  } else {
    drawPoints(FONTS);
  }

  // Hovered point highlight
  if (hoveredFont) {
    const [cx, cy] = dataToCanvas(hoveredFont.x, hoveredFont.y);
    const color = getColor(hoveredFont);
    ctx.beginPath();
    ctx.arc(cx, cy, POINT_RADIUS + 2, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Landmark labels
  drawLandmarks();

  // Zoom indicator
  document.getElementById('zoom-indicator').textContent =
    \`zoom \${transform.scale.toFixed(2)}×\`;
}

function drawLandmarks() {
  ctx.save();
  LANDMARKS.forEach(name => {
    const font = byFamily[name];
    if (!font) return;
    const [cx, cy] = dataToCanvas(font.x, font.y);
    if (cx < -60 || cx > W + 60 || cy < -20 || cy > H + 20) return;

    // Ring around the point
    const color = getColor(font);
    ctx.beginPath();
    ctx.arc(cx, cy, POINT_RADIUS + 3, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Label
    ctx.font = '600 10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    const labelY = cy - POINT_RADIUS - 5;

    // Text shadow for legibility
    ctx.fillStyle = 'rgba(14,14,16,0.7)';
    ctx.fillText(name, cx + 1, labelY + 1);
    ctx.fillStyle = '#e5e5ea';
    ctx.fillText(name, cx, labelY);
  });
  ctx.restore();
}

// ─── Legend ───────────────────────────────────────────────────────────────────
function updateLegend() {
  const el = document.getElementById('legend');
  let html = '';

  if (colorMode === 'supplier') {
    html += '<div class="leg-title">Supplier</div>';
    const shown = Object.keys(SUPPLIER_COLORS).filter(k => k !== 'unknown');
    shown.forEach(k => {
      const count = FONTS.filter(f => f.supplier === k).length;
      if (!count) return;
      html += \`<div class="leg-row">
        <span class="leg-dot" style="background:\${SUPPLIER_COLORS[k]}"></span>
        <span>\${SUPPLIER_LABELS[k]} <span style="color:var(--text-dim)">(\${count})</span></span>
      </div>\`;
    });
  } else {
    html += '<div class="leg-title">Category</div>';
    const shown = Object.keys(CATEGORY_LABELS);
    shown.forEach(k => {
      const count = FONTS.filter(f => f.category === k).length;
      if (!count) return;
      html += \`<div class="leg-row">
        <span class="leg-dot" style="background:\${CATEGORY_COLORS[k]}"></span>
        <span>\${CATEGORY_LABELS[k]} <span style="color:var(--text-dim)">(\${count})</span></span>
      </div>\`;
    });
  }

  el.innerHTML = html;
}

// ─── Stats ────────────────────────────────────────────────────────────────────
function updateStats() {
  const unmatched = ${unmatched};
  document.getElementById('stats').innerHTML =
    \`\${FONTS.length} fonts · \${FONTS.length - unmatched} with metadata\` +
    (unmatched ? \` · \${unmatched} unmatched\` : '');
}

// ─── Color mode toggle ────────────────────────────────────────────────────────
function setColorMode(mode) {
  colorMode = mode;
  document.getElementById('btn-supplier').classList.toggle('active', mode === 'supplier');
  document.getElementById('btn-category').classList.toggle('active', mode === 'category');
  updateLegend();
  draw();
}

// ─── Zoom / pan ───────────────────────────────────────────────────────────────
const MIN_SCALE = 0.3;
const MAX_SCALE = 20;

function clampTransform() {
  // Allow panning generously but not infinitely
  const maxPan = Math.max(W, H) * 2;
  transform.x = Math.max(-maxPan, Math.min(maxPan, transform.x));
  transform.y = Math.max(-maxPan, Math.min(maxPan, transform.y));
  transform.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, transform.scale));
}

function zoomAround(cx, cy, factor) {
  transform.x = cx - (cx - transform.x) * factor;
  transform.y = cy - (cy - transform.y) * factor;
  transform.scale *= factor;
  clampTransform();
  draw();
}

function zoomIn() { zoomAround(W/2, H/2, 1.3); }
function zoomOut() { zoomAround(W/2, H/2, 1/1.3); }

function resetView() {
  transform = { x: 0, y: 0, scale: 1 };
  draw();
}

// ─── Mouse / wheel events ─────────────────────────────────────────────────────
let isPanning = false;
let panStart = { x: 0, y: 0, tx: 0, ty: 0 };

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const cx = e.clientX - rect.left;
  const cy = e.clientY - rect.top;
  const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
  zoomAround(cx, cy, factor);
}, { passive: false });

canvas.addEventListener('mousedown', e => {
  if (e.button !== 0) return;
  isPanning = true;
  panStart = { x: e.clientX, y: e.clientY, tx: transform.x, ty: transform.y };
  wrap.classList.add('panning');
});

window.addEventListener('mousemove', e => {
  if (isPanning) {
    transform.x = panStart.tx + (e.clientX - panStart.x);
    transform.y = panStart.ty + (e.clientY - panStart.y);
    clampTransform();
    draw();
    return;
  }
  handleHover(e);
});

window.addEventListener('mouseup', () => {
  isPanning = false;
  wrap.classList.remove('panning');
});

canvas.addEventListener('mouseleave', () => {
  if (isPanning) return;
  hideTooltip();
  hoveredFont = null;
  draw();
});

// ─── Hover / tooltip ──────────────────────────────────────────────────────────
// Build a spatial index for fast nearest-neighbor lookup
// Simple grid-based approach
const GRID_CELLS = 40;
const grid = {};

function gridKey(gx, gy) { return \`\${gx},\${gy}\`; }

function buildGrid() {
  FONTS.forEach((font, i) => {
    const gx = Math.floor(font.x / 100 * GRID_CELLS);
    const gy = Math.floor(font.y / 100 * GRID_CELLS);
    const k = gridKey(Math.min(gx, GRID_CELLS-1), Math.min(gy, GRID_CELLS-1));
    if (!grid[k]) grid[k] = [];
    grid[k].push(i);
  });
}

function findNearest(dataX, dataY, radius) {
  // Search surrounding grid cells
  const gx = Math.floor(dataX / 100 * GRID_CELLS);
  const gy = Math.floor(dataY / 100 * GRID_CELLS);
  const cellR = Math.ceil(radius / 100 * GRID_CELLS) + 1;

  let best = null, bestDist = Infinity;
  for (let dx = -cellR; dx <= cellR; dx++) {
    for (let dy = -cellR; dy <= cellR; dy++) {
      const k = gridKey(gx + dx, gy + dy);
      const cell = grid[k];
      if (!cell) continue;
      cell.forEach(i => {
        const f = FONTS[i];
        const d = Math.hypot(f.x - dataX, f.y - dataY);
        if (d < bestDist) { bestDist = d; best = f; }
      });
    }
  }
  return bestDist <= radius ? best : null;
}

function handleHover(e) {
  const rect = canvas.getBoundingClientRect();
  const px = e.clientX - rect.left;
  const py = e.clientY - rect.top;
  if (px < 0 || px > W || py < 0 || py > H) return;

  // Convert to data coords
  const [dataX, dataY] = canvasToData(px, py);
  // Search radius in data units, adjusted for zoom
  const radiusPx = 12;
  const radiusData = radiusPx / (transform.scale * (W - 2*PAD) / 100);

  const found = findNearest(dataX, dataY, radiusData);

  if (found !== hoveredFont) {
    hoveredFont = found;
    draw();
    if (found) {
      showTooltip(e, found);
    } else {
      hideTooltip();
    }
  } else if (found) {
    // Just move tooltip
    positionTooltip(e);
  }
}

function loadGoogleFont(family) {
  if (loadedFonts.has(family) || loadingFonts.has(family)) return;
  loadingFonts.add(family);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = \`https://fonts.googleapis.com/css2?family=\${encodeURIComponent(family)}:wght@400;700&display=swap\`;
  link.onload = () => { loadedFonts.add(family); loadingFonts.delete(family); };
  document.head.appendChild(link);
}

function showTooltip(e, font) {
  const tt = document.getElementById('tooltip');
  const ttFamily = document.getElementById('tt-family');
  const ttBadge = document.getElementById('tt-badge');
  const ttMeta = document.getElementById('tt-meta');

  // Load Google Font on demand
  if (font.supplier === 'google') {
    loadGoogleFont(font.family);
    ttFamily.style.fontFamily = \`"\${font.family}", sans-serif\`;
  } else {
    ttFamily.style.fontFamily = 'system-ui, sans-serif';
  }

  ttFamily.textContent = font.family;

  const supplierColor = SUPPLIER_COLORS[font.supplier] || '#6b7280';
  ttBadge.textContent = (font.supplier || 'unknown').charAt(0).toUpperCase() + (font.supplier || 'unknown').slice(1);
  ttBadge.style.background = supplierColor + '22';
  ttBadge.style.color = supplierColor;

  const catLabel = font.category === 'sans-serif' ? 'Sans-serif' :
                   font.category ? font.category.charAt(0).toUpperCase() + font.category.slice(1) : '—';
  const rankStr = font.popularityRank != null ? \`#\${font.popularityRank}\` : '—';

  ttMeta.innerHTML = \`
    <span>Category: \${catLabel}</span>
    <span>Popularity rank: \${rankStr}</span>
  \`;

  tt.style.display = 'block';
  positionTooltip(e);
}

function positionTooltip(e) {
  const tt = document.getElementById('tooltip');
  const margin = 12;
  let left = e.clientX + margin;
  let top = e.clientY + margin;
  const tw = tt.offsetWidth || 200;
  const th = tt.offsetHeight || 100;
  if (left + tw > window.innerWidth - 8) left = e.clientX - tw - margin;
  if (top + th > window.innerHeight - 8) top = e.clientY - th - margin;
  tt.style.left = left + 'px';
  tt.style.top = top + 'px';
}

function hideTooltip() {
  document.getElementById('tooltip').style.display = 'none';
}

// ─── Touch support (pinch zoom + pan) ────────────────────────────────────────
let touches = {};
let lastPinchDist = null;
let touchPanStart = null;

canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  if (e.touches.length === 1) {
    touchPanStart = {
      x: e.touches[0].clientX, y: e.touches[0].clientY,
      tx: transform.x, ty: transform.y
    };
    lastPinchDist = null;
  } else if (e.touches.length === 2) {
    touchPanStart = null;
    lastPinchDist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
  }
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  if (e.touches.length === 1 && touchPanStart) {
    transform.x = touchPanStart.tx + (e.touches[0].clientX - touchPanStart.x);
    transform.y = touchPanStart.ty + (e.touches[0].clientY - touchPanStart.y);
    clampTransform();
    draw();
  } else if (e.touches.length === 2 && lastPinchDist !== null) {
    const dist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    const rect = canvas.getBoundingClientRect();
    zoomAround(cx - rect.left, cy - rect.top, dist / lastPinchDist);
    lastPinchDist = dist;
  }
}, { passive: false });

canvas.addEventListener('touchend', e => {
  if (e.touches.length < 2) lastPinchDist = null;
  if (e.touches.length === 0) touchPanStart = null;
}, { passive: false });

// ─── Init ─────────────────────────────────────────────────────────────────────
buildGrid();
window.addEventListener('resize', resize);
resize();
updateLegend();
updateStats();
</script>
</body>
</html>`;
}
