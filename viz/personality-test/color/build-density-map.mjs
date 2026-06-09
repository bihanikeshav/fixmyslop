#!/usr/bin/env node
// build-density-map.mjs — generates density-map.html, a standalone visual sanity
// check for the density field. It draws a few constant-L OKLCH slices (hue ×
// chroma) with the KDE heat shaded underneath and the corpus colors plotted as
// dots, so you can eyeball that the hot zones are where Tailwind / our builds
// actually live. Re-run after changing the corpus or tunables.
//
//   node build-density-map.mjs   ->   writes density-map.html (open in a browser)
//
// We embed a snapshot of the corpus (hex + OKLCH + kind) directly in the HTML so
// the file opens over file:// with no server and no network.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { loadCorpus } from "./corpus.mjs";
import { hexToOklch } from "./color-space.mjs";
import { CONFIG } from "./density.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

const snapshot = loadCorpus().map((c) => {
  const [L, C, H] = hexToOklch(c.hex);
  return { hex: c.hex, L: +L.toFixed(3), C: +C.toFixed(3), H: +H.toFixed(1), k: c.kind === "framework" ? "f" : "o" };
});

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AI-overused color density map (OKLCH)</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; padding: 24px; background: #faf8f4; color: #1c1812;
         font: 14px/1.5 ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  p.note { max-width: 70ch; color: #5b5347; margin: 0 0 18px; }
  .row { display: flex; flex-wrap: wrap; gap: 28px; }
  .slice { }
  .slice h2 { font-size: 13px; font-weight: 600; margin: 0 0 6px; }
  canvas { border: 1px solid #d8cfc0; display: block; background: #fff; }
  .axis { color: #8a7f6e; font-size: 11px; margin-top: 4px; }
  .legend { margin-top: 16px; font-size: 12px; color: #5b5347; }
  .legend b { color: #1c1812; }
  .dotF { color: #1a1a1a; } .dotO { color: #b00; }
</style></head><body>
<h1>AI-overused color density map &mdash; OKLCH slices</h1>
<p class="note">Each panel is a constant-lightness slice of OKLCH: x = hue (0&ndash;360&deg;),
y = chroma (0 at bottom &rarr; 0.30 at top). The shading is the kernel-density
"heat" of the AI-slop corpus (darker red = more overused). Dots are corpus
colors at that lightness (&plusmn;0.05): <span class="dotF">&#9679; black = framework default</span>,
<span class="dotO">&#9679; red = our own builds</span>. The point is to see the hot zones sit
where Tailwind / our builds actually cluster &mdash; warm earth (hue ~30&ndash;90&deg;) is hottest
because our builds converge there.</p>
<div class="row" id="root"></div>
<div class="legend">
  bandwidth = <b>${CONFIG.BANDWIDTH}</b> &nbsp; overuse threshold = <b>${CONFIG.OVERUSE_THRESHOLD}</b>
  &nbsp; neutral-chroma cutoff = <b>${CONFIG.NEUTRAL_CHROMA}</b> &nbsp;|&nbsp;
  corpus = <b>${snapshot.length}</b> points. The black contour marks the overuse threshold.
</div>
<script>
const CORPUS = ${JSON.stringify(snapshot)};
const BW = ${CONFIG.BANDWIDTH};
const THRESH = ${CONFIG.OVERUSE_THRESHOLD};
const CMAX = 0.30;            // chroma axis max
const W = 360, H = 220;       // canvas px (1px/deg hue)

// --- minimal OKLCH -> sRGB (for painting the dots & gamut mask) ---
function oklchToLinear(L,C,h){
  const r=h*Math.PI/180, a=C*Math.cos(r), b=C*Math.sin(r);
  const l_=L+0.3963377774*a+0.2158037573*b, m_=L-0.1055613458*a-0.0638541728*b, s_=L-0.0894841775*a-1.2914855480*b;
  const l=l_**3,m=m_**3,s=s_**3;
  return [4.0767416621*l-3.3077115913*m+0.2309699292*s,
         -1.2684380046*l+2.6097574011*m-0.3413193965*s,
         -0.0041960863*l-0.7034186147*m+1.7076147010*s];
}
function lin2srgb(c){return c<=0.0031308?12.92*c:1.055*Math.pow(c,1/2.4)-0.055;}
function inGamut(rgb){return rgb.every(c=>c>=-1e-3&&c<=1+1e-3);}
function oklchCss(L,C,h){const rgb=oklchToLinear(L,C,h).map(lin2srgb);
  const ch=v=>Math.max(0,Math.min(255,Math.round(v*255)));return 'rgb('+ch(rgb[0])+','+ch(rgb[1])+','+ch(rgb[2])+')';}
// OKLCH -> OKLab for KDE distance
function oklab(L,C,h){const r=h*Math.PI/180;return [L,C*Math.cos(r),C*Math.sin(r)];}

function densityAt(lab, pts){
  const t=2*BW*BW; let s=0;
  for(const p of pts){const d2=(lab[0]-p[0])**2+(lab[1]-p[1])**2+(lab[2]-p[2])**2; s+=Math.exp(-d2/t);}
  return s;
}
function heatColor(d){ // 0..~42 -> light->deep red
  const t=Math.min(1, d/35);
  const r=Math.round(255-(255-150)*t), g=Math.round(245-245*t*0.95), b=Math.round(235-235*t*0.95);
  return [r,g,b];
}

const SLICES=[0.30,0.45,0.60,0.78];
const root=document.getElementById('root');
// precompute corpus OKLab once
const labAll=CORPUS.map(c=>({lab:oklab(c.L,c.C,c.H), c}));

for(const Lslice of SLICES){
  const wrap=document.createElement('div'); wrap.className='slice';
  const title=document.createElement('h2'); title.textContent='L = '+Lslice.toFixed(2); wrap.appendChild(title);
  const cv=document.createElement('canvas'); cv.width=W; cv.height=H; wrap.appendChild(cv);
  const ax=document.createElement('div'); ax.className='axis'; ax.textContent='hue 0→360°  ×  chroma 0→'+CMAX; wrap.appendChild(ax);
  root.appendChild(wrap);
  const ctx=cv.getContext('2d');
  const img=ctx.createImageData(W,H);
  const labs=labAll.map(o=>o.lab);
  for(let px=0;px<W;px++){
    const hue=px; // 1deg/px
    for(let py=0;py<H;py++){
      const chroma=CMAX*(1-py/H);
      const i=(py*W+px)*4;
      const rgb=oklchToLinear(Lslice,chroma,hue).map(lin2srgb);
      if(!inGamut(rgb)){ img.data[i]=245;img.data[i+1]=243;img.data[i+2]=239;img.data[i+3]=255; continue; }
      const d=densityAt(oklab(Lslice,chroma,hue),labs);
      const [r,g,b]=heatColor(d);
      img.data[i]=r;img.data[i+1]=g;img.data[i+2]=b;img.data[i+3]=255;
    }
  }
  ctx.putImageData(img,0,0);
  // threshold contour (mark cells crossing THRESH)
  ctx.fillStyle='rgba(0,0,0,0.55)';
  for(let px=0;px<W;px++){for(let py=1;py<H;py++){
    const hue=px;
    const c0=CMAX*(1-py/H), c1=CMAX*(1-(py-1)/H);
    const r0=oklchToLinear(Lslice,c0,hue).map(lin2srgb), r1=oklchToLinear(Lslice,c1,hue).map(lin2srgb);
    if(!inGamut(r0)||!inGamut(r1))continue;
    const d0=densityAt(oklab(Lslice,c0,hue),labs), d1=densityAt(oklab(Lslice,c1,hue),labs);
    if((d0-THRESH)*(d1-THRESH)<0){ ctx.fillRect(px,py,1,1); }
  }}
  // corpus dots near this lightness
  for(const o of labAll){
    if(Math.abs(o.c.L-Lslice)>0.06) continue;
    if(o.c.C> CMAX) continue;
    const x=o.c.H, y=H*(1-o.c.C/CMAX);
    ctx.beginPath(); ctx.arc(x,y,2.2,0,7);
    ctx.fillStyle=o.c.k==='f'?'#111':'#cc1111'; ctx.fill();
    ctx.lineWidth=0.6; ctx.strokeStyle='rgba(255,255,255,0.7)'; ctx.stroke();
  }
}
</script>
</body></html>
`;

const out = resolve(HERE, "density-map.html");
writeFileSync(out, html);
console.log(`wrote ${out} (${snapshot.length} corpus points embedded)`);
