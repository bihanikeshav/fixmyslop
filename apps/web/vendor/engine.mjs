// engine.mjs — the ai-slop-font query engine, PURE and portable (browser + Worker).
//
// No fs, no child_process, no Date.now/Math.random. Data (corpus/brands/fonts) is
// injected via createEngine(), so the same module powers the CLI, the web UI, and
// the MCP Worker. Logic is ported faithfully from viz/personality-test/{color/*,api.mjs}.

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
export function createEngine({ corpus = [], brands = [], fonts = [] } = {}) {
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
    if (f.supplier && f.supplier !== "google") s += 2.5;
    if (!f.isFoundational) s += 1.0;
    const rank = f.popularityRank || 9999;
    if (rank > 100 && rank < 900) s += 1.5;
    else if (rank >= 900 && rank < 1400) s += 0.6;
    else if (rank <= 100) s -= 2.0;
    s += (f.quality || 0) * 1.2;
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
    const scored = fonts.map((f) => ({ f, score: freshnessScore(f) })).filter((x) => x.score > -Infinity).sort((a, b) => b.score - a.score);
    let display = scored.filter((x) => x.f.category === "display");
    let body = scored.filter((x) => ["sans-serif", "serif"].includes(x.f.category));
    if (category === "display") { body = []; }
    if (category === "body") { display = []; }
    const half = Math.max(1, Math.ceil(n / 2));
    const pick = (arr, k) => arr.slice(0, k).map((x) => ({
      family: x.f.family, supplier: x.f.supplier, category: x.f.category, popularityRank: x.f.popularityRank,
      isFoundational: !!x.f.isFoundational,
      why: `fresh: ${x.f.supplier !== "google" ? `indie (${x.f.supplier}), ` : ""}rank ${x.f.popularityRank}, non-slop ${x.f.category}`,
    }));
    const picks = display.length && body.length ? [...pick(display, half), ...pick(body, n - half)].slice(0, n) : pick(display.length ? display : body, n);
    return { picks, pairing: { display: display[0]?.f.family || null, body: body[0]?.f.family || null, note: "Display face for headings/identity; body face for running text. Both off the avoid-list." } };
  }

  return { checkColor, checkPalette, checkFont, suggestFonts, classify, nearestSafe, brandClone, density: densityHex, contrastRatio, CONFIG };
}
