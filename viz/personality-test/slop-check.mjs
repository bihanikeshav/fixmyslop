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
  const hueSlop = [];
  for (const h of uniqHex) {
    const label = classifyHue(rgbToHsl(hexToRgb(h)));
    if (label) hueSlop.push(`${h} → ${label}`);
  }

  // --- dark + glow: any near-black ground AND a saturated shadow/glow ---
  const darkGround = uniqHex.some((h) => rgbToHsl(hexToRgb(h))[2] <= 14);
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
  const opacityZero = (lc.match(/opacity\s*:\s*0(?!\.)/g) || []).length;
  const hasIO = /intersectionobserver/i.test(css);
  const renderRisk = opacityZero > 0 && hasIO;

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
  if (hueSlop.length) fails.push(`slop-hue color: ${hueSlop.join("; ")}`);
  if (darkGlow) fails.push("dark ground + saturated glow shadow");
  if (renderRisk) fails.push(`opacity:0 (${opacityZero}) gated by IntersectionObserver`);
  if (fontFlags.length) fails.push(`flagged font: ${fontFlags.join(", ")}`);
  if (interactive === 0) fails.push("no functional-component signal (no listeners/raf/time/canvas/inputs)");

  return { file, pass: fails.length === 0, fails, signals, interactive };
}

let anyFail = false;
for (const file of process.argv.slice(2)) {
  const r = check(file);
  anyFail = anyFail || !r.pass;
  const tag = r.pass ? "PASS" : "FAIL";
  console.log(`\n${tag}  ${file}`);
  console.log(`  functional signals: ${r.interactive} ${JSON.stringify(r.signals)}`);
  if (r.fails.length) for (const f of r.fails) console.log(`  ✗ ${f}`);
}
process.exit(anyFail ? 1 : 0);
