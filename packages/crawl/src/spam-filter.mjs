#!/usr/bin/env node
/**
 * spam-filter.mjs — stream a geometry-crawl raw ndjson file, score each
 * record for spam / parked-domain / hijacked-WordPress signals, and emit
 * an advisory quarantine list.
 *
 * This script is READ-ONLY with respect to the input corpora. It never
 * mutates good-hosts / genome / corpus files. It only ever appends rows
 * describing hosts it thinks are junk to an output ndjson (quarantine
 * list) that a human reviews before anything gets removed.
 *
 * Usage:
 *   node spam-filter.mjs --input <raw.ndjson> --out <out.ndjson> \
 *        --corpus gallery|main [--hosts <hosts-filter.ndjson>] [--append]
 *
 * --hosts, if given, is an ndjson file with one {host,...} object per
 * line (e.g. good-hosts.gallery.ndjson) — only records whose `host`
 * appears in that file are scored. Useful for scoping the (much larger)
 * gallery raw ndjson down to the 313 kept hosts.
 */

import { createReadStream, createWriteStream } from "node:fs";
import { createInterface } from "node:readline";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------
// Lexicons / phrase lists
// ---------------------------------------------------------------------

// Gambling / casino lexicon — multilingual, heavy on Indonesian SEO spam.
// Scored by WEIGHTED density (matches per 1000 chars), not raw hit
// count. Weight tiers reflect how ambiguous each term is on its own:
//   STRONG  — essentially never appears outside gambling spam
//             (wargaqq, ratucasino, jnt188, udin88, "slot gacor", ...)
//   MEDIUM  — gambling-adjacent but has a few legitimate uses
//             (casino/poker as a theme, "situs" = generic Indonesian
//             "site", "betting" in a non-gambling sense)
//   WEAK    — everyday tech/UI words that only mean anything combined
//             with other hits ("login" is on every SaaS page; "slot"
//             means a time slot as often as a game; "rtp" collides with
//             real-time protocol; "daftar" = generic "list"/"register")
// A single stray "Login" on a 900-char page must NOT hard-flag a real
// VC firm's site (sequoiacap.com) — that's exactly what weighting fixes.
const GAMBLING_TERMS_STRONG = [
  "gacor",
  "judi",
  "togel",
  "sbobet",
  "maxwin",
  "wargaqq",
  "ratucasino",
  "jnt188",
  "udin88",
  "slot gacor",
  "pragmatic",
  "bocoran",
  "link alternatif",
  "taruhan",
  "situs toto",
  "toto slot",
  "toto togel",
  "slot88",
  "scatter hitam",
  "mahjong ways",
];
const GAMBLING_TERMS_MEDIUM = [
  "casino",
  "toto",
  "poker",
  "bandar",
  "situs",
  "betting",
  "slot online",
  "toto",
  "totobet",
  "sportsbook",
  "jackpot",
];
const GAMBLING_TERMS_WEAK = ["slot", "rtp", "daftar", "login"];
const GAMBLING_WEIGHTS = { strong: 3, medium: 1.5, weak: 0.4 };

// Pharma / replica / adult spam. "replica" and "buy cheap" are common
// enough in legit copy (a brand literally named "Replica Studios", "make
// a replica of...") that they're demoted to weak/corroborating signals;
// viagra/cialis/tadalafil/escort are essentially spam-only.
const PHARMA_TERMS_STRONG = ["viagra", "cialis", "tadalafil", "escort"];
const PHARMA_TERMS_WEAK = ["replica", "buy cheap"];

// Parked / for-sale phrases — near-certain signal, HARD flag.
// Deliberately full template phrases (not bare words like "parked" or
// "godaddy") — bare words false-positive on real sites hosted on
// GoDaddy's website builder ("Powered by GoDaddy") or that legitimately
// use the word "parked" in copy. These are the literal strings emitted
// by GoDaddy / Sedo / Wix parking-page templates.
const PARKED_PHRASES_HARD = [
  "domain is for sale",
  "buy this domain",
  "this domain isn't connected to a site",
  "this domain may be for sale",
  "is parked free, courtesy of",
  "available on godaddy auctions",
  "get this domain",
  "hugedomains",
  "sedo.com",
  "find information, resources and relevant links for",
];

// Weak / generic parked-adjacent terms. Common as legitimate UI copy
// ("iOS app coming soon" badges, teaser landing pages that are
// themselves valid design work) so these only ever contribute a small
// soft score, never a hard flag on their own.
const PARKED_PHRASES_SOFT = ["coming soon"];

// WordPress default / abandoned-install phrases.
const WP_DEFAULT_PHRASES = [
  "just another wordpress site",
  "hello world!",
  "edit or delete it, then start writing",
  "edit or delete it then start writing",
  "welcome to wordpress",
];

// Headings that typically precede a link-farm block (sidebar widgets
// stuffed with unrelated external domains via comment spam).
// Deliberately specific (not bare "links" — that matches ordinary nav
// footers like "Quick Links" on virtually any legit site).
const LINK_FARM_HEADINGS = ["recent comments", "recent posts", "blogroll"];

// Registrable-domain suffixes that need 3 labels, not 2
// (co.uk, com.au, ...). Small, pragmatic list — not exhaustive.
const MULTI_LABEL_SLD = new Set([
  "co.uk",
  "org.uk",
  "me.uk",
  "ac.uk",
  "gov.uk",
  "com.au",
  "net.au",
  "org.au",
  "co.jp",
  "ne.jp",
  "or.jp",
  "com.br",
  "co.id",
  "co.in",
  "com.cn",
  "co.nz",
  "co.za",
  "com.sg",
  "com.hk",
  "com.tw",
  "com.mx",
]);

// Curated TLD allowlist for the domain-token scanner used by the
// host-mismatch and link-farm heuristics. Keeps the regex from matching
// abbreviations like "e.g." or version strings.
const KNOWN_TLDS = new Set(
  [
    "com",
    "net",
    "org",
    "io",
    "co",
    "info",
    "biz",
    "online",
    "site",
    "xyz",
    "art",
    "dev",
    "app",
    "shop",
    "store",
    "club",
    "top",
    "win",
    "name",
    "tech",
    "world",
    "live",
    "sy",
    "id",
    "me",
    "tv",
    "cc",
    "us",
    "uk",
    "ca",
    "au",
    "de",
    "fr",
    "nl",
    "ru",
    "cn",
    "jp",
    "in",
    "br",
    "mx",
    "es",
    "it",
    "pl",
    "se",
    "no",
    "dk",
    "fi",
    "ch",
    "at",
    "be",
    "nz",
    "ie",
    "za",
    "kr",
    "sg",
    "hk",
    "tw",
    "th",
    "vn",
    "ph",
    "my",
    "eu",
    "edu",
    "gov",
    "azurewebsites.net", // treated specially below (subdomain host)
  ].map((s) => s.toLowerCase()),
);

// ---------------------------------------------------------------------
// Thresholds (tuned against art.sy as the known-positive)
// ---------------------------------------------------------------------

const THRESHOLDS = {
  gamblingWeightedDensityHard: 4, // weighted matches per 1000 chars -> hard flag
  gamblingWeightedHitsMinForHard: 2, // ...but also require >=2 raw hits (guards tiny pages)
  gamblingDensitySoftWeightPerUnit: 2, // score contribution per density unit
  gamblingDensitySoftCap: 12,
  pharmaStrongWeightPerTerm: 4,
  pharmaWeakWeightPerTerm: 1,
  pharmaCap: 12,
  wpDefaultWeightPerPhrase: 3,
  wpDefaultCap: 6,
  linkFarmDomainCountSoft: 10, // distinct external domains -> soft score
  linkFarmDomainCountHard: 20, // -> hard flag
  linkFarmSoftWeight: 5,
  parkedSoftWeightPerHit: 0.5,
  parkedSoftCap: 2,
  softFlagThreshold: 6, // total score >= this -> flag (non-hard path)
  borderlineFloor: 3, // score >= this but below softFlagThreshold -> borderline
};

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildTermRegex(terms) {
  // Longest-first so multi-word phrases like "slot gacor" aren't shadowed
  // by the single-word "slot" / "gacor" matches (we count both anyway,
  // this just keeps the group predictable).
  const sorted = [...terms].sort((a, b) => b.length - a.length);
  const alts = sorted.map((t) => escapeRegExp(t.toLowerCase()));
  return new RegExp(`\\b(?:${alts.join("|")})\\b`, "gi");
}

const GAMBLING_STRONG_RE = buildTermRegex(GAMBLING_TERMS_STRONG);
const GAMBLING_MEDIUM_RE = buildTermRegex(GAMBLING_TERMS_MEDIUM);
const GAMBLING_WEAK_RE = buildTermRegex(GAMBLING_TERMS_WEAK);
const PHARMA_STRONG_RE = buildTermRegex(PHARMA_TERMS_STRONG);
const PHARMA_WEAK_RE = buildTermRegex(PHARMA_TERMS_WEAK);

const PARKED_HARD_RE = new RegExp(
  PARKED_PHRASES_HARD.map((p) => escapeRegExp(p.toLowerCase())).join("|"),
  "gi",
);
const PARKED_SOFT_RE = new RegExp(
  PARKED_PHRASES_SOFT.map((p) => escapeRegExp(p.toLowerCase())).join("|"),
  "gi",
);
const WP_DEFAULT_RE = new RegExp(
  WP_DEFAULT_PHRASES.map((p) => escapeRegExp(p.toLowerCase())).join("|"),
  "gi",
);

// Domain-token scanner: label(.label)*.TLD, TLD 2-24 alpha chars.
const DOMAIN_TOKEN_RE =
  /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}\b/gi;

// Anchored variant used by the host-mismatch check: the whole (trimmed)
// heading must be nothing but a domain token, optionally wrapped in
// light punctuation (quotes, trailing period) — not embedded mid-sentence.
const DOMAIN_TOKEN_FULL_RE =
  /^[."'“”‘’\s]*(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}[."'“”‘’\s]*$/i;

function extractDomainTokens(text) {
  const found = new Set();
  const matches = text.toLowerCase().match(DOMAIN_TOKEN_RE) || [];
  for (const m of matches) {
    const cleaned = m.replace(/^\.+|\.+$/g, "");
    const labels = cleaned.split(".");
    const tld = labels[labels.length - 1];
    if (KNOWN_TLDS.has(tld)) {
      found.add(cleaned);
    } else if (labels.length >= 3 && KNOWN_TLDS.has(labels.slice(-2).join("."))) {
      found.add(cleaned);
    }
  }
  return found;
}

function registrableDomain(domain) {
  const d = domain.toLowerCase().replace(/^www\./, "");
  const labels = d.split(".");
  if (labels.length < 2) return d;
  const lastTwo = labels.slice(-2).join(".");
  if (labels.length >= 3 && MULTI_LABEL_SLD.has(lastTwo)) {
    return labels.slice(-3).join(".");
  }
  return lastTwo;
}

function countMatches(re, text) {
  const m = text.match(re);
  return m ? m.length : 0;
}

/**
 * Pull all visible text + section headings out of one geometry-crawl
 * record. Prefers the desktop capture, falls back to mobile if desktop
 * failed. Returns null if neither viewport has usable data (e.g.
 * ok:false / desktop:null crawl failures — nothing to score).
 */
function collectRecordText(record) {
  const viewport =
    record.desktop && Array.isArray(record.desktop.elements)
      ? record.desktop
      : record.mobile && Array.isArray(record.mobile.elements)
        ? record.mobile
        : null;
  if (!viewport) return null;

  const snippetParts = [];
  for (const el of viewport.elements) {
    if (el.textSnippet) snippetParts.push(el.textSnippet);
  }

  const headings = [];
  for (const s of viewport.sections || []) {
    if (s.heading) headings.push(String(s.heading));
  }

  const allText = [...snippetParts, ...headings].join(" ");
  return { allText, headings };
}

/**
 * Score one record. Returns null if there's nothing to score (crawl
 * failure / empty page — that's the existing blank-detector's job, not
 * ours).
 */
function scoreRecord(record) {
  const collected = collectRecordText(record);
  if (!collected) return null;
  const { allText, headings } = collected;
  const text = allText.trim();
  if (text.length === 0) return null;

  const textLower = text.toLowerCase();
  const charCount = text.length;

  const signals = [];
  let score = 0;
  let hardFlag = false;

  // --- Gambling lexicon density (weighted by term specificity) ---------
  const gamblingStrongHits = countMatches(GAMBLING_STRONG_RE, textLower);
  const gamblingMediumHits = countMatches(GAMBLING_MEDIUM_RE, textLower);
  const gamblingWeakHits = countMatches(GAMBLING_WEAK_RE, textLower);
  const gamblingRawHits = gamblingStrongHits + gamblingMediumHits + gamblingWeakHits;
  const gamblingWeightedHits =
    gamblingStrongHits * GAMBLING_WEIGHTS.strong +
    gamblingMediumHits * GAMBLING_WEIGHTS.medium +
    gamblingWeakHits * GAMBLING_WEIGHTS.weak;
  const gamblingDensity = (gamblingWeightedHits / Math.max(charCount, 1)) * 1000;
  if (
    gamblingDensity >= THRESHOLDS.gamblingWeightedDensityHard &&
    gamblingRawHits >= THRESHOLDS.gamblingWeightedHitsMinForHard
  ) {
    hardFlag = true;
    signals.push(
      `gambling-lexicon-dense(weightedDensity=${gamblingDensity.toFixed(2)}/1k,rawHits=${gamblingRawHits},strong=${gamblingStrongHits},medium=${gamblingMediumHits},weak=${gamblingWeakHits})`,
    );
  } else if (gamblingWeightedHits > 0) {
    const weight = Math.min(
      gamblingDensity * THRESHOLDS.gamblingDensitySoftWeightPerUnit,
      THRESHOLDS.gamblingDensitySoftCap,
    );
    if (weight > 0) {
      score += weight;
      signals.push(
        `gambling-lexicon(weightedDensity=${gamblingDensity.toFixed(2)}/1k,rawHits=${gamblingRawHits},strong=${gamblingStrongHits},medium=${gamblingMediumHits},weak=${gamblingWeakHits})`,
      );
    }
  }

  // --- Pharma / replica / adult spam ----------------------------------
  const pharmaStrongHits = countMatches(PHARMA_STRONG_RE, textLower);
  const pharmaWeakHits = countMatches(PHARMA_WEAK_RE, textLower);
  if (pharmaStrongHits > 0 || pharmaWeakHits > 0) {
    const weight = Math.min(
      pharmaStrongHits * THRESHOLDS.pharmaStrongWeightPerTerm +
        pharmaWeakHits * THRESHOLDS.pharmaWeakWeightPerTerm,
      THRESHOLDS.pharmaCap,
    );
    score += weight;
    signals.push(
      `pharma-adult-spam(strongHits=${pharmaStrongHits},weakHits=${pharmaWeakHits})`,
    );
  }

  // --- Parked / for-sale phrases ---------------------------------------
  const parkedHardHits = countMatches(PARKED_HARD_RE, textLower);
  if (parkedHardHits > 0) {
    hardFlag = true;
    signals.push(`parked-domain(hits=${parkedHardHits})`);
  }
  const parkedSoftHits = countMatches(PARKED_SOFT_RE, textLower);
  if (parkedSoftHits > 0) {
    const weight = Math.min(
      parkedSoftHits * THRESHOLDS.parkedSoftWeightPerHit,
      THRESHOLDS.parkedSoftCap,
    );
    score += weight;
    signals.push(`parked-weak-signal(coming-soon-hits=${parkedSoftHits})`);
  }

  // --- WordPress default / abandoned install ----------------------------
  const wpHits = countMatches(WP_DEFAULT_RE, textLower);
  if (wpHits > 0) {
    const weight = Math.min(
      wpHits * THRESHOLDS.wpDefaultWeightPerPhrase,
      THRESHOLDS.wpDefaultCap,
    );
    score += weight;
    signals.push(`wordpress-default(hits=${wpHits})`);
  }

  // --- Link-farm heuristic ---------------------------------------------
  const hasLinkFarmHeading = headings.some((h) =>
    LINK_FARM_HEADINGS.some((lfh) => h.toLowerCase().includes(lfh)),
  );
  const domainTokens = extractDomainTokens(text);
  const hostRegistrable = record.host ? registrableDomain(record.host) : null;
  const externalDomainCount = [...domainTokens].filter(
    (d) => registrableDomain(d) !== hostRegistrable,
  ).length;
  if (hasLinkFarmHeading && externalDomainCount >= THRESHOLDS.linkFarmDomainCountSoft) {
    score += THRESHOLDS.linkFarmSoftWeight;
    signals.push(
      `link-farm(distinctExternalDomains=${externalDomainCount},heading=true)`,
    );
    if (externalDomainCount >= THRESHOLDS.linkFarmDomainCountHard) {
      hardFlag = true;
      signals.push(`link-farm-dense(distinctExternalDomains=${externalDomainCount})`);
    }
  } else if (externalDomainCount >= THRESHOLDS.linkFarmDomainCountHard) {
    // Very high raw domain-token count even without a "Recent Comments"
    // style heading is still worth flagging (soft), just not hard.
    score += THRESHOLDS.linkFarmSoftWeight;
    signals.push(`link-farm(distinctExternalDomains=${externalDomainCount},heading=false)`);
  }

  // --- Host <-> content mismatch ----------------------------------------
  // Only look at headings (semantically prominent: h1-ish / site title /
  // footer brand line) to keep the false-positive rate low. Crucially,
  // the heading text must be (almost) ENTIRELY the domain token — not a
  // domain-looking substring embedded in a sentence. That anchoring
  // matters: DOM text concatenation frequently drops the space after a
  // sentence-ending period ("AI coding.No cloud."), which otherwise
  // looks exactly like a domain ("coding.no") to a bare regex scan. A
  // real "this page's brand is domain X" heading (art.sy's
  // "canadagooseoutlet-online.com") is the *entire* heading, standalone.
  if (hostRegistrable) {
    for (const h of headings) {
      const trimmed = h.trim();
      if (!DOMAIN_TOKEN_FULL_RE.test(trimmed)) continue;
      const tokens = extractDomainTokens(trimmed);
      for (const t of tokens) {
        const tReg = registrableDomain(t);
        if (tReg === hostRegistrable) continue;
        // Require the two registrable domains to share no common
        // alphabetic root (avoids flagging e.g. "shop.example.com" vs
        // "example.com" typos or legit multi-brand sites).
        const hostRoot = hostRegistrable.split(".")[0];
        const tRoot = tReg.split(".")[0];
        if (hostRoot.length >= 3 && tRoot.includes(hostRoot)) continue;
        if (tRoot.length >= 3 && hostRoot.includes(tRoot)) continue;
        hardFlag = true;
        signals.push(`host-mismatch(host=${record.host},pageBrand=${t})`);
      }
    }
  }

  score = Math.round(score * 10) / 10;

  return { score, signals, hardFlag, textSample: text.slice(0, 120), charCount };
}

// ---------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------

function parseArgs(argv) {
  const out = { append: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--input") out.input = argv[++i];
    else if (a === "--out") out.out = argv[++i];
    else if (a === "--corpus") out.corpus = argv[++i];
    else if (a === "--hosts") out.hosts = argv[++i];
    else if (a === "--append") out.append = true;
    else if (a === "--report-json") out.reportJson = argv[++i];
  }
  return out;
}

async function loadHostFilter(hostsPath) {
  if (!hostsPath) return null;
  const set = new Set();
  const rl = createInterface({
    input: createReadStream(hostsPath, "utf8"),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      if (obj.host) set.add(obj.host);
    } catch {
      // ignore malformed lines
    }
  }
  return set;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input || !args.out || !args.corpus) {
    console.error(
      "Usage: node spam-filter.mjs --input <raw.ndjson> --out <out.ndjson> --corpus gallery|main [--hosts <hosts.ndjson>] [--append]",
    );
    process.exit(1);
  }

  const hostFilter = await loadHostFilter(args.hosts);

  const rl = createInterface({
    input: createReadStream(args.input, "utf8"),
    crlfDelay: Infinity,
  });

  let totalRecords = 0;
  let scoredRecords = 0;
  // Dedupe by host: the raw ndjson can contain more than one record for
  // the same host (re-crawls). Keep only the highest-scoring occurrence
  // per host so the output file has exactly one line per flagged host.
  const flaggedByHost = new Map();
  const borderlineByHost = new Map();

  for await (const line of rl) {
    if (!line.trim()) continue;
    totalRecords++;
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }
    if (hostFilter && !hostFilter.has(record.host)) continue;

    const result = scoreRecord(record);
    if (!result) continue;
    scoredRecords++;

    const isFlagged =
      result.hardFlag || result.score >= THRESHOLDS.softFlagThreshold;
    const isBorderline =
      !isFlagged && result.score >= THRESHOLDS.borderlineFloor;

    if (isFlagged) {
      const row = {
        host: record.host,
        corpus: args.corpus,
        score: result.score,
        hardFlag: result.hardFlag,
        signals: result.signals,
        sample: result.textSample,
      };
      const existing = flaggedByHost.get(record.host);
      if (!existing || row.score > existing.score) {
        flaggedByHost.set(record.host, row);
      }
    } else if (isBorderline) {
      const row = {
        host: record.host,
        corpus: args.corpus,
        score: result.score,
        signals: result.signals,
        sample: result.textSample,
      };
      const existing = borderlineByHost.get(record.host);
      if (!existing || row.score > existing.score) {
        borderlineByHost.set(record.host, row);
      }
    }
  }

  const flagged = [...flaggedByHost.values()].sort((a, b) => b.score - a.score);
  const borderline = [...borderlineByHost.values()].sort(
    (a, b) => b.score - a.score,
  );

  const outStream = createWriteStream(args.out, {
    flags: args.append ? "a" : "w",
  });
  for (const row of flagged) {
    outStream.write(JSON.stringify(row) + "\n");
  }
  await new Promise((resolve) => outStream.end(resolve));

  const flaggedCount = flagged.length;
  const borderlineCount = borderline.length;

  const summary = {
    corpus: args.corpus,
    input: args.input,
    totalRecords,
    scoredRecords,
    flaggedCount,
    borderlineCount,
    flagged,
    borderline,
  };

  if (args.reportJson) {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(args.reportJson, JSON.stringify(summary, null, 2));
  }

  console.log(
    `[${args.corpus}] records=${totalRecords} scored=${scoredRecords} flagged=${flaggedCount} borderline=${borderlineCount}`,
  );
}

const isMain =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { scoreRecord, collectRecordText, registrableDomain, extractDomainTokens, THRESHOLDS };
