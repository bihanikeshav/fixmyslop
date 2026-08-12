#!/usr/bin/env node
// build-color-roles-viz.mjs — generates color-roles.html, a standalone viewer for
// the ROLE-AWARE color model built by build-color-roles.mjs.
//
//   node build-color-roles-viz.mjs   ->   writes color-roles.html (open over file://)
//
// Shows:
//   - three role columns (GROUND / INK / ACCENT): ranked swatch strips with #sites
//   - an ACCENT-hue histogram (the isolated indigo spike)
//   - a "Top palette templates" row of ground+accent swatch PAIRS with % share + name
//
// All data is read from the observations.*.json files and inlined into the HTML,
// so the file opens with no server and no network.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { hexToOklch } from "./color-space.mjs";
import { roleThreshold, classifyRole } from "./roles.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../../..");

function readJSON(rel, fallback) {
  try { return JSON.parse(readFileSync(resolve(ROOT, rel), "utf8")); }
  catch { return fallback; }
}

const ground = readJSON("data/observations.colors.ground.json", []);
const ink = readJSON("data/observations.colors.ink.json", []);
const accent = readJSON("data/observations.colors.accent.json", []);
const palettes = readJSON("data/observations.palettes.json", { nSites: 0, templates: [], accentHueHist: [] });

// Annotate the top swatches of each role with their role verdict so the viz can
// flag OVERUSED / HARD-BANNED chromatic colors against that role's own corpus.
function annotate(records, role, top) {
  return records.slice(0, top).map((r) => {
    const c = classifyRole(r.hex, role);
    return { hex: r.hex, sites: r.sites, verdict: c.verdict, density: +c.density.toFixed(1) };
  });
}

const data = {
  nSites: palettes.nSites,
  thresholds: {
    ground: +roleThreshold("ground").toFixed(1),
    ink: +roleThreshold("ink").toFixed(1),
    accent: +roleThreshold("accent").toFixed(1),
  },
  ground: annotate(ground, "ground", 24),
  ink: annotate(ink, "ink", 24),
  accent: annotate(accent, "accent", 30),
  accentHueHist: palettes.accentHueHist || [],
  templates: (palettes.templates || []).slice(0, 12),
};

const json = JSON.stringify(data);

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Role-aware color model &mdash; GROUND / INK / ACCENT</title>
<style>
  :root { color-scheme: light; }
  body { margin:0; padding:28px; background:#faf8f4; color:#1c1812;
         font:14px/1.55 ui-monospace,"SF Mono",Menlo,Consolas,monospace; }
  h1 { font-size:20px; margin:0 0 4px; }
  h2 { font-size:14px; margin:0 0 8px; letter-spacing:.04em; text-transform:uppercase; color:#3a342a; }
  p.note { max-width:78ch; color:#5b5347; margin:0 0 22px; }
  .cols { display:grid; grid-template-columns:repeat(3,1fr); gap:24px; margin-bottom:34px; }
  .col { background:#fff; border:1px solid #e3dccd; border-radius:10px; padding:16px 16px 18px; }
  .col .cap { font-size:11.5px; color:#6b6253; margin:-4px 0 12px; }
  .strip { display:flex; flex-direction:column; gap:5px; }
  .sw { display:grid; grid-template-columns:30px 1fr auto; align-items:center; gap:9px; }
  .chip { width:30px; height:22px; border-radius:5px; border:1px solid rgba(0,0,0,.18); }
  .hex { font-size:12px; }
  .n { font-size:11.5px; color:#7a7160; text-align:right; }
  .tag { font-size:9.5px; padding:1px 5px; border-radius:999px; margin-left:6px; vertical-align:middle; }
  .OVERUSED { background:#f4d9c2; color:#8a3b12; }
  .HARD-BANNED { background:#f6c9c9; color:#9a1313; }
  .SAFE { background:#d9ecd4; color:#2c5e22; }
  .NEUTRAL-ok { background:#e7e2d6; color:#6b6253; }
  .hist { display:flex; flex-direction:column; gap:6px; max-width:560px; margin-bottom:34px; }
  .bar { display:grid; grid-template-columns:64px 1fr 48px; align-items:center; gap:10px; }
  .bar .track { height:18px; background:#efe9dc; border-radius:4px; overflow:hidden; }
  .bar .fill { height:100%; }
  .tmpls { display:flex; flex-wrap:wrap; gap:14px; }
  .tmpl { background:#fff; border:1px solid #e3dccd; border-radius:10px; padding:12px 14px; width:248px; }
  .pair { display:flex; gap:0; height:42px; border-radius:7px; overflow:hidden; border:1px solid rgba(0,0,0,.18); margin-bottom:8px; }
  .pair div { flex:1; }
  .tmpl .name { font-size:11.5px; line-height:1.35; min-height:2.7em; }
  .tmpl .pct { font-size:16px; font-weight:700; }
  .tmpl .pct small { font-size:11px; font-weight:400; color:#7a7160; }
  .meta { font-size:12px; color:#5b5347; margin-top:28px; border-top:1px solid #e3dccd; padding-top:14px; }
  code { background:#efe9dc; padding:1px 5px; border-radius:4px; }
</style></head><body>
<h1>Role-aware color model</h1>
<p class="note">Colors play <b>roles</b> the way fonts do (hero/body/mono). The same hex
is judged differently per role: <code>#ffffff</code> is the most over-used <b>ground</b> and a fine one;
an indigo is slop only as an <b>accent</b>. Each role has its own corpus (site-frequency across the crawl)
and its own relative overuse threshold (p90 of that role's chromatic self-density). Built from
<code>data/feature-crawl-raw.ndjson</code> &rarr; <span id="nsites"></span> sites.</p>

<div class="cols" id="cols"></div>

<h2>Accent hue histogram</h2>
<p class="note" style="margin-top:-10px">The isolated spike: across sites' primary accent, the blue&ndash;purple band
(indigo + blue) dwarfs everything else &mdash; the statistical signature of AI-startup color.</p>
<div class="hist" id="hist"></div>

<h2>Top palette templates</h2>
<p class="note" style="margin-top:-10px">The <b>combination</b> is the real identity. Each card is a
representative ground+accent pair for one template, with its share of sites.</p>
<div class="tmpls" id="tmpls"></div>

<div class="meta" id="meta"></div>

<script id="data" type="application/json">${json}</script>
<script>
const D = JSON.parse(document.getElementById('data').textContent);
document.getElementById('nsites').textContent = D.nSites;

function strip(records){
  return records.map(r=>{
    const tag = (r.verdict==='OVERUSED'||r.verdict==='HARD-BANNED')
      ? '<span class="tag '+r.verdict+'">'+r.verdict+'</span>' : '';
    return '<div class="sw"><span class="chip" style="background:'+r.hex+'"></span>'
      + '<span class="hex">'+r.hex+tag+'</span>'
      + '<span class="n">'+r.sites+'</span></div>';
  }).join('');
}
const cols = [
  ['GROUND','dominant page background, area-weighted','ground'],
  ['INK','dominant text color, area-weighted','ink'],
  ['ACCENT','dominant chromatic (brand) color','accent'],
];
document.getElementById('cols').innerHTML = cols.map(([title,cap,key])=>
  '<div class="col"><h2>'+title+'</h2><div class="cap">'+cap
  +' &middot; threshold '+D.thresholds[key]+'</div><div class="strip">'+strip(D[key])+'</div></div>'
).join('');

// hue histogram (color the bar with a representative hue swatch)
const hueColor = {red:'#d33',orange:'#e88424',yellow:'#d8b021',green:'#3a9d4a',
  teal:'#1aa39a',cyan:'#23a8c4',blue:'#2563eb',indigo:'#6366f1',violet:'#8b5cf6',
  magenta:'#c026d3',pink:'#ec4899'};
const maxH = Math.max(1,...D.accentHueHist.map(h=>h.sites));
document.getElementById('hist').innerHTML = D.accentHueHist.map(h=>
  '<div class="bar"><span class="hex">'+h.bucket+'</span>'
  +'<span class="track"><span class="fill" style="width:'+(100*h.sites/maxH)+'%;background:'+(hueColor[h.bucket]||'#999')+'"></span></span>'
  +'<span class="n">'+h.sites+'</span></div>'
).join('');

// palette template cards
document.getElementById('tmpls').innerHTML = D.templates.map(t=>{
  const g = t.rep.ground || '#cccccc';
  const a = t.rep.accent || '#888888';
  return '<div class="tmpl"><div class="pair"><div style="background:'+g+'"></div>'
    +'<div style="background:'+a+'"></div></div>'
    +'<div class="pct">'+t.sharePct+'<small>% of sites</small></div>'
    +'<div class="name">'+t.name+'</div></div>';
}).join('');

document.getElementById('meta').innerHTML =
  'Role corpora &amp; thresholds (p90 of chromatic self-density): '
  +'ground '+D.thresholds.ground+' &middot; ink '+D.thresholds.ink+' &middot; accent '+D.thresholds.accent+'. '
  +'Tags flag colors OVER-used / HARD-BANNED <i>for that role</i>. '
  +'Built from data/observations.colors.{ground,ink,accent}.json + observations.palettes.json.';
</script>
</body></html>`;

const out = resolve(HERE, "color-roles.html");
writeFileSync(out, html);
console.log(`wrote ${out} (${(html.length / 1024).toFixed(1)} KB, ${data.nSites} sites)`);
