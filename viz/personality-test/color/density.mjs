// density.mjs — the empirical "AI-overused color" density field + the validator
// primitives (hard-banned check, isOverused, nearestSafe).
//
// MODEL
// -----
// Each corpus color (corpus.mjs) drops a Gaussian blob into OKLab. Summing the
// blobs gives a continuous density (heat) field; we can query the heat at any
// color. "Overused" = heat above a threshold. The Gaussian bandwidth is chosen
// near a just-noticeable-difference (ΔEok ≈ 0.03–0.05) so the blob from one
// corpus point only "claims" colors a human would actually confuse with it.
//
// Why density on top of the hard bans: the hard bans (slop-colors.md) catch the
// six named clusters. The density field catches the rest of the convergence —
// any color that sits where the frameworks AND our own builds keep landing,
// even if it is not one of the six named bands. That is what makes this
// data-driven rather than a fixed blocklist.
//
// NEUTRALS ARE EXEMPT. Black-on-white is "overused" but correct: the slop is the
// chromatic *identity* choice, not the neutral structure. So colors with chroma
// below NEUTRAL_CHROMA are never flagged overused (they still get a verdict).
//
// All exports are pure given a corpus snapshot. No Date.now()/Math.random().

import {
  hexToOklab, hexToOklch, oklchToOklab, oklabToSrgb, oklabToOklch,
  deltaEok, isInGamut,
} from "./color-space.mjs";
import { loadCorpus } from "./corpus.mjs";

// ===========================================================================
// CONFIG — all tunables in one block, with rationale. Calibrated values come
// from calibrate() (see validate.mjs --calibrate); these are the final picks.
// ===========================================================================
export const CONFIG = {
  // Gaussian bandwidth in OKLab units (ΔEok). One corpus point's blob has this
  // standard deviation. ~0.04 sits at the small end of a just-noticeable
  // difference, so a corpus point only heats colors a viewer would confuse with
  // it. Smaller => tighter, flags fewer near-neighbours; larger => broader.
  // TIGHTENED 0.04 -> 0.02 (~1 JND): with the crawl corpus (~7.7k points) 0.04
  // smeared heat across nearly the whole gamut (~95% flagged). 0.02 keeps each
  // color's footprint to its immediate neighbourhood, so individual-color space
  // stays WIDE OPEN. The heavy lifting now moves to the PALETTE gate (the whole
  // combination), not individual hexes.
  BANDWIDTH: 0.02,

  // Overuse threshold on the raw KDE heat (density() = sum of unit-peak Gaussian
  // blobs). With ~925 corpus points and BANDWIDTH 0.04 the usable-space density
  // distribution runs from ~0.2 (cool, empty regions) to ~42 (the warm cluster
  // we keep reaching for), with a median around 8. A region is "overused" when
  // its heat sits in the upper tail of that distribution. 18.0 ≈ the 85th
  // percentile of usable space (measured by calibrate()), so by construction the
  // density check flags a clear minority (~15%) — the genuinely crowded zones —
  // not the majority. Lower it to be stricter, raise it to be more permissive.
  //
  // NOTE on the canonical Tailwind indigo/blue/cyan: those swatches actually sit
  // BELOW this density (the blue-purple band is *under*-populated in OUR builds —
  // we converge on warm earth, not blue). They are still caught, by the hard ban
  // (which is the stronger verdict). The density field's distinct job is to catch
  // OUR convergence (oxblood/brick/ochre) that no fixed blocklist would name.
  OVERUSE_THRESHOLD: 40.0,  // at BANDWIDTH 0.02 over the crawl corpus this flags
  // ~10% of usable space (was ~95% at 0.04/18) — only the genuine hot peaks trip
  // it; the exact Tailwind tokens are still caught by the (stronger) hard ban.

  // Below this OKLCH chroma a color reads as a neutral (grey/near-grey). Neutrals
  // are exempt from the density penalty. 0.04 ≈ the line where a tint stops
  // looking like an intentional hue and starts looking like "warm/cool grey."
  NEUTRAL_CHROMA: 0.04,

  // For a CHROMATIC color to count as a deliberate identity choice (and for
  // nearestSafe to propose one), it should carry at least this much chroma —
  // otherwise it is a muddy in-between. Used only when snapping a chromatic
  // input; neutral inputs are snapped toward neutrals.
  MIN_INTENTIONAL_CHROMA: 0.05,

  // Two chosen colors within this OKLab distance are flagged as near-duplicates
  // (intra-set). ~1.2× a JND: close enough that using both looks accidental.
  DUPLICATE_DELTA: 0.05,
};

// ===========================================================================
// HARD BANS — must agree with skills/personality/reference/slop-colors.md.
// These use OKLCH (the canonical coords in docs/design-research/slop-colors.md)
// where given, and HSL-equivalent hue windows from slop-check.mjs otherwise.
// Returns a label string if banned, else null. Operates on a single color
// (ground-dependent bans like dark+glow are CSS-level, handled in slop-check).
// ===========================================================================

// Literal slop hexes (exact-match short-circuit), from slop-colors.md.
const BANNED_HEXES = new Set([
  "#6366f1", "#7c3aed", "#8b5cf6", "#818cf8", "#a78bfa", "#a855f7", // indigo/violet
  "#2563eb", "#3b82f6",                                              // fintech blue
  "#22d3ee", "#2dd4bf", "#67e8f9", "#5eead4",                        // cyan / mint-teal
]);

export function hardBanned(hex) {
  const h = hex.toLowerCase();
  if (BANNED_HEXES.has(h)) return `literal slop hex ${h}`;

  const [L, C, H] = hexToOklch(hex);
  const oklch = { L, C, H };

  // 1A indigo/violet "AI-startup" accent — high-chroma in the blue-purple band.
  //   docs OKLCH: L 0.51–0.62, C 0.23–0.25, H 277–293. Gate: C>0.18 in H 264–310.
  if (C > 0.18 && H >= 264 && H <= 310) return `1A indigo/violet (oklch H${H.toFixed(0)} C${C.toFixed(2)})`;

  // 1E reflexive fintech blue — H 252–265 in OKLCH, C>0.18, mid lightness.
  //   (ink ultramarine at L<0.40 is explicitly allowed — "reads as ink".)
  if (C > 0.18 && H >= 245 && H < 264 && L >= 0.45) return `1E fintech blue (oklch H${H.toFixed(0)} C${C.toFixed(2)} L${L.toFixed(2)})`;

  // 1B electric cyan / mint-teal — the bright neon partner. docs OKLCH H 175–215,
  //   L 0.72–0.82, C 0.10–0.16. Flag bright high-chroma cyan/teal regardless of
  //   ground here (the ground-dependent glow gate is in slop-check); a muted
  //   teal border on white is below this chroma and passes.
  if (C >= 0.10 && H >= 170 && H <= 215 && L >= 0.65) return `1B electric cyan/mint (oklch H${H.toFixed(0)} C${C.toFixed(2)} L${L.toFixed(2)})`;

  return null;
}

// True if the color is a neutral (exempt from the density penalty).
export function isNeutral(hex) {
  return hexToOklch(hex)[1] < CONFIG.NEUTRAL_CHROMA;
}

// Soft "inside a slop hue band" test for the SNAPPER. hardBanned() only fires
// above the C>0.18 thresholds; but a suggestion at, say, C 0.15 H 277 is still
// obviously indigo and bad advice. So nearestSafe additionally refuses any
// chromatic (C above NEUTRAL_CHROMA) suggestion whose hue sits inside one of the
// banned hue windows — it must escape the band, not hug its edge.
function inBannedHueBand([L, C, H]) {
  if (C < CONFIG.NEUTRAL_CHROMA) return false; // neutrals are never "in a band"
  if (H >= 250 && H <= 310) return true;        // indigo / violet / purple
  if (H >= 245 && H < 250 && L >= 0.45) return true; // fintech blue (mid+)
  if (H >= 165 && H <= 222 && L >= 0.5) return true;  // electric cyan / mint (bright)
  return false;
}

// ===========================================================================
// DENSITY FIELD (Gaussian KDE in OKLab)
// ===========================================================================

let _points = null; // cached corpus as OKLab triples + meta
function corpusPoints() {
  if (_points) return _points;
  const corpus = loadCorpus();
  _points = corpus.map((c) => ({ ...c, lab: hexToOklab(c.hex) }));
  return _points;
}

// Allow tests / callers to inject a fixed corpus (determinism, isolation).
export function setCorpus(corpus) {
  _points = corpus.map((c) => ({ ...c, lab: hexToOklab(c.hex) }));
}
export function resetCorpus() { _points = null; }

// Raw KDE: sum of Gaussian blobs. Normalized so one corpus point contributes a
// peak of exactly 1.0 at its own location (the Gaussian's value at distance 0,
// without the 1/(σ√2π) factor). Heat is therefore "equivalent corpus points
// stacked at this color, weighted by JND-distance."
export function density(lab, bandwidth = CONFIG.BANDWIDTH) {
  const pts = corpusPoints();
  const twoSigma2 = 2 * bandwidth * bandwidth;
  let sum = 0;
  for (const p of pts) {
    const d2 = (lab[0] - p.lab[0]) ** 2 + (lab[1] - p.lab[1]) ** 2 + (lab[2] - p.lab[2]) ** 2;
    sum += Math.exp(-d2 / twoSigma2);
  }
  return sum;
}

export function densityHex(hex, bandwidth = CONFIG.BANDWIDTH) {
  return density(hexToOklab(hex), bandwidth);
}

// Verdict for one color (role-agnostic). Returns { hex, oklch, verdict, density, ban }.
export function classify(hex) {
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

export function isOverused(hex) {
  return classify(hex).verdict === "OVERUSED";
}

// A color is "safe to use as an identity accent" iff: not hard-banned, in gamut,
// low density, and (if chromatic) carrying enough chroma to read as intentional.
function isSafeAccentLab(lab, { minChroma = CONFIG.MIN_INTENTIONAL_CHROMA } = {}) {
  if (!isInGamut(lab)) return false;
  const { hex } = oklabToSrgb(lab);
  if (hardBanned(hex)) return false;
  const lch = oklabToOklch(lab);
  if (inBannedHueBand(lch)) return false; // don't hug the edge of a slop band
  if (density(lab) >= CONFIG.OVERUSE_THRESHOLD) return false;
  if (lch[1] < minChroma) return false; // too muddy to be a deliberate chromatic choice
  return true;
}

// ===========================================================================
// nearestSafe — snap a slop color to the closest non-slop color.
// Strategy: search OKLab outward from the input for the nearest color that is
// in-gamut + not-banned + low-density + chroma-appropriate. We prefer staying in
// the SAME HUE FAMILY (shift L/C first, then hue), because a same-hue escape
// preserves the designer's intent better than jumping hue. Returns up to 3
// ranked suggestions: {hex, oklch, density, delta, reason}.
// ===========================================================================
export function nearestSafe(hex, { count = 3, maxDelta = 0.6 } = {}) {
  const startLab = hexToOklab(hex);
  const [L0, C0, H0] = oklabToOklch(startLab);
  const neutralInput = C0 < CONFIG.NEUTRAL_CHROMA;

  // If the input is a neutral, it's already fine — but if asked, snap toward the
  // nearest in-gamut low-density neutral (rarely needed). For chromatic input we
  // do the real search.
  const minChroma = neutralInput ? 0 : CONFIG.MIN_INTENTIONAL_CHROMA;

  const candidates = [];
  // Sample a shell of OKLCH offsets: vary L and C in small steps, hue in a
  // widening fan. Deterministic grid (no RNG). Sorted by perceptual distance.
  const dLs = [0, 0.04, -0.04, 0.08, -0.08, 0.12, -0.12, 0.16, -0.16];
  const dCs = [0, 0.03, -0.03, 0.06, -0.06, 0.09, -0.09, 0.12, -0.12, 0.15];
  // hue offsets: 0 first (stay in family), then widen to ±60° in 5° steps.
  const dHs = [0];
  for (let s = 5; s <= 60; s += 5) { dHs.push(s); dHs.push(-s); }

  const seen = new Set();
  for (const dH of dHs) {
    for (const dL of dLs) {
      for (const dC of dCs) {
        const L = L0 + dL;
        const C = Math.max(0, C0 + dC);
        const H = (H0 + dH + 360) % 360;
        if (L <= 0.05 || L >= 0.99) continue;
        const lab = oklchToOklab([L, C, H]);
        if (!isSafeAccentLab(lab, { minChroma })) continue;
        const { hex: chex } = oklabToSrgb(lab);
        if (seen.has(chex)) continue;
        seen.add(chex);
        const delta = deltaEok(startLab, lab);
        if (delta > maxDelta) continue;
        const huePenalty = Math.abs(dH) / 360; // tiebreak toward same hue family
        candidates.push({ hex: chex, lab, L, C, H, dH, delta, sort: delta + huePenalty });
      }
    }
  }

  candidates.sort((a, b) => a.sort - b.sort);
  const picked = [];
  for (const c of candidates) {
    // de-dupe near-identical suggestions in the result set
    if (picked.some((p) => deltaEok(p.lab, c.lab) < CONFIG.DUPLICATE_DELTA)) continue;
    const sameFamily = Math.abs(c.dH) <= 15;
    const reason = sameFamily
      ? `same hue family, shifted out of the hot zone (ΔEok ${c.delta.toFixed(2)})`
      : `hue shifted ${c.dH > 0 ? "+" : ""}${c.dH}° to escape the slop band (ΔEok ${c.delta.toFixed(2)})`;
    picked.push({
      hex: c.hex,
      lab: c.lab,
      oklch: { L: c.L, C: c.C, H: c.H },
      density: density(c.lab),
      delta: c.delta,
      reason,
    });
    if (picked.length >= count) break;
  }
  // strip the internal lab field from the returned suggestions
  return picked.map(({ lab, ...rest }) => rest);
}

// ===========================================================================
// Intra-set near-duplicate detection (two chosen colors within ~JND in OKLab).
// ===========================================================================
export function nearDuplicates(hexes, delta = CONFIG.DUPLICATE_DELTA) {
  const labs = hexes.map((h) => ({ hex: h, lab: hexToOklab(h) }));
  const pairs = [];
  for (let i = 0; i < labs.length; i++) {
    for (let j = i + 1; j < labs.length; j++) {
      const d = deltaEok(labs[i].lab, labs[j].lab);
      if (d < delta) pairs.push({ a: labs[i].hex, b: labs[j].hex, delta: d });
    }
  }
  return pairs;
}
