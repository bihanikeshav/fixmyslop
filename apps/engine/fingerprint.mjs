// apps/engine/fingerprint.mjs — Subsystem 3c: the §3 fingerprint distance D(a,b) + threshold
// helpers (pure math, no AI, no Math.random, no Date.now — runs in a Cloudflare Worker, the
// browser, and the CLI). Implements spec §3 (docs/layout-explorer-spec.md).
//
// Consumes the ADDITIVE fingerprint fields genome.mjs now attaches to every StyleGenome:
// {layoutFamily, canonicalOrder, fontPair:[display,body], paletteHue, splitRatio, whitespace,
//  headingScaleRatio, columnCount, darkBands, radiusLanguage/shadowLanguage/motionFamily}.
// This module never mutates a fingerprint — every fn here is a pure read.

const WEIGHTS = {
  layoutFamily: 3.0,
  canonicalOrder: 2.0,
  displayFont: 2.0,
  bodyFont: 1.0,
  paletteHue: 2.0,
  splitRatio: 1.0,
  whitespace: 1.0,
  headingScaleRatio: 0.5,
  columnCount: 0.5,
  darkBands: 0.5,
  materialTriad: 0.5, // radius+shadow+motion, mean equal?0:1
};
const TOTAL_WEIGHT = Object.values(WEIGHTS).reduce((a, w) => a + w, 0); // 14

const clamp01 = (n) => Math.min(1, Math.max(0, n));
const numOrNull = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

function fontOf(fp, idx) {
  const pair = Array.isArray(fp?.fontPair) ? fp.fontPair : [];
  return pair[idx] ?? null;
}

// Normalized LCS-based order distance over canonical role sequences: 1 − |LCS| / max(len_a,len_b).
// Identical sequences → 0. Disjoint/short-common sequences → close to 1.
function lcsLength(a, b) {
  const n = a.length, m = b.length;
  if (!n || !m) return 0;
  const dp = new Array(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    let prevDiag = 0;
    for (let j = 1; j <= m; j++) {
      const temp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prevDiag + 1 : Math.max(dp[j], dp[j - 1]);
      prevDiag = temp;
    }
  }
  return dp[m];
}
function canonicalOrderDistance(a, b) {
  const oa = Array.isArray(a?.canonicalOrder) ? a.canonicalOrder : [];
  const ob = Array.isArray(b?.canonicalOrder) ? b.canonicalOrder : [];
  const maxLen = Math.max(oa.length, ob.length);
  if (!maxLen) return 0;
  const lcs = lcsLength(oa, ob);
  return clamp01(1 - lcs / maxLen);
}

function circularHueDiff(ha, hb) {
  const a = Number(ha), b = Number(hb);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 1; // unknown hue = maximally different
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}

function hammingDistance(sa, sb) {
  const a = String(sa || ""), b = String(sb || "");
  const len = Math.max(a.length, b.length);
  if (!len) return 0;
  let mismatches = 0;
  for (let i = 0; i < len; i++) {
    const ca = i < a.length ? a[i] : "0";
    const cb = i < b.length ? b[i] : "0";
    if (ca !== cb) mismatches++;
  }
  return mismatches / len;
}

// ── per-component distances, per the §3 table ───────────────────────────────────────────────────
export function componentDistances(a, b) {
  const layoutFamily = a?.layoutFamily != null && b?.layoutFamily != null && a.layoutFamily === b.layoutFamily ? 0 : 1;
  const canonicalOrder = canonicalOrderDistance(a, b);
  const displayFont = fontOf(a, 0) != null && fontOf(b, 0) != null && fontOf(a, 0) === fontOf(b, 0) ? 0 : 1;
  const bodyFont = fontOf(a, 1) != null && fontOf(b, 1) != null && fontOf(a, 1) === fontOf(b, 1) ? 0 : 1;
  const paletteHue = clamp01(circularHueDiff(a?.paletteHue, b?.paletteHue) / 180);
  const sa = numOrNull(a?.splitRatio), sb = numOrNull(b?.splitRatio);
  const splitRatio = sa != null && sb != null ? Math.min(1, Math.abs(sa - sb) / 0.3) : 1;
  const wa = numOrNull(a?.whitespace), wb = numOrNull(b?.whitespace);
  const whitespace = wa != null && wb != null ? Math.min(1, Math.abs(wa - wb) / 0.4) : 1;
  const ha = numOrNull(a?.headingScaleRatio), hb = numOrNull(b?.headingScaleRatio);
  const headingScaleRatio = ha != null && hb != null ? Math.min(1, Math.abs(ha - hb) / 2) : 1;
  const ca = numOrNull(a?.columnCount), cb = numOrNull(b?.columnCount);
  const columnCount = ca != null && cb != null ? Math.min(1, Math.abs(ca - cb) / 4) : 1;
  const darkBands = hammingDistance(a?.darkBands, b?.darkBands);
  const triadKeys = ["radiusLanguage", "shadowLanguage", "motionFamily"];
  const triadEq = triadKeys.map((k) => (a?.[k] != null && b?.[k] != null && a[k] === b[k] ? 0 : 1));
  const materialTriad = triadEq.reduce((s, v) => s + v, 0) / triadKeys.length;
  return {
    layoutFamily, canonicalOrder, displayFont, bodyFont, paletteHue,
    splitRatio, whitespace, headingScaleRatio, columnCount, darkBands, materialTriad,
  };
}

/**
 * D(a, b) ∈ [0,1] — the §3 weighted fingerprint distance. `a`/`b` are StyleGenome `.fingerprint`
 * objects (or bare fingerprint-shaped objects). D(x, x) = 0. Missing/incomparable components
 * count as maximally different (distance 1) rather than throwing or being skipped — a genome that
 * lacks a display font, say, should never look "close" to one that has one just because the field
 * was absent.
 */
export function distance(a, b) {
  if (a === b) return 0;
  const d = componentDistances(a || {}, b || {});
  let sum = 0;
  for (const key of Object.keys(WEIGHTS)) sum += WEIGHTS[key] * d[key];
  return clamp01(sum / TOTAL_WEIGHT);
}

export const D = distance;
export { TOTAL_WEIGHT, WEIGHTS };

// ── §3 threshold helpers ─────────────────────────────────────────────────────────────────────────
const WITHIN_SET_MIN_D = 0.45;
const VS_RECENT_MIN_D = 0.30;
const RELAXED_FLOOR_D = 0.35;

// hard rules for two directions shown together: no shared layoutFamily, no shared display font,
// hue separation ≥40°.
export function hardRulesPass(a, b) {
  if (a?.layoutFamily != null && b?.layoutFamily != null && a.layoutFamily === b.layoutFamily) return false;
  const da = fontOf(a, 0), db = fontOf(b, 0);
  if (da != null && db != null && da === db) return false;
  if (circularHueDiff(a?.paletteHue, b?.paletteHue) < 40) return false;
  return true;
}

/** withinSetOk(a, b) — pairwise gate for two of the 4 shown directions: D≥0.45 AND hard rules. */
export function withinSetOk(a, b) {
  return distance(a, b) >= WITHIN_SET_MIN_D && hardRulesPass(a, b);
}

/**
 * vsRecentOk(candidate, recentFingerprints) — D≥0.30 against every recent fingerprint, and never
 * an exact repeat of (layoutFamily, sectionOrderHash, display font) as a triple.
 */
export function vsRecentOk(candidate, recentFingerprints = []) {
  for (const fp of recentFingerprints || []) {
    if (!fp) continue;
    if (distance(candidate, fp) < VS_RECENT_MIN_D) return false;
    const sameTriple = candidate?.layoutFamily != null
      && candidate.layoutFamily === fp.layoutFamily
      && candidate.sectionOrderHash != null
      && candidate.sectionOrderHash === fp.sectionOrderHash
      && fontOf(candidate, 0) != null
      && fontOf(candidate, 0) === fontOf(fp, 0);
    if (sameTriple) return false;
  }
  return true;
}

/**
 * evaluateSet(fingerprints, recentFingerprints=[]) → { ok, minPairwiseD, minVsRecentD, violations }
 * — a snapshot-testable summary of whether a shown set of directions satisfies §3's thresholds.
 * Useful for the calibration pass (spec build-order step 7) and for tests.
 */
export function evaluateSet(fingerprints, recentFingerprints = []) {
  const violations = [];
  let minPairwiseD = Infinity;
  for (let i = 0; i < fingerprints.length; i++) {
    for (let j = i + 1; j < fingerprints.length; j++) {
      const d = distance(fingerprints[i], fingerprints[j]);
      minPairwiseD = Math.min(minPairwiseD, d);
      if (!withinSetOk(fingerprints[i], fingerprints[j])) violations.push({ i, j, d, kind: "within-set" });
    }
  }
  let minVsRecentD = Infinity;
  for (const fp of fingerprints) {
    for (const rfp of recentFingerprints) {
      const d = distance(fp, rfp);
      minVsRecentD = Math.min(minVsRecentD, d);
    }
    if (!vsRecentOk(fp, recentFingerprints)) violations.push({ fp, kind: "vs-recent" });
  }
  return {
    ok: violations.length === 0,
    minPairwiseD: Number.isFinite(minPairwiseD) ? minPairwiseD : null,
    minVsRecentD: Number.isFinite(minVsRecentD) ? minVsRecentD : null,
    violations,
  };
}

export { WITHIN_SET_MIN_D, VS_RECENT_MIN_D, RELAXED_FLOOR_D };
