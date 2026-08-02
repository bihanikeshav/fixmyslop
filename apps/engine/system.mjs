// apps/engine/system.mjs — pure, closed-form design math (no fs/Date/random).
export const round = (n, p = 2) => Math.round(n * 10 ** p) / 10 ** p;

// piecewise-linear interpolation over [x,y] anchors, clamped at the ends
export function lerpAnchors(anchors, x) {
  if (x <= anchors[0][0]) return anchors[0][1];
  const last = anchors[anchors.length - 1];
  if (x >= last[0]) return last[1];
  for (let i = 0; i < anchors.length - 1; i++) {
    const [x0, y0] = anchors[i], [x1, y1] = anchors[i + 1];
    if (x >= x0 && x <= x1) return y0 + (y1 - y0) * ((x - x0) / (x1 - x0));
  }
  return last[1];
}

export const RATIOS = {
  "minor-second": 1.067, "major-second": 1.125, "minor-third": 1.2,
  "major-third": 1.25, "perfect-fourth": 1.333, "aug-fourth": 1.414,
  "perfect-fifth": 1.5, "golden": 1.618,
};
const ratioVal = (r) => (typeof r === "number" ? r : RATIOS[r] || 1.25);
const snapHalf = (px) => Math.round(px * 2) / 2; // 0.5px grid

export function typeScale({ base = 16, ratio = 1.25, up = 5, down = 1 } = {}) {
  const r = ratioVal(ratio);
  const out = [];
  for (let step = -down; step <= up; step++) {
    const px = snapHalf(base * Math.pow(r, step));
    out.push({ step, px, rem: round(px / 16, 4) });
  }
  return out;
}

const LH = [[12, 1.6], [16, 1.5], [24, 1.35], [48, 1.15], [96, 1.02]];
export const lineHeightFor = (px) => round(lerpAnchors(LH, px), 3);

const TRACK = [[12, 0.01], [16, 0], [24, -0.006], [48, -0.02], [96, -0.03]];
export const trackingFor = (px) => round(lerpAnchors(TRACK, px), 4);

export function fluidType(minPx, maxPx, minVw = 390, maxVw = 1440) {
  const slope = (maxPx - minPx) / (maxVw - minVw);
  const interceptRem = round((minPx - slope * minVw) / 16, 4);
  const vw = round(slope * 100, 4);
  return `clamp(${round(minPx / 16, 4)}rem, ${interceptRem}rem + ${vw}vw, ${round(maxPx / 16, 4)}rem)`;
}

export function auditTypeScale(sizes) {
  const uniq = [...new Set(sizes.map(Number))].sort((a, b) => a - b);
  const ratios = uniq.slice(1).map((v, i) => v / uniq[i]);
  const mean = ratios.reduce((a, b) => a + b, 0) / (ratios.length || 1);
  const variance = ratios.reduce((a, b) => a + (b - mean) ** 2, 0) / (ratios.length || 1);
  const cv = Math.sqrt(variance) / (mean || 1);
  const issues = [];
  if (uniq.length > 7) issues.push(`${uniq.length} distinct sizes — too many (aim ≤7)`);
  if (mean < 1.1) issues.push(`mean ratio ${round(mean, 3)} < 1.1 — muddy hierarchy`);
  if (cv > 0.08) issues.push(`inconsistent ratio (CV ${round(cv, 3)}) — not a modular scale`);
  return {
    verdict: issues.length ? "SLOP" : "CLEAN",
    reason: issues.join("; ") || `coherent modular scale (~${round(mean, 3)}×)`,
    fix: issues.length ? typeScale({ base: uniq[0] || 16, ratio: round(Math.max(1.15, mean), 3), up: Math.min(6, uniq.length - 1), down: 0 }) : null,
  };
}

const SPACE_MULT = [1, 2, 3, 4, 6, 8, 12, 16, 24];
export function spacingScale({ base = 4, steps = SPACE_MULT.length } = {}) {
  return SPACE_MULT.slice(0, steps).map((m, i) => ({ token: `s${i + 1}`, px: base * m, rem: round(base * m / 16, 4) }));
}
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
export function auditSpacing(values) {
  const v = values.map(Number).filter((n) => n > 0);
  const base = v.reduce((a, b) => gcd(a, b), v[0] || 4);
  const offGrid = v.filter((n) => n % base !== 0);
  const issues = [];
  if (base < 4) issues.push(`no consistent base grid (gcd ${base}px) — values not aligned`);
  else if (offGrid.length) issues.push(`off-grid vs ${base}px: ${offGrid.join(", ")}`);
  if (v.length > 6 && new Set(v).size >= v.length) issues.push("all values distinct — no reusable scale");
  return {
    verdict: issues.length ? "SLOP" : "CLEAN",
    reason: issues.join("; ") || `all multiples of ${base}px`,
    fix: issues.length ? spacingScale({ base: base >= 4 ? base : 4 }) : null,
  };
}

export function radiusScale({ base = 8 } = {}) {
  return { none: 0, sm: round(base * 0.5), md: base, lg: base * 2, xl: base * 3, full: 9999 };
}
export const nestedRadius = (outer, padding) => Math.max(0, outer - padding);
export const outerRadius = (inner, padding) => inner + padding;
export function auditRadius(values, pairs = []) {
  const v = [...new Set(values.map(Number))].filter((n) => n < 9999);
  const issues = [];
  if (v.length > 5) issues.push(`${v.length} distinct radii — sprawl (aim ≤5 + full)`);
  for (const p of pairs) {
    const want = nestedRadius(p.outer, p.padding);
    if (p.inner !== want) issues.push(`inner ${p.inner}px breaks concentricity (should be ${want}px for outer ${p.outer}/pad ${p.padding})`);
  }
  return {
    verdict: issues.length ? "SLOP" : "CLEAN",
    reason: issues.join("; ") || "coherent radius scale, concentric",
    fix: issues.length ? radiusScale({ base: Math.min(...v.filter((n) => n > 0)) || 8 }) : null,
  };
}

const shadowTint = (hue, a) => (hue ? `hsla(${hue}, 25%, 12%, ${a})` : `rgba(0,0,0,${a})`);
export function shadow(elevation = 1, { hue = 0, alpha = 0.18 } = {}) {
  const e = Math.max(0, Number(elevation));
  if (e === 0) return { css: "none", layers: [] };
  const n = Math.min(5, Math.max(2, Math.round(1 + e / 2)));
  const layers = [];
  for (let i = 0; i < n; i++) {
    const f = (i + 1) / n;
    const y = round(e * f * f * 1.2, 1);
    const blur = round(y * 2, 1);
    const spread = round(-e * f * 0.15, 1);
    const a = round(alpha * (1 - i / n), 3);
    layers.push({ x: 0, y, blur, spread, color: shadowTint(hue, a) });
  }
  const css = layers.map((l) => `${l.x}px ${l.y}px ${l.blur}px ${l.spread}px ${l.color}`).join(", ");
  return { css, layers };
}
export function splitShadowLayers(css) {
  const out = []; let depth = 0, cur = "";
  for (const ch of css) {
    if (ch === "(") depth++; else if (ch === ")") depth--;
    if (ch === "," && depth === 0) { out.push(cur.trim()); cur = ""; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
export function auditShadow(css) {
  if (!css || css === "none") return { verdict: "CLEAN", reason: "no shadow", fix: null };
  const layers = splitShadowLayers(css);
  const issues = [];
  if (layers.length === 1) issues.push("single flat layer — reads generic; use a multi-layer ramp");
  if (/rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*(0?\.[3-9]\d*|1(\.0)?)\s*\)/.test(css)) issues.push("harsh pure-black alpha ≥0.3 — muddy; tint + lower alpha");
  for (const l of layers) {
    const m = l.match(/(-?\d+\.?\d*)px\s+(-?\d+\.?\d*)px\s+(-?\d+\.?\d*)px/);
    if (m && +m[1] === 0 && +m[2] === 0 && +m[3] >= 16) issues.push(`glow layer (0 0 ${m[3]}px) — not a shadow`);
  }
  return {
    verdict: issues.length ? "SLOP" : "CLEAN",
    reason: issues.join("; ") || "layered, tinted, plausible",
    fix: issues.length ? shadow(4).css : null,
  };
}
