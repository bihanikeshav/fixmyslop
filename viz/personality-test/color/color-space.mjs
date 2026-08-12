// color-space.mjs — pure color-space conversions for the density model.
//
// Everything distance-related in this project happens in OKLab/OKLCH, because
// OKLab is (approximately) perceptually uniform: a fixed Euclidean step ΔEok
// corresponds to a roughly constant perceived color difference everywhere in the
// space. That is the property that makes "a 1pt difference isn't noticeable"
// well-defined — you cannot say that in RGB or HSL, where equal numeric steps
// look wildly different depending on where you are.
//
// All functions are pure (no I/O, no Date.now, no Math.random) and exported so
// the vitest suite can round-trip them.
//
// References for the matrices: Björn Ottosson, "A perceptual color space for
// image processing" (https://bottosson.github.io/posts/oklab/).

// ---- hex <-> sRGB (0..255 integer channels) ----

export function hexToRgb(hex) {
  let h = String(hex).trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`bad hex: ${hex}`);
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v)))
    .toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

// ---- sRGB (0..1) <-> linear-light sRGB (0..1) ----

function srgbToLinearChannel(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function linearToSrgbChannel(c) {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

export function srgbToLinear([r, g, b]) {
  return [srgbToLinearChannel(r), srgbToLinearChannel(g), srgbToLinearChannel(b)];
}
export function linearToSrgb([r, g, b]) {
  return [linearToSrgbChannel(r), linearToSrgbChannel(g), linearToSrgbChannel(b)];
}

// ---- linear sRGB <-> OKLab ----

export function linearToOklab([r, g, b]) {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  return [
    0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_, // L
    1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_, // a
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_, // b
  ];
}

export function oklabToLinear([L, a, b]) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  return [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
}

// ---- composed: hex <-> OKLab ----

export function hexToOklab(hex) {
  const srgb = hexToRgb(hex).map((c) => c / 255);
  return linearToOklab(srgbToLinear(srgb));
}

// Convert OKLab to an sRGB hex AND report whether it was in gamut (no channel
// clipped). The hex itself is always clamped so it is renderable.
export function oklabToSrgb([L, a, b]) {
  const lin = oklabToLinear([L, a, b]);
  const srgb = linearToSrgb(lin);
  const eps = 1e-4;
  const inGamut = srgb.every((c) => c >= -eps && c <= 1 + eps);
  const hex = rgbToHex(srgb.map((c) => c * 255));
  return { hex, inGamut, srgb };
}

export function isInGamut([L, a, b]) {
  return oklabToSrgb([L, a, b]).inGamut;
}

// ---- OKLab <-> OKLCH (polar form: L, Chroma, Hue°) ----

export function oklabToOklch([L, a, b]) {
  const C = Math.hypot(a, b);
  let H = (Math.atan2(b, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return [L, C, H];
}

export function oklchToOklab([L, C, H]) {
  const r = (H * Math.PI) / 180;
  return [L, C * Math.cos(r), C * Math.sin(r)];
}

export function hexToOklch(hex) {
  return oklabToOklch(hexToOklab(hex));
}

// Perceptual (Euclidean) distance in OKLab. This is our ΔEok / "JND" unit.
export function deltaEok(p, q) {
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

// ---- WCAG 2.x contrast ratio ----

function relLuminance([r, g, b]) {
  const [R, G, B] = srgbToLinear([r / 255, g / 255, b / 255]);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

export function contrastRatio(hexA, hexB) {
  const la = relLuminance(hexToRgb(hexA));
  const lb = relLuminance(hexToRgb(hexB));
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}
