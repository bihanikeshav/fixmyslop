#!/usr/bin/env node
// build-structural-prevalence.mjs
// Computes data/structural-prevalence.json — the % of crawled sites exhibiting
// each STRUCTURAL slop marker. This is the empirical "weight" for each tell,
// the structural companion to the color-slop prevalence work.
//
// Inputs (from the 1266-site feature crawl):
//   data/observations.styles.json     (gradient-text, glass, pill, bento, glow…)
//   data/observations.animation.json  (tailwind animate-*, layout-prop, easing, libs)
//   data/observations.components.json (default stacks: tailwind/shadcn/bootstrap)
//   data/observations.gradients.json  (two-stop slop gradient hue-pairs)
//   data/observations.radii.json      (pill prevalence, cross-check)
//
// Output: data/structural-prevalence.json
//   [{ marker, label, sitesPct, count, group }]  sorted desc by sitesPct
//
// Run: node viz/personality-test/build-structural-prevalence.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");

const styles = JSON.parse(readFileSync(resolve(ROOT, "data/observations.styles.json")));
const animation = JSON.parse(readFileSync(resolve(ROOT, "data/observations.animation.json")));
const components = JSON.parse(readFileSync(resolve(ROOT, "data/observations.components.json")));
const gradients = JSON.parse(readFileSync(resolve(ROOT, "data/observations.gradients.json")));

// All four observation files agree on okSites; use the styles one as canonical.
const OK = styles.okSites; // 1266
const pct = (count) => Math.round((count / OK) * 1000) / 10;

const rows = [];
const add = (marker, label, count, group) =>
  rows.push({ marker, label, sitesPct: pct(count), count, group });

// --- STYLE markers (from styles.json + radii.json) ---
add("gradient-text", "gradient text (bg-clip:text)", styles.tells.gradientText.sites, "style");
add("glass-nav", "glass / backdrop-blur", styles.tells.glass.sites, "style");
add("pill", "pill / rounded-full", styles.tells.pill.sites, "style");
add("bento", "bento grid layout", styles.tells.bento.sites, "style");
add("colored-glow-shadow", "colored glow shadow", styles.tells.glowShadow.sites, "style");
add("box-shadow-everywhere", "box-shadow everywhere", styles.tells.boxShadow.sites, "style");
add("sparkle-badge", "✨ / emoji “AI” badge", styles.tells.sparkleBadge.sites, "style");

// --- MOTION markers (from animation.json) ---
// Tailwind animate-* family of CANNED utilities (pulse/ping/spin/bounce/marquee).
// Count distinct SITES, not uses: a site is "hit" if it carries any of these.
// The crawl reports per-class site counts, not co-occurrence, so we approximate
// the union by the single largest member (a conservative lower bound on sites).
const ta = animation.tailwindAnimate;
const cannedKeys = Object.keys(ta).filter((k) =>
  /^animate-(pulse|ping|spin|bounce|marquee)/.test(k)
);
const cannedMax = Math.max(...cannedKeys.map((k) => ta[k])); // animate-pulse: 161
add("tailwind-animate-canned", "Tailwind animate-* (pulse/ping/spin/bounce/marquee)", cannedMax, "motion");

add("layout-prop-animation", "animates layout props (reflow)", animation.layoutPropAnimation, "motion");
add("bounce-elastic-easing", "bounce / elastic easing", animation.bounceElasticEasing, "motion");

// Animation libraries (aos / swiper / gsap / framer-motion). Report the most
// prevalent single library as the representative "anim lib" marker, and also a
// combined "any scroll/anim lib" lower bound via the max member.
const libs = animation.libraries;
const animLibMax = Math.max(libs.swiper, libs.gsap, libs["framer-motion"], libs.aos || 0);
add("anim-lib", "animation lib (swiper/gsap/framer/aos)", animLibMax, "motion");

// --- STACK markers (from components.json) ---
add("stack-tailwind", "Tailwind utility stack", components.stacks.tailwind, "stack");
add("stack-shadcn", "shadcn/ui components", components.stacks.shadcn, "stack");
add("stack-bootstrap", "Bootstrap", components.stacks.bootstrap, "stack");

// --- GRADIENT markers (from gradients.json) ---
// The "blue-purple slop band" two-stop gradients: both endpoints land in the
// AI band {blue, indigo, violet, cyan}. Sum the matching hue-pair counts.
const BAND = new Set(["blue", "indigo", "violet", "cyan"]);
const slopPairCounts = {}; // "a->b" -> count (merged across linear/radial/conic)
let slopBandTotal = 0;
for (const [key, count] of Object.entries(gradients)) {
  const [, pair] = key.split(":"); // "linear:indigo->violet" -> "indigo->violet"
  const [a, b] = pair.split("->");
  if (BAND.has(a) && BAND.has(b)) {
    slopBandTotal += count;
    slopPairCounts[pair] = (slopPairCounts[pair] || 0) + count;
  }
}
// Top individual slop hue-pairs (for the table / detector commentary).
const topSlopPairs = Object.entries(slopPairCounts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 4);
for (const [pair, count] of topSlopPairs) {
  add(`gradient-${pair.replace("->", "-")}`, `gradient ${pair.replace("->", " → ")}`, count, "gradient");
}
// And the aggregate blue-purple band gradient marker.
add("gradient-blue-purple-band", "blue→purple band gradient (any)", slopBandTotal, "gradient");

rows.sort((a, b) => b.sitesPct - a.sitesPct);

const outPath = resolve(ROOT, "data/structural-prevalence.json");
writeFileSync(outPath, JSON.stringify(rows, null, 2) + "\n", "utf8");

console.log(`okSites=${OK}`);
console.log(`wrote ${rows.length} markers -> ${outPath}\n`);
for (const r of rows) {
  console.log(
    `  ${String(r.sitesPct).padStart(5)}%  (${String(r.count).padStart(4)})  [${r.group.padEnd(8)}] ${r.label}`
  );
}
