// roles.mjs — ROLE-AWARE color density + the palette gate.
//
// The global density field (density.mjs) judges a color against EVERYTHING
// (frameworks + our builds + the whole crawl mixed together). But colors play
// ROLES, and overuse is role-relative: #ffffff is the single most overused
// GROUND on earth and a perfectly fine one; an indigo is only "slop" because it
// is an overused ACCENT. So here we judge a color against its OWN role corpus.
//
// Role corpora (built by build-color-roles.mjs):
//   data/observations.colors.{ground,ink,accent,border}.json  => [{hex, sites}]
//
// Because each role corpus is smaller (and has a different shape) than the global
// mix, we compute a per-role RELATIVE overuse threshold: the p90 of that role's
// own usable-space density. "Is #X an overused ACCENT" is then judged against the
// accent corpus and the accent threshold — not the global field.
//
// Pure given the on-disk corpora. Corpora are read once and cached; tests can
// inject a corpus via setRoleCorpus().

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { hexToOklab, hexToOklch } from "./color-space.mjs";
import { density, hardBanned, CONFIG } from "./density.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../../..");

export const ROLES = ["ground", "ink", "accent", "border"];

const ROLE_FILES = {
  ground: "data/observations.colors.ground.json",
  ink: "data/observations.colors.ink.json",
  accent: "data/observations.colors.accent.json",
  border: "data/observations.colors.border.json",
};

// ---------------------------------------------------------------------------
// Corpus loading (per role), with a small cache + a test injection hook.
// Each corpus entry is expanded into `sites` weighted points (site-frequency
// drives heat, the same way the global crawl corpus is built).
// ---------------------------------------------------------------------------
const _cache = new Map(); // role -> { points:[{hex,sites,lab}], threshold }

export function setRoleCorpus(role, records) {
  _cache.set(role, buildRoleModel(records));
}
export function resetRoleCorpora() { _cache.clear(); }

function readRoleRecords(role) {
  const f = ROLE_FILES[role];
  if (!f) throw new Error(`unknown role: ${role}`);
  try {
    return JSON.parse(readFileSync(resolve(ROOT, f), "utf8"));
  } catch {
    return []; // absent on a fresh checkout => empty role corpus
  }
}

// Density at `lab` against a role's OWN point cloud (site-weighted Gaussian KDE,
// same bandwidth/kernel as the global density()).
function roleDensityLab(points, lab, bandwidth = CONFIG.BANDWIDTH) {
  const twoSigma2 = 2 * bandwidth * bandwidth;
  let sum = 0;
  for (const p of points) {
    const d2 = (lab[0] - p.lab[0]) ** 2 + (lab[1] - p.lab[1]) ** 2 + (lab[2] - p.lab[2]) ** 2;
    sum += p.sites * Math.exp(-d2 / twoSigma2);
  }
  return sum;
}

// Compute the per-role RELATIVE overuse threshold: p90 of the role's own density
// sampled at its USABLE-SPACE colors (the corpus colors themselves, weighted by
// site-frequency). Neutrals are excluded from the threshold sample so the bar is
// set by the chromatic/identity competition, not by the white/black mountain.
function buildRoleModel(records) {
  const points = [];
  for (const r of records) {
    if (!r || typeof r.hex !== "string") continue;
    const sites = Number.isFinite(r.sites) ? r.sites : 1;
    points.push({ hex: r.hex.toLowerCase(), sites, lab: hexToOklab(r.hex) });
  }
  // sample density at each corpus color (self-density of the cloud)
  const samples = [];
  for (const p of points) {
    const C = hexToOklch(p.hex)[1];
    if (C < CONFIG.NEUTRAL_CHROMA) continue; // exclude neutrals from the bar
    samples.push(roleDensityLab(points, p.lab));
  }
  let threshold = Infinity;
  if (samples.length) {
    samples.sort((a, b) => a - b);
    const idx = Math.min(samples.length - 1, Math.floor(samples.length * 0.90));
    threshold = samples[idx];
  }
  return { points, threshold, nColors: points.length, nChromatic: samples.length };
}

function getModel(role) {
  if (!_cache.has(role)) _cache.set(role, buildRoleModel(readRoleRecords(role)));
  return _cache.get(role);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// Raw role records [{hex, sites}] (sorted by sites desc, as written to disk).
export function loadRoleCorpus(role) {
  return readRoleRecords(role);
}

// Density of `hex` against `role`'s own corpus.
export function densityRole(hex, role) {
  const m = getModel(role);
  return roleDensityLab(m.points, hexToOklab(hex));
}

// The relative (p90 usable-space) overuse threshold for a role.
export function roleThreshold(role) {
  return getModel(role).threshold;
}

// Verdict for `hex` in `role`: judged against the role's OWN corpus + threshold,
// plus the global hardBanned() (the stronger, named verdict).
// Returns { hex, role, oklch, verdict, density, threshold, ban, neutral }.
export function classifyRole(hex, role) {
  const m = getModel(role);
  const [L, C, H] = hexToOklch(hex);
  const ban = hardBanned(hex);
  const neutral = C < CONFIG.NEUTRAL_CHROMA;
  const d = roleDensityLab(m.points, hexToOklab(hex));
  let verdict;
  if (ban) verdict = "HARD-BANNED";
  else if (neutral) verdict = "NEUTRAL-ok";
  else if (d >= m.threshold) verdict = "OVERUSED";
  else verdict = "SAFE";
  return {
    hex: hex.toLowerCase(),
    role,
    oklch: { L, C, H },
    verdict,
    density: d,
    threshold: m.threshold,
    ban,
    neutral,
  };
}

// ---------------------------------------------------------------------------
// PALETTE GATE — judge the COMBINATION, not just individual colors.
// Matches an input { ground, ink, accent } against the empirical palette
// templates (observations.palettes.json) and reports its template share +
// a per-role verdict.
// ---------------------------------------------------------------------------
const HUE_BUCKETS = [
  ["red", 15, 45], ["orange", 45, 75], ["yellow", 75, 110],
  ["green", 110, 165], ["teal", 165, 200], ["cyan", 200, 230],
  ["blue", 230, 264], ["indigo", 264, 295], ["violet", 295, 330],
  ["magenta", 330, 360], ["pink", 0, 15],
];
function hueBucket(H) {
  for (const [name, lo, hi] of HUE_BUCKETS) if (H >= lo && H < hi) return name;
  return "pink";
}
function groundBand(L) { return L >= 0.85 ? "light" : L <= 0.30 ? "dark" : "mid"; }
function groundTint(C, H) {
  if (C < 0.02) return "neutral";
  if ((H >= 0 && H < 110) || H >= 330) return "warm";
  return "cool";
}
function accentChromaBand(C) { return C >= 0.15 ? "bold" : "muted"; }
function accentVsGround(aLch, gLch) {
  if (!aLch) return "none";
  const aC = aLch[1], aH = aLch[2];
  const gC = gLch ? gLch[1] : 0, gH = gLch ? gLch[2] : 0;
  if (gC < 0.02) return aC < 0.05 ? "mono" : "accent-on-neutral";
  let d = Math.abs(aH - gH); if (d > 180) d = 360 - d;
  if (d <= 20) return "analogous";
  if (d >= 150) return "complementary";
  if (d >= 90) return "clash";
  return "analogous";
}

let _palettes = null;
function loadPalettes() {
  if (_palettes) return _palettes;
  try {
    _palettes = JSON.parse(readFileSync(resolve(ROOT, "data/observations.palettes.json"), "utf8"));
  } catch {
    _palettes = { nSites: 0, templates: [] };
  }
  return _palettes;
}
export function setPalettes(p) { _palettes = p; }

// paletteGate({ ground, ink, accent }) =>
//   { vector, matchedTemplate, templateSharePct, freshness, perRole }
export function paletteGate({ ground, ink, accent }) {
  const gLch = ground ? hexToOklch(ground) : null;
  const aLch = accent ? hexToOklch(accent) : null;

  const vector = {
    groundLightBand: gLch ? groundBand(gLch[0]) : "unknown",
    groundTint: gLch ? groundTint(gLch[1], gLch[2]) : "unknown",
    accentHueBucket: aLch ? hueBucket(aLch[2]) : "none",
    accentChromaBand: aLch ? accentChromaBand(aLch[1]) : "none",
    accentVsGround: accentVsGround(aLch, gLch),
    // nHues can't be derived from a single accent; treat a present accent as mono.
    nHues: aLch ? "mono" : "none",
  };

  // Match on the IDENTITY-bearing dims (ignore nHues so a duo/multi site with the
  // same ground+accent character still matches its template family).
  const keyDims = (v) => [
    v.groundLightBand, v.groundTint, v.accentHueBucket,
    v.accentChromaBand, v.accentVsGround,
  ].join("|");
  const want = keyDims(vector);

  const palettes = loadPalettes();
  const nSites = palettes.nSites || 0;
  let matchedCount = 0;
  let matchedTemplate = null;
  for (const t of palettes.templates) {
    if (keyDims(t) === want) {
      matchedCount += t.count;
      if (!matchedTemplate) matchedTemplate = t.name; // representative name
    }
  }
  const templateSharePct = nSites ? +(100 * matchedCount / nSites).toFixed(1) : 0;
  // freshness: 1 = unseen combination; lower = the more crowded this template is.
  const freshness = +(1 - templateSharePct / 100).toFixed(3);

  return {
    vector,
    matchedTemplate,
    templateSharePct,
    freshness,
    perRole: {
      ground: ground ? classifyRole(ground, "ground") : null,
      ink: ink ? classifyRole(ink, "ink") : null,
      accent: accent ? classifyRole(accent, "accent") : null,
    },
  };
}
