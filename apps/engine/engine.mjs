// engine.mjs — the ai-slop-font query engine, PURE and portable (browser + Worker).
//
// No fs, no child_process, no Date.now/Math.random. Data (corpus/brands/fonts) is
// injected via createEngine(), so the same module powers the CLI, the web UI, and
// the MCP Worker. Logic is ported faithfully from viz/personality-test/{color/*,api.mjs}.

import * as SYS from "./system.mjs";
import fontSpaceBundle from "./data/font-space.json" with { type: "json" };

// ===========================================================================
// font-space.json hydration — Subsystem 4 (font-neighbor retrieval).
//
// The bundle is stored positionally (see scripts/build-service-bundle.mjs for
// why: object keys and neighbor id strings repeated ~2000x is the difference
// between ~550kb and ~1.7mb). Hydrate it once, here, into normal records.
// ===========================================================================
function hydrateFontSpace(bundle) {
  const ids = bundle?.ids || [];
  const entries = bundle?.entries || [];
  const entryFields = bundle?.entryFields || [];
  const metricKeys = bundle?.metricKeys || [];
  if (!ids.length || !entries.length) return null;
  const familyByIndex = new Array(ids.length);
  const fi = entryFields.indexOf("family");
  for (let i = 0; i < entries.length; i++) familyByIndex[i] = entries[i][fi];
  const records = entries.map((row, i) => {
    const obj = {};
    entryFields.forEach((k, j) => { obj[k] = row[j]; });
    const metrics = {};
    metricKeys.forEach((k, j) => { metrics[k] = obj.metrics ? obj.metrics[j] : undefined; });
    metrics.hasItalics = !!metrics.hasItalics;
    const neighbors = (obj.neighbors || [])
      .map(([nIdx, sim]) => (ids[nIdx] ? { id: ids[nIdx], family: familyByIndex[nIdx], sim } : null))
      .filter(Boolean);
    return {
      id: ids[i], family: obj.family, category: obj.category, supplier: obj.supplier,
      popularityRank: obj.popularityRank, trendingRank: obj.trendingRank, quality: obj.quality || 0,
      isFoundational: !!obj.isFoundational, isBrandFont: !!obj.isBrandFont,
      metrics, personality: obj.personality || {}, neighbors,
    };
  });
  const byId = new Map(records.map((r) => [r.id, r]));
  const byFamily = new Map(records.map((r) => [r.family.toLowerCase(), r]));
  return { records, byId, byFamily };
}
const FONT_SPACE = hydrateFontSpace(fontSpaceBundle);

// ===========================================================================
// Color-space math (OKLab/OKLCH/ΔEok/WCAG) — pure. From color/color-space.mjs.
// ===========================================================================
export function hexToRgb(hex) {
  let h = String(hex).trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`bad hex: ${hex}`);
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbToHex([r, g, b]) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}
const srgbToLinearC = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const linearToSrgbC = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
const srgbToLinear = ([r, g, b]) => [srgbToLinearC(r), srgbToLinearC(g), srgbToLinearC(b)];
const linearToSrgb = ([r, g, b]) => [linearToSrgbC(r), linearToSrgbC(g), linearToSrgbC(b)];

export function linearToOklab([r, g, b]) {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  return [
    0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
  ];
}
export function oklabToLinear([L, a, b]) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  return [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
}
export const hexToOklab = (hex) => linearToOklab(srgbToLinear(hexToRgb(hex).map((c) => c / 255)));
export function oklabToSrgb([L, a, b]) {
  const srgb = linearToSrgb(oklabToLinear([L, a, b]));
  const eps = 1e-4;
  const inGamut = srgb.every((c) => c >= -eps && c <= 1 + eps);
  return { hex: rgbToHex(srgb.map((c) => c * 255)), inGamut, srgb };
}
export const isInGamut = ([L, a, b]) => oklabToSrgb([L, a, b]).inGamut;
export function oklabToOklch([L, a, b]) {
  const C = Math.hypot(a, b);
  let H = (Math.atan2(b, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return [L, C, H];
}
export const oklchToOklab = ([L, C, H]) => {
  const r = (H * Math.PI) / 180;
  return [L, C * Math.cos(r), C * Math.sin(r)];
};
export const hexToOklch = (hex) => oklabToOklch(hexToOklab(hex));
export const deltaEok = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
const relLum = ([r, g, b]) => {
  const [R, G, B] = srgbToLinear([r / 255, g / 255, b / 255]);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
};
export function contrastRatio(hexA, hexB) {
  const la = relLum(hexToRgb(hexA)), lb = relLum(hexToRgb(hexB));
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

// ===========================================================================
// CONFIG + hard bans — from color/density.mjs (must stay in sync).
// ===========================================================================
export const CONFIG = {
  BANDWIDTH: 0.02, OVERUSE_THRESHOLD: 40.0, NEUTRAL_CHROMA: 0.04,
  MIN_INTENTIONAL_CHROMA: 0.05, DUPLICATE_DELTA: 0.05,
};
const BANNED_HEXES = new Set([
  "#6366f1", "#7c3aed", "#8b5cf6", "#818cf8", "#a78bfa", "#a855f7",
  "#2563eb", "#3b82f6", "#22d3ee", "#2dd4bf", "#67e8f9", "#5eead4",
]);
export function hardBanned(hex) {
  const h = hex.toLowerCase();
  if (BANNED_HEXES.has(h)) return `literal slop hex ${h}`;
  const [L, C, H] = hexToOklch(hex);
  if (C > 0.18 && H >= 264 && H <= 310) return `1A indigo/violet (oklch H${H.toFixed(0)} C${C.toFixed(2)})`;
  if (C > 0.18 && H >= 245 && H < 264 && L >= 0.45) return `1E fintech blue (oklch H${H.toFixed(0)} C${C.toFixed(2)} L${L.toFixed(2)})`;
  if (C >= 0.10 && H >= 170 && H <= 215 && L >= 0.65) return `1B electric cyan/mint (oklch H${H.toFixed(0)} C${C.toFixed(2)} L${L.toFixed(2)})`;
  return null;
}
function inBannedHueBand([L, C, H]) {
  if (C < CONFIG.NEUTRAL_CHROMA) return false;
  if (H >= 250 && H <= 310) return true;
  if (H >= 245 && H < 250 && L >= 0.45) return true;
  if (H >= 165 && H <= 222 && L >= 0.5) return true;
  return false;
}

// The AI-monoculture font avoid-list + popularity slop tier — from api.mjs.
const AVOID_LIST = new Set([
  "inter", "poppins", "playfair display", "playfair", "space grotesk", "outfit",
  "dm sans", "montserrat", "roboto", "lato", "open sans", "geist", "manrope",
  "cormorant", "cormorant garamond", "fraunces", "instrument serif", "clash display",
  "general sans", "sora", "plus jakarta sans", "figtree", "epilogue", "satoshi",
]);
const POPULARITY_SLOP_TOP_N = 40;

// ===========================================================================
// Engine factory — inject {corpus:[{hex,weight}], brands:[{name,ic:[]}], fonts:[...]}
// ===========================================================================
export function createEngine({ corpus = [], brands = [], fonts = [], fontSpace = FONT_SPACE } = {}) {
  // pre-compute corpus labs + weights for the KDE
  const pts = corpus.map((c) => ({ lab: hexToOklab(c.hex), w: c.weight || 1 }));
  const brandLabs = brands.flatMap((b) => (b.ic || []).map((hex) => {
    try { return { name: b.name, hex, lab: hexToOklab(hex) }; } catch { return null; }
  }).filter(Boolean));

  function density(lab, bandwidth = CONFIG.BANDWIDTH) {
    const twoSigma2 = 2 * bandwidth * bandwidth;
    let sum = 0;
    for (const p of pts) {
      const d2 = (lab[0] - p.lab[0]) ** 2 + (lab[1] - p.lab[1]) ** 2 + (lab[2] - p.lab[2]) ** 2;
      sum += p.w * Math.exp(-d2 / twoSigma2);
    }
    return sum;
  }
  const densityHex = (hex) => density(hexToOklab(hex));
  const slopScore = (d) => Math.min(100, Math.round((d / CONFIG.OVERUSE_THRESHOLD) * 100));

  function classify(hex) {
    const [L, C, H] = hexToOklch(hex);
    const ban = hardBanned(hex);
    const neutral = C < CONFIG.NEUTRAL_CHROMA;
    const d = densityHex(hex);
    let verdict;
    if (ban) verdict = "HARD-BANNED";
    else if (neutral) verdict = "NEUTRAL-ok";
    else if (d >= CONFIG.OVERUSE_THRESHOLD) verdict = "OVERUSED";
    else verdict = "SAFE";
    return { hex: hex.toLowerCase(), oklch: { L, C, H }, verdict, density: d, ban, neutral };
  }

  function isSafeAccentLab(lab, { minChroma = CONFIG.MIN_INTENTIONAL_CHROMA, allowBandEdge = false } = {}) {
    if (!isInGamut(lab)) return false;
    const { hex } = oklabToSrgb(lab);
    if (hardBanned(hex)) return false;
    const lch = oklabToOklch(lab);
    if (!allowBandEdge && inBannedHueBand(lch)) return false;
    if (density(lab) >= CONFIG.OVERUSE_THRESHOLD) return false;
    if (lch[1] < minChroma) return false;
    return true;
  }

  function nearestSafe(hex, { count = 3, maxDelta = 0.6 } = {}) {
    const startLab = hexToOklab(hex);
    const startDensity = density(startLab);
    const [L0, C0, H0] = oklabToOklch(startLab);
    const neutralInput = C0 < CONFIG.NEUTRAL_CHROMA;
    const minChroma = neutralInput ? 0 : CONFIG.MIN_INTENTIONAL_CHROMA;
    const dLs = [0, 0.02, -0.02, 0.04, -0.04, 0.06, -0.06, 0.08, -0.08, 0.12, -0.12, 0.16, -0.16];
    const dCs = [0, 0.02, -0.02, 0.04, -0.04, 0.06, -0.06, 0.09, -0.09, 0.12, -0.12, 0.15];
    const dHs = [0];
    for (let s = 5; s <= 60; s += 5) { dHs.push(s); dHs.push(-s); }
    const seen = new Set(); const candidates = [];
    for (const dH of dHs) for (const dL of dLs) for (const dC of dCs) {
      const L = L0 + dL, C = Math.max(0, C0 + dC), H = (H0 + dH + 360) % 360;
      if (L <= 0.05 || L >= 0.99) continue;
      const lab = oklchToOklab([L, C, H]);
      if (!isSafeAccentLab(lab, { minChroma, allowBandEdge: true })) continue;
      const cd = density(lab);
      if (cd >= startDensity) continue;
      const { hex: chex } = oklabToSrgb(lab);
      if (seen.has(chex)) continue;
      seen.add(chex);
      const delta = deltaEok(startLab, lab);
      if (delta > maxDelta) continue;
      candidates.push({ hex: chex, lab, L, C, H, dH, delta, density: cd });
    }
    candidates.sort((a, b) => a.delta - b.delta || a.density - b.density);
    const picked = [];
    for (const c of candidates) {
      if (picked.some((p) => deltaEok(p.lab, c.lab) < CONFIG.DUPLICATE_DELTA)) continue;
      const sameFamily = Math.abs(c.dH) <= 15;
      picked.push({
        hex: c.hex, lab: c.lab, oklch: { L: c.L, C: c.C, H: c.H }, density: density(c.lab), delta: c.delta,
        reason: sameFamily
          ? `same hue family, shifted out of the hot zone (ΔEok ${c.delta.toFixed(2)})`
          : `hue shifted ${c.dH > 0 ? "+" : ""}${c.dH}° to escape the slop band (ΔEok ${c.delta.toFixed(2)})`,
      });
      if (picked.length >= count) break;
    }
    return picked.map(({ lab, ...rest }) => rest);
  }

  function brandClone(hex, maxDelta = 0.06) {
    const lab = hexToOklab(hex);
    let best = null;
    for (const b of brandLabs) {
      const d = deltaEok(lab, b.lab);
      if (d <= maxDelta && (!best || d < best.delta)) best = { brand: b.name, brandHex: b.hex, delta: +d.toFixed(3) };
    }
    return best;
  }

  function colorReason(hex, cls) {
    const clone = brandClone(hex);
    if (clone) return { kind: "brand-clone", detail: `≈ ${clone.brand} identity color ${clone.brandHex} (ΔEok ${clone.delta}) — cloning a known brand reads as derivative`, brand: clone.brand };
    if (cls.ban) return { kind: "framework-default", detail: `${cls.ban} — a Tailwind/shadcn/Framer default; the AI-monoculture accent` };
    if (cls.verdict === "OVERUSED") return { kind: "framework-default", detail: `sits in a crowded zone of the empirical corpus (density ${cls.density.toFixed(1)} ≥ ${CONFIG.OVERUSE_THRESHOLD}) — everyone keeps reaching for this` };
    return { kind: "fresh", detail: "not a brand clone, not a framework default, low corpus density — fresh" };
  }

  function checkColor(hex) {
    const cls = classify(hex);
    const reason = colorReason(hex, cls);
    const flagged = cls.verdict === "HARD-BANNED" || cls.verdict === "OVERUSED";
    return {
      hex: cls.hex, verdict: cls.verdict, slop: slopScore(cls.density),
      oklch: { L: +cls.oklch.L.toFixed(3), C: +cls.oklch.C.toFixed(3), H: +cls.oklch.H.toFixed(1) },
      reason,
      alternatives: flagged ? nearestSafe(hex).map((s) => ({ hex: s.hex, slop: slopScore(s.density), deltaEok: +s.delta.toFixed(3), reason: s.reason })) : [],
    };
  }

  function checkPalette(ground, ink, accent, accent2) {
    const roles = [["ground", ground], ["ink", ink], ["accent", accent]];
    if (accent2) roles.push(["accent2", accent2]);
    const perRole = {};
    for (const [role, hex] of roles) {
      if (!hex) continue;
      const cls = classify(hex);
      const flagged = cls.verdict === "HARD-BANNED" || cls.verdict === "OVERUSED";
      perRole[role] = {
        hex: cls.hex, verdict: cls.verdict, density: +cls.density.toFixed(2), ban: cls.ban,
        fix: flagged ? nearestSafe(hex).map((s) => ({ hex: s.hex, deltaEok: +s.delta.toFixed(3), reason: s.reason })) : null,
      };
    }
    // near-duplicate check across chosen colors
    const chosen = roles.filter(([, h]) => h).map(([role, h]) => ({ role, hex: h, lab: hexToOklab(h) }));
    const dupes = [];
    for (let i = 0; i < chosen.length; i++) for (let j = i + 1; j < chosen.length; j++) {
      const d = deltaEok(chosen[i].lab, chosen[j].lab);
      if (d < CONFIG.DUPLICATE_DELTA) dupes.push({ a: chosen[i].role, b: chosen[j].role, delta: +d.toFixed(3) });
    }
    // contrast (ink on ground) — a11y hint
    let contrast = null;
    if (ground && ink) { try { contrast = +contrastRatio(ground, ink).toFixed(2); } catch { /* bad hex */ } }
    return {
      perRole, duplicates: dupes, contrast,
      pass: Object.values(perRole).every((r) => r.verdict === "SAFE" || r.verdict === "NEUTRAL-ok") && dupes.length === 0,
    };
  }

  // ---- fonts ----
  function freshnessScore(f) {
    if (!f) return -Infinity;
    if (AVOID_LIST.has(f.family.toLowerCase())) return -Infinity;
    if (f.isBrandFont) return -Infinity;
    let s = 0;
    if (f.supplier && f.supplier !== "google") s += 1.0;   // was 2.5 — stop chasing the obscure indie tail
    if (!f.isFoundational) s += 0.6;
    const rank = f.popularityRank || 9999;
    if (rank > 100 && rank < 900) s += 1.5;
    else if (rank >= 900 && rank < 1400) s += 0.6;
    else if (rank >= 1400 && rank < 1800) s -= 1.0;         // NEW: distinctive fades into novelty
    else if (rank >= 1800) s -= 2.5;                        // NEW: the novelty tail (Kihim 2114) is demoted
    else if (rank <= 100) s -= 2.0;
    s += (f.quality || 0) * 1.2;
    return s;
  }
  function bodyScore(f) {
    if (!f) return -Infinity;
    if (AVOID_LIST.has(f.family.toLowerCase())) return -Infinity;
    if (f.isBrandFont) return -Infinity;
    if (!["serif", "sans-serif"].includes(f.category)) return -Infinity; // never display/handwriting/mono for running text
    let s = 0;
    if (f.isFoundational) s += 3.0;          // the flag literally means "usable as a NEUTRAL body workhorse"
    const rank = f.popularityRank || 9999;
    if (rank > 40 && rank < 1200) s += 1.0;  // distinctive but vetted enough to read
    else if (rank <= 40) s -= 1.0;           // the monoculture floor
    s += (f.quality || 0) * 1.5;
    if (f.supplier && f.supplier !== "google") s += 0.4;
    return s;
  }
  const findFont = (family) => {
    const fam = family.trim().toLowerCase();
    return fonts.find((f) => f.family.toLowerCase() === fam) || fonts.find((f) => f.family.toLowerCase().startsWith(fam)) || null;
  };
  function checkFont(family) {
    const f = findFont(family);
    if (!f) return { family, verdict: "UNKNOWN", why: `"${family}" is not in the font index — can't certify it; prefer a known fresh family.`, isFoundational: false, alternatives: suggestFonts(4).picks };
    const fam = f.family.toLowerCase();
    const onAvoid = AVOID_LIST.has(fam);
    const topTier = (f.popularityRank || 9999) <= POPULARITY_SLOP_TOP_N;
    const isSlop = onAvoid || topTier;
    const base = { family: f.family, supplier: f.supplier, category: f.category, popularityRank: f.popularityRank };
    const slopWhy = onAvoid ? "on the avoid-list" : `top-${POPULARITY_SLOP_TOP_N} popularity (rank ${f.popularityRank})`;
    if (isSlop && f.isFoundational) return { ...base, verdict: "SLOP-allowed-foundational", isFoundational: true, why: `${f.family} is AI-monoculture slop (${slopWhy}), but isFoundational=true rescues it: usable as a NEUTRAL body workhorse only — never the display face.`, alternatives: suggestFonts(4).picks };
    if (isSlop) return { ...base, verdict: "SLOP", isFoundational: false, why: `${f.family} is AI-monoculture slop (${slopWhy}) — do NOT use it for ANY role.`, alternatives: suggestFonts(4).picks };
    return { ...base, verdict: "FRESH", isFoundational: !!f.isFoundational, why: `${f.family} is not on the avoid-list and not top-tier popular (rank ${f.popularityRank ?? "?"}, supplier ${f.supplier}) — a distinctive choice.`, alternatives: [] };
  }
  function suggestFonts(n = 4, { category = null } = {}) {
    const disp = fonts.map((f) => ({ f, score: freshnessScore(f) })).filter((x) => x.score > -Infinity)
      .filter((x) => x.f.category === "display").sort((a, b) => b.score - a.score);
    const body = fonts.map((f) => ({ f, score: bodyScore(f) })).filter((x) => x.score > -Infinity)
      .sort((a, b) => b.score - a.score);
    const pickOf = (arr) => arr.map((x) => ({
      family: x.f.family, supplier: x.f.supplier, category: x.f.category, popularityRank: x.f.popularityRank,
      isFoundational: !!x.f.isFoundational,
      why: `${x.f.category === "display" ? "characterful display" : "readable body workhorse"}: rank ${x.f.popularityRank}, ${x.f.supplier}`,
    }));
    if (category === "display") return { picks: pickOf(disp).slice(0, n), pairing: pairFrom(disp, body) };
    if (category === "body") return { picks: pickOf(body).slice(0, n), pairing: pairFrom(disp, body) };
    const half = Math.max(1, Math.ceil(n / 2));
    const picks = [...pickOf(disp).slice(0, half), ...pickOf(body).slice(0, n - half)].slice(0, n);
    return { picks, pairing: pairFrom(disp, body) };
  }
  function pairFrom(disp, body) {
    return {
      display: disp[0]?.f.family || null,
      body: body[0]?.f.family || null,
      note: "Display face carries identity (headings, name); body face carries running text — never swap them. The display pick is distinctive; confirm it reads for your context.",
    };
  }

  // retrieveFonts — Subsystem 4: rich, neighbor-aware retrieval over fontSpace
  // (metrics + personality + precomputed visual neighbors). This is what the
  // connected genome uses for type; suggestFonts stays as the light catalogue path.
  // Falls back to the catalogue when the font-space bundle is absent.
  const round3 = (x) => Math.round(x * 1000) / 1000;
  const pick01 = (v) => (Number.isFinite(Number(v)) ? Number(v) : NaN);
  const BODY_CATEGORIES = new Set(["serif", "sans-serif"]);
  function overusePenalty(f) {
    let p = 0;
    if (AVOID_LIST.has((f.family || "").toLowerCase())) p += 1.0;
    if (f.isBrandFont) p += 0.6;
    const rank = f.popularityRank || 9999;
    if (rank <= POPULARITY_SLOP_TOP_N) p += 0.8;
    else if (rank <= 100) p += 0.4;
    if ((f.trendingRank || 9999) <= 40) p += 0.3;
    return p;
  }
  function readabilityChecks(f) {
    const x = Number((f.metrics || {}).xHeightRatio);
    // HARD body gate: a text workhorse must be serif/sans with a generous x-height.
    // This is the structural fix for the "display serif as body" failure.
    const bodySuitable = BODY_CATEGORIES.has(f.category) && (!Number.isFinite(x) || x >= 0.48);
    return { bodySuitable, displaySuitable: true };
  }
  function featureDistanceFor(f, role, intent) {
    const m = f.metrics || {};
    const g = (k, d) => (Number.isFinite(Number(m[k])) ? Number(m[k]) : d);
    const ideal = role === "body"
      ? { xHeightRatio: 0.72, apertureOpenness: 0.6, strokeContrast: 0.2 }
      : { xHeightRatio: 0.6, apertureOpenness: 0.5, strokeContrast: 0.45 };
    let d2 = 0, n = 0;
    for (const k of Object.keys(ideal)) { const dv = g(k, ideal[k]) - ideal[k]; d2 += dv * dv; n++; }
    let dist = Math.sqrt(d2 / Math.max(1, n));
    // personality nudge — only when both intent and the font carry a real signal.
    if (intent && f.personality) {
      const formal = pick01(intent.formality), prof = Number(f.personality.professional);
      if (Number.isFinite(formal) && Number.isFinite(prof)) dist += Math.abs(formal - prof) * 0.4;
      const energy = pick01(intent.energy), calm = Number(f.personality.calm);
      if (Number.isFinite(energy) && Number.isFinite(calm)) dist += Math.abs((1 - energy) - calm) * 0.4;
    }
    return dist;
  }
  function retrieveFonts({ role = "display", intent = null, like = null, exclude = [], n = 6 } = {}) {
    const space = fontSpace && fontSpace.records && fontSpace.records.length ? fontSpace : null;
    if (!space) {
      const picks = suggestFonts(n, { category: role === "body" ? "body" : "display" }).picks;
      return picks.map((p) => ({
        family: p.family, role, featureDistance: null, visualDistance: null, overusePenalty: null,
        readabilityChecks: { bodySuitable: role === "body", displaySuitable: true },
        neighbors: [], provenance: "catalogue-fallback",
      }));
    }
    const ex = new Set((exclude || []).map((e) => String(e).toLowerCase()));
    let pool = space.records, simById = null;
    if (like) {
      const seed = space.byFamily.get(String(like).toLowerCase()) || space.byId.get(String(like).toLowerCase());
      if (seed && seed.neighbors.length) {
        simById = new Map(seed.neighbors.map((nb) => [nb.id, nb.sim]));
        pool = seed.neighbors.map((nb) => space.byId.get(nb.id)).filter(Boolean);
      }
    }
    const scored = [];
    for (const f of pool) {
      if (ex.has((f.family || "").toLowerCase()) || ex.has((f.id || "").toLowerCase())) continue;
      const rc = readabilityChecks(f);
      if (role === "body" && !rc.bodySuitable) continue;   // never a display-only face for running text
      const featureDistance = featureDistanceFor(f, role, intent);
      const pen = overusePenalty(f);
      const sim = simById ? (simById.get(f.id) || 0) : 0;
      const fit = (f.quality || 0) * 1.2 - featureDistance - pen + sim * 1.5
        + (role === "body" && f.isFoundational ? 0.6 : 0)
        + (role === "display" && !f.isFoundational ? 0.3 : 0);
      scored.push({
        family: f.family, role, fit,
        featureDistance: round3(featureDistance),
        visualDistance: simById ? round3(1 - sim) : null,
        overusePenalty: round3(pen),
        readabilityChecks: rc,
        neighbors: f.neighbors.slice(0, 6).map((nb) => nb.family),
        provenance: "font-space.json",
      });
    }
    scored.sort((a, b) => b.fit - a.fit);
    return scored.slice(0, n).map(({ fit, ...rest }) => rest);
  }

  // seeded PRNG — keeps generation deterministic + portable (no Math.random)
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // energy → accent chroma band (kept inside the gate). The caller expresses the
  // subject's mood, not a number.
  const ENERGY_CHROMA = { muted: [0.06, 0.11], calm: [0.06, 0.11], balanced: [0.10, 0.16], bold: [0.15, 0.20], vivid: [0.15, 0.20] };

  // generatePalette({ hue?, energy?, accent?, seed? }) — INTENT-driven, not seed-driven.
  // The agent grounds it in the subject: a target `hue` from the real material and/or an
  // `energy` mood, or an `accent` hex to anchor on. `seed` is an internal reproducibility
  // detail (the tool layer varies it), NOT something a caller should think about. A bare
  // number is still accepted for back-compat.
  function generatePalette(opts = {}) {
    if (typeof opts === "number") opts = { seed: opts };
    const { hue = null, energy = "balanced", accent = null, seed = 1 } = opts;
    const rand = mulberry32((seed >>> 0) || 1);
    const rnd = (lo, hi) => lo + rand() * (hi - lo);
    const buildHex = (L, C, H) => { const o = oklabToSrgb(oklchToOklab([L, C, H])); return o.inGamut ? o.hex : null; };
    const [cLo, cHi] = ENERGY_CHROMA[energy] || ENERGY_CHROMA.balanced;
    const wrap = (h) => ((h % 360) + 360) % 360;
    // an accent around the material's hue (± small jitter) or free; energy sets chroma
    const freshAccent = () => {
      for (let t = 0; t < 300; t++) {
        const H = hue != null ? wrap(hue + rnd(-14, 14)) : rand() * 360;
        const L = rnd(0.48, 0.66), C = rnd(cLo, cHi);
        const lab = oklchToOklab([L, C, H]);
        if (isSafeAccentLab(lab, { minChroma: CONFIG.MIN_INTENTIONAL_CHROMA })) return buildHex(L, C, H);
      }
      return null;
    };
    // honor a caller-provided accent hex, nudged non-slop if it isn't clean
    const anchored = () => {
      if (!accent) return null;
      const chk = checkColor(accent);
      if (chk.verdict === "SAFE" || chk.verdict === "NEUTRAL-ok") return chk.hex;
      return (chk.alternatives && chk.alternatives[0] && chk.alternatives[0].hex) || null;
    };
    // neutral ground/ink, hue biased toward the accent so the palette reads cohesive
    const freshNeutral = (kind) => {
      for (let t = 0; t < 300; t++) {
        const L = kind === "ink" ? rnd(0.15, 0.24) : rnd(0.93, 0.965);
        const nH = hue != null ? wrap(hue + rnd(-30, 30)) : rand() * 360;
        const hex = buildHex(L, rnd(0.006, 0.02), nH);
        if (!hex) continue;
        const v = classify(hex).verdict;
        if (v === "SAFE" || v === "NEUTRAL-ok") return hex;
      }
      return kind === "ink" ? "#17150f" : "#eceae3";
    };
    for (let a = 0; a < 60; a++) {
      const acc = anchored() || freshAccent() || "#1f6e4c";
      const pal = { ground: freshNeutral("ground"), ink: freshNeutral("ink"), accent: acc, accent2: freshAccent() || acc };
      const p = checkPalette(pal.ground, pal.ink, pal.accent, pal.accent2);
      if (p.pass && p.contrast != null && p.contrast >= 4.5) return { ...pal, contrast: p.contrast, hue, energy };
    }
    const fb = { ground: "#eceae3", ink: "#17150f", accent: anchored() || "#b5522f", accent2: "#2f6b5e" };
    return { ...fb, contrast: +contrastRatio(fb.ground, fb.ink).toFixed(2), hue, energy };
  }
  function designSystem({ baseFont = 18, baseUnit = 4, ratio = "perfect-fourth", radiusBase = 8, hue = null, energy = "balanced", accent = null, seed = 1 } = {}) {
    return {
      palette: generatePalette({ hue, energy, accent, seed }),
      type: SYS.typeScale({ base: baseFont, ratio }),
      spacing: SYS.spacingScale({ base: baseUnit }),
      radius: SYS.radiusScale({ base: radiusBase }),
      elevation: [0, 1, 2, 3, 4, 5].map((e) => ({ level: e, ...SYS.shadow(e) })),
      motion: SYS.motionTokens(),
      controls: { cozy: SYS.controlSize(baseFont, "cozy"), z: SYS.zScale() },
    };
  }
  function auditSystem(tokens = {}) {
    const domains = {};
    if (tokens.type) domains.type = SYS.auditTypeScale(tokens.type);
    if (tokens.spacing) domains.spacing = SYS.auditSpacing(tokens.spacing);
    if (tokens.radius) domains.radius = SYS.auditRadius(tokens.radius);
    if (tokens.shadow) domains.shadow = SYS.auditShadow(tokens.shadow);
    if (tokens.palette) domains.palette = checkPalette(tokens.palette.ground, tokens.palette.ink, tokens.palette.accent, tokens.palette.accent2);
    const vals = Object.values(domains);
    const clean = vals.filter((d) => d.verdict === "CLEAN" || d.pass === true).length;
    return { domains, coherence: vals.length ? Math.round((clean / vals.length) * 100) : 100 };
  }

  return {
    checkColor, checkPalette, checkFont, suggestFonts, retrieveFonts, classify, nearestSafe, brandClone,
    density: densityHex, contrastRatio, CONFIG,
    generatePalette, designSystem, auditSystem,
    ...SYS,
  };
}
