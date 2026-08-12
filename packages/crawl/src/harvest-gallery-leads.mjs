/**
 * Harvest destination hosts from the newly discovered design-gallery sources.
 *
 * This is intentionally a source-lead harvester, not the layout parser:
 * - it never writes existing raw crawl records;
 * - it records robots/diagnosis information;
 * - it keeps gallery pages and screenshots out of the destination corpus;
 * - it leaves crawling to crawl-features.ts with the rich-capture recipe.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const ROOT = path.basename(process.cwd()) === "crawl" && path.basename(path.dirname(process.cwd())) === "packages" ? path.resolve(process.cwd(), "../..") : process.cwd();
const OUT = path.join(ROOT, "data", "layout-crawl", "master-v2");
fs.mkdirSync(OUT, { recursive: true });

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36 fixmyslop-gallery-research/2.0";
const SOURCES = [
  { id: "curated-design", source: "gallery:curated.design", url: "https://craftwork.design/curated/websites", roots: ["craftwork.design"] },
  { id: "landing-gallery", source: "gallery:landing.gallery", url: "https://www.landing.gallery/", roots: ["landing.gallery"] },
  { id: "saaslandingpage", source: "gallery:saaslandingpage", url: "https://saaslandingpage.com/", roots: ["saaslandingpage.com"] },
  { id: "webinspoo", source: "gallery:webinspoo", url: "https://webinspoo.com/", roots: ["webinspoo.com"] },
  { id: "siiimple", source: "gallery:siiimple", url: "https://siiimple.com/", roots: ["siiimple.com"] },
  { id: "collected", source: "gallery:collected", url: "https://collected.li/", roots: ["collected.li"] },
  { id: "vizzzle", source: "gallery:vizzzle", url: "https://vizzzle.com/", roots: ["vizzzle.com"] },
  { id: "a1-gallery", source: "gallery:a1", url: "https://www.a1.gallery/", roots: ["a1.gallery"] },
  { id: "webspirre", source: "gallery:webspirre", url: "https://www.webspirre.com/", roots: ["webspirre.com"] },
  { id: "collectui", source: "gallery:collectui", url: "https://collectui.com/", roots: ["collectui.com"] }
];
const requestedSources = new Set((process.argv.find((arg) => arg.startsWith("--sources=")) || "").slice(10).split(",").filter(Boolean));
const runSources = requestedSources.size ? SOURCES.filter((source) => requestedSources.has(source.id)) : SOURCES;

const readJson = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const existing = new Set((readJson("data/site-list.json") || []).map((x) => String(x.host || "").toLowerCase()).filter(Boolean));
const oldGallery = path.join(ROOT, "data", "layout-crawl", "good-hosts.gallery.v2.ndjson");
if (fs.existsSync(oldGallery)) for (const line of fs.readFileSync(oldGallery, "utf8").split(/\r?\n/)) if (line.trim()) { try { existing.add(String(JSON.parse(line).host || "").toLowerCase()); } catch {} }

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const hostOf = (href) => { try { return new URL(href).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; } };
const registrable = (host) => {
  const parts = host.split(".").filter(Boolean);
  if (parts.length <= 2) return parts.join(".");
  const cc = new Set(["co.uk", "com.au", "co.nz", "com.br", "co.jp", "co.in", "com.sg"]);
  const suffix = parts.slice(-2).join(".");
  return cc.has(suffix) ? parts.slice(-3).join(".") : parts.slice(-2).join(".");
};
const isNoise = (href, rootHosts) => {
  const h = hostOf(href);
  if (!h || rootHosts.some((r) => h === r || h.endsWith(`.${r}`))) return true;
  if (/^(javascript:|mailto:|tel:|#)/i.test(href)) return true;
  if (/(facebook|instagram|linkedin|twitter|x\.com|youtube|tiktok|pinterest|google\.com|fonts\.|cdn\.|cloudflare)/i.test(h)) return true;
  if (/\.(pdf|zip|png|jpe?g|gif|webp|svg|mp4|mov)(\?|$)/i.test(href)) return true;
  return false;
};
const robotsStatus = async (url) => {
  try {
    const origin = new URL(url).origin;
    const r = await fetch(`${origin}/robots.txt`, { headers: { "user-agent": USER_AGENT } });
    const text = await r.text();
    const disallowAll = /user-agent:\s*\*[^]*?disallow:\s*\/\s*(?:$|\n)/i.test(text);
    return { status: r.status, disallowAll, url: `${origin}/robots.txt` };
  } catch (error) { return { status: 0, disallowAll: true, error: String(error.message || error) }; }
};

async function collectPage(page, source, url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForTimeout(900);
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(350);
  }
  return page.evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => ({
    href: a.href,
    text: (a.textContent || "").replace(/\s+/g, " ").trim().slice(0, 180),
    title: a.getAttribute("title") || "",
    rel: a.rel || ""
  })));
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ userAgent: USER_AGENT, viewport: { width: 1440, height: 900 }, locale: "en-US" });
const page = await context.newPage();
const candidates = [];
const reports = [];

for (const source of runSources) {
  const robots = await robotsStatus(source.url);
  const report = { source: source.id, sourceUrl: source.url, robots, pages: 0, detailPages: 0, directLinks: 0, skipped: false, errors: [] };
  if (robots.disallowAll) { report.skipped = true; reports.push(report); continue; }
  try {
    const links = await collectPage(page, source, source.url);
    report.pages++;
    const internal = [];
    for (const link of links) {
      const host = hostOf(link.href);
      if (!host) continue;
      if (!isNoise(link.href, source.roots)) {
        const destination = registrable(host);
        if (!existing.has(destination) && !candidates.some((x) => x.host === destination)) {
          candidates.push({ host: destination, url: `https://${host}/`, source: source.source, sourceUrl: source.url, galleryMeta: { category: null, tags: [], label: link.text || link.title || null }, harvestEvidence: "direct-outbound-link", dropped: false, seedQuality: "gallery-curated" });
          report.directLinks++;
        }
      } else if (host === source.roots[0] || source.roots.some((r) => host === r || host.endsWith(`.${r}`))) {
        const pathName = (() => { try { return new URL(link.href).pathname; } catch { return ""; } })();
        if (pathName !== "/" && /detail|site|website|inspiration|design|project|entry|post|item/i.test(pathName)) internal.push(link.href);
      }
    }
    const detailLimit = process.argv.includes("--details") ? 5 : 0;
    for (const detail of [...new Set(internal)].slice(0, detailLimit)) {
      await sleep(500);
      try {
        const detailLinks = await collectPage(page, source, detail);
        report.pages++;
        report.detailPages++;
        for (const link of detailLinks) {
          const host = hostOf(link.href);
          if (!host || isNoise(link.href, source.roots)) continue;
          const destination = registrable(host);
          if (existing.has(destination) || candidates.some((x) => x.host === destination)) continue;
          candidates.push({ host: destination, url: `https://${host}/`, source: source.source, sourceUrl: detail, galleryMeta: { category: null, tags: [], label: link.text || link.title || "detail visit link" }, harvestEvidence: "detail-page-outbound-link", dropped: false, seedQuality: "gallery-curated" });
          report.directLinks++;
        }
      } catch (error) { report.errors.push(`detail:${detail}:${String(error.message || error).slice(0, 180)}`); }
    }
  } catch (error) { report.errors.push(String(error.message || error).slice(0, 240)); }
  reports.push(report);
  await sleep(800);
}
await browser.close();

const outCandidates = path.join(OUT, "harvest.gallery-leads.v1.ndjson");
const prior = process.argv.includes("--append") && fs.existsSync(outCandidates)
  ? fs.readFileSync(outCandidates, "utf8").split(/\r?\n/).filter(Boolean).flatMap((line) => { try { return [JSON.parse(line)]; } catch { return []; } })
  : [];
const merged = [...prior, ...candidates].filter((x, i, xs) => xs.findIndex((y) => y.host === x.host) === i);
fs.writeFileSync(outCandidates, `${merged.map((x) => JSON.stringify(x)).join("\n")}\n`);
fs.writeFileSync(path.join(OUT, "harvest.gallery-leads.v1.json"), `${JSON.stringify({ schemaVersion: "gallery-harvest-leads.v1", harvestedAt: new Date().toISOString(), userAgent: USER_AGENT, existingHostCount: existing.size, priorCandidateCount: prior.length, candidateCount: merged.length, reports, output: outCandidates }, null, 2)}\n`);
console.log(JSON.stringify({ candidateCount: merged.length, newCandidates: candidates.length, reports }, null, 2));
