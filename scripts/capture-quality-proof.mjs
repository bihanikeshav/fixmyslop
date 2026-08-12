import { createServer } from "node:http";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "data", "tmp", "quality-proof");
const MIME = { ".html": "text/html", ".json": "application/json", ".ttf": "font/ttf", ".woff2": "font/woff2", ".md": "text/markdown" };

const server = createServer((req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname);
    const candidate = path.resolve(ROOT, `.${pathname}`);
    if (!candidate.startsWith(ROOT)) throw new Error("outside root");
    const file = statSync(candidate).isDirectory() ? path.join(candidate, "index.html") : candidate;
    res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(readFileSync(file));
  } catch {
    res.writeHead(404); res.end("not found");
  }
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const browser = await chromium.launch({ headless: true });
const results = [];
for (const item of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
]) {
  const page = await browser.newPage({ viewport: { width: item.width, height: item.height }, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${port}/data/tmp/quality-proof/`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
  const checks = await page.evaluate(() => ({
    title: document.title,
    fontStatus: document.querySelector("#font-status")?.textContent,
    fontGate: document.querySelector("#font-status")?.dataset.pass === "true",
    overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    bodyMeasure: Math.round(document.querySelector(".story-copy")?.getBoundingClientRect().width || 0),
    heroHeight: Math.round(document.querySelector(".hero")?.getBoundingClientRect().height || 0),
    instrumentVisible: document.querySelector(".instrument")?.getBoundingClientRect().width > 0,
  }));
  await page.screenshot({ path: path.join(OUT, `${item.name}.png`), fullPage: true });
  await page.screenshot({ path: path.join(OUT, `${item.name}-viewport.png`), fullPage: false });
  results.push({ ...item, checks });
  await page.close();
}
await browser.close();
server.close();
console.log(JSON.stringify({ screenshots: OUT, results }, null, 2));
