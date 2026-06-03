/**
 * Probe the deterministic style fingerprint on real sites.
 *   npx tsx src/style-probe.ts https://a.com https://b.com
 */

import { withBrowser, withPage } from "./extract.js";
import { extractStyle, type StyleFingerprint } from "./style.js";

async function main(): Promise<void> {
  const urls = process.argv.slice(2);
  if (urls.length === 0) {
    console.log("usage: tsx src/style-probe.ts <url> [url...]");
    return;
  }
  await withBrowser(async (browser) => {
    for (const url of urls) {
      const fp = await withPage(browser, url, extractStyle);
      console.log(`\n=== ${url} ===`);
      if (!fp) { console.log("  (failed to load)"); continue; }
      report(fp);
    }
  });
}

function report(fp: StyleFingerprint): void {
  const tells: string[] = [];
  if (fp.aiPurpleGradient) tells.push("AI purple gradient");
  if (fp.gradientText) tells.push("gradient-text heading");
  if (fp.glassmorphism) tells.push("glassmorphic blur");
  if (fp.pillButtons) tells.push("pill buttons");
  if (fp.avgCornerRadiusPx >= 12) tells.push(`rounded corners (~${fp.avgCornerRadiusPx}px)`);
  if (fp.uppercaseHeadings) tells.push("uppercase headings");
  if (fp.tightHeroTracking) tells.push("tight hero tracking");

  console.log("  slop tells:", tells.length ? tells.join(", ") : "(none detected)");
  console.log("  gradients:", fp.gradients.length, fp.gradients[0] ? `e.g. ${fp.gradients[0].kind} ${fp.gradients[0].colors.slice(0, 3).join("→")}` : "");
  console.log("  accent palette:", fp.accentColors.join(" "));
  console.log("  hero:", `${Math.round(fp.heroFontSizePx)}px`, fp.shadowUsage, "shadowed els");
  console.log("  animation libs:", fp.animationLibraries.length ? fp.animationLibraries.join(", ") : "(none / JS-inlined)");
  console.log("  keyframes:", fp.keyframeAnimations.slice(0, 5).map((k) => `${k.name}[${k.props.join(",")}]`).join("  ") || "(none same-origin)");
}

main().catch((e) => { console.error(e); process.exit(1); });
