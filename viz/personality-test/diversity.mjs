#!/usr/bin/env node
// Variety reporter for the /personality test. Given N builds of the SAME brief,
// measures whether they actually differ. Usage: node diversity.mjs <a.html> <b.html> ...
// Reports per-file signals + a SUMMARY of distinct counts. High distinctness + low
// reuse of the cliché moves (range-slider standout, italic accent) = variety.
import { readFileSync } from "node:fs";

function hexToHsl(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16); let r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b); let hh = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) { const d = max - min; s = l > .5 ? d / (2 - max - min) : d / (max + min);
    hh = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4; hh *= 60; }
  return [Math.round(hh), Math.round(s * 100), Math.round(l * 100)];
}
function hueName([h, s, l]) {
  if (s < 12) return "neutral";
  if (l < 30 && (h < 45 || h > 330)) return "brown/oxblood";
  if (h < 18 || h >= 345) return "red";
  if (h < 45) return l < 45 ? "brown" : "orange";
  if (h < 70) return "amber/gold";
  if (h < 90) return "yellow";
  if (h < 160) return "green";
  if (h < 200) return "teal/cyan";
  if (h < 250) return "blue";
  if (h < 290) return "indigo/violet";
  return "magenta/pink";
}

function analyze(file) {
  const css = readFileSync(file, "utf8"); const lc = css.toLowerCase();
  // fonts actually loaded (Google Fonts family= params)
  const fonts = [...new Set([...css.matchAll(/family=([^&"':)]+)/gi)]
    .map((m) => decodeURIComponent(m[1]).replace(/\+/g, " ").trim()))];
  // dominant accent = most frequent saturated mid hex
  const counts = {};
  for (const m of lc.matchAll(/#[0-9a-f]{3}(?:[0-9a-f]{3})?\b/g)) {
    const [, s, l] = hexToHsl(m[0]); if (s >= 40 && l >= 22 && l <= 72) counts[m[0]] = (counts[m[0]] || 0) + 1;
  }
  const accent = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const accentHue = accent ? hueName(hexToHsl(accent)) : "—";
  // standout kind
  const standout = lc.includes('type="range"') || lc.includes("type='range'") ? "range-slider"
    : /<canvas/.test(lc) ? "canvas"
    : /<svg[\s\S]*?<script|requestanimationframe/.test(lc) ? "svg/anim"
    : /new date\(|date\.now\(/.test(lc) ? "time-driven"
    : /<input|<select/.test(lc) ? "form-input"
    : "none/static";
  // type moves
  const moves = [];
  if (/font-style\s*:\s*italic/.test(lc) || /<h1[^>]*>[\s\S]{0,200}?<(em|i)\b/.test(lc)) moves.push("italic-accent");
  if (/text-transform\s*:\s*uppercase/.test(lc)) moves.push("all-caps");
  if (/-webkit-text-stroke|[^-]text-stroke/.test(lc)) moves.push("outline");
  if (/font-variation-settings/.test(lc)) moves.push("variable-axis");
  if (/clamp\([^)]*(?:[6-9]|1\d)(?:\.\d+)?rem/.test(lc) || /font-size[^;]*1[0-9]vw/.test(lc)) moves.push("huge-scale");
  // layout
  const cols = (lc.match(/grid-template-columns\s*:\s*[^;]*(1fr[^;]*1fr|repeat)/g) || []).length;
  const centered = /text-align\s*:\s*center/.test(lc.split("body")[1] || lc);
  const rotate = /transform\s*:\s*[^;]*rotate/.test(lc);
  const layout = rotate ? "rotated/diagonal" : centered ? "centered" : cols ? "grid/split" : "flow";
  return { file: file.split(/[\\/]/).pop(), fonts, accentHue, accent, standout, moves, layout };
}

const rows = process.argv.slice(2).map(analyze);
for (const r of rows) {
  console.log(`\n${r.file}`);
  console.log(`  fonts:    ${r.fonts.join(", ") || "—"}`);
  console.log(`  accent:   ${r.accentHue} (${r.accent || "—"})`);
  console.log(`  standout: ${r.standout}`);
  console.log(`  type:     ${r.moves.join(", ") || "—"}`);
  console.log(`  layout:   ${r.layout}`);
}
const uniq = (xs) => [...new Set(xs)];
const allFonts = uniq(rows.flatMap((r) => r.fonts));
console.log(`\n=== DIVERSITY across ${rows.length} builds ===`);
console.log(`distinct fonts:        ${allFonts.length}  [${allFonts.join(", ")}]`);
console.log(`distinct accent hues:  ${uniq(rows.map((r) => r.accentHue)).length}  [${uniq(rows.map((r) => r.accentHue)).join(", ")}]`);
console.log(`distinct standouts:    ${uniq(rows.map((r) => r.standout)).length}  [${uniq(rows.map((r) => r.standout)).join(", ")}]`);
console.log(`distinct layouts:      ${uniq(rows.map((r) => r.layout)).length}  [${uniq(rows.map((r) => r.layout)).join(", ")}]`);
console.log(`cliché reuse: range-slider standout ${rows.filter((r) => r.standout === "range-slider").length}/${rows.length}, italic-accent ${rows.filter((r) => r.moves.includes("italic-accent")).length}/${rows.length}`);
