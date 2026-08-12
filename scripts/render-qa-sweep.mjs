// render-qa-sweep.mjs — load each rendered page, run the geometric QA at several widths, screenshot.
// Standalone: uses the repo's playwright, loads file:// directly. Single source of truth for the
// checker is data/tmp/luna-val/render-qa.js (injected into the page).
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "data", "tmp", "luna-val");
const QA_SRC = readFileSync(join(DIR, "render-qa.js"), "utf8");
// realistic (width, height) pairs — fold checks need real screen HEIGHTS, not just widths
const VIEWPORTS = [[1440, 900], [1366, 768], [1280, 800], [768, 1024], [390, 844]];
const PAGES = ["var-0", "var-1", "var-2", "var-3"];
const OVERRIDE = '*{opacity:1!important;transform:none!important;animation:none!important;transition:none!important;}';

const browser = await chromium.launch();
const ctx = await browser.newContext();
const report = {};

for (const name of PAGES) {
  const page = await ctx.newPage();
  const url = pathToFileURL(join(DIR, `${name}.html`)).href;
  await page.goto(url, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1600); // let reveal fallback + fonts settle
  report[name] = { widths: {} };
  for (const [w, h] of VIEWPORTS) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(200);
    const r = await page.addScriptTag({ content: QA_SRC }).then(() => page.evaluate(() => window.renderQA())).catch((e) => ({ error: String(e).slice(0, 80) }));
    report[name].widths[`${w}x${h}`] = r;
  }
  // clean screenshot at 1280 (force-visible so reveal never blanks it)
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addStyleTag({ content: OVERRIDE }).catch(() => {});
  await page.waitForTimeout(150);
  await page.screenshot({ path: join(ROOT, `qa-${name}.png`), fullPage: true }).catch(() => {});
  await page.close();
}
await browser.close();

// compact console summary
const fmt = (r) => r.error ? `ERR` : `geom:${r.pass ? "PASS" : "FAIL"}  fold:${r.foldOk ? "OK  " : "BELOW"}  hero:${r.fold?.heroHeightPx}/${r.fold?.vh}px  [vpo:${r.viewportOverflowCount} clip:${r.textClippedCount} olap:${r.overlapCount}]`;
for (const name of PAGES) {
  console.log(`\n=== ${name} ===`);
  for (const [w, h] of VIEWPORTS) {
    const r = report[name].widths[`${w}x${h}`];
    console.log(`  ${String(w + "x" + h).padStart(9)}  ${fmt(r)}`);
    if (r && !r.error) {
      for (const o of (r.overlap || [])) console.log(`         overlap: "${o.a}" ✕ "${o.b}" (${o.pct}%)`);
      for (const o of (r.viewportOverflow || []).slice(0, 2)) console.log(`         vp-overflow: <${o.tag}.${o.cls}> +${o.over}px "${o.txt}"`);
      for (const o of (r.textClipped || []).slice(0, 2)) console.log(`         clipped: "${o.txt}" +${o.clippedPx}px`);
      if (r.fold?.heroExceedsViewport) console.log(`         hero SECTION spills ${r.fold.heroSpillPx}px past the fold (doesn't fit one viewport)`);
      for (const b of (r.fold?.below || [])) console.log(`         must-see below-fold: ${b.what} is ${b.byPx}px under`);
    }
  }
}
console.log("\nJSON " + JSON.stringify(report));
