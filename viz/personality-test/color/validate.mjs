#!/usr/bin/env node
// validate.mjs — advisory non-slop color VALIDATOR (detect + snap + suggest).
//
// This is NOT a palette generator. It does not pick your colors. It tells you
// which of the colors you already chose are AI-slop (hard-banned or empirically
// overused), and for the slop ones it SNAPS to the nearest non-slop color and
// offers up to 3 ranked suggestions. The AI keeps choosing its own colors.
//
// Usage:
//   node validate.mjs "#6366f1" "#1a120b" "#b85c2a"      # explicit colors
//   node validate.mjs path/to/page.html                  # extract its hexes
//   node validate.mjs --calibrate                        # calibration printout
//   node validate.mjs --bandwidth 0.05 "#6366f1"         # override a tunable
//
// Exit code: nonzero if any NON-NEUTRAL color is hard-banned or overused, so it
// can gate CI alongside slop-check.mjs.

import { readFileSync } from "node:fs";
import {
  CONFIG, classify, nearestSafe, nearDuplicates, density, setCorpus,
} from "./density.mjs";
import { loadCorpus } from "./corpus.mjs";
import {
  hexToOklch, oklchToOklab, oklabToSrgb, isInGamut, oklabToOklch,
} from "./color-space.mjs";

// ---- arg parsing (tunable overrides) ----
const argv = process.argv.slice(2);
const inputs = [];
let calibrate = false;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--calibrate") calibrate = true;
  else if (a === "--bandwidth") CONFIG.BANDWIDTH = parseFloat(argv[++i]);
  else if (a === "--threshold") CONFIG.OVERUSE_THRESHOLD = parseFloat(argv[++i]);
  else if (a === "--neutral-chroma") CONFIG.NEUTRAL_CHROMA = parseFloat(argv[++i]);
  else inputs.push(a);
}

function extractHexes(file) {
  const css = readFileSync(file, "utf8").toLowerCase();
  const raw = [...css.matchAll(/#[0-9a-f]{3}(?:[0-9a-f]{3})?\b/g)].map((m) => m[0]);
  const norm = raw.map((h) => (h.length === 4
    ? "#" + h.slice(1).split("").map((c) => c + c).join("") : h));
  return [...new Set(norm)];
}

function gatherColors(inputs) {
  // .html path -> its hexes; otherwise treat as literal hex args.
  if (inputs.length === 1 && /\.html?$/i.test(inputs[0])) {
    return { colors: extractHexes(inputs[0]), label: inputs[0] };
  }
  return { colors: inputs.map((h) => h.toLowerCase()), label: "(args)" };
}

// ===========================================================================
// CALIBRATION — the trust printout. Confirms the canonical Tailwind slop flags,
// reports the % of usable color space flagged (must NOT be a majority), and
// lists the hottest hue/lightness regions.
// ===========================================================================
function runCalibrate() {
  console.log("=== CALIBRATION ===");
  console.log(`bandwidth=${CONFIG.BANDWIDTH}  overuse_threshold=${CONFIG.OVERUSE_THRESHOLD}  neutral_chroma=${CONFIG.NEUTRAL_CHROMA}\n`);

  const corpus = loadCorpus();
  const nFramework = corpus.filter((c) => c.kind === "framework").length;
  const nOurbuild = corpus.filter((c) => c.kind === "ourbuild").length;
  const nCrawl = corpus.filter((c) => c.kind === "crawl").length;
  console.log(`corpus: ${corpus.length} points (${nFramework} framework, ${nOurbuild} ourbuild, ${nCrawl} crawl)\n`);

  // 1) canonical Tailwind slop must be FLAGGED (hard-banned and/or overused).
  //    These three sit BELOW the density threshold (the blue-purple band is
  //    under-populated in OUR builds), so they flag via the hard ban — the
  //    stronger verdict. Density is reported alongside for transparency.
  console.log("-- canonical Tailwind slop (expect flagged: HARD-BANNED / OVERUSED) --");
  for (const h of ["#6366f1", "#2563eb", "#22d3ee"]) {
    const c = classify(h);
    const flagged = c.verdict === "HARD-BANNED" || c.verdict === "OVERUSED";
    console.log(`  ${h}  ${c.verdict}  density=${c.density.toFixed(2)}  ${flagged ? "FLAGGED" : "NOT FLAGGED (!)"}${c.ban ? "  [" + c.ban + "]" : ""}`);
  }

  // 2) % of a uniform sample of USABLE colors flagged. Usable = chroma>0.04,
  //    L 0.2–0.9, in-gamut. Sweep a deterministic OKLCH grid.
  let usable = 0, flagged = 0;
  const Ls = []; for (let L = 0.2; L <= 0.9 + 1e-9; L += 0.05) Ls.push(L);
  const Cs = []; for (let C = 0.05; C <= 0.30 + 1e-9; C += 0.02) Cs.push(C);
  const Hs = []; for (let H = 0; H < 360; H += 5) Hs.push(H);
  // hottest-region accumulation: bucket by (hue 30°, L 0.1)
  const buckets = new Map();
  for (const L of Ls) for (const C of Cs) for (const H of Hs) {
    const lab = oklchToOklab([L, C, H]);
    if (!isInGamut(lab)) continue;
    usable++;
    const d = density(lab);
    const banned = !!classify(oklabToSrgb(lab).hex).ban;
    const isFlag = banned || d >= CONFIG.OVERUSE_THRESHOLD;
    if (isFlag) flagged++;
    const hb = Math.floor(H / 30) * 30;
    const lb = Math.round(L * 10) / 10;
    const key = `${hb}|${lb}`;
    const cur = buckets.get(key) || { sum: 0, n: 0, hb, lb };
    cur.sum += d; cur.n++; buckets.set(key, cur);
  }
  const pct = (100 * flagged / usable).toFixed(1);
  console.log(`\n-- usable-space flag rate --`);
  console.log(`  ${flagged}/${usable} usable colors flagged = ${pct}%  (sanity: should be well under 60%)`);

  // 3) hottest regions by mean density.
  const hot = [...buckets.values()]
    .map((b) => ({ ...b, mean: b.sum / b.n }))
    .sort((a, b) => b.mean - a.mean)
    .slice(0, 8);
  console.log(`\n-- 8 hottest hue/lightness regions (mean density) --`);
  for (const b of hot) {
    console.log(`  hue ${b.hb}-${b.hb + 30}°  L≈${b.lb.toFixed(1)}   mean density ${b.mean.toFixed(2)}`);
  }
  console.log("\n=== END CALIBRATION ===");
}

// ===========================================================================
// VALIDATION report
// ===========================================================================
function runValidate(colors, label) {
  console.log(`\nVALIDATE ${label}  (${colors.length} color${colors.length === 1 ? "" : "s"})`);
  console.log(`tunables: bandwidth=${CONFIG.BANDWIDTH} threshold=${CONFIG.OVERUSE_THRESHOLD} neutral_chroma=${CONFIG.NEUTRAL_CHROMA}\n`);

  let fail = false;
  for (const hex of colors) {
    let c;
    try { c = classify(hex); } catch (e) { console.log(`  ${hex}  (skip: ${e.message})`); continue; }
    const { L, C, H } = c.oklch;
    const oklchStr = `oklch(${L.toFixed(2)} ${C.toFixed(3)} ${H.toFixed(0)})`;

    let line = `  ${hex}  ${oklchStr}  -> `;
    if (c.verdict === "HARD-BANNED") { line += `HARD-BANNED: ${c.ban}`; fail = true; }
    else if (c.verdict === "OVERUSED") { line += `OVERUSED: density=${c.density.toFixed(2)}`; fail = true; }
    else if (c.verdict === "NEUTRAL-ok") line += `NEUTRAL-ok (chroma ${C.toFixed(3)} < ${CONFIG.NEUTRAL_CHROMA}, exempt)`;
    else line += `SAFE (density=${c.density.toFixed(2)})`;
    console.log(line);

    if (c.verdict === "HARD-BANNED" || c.verdict === "OVERUSED") {
      const sugg = nearestSafe(hex);
      if (sugg.length === 0) console.log(`      (no nearby safe color found within search radius — shift hue manually)`);
      for (const s of sugg) {
        console.log(`      snap -> ${s.hex}  oklch(${s.oklch.L.toFixed(2)} ${s.oklch.C.toFixed(3)} ${s.oklch.H.toFixed(0)})  density=${s.density.toFixed(2)}  [${s.reason}]`);
      }
    }
  }

  // intra-set near-duplicates
  const dupes = nearDuplicates(colors);
  if (dupes.length) {
    console.log(`\n  near-duplicate pairs (within ΔEok ${CONFIG.DUPLICATE_DELTA} — look accidental):`);
    for (const d of dupes) console.log(`    ${d.a} ~ ${d.b}  (ΔEok ${d.delta.toFixed(3)})`);
  }

  console.log(`\n${fail ? "FAIL" : "PASS"} — ${fail ? "slop colors present (see snaps above)" : "no hard-banned or overused chromatic colors"}`);
  return fail;
}

// ---- main ----
if (calibrate) {
  runCalibrate();
  process.exit(0);
} else if (inputs.length === 0) {
  console.log("usage: node validate.mjs \"#hex\" [...] | page.html | --calibrate");
  console.log("       flags: --bandwidth N --threshold N --neutral-chroma N");
  process.exit(2);
} else {
  const { colors, label } = gatherColors(inputs);
  if (colors.length === 0) { console.log("no colors found"); process.exit(2); }
  const fail = runValidate(colors, label);
  process.exit(fail ? 1 : 0);
}
