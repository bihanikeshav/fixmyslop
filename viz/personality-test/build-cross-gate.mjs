// build-cross-gate.mjs — find crawled sites that pass BOTH the font gate and the
// color gate (the rare non-slop sites), emit data/cross-gate-sites.json and a
// self-contained viewer cross-gate-sites.html.
//
// Run:  node viz/personality-test/build-cross-gate.mjs
//
// Reads data/feature-crawl-raw.ndjson (one JSON record per line). Dedupes by host
// (keeps the first ok:true record per host). For each site derives a dominant
// DISPLAY font (most common first-family among the largest text) and a dominant
// ACCENT color (most frequent chromatic color across text + background, area-
// weighted). Then applies the font gate (not in the slop set) and the color gate
// (accent SAFE per the density model + no hard-banned color used prominently).

import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { classify, hardBanned, densityHex } from "./color/density.mjs";
import { hexToOklch } from "./color/color-space.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, "..", "..");
const RAW = join(REPO, "data", "feature-crawl-raw.ndjson");
const OUT_JSON = join(REPO, "data", "cross-gate-sites.json");
const OUT_HTML = join(__dirname, "cross-gate-sites.html");

// IMPORTANT: the density corpus (color/corpus.mjs -> ourbuildCorpus) scans EVERY
// *.html in this directory and turns every hex literal it finds into a corpus
// point. Our own viewer lives here and embeds the accent swatches as hex, so a
// leftover cross-gate-sites.html from a previous run would pollute the corpus
// (raising the density of the very accents we're judging) and make the verdict
// non-deterministic. Delete any prior output BEFORE the corpus is first loaded
// (loadCorpus caches on first classify() call), so the corpus is stable and
// never includes our own file.
try { rmSync(OUT_HTML, { force: true }); } catch { /* ignore */ }
// Warm the corpus now, while no cross-gate-sites.html exists on disk, so the
// cached corpus snapshot used for every classify() below excludes our output.
densityHex("#808080");

// ---------------------------------------------------------------------------
// Slop font set (case-insensitive, matched on the stripped first family).
// ---------------------------------------------------------------------------
const SLOP_FONTS = new Set([
  "inter", "poppins", "space grotesk", "outfit", "dm sans", "geist",
  "manrope", "montserrat", "open sans", "roboto", "lato", "nunito",
  "work sans", "plus jakarta sans", "sora", "lexend", "raleway", "mulish",
  "figtree", "onest", "playfair display", "cormorant", "cormorant garamond",
  "fraunces", "instrument serif", "clash display", "bricolage grotesque",
  "hanken grotesk",
].map((s) => s.toLowerCase()));

// Generic / system fallbacks that don't count as a real custom display font.
const GENERIC_FONTS = new Set([
  "sans-serif", "serif", "system-ui", "-apple-system", "blinkmacsystemfont",
  "arial", "helvetica", "helvetica neue", "ui-sans-serif", "ui-serif",
  "ui-monospace", "monospace", "cursive", "fantasy", "segoe ui", "roboto",
  "apple color emoji", "segoe ui emoji", "noto color emoji", "math",
  "emoji", "ui-rounded", "tahoma", "verdana", "times new roman", "times",
  "georgia", "courier new", "courier", "sans", "inherit", "initial",
  // system symbol / emoji fonts that show up as a "first family" on icon glyphs
  "segoe ui symbol", "segoe ui emoji", "apple symbols", "zapf dingbats",
  "webdings", "wingdings", "symbol", "noto sans symbols", "noto emoji",
  "android emoji", "droid sans fallback", "sans-serif-thin",
  // generic role aliases that Next.js sometimes emits (no real face)
  "sans", "body", "heading", "bodyfont", "headingfont", "var",
].map((s) => s.toLowerCase()));

// Normalize a Next.js / framework font-loader masked name to its real family.
// e.g. "__Inter_f367f3" -> "Inter", "__GeistSans_245d8d" -> "Geist Sans",
//      "__Plus_Jakarta_Sans_b6296e" -> "Plus Jakarta Sans",
//      "__geistSans_1e4310" -> "geist Sans". Also handles a trailing
//      "_Fallback" variant. Returns the cleaned name (original case-ish).
function unmaskFontName(name) {
  let n = name;
  const wasMasked = /^__/.test(n);
  if (wasMasked) {
    n = n.replace(/^__/, "");
    // drop a trailing 6-8 hex hash segment (Next font-loader id)
    n = n.replace(/_[0-9a-f]{4,8}$/i, "");
    // drop an explicit Fallback suffix
    n = n.replace(/_?Fallback$/i, "");
    // underscores -> spaces (the loader uses _ where the family had spaces)
    n = n.replace(/_+/g, " ").trim();
    // split camelCase joins like "geistSans" -> "geist Sans" so the slop key
    // ("geist") still matches on the first token where appropriate.
    n = n.replace(/([a-z])([A-Z])/g, "$1 $2");
  }
  return n;
}

// Slop-set membership that also catches a masked name whose leading family
// token is a slop face (e.g. "Geist Sans" -> "geist"; "Nunito Sans" stays
// "nunito sans" which isn't slop, but "Geist"/"DM Sans"/etc. resolve).
function slopKeyFor(key) {
  if (SLOP_FONTS.has(key)) return key;
  // try progressively shorter leading-token prefixes against the slop set,
  // so "geist sans" -> "geist" (slop), "dm sans" stays "dm sans" (slop).
  const toks = key.split(" ");
  for (let n = toks.length; n >= 1; n--) {
    const cand = toks.slice(0, n).join(" ");
    if (SLOP_FONTS.has(cand)) return cand;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Color parsing: rgb()/rgba() -> #rrggbb (returns null for transparent).
// ---------------------------------------------------------------------------
function parseColorToHex(css) {
  if (!css || typeof css !== "string") return null;
  const s = css.trim().toLowerCase();
  if (s === "transparent" || s === "none") return null;
  if (s.startsWith("#")) {
    let h = s.slice(1);
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    if (/^[0-9a-f]{6}$/.test(h)) return "#" + h;
    if (/^[0-9a-f]{8}$/.test(h)) {
      const a = parseInt(h.slice(6, 8), 16);
      if (a === 0) return null;
      return "#" + h.slice(0, 6);
    }
    return null;
  }
  const m = s.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.%]+))?\s*\)/);
  if (!m) return null;
  let a = 1;
  if (m[4] != null) {
    a = m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
  }
  if (a <= 0.05) return null; // effectively transparent
  const to2 = (v) => Math.max(0, Math.min(255, Math.round(parseFloat(v))))
    .toString(16).padStart(2, "0");
  return "#" + to2(m[1]) + to2(m[2]) + to2(m[3]);
}

// First real family from a CSS font-family stack (quotes stripped, generics
// skipped). Returns { display: <original-case name>, key: <lowercased> } or null.
function firstRealFamily(fontFamily) {
  if (!fontFamily || typeof fontFamily !== "string") return null;
  const parts = fontFamily.split(",");
  for (const raw of parts) {
    let name = raw.trim().replace(/^["']|["']$/g, "").trim();
    if (!name) continue;
    name = unmaskFontName(name);
    // strip a trailing " var" variable-font suffix ("Inter var" -> "Inter")
    name = name.replace(/\s+var$/i, "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (GENERIC_FONTS.has(key)) continue;
    return { display: name, key };
  }
  return null;
}

// Is a color a chromatic identity color (not near-white/black/grey)?
function isChromatic(hex) {
  const [L, C] = hexToOklch(hex);
  if (L >= 0.95 || L <= 0.08) return false; // near-white / near-black
  return C > 0.05;
}

// ---------------------------------------------------------------------------
// Load + dedupe.
// ---------------------------------------------------------------------------
const lines = readFileSync(RAW, "utf8").split(/\r?\n/).filter((l) => l.trim());
const byHost = new Map();
let parseErrors = 0;
for (const line of lines) {
  let rec;
  try { rec = JSON.parse(line); } catch { parseErrors++; continue; }
  if (!rec || rec.ok !== true || !rec.host) continue;
  if (!byHost.has(rec.host)) byHost.set(rec.host, rec);
}
const sites = [...byHost.values()];
const N = sites.length;

// ---------------------------------------------------------------------------
// Per-site analysis.
// ---------------------------------------------------------------------------
function analyzeSite(rec) {
  const els = Array.isArray(rec.elements) ? rec.elements : [];
  if (!els.length) return null;

  // --- dominant display font: among the largest text. ---
  // "Largest text" = top quartile by fontSize (with a sensible floor), or, if
  // that's too thin, fall back to area*aboveFold weighting on all text.
  const sized = els.filter((e) => typeof e.fontSize === "number" && e.fontSize > 0);
  let displayPool = sized;
  if (sized.length >= 4) {
    const sizes = sized.map((e) => e.fontSize).sort((a, b) => a - b);
    const q3 = sizes[Math.floor(sizes.length * 0.75)];
    const top = sized.filter((e) => e.fontSize >= q3);
    if (top.length) displayPool = top;
  }

  // weight each family by area (so a big headline counts more than a tiny one),
  // with an above-fold bonus.
  const displayWeights = new Map(); // key -> { display, weight }
  for (const e of displayPool) {
    const fam = firstRealFamily(e.fontFamily);
    if (!fam) continue;
    const area = typeof e.area === "number" && e.area > 0 ? e.area : 1;
    const w = area * (e.aboveFold ? 1.5 : 1) * (e.fontSize || 1);
    const cur = displayWeights.get(fam.key) || { display: fam.display, weight: 0 };
    cur.weight += w;
    displayWeights.set(fam.key, cur);
  }

  // body font: most common real family across ALL text by area.
  const bodyWeights = new Map();
  for (const e of els) {
    const fam = firstRealFamily(e.fontFamily);
    if (!fam) continue;
    const area = typeof e.area === "number" && e.area > 0 ? e.area : 1;
    const cur = bodyWeights.get(fam.key) || { display: fam.display, weight: 0 };
    cur.weight += area;
    bodyWeights.set(fam.key, cur);
  }

  const pickTop = (map) => {
    let best = null;
    for (const [key, v] of map) {
      if (!best || v.weight > best.weight) best = { key, display: v.display, weight: v.weight };
    }
    return best;
  };

  const displayTop = pickTop(displayWeights);
  const bodyTop = pickTop(bodyWeights);

  // --- dominant accent color: most frequent chromatic color, area-weighted. ---
  // Pull from element `color` and non-transparent `backgroundColor`.
  const colorWeights = new Map(); // hex -> weight
  const bumpColor = (hex, w) => {
    if (!hex) return;
    if (!isChromatic(hex)) return;
    colorWeights.set(hex, (colorWeights.get(hex) || 0) + w);
  };
  // also track ALL prominent (chromatic) colors to test the "no hard-banned
  // color used prominently" rule.
  const allChromaWeights = new Map();
  let totalChromaWeight = 0;
  for (const e of els) {
    const area = typeof e.area === "number" && e.area > 0 ? e.area : 1;
    const fg = parseColorToHex(e.color);
    const bg = parseColorToHex(e.backgroundColor);
    // text color: weight by area (its visible footprint as text).
    if (fg && isChromatic(fg)) {
      bumpColor(fg, area);
      allChromaWeights.set(fg, (allChromaWeights.get(fg) || 0) + area);
      totalChromaWeight += area;
    }
    // background fill: weight by area too (a colored panel is an identity choice).
    if (bg && isChromatic(bg)) {
      bumpColor(bg, area);
      allChromaWeights.set(bg, (allChromaWeights.get(bg) || 0) + area);
      totalChromaWeight += area;
    }
  }

  let accentTop = null;
  for (const [hex, w] of colorWeights) {
    if (!accentTop || w > accentTop.weight) accentTop = { hex, weight: w };
  }

  // prominent hard-banned color: any chromatic color that is hard-banned AND
  // carries a meaningful share of the chromatic weight.
  let bannedProminent = null;
  if (totalChromaWeight > 0) {
    for (const [hex, w] of allChromaWeights) {
      const ban = hardBanned(hex);
      if (ban && w / totalChromaWeight >= 0.10) {
        if (!bannedProminent || w > bannedProminent.weight) {
          bannedProminent = { hex, weight: w, ban, share: w / totalChromaWeight };
        }
      }
    }
  }

  return { rec, displayTop, bodyTop, accentTop, bannedProminent };
}

// ---------------------------------------------------------------------------
// Gates.
// ---------------------------------------------------------------------------
function fontClean(a) {
  if (!a.displayTop) return false;       // only generic fallbacks => fail
  return slopKeyFor(a.displayTop.key) === null;
}

function colorClean(a) {
  if (!a.accentTop) return false;        // no chromatic identity color => fail
  if (a.bannedProminent) return false;   // a hard-banned color used prominently
  if (hardBanned(a.accentTop.hex)) return false;
  return classify(a.accentTop.hex).verdict === "SAFE";
}

// ---------------------------------------------------------------------------
// Run.
// ---------------------------------------------------------------------------
let fontOnly = 0, colorOnly = 0, both = 0, analyzed = 0;
const crossRows = [];

const DEBUG_HOSTS = (process.env.DEBUG_HOSTS || "").split(",").map((s) => s.trim()).filter(Boolean);
for (const rec of sites) {
  const a = analyzeSite(rec);
  if (!a) continue;
  analyzed++;
  if (DEBUG_HOSTS.includes(rec.host)) {
    console.error(`DEBUG ${rec.host}: displayFont=${a.displayTop?.display} (key=${a.displayTop?.key}) fontClean=${fontClean(a)}`);
    console.error(`  accent=${a.accentTop?.hex} verdict=${a.accentTop ? classify(a.accentTop.hex).verdict : "-"} banned=${a.accentTop ? hardBanned(a.accentTop.hex) : "-"} bannedProminent=${a.bannedProminent ? a.bannedProminent.hex + " " + a.bannedProminent.ban + " share=" + a.bannedProminent.share.toFixed(2) : "none"} colorClean=${colorClean(a)}`);
  }
  const f = fontClean(a);
  const c = colorClean(a);
  if (f) fontOnly++;
  if (c) colorOnly++;
  if (f && c) {
    both++;
    const cls = classify(a.accentTop.hex);
    crossRows.push({
      host: a.rec.host,
      url: a.rec.url,
      displayFont: a.displayTop.display,
      bodyFont: a.bodyTop ? a.bodyTop.display : null,
      accent: a.accentTop.hex,
      accentVerdict: cls.verdict,
      // extra fields used for ranking + the "why" note (kept in JSON too).
      accentDensity: +cls.density.toFixed(1),
      accentChroma: +hexToOklch(a.accentTop.hex)[1].toFixed(3),
    });
  }
}

// ---------------------------------------------------------------------------
// Rank: most distinctive first. An indie/unknown display font + a safe,
// saturated accent is the most distinctive. Score = chroma (saturation, capped)
// + "headroom" below the overuse threshold (lower density = further from the
// crowd) + a small bonus for a non-mainstream display font name.
// ---------------------------------------------------------------------------
const MAINSTREAM_HINT = new Set([
  // common non-slop-listed but still very widespread families; demote slightly.
  "georgia", "garamond", "futura", "helvetica neue", "avenir", "gotham",
  "proxima nova", "circular", "graphik", "source sans pro", "source serif pro",
  "ibm plex sans", "ibm plex serif", "ibm plex mono", "pt sans", "pt serif",
  "merriweather", "libre franklin", "libre baskerville", "noto sans",
  "noto serif", "rubik", "barlow", "karla", "archivo", "questrial",
]);
function distinctScore(r) {
  const chroma = Math.min(r.accentChroma, 0.30); // saturation, capped
  const headroom = Math.max(0, 18 - r.accentDensity) / 18; // 0..1, further = better
  const indieBonus = MAINSTREAM_HINT.has(r.displayFont.toLowerCase()) ? 0 : 0.15;
  return chroma * 2 + headroom * 0.8 + indieBonus;
}
crossRows.sort((x, y) => distinctScore(y) - distinctScore(x));

// Build a "why it passed" note per row.
function whyNote(r) {
  const fontBit = `display font "${r.displayFont}" is not a slop face`;
  const colorBit = `accent ${r.accent} is SAFE (chroma ${r.accentChroma}, density ${r.accentDensity} < 18)`;
  return `${fontBit}; ${colorBit}`;
}

const jsonRows = crossRows.map((r) => ({
  host: r.host,
  url: r.url,
  displayFont: r.displayFont,
  bodyFont: r.bodyFont,
  accent: r.accent,
  accentVerdict: r.accentVerdict,
  accentDensity: r.accentDensity,
  accentChroma: r.accentChroma,
  why: whyNote(r),
}));

writeFileSync(OUT_JSON, JSON.stringify(jsonRows, null, 2) + "\n", "utf8");

// ---------------------------------------------------------------------------
// Self-contained HTML viewer (data inlined).
// ---------------------------------------------------------------------------
const summary = { N, analyzed, fontOnly, colorOnly, both, parseErrors };
const html = renderHtml(summary, jsonRows);
writeFileSync(OUT_HTML, html, "utf8");

console.log("cross-gate build complete");
console.log(`  unique ok sites (N):   ${N}`);
console.log(`  analyzed (had text):   ${analyzed}`);
console.log(`  FONT-clean only:       ${fontOnly}`);
console.log(`  COLOR-clean only:      ${colorOnly}`);
console.log(`  BOTH (cross-gate):     ${both}`);
console.log(`  -> ${OUT_JSON}`);
console.log(`  -> ${OUT_HTML}`);
console.log("");
console.log("Top cross-gate sites (host · displayFont · accent):");
for (const r of jsonRows.slice(0, 20)) {
  console.log(`  ${r.host}  ·  ${r.displayFont}  ·  ${r.accent}`);
}

// ---------------------------------------------------------------------------
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function renderHtml(sum, rows) {
  const DATA = JSON.stringify(rows);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cross-gate sites — pass BOTH font + color gates</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 0 0 4rem;
    font: 15px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    color: #1a1a1a; background: #faf8f5;
  }
  header {
    padding: 2rem 1.5rem 1.25rem; border-bottom: 1px solid #e5ded3;
    background: #fff;
  }
  h1 { margin: 0 0 .35rem; font-size: 1.5rem; letter-spacing: -.01em; }
  .sub { color: #6b6258; margin: 0 0 1rem; max-width: 60ch; }
  .stats { display: flex; flex-wrap: wrap; gap: .6rem; }
  .stat {
    background: #f4efe7; border: 1px solid #e5ded3; border-radius: 10px;
    padding: .5rem .8rem; min-width: 110px;
  }
  .stat .n { font-size: 1.35rem; font-weight: 700; line-height: 1; }
  .stat .l { font-size: .72rem; text-transform: uppercase; letter-spacing: .04em; color: #8a8175; margin-top: .25rem; }
  .stat.both .n { color: #0a7d3c; }
  main { padding: 1.5rem; }
  .controls { display:flex; gap:.6rem; align-items:center; margin-bottom:1rem; flex-wrap:wrap; }
  .controls input {
    flex: 1 1 220px; padding: .55rem .7rem; border:1px solid #d8cfc2; border-radius:8px;
    font: inherit; background:#fff;
  }
  .grid {
    display: grid; gap: .9rem;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  }
  .card {
    background: #fff; border: 1px solid #e5ded3; border-radius: 12px;
    padding: 1rem 1.1rem; display: flex; flex-direction: column; gap: .6rem;
    box-shadow: 0 1px 2px rgba(40,30,20,.04);
  }
  .card .top { display:flex; align-items:flex-start; gap:.7rem; }
  .swatch {
    width: 44px; height: 44px; border-radius: 9px; flex: 0 0 auto;
    border: 1px solid rgba(0,0,0,.12); box-shadow: inset 0 0 0 1px rgba(255,255,255,.3);
  }
  .card .host { font-weight: 700; word-break: break-all; }
  .card a { color: #1558c0; text-decoration: none; }
  .card a:hover { text-decoration: underline; }
  .meta { display:flex; flex-wrap:wrap; gap:.4rem .9rem; font-size:.85rem; color:#4a443c; }
  .meta b { color:#1a1a1a; font-weight:600; }
  .fontname { font-weight: 600; }
  .accenthex { font-family: ui-monospace, monospace; font-size:.82rem; }
  .why {
    font-size: .8rem; color:#6b6258; background:#f7f3ec; border-radius:8px;
    padding:.45rem .6rem; border:1px solid #ece4d8;
  }
  .rank { font-size:.72rem; color:#a59b8c; }
  footer { padding: 0 1.5rem; color:#9b9183; font-size:.8rem; }
  .empty { color:#8a8175; padding:2rem; text-align:center; }
</style>
</head>
<body>
<header>
  <h1>Cross-gate sites — the rare non-slop crawls</h1>
  <p class="sub">Crawled sites whose dominant <b>display font</b> is not a slop face
  <i>and</i> whose dominant <b>accent color</b> is SAFE (not hard-banned, not in an
  over-used density zone). Sorted most-distinctive first. Open one and judge for
  yourself whether it actually looks different.</p>
  <div class="stats">
    <div class="stat"><div class="n">${sum.N}</div><div class="l">unique sites</div></div>
    <div class="stat"><div class="n">${sum.fontOnly}</div><div class="l">font-clean</div></div>
    <div class="stat"><div class="n">${sum.colorOnly}</div><div class="l">color-clean</div></div>
    <div class="stat both"><div class="n">${sum.both}</div><div class="l">pass BOTH</div></div>
  </div>
</header>
<main>
  <div class="controls">
    <input id="q" type="search" placeholder="filter by host or font…" autocomplete="off">
    <span id="count" class="rank"></span>
  </div>
  <div id="grid" class="grid"></div>
  <div id="empty" class="empty" hidden>No matches.</div>
</main>
<footer>Generated by build-cross-gate.mjs · ${sum.both} of ${sum.N} unique ok sites pass both gates.</footer>
<script>
const ROWS = ${DATA};
const grid = document.getElementById('grid');
const q = document.getElementById('q');
const countEl = document.getElementById('count');
const emptyEl = document.getElementById('empty');
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function card(r, i){
  return '<div class="card">'
    + '<div class="top">'
      + '<div class="swatch" style="background:'+esc(r.accent)+'" title="'+esc(r.accent)+'"></div>'
      + '<div style="flex:1;min-width:0">'
        + '<div class="host"><a href="'+esc(r.url)+'" target="_blank" rel="noopener">'+esc(r.host)+'</a></div>'
        + '<div class="rank">#'+(i+1)+' most distinctive</div>'
      + '</div>'
    + '</div>'
    + '<div class="meta">'
      + '<span>display: <b class="fontname">'+esc(r.displayFont)+'</b></span>'
      + (r.bodyFont && r.bodyFont.toLowerCase()!==r.displayFont.toLowerCase() ? '<span>body: <b>'+esc(r.bodyFont)+'</b></span>' : '')
      + '<span>accent: <b class="accenthex">'+esc(r.accent)+'</b></span>'
    + '</div>'
    + '<div class="why">'+esc(r.why)+'</div>'
  + '</div>';
}
function render(){
  const term = q.value.trim().toLowerCase();
  const list = term
    ? ROWS.filter(r => (r.host+' '+r.displayFont+' '+(r.bodyFont||'')).toLowerCase().includes(term))
    : ROWS;
  grid.innerHTML = list.map((r,i)=>card(r,i)).join('');
  countEl.textContent = list.length + (term ? ' / '+ROWS.length : '') + ' sites';
  emptyEl.hidden = list.length>0;
}
q.addEventListener('input', render);
render();
</script>
</body>
</html>
`;
}
