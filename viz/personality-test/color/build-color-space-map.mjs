// build-color-space-map.mjs — classify the AI-crawl colors into BUCKETS and
// inline everything into a self-contained color-space-map.html.
//
// THE BUCKET MODEL (what each AI-crawl color "is"):
//   framework-default  — hex is hardBanned() OR sits in the framework default
//                        set (Tailwind/Material/Bootstrap/...). Verb: BANNED —
//                        nobody's identity. It's the boilerplate everyone ships.
//   originator         — within ΔEok ~0.05 of a getdesign brand color. Verb:
//                        CLONE RISK — you'll look like <brand>. Someone earned
//                        this color first.
//   ubiquitous-reflex  — density >= a RELATIVE p90 threshold of usable space,
//                        and not originator/framework. Verb: IDENTITY-NEUTRAL —
//                        too common to be your move.
//   safe               — everything else. Verb: OPEN — room to be yourself.
//
// Output: color-space-map.html (data inlined) next to this script.
//
// Run: node viz/personality-test/color/build-color-space-map.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import {
  hexToOklab, hexToOklch, oklchToOklab, oklabToSrgb,
  deltaEok, isInGamut,
} from "./color-space.mjs";
import { density, hardBanned } from "./density.mjs";
import { frameworkCorpus } from "./corpus.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../../..");
const OBS = resolve(ROOT, "data/observations.colors.json");
const GETDESIGN = resolve(ROOT, "data/reference/getdesign/index.json");
const OUT = resolve(HERE, "color-space-map.html");

// ΔEok radius around an originator brand color that counts as "you'll look like
// them." 0.04 is ~just-noticeable — only a near-exact match to a brand's IDENTITY
// hue counts as a clone. (Tightened from 0.05 alongside the move to
// identityColors; the old greedy `colors` dump at 0.05 fired on neutrals/
// surfaces/semantic tokens and made ~89% of crawl colors falsely "originator".)
const ORIGINATOR_DELTA = 0.04;

// ---------------------------------------------------------------------------
// Load data
// ---------------------------------------------------------------------------
const crawl = JSON.parse(readFileSync(OBS, "utf8"))
  .filter((r) => r && typeof r.hex === "string");
const brands = JSON.parse(readFileSync(GETDESIGN, "utf8"));

// Framework default set (hex membership). Lower-cased.
const fwSet = new Set(frameworkCorpus().map((c) => c.hex.toLowerCase()));

// Flatten getdesign brands into originator points with the brand name + lab.
// Use IDENTITY-ROLE colors only (identityColors) — extracted from token names so
// neutrals/surfaces/link/info/success/chart tokens are excluded. identityColors
// is already neutral-filtered, but we keep the chroma guard as a belt-and-braces.
const originators = [];
for (const b of brands) {
  const name = b.name || b.slug;
  for (const hex of b.identityColors || []) {
    let lab;
    try { lab = hexToOklab(hex); } catch { continue; }
    const [, C] = hexToOklch(hex);
    if (C < 0.04) continue; // neutral brand color — not a clonable identity
    originators.push({ hex: hex.toLowerCase(), name, lab, slug: b.slug });
  }
}

// Nearest originator (by ΔEok) to an arbitrary lab.
function nearestOriginator(lab) {
  let best = null, bestD = Infinity;
  for (const o of originators) {
    const d = deltaEok(lab, o.lab);
    if (d < bestD) { bestD = d; best = o; }
  }
  return { brand: best, delta: bestD };
}

// ---------------------------------------------------------------------------
// RELATIVE density threshold: p90 of usable-space density.
// "Usable space" = chromatic, mid-lightness, in-gamut OKLCH samples (the region
// where identity-accent colors actually live). We grid-sample that region and
// take the 90th percentile of density() there. This makes "ubiquitous" relative
// to how crowded the usable color space actually is, not an absolute magic number.
// ---------------------------------------------------------------------------
function computeP90() {
  const samples = [];
  for (let L = 0.20; L <= 0.90 + 1e-9; L += 0.05) {
    for (let H = 0; H < 360; H += 4) {
      for (let C = 0.05; C <= 0.30 + 1e-9; C += 0.02) {
        const lab = oklchToOklab([L, C, H]);
        if (C <= 0.04) continue;
        if (!isInGamut(lab)) continue;
        samples.push(density(lab));
      }
    }
  }
  samples.sort((a, b) => a - b);
  const idx = Math.min(samples.length - 1, Math.floor(0.90 * (samples.length - 1)));
  return { p90: samples[idx], nSamples: samples.length };
}

const { p90, nSamples } = computeP90();

// ---------------------------------------------------------------------------
// Classify each crawl color into a bucket.
// Order of precedence: framework-default > originator > ubiquitous-reflex > safe.
// (Framework first: a Tailwind swatch is "nobody's identity" even if it happens
// to also sit near a brand — the boilerplate verdict is the stronger signal.)
// ---------------------------------------------------------------------------
const BUCKETS = {
  "framework-default": { verb: "BANNED", caption: "framework boilerplate — nobody's identity", color: "#9aa0a6" },
  "originator":        { verb: "CLONE RISK", caption: "you'll look like an existing brand", color: "#ff4d6d" },
  "ubiquitous-reflex": { verb: "IDENTITY-NEUTRAL", caption: "too common to be your move", color: "#ffb020" },
  "safe":              { verb: "OPEN", caption: "room to be yourself", color: "#3ddc84" },
};

const points = [];
const counts = { "framework-default": 0, "originator": 0, "ubiquitous-reflex": 0, "safe": 0 };

for (const r of crawl) {
  const hex = r.hex.toLowerCase();
  let lab, lch;
  try { lab = hexToOklab(hex); lch = hexToOklch(hex); } catch { continue; }
  const [L, C, H] = lch;
  const d = density(lab);
  const ban = hardBanned(hex);
  const { brand, delta } = nearestOriginator(lab);

  let bucket;
  if (ban || fwSet.has(hex)) {
    bucket = "framework-default";
  } else if (brand && delta <= ORIGINATOR_DELTA) {
    bucket = "originator";
  } else if (C > 0.04 && d >= p90) {
    bucket = "ubiquitous-reflex";
  } else {
    bucket = "safe";
  }
  counts[bucket]++;

  points.push({
    hex,
    sites: Number.isFinite(r.sites) ? r.sites : (r.count || 1),
    L, C, H,
    density: d,
    bucket,
    nearestBrand: brand ? brand.name : null,
    nearestDelta: brand ? delta : null,
    banned: !!ban,
  });
}

// ---------------------------------------------------------------------------
// Named originator peaks: the brands whose color is nearest to the most crawl
// points (i.e. the brands AI builds are most converging onto). We rank brands by
// how many crawl colors land in their ΔEok ~0.05 basin, then by site weight.
// ---------------------------------------------------------------------------
const brandHits = new Map(); // brand name -> { count, sites, hex }
for (const p of points) {
  if (p.bucket !== "originator") continue;
  const key = p.nearestBrand;
  if (!brandHits.has(key)) brandHits.set(key, { name: key, count: 0, sites: 0 });
  const e = brandHits.get(key);
  e.count++; e.sites += p.sites;
}
const peaks = [...brandHits.values()]
  .sort((a, b) => b.sites - a.sites || b.count - a.count)
  .slice(0, 6);

// For each peak find a representative originator swatch (the brand color that
// is the actual attractor) so we can place a label at the right hue/chroma.
const peakSwatches = peaks.map((pk) => {
  // pick the brand color with the highest density (the crowded one)
  const cands = originators.filter((o) => o.name === pk.name);
  let best = cands[0], bestD = -1;
  for (const o of cands) {
    const dn = density(o.lab);
    if (dn > bestD) { bestD = dn; best = o; }
  }
  const [L, C, H] = hexToOklch(best.hex);
  return { name: pk.name, hex: best.hex, L, C, H, count: pk.count, sites: pk.sites };
});

// All originator swatches for the diamonds overlay (with lch precomputed).
const originatorSwatches = originators.map((o) => {
  const [L, C, H] = hexToOklch(o.hex);
  return { hex: o.hex, name: o.name, L, C, H };
});

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
console.log("=== build-color-space-map ===");
console.log(`crawl colors classified: ${points.length}`);
console.log(`usable-space density samples: ${nSamples}`);
console.log(`p90 threshold (relative): ${p90.toFixed(3)}`);
console.log("bucket counts:");
console.log(`  originator        : ${counts["originator"]}`);
console.log(`  framework-default : ${counts["framework-default"]}`);
console.log(`  ubiquitous-reflex : ${counts["ubiquitous-reflex"]}`);
console.log(`  safe              : ${counts["safe"]}`);
console.log("named originator peaks (brand : crawl-colors-in-basin / total-sites):");
for (const pk of peakSwatches) console.log(`  ${pk.name} : ${pk.count} / ${pk.sites}  (${pk.hex})`);

// ---------------------------------------------------------------------------
// Inline data + build the standalone HTML.
// ---------------------------------------------------------------------------
const DATA = {
  p90,
  nSamples,
  originatorDelta: ORIGINATOR_DELTA,
  buckets: BUCKETS,
  counts,
  points,
  originators: originatorSwatches,
  peaks: peakSwatches,
  slices: [0.25, 0.40, 0.55, 0.70, 0.85],
  chromaMax: 0.30,
};

// (the actual write happens at the very bottom, after CLIENT_JS is defined.)

// ===========================================================================
function renderHtml(data) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AI color-space map — what is what (OKLCH bucket model)</title>
<style>
  :root {
    --bg: #0d0f12; --panel: #15181d; --ink: #e8eaed; --dim: #9aa0a6; --line: #2a2e35;
    --b-framework: ${BUCKETS["framework-default"].color};
    --b-originator: ${BUCKETS["originator"].color};
    --b-ubiquitous: ${BUCKETS["ubiquitous-reflex"].color};
    --b-safe: ${BUCKETS["safe"].color};
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--ink);
    font: 14px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  header { padding: 22px 28px 6px; }
  h1 { margin: 0 0 4px; font-size: 22px; letter-spacing: -0.01em; }
  .sub { color: var(--dim); max-width: 980px; }
  .sub b { color: var(--ink); }
  .legend { display: flex; flex-wrap: wrap; gap: 10px; padding: 14px 28px 4px; }
  .chip { display: flex; gap: 9px; align-items: flex-start; background: var(--panel);
    border: 1px solid var(--line); border-radius: 10px; padding: 9px 12px; min-width: 230px; max-width: 300px; }
  .dot { width: 14px; height: 14px; border-radius: 50%; margin-top: 2px; flex: 0 0 auto; }
  .chip .name { font-weight: 600; }
  .chip .verb { font-size: 11px; font-weight: 700; letter-spacing: .04em; }
  .chip .cap { color: var(--dim); font-size: 12px; }
  .chip .n { color: var(--dim); font-size: 12px; margin-top: 2px; }
  .slices { display: flex; flex-wrap: wrap; gap: 18px; padding: 16px 28px 40px; }
  .slice { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 12px; }
  .slice h3 { margin: 0 0 8px; font-size: 13px; font-weight: 600; color: var(--ink); }
  .slice h3 span { color: var(--dim); font-weight: 400; }
  .cv { position: relative; }
  canvas { display: block; border-radius: 6px; }
  .axis { color: var(--dim); font-size: 11px; display:flex; justify-content:space-between; margin-top:4px; }
  .ylab { position:absolute; left:-30px; top:50%; transform:rotate(-90deg) translateX(50%); transform-origin:left center;
    color: var(--dim); font-size: 11px; white-space: nowrap; }
  #tip { position: fixed; pointer-events: none; z-index: 50; background: #000d; color: #fff;
    border: 1px solid #444; border-radius: 8px; padding: 8px 10px; font-size: 12px; line-height: 1.45;
    max-width: 260px; display: none; backdrop-filter: blur(2px); }
  #tip .sw { display:inline-block; width:11px; height:11px; border-radius:3px; vertical-align:-1px; margin-right:6px; border:1px solid #fff5; }
  #tip b { color: #fff; }
  footer { color: var(--dim); padding: 0 28px 30px; max-width: 980px; }
  code { background:#0006; padding:1px 5px; border-radius:4px; }
</style>
</head>
<body>
<header>
  <h1>What is what in the AI color cloud</h1>
  <div class="sub">Every dot is a color measured across crawled AI-built product sites, dropped onto its true position in
  OKLCH space (perceptually uniform). The background of each panel is the <b>actual sRGB color field</b> at that lightness —
  out-of-gamut zones fade to grey. The <b>bucket</b> a color falls into tells you what it would <i>do for your identity</i>:
  whether it's boilerplate, a clone of someone else's brand, a reflex everyone reaches for, or open ground.</div>
</header>

<div class="legend" id="legend"></div>

<div class="slices" id="slices"></div>

<div id="tip"></div>

<footer id="footer"></footer>

<script id="data" type="application/json">${JSON.stringify(data)}</script>
<script>
${CLIENT_JS}
</script>
</body>
</html>`;
}

// Client-side rendering script (color math duplicated here so the HTML is fully
// standalone — no module imports at runtime).
const CLIENT_JS = String.raw`
const DATA = JSON.parse(document.getElementById("data").textContent);

// ---- minimal OKLCH -> sRGB (mirrors color-space.mjs) ----
function oklchToOklab(L, C, H){ const r=H*Math.PI/180; return [L, C*Math.cos(r), C*Math.sin(r)]; }
function oklabToLinear(L,a,b){
  const l_=L+0.3963377774*a+0.2158037573*b, m_=L-0.1055613458*a-0.0638541728*b, s_=L-0.0894841775*a-1.2914855480*b;
  const l=l_*l_*l_,m=m_*m_*m_,s=s_*s_*s_;
  return [ 4.0767416621*l-3.3077115913*m+0.2309699292*s,
          -1.2684380046*l+2.6097574011*m-0.3413193965*s,
          -0.0041960863*l-0.7034186147*m+1.7076147010*s ];
}
function linToSrgbCh(c){ return c<=0.0031308 ? 12.92*c : 1.055*Math.pow(c,1/2.4)-0.055; }
function oklchToSrgb255(L,C,H){
  const [oL,oa,ob]=oklchToOklab(L,C,H);
  const lin=oklabToLinear(oL,oa,ob);
  const eps=1e-4;
  const inGamut = lin.every(()=>true) && lin.map(linToSrgbCh).every(c=>c>=-eps&&c<=1+eps);
  const s=lin.map(c=>Math.round(Math.max(0,Math.min(1,linToSrgbCh(c)))*255));
  return { rgb:s, inGamut };
}

// canvas geometry
const W=380, Hgt=300, PAD={l:34,r:8,t:8,b:22};
const PLOTW=W-PAD.l-PAD.r, PLOTH=Hgt-PAD.t-PAD.b;
const HUE_MAX=360, CHR_MAX=DATA.chromaMax;
const xOfHue = h => PAD.l + (h/HUE_MAX)*PLOTW;
const yOfChr = c => PAD.t + (1 - c/CHR_MAX)*PLOTH;
const hueOfX = x => ((x-PAD.l)/PLOTW)*HUE_MAX;
const chrOfY = y => (1 - (y-PAD.t)/PLOTH)*CHR_MAX;

const bucketColor = b => DATA.buckets[b].color;

// ---- legend ----
const order=["originator","framework-default","ubiquitous-reflex","safe"];
const legend=document.getElementById("legend");
for(const b of order){
  const m=DATA.buckets[b], n=DATA.counts[b];
  const el=document.createElement("div"); el.className="chip";
  el.innerHTML='<span class="dot" style="background:'+m.color+'"></span>'+
    '<div><div class="name">'+b+'</div>'+
    '<div class="verb" style="color:'+m.color+'">'+m.verb+'</div>'+
    '<div class="cap">'+m.caption+'</div>'+
    '<div class="n">'+n+' AI-crawl colors</div></div>';
  legend.appendChild(el);
}

// ---- density field (KDE) recomputed client-side for contours ----
// We need the corpus to recompute density at arbitrary points for the contour.
// Instead of shipping the full corpus, we ship the per-pixel density implicitly:
// the contour is drawn by sampling DATA points isn't enough, so we approximate
// the hot-zone outline using the crawl points' own density values via a coarse
// grid interpolation. Simpler + faithful: rebuild KDE from the crawl points
// themselves weighted by sites (the same signal), which traces where AI colors
// pile up. Threshold = p90 (shipped).
const BW=0.04, TWO_S2=2*BW*BW;
const kdePts = DATA.points.map(p=>({lab:oklchToOklab(p.L,p.C,p.H), w:Math.max(1,p.sites)}));
function kde(L,C,H){
  const [l,a,b]=oklchToOklab(L,C,H); let s=0;
  for(const p of kdePts){ const dl=l-p.lab[0],da=a-p.lab[1],db=b-p.lab[2];
    s+=p.w*Math.exp(-(dl*dl+da*da+db*db)/TWO_S2); }
  return s;
}

function buildSlice(L){
  const wrap=document.createElement("div"); wrap.className="slice";
  wrap.innerHTML='<h3>L = '+L.toFixed(2)+' <span>constant-lightness OKLCH slice — hue x chroma</span></h3>';
  const cvWrap=document.createElement("div"); cvWrap.className="cv";
  cvWrap.innerHTML='<div class="ylab">chroma 0 → '+CHR_MAX+'</div>';
  const cv=document.createElement("canvas"); cv.width=W; cv.height=Hgt;
  cvWrap.appendChild(cv); wrap.appendChild(cvWrap);
  const ax=document.createElement("div"); ax.className="axis";
  ax.innerHTML='<span>hue 0°</span><span>180°</span><span>360°</span>';
  wrap.appendChild(ax);
  const ctx=cv.getContext("2d");

  // 1) paint actual color field
  const img=ctx.createImageData(PLOTW, PLOTH);
  for(let py=0; py<PLOTH; py++){
    const C = (1 - py/PLOTH)*CHR_MAX;
    for(let px=0; px<PLOTW; px++){
      const Hh = (px/PLOTW)*HUE_MAX;
      const {rgb,inGamut}=oklchToSrgb255(L,C,Hh);
      const i=(py*PLOTW+px)*4;
      if(inGamut){ img.data[i]=rgb[0]; img.data[i+1]=rgb[1]; img.data[i+2]=rgb[2]; img.data[i+3]=255; }
      else { const g=42; img.data[i]=g; img.data[i+1]=g; img.data[i+2]=g+4; img.data[i+3]=255; }
    }
  }
  ctx.putImageData(img, PAD.l, PAD.t);

  // (the density contour + dots/diamonds/labels are drawn in overlay(), which
  // runs after every slice canvas exists.)
  return { wrap, cv, ctx, L, img };
}

const slicesEl=document.getElementById("slices");
const built=[];
for(const L of DATA.slices){ const s=buildSlice(L); slicesEl.appendChild(s.wrap); built.push(s); }

// redraw contour with a per-slice relative threshold (p90 of the slice grid),
// then overlay dots/diamonds/labels.
for(const s of built){ overlay(s); }

function quantile(arr,q){ const a=[...arr].sort((x,y)=>x-y); const i=Math.min(a.length-1,Math.floor(q*(a.length-1))); return a[i]; }

function overlay(s){
  const {ctx,L,cv}=s;
  // recompute grid + contour with per-slice p90 (relative hot zone in this slice)
  const GX=110, GY=84;
  const grid=[]; const flat=[];
  for(let gy=0; gy<=GY; gy++){ grid[gy]=[];
    for(let gx=0; gx<=GX; gx++){
      const Hh=(gx/GX)*HUE_MAX, C=(1-gy/GY)*CHR_MAX;
      const v=kde(L,C,Hh); grid[gy][gx]=v;
      if(C>0.04) flat.push(v);
    }
  }
  const thr=Math.max(quantile(flat,0.90), 1e-6);
  ctx.save();
  ctx.strokeStyle="rgba(255,255,255,0.9)"; ctx.lineWidth=1.3; ctx.lineJoin="round";
  ctx.shadowColor="rgba(0,0,0,0.55)"; ctx.shadowBlur=2;
  const cw=PLOTW/GX, ch=PLOTH/GY;
  const lerp=(p,q,va,vb)=>{ const t=(thr-va)/((vb-va)||1e-9); return [p[0]+(q[0]-p[0])*t, p[1]+(q[1]-p[1])*t]; };
  for(let gy=0; gy<GY; gy++){
    for(let gx=0; gx<GX; gx++){
      const tl=grid[gy][gx], tr=grid[gy][gx+1], br=grid[gy+1][gx+1], bl=grid[gy+1][gx];
      const x0=PAD.l+gx*cw, y0=PAD.t+gy*ch, x1=x0+cw, y1=y0+ch;
      const P={ tl:[x0,y0], tr:[x1,y0], br:[x1,y1], bl:[x0,y1] };
      const code=(tl>=thr?1:0)|(tr>=thr?2:0)|(br>=thr?4:0)|(bl>=thr?8:0);
      if(code===0||code===15) continue;
      // marching squares segment endpoints on the four edges
      const eTop=lerp(P.tl,P.tr,tl,tr), eRight=lerp(P.tr,P.br,tr,br),
            eBot=lerp(P.bl,P.br,bl,br), eLeft=lerp(P.tl,P.bl,tl,bl);
      const seg=(p,q)=>{ ctx.beginPath(); ctx.moveTo(p[0],p[1]); ctx.lineTo(q[0],q[1]); ctx.stroke(); };
      switch(code){
        case 1: case 14: seg(eLeft,eTop); break;
        case 2: case 13: seg(eTop,eRight); break;
        case 3: case 12: seg(eLeft,eRight); break;
        case 4: case 11: seg(eRight,eBot); break;
        case 6: case 9:  seg(eTop,eBot); break;
        case 7: case 8:  seg(eLeft,eBot); break;
        case 5: seg(eLeft,eTop); seg(eRight,eBot); break;
        case 10: seg(eTop,eRight); seg(eLeft,eBot); break;
      }
    }
  }
  ctx.restore();

  // which points belong to this slice (nearest lightness band)
  const bands=DATA.slices;
  const bandOf=(Lv)=>{ let bi=0,bd=1e9; for(let i=0;i<bands.length;i++){const dd=Math.abs(bands[i]-Lv); if(dd<bd){bd=dd;bi=i;}} return bands[bi]; };

  // originator diamonds (white-outlined) — those whose L is closest to this slice
  ctx.save();
  for(const o of DATA.originators){
    if(bandOf(o.L)!==L) continue;
    if(o.C>CHR_MAX) continue;
    const x=xOfHue(o.H), y=yOfChr(Math.min(o.C,CHR_MAX));
    drawDiamond(ctx,x,y,4.2,"rgba(255,255,255,0.0)","rgba(255,255,255,0.9)");
  }
  ctx.restore();

  // crawl dots colored by bucket, sized by log(sites)
  const pts=[];
  for(const p of DATA.points){
    if(bandOf(p.L)!==L) continue;
    const cc=Math.min(p.C,CHR_MAX);
    const x=xOfHue(p.H), y=yOfChr(cc);
    const r=2.2+Math.log10(Math.max(1,p.sites))*2.0;
    ctx.beginPath(); ctx.arc(x,y,r,0,7);
    ctx.fillStyle=bucketColor(p.bucket); ctx.globalAlpha=0.92; ctx.fill();
    ctx.globalAlpha=1; ctx.lineWidth=0.8; ctx.strokeStyle="rgba(0,0,0,0.45)"; ctx.stroke();
    pts.push({x,y,r,p});
  }
  s.hit=pts;

  // labels for top originator peaks whose swatch is in this slice
  ctx.save();
  ctx.font="700 11px ui-sans-serif, system-ui, sans-serif";
  ctx.textBaseline="middle";
  for(const pk of DATA.peaks){
    if(bandOf(pk.L)!==L) continue;
    const x=xOfHue(pk.H), y=yOfChr(Math.min(pk.C,CHR_MAX));
    drawDiamond(ctx,x,y,5.5,"rgba(255,255,255,0.0)","#fff");
    const tx=x+8, label=pk.name;
    const tw=ctx.measureText(label).width;
    ctx.fillStyle="rgba(0,0,0,0.62)";
    const lx = (tx+tw>W-4) ? x-8-tw-6 : tx-3;
    ctx.fillRect(lx, y-8, tw+6, 16);
    ctx.fillStyle="#fff"; ctx.fillText(label, lx+3, y);
  }
  ctx.restore();
}

function drawDiamond(ctx,x,y,r,fill,stroke){
  ctx.beginPath(); ctx.moveTo(x,y-r); ctx.lineTo(x+r,y); ctx.lineTo(x,y+r); ctx.lineTo(x-r,y); ctx.closePath();
  if(fill && fill!=="rgba(255,255,255,0.0)"){ ctx.fillStyle=fill; ctx.fill(); }
  ctx.lineWidth=1.4; ctx.strokeStyle=stroke; ctx.stroke();
}

// ---- hover tooltip ----
const tip=document.getElementById("tip");
for(const s of built){
  s.cv.addEventListener("mousemove",(ev)=>{
    const rect=s.cv.getBoundingClientRect();
    const mx=(ev.clientX-rect.left)*(s.cv.width/rect.width);
    const my=(ev.clientY-rect.top)*(s.cv.height/rect.height);
    let hit=null,hd=1e9;
    for(const h of (s.hit||[])){ const dx=h.x-mx,dy=h.y-my,d=dx*dx+dy*dy; if(d<hd && d<=(h.r+3)*(h.r+3)){hd=d;hit=h;} }
    if(!hit){ tip.style.display="none"; return; }
    const p=hit.p, m=DATA.buckets[p.bucket];
    tip.innerHTML='<div><span class="sw" style="background:'+p.hex+'"></span><b>'+p.hex+'</b></div>'+
      '<div><b style="color:'+m.color+'">'+p.bucket+'</b> — '+m.verb+'</div>'+
      (p.nearestBrand?('<div>nearest brand: <b>'+p.nearestBrand+'</b> (ΔEok '+p.nearestDelta.toFixed(3)+')</div>'):'')+
      '<div>density: '+p.density.toFixed(1)+(p.density>=DATA.p90?' ≥ p90':'')+'</div>'+
      '<div>sites: <b>'+p.sites+'</b></div>'+
      '<div>oklch: L'+p.L.toFixed(2)+' C'+p.C.toFixed(3)+' H'+p.H.toFixed(0)+'°</div>';
    tip.style.display="block";
    tip.style.left=Math.min(window.innerWidth-270, ev.clientX+14)+"px";
    tip.style.top=(ev.clientY+14)+"px";
  });
  s.cv.addEventListener("mouseleave",()=>{ tip.style.display="none"; });
}

// ---- footer ----
document.getElementById("footer").innerHTML=
  '<b>How buckets are assigned.</b> framework-default = the hex is a framework default swatch (Tailwind/Material/Bootstrap/...) '+
  'or hard-banned slop. originator = within ΔEok '+DATA.originatorDelta+' of a getdesign brand color (tagged with the nearest brand). '+
  'ubiquitous-reflex = density ≥ the relative p90 threshold of usable color space ('+DATA.p90.toFixed(2)+'), but not the above. '+
  'safe = none of these. Diamonds are getdesign originator brand colors; the white labels mark the originator peaks AI builds converge onto. '+
  'Dot size = log(site count). Hover any dot for details.';
`;

// ---------------------------------------------------------------------------
// Emit the standalone HTML (CLIENT_JS is now defined).
// ---------------------------------------------------------------------------
const html = renderHtml(DATA);
writeFileSync(OUT, html, "utf8");
console.log(`\nwrote ${OUT} (${(html.length / 1024).toFixed(0)} KB)`);
