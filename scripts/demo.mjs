/**
 * End-to-end demo of the deterministic Brain on hand-built sample data.
 * Run after building core:  npm run build  &&  node scripts/demo.mjs
 */
import {
  objectiveQuality,
  compositeQuality,
  recommend,
  slopScore,
} from "../packages/core/dist/index.js";

const metrics = {
  inter: { xHeightRatio: 0.55, apertureOpenness: 0.7, counterSize: 0.6, strokeContrast: 0.1, weightCount: 9, hasItalics: true, charsetCompleteness: 1 },
  clash: { xHeightRatio: 0.5, apertureOpenness: 0.55, counterSize: 0.5, strokeContrast: 0.4, weightCount: 6, hasItalics: false, charsetCompleteness: 0.9 },
  fraunces: { xHeightRatio: 0.48, apertureOpenness: 0.6, counterSize: 0.55, strokeContrast: 0.6, weightCount: 8, hasItalics: true, charsetCompleteness: 0.95 },
  redacted: { xHeightRatio: 0.3, apertureOpenness: 0.15, counterSize: 0.2, strokeContrast: 0.98, weightCount: 1, hasItalics: false, charsetCompleteness: 0.4 },
};

const mk = (id, family, m, personality, isFoundational, display) => ({
  font: { id, family, supplier: "google", category: "sans-serif", metrics: m, personality, isFoundational },
  quality: compositeQuality({ objective: objectiveQuality(m), attribute: 0.7, curation: 0.6 }),
  saturation: { fontId: id, display, body: 0, trend: 0 },
});

const candidates = [
  mk("inter", "Inter", metrics.inter, { professional: 0.8, calm: 0.7 }, true, 0.95),
  mk("clash-display", "Clash Display", metrics.clash, { bold: 0.9, dramatic: 0.8 }, false, 0.04),
  mk("fraunces", "Fraunces", metrics.fraunces, { elegant: 0.85, dramatic: 0.6 }, false, 0.3),
  mk("redacted", "Redacted Script", metrics.redacted, { playful: 0.9 }, false, 0.01),
];

console.log("\n=== Recommend a DISPLAY font, bold+dramatic, freshness 0.8 ===");
const recs = recommend(candidates, {
  target: { bold: 1, dramatic: 1 },
  role: "display",
  freshness: 0.8,
  qualityThreshold: 0.5,
  limit: 5,
});
for (const r of recs) {
  console.log(`  ${r.font.family.padEnd(16)} score=${r.score.toFixed(3)}  ${r.reasons.join(" · ")}`);
}
console.log("  (Inter excluded: foundational. Redacted excluded: fails quality floor.)");

const satOf = Object.fromEntries(candidates.map((c) => [c.font.family.toLowerCase(), c.saturation]));
const slopInput = (hero) => ({
  page: { heroFont: hero, bodyFont: "inter" },
  saturationOf: (f) => satOf[f],
  isFoundational: (f) => f === "inter",
});

console.log("\n=== Slop-o-meter ===");
for (const hero of ["inter", "clash display"]) {
  const r = slopScore(slopInput(hero));
  console.log(`  hero="${hero}" -> ${r.score}/100  [${r.verdict}]  ${r.notes.join("; ")}`);
}
console.log();
