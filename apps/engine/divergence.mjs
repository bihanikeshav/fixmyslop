// apps/engine/divergence.mjs — cross-axis divergence primitives for the §4 explore wiring (pure
// math, no AI, no Math.random, no Date.now — deterministic; runs in a Cloudflare Worker, the
// browser, and the CLI).
//
// fingerprint.mjs already defines ONE combined distance D(a,b) across layout+type+hue (+a coarse
// materialTriad radius/shadow/motionFamily read). That combined distance is what the §3 within-set
// gate enforces — it's necessary but not sufficient for "the 4 directions read distinct on every
// axis": background and motion never feed it at all (deriveBackground/deriveMotion run AFTER
// styleGenome assembles the fingerprint), so two directions can pass withinSetOk while their
// backgrounds/motion are near-identical siblings from the same perturbation stream.
//
// This module generalizes the same idea (a cheap [0,1] weighted-component distance) to all 5 axes,
// exposing:
//   - a per-axis distance fn for layout / color / type (thin wrappers over fingerprint.mjs's
//     componentDistances — no new logic, just regrouped weights so callers can ask "how far apart
//     are just these two directions' LAYOUTS" instead of the blended whole-genome D)
//   - a per-axis distance fn for background / motion (genuinely new — no existing primitive reads
//     these genomes pairwise)
//   - a floor per axis + evaluateCrossAxis(), the test/report-facing summary (mirrors
//     fingerprint.mjs's evaluateSet shape)

import { componentDistances } from "./fingerprint.mjs";

const clamp01 = (n) => Math.min(1, Math.max(0, n));
const circularHueDiff = (ha, hb) => {
  const a = Number(ha), b = Number(hb);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 180;
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
};
const weightedMean = (pairs) => {
  let sum = 0, n = 0;
  for (const [w, v] of pairs) { sum += w * v; n += w; }
  return n ? clamp01(sum / n) : 0;
};

// ── layout / color / type — regroup fingerprint.mjs's per-component distances by axis. No new
// comparison logic: same componentDistances() the §3 combined D uses, just partitioned. ──────────
export function layoutAxisDistance(fpA, fpB) {
  const d = componentDistances(fpA || {}, fpB || {});
  return weightedMean([
    [3.0, d.layoutFamily], [2.0, d.canonicalOrder], [1.0, d.splitRatio],
    [1.0, d.whitespace], [0.5, d.headingScaleRatio], [0.5, d.columnCount], [0.5, d.darkBands],
  ]);
}
export function colorAxisDistance(fpA, fpB) {
  const d = componentDistances(fpA || {}, fpB || {});
  return d.paletteHue;
}
export function typeAxisDistance(fpA, fpB) {
  const d = componentDistances(fpA || {}, fpB || {});
  return weightedMean([[2.0, d.displayFont], [1.0, d.bodyFont]]);
}

// ── background — extract a small comparable fingerprint from a BackgroundGenome (background.mjs's
// deriveBackground output), then a weighted distance over it. Deliberately mirrors the SHAPE of
// fingerprint.mjs's componentDistances/distance pair: extraction is separate from distance so
// callers (tests, the report) can inspect the extracted fingerprint on its own. ────────────────────
export function backgroundFingerprint(bg) {
  if (!bg || !bg.field) return null;
  const p = bg.field.params || {};
  return {
    treatment: bg.field.treatment ?? null,
    group: bg.field.meta?.group ?? null,
    hue: Number.isFinite(Number(p.hue)) ? Number(p.hue) : null,
    chroma: Number.isFinite(Number(p.chroma)) ? Number(p.chroma) : null,
    lightness: Number.isFinite(Number(p.lightness)) ? Number(p.lightness) : null,
    glass: Object.values(bg.slots || {}).some((s) => s.treatment === "B5-glass"),
    band: !!bg.band,
  };
}
export function backgroundAxisDistance(a, b) {
  if (!a || !b) return 1;
  const hueD = a.hue != null && b.hue != null ? circularHueDiff(a.hue, b.hue) / 180 : 1;
  const chromaD = a.chroma != null && b.chroma != null ? Math.min(1, Math.abs(a.chroma - b.chroma) / 0.06) : 1;
  const lightD = a.lightness != null && b.lightness != null ? Math.min(1, Math.abs(a.lightness - b.lightness) / 0.15) : 1;
  // `treatment` carries the real signal (a swap-group collision — at most 3 taste-safe members —
  // still needs to register as SOME distance, since two directions sharing a field treatment but
  // pushing hue/chroma/lightness to opposite ends of their safe range should read as distinct
  // fields, not identical ones); `group` (always "field" for every treatment this axis emits) is
  // dropped — it was a dead weight that only diluted the real signal below the floor.
  return weightedMean([
    [1.0, a.treatment != null && a.treatment === b.treatment ? 0 : 1],
    [3.0, hueD], [1.25, chromaD], [1.25, lightD],
    [0.5, a.glass === b.glass ? 0 : 1],
    [0.5, a.band === b.band ? 0 : 1],
  ]);
}

// ── motion — same pattern over a MotionGenome (motion.mjs's deriveMotion output). ─────────────────
export function motionFingerprint(m) {
  if (!m) return null;
  return {
    intensity: Number.isFinite(Number(m.intensity)) ? Number(m.intensity) : null,
    revealTreatment: m.reveal?.treatment ?? null,
    enterEasing: m.defaults?.enterEasing ?? null,
    snap: !!m.scroll?.snap?.enabled,
    parallax: !!m.scroll?.parallax?.enabled,
    marquee: !!m.scroll?.marquee?.enabled,
    pin: !!m.scroll?.sticky?.pin,
    scrollbarCustom: !!m.scrollbar?.custom,
  };
}
export function motionAxisDistance(a, b) {
  if (!a || !b) return 1;
  // intensity/revealTreatment/enterEasing are the primary carriers (deliberately spread by
  // motion.mjs's applyIntensitySpread/applyRevealSpread/applyEasingSpread). The 5 boolean scroll
  // features are frequently false/false for BOTH directions (snap/parallax/pin are rare,
  // low-probability perturbation draws) — kept as signal when they DO differ, but weighted low so
  // 5 simultaneous "both off" ties don't drown out the 3 axes that actually carry the direction's
  // character (mirrors background.mjs's fix: don't let dead-equal structural fields dilute the
  // real signal below the floor).
  const intensityD = a.intensity != null && b.intensity != null ? Math.min(1, Math.abs(a.intensity - b.intensity) / 4) : 1;
  return weightedMean([
    [4.0, intensityD],
    [1.5, a.revealTreatment != null && a.revealTreatment === b.revealTreatment ? 0 : 1],
    [1.5, a.enterEasing != null && a.enterEasing === b.enterEasing ? 0 : 1],
    [0.3, a.snap === b.snap ? 0 : 1],
    [0.3, a.parallax === b.parallax ? 0 : 1],
    [0.3, a.marquee === b.marquee ? 0 : 1],
    [0.3, a.pin === b.pin ? 0 : 1],
    [0.3, a.scrollbarCustom === b.scrollbarCustom ? 0 : 1],
  ]);
}

// ── per-axis floors. layout/color/type floors are report-facing proxies for the hard rules
// withinSetOk already enforces (no shared layoutFamily, no shared display font, hue>=40°) — those
// hard rules are the REAL enforcement for those 3 axes; the floors here exist so
// evaluateCrossAxis() can report all 5 axes uniformly. background/motion have no other enforcement
// anywhere in the pipeline, so BACKGROUND_AXIS_FLOOR/MOTION_AXIS_FLOOR are the actual gate the
// explore assembly (explore.mjs) enforces via the bounded reroll. ──────────────────────────────────
export const LAYOUT_AXIS_FLOOR = 0.30;
export const COLOR_AXIS_FLOOR = 40 / 180; // matches the hard hue>=40° rule
export const TYPE_AXIS_FLOOR = 0.50;      // clears once display font differs (2/3 weight => 0.667)
export const BACKGROUND_AXIS_FLOOR = 0.30;
export const MOTION_AXIS_FLOOR = 0.30;

export const AXIS_FLOORS = {
  layout: LAYOUT_AXIS_FLOOR, color: COLOR_AXIS_FLOOR, type: TYPE_AXIS_FLOOR,
  background: BACKGROUND_AXIS_FLOOR, motion: MOTION_AXIS_FLOOR,
};

/**
 * evaluateCrossAxis(directions) → { ok, minByAxis, violations }
 * `directions`: exploreDirections() output's `.directions` array. Reads each direction's
 * `.fingerprint` (layout/color/type) and `.genome.background` / `.genome.motion.design`
 * (background/motion). Snapshot-testable summary, mirrors fingerprint.mjs's evaluateSet() shape —
 * used by the divergence tests and the report script, not by production code paths.
 */
export function evaluateCrossAxis(directions) {
  const fps = directions.map((d) => d.fingerprint);
  const bgFps = directions.map((d) => backgroundFingerprint(d.genome?.background));
  const motionFps = directions.map((d) => motionFingerprint(d.genome?.motion?.design));
  const AXES = [
    ["layout", layoutAxisDistance, fps],
    ["color", colorAxisDistance, fps],
    ["type", typeAxisDistance, fps],
    ["background", backgroundAxisDistance, bgFps],
    ["motion", motionAxisDistance, motionFps],
  ];
  const minByAxis = {};
  const violations = [];
  for (const [axis, distFn, series] of AXES) {
    let min = Infinity;
    for (let i = 0; i < series.length; i++) {
      for (let j = i + 1; j < series.length; j++) {
        const d = distFn(series[i], series[j]);
        min = Math.min(min, d);
        if (d < AXIS_FLOORS[axis]) violations.push({ axis, i, j, d });
      }
    }
    minByAxis[axis] = Number.isFinite(min) ? min : null;
  }
  return { ok: violations.length === 0, minByAxis, violations };
}
