import { createServer } from "node:http";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "data", "tmp", "more-proofs");
const MIME = { ".html": "text/html", ".json": "application/json", ".ttf": "font/ttf", ".woff2": "font/woff2", ".md": "text/markdown" };
const ids = ["observability-console", "editorial-archive", "music-launch", "civic-library"];

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
for (const id of ids) {
  const result = { id, viewports: [] };
  for (const viewport of [{ name: "desktop", width: 1440, height: 900 }, { name: "mobile", width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
    await page.goto(`http://127.0.0.1:${port}/data/tmp/more-proofs/${id}/`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(450);
    const checks = await page.evaluate(() => ({
      title: document.title,
      fontGate: document.body.dataset.fonts === "pass",
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      heroVisible: document.querySelector(".hero h1")?.getBoundingClientRect().width > 0,
      centrepieceVisible: !!document.querySelector(".hero-card, .console, .archive-stage, .wave-wrap, .map-panel"),
      pageHeight: Math.round(document.documentElement.scrollHeight),
      overflowing: [...document.querySelectorAll("body *")].map((el) => {
        const r = el.getBoundingClientRect();
        return { tag: el.tagName.toLowerCase(), text: String(el.textContent || "").trim().slice(0, 30), className: String(el.className || ""), parent: String(el.parentElement?.className || ""), left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) };
      }).filter((row) => row.left < -1 || row.right > document.documentElement.clientWidth + 1).slice(0, 8),
    }));
    await page.screenshot({ path: path.join(OUT, id, `${viewport.name}.png`), fullPage: true });
    await page.screenshot({ path: path.join(OUT, id, `${viewport.name}-viewport.png`), fullPage: false });
    result.viewports.push({ ...viewport, checks });
    await page.close();
  }
  results.push(result);
}
await browser.close();
server.close();
writeFileSync(path.join(OUT, "capture-report.json"), JSON.stringify({ schemaVersion: "quality-proof-capture.v2", generatedAt: new Date().toISOString(), results }, null, 2) + "\n");
console.log(JSON.stringify({ screenshots: OUT, results }, null, 2));
