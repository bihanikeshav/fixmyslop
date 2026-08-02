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
