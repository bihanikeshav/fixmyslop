#!/usr/bin/env node
// Grounded, objective slop checker for the /personality A/B test.
// Usage: node slop-check.mjs <file1.html> [file2.html ...]
// Reports per-file: banned-hue colors, dark+glow, opacity:0-until-scroll gating,
// flagged fonts, and functional-component signals. Exits non-zero if any file FAILS
// the objective gates (so it can gate CI). The HERO ARTIFACT *quality* + swap test
// stay with the human/judge; this nails down the parts that should be mechanical.
import { readFileSync } from "node:fs";

const AVOID_FONTS = [
  "Inter", "Geist", "Space Grotesk", "Poppins", "Playfair", "Cormorant",
  "Fraunces", "Instrument Serif", "Clash Display", "General Sans", "Montserrat",
];

// Explicit slop hexes (Tailwind/shadcn/Framer defaults + the AI palette).
const SLOP_HEXES = [
  "#6366f1", "#818cf8", "#7c3aed", "#8b5cf6", "#a855f7", "#a78bfa", // indigo/violet
  "#22d3ee", "#06b6d4", "#2dd4bf", "#5eead4", // electric cyan / mint-teal
  "#2563eb", "#3b82f6", // reflex "fintech blue"
];

function hexToRgb(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

// hue/sat/lightness windows that read as AI slop
function classifyHue([h, s, l]) {
  if (s < 30) return null;                                   // greys / near-neutral: fine
  // blue-purple AI band (fintech-blue → indigo → violet → purple), bright/mid only.
  // dark ink-navy (L<42) is explicitly allowed ("reads as ink, not AI blue"), so floor L 42.
  if (h >= 215 && h <= 280 && s >= 55 && l >= 42 && l <= 82) return "blue-purple AI band (indigo/violet/fintech-blue)";
  if (h >= 160 && h <= 205 && s >= 45 && l >= 35) return "electric cyan/mint (neon)";
  return null;
}

function check(file) {
  const css = readFileSync(file, "utf8");
  const lc = css.toLowerCase();

  // --- colors ---
  const hexes = [...lc.matchAll(/#[0-9a-f]{3}(?:[0-9a-f]{3})?\b/g)].map((m) => m[0]);
  const uniqHex = [...new Set(hexes)];
  const explicitSlop = uniqHex.filter((h) => SLOP_HEXES.includes(h.length === 4
    ? "#" + h.slice(1).split("").map((c) => c + c).join("") : h));
  const bluePurple = [], cyan = [];
  for (const h of uniqHex) {
    const label = classifyHue(rgbToHsl(hexToRgb(h)));
    if (!label) continue;
    if (label.startsWith("blue-purple")) bluePurple.push(h);
    else cyan.push(h);                                       // cyan/teal: gated only on dark ground
  }

  // --- dark + glow: a near-black GROUND (not just near-black ink text) AND a sat. glow ---
  // Only count dark hexes used in a background declaration or a bg-named CSS variable,
  // so near-black body text on a light page doesn't read as a dark ground.
  const bgCtx = [
    ...lc.matchAll(/background(?:-color)?\s*:\s*([^;{}]+)/g),
    ...lc.matchAll(/--[\w-]*(?:bg|background|surface|canvas|base|ground|night|abyss|dark)[\w-]*\s*:\s*([^;{}]+)/g),
  ].map((m) => m[1]).join("  ");
  const bgHexes = [...bgCtx.matchAll(/#[0-9a-f]{3}(?:[0-9a-f]{3})?\b/g)].map((m) => m[0]);
  const darkGround = bgHexes.some((h) => rgbToHsl(hexToRgb(h))[2] <= 14);
  const shadowDecls = [...lc.matchAll(/(box-shadow|text-shadow|drop-shadow)[^;{}]*/g)].map((m) => m[0]);
  const glow = shadowDecls.some((d) => {
    const hs = [...d.matchAll(/#[0-9a-f]{3}(?:[0-9a-f]{3})?\b/g)].map((m) => m[0]);
    const rgbas = [...d.matchAll(/rgba?\(([^)]+)\)/g)].map((m) => m[1]);
    const satHex = hs.some((h) => rgbToHsl(hexToRgb(h))[1] >= 40 && rgbToHsl(hexToRgb(h))[2] >= 25);
    const satRgba = rgbas.some((v) => {
      const p = v.split(",").map((x) => parseFloat(x));
      if (p.length < 3) return false;
      const [, s, l] = rgbToHsl(p.slice(0, 3));
      return s >= 40 && l >= 25;
    });
    return satHex || satRgba;
  });
  const darkGlow = darkGround && glow;

  // --- render gate: opacity:0 gated by IntersectionObserver ---
  // opacity:0 is only a render risk when it hides content WITHOUT a JS gate. The safe
  // recipe scopes the hidden state under an html.js/.js class (content visible if JS off),
  // so count only opacity:0 rules whose selector is NOT gated by a js-presence class.
  const ungatedOpacityZero = [...lc.matchAll(/([^{}]*)\{([^{}]*)\}/g)].filter((r) =>
    /opacity\s*:\s*0(?!\.)/.test(r[2]) && !/html\.js|\.js[\s.,:>+~]|\bno-?js\b/.test(r[1])
  ).length;
  const hasIO = /intersectionobserver/i.test(css);
  const renderRisk = ungatedOpacityZero > 0 && hasIO;

  // --- motion quality ---
  const hasMotion = (/transition\s*:/.test(lc) && !/transition\s*:\s*none/.test(lc)) ||
    /@keyframes|animation\s*:/.test(lc);
  const reducedMotion = /prefers-reduced-motion/.test(lc);
  const transitionAll = /transition\s*:\s*all\b/.test(lc);
  const animatesLayout = /transition\s*:[^;{}]*\b(width|height|top|left|right|bottom|margin|padding)\b/.test(lc);
  const overshoot = [...lc.matchAll(/cubic-bezier\(([^)]+)\)/g)].some((m) => {
    const p = m[1].split(",").map((x) => parseFloat(x));
    return p.length === 4 && (p[1] > 1.001 || p[1] < -0.001 || p[3] > 1.001 || p[3] < -0.001);
  });
  const bounce = overshoot || /\b(bounce|elastic)\b/.test(lc);

  // --- assets: icon-library usage (good) vs heavy literal/hand-drawn SVG paths (caution) ---
  const iconLib = /lucide|phosphor|@phosphor|heroicons|tabler-icons|feathericons|data-lucide|\bph-[a-z]/i.test(css);
  const drawnSvgPaths = (css.match(/<path\b[^>]*\bd="[^"]{60,}"/gi) || []).length;

  // --- fonts (only look inside Google-Fonts URLs and font-family declarations, so
  //     "Inter" can't false-match "IntersectionObserver") ---
  const fontCtx = [
    ...css.matchAll(/family=([^&"')]+)/gi),
    ...css.matchAll(/font-family\s*:\s*([^;}{]+)/gi),
  ].map((m) => m[1]).join("  |  ");
  const fontFlags = AVOID_FONTS.filter((f) =>
    new RegExp("\\b" + f.replace(/ /g, "[\\s+]*") + "\\b", "i").test(fontCtx));

  // --- functional-component signals (necessary, not sufficient) ---
  const signals = {
    listeners: /addeventlistener/i.test(css),
    raf: /requestanimationframe/i.test(css),
    time: /new date\(|date\.now\(/i.test(css),
    canvas: /<canvas/i.test(css),
    inputs: /<input|<select|type=["']range/i.test(css),
    svgScript: /<svg[\s\S]*?<\/svg>/i.test(css) && /<script/i.test(css),
  };
  const interactive = Object.values(signals).filter(Boolean).length;

  // --- objective gate: passes only if no color slop, no dark-glow, no render risk,
  //     no flagged font, and at least one interactivity signal ---
  const fails = [];
  if (explicitSlop.length) fails.push(`explicit slop hex: ${explicitSlop.join(", ")}`);
  // 1A/1E: indigo/violet/fintech-blue is slop regardless of ground.
  if (bluePurple.length) fails.push(`blue-purple AI band: ${bluePurple.join(", ")}`);
  // 1B: cyan/teal is only a violation as a glow or fill on a DARK ground (muted teal on
  // a light ground is explicitly allowed by slop-colors.md).
  if (cyan.length && darkGround) fails.push(`cyan/teal on dark ground: ${cyan.join(", ")}`);
  if (darkGlow) fails.push("dark ground + saturated glow shadow");
  if (renderRisk) fails.push(`ungated opacity:0 (${ungatedOpacityZero} rule(s)) + IntersectionObserver — content hidden without JS`);
  if (fontFlags.length) fails.push(`flagged font: ${fontFlags.join(", ")}`);
  if (interactive === 0) fails.push("no functional-component signal (no listeners/raf/time/canvas/inputs)");
  // motion gate (polish round)
  if (hasMotion && !reducedMotion) fails.push("animation without prefers-reduced-motion");
  if (transitionAll) fails.push("transition: all (sweeps in layout props → reflow)");
  if (animatesLayout) fails.push("animates layout props (width/height/top/left/margin/padding)");
  if (bounce) fails.push("bounce/elastic/overshoot easing");

  const motion = { hasMotion, reducedMotion };
  const assets = { iconLib, drawnSvgPaths };
  return { file, pass: fails.length === 0, fails, signals, interactive, motion, assets };
}

let anyFail = false;
for (const file of process.argv.slice(2)) {
  const r = check(file);
  anyFail = anyFail || !r.pass;
  const tag = r.pass ? "PASS" : "FAIL";
  console.log(`\n${tag}  ${file}`);
  console.log(`  functional signals: ${r.interactive} ${JSON.stringify(r.signals)}`);
  console.log(`  motion: ${r.motion.hasMotion ? "yes" : "NONE"}, reduced-motion: ${r.motion.reducedMotion ? "yes" : "no"}`);
  console.log(`  assets: icon-lib ${r.assets.iconLib ? "yes" : "no"}, large-literal-svg-paths ${r.assets.drawnSvgPaths}`);
  if (r.fails.length) for (const f of r.fails) console.log(`  ✗ ${f}`);
}
process.exit(anyFail ? 1 : 0);
