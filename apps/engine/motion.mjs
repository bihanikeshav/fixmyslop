// apps/engine/motion.mjs — Subsystem 3e: the MOTION / INTERACTION axis (pure math, no AI, no
// Math.random, no Date.now — deterministic; runs in a Cloudflare Worker, the browser, and the
// CLI). Sibling of background.mjs: a hand-authored treatment taxonomy (select) + slop gates
// (M1-M16) + seeded perturbation (the MOTION_PERTURB_V1 always-draw contract), instead of
// reinventing the wiring pattern. Spec: docs/motion-interaction-taxonomy.md.
//
// `deriveMotion(family, iv, streamSeed)` → MotionGenome. `family` is a LAYOUT_FAMILIES entry
// (layout-families.mjs) — we read `family.pageKind` and `family.materialSlots` only, no import
// needed. `iv` is the same intent-values bag every other axis consumes ({materiality, energy,
// layoutVariance, contentDensity, contrastPreference, craft}), PLUS the two optional additions
// the background axis reads (`iv.theme`, `iv.hue`) — hue only matters here for the (authored-only)
// scrollbar tint, mirroring how background anchors its field on the direction's own hue.
//
// `energy` is the MOTION_INTENSITY driver (energy·10 → the 1-10 dial from tasteskill); `craft`
// gates whether the rarer, higher-commitment treatments (a single deliberate scroll-pin, a custom
// scrollbar) are even eligible; `layoutVariance` sets the perturbation amplitude, same formula as
// every other axis: amp = 0.35 + 0.65·layoutVariance.
//
// `streamSeed == null` → no perturbation: deterministic authored defaults, zero RNG draws (mirrors
// background.mjs / perturb.mjs's amplitude-0 passthrough / "no-seed path stays stable" contract).

import { mulberry32 } from "./engine.mjs";
import { hashToUint32 } from "./intent.mjs";

const clamp01 = (n, fallback = 0.5) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.min(1, Math.max(0, x));
};
const clampRange = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const round = (n, d = 4) => Math.round(n * 10 ** d) / 10 ** d;
const wrapHue = (h) => ((Number(h) % 360) + 360) % 360;

// ── §1 taxonomy — treatment metadata (docs/motion-interaction-taxonomy.md §1). One entry per
// treatment. Grouped exactly as the doc groups them: A field/scroll-page-level, B reveal &
// entrance, C micro-interaction, D transition & continuity, E cross-cutting (the token-system /
// discipline rows E1-E4 are policy, not independently selectable treatments — `policy: true`
// marks them, mirroring how background.mjs marks B1-B4 `owned` by a different module). ──────────
export const MOTION_TREATMENTS = {
  "A1-smooth-scroll": { group: "scroll", doc: "A1", taste: "CSS scroll-behavior:smooth or low-lerp Lenis; never a hand-rolled window scroll listener", slop: "heavy lerp / scroll-jacking via a hand-rolled driver (M1)" },
  "A2-scroll-snap": { group: "scroll", doc: "A2", taste: "proximity snap on a genuinely sectioned full-height narrative", slop: "mandatory snap traps the user (M1)" },
  "A3-sticky-pinned": { group: "scroll", doc: "A3", taste: "sticky nav for orientation; at most ONE isolated deliberate pin beat", slop: "stacked pins turn the page into a scroll-jacked slideshow (M1)" },
  "A4-parallax": { group: "scroll", doc: "A4", gatedOffByDefault: true, taste: "one subtle background layer, ratio <=0.2", slop: "whole-page / multi-layer parallax as the site's personality (M2)" },
  "A5-marquee": { group: "scroll", doc: "A5", gatedOffByDefault: true, taste: "at most ONE per page, slow, pause-on-hover, purpose-driven", slop: ">=2 marquees / fast dizzying speed (M12)" },
  "A6-hero-fits-viewport": { group: "scroll", doc: "A6", taste: "hero heightShare ~0.9-1.05x viewport, no fold-cut content", slop: "spill past 100vh or one headline eating the whole fold" },
  "B1-scroll-reveal": { group: "reveal", doc: "B1", taste: "secondary polish: fade + small slide, fires once, stated purpose", slop: "core content gated invisible-until-scroll (M9, HARD)" },
  "B2-loading-enter": { group: "reveal", doc: "B2", taste: "one well-orchestrated hero entrance; content present in DOM, merely animates in", slop: "the standout that doesn't render without JS/scroll (M14, HARD)" },
  "B3-custom-scrollbar": { group: "reveal", doc: "B3", taste: "thin, tinted to the surface, subtle hover", slop: "thick/high-contrast/neon scrollbar as decoration (M16)" },
  "C1-hover-feedback": { group: "micro", doc: "C1", taste: "subtle lift/scale + color shift, only above MOTION_INTENSITY 5, desktop-only", slop: "image hover scale/rotate (M10); hover claimed on touch" },
  "C2-press-active": { group: "micro", doc: "C2", taste: "translateY(1-2px) or scale(0.98), fast, universal tactile primitive", slop: "no press feedback at all (dead button)" },
  "C3-focus-state": { group: "micro", doc: "C3", taste: "visible high-contrast focus ring, never removed without replacement", slop: "outline:none with no replacement (M15, HARD a11y)" },
  "C4-toggle-feedback": { group: "micro", doc: "C4", taste: "smooth slide + color, 200-300ms, check-draw", slop: "bounce/elastic spring on a toggle (M5)" },
  "C5-cursor-follower": { group: "micro", doc: "C5", gatedOffByDefault: true, taste: "a branded custom cursor / subtle magnetism on a portfolio-type page", slop: "gratuitous cursor followers on an ordinary page (M11)", notImplemented: true },
  "D1-page-transition": { group: "transition", doc: "D1", taste: "quick crossfade / shared-element handoff, one consistent transition", slop: "long (>500ms) blocking route transitions", notMinable: true },
  "D2-section-transition": { group: "transition", doc: "D2", taste: "overflow-safe expand/collapse (transform/clip, not raw height)", slop: "animating raw height/padding/margin (M7)" },
  "D3-state-transition": { group: "transition", doc: "D3", taste: "fade+slide instead of instant pop; gentle success scale-pulse", slop: "error shake using bounce/elastic (M5)" },
  "E1-easing-token-system": { group: "cross-cutting", doc: "E1", policy: true, taste: "ease-out-quart/quint/expo for enters; emphasized-accelerate for exits; springs ~90-170 stiffness / 17-22 damping by intensity", slop: "linear (M4) / bounce-elastic (M5)" },
  "E2-duration-discipline": { group: "cross-cutting", doc: "E2", policy: true, taste: "100-150 feedback / 200-300 state / 300-500 layout / 500-800 entrance", slop: "over-long durations feel sluggish (M6)" },
  "E3-animation-restraint": { group: "cross-cutting", doc: "E3", policy: true, taste: "one signature moment + a thin feedback layer; vary responses", slop: "animate-everything fatigue; ambient pulse/float/blob decor (M13)" },
  "E4-reduced-motion": { group: "cross-cutting", doc: "E4", policy: true, hard: true, taste: "every treatment collapses to static/instant under prefers-reduced-motion", slop: "any motion with no reduced-motion fallback (M8, HARD)" },
};

// ── §3 danger-zone table (docs/motion-interaction-taxonomy.md §3), M1-M16, for reference/report
// use. `active` rows are the ones this module actively gates. M3 (autoplay) and M11 (cursor
// follower) are HARD-forced-off invariants rather than clamps, since we don't emit either
// treatment at all yet (video-autoplay attrs and JS-driven cursor followers are both flagged
// authored-only/not-implemented in the taxonomy doc's §5 coverage table). ─────────────────────────
export const MOTION_SLOP_TABLE = {
  M1: { name: "Scroll-jacking (mandatory snap / heavy smooth-scroll / hand-rolled scroll driver)", active: true },
  M2: { name: "Whole-page / multi-layer parallax", active: true },
  M3: { name: "Autoplay video / motion", active: true, note: "forced off (crossCutting.autoplayVideo); not an emittable treatment yet" },
  M4: { name: "Linear easing on a discrete transition", active: true },
  M5: { name: "Bounce / elastic easing (overshoot cubic-bezier / low-damping spring)", active: true },
  M6: { name: "Over-long durations", active: true },
  M7: { name: "Animating layout props (width/height/padding/margin) instead of transform/opacity", active: true },
  M8: { name: "Motion ignoring prefers-reduced-motion", active: true, note: "HARD — always forced true" },
  M9: { name: "Core content gated on reveal (opacity:0 hero/heading/body until scroll)", active: true, note: "HARD — reveal.gatesCoreContent always false" },
  M10: { name: "Image hover scale/rotate", active: true },
  M11: { name: "Gratuitous cursor follower / magnetism on an ordinary page", active: true, note: "forced off; C5 not implemented (JS-driven, no CSS signature to select from)" },
  M12: { name: ">=2 marquees on one page", active: true },
  M13: { name: "Animate-everything fatigue (restraint / hover-below-intensity-5 / too many ambient scroll features)", active: true },
  M14: { name: "The standout that doesn't render", active: true, note: "HARD — same enforcement as M9" },
  M15: { name: "Removed focus ring", active: true, note: "HARD a11y — focus ring always present" },
  M16: { name: "Over-styled / neon custom scrollbar", active: true, note: "width forced 'thin'; hue jitter only, never widened" },
};

// ── slot/pagekind classifiers ────────────────────────────────────────────────────────────────
const NARRATIVE_PAGEKINDS = new Set(["story", "marketing", "brand"]);
const ASSET_SLOT_RE = /figure|mosaic|marquee-visual|image|photo|diagram|frame|detail/i;
const MARQUEE_SLOT_RE = /marquee|ticker|proof-rail|logo/i;
const ROW_HOVER_SLOT_RE = /row-hover|hover-state/i;
const CTA_SLOT_RE = /cta|accent|signal|selection|status/i;

// ── taste-safe easing vocabulary (imp/animate + tasteskill, docs §2 principle 3) ────────────────
const EASING_SET = [
  "cubic-bezier(0.16,1,0.3,1)",   // ease-out-expo — tasteskill default
  "cubic-bezier(0.22,1,0.36,1)",  // ease-out-quint
  "cubic-bezier(0.25,1,0.5,1)",   // ease-out-quart
];
const DEFAULT_ENTER_EASING = EASING_SET[0];
// Exits should ACCELERATE away (ease-in), not decelerate like enters — Material's "emphasized
// accelerate". Control-point y stays in [0,1] so the M4/M5 overshoot detector passes it. (The
// enter/reveal rotation pool EASING_SET stays at its 3 locked ease-out members — never widened.)
const DEFAULT_EXIT_EASING = "cubic-bezier(0.3,0,0.8,0.15)";

const REVEAL_TREATMENTS = ["fade-slide", "fade-only", "mask-reveal"];

// ── spring presets by MOTION_INTENSITY — snappier (higher stiffness, lower damping) as energy
// rises, but damping floored at 17 so nothing ever bounces (well inside the M5 damping>=15 gate;
// stiffness stays <=180). Replaces the one hardcoded {100,20} so micro-interactions vary in weight
// with the intent instead of feeling identically springy everywhere. ────────────────────────────
const SPRING_PRESETS = [
  { maxIntensity: 3, stiffness: 90, damping: 22 },   // gentle — calm, weighty
  { maxIntensity: 6, stiffness: 120, damping: 20 },  // responsive — the old default's neighborhood
  { maxIntensity: 8, stiffness: 150, damping: 18 },  // snappy
  { maxIntensity: 10, stiffness: 170, damping: 17 }, // stiff — lively, still non-overshooting
];
function springForIntensity(intensity) {
  const p = SPRING_PRESETS.find((x) => intensity <= x.maxIntensity) || SPRING_PRESETS[SPRING_PRESETS.length - 1];
  return { stiffness: p.stiffness, damping: p.damping };
}

// duration bands, docs §2 principle 4 / E2 (ms)
const DURATION_BOUNDS = {
  feedback: [80, 500],
  state: [120, 650],
  layout: [150, 700],
  entrance: [350, 800],
};
const STAGGER_BOUNDS = [40, 180];

// ── M4/M5 detector — "linear" or an overshoot cubic-bezier (control-point y outside [0,1], the
// signature of a bounce/elastic curve). Returns the M-row id that fired, or null if safe. ────────
function bannedEasingReason(token) {
  if (typeof token !== "string") return "M5";
  const t = token.trim().toLowerCase();
  if (t === "linear") return "M4";
  const m = t.match(/cubic-bezier\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/);
  if (m) {
    const y1 = parseFloat(m[2]);
    const y2 = parseFloat(m[4]);
    if (y1 > 1.0001 || y1 < -0.0001 || y2 > 1.0001 || y2 < -0.0001) return "M5";
  }
  return null;
}

// deterministic default hue (no RNG), same pattern as background.mjs's defaultHue — used only
// when the caller hasn't supplied iv.hue (motion only spends this on the scrollbar tint).
function defaultHue(family) {
  return hashToUint32(`motion-hue:${family.name}`) % 360;
}

// ── base (unperturbed) selection — pure fn of dials + family, no RNG. Mirrors
// layout-families.mjs deriveMaterial / background.mjs selectFieldTreatment. ──────────────────────
function selectDefaults() {
  return {
    enterEasing: DEFAULT_ENTER_EASING,
    exitEasing: DEFAULT_EXIT_EASING,
    springConfig: { stiffness: 100, damping: 20 },
    durations: { feedback: 150, state: 250, layout: 400, entrance: 650 },
    stagger: 80,
    respectsReducedMotion: true,     // E4/M8 — HARD, never perturbed
    animateOnly: ["transform", "opacity"], // §2 principle 2 / M7 — HARD, never perturbed
  };
}

function selectScroll(family, iv, intensity) {
  const hasMarqueeSlot = (family.materialSlots || []).some((s) => MARQUEE_SLOT_RE.test(s));
  const eligibleSnap = NARRATIVE_PAGEKINDS.has(family.pageKind) && iv.layoutVariance >= 0.4;
  return {
    smooth: { enabled: true, technique: "css", lerp: 0.1, hijacksWheel: false },
    snap: { enabled: eligibleSnap, axis: "y", mode: "proximity", align: "start" },
    sticky: { enabled: true, target: "nav", pin: false, pinTarget: null, pinSpacing: false, scrub: null },
    parallax: { enabled: false, layers: 1, ratio: 0.12, axis: "y" },
    marquee: hasMarqueeSlot && intensity >= 4
      ? { enabled: true, speed: "slow", direction: "left", pauseOnHover: true, count: 1 }
      : { enabled: false, speed: "slow", direction: "left", pauseOnHover: true, count: 0 },
  };
}

// A6 — minable now from geometry (hero heightShare vs viewport.height); a HARD structural
// guarantee, never a perturbable dial.
function selectHeroFit() {
  return { targetHeightShare: 1.0, tolerance: 0.1 };
}

function selectReveal(intensity) {
  const enabled = intensity >= 2;
  // choreography of a multi-item reveal (motion-primitives "Animated Group"): calmer intents
  // cascade one-by-one; high-energy intents fire together for impact. Pure fn of intensity.
  const choreography = intensity >= 8 ? "simultaneous" : intensity >= 6 ? "wave" : "cascade";
  return {
    treatment: enabled ? "fade-slide" : "none",
    distance: 16,             // <=24px, docs §4
    duration: 650,            // 500-800ms scroll-entry band
    easing: DEFAULT_ENTER_EASING,
    stagger: 80,              // 60-120ms
    choreography,             // "cascade" | "wave" | "simultaneous"
    once: true,
    viewportAmount: 0.3,
    gatesCoreContent: false,  // M9/M14 — HARD, never perturbed
  };
}

function selectScrollbar(iv, hue) {
  return {
    custom: iv.craft >= 0.5,
    width: "thin",
    thumbHue: hue,
    trackHue: hue,
    thumbChroma: 0.01,
    hoverBrighten: true,
  };
}

function selectMicro(family, iv, intensity) {
  // scale feedback speed with intensity: high-energy designs feel rushed at a fixed 200/120ms,
  // low-energy ones feel ponderous. Both stay inside the gate bands (hover 100-400, press 80-250).
  const hoverDuration = Math.round(clampRange(150 + intensity * 15, 100, 400));
  const pressDuration = Math.round(clampRange(100 + intensity * 8, 80, 250));
  const micro = {};
  for (const name of family.materialSlots || []) {
    const isAsset = ASSET_SLOT_RE.test(name);
    const isRowHover = ROW_HOVER_SLOT_RE.test(name);
    const isCta = CTA_SLOT_RE.test(name);
    const hoverEligible = intensity > 5 && (isCta || isRowHover || !isAsset);
    micro[name] = {
      hover: {
        enabled: hoverEligible,
        transform: hoverEligible ? "translateY(-2px)" : null,
        duration: hoverDuration, easing: DEFAULT_ENTER_EASING, desktopOnly: true,
      },
      press: { enabled: true, transform: "scale(0.98)", duration: pressDuration, easing: DEFAULT_ENTER_EASING },
      focus: { enabled: true, ring: true, ringColorToken: "accent", width: 2, offset: 2 },
      toggle: (isRowHover || isCta)
        ? { enabled: true, duration: 250, easing: DEFAULT_ENTER_EASING }
        : { enabled: false, duration: 250, easing: DEFAULT_ENTER_EASING },
    };
  }
  return micro;
}

function selectTransitions() {
  return {
    page: { type: "crossfade", duration: 350, easing: DEFAULT_ENTER_EASING },
    section: { technique: "clip-grid-rows", duration: 350, easing: DEFAULT_ENTER_EASING },
    state: { type: "fade-slide", duration: 250, easing: DEFAULT_ENTER_EASING },
  };
}

// ── cross-axis divergence spread (deterministic, no RNG) — sibling of background.mjs's
// applyTreatmentSpread: apps/engine/divergence.mjs's motionAxisDistance is what explore.mjs
// enforces a floor on across the 4 directions. Rather than rejection-resample the perturbation
// seed until intensity/reveal happen to spread, offset them by the caller's direction index —
// `iv.spreadIndex` (0-based) / `iv.spreadCount` (how many directions total), both optional and
// omitted by every non-explore caller, so the historical no-seed/no-spread behavior (and every
// existing test) is unaffected. The intensity offset is capped at +/-2 around THIS intent's own
// energy-derived intensity (never an absolute jump to a fixed high/low value) — spread happens
// AROUND the intent, never away from it (task point 3: a calm intent's 4 directions all still read
// calm, just distinct from each other). Reveal-treatment rotation only ever picks among
// REVEAL_TREATMENTS, the same taste-safe set perturbMotion's own swap draw picks from.
function applyIntensitySpread(intensity, iv) {
  if (!Number.isFinite(iv.spreadIndex) || !Number.isFinite(iv.spreadCount) || iv.spreadCount < 2) return intensity;
  const center = Math.floor((iv.spreadCount - 1) / 2);
  const offset = clampRange(Math.trunc(iv.spreadIndex) - center, -2, 2);
  return clampRange(Math.round(intensity + offset), 1, 10);
}
function applyRevealSpread(treatment, iv) {
  if (treatment === "none" || !Number.isFinite(iv.spreadIndex)) return treatment;
  const base = REVEAL_TREATMENTS.indexOf(treatment);
  const idx = ((base < 0 ? 0 : base) + Math.max(0, Math.trunc(iv.spreadIndex))) % REVEAL_TREATMENTS.length;
  return REVEAL_TREATMENTS[idx];
}
// EASING_SET (and REVEAL_TREATMENTS) top out at 3 taste-safe members, so with 4 directions this
// rotation can't avoid one collision (index 3 always lands back on index 0's pick — pigeonhole).
// That's fine: perturbMotion's own RNG-gated easing swap (draws 7/8) already covers the SAME
// token-system move probabilistically; this just makes it happen DETERMINISTICALLY instead of
// leaving 4 directions to coincidentally share a token by chance, same reasoning as
// applyTreatmentSpread in background.mjs.
function applyEasingSpread(iv) {
  if (!Number.isFinite(iv.spreadIndex)) return null;
  return EASING_SET[Math.max(0, Math.trunc(iv.spreadIndex)) % EASING_SET.length];
}

function selectMotion(family, iv, hue) {
  const baseIntensity = clampRange(Math.round(iv.energy * 10), 1, 10);
  const intensity = applyIntensitySpread(baseIntensity, iv);
  const reveal = selectReveal(intensity);
  reveal.treatment = applyRevealSpread(reveal.treatment, iv);
  const defaults = selectDefaults();
  defaults.springConfig = springForIntensity(intensity); // weight tracks the intent, not a constant
  const spreadEasing = applyEasingSpread(iv);
  const transitions = selectTransitions();
  if (spreadEasing) {
    defaults.enterEasing = spreadEasing;
    reveal.easing = spreadEasing;
    transitions.page.easing = spreadEasing;
    transitions.section.easing = spreadEasing;
    transitions.state.easing = spreadEasing;
  }
  return {
    defaults,
    scroll: selectScroll(family, iv, intensity),
    heroFit: selectHeroFit(),
    reveal,
    scrollbar: selectScrollbar(iv, hue),
    micro: selectMicro(family, iv, intensity),
    transitions,
    crossCutting: { autoplayVideo: false, cursorFollower: false },
    intensity,
  };
}

function cloneMotion(base) {
  const m = {
    defaults: { ...base.defaults, durations: { ...base.defaults.durations }, springConfig: { ...base.defaults.springConfig } },
    scroll: {
      smooth: { ...base.scroll.smooth },
      snap: { ...base.scroll.snap },
      sticky: { ...base.scroll.sticky },
      parallax: { ...base.scroll.parallax },
      marquee: { ...base.scroll.marquee },
    },
    heroFit: { ...base.heroFit },
    reveal: { ...base.reveal },
    scrollbar: { ...base.scrollbar },
    micro: {},
    transitions: {
      page: { ...base.transitions.page },
      section: { ...base.transitions.section },
      state: { ...base.transitions.state },
    },
    crossCutting: { ...base.crossCutting },
    intensity: base.intensity,
  };
  for (const [name, slot] of Object.entries(base.micro)) {
    m.micro[name] = { hover: { ...slot.hover }, press: { ...slot.press }, focus: { ...slot.focus }, toggle: { ...slot.toggle } };
  }
  return m;
}

// ── MOTION_PERTURB_V1 — determinism contract mirroring perturb.mjs's PERTURB_V1 and
// background.mjs's BACKGROUND_PERTURB_V1: every draw below is taken from the mulberry32(streamSeed)
// stream in this FIXED order, EVERY TIME, even when the parameter it feeds is a no-op for the
// current family/state. Append new draws — never insert — so existing streamSeeds stay
// reproducible. Gated AFTER perturbation (gateMotion runs unconditionally on the result). ────────
function perturbMotion(base, family, iv, rand, amp) {
  const u = () => rand() * 2 - 1;
  const m = cloneMotion(base);
  const ampClamped = clamp01(amp, 1);

  const intensityDraw = u();          // 1. MOTION_INTENSITY jitter
  const entranceDraw = u();           // 2. entrance duration jitter
  const staggerDraw = u();            // 3. stagger jitter
  const revealDistDraw = u();         // 4. reveal distance jitter
  const revealTreatmentGate = rand(); // 5. reveal-treatment swap gate
  const revealTreatmentPick = rand(); // 6. reveal-treatment swap pick
  const easingSwapGate = rand();      // 7. easing-token swap gate
  const easingSwapPick = rand();      // 8. easing-token swap pick
  const lerpDraw = u();               // 9. smooth-scroll lerp jitter
  const snapGate = rand();            // 10. scroll-snap enable/disable gate
  const stickyPinGate = rand();       // 11. sticky-pin enable gate
  const parallaxGate = rand();        // 12. parallax enable gate
  const parallaxRatioDraw = u();      // 13. parallax ratio jitter
  const marqueeToggleGate = rand();   // 14. marquee enable/disable gate
  const marqueeSpeedGate = rand();    // 15. marquee speed pick
  const scrollbarGate = rand();       // 16. custom-scrollbar toggle gate
  const scrollbarHueDraw = u();       // 17. scrollbar hue jitter

  // 1
  m.intensity = clampRange(Math.round(m.intensity + intensityDraw * 1.5 * amp), 1, 10);
  m.defaults.springConfig = springForIntensity(m.intensity); // keep spring weight aligned to the perturbed intensity
  // 2
  m.defaults.durations.entrance = Math.round(clampRange(m.defaults.durations.entrance + entranceDraw * 120 * amp, 350, 800));
  // 3
  m.defaults.stagger = Math.round(clampRange(m.defaults.stagger + staggerDraw * 30 * amp, 40, 180));
  m.reveal.stagger = m.defaults.stagger;
  // 4
  m.reveal.distance = Math.round(clampRange(m.reveal.distance + revealDistDraw * 8 * amp, 4, 24));
  // 5/6 — reveal-treatment swap within the taste-safe set (never swaps INTO "none")
  if (m.reveal.treatment !== "none" && revealTreatmentGate < 0.3 * ampClamped) {
    const others = REVEAL_TREATMENTS.filter((t) => t !== m.reveal.treatment);
    const idx = Math.min(others.length - 1, Math.floor(revealTreatmentPick * others.length));
    m.reveal.treatment = others[idx];
  }
  // 7/8 — easing-token rotation: moves the WHOLE token system to another taste-safe member
  if (easingSwapGate < 0.25 * ampClamped) {
    const idx = Math.min(EASING_SET.length - 1, Math.floor(easingSwapPick * EASING_SET.length));
    const picked = EASING_SET[idx];
    m.defaults.enterEasing = picked;
    m.reveal.easing = picked;
    m.transitions.page.easing = picked;
    m.transitions.section.easing = picked;
    m.transitions.state.easing = picked;
  }
  // 9
  m.scroll.smooth.lerp = round(clampRange(m.scroll.smooth.lerp + lerpDraw * 0.08 * amp, 0.02, 0.3), 4);
  // 10 — snap can only ever be toggled for a narrative-eligible family (never turned on for one
  // that isn't — that would itself be an unmotivated scroll-jack risk)
  if (NARRATIVE_PAGEKINDS.has(family.pageKind)) {
    m.scroll.snap.enabled = snapGate < 0.5 * ampClamped + (m.scroll.snap.enabled ? 0.2 : 0);
  }
  // 11 — a single deliberate pin, narrative + high-craft only, rare, and only ever targeting a
  // section role that actually exists in THIS family's beat structure (never a hard-coded id).
  const pinCandidate = NARRATIVE_PAGEKINDS.has(family.pageKind)
    ? (family.sectionGrammar || []).find((s) => /chapter|dark-band|light-band|intro-band/i.test(s.role))
    : null;
  if (pinCandidate && iv.craft >= 0.5 && stickyPinGate < 0.15 * ampClamped) {
    m.scroll.sticky.pin = true;
    m.scroll.sticky.pinTarget = pinCandidate.role;
    m.scroll.sticky.scrub = 1;
  }
  // 12/13 — at most one subtle background parallax layer, rare, always within the safe ratio
  if (parallaxGate < 0.1 * ampClamped) {
    m.scroll.parallax.enabled = true;
    m.scroll.parallax.ratio = round(clampRange(0.12 + parallaxRatioDraw * 0.05 * amp, 0.04, 0.2), 3);
  }
  // 14/15 — marquee only ever toggles where a marquee-eligible slot exists
  if ((family.materialSlots || []).some((s) => MARQUEE_SLOT_RE.test(s))) {
    m.scroll.marquee.enabled = marqueeToggleGate < 0.5 * ampClamped + (m.scroll.marquee.enabled ? 0.2 : 0);
    m.scroll.marquee.count = m.scroll.marquee.enabled ? 1 : 0;
    m.scroll.marquee.speed = marqueeSpeedGate < 0.5 ? "slow" : "very-slow";
  }
  // 16/17
  m.scrollbar.custom = scrollbarGate < 0.35 * ampClamped + (m.scrollbar.custom ? 0.25 : 0);
  if (Number.isFinite(m.scrollbar.thumbHue)) m.scrollbar.thumbHue = wrapHue(m.scrollbar.thumbHue + scrollbarHueDraw * 30 * amp);
  if (Number.isFinite(m.scrollbar.trackHue)) m.scrollbar.trackHue = wrapHue(m.scrollbar.trackHue + scrollbarHueDraw * 30 * amp);

  // per-slot draws — ALWAYS 2 draws per slot (hoverGate, pressJitter), in family.materialSlots
  // array order (already fixed/deterministic per family, same precedent as background.mjs's
  // perturbSlots).
  for (const name of family.materialSlots || []) {
    const hoverGate = rand();   // always drawn
    const pressJitter = u();    // always drawn
    const slot = m.micro[name];
    if (!slot) continue;
    if (m.intensity > 5 && !ASSET_SLOT_RE.test(name)) {
      slot.hover.enabled = hoverGate < 0.6 * ampClamped;
    } else if (m.intensity > 5 && ASSET_SLOT_RE.test(name)) {
      // asset slots (figures/images) get hover only as a rare, non-scale affordance
      slot.hover.enabled = hoverGate < 0.2 * ampClamped;
    } else {
      slot.hover.enabled = false;
    }
    if (slot.hover.enabled && !slot.hover.transform) slot.hover.transform = "translateY(-2px)";
    slot.press.duration = Math.round(clampRange(slot.press.duration + pressJitter * 20 * amp, 80, 200));
  }

  return m;
}

// ── §3 gate — clamps params or forces a safer value; never throws, never leaves a candidate out
// of compliance. Cites the M-row it enforces inline. Runs unconditionally (authored-default path
// included), same defense-in-depth posture as background.mjs's gateBackground. ────────────────────
function gateMotion(motion, family) {
  const matched = [];
  const m = cloneMotion(motion);

  // ── HARD invariants — never perturbable, always enforced regardless of upstream state ─────────
  m.defaults.respectsReducedMotion = true;              // E4/M8
  m.defaults.animateOnly = ["transform", "opacity"];    // §2 #2 / M7
  m.reveal.gatesCoreContent = false;                     // M9/M14
  m.crossCutting.autoplayVideo = false;                  // M3 — not an emittable treatment
  m.crossCutting.cursorFollower = false;                 // M11 — C5 not implemented
  m.scrollbar.width = "thin";                             // M16 ceiling
  m.heroFit.targetHeightShare = clampRange(m.heroFit.targetHeightShare, 0.85, 1.15);
  m.heroFit.tolerance = clampRange(m.heroFit.tolerance, 0.05, 0.2);

  // M4/M5 — easing (defaults, reveal, transitions, per-slot micro)
  const fixEasing = (token) => {
    const reason = bannedEasingReason(token);
    if (reason) { matched.push(reason); return EASING_SET[0]; }
    return token;
  };
  m.defaults.enterEasing = fixEasing(m.defaults.enterEasing);
  m.defaults.exitEasing = fixEasing(m.defaults.exitEasing);
  m.reveal.easing = fixEasing(m.reveal.easing);
  m.transitions.page.easing = fixEasing(m.transitions.page.easing);
  m.transitions.section.easing = fixEasing(m.transitions.section.easing);
  m.transitions.state.easing = fixEasing(m.transitions.state.easing);
  for (const slot of Object.values(m.micro)) {
    slot.hover.easing = fixEasing(slot.hover.easing);
    slot.press.easing = fixEasing(slot.press.easing);
    slot.toggle.easing = fixEasing(slot.toggle.easing);
  }
  if (m.defaults.springConfig.damping < 15) { matched.push("M5"); m.defaults.springConfig.damping = 20; }
  if (m.defaults.springConfig.stiffness > 180) { matched.push("M5"); m.defaults.springConfig.stiffness = 100; }

  // M6 — duration bands + stagger
  for (const key of Object.keys(DURATION_BOUNDS)) {
    const [lo, hi] = DURATION_BOUNDS[key];
    const v = m.defaults.durations[key];
    const clamped = clampRange(v, lo, hi);
    if (clamped !== v) matched.push("M6");
    m.defaults.durations[key] = clamped;
  }
  {
    const clampedStagger = clampRange(m.defaults.stagger, STAGGER_BOUNDS[0], STAGGER_BOUNDS[1]);
    if (clampedStagger !== m.defaults.stagger) matched.push("M6");
    m.defaults.stagger = clampedStagger;
    m.reveal.stagger = clampedStagger;
  }
  {
    const clampedEntrance = clampRange(m.reveal.duration, DURATION_BOUNDS.entrance[0], DURATION_BOUNDS.entrance[1]);
    if (clampedEntrance !== m.reveal.duration) matched.push("M6");
    m.reveal.duration = clampedEntrance;
  }
  if (m.reveal.distance > 24) { matched.push("M6"); m.reveal.distance = 24; }
  for (const t of [m.transitions.page, m.transitions.section, m.transitions.state]) {
    const clamped = clampRange(t.duration, 100, 800);
    if (clamped !== t.duration) matched.push("M6");
    t.duration = clamped;
  }
  for (const slot of Object.values(m.micro)) {
    const p = clampRange(slot.press.duration, 80, 250);
    if (p !== slot.press.duration) matched.push("M6");
    slot.press.duration = p;
    const h = clampRange(slot.hover.duration, 100, 400);
    if (h !== slot.hover.duration) matched.push("M6");
    slot.hover.duration = h;
  }

  // M1 — scroll-jacking: no wheel-hijack, no non-css/lib technique, proximity-only snap, capped
  // lerp, snap only ever enabled for a narrative-eligible family, pin never carries pinSpacing.
  if (m.scroll.smooth.hijacksWheel) { matched.push("M1"); m.scroll.smooth.hijacksWheel = false; }
  if (!["css", "lib-lenis"].includes(m.scroll.smooth.technique)) { matched.push("M1"); m.scroll.smooth.technique = "css"; }
  if (m.scroll.smooth.lerp > 0.3) { matched.push("M1"); m.scroll.smooth.lerp = 0.3; }
  if (m.scroll.snap.mode !== "proximity") { matched.push("M1"); m.scroll.snap.mode = "proximity"; }
  if (m.scroll.snap.enabled && !NARRATIVE_PAGEKINDS.has(family.pageKind)) { matched.push("M1"); m.scroll.snap.enabled = false; }
  if (m.scroll.sticky.pin && m.scroll.sticky.pinSpacing) { matched.push("M1"); m.scroll.sticky.pinSpacing = false; }

  // M2 — whole-page / multi-layer parallax
  if (m.scroll.parallax.layers > 1) { matched.push("M2"); m.scroll.parallax.layers = 1; }
  if (m.scroll.parallax.ratio > 0.2) { matched.push("M2"); m.scroll.parallax.ratio = 0.2; }

  // M12 — at most one marquee, slow, pause-on-hover
  if (m.scroll.marquee.count > 1) { matched.push("M12"); m.scroll.marquee.count = 1; }
  if (m.scroll.marquee.enabled) {
    if (!m.scroll.marquee.pauseOnHover) { matched.push("M12"); m.scroll.marquee.pauseOnHover = true; }
    if (m.scroll.marquee.speed === "fast") { matched.push("M12"); m.scroll.marquee.speed = "slow"; }
  }

  // M13 — restraint: cap simultaneous ambient scroll features; hover only above intensity 5;
  // hover is desktop-only; focus ring always present (M15).
  let ambientCount = 0;
  if (m.scroll.parallax.enabled) ambientCount++;
  if (m.scroll.marquee.enabled) ambientCount++;
  if (m.scroll.sticky.pin) ambientCount++;
  if (ambientCount > 2) { matched.push("M13"); m.scroll.parallax.enabled = false; }
  for (const [name, slot] of Object.entries(m.micro)) {
    if (slot.hover.enabled && m.intensity <= 5) { matched.push("M13"); slot.hover.enabled = false; }
    slot.hover.desktopOnly = true;
    slot.focus.ring = true;
    if (!Number.isFinite(slot.focus.width) || slot.focus.width < 1) { matched.push("M15"); slot.focus.width = 2; }
    // M10 — image hover scale/rotate on asset slots
    if (ASSET_SLOT_RE.test(name) && slot.hover.enabled && typeof slot.hover.transform === "string" && /scale|rotate/.test(slot.hover.transform)) {
      matched.push("M10");
      slot.hover.transform = "translateY(-1px)";
    }
  }

  // M7 — section transitions must never animate raw layout props
  if (["height", "width", "padding", "margin"].includes(m.transitions.section.technique)) {
    matched.push("M7");
    m.transitions.section.technique = "clip-grid-rows";
  }

  return { motion: m, matched: [...new Set(matched)] };
}

/**
 * deriveMotion(family, iv, streamSeed) → MotionGenome
 *
 * `family`: a LAYOUT_FAMILIES entry (reads .pageKind, .materialSlots, .name).
 * `iv`: {materiality, energy, layoutVariance, contentDensity, contrastPreference, craft} (0..1
 *   dials, same bag every other axis uses) plus optional `theme` and `hue` (0-360, only spent on
 *   the scrollbar tint here — falls back to a deterministic per-family hash hue when omitted).
 * `streamSeed`: null/undefined → stable authored defaults, zero RNG draws. A number → run through
 *   MOTION_PERTURB_V1, then gate.
 */
export function deriveMotion(family, iv = {}, streamSeed = null) {
  const ivn = {
    materiality: clamp01(iv.materiality), energy: clamp01(iv.energy),
    layoutVariance: clamp01(iv.layoutVariance), contentDensity: clamp01(iv.contentDensity),
    contrastPreference: clamp01(iv.contrastPreference), craft: clamp01(iv.craft),
    theme: iv.theme === "dark" ? "dark" : "light",
    spreadIndex: Number.isFinite(Number(iv.spreadIndex)) ? Number(iv.spreadIndex) : undefined,
    spreadCount: Number.isFinite(Number(iv.spreadCount)) ? Number(iv.spreadCount) : undefined,
  };
  const hue = Number.isFinite(Number(iv.hue)) ? wrapHue(Number(iv.hue)) : defaultHue(family);

  let motion = selectMotion(family, ivn, hue);

  if (streamSeed != null && Number.isFinite(Number(streamSeed))) {
    const rand = mulberry32(Number(streamSeed) >>> 0);
    const amp = 0.35 + 0.65 * ivn.layoutVariance; // mirrors deriveBackground's amplitude formula
    motion = perturbMotion(motion, family, ivn, rand, amp);
  }

  const gated = gateMotion(motion, family);
  return {
    ...gated.motion,
    slop: { score: gated.matched.length, matchedRules: gated.matched },
    provenance: ["taxonomy-v1", streamSeed != null ? "perturbed" : "authored-default"],
  };
}

/**
 * checkMotionViolations(motion, family) → string[] of M-row ids still out of compliance.
 * Independent re-check (mirrors checkBackgroundViolations being separate from gateBackground,
 * itself mirroring perturb.mjs's validatePerturbed being separate from perturbGenome) — used by
 * tests to verify the gate actually leaves nothing out of bounds, not just that it ran.
 */
export function checkMotionViolations(motion, family) {
  const v = [];
  if (motion.defaults.respectsReducedMotion !== true) v.push("M8");
  const only = motion.defaults.animateOnly;
  if (!(Array.isArray(only) && only.length === 2 && only.includes("transform") && only.includes("opacity"))) v.push("M7");
  if (motion.reveal.gatesCoreContent !== false) v.push("M9");
  if (motion.crossCutting?.autoplayVideo !== false) v.push("M3");
  if (motion.crossCutting?.cursorFollower !== false) v.push("M11");
  if (motion.scrollbar.width !== "thin") v.push("M16");

  const easingTokens = [
    motion.defaults.enterEasing, motion.defaults.exitEasing, motion.reveal.easing,
    motion.transitions.page.easing, motion.transitions.section.easing, motion.transitions.state.easing,
    ...Object.values(motion.micro).flatMap((s) => [s.hover.easing, s.press.easing, s.toggle.easing]),
  ];
  for (const t of easingTokens) {
    const reason = bannedEasingReason(t);
    if (reason) v.push(reason);
  }
  if (motion.defaults.springConfig.damping < 15 - 1e-9) v.push("M5");
  if (motion.defaults.springConfig.stiffness > 180 + 1e-9) v.push("M5");

  for (const [key, [lo, hi]] of Object.entries(DURATION_BOUNDS)) {
    const d = motion.defaults.durations[key];
    if (d < lo - 1e-9 || d > hi + 1e-9) v.push("M6");
  }
  if (motion.defaults.stagger < STAGGER_BOUNDS[0] - 1e-9 || motion.defaults.stagger > STAGGER_BOUNDS[1] + 1e-9) v.push("M6");
  if (motion.reveal.duration < DURATION_BOUNDS.entrance[0] - 1e-9 || motion.reveal.duration > DURATION_BOUNDS.entrance[1] + 1e-9) v.push("M6");
  if (motion.reveal.distance > 24 + 1e-9) v.push("M6");

  if (motion.scroll.smooth.hijacksWheel) v.push("M1");
  if (!["css", "lib-lenis"].includes(motion.scroll.smooth.technique)) v.push("M1");
  if (motion.scroll.smooth.lerp > 0.3 + 1e-9) v.push("M1");
  if (motion.scroll.snap.mode !== "proximity") v.push("M1");
  if (motion.scroll.snap.enabled && !NARRATIVE_PAGEKINDS.has(family.pageKind)) v.push("M1");
  if (motion.scroll.sticky.pin && motion.scroll.sticky.pinSpacing) v.push("M1");

  if (motion.scroll.parallax.layers > 1) v.push("M2");
  if (motion.scroll.parallax.ratio > 0.2 + 1e-9) v.push("M2");

  if (motion.scroll.marquee.count > 1) v.push("M12");
  if (motion.scroll.marquee.enabled && !motion.scroll.marquee.pauseOnHover) v.push("M12");
  if (motion.scroll.marquee.enabled && motion.scroll.marquee.speed === "fast") v.push("M12");

  let ambientCount = 0;
  if (motion.scroll.parallax.enabled) ambientCount++;
  if (motion.scroll.marquee.enabled) ambientCount++;
  if (motion.scroll.sticky.pin) ambientCount++;
  if (ambientCount > 2) v.push("M13");

  for (const [name, slot] of Object.entries(motion.micro)) {
    if (slot.hover.enabled && motion.intensity <= 5) v.push("M13");
    if (slot.hover.desktopOnly !== true) v.push("M13");
    if (!slot.focus.ring) v.push("M15");
    if (!Number.isFinite(slot.focus.width) || slot.focus.width < 1) v.push("M15");
    if (ASSET_SLOT_RE.test(name) && slot.hover.enabled && typeof slot.hover.transform === "string" && /scale|rotate/.test(slot.hover.transform)) v.push("M10");
  }

  if (["height", "width", "padding", "margin"].includes(motion.transitions.section.technique)) v.push("M7");

  if (motion.heroFit.targetHeightShare < 0.85 - 1e-9 || motion.heroFit.targetHeightShare > 1.15 + 1e-9) v.push("A6");

  return [...new Set(v)];
}
