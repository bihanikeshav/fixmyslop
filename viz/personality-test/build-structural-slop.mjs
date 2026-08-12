#!/usr/bin/env node
// build-structural-slop.mjs
// Builds viz/personality-test/structural-slop.html — a self-contained,
// data-inlined ranked bar chart of the AI STRUCTURAL monoculture: the % of
// crawled sites using each structural tell. Companion to the color-slop viz.
//
// Run: node viz/personality-test/build-structural-slop.mjs
//   (run build-structural-prevalence.mjs first to refresh the data)

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");

const prevalence = JSON.parse(
  readFileSync(resolve(ROOT, "data/structural-prevalence.json"))
);
const rows = prevalence.slice().sort((a, b) => b.sitesPct - a.sitesPct);
const maxPct = Math.max(...rows.map((r) => r.sitesPct));

const GROUPS = {
  style: { label: "style", color: "#e0823d" },
  gradient: { label: "gradient", color: "#a855f7" },
  motion: { label: "motion", color: "#3aa6b9" },
  stack: { label: "stack", color: "#7c8a99" },
};

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const barsHTML = rows
  .map((r) => {
    const g = GROUPS[r.group] || { color: "#888", label: r.group };
    const w = (r.sitesPct / maxPct) * 100;
    return `<div class="row">
  <div class="bar-label" title="${esc(r.marker)}">${esc(r.label)}</div>
  <div class="bar-track">
    <div class="bar" style="width:${w.toFixed(2)}%;background:${g.color}"></div>
    <span class="bar-value">${r.sitesPct}% <span class="count">(${r.count})</span></span>
  </div>
</div>`;
  })
  .join("\n");

const legendHTML = Object.values(GROUPS)
  .map((g) => `<span class="legend-item"><span class="dot" style="background:${g.color}"></span>${g.label}</span>`)
  .join("\n");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>The AI Structural Monoculture, Measured</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0f0f0f;
    --surface: #161616;
    --border: #262626;
    --text: #ececec;
    --muted: #8a8a8a;
    --track: #1d1d1d;
  }
  body {
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    padding: 0 0 80px;
  }
  .wrap { max-width: 960px; margin: 0 auto; padding: 56px 32px 0; }
  h1 { font-size: 27px; font-weight: 700; letter-spacing: -0.5px; margin-bottom: 8px; }
  .subtitle { color: var(--muted); font-size: 15px; max-width: 640px; }
  .legend { display: flex; gap: 20px; flex-wrap: wrap; margin: 26px 0 8px; font-size: 13px; color: var(--muted); }
  .legend-item { display: inline-flex; align-items: center; gap: 7px; }
  .dot { width: 11px; height: 11px; border-radius: 3px; display: inline-block; }

  .chart { margin-top: 18px; border-top: 1px solid var(--border); }
  .row {
    display: grid;
    grid-template-columns: 230px 1fr;
    align-items: center;
    gap: 16px;
    padding: 7px 0;
    border-bottom: 1px solid var(--border);
  }
  .bar-label { font-size: 13px; text-align: right; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bar-track { position: relative; height: 26px; background: var(--track); border-radius: 5px; overflow: hidden; }
  .bar { height: 100%; border-radius: 5px; min-width: 2px; transition: width .6s cubic-bezier(.2,.7,.3,1); }
  .bar-value {
    position: absolute; top: 0; left: 12px; height: 26px;
    display: flex; align-items: center;
    font-variant-numeric: tabular-nums; font-weight: 600; font-size: 12.5px;
    color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,.55); pointer-events: none;
  }
  .count { color: rgba(255,255,255,.6); font-weight: 400; margin-left: 2px; }
  .caption { margin-top: 28px; color: var(--muted); font-size: 13px; font-style: italic; }
  @media (max-width: 620px) {
    .row { grid-template-columns: 140px 1fr; gap: 10px; }
    .bar-label { font-size: 12px; }
  }
  @media (prefers-reduced-motion: reduce) { .bar { transition: none; } }
</style>
</head>
<body>
  <div class="wrap">
    <h1>The AI structural monoculture, measured</h1>
    <p class="subtitle">
      Every AI-built site reaches for the same structural moves: the glass nav, the pill,
      the bento grid, the blue&#8594;purple gradient. Each bar is the share of crawled sites
      using that one tell &mdash; the bigger the bar, the more it screams &ldquo;made by an AI.&rdquo;
    </p>

    <div class="legend">
${legendHTML}
    </div>

    <div class="chart">
${barsHTML}
    </div>

    <p class="caption">the AI structural monoculture, measured across 1266 sites</p>
  </div>
</body>
</html>
`;

const outPath = resolve(HERE, "structural-slop.html");
writeFileSync(outPath, html, "utf8");
console.log(`wrote ${outPath} (${rows.length} markers, max ${maxPct}%)`);
