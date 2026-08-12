// apps/engine/system.mjs — pure, closed-form design math (no fs/Date/random).
export const round = (n, p = 2) => Math.round(n * 10 ** p) / 10 ** p;

// accept a raw number, a numeric string, or a token object ({px} / {value}) — for auditors that
// consume either hand-written values or generator output ([{px,...}]).
export const toPx = (x) => (x && typeof x === "object" ? Number(x.px ?? x.value) : Number(x));

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
  const uniq = [...new Set(sizes.map(toPx))].filter(Number.isFinite).sort((a, b) => a - b);
  if (uniq.length < 2) return { verdict: "CLEAN", reason: "fewer than 2 distinct sizes — nothing to assess", fix: null };
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
  const v = values.map(toPx).filter((n) => Number.isFinite(n) && n > 0);
  const base = v.reduce((a, b) => gcd(a, b), v[0] || 4);
  const offGrid = v.filter((n) => n % base !== 0);
  const issues = [];
  if (base < 4) issues.push(`no consistent base grid (gcd ${base}px) — values not aligned`);
  else if (offGrid.length) issues.push(`off-grid vs ${base}px: ${offGrid.join(", ")}`);
  return {
    verdict: issues.length ? "SLOP" : "CLEAN",
    reason: issues.join("; ") || `all multiples of ${base}px`,
    fix: issues.length ? spacingScale({ base: base >= 4 ? base : 4 }) : null,
  };
}

// normalizeSpacing — the spacing FIXER (auditSpacing only flags; this repairs). Snaps every
// arbitrary padding/margin/gap/size to a canonical 4- or 8-px scale, collapses near-duplicates onto
// ONE shared token (13/15/17 → 16 = s4), and returns a before→after map so a caller can rewrite a
// component's box model to the grid. Accepts a flat `values` list AND/OR named `components`
// ({ button:{paddingX, paddingY, gap}, card:{padding, gap} }). Pure; no clamping surprises — values
// past the top of the scale extend ON the grid rather than snapping down.
export function normalizeSpacing({ values = [], components = {}, base = 4 } = {}) {
  const b = Number(base) === 8 ? 8 : 4;
  const scale = spacingScale({ base: b });                 // [{token:"s1", px, rem}]
  const steps = scale.map((s) => s.px);
  const maxStep = steps[steps.length - 1];
  const tokenForPx = (px) => (px === 0 ? "s0" : (scale.find((s) => s.px === px) || { token: `${px}px` }).token);
  const snap = (raw) => {
    const n = toPx(raw);
    if (!Number.isFinite(n) || n < 0) return null;
    if (n === 0) return { px: 0, token: "s0" };
    let best = steps[0];
    if (n > maxStep) best = Math.round(n / b) * b;          // extend the grid, don't clamp
    else for (const s of steps) if (Math.abs(n - s) < Math.abs(n - best)) best = s;
    return { px: best, token: tokenForPx(best) };
  };
  const mapOne = (raw) => {
    const s = snap(raw);
    const from = toPx(raw);
    return s ? { from, to: s.px, token: s.token, changed: Number.isFinite(from) && from !== s.px } : { from: raw, to: null, token: null, changed: false };
  };
  const valueMap = (Array.isArray(values) ? values : []).map(mapOne);
  const componentMap = {};
  for (const [name, box] of Object.entries(components || {})) {
    componentMap[name] = {};
    for (const [prop, val] of Object.entries(box || {})) componentMap[name][prop] = mapOne(val);
  }
  const usedPx = new Set([
    ...valueMap.filter((m) => m.to != null).map((m) => m.to),
    ...Object.values(componentMap).flatMap((c) => Object.values(c)).filter((x) => x.to != null).map((x) => x.to),
  ]);
  const changed = valueMap.filter((m) => m.changed).length
    + Object.values(componentMap).flatMap((c) => Object.values(c)).filter((x) => x.changed).length;
  return {
    verdict: changed ? "FIXED" : "CLEAN",
    base: b,
    scale,                                                  // the full canonical scale to bind as tokens
    usedTokens: scale.filter((s) => usedPx.has(s.px)),      // only the steps this UI actually needs
    values: valueMap,                                       // per-value before→after (+token)
    components: componentMap,                               // per-component before→after
    changed,
    reason: changed
      ? `snapped ${changed} value(s) to the ${b}px grid and collapsed near-duplicates to shared tokens`
      : `all values already on the ${b}px grid`,
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
  const pos = v.filter((n) => n > 0);
  return {
    verdict: issues.length ? "SLOP" : "CLEAN",
    reason: issues.join("; ") || "coherent radius scale, concentric",
    fix: issues.length ? radiusScale({ base: pos.length ? Math.min(...pos) : 8 }) : null,
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

// Layout bucket: grid, splits, measure, focal points, content breakpoints, composite layout, audit
export function grid({ viewport, minCol = 280, gutter = 24, margin = 32, maxCols = 12 } = {}) {
  const inner = viewport - 2 * margin;
  let cols = Math.floor((inner + gutter) / (minCol + gutter));
  cols = Math.max(1, Math.min(maxCols, cols));
  const colW = round((inner - (cols - 1) * gutter) / cols, 2);
  return {
    viewport, inner, cols, colW, gutter, margin,
    template: `repeat(${cols}, minmax(0, 1fr))`,
    fixedTemplate: `repeat(${cols}, ${colW}px)`,
    innerNote: "`inner` already excludes margins — do not subtract or re-pad by `margin` again.",
  };
}
export const SPLITS = { golden: [38.2, 61.8], thirds: [33.33, 66.67], quarter: [25, 75], half: [50, 50] };
export const splitRatio = (name) => SPLITS[name] || SPLITS.golden;
export const computeSplit = (width, name = "golden") => { const [a, b] = splitRatio(name); return [round(width * a / 100, 2), round(width * b / 100, 2)]; };
export const measure = (fontPx, cpl = 66) => round(cpl * 0.5 * fontPx, 1);
export function auditMeasure(widthPx, fontPx) {
  const cpl = round(widthPx / (0.5 * fontPx), 1);
  const issues = [];
  if (cpl < 45) issues.push(`measure ${cpl}ch < 45 — too narrow`);
  if (cpl > 75) issues.push(`measure ${cpl}ch > 75 — too wide to track`);
  return { verdict: issues.length ? "SLOP" : "CLEAN", reason: issues.join("; ") || `${cpl}ch — in the 45–75 sweet spot`, cpl, fix: issues.length ? measure(fontPx) : null };
}
export function focalPoints({ w, h }) {
  const P = (fx, fy) => ({ x: round(w * fx), y: round(h * fy) });
  return {
    thirds: [P(1/3, 1/3), P(2/3, 1/3), P(1/3, 2/3), P(2/3, 2/3)],
    golden: [P(0.382, 0.382), P(0.618, 0.382), P(0.382, 0.618), P(0.618, 0.618)],
  };
}
export function contentBreakpoints({ fontPx = 16, maxCpl = 75 } = {}) {
  const maxW = measure(fontPx, maxCpl);
  return { maxLineWidthPx: maxW, suggestMaxCh: maxCpl, note: `cap the text column at ~${maxW}px; beyond that, add columns` };
}
export function layout({ viewport = 1440, baseFont = 18, columns, split } = {}) {
  const g = grid({ viewport, ...(columns ? { maxCols: columns } : {}) });
  const sp = split ? computeSplit(g.inner, split) : null;
  const container = {
    maxWidth: g.inner,
    paddingInline: g.margin,
    note: "Set the container `max-width: maxWidth; margin-inline: auto; padding-inline: paddingInline`. Do NOT also cap width by `inner` and re-add `margin` — that double-counts.",
  };
  return {
    grid: g, container, measurePx: measure(baseFont), measureCh: 66, margins: g.margin,
    split: split ? { name: split, widths: sp } : null, whitespaceRatioTarget: 0.4,
  };
}
export function auditLayout({ containerWidth, fontPx = 16, gutter, margin, base = 8 } = {}) {
  const issues = [];
  if (containerWidth && fontPx) {
    const cpl = containerWidth / (0.5 * fontPx);
    if (cpl > 75) issues.push(`measure ${round(cpl, 1)}ch > 75`);
    if (cpl < 45) issues.push(`measure ${round(cpl, 1)}ch < 45`);
  }
  if (gutter != null && gutter % base !== 0) issues.push(`gutter ${gutter}px off the ${base}px grid`);
  if (margin != null && margin % base !== 0) issues.push(`margin ${margin}px off the ${base}px grid`);
  return { verdict: issues.length ? "SLOP" : "CLEAN", reason: issues.join("; ") || "measure in range; gutters/margins on-grid", fix: null };
}

// checkComposition(sectionGrammar, { pageKind }) — a STRUCTURAL validator over a section grammar
// ([{ role, heightShare, focalPoint, composition }]). It only flags signals that are RELIABLY a
// problem at the spec level and false-positive-free on well-authored layouts: trapped whitespace
// (unallocated vertical space), gross compositional monotony, and one section swallowing the page.
// It deliberately does NOT try to enforce "one section dominates by heightShare" — heightShare is a
// weak proxy for visual dominance (an app-shell canvas legitimately dominates; narrative chapters
// and alternating feature bands are legitimately equal; real dominance is carried by type scale and
// contrast). Focal-point enforcement stays where it belongs — the render-level squint test the
// design law prescribes. Pure + self-contained (inlines its chrome set so system.mjs keeps zero
// imports). `advisories` are nudges, not failures; `verdict` is SLOP only on a hard structural fault.
const COMPOSITION_CHROME = new Set([
  "nav", "footer", "topbar", "appbar", "statusbar", "masthead", "page-header", "header",
  "filter-bar", "table-head", "pagination", "plan-toggle", "reading-header",
]);
export function checkComposition(sectionGrammar = [], { pageKind = "marketing" } = {}) {
  const issues = [], advisories = [];
  const sections = Array.isArray(sectionGrammar) ? sectionGrammar.filter((s) => s && typeof s.role === "string") : [];
  const nonChrome = sections.filter((s) => !COMPOSITION_CHROME.has(s.role));
  const hs = (s) => (Number.isFinite(Number(s.heightShare)) ? Number(s.heightShare) : 0);
  const sorted = [...nonChrome].sort((a, b) => hs(b) - hs(a));
  const centrepiece = sorted[0] ? sorted[0].role : null;

  // 1 (HARD) — allocation: heightShares should tile the page. A real shortfall means unallocated
  // vertical space, which is exactly what renders as trapped whitespace — the original failure.
  // Only assessable when the grammar actually carries heightShare data: a roles-only grammar
  // ([{role:"hero"},{role:"features"}]) sums to 0 and would false-positive as 100% unallocated.
  const anyShares = sections.some((s) => Number.isFinite(Number(s.heightShare)));
  const total = sections.reduce((t, s) => t + hs(s), 0);
  if (sections.length && anyShares && total < 0.9) issues.push(`section heightShares sum to ${round(total, 2)} (<0.9) — ${Math.round((1 - total) * 100)}% of the page is unallocated and will read as trapped whitespace`);
  if (sections.length && !anyShares) advisories.push("no heightShare data — the trapped-whitespace and swallowing-block gates were skipped; pass heightShare (0-1 of page) per section to enable them");
  if (sections.length && anyShares && total > 1.15) advisories.push(`section heightShares sum to ${round(total, 2)} (>1.15) — shares are page-relative and should tile to ~1; renormalize so the gates stay meaningful`);

  // 2 (HARD) — a single non-chrome section swallowing >80% leaves everything else as a cramped
  // afterthought (true even for an app canvas). Below that, dominance is legitimate, not flagged.
  if (sorted[0] && hs(sorted[0]) > 0.8) issues.push(`section "${sorted[0].role}" takes ${Math.round(hs(sorted[0]) * 100)}% — one block swallows the page; give the rest room`);

  // 3 (ADVISORY) — gross monotony: 3+ consecutive non-chrome sections with an identical composition,
  // or EVERY non-chrome section sharing one focal side. Repetition aids scanning; sameness reads flat.
  let runComp = 1;
  for (let i = 1; i < nonChrome.length; i++) {
    runComp = nonChrome[i].composition && nonChrome[i].composition === nonChrome[i - 1].composition ? runComp + 1 : 1;
    if (runComp >= 3) { advisories.push(`${runComp} consecutive sections share composition "${nonChrome[i].composition}" — vary width/media/density so the rhythm isn't monotonous`); runComp = 1; }
  }
  const focals = new Set(nonChrome.map((s) => s.focalPoint).filter(Boolean));
  if (nonChrome.length >= 5 && focals.size === 1) advisories.push(`all ${nonChrome.length} sections share focal side "${[...focals][0]}" — alternate the eye's path at least once`);

  return {
    verdict: issues.length ? "SLOP" : "CLEAN",
    issues, advisories, centrepiece,
    reason: issues.length ? issues.join("; ") : (advisories.length ? `structurally sound; ${advisories.length} rhythm advisory` : `fully allocated, no block dominates, varied rhythm (centrepiece: ${centrepiece || "n/a"})`),
  };
}

// Motion + controls bucket: curves, durations, easing, animation audits, control sizing, z-index
export const CURVES = {
  "ease-out-quart": "cubic-bezier(.25,1,.5,1)",
  "ease-out-quint": "cubic-bezier(.22,1,.36,1)",
  "ease-out-expo": "cubic-bezier(.16,1,.3,1)",
};
export const motionTokens = () => ({ curves: CURVES, durations: { fast: 150, base: 250, slow: 400 }, exitFactor: 0.75 });
export const durationFor = (px) => Math.max(150, Math.min(500, Math.round(150 + Math.sqrt(Math.abs(px)) * 14)));
export const stagger = (i, base = 50) => i * base;
export function auditMotion({ durationMs, easing } = {}) {
  const issues = [];
  if (durationMs > 500) issues.push(`${durationMs}ms > 500ms for feedback — feels laggy`);
  const m = easing && String(easing).match(/cubic-bezier\(([^)]+)\)/);
  if (m) {
    const p = m[1].split(",").map(Number);
    if (p.length < 4 || p.some((n) => !Number.isFinite(n))) issues.push("malformed cubic-bezier — needs 4 numeric control values");
    else { const [, y1, , y2] = p; if (y1 < 0 || y1 > 1 || y2 < 0 || y2 > 1) issues.push("bounce/elastic easing (control point overshoots) — dated"); }
  }
  return { verdict: issues.length ? "SLOP" : "CLEAN", reason: issues.join("; ") || "duration + easing tasteful", fix: issues.length ? motionTokens() : null };
}
const DENSITY = { compact: 6, cozy: 10, comfortable: 14 };
export function controlSize(fontPx = 16, density = "cozy") {
  const padY = DENSITY[density] ?? DENSITY.cozy;
  const lineBox = Math.round(fontPx * 1.2);
  const height = Math.max(44, lineBox + padY * 2);
  return { fontPx, lineBox, paddingY: padY, height, hitTargetOk: height >= 44 };
}
export const zScale = () => ({ base: 0, dropdown: 1000, sticky: 1100, modal: 1300, toast: 1400 });
export function auditControl({ heightPx } = {}) {
  const ok = heightPx >= 44;
  return { verdict: ok ? "CLEAN" : "SLOP", reason: ok ? `${heightPx}px ≥ 44px min target` : `${heightPx}px < 44px — hit target too small`, fix: ok ? null : controlSize() };
}
