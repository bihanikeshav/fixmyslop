// build-color-roles.mjs — ROLE-AWARE color model from the feature crawl.
//
// Parallel to how fonts are role-aware (hero/body/mono), colors play ROLES:
//   GROUND  — the dominant page background(s) (area-weighted).
//   INK     — the dominant text color(s) (area-weighted).
//   ACCENT  — the dominant CHROMATIC color (chroma > 0.05) across text+bg:
//             the brand/identity color.
//   BORDER  — the dominant border color (optional).
//
// Reads data/feature-crawl-raw.ndjson (one JSON record per line), dedupes by
// host (first ok:true record per host => ~1268 sites). For each site it extracts
// per-role colors (area-weighted, near-duplicate-deduped within a site), then
// tallies SITE FREQUENCY per role => the role corpora.
//
// It also builds PALETTE TEMPLATES: a coarse vector per site describing the
// COMBINATION of roles ({ ground band/tint, accent hue/chroma, accent-vs-ground
// relationship, nHues }). The combination is the real identity — light-ground +
// indigo-accent is the slop, not "indigo" alone.
//
// Outputs:
//   data/observations.colors.ground.json   [{hex, sites}]
//   data/observations.colors.ink.json      [{hex, sites}]
//   data/observations.colors.accent.json   [{hex, sites}]
//   data/observations.colors.border.json   [{hex, sites}]
//   data/observations.palettes.json        { nSites, templates:[...], ... }
//
// Run:  node viz/personality-test/color/build-color-roles.mjs

import { createReadStream } from "node:fs";
import { writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { hexToOklch, hexToOklab, deltaEok } from "./color-space.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../../.."); // repo root
const RAW = resolve(ROOT, "data/feature-crawl-raw.ndjson");

// ---------------------------------------------------------------------------
// Color parsing: rgb()/rgba()/hex -> #rrggbb (returns null for transparent).
// (Same logic as build-cross-gate.mjs.)
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
  if (m[4] != null) a = m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
  if (a <= 0.05) return null; // effectively transparent
  const to2 = (v) => Math.max(0, Math.min(255, Math.round(parseFloat(v))))
    .toString(16).padStart(2, "0");
  return "#" + to2(m[1]) + to2(m[2]) + to2(m[3]);
}

const CHROMA_ACCENT = 0.05; // chroma threshold for "chromatic identity color"
const DEDUPE_DELTA = 0.04;  // intra-site near-duplicate merge (~1 JND)

// Is a color a chromatic identity color (not near-white/black/grey)?
function isChromatic(hex) {
  const [L, C] = hexToOklch(hex);
  if (L >= 0.95 || L <= 0.08) return false; // near-white / near-black
  return C > CHROMA_ACCENT;
}

// Merge an area-weight map of hexes into deduped buckets: near-identical colors
// (ΔEok < DEDUPE_DELTA) collapse onto the heaviest representative. Returns a
// sorted [{hex, weight}] descending by weight.
function dedupeByDelta(weightMap) {
  const entries = [...weightMap.entries()]
    .map(([hex, weight]) => ({ hex, weight, lab: hexToOklab(hex) }))
    .sort((a, b) => b.weight - a.weight);
  const buckets = [];
  for (const e of entries) {
    const hit = buckets.find((b) => deltaEok(b.lab, e.lab) < DEDUPE_DELTA);
    if (hit) hit.weight += e.weight; // collapse onto heavier representative
    else buckets.push({ hex: e.hex, weight: e.weight, lab: e.lab });
  }
  buckets.sort((a, b) => b.weight - a.weight);
  return buckets.map(({ hex, weight }) => ({ hex, weight }));
}

// ---------------------------------------------------------------------------
// Per-site role extraction.
// Returns { ground:[hex], ink:[hex], accent:[hex], border:[hex] } (top picks)
// plus the full ranked role lists for the palette vector.
// ---------------------------------------------------------------------------
function analyzeSite(rec) {
  const els = Array.isArray(rec.elements) ? rec.elements : [];
  if (!els.length) return null;

  const groundW = new Map();  // backgroundColor area-weight
  const inkW = new Map();     // text color area-weight
  const borderW = new Map();  // borderColor area-weight
  const chromaW = new Map();  // any chromatic color (color+bg) area-weight

  for (const e of els) {
    const area = (typeof e.area === "number" && e.area > 0 ? e.area : 1)
      * (e.aboveFold ? 1.5 : 1); // small above-fold bonus

    const fg = parseColorToHex(e.color);
    const bg = parseColorToHex(e.backgroundColor);
    const bd = parseColorToHex(e.borderColor);

    if (fg) {
      inkW.set(fg, (inkW.get(fg) || 0) + area);
      if (isChromatic(fg)) chromaW.set(fg, (chromaW.get(fg) || 0) + area);
    }
    if (bg) {
      groundW.set(bg, (groundW.get(bg) || 0) + area);
      if (isChromatic(bg)) chromaW.set(bg, (chromaW.get(bg) || 0) + area);
    }
    if (bd) borderW.set(bd, (borderW.get(bd) || 0) + area);
  }

  const ground = dedupeByDelta(groundW);
  const ink = dedupeByDelta(inkW);
  const accent = dedupeByDelta(chromaW);
  const border = dedupeByDelta(borderW);

  return { ground, ink, accent, border };
}

// ---------------------------------------------------------------------------
// Palette vector (the COMBINATION) for a site.
// ---------------------------------------------------------------------------
const HUE_BUCKETS = [
  // name,    [loHue, hiHue)  (OKLCH hue degrees)
  ["red", 15, 45],
  ["orange", 45, 75],
  ["yellow", 75, 110],
  ["green", 110, 165],
  ["teal", 165, 200],
  ["cyan", 200, 230],
  ["blue", 230, 264],
  ["indigo", 264, 295],
  ["violet", 295, 330],
  ["magenta", 330, 360],
  ["pink", 0, 15],
];
function hueBucket(H) {
  for (const [name, lo, hi] of HUE_BUCKETS) {
    if (lo <= hi) { if (H >= lo && H < hi) return name; }
  }
  return "pink"; // 330..360 handled above; fallback
}

function groundBand(L) {
  if (L >= 0.85) return "light";
  if (L <= 0.30) return "dark";
  return "mid";
}
function groundTint(C, H) {
  if (C < 0.02) return "neutral";
  // warm hues ~ red/orange/yellow (0-110, 330-360); cool ~ blue/teal/green band.
  if ((H >= 0 && H < 110) || H >= 330) return "warm";
  return "cool";
}
function accentChromaBand(C) {
  return C >= 0.15 ? "bold" : "muted";
}
// Relationship of accent hue to ground hue (only meaningful if ground chromatic;
// for a neutral ground we report relative to a notional neutral => "mono" if the
// accent is also neutralish, else just the accent stands alone => "accent-only").
function accentVsGround(accentLch, groundLch) {
  if (!accentLch) return "none";
  const aC = accentLch[1], aH = accentLch[2];
  const gC = groundLch ? groundLch[1] : 0;
  const gH = groundLch ? groundLch[2] : 0;
  if (gC < 0.02) {
    // neutral ground: classify the accent purely by whether it's a real hue.
    return aC < 0.05 ? "mono" : "accent-on-neutral";
  }
  let d = Math.abs(aH - gH);
  if (d > 180) d = 360 - d;
  if (d <= 20) return "analogous";
  if (d >= 150) return "complementary";
  if (d >= 90) return "clash";
  return "analogous";
}

function paletteVector(roles) {
  const groundHex = roles.ground[0]?.hex || null;
  const inkHex = roles.ink[0]?.hex || null;
  const accentHex = roles.accent[0]?.hex || null;

  const gLch = groundHex ? hexToOklch(groundHex) : null;
  const aLch = accentHex ? hexToOklch(accentHex) : null;

  // count distinct accent hues among the top chromatic colors of this site
  const distinctHues = new Set();
  for (const a of roles.accent.slice(0, 4)) {
    const [, C, H] = hexToOklch(a.hex);
    if (C > CHROMA_ACCENT) distinctHues.add(hueBucket(H));
  }
  let nHues = "mono";
  if (distinctHues.size === 2) nHues = "duo";
  else if (distinctHues.size >= 3) nHues = "multi";
  if (distinctHues.size === 0) nHues = "none";

  return {
    groundLightBand: gLch ? groundBand(gLch[0]) : "unknown",
    groundTint: gLch ? groundTint(gLch[1], gLch[2]) : "unknown",
    accentHueBucket: aLch ? hueBucket(aLch[2]) : "none",
    accentChromaBand: aLch ? accentChromaBand(aLch[1]) : "none",
    accentVsGround: accentVsGround(aLch, gLch),
    nHues,
    _groundHex: groundHex,
    _accentHex: accentHex,
  };
}

// ---------------------------------------------------------------------------
// Stream the crawl.
// ---------------------------------------------------------------------------
async function main() {
  const byHost = new Map();
  let parseErrors = 0;

  await new Promise((res, rej) => {
    const rl = createInterface({ input: createReadStream(RAW), crlfDelay: Infinity });
    rl.on("line", (line) => {
      if (!line.trim()) return;
      let rec;
      try { rec = JSON.parse(line); } catch { parseErrors++; return; }
      if (!rec || rec.ok !== true || !rec.host) return;
      if (!byHost.has(rec.host)) byHost.set(rec.host, rec);
    });
    rl.on("close", res);
    rl.on("error", rej);
  });

  const sites = [...byHost.values()];
  const N = sites.length;

  // role corpora: hex -> #sites
  const groundSites = new Map();
  const inkSites = new Map();
  const accentSites = new Map();
  const borderSites = new Map();

  // palette template tally: vectorKey -> { count, rep:{ground,accent} }
  const templates = new Map();
  // marginal tallies for the viz histograms
  const accentHueHist = new Map();

  let analyzed = 0;

  const bump = (map, hex) => map.set(hex, (map.get(hex) || 0) + 1);

  // How many top picks per role count toward "this site uses color X in role R".
  // Ground/ink: top 2 (a page often has a light + a dark section). Accent: top 2
  // (primary + secondary brand). Border: top 1.
  const TOPN = { ground: 2, ink: 2, accent: 2, border: 1 };

  for (const rec of sites) {
    const roles = analyzeSite(rec);
    if (!roles) continue;
    analyzed++;

    const uniq = (arr, n) => {
      const seen = new Set();
      const out = [];
      for (const r of arr) {
        if (seen.has(r.hex)) continue;
        seen.add(r.hex);
        out.push(r.hex);
        if (out.length >= n) break;
      }
      return out;
    };

    for (const hex of uniq(roles.ground, TOPN.ground)) bump(groundSites, hex);
    for (const hex of uniq(roles.ink, TOPN.ink)) bump(inkSites, hex);
    for (const hex of uniq(roles.accent, TOPN.accent)) bump(accentSites, hex);
    for (const hex of uniq(roles.border, TOPN.border)) bump(borderSites, hex);

    // accent-hue histogram (top accent only)
    if (roles.accent[0]) {
      const [, , H] = hexToOklch(roles.accent[0].hex);
      const b = hueBucket(H);
      accentHueHist.set(b, (accentHueHist.get(b) || 0) + 1);
    }

    // palette template
    const v = paletteVector(roles);
    const key = [
      v.groundLightBand, v.groundTint, v.accentHueBucket,
      v.accentChromaBand, v.accentVsGround, v.nHues,
    ].join("|");
    if (!templates.has(key)) {
      templates.set(key, {
        key,
        vector: {
          groundLightBand: v.groundLightBand, groundTint: v.groundTint,
          accentHueBucket: v.accentHueBucket, accentChromaBand: v.accentChromaBand,
          accentVsGround: v.accentVsGround, nHues: v.nHues,
        },
        count: 0,
        rep: { ground: v._groundHex, accent: v._accentHex },
      });
    }
    templates.get(key).count++;
  }

  // ---- write role corpora (site-frequency, descending) ----
  const toCorpus = (map) =>
    [...map.entries()]
      .map(([hex, sites]) => ({ hex, sites }))
      .sort((a, b) => b.sites - a.sites);

  const ground = toCorpus(groundSites);
  const ink = toCorpus(inkSites);
  const accent = toCorpus(accentSites);
  const border = toCorpus(borderSites);

  writeFileSync(resolve(ROOT, "data/observations.colors.ground.json"), JSON.stringify(ground, null, 2));
  writeFileSync(resolve(ROOT, "data/observations.colors.ink.json"), JSON.stringify(ink, null, 2));
  writeFileSync(resolve(ROOT, "data/observations.colors.accent.json"), JSON.stringify(accent, null, 2));
  writeFileSync(resolve(ROOT, "data/observations.colors.border.json"), JSON.stringify(border, null, 2));

  // ---- palette templates (descending share) ----
  const tmplArr = [...templates.values()].sort((a, b) => b.count - a.count);
  const nameTemplate = (v) => {
    const tint = v.groundTint === "neutral" ? "" : v.groundTint + " ";
    const ground = `${tint}${v.groundLightBand}-ground`;
    const acc = v.accentHueBucket === "none"
      ? "no-accent"
      : `${v.accentChromaBand} ${v.accentHueBucket}`;
    return `${ground} + ${acc} (${v.nHues})`;
  };
  const palettes = {
    nSites: analyzed,
    builtFrom: "data/feature-crawl-raw.ndjson",
    accentHueHist: [...accentHueHist.entries()]
      .map(([bucket, sites]) => ({ bucket, sites }))
      .sort((a, b) => b.sites - a.sites),
    templates: tmplArr.map((t) => ({
      name: nameTemplate(t.vector),
      ...t.vector,
      count: t.count,
      sharePct: +(100 * t.count / analyzed).toFixed(1),
      rep: t.rep,
    })),
  };
  writeFileSync(resolve(ROOT, "data/observations.palettes.json"), JSON.stringify(palettes, null, 2));

  // ---- report ----
  console.log(`sites (unique ok hosts): ${N}, analyzed: ${analyzed}, parseErrors: ${parseErrors}`);
  console.log(`role corpus sizes: ground=${ground.length} ink=${ink.length} accent=${accent.length} border=${border.length}`);
  console.log(`\nTOP GROUND:`); ground.slice(0, 8).forEach((c) => console.log(`  ${c.hex}  ${c.sites} sites`));
  console.log(`\nTOP INK:`); ink.slice(0, 8).forEach((c) => console.log(`  ${c.hex}  ${c.sites} sites`));
  console.log(`\nTOP ACCENT:`); accent.slice(0, 12).forEach((c) => console.log(`  ${c.hex}  ${c.sites} sites`));
  console.log(`\nACCENT HUE HISTOGRAM:`); palettes.accentHueHist.forEach((h) => console.log(`  ${h.bucket.padEnd(8)} ${h.sites}`));
  console.log(`\nTOP PALETTE TEMPLATES:`);
  palettes.templates.slice(0, 12).forEach((t) =>
    console.log(`  ${t.sharePct.toString().padStart(4)}%  ${t.name}  [ground ${t.rep.ground} / accent ${t.rep.accent}]`));
}

main();
