/**
 * Derive the data-track artifacts from geometry-crawl-raw.v2.ndjson.
 *
 * This is deliberately a data script, not engine code. It never writes to
 * apps/engine or apps/worker. It keeps quality and slop as independent labels;
 * deterministic matches are review candidates, not ground truth.
 *
 * Usage:
 *   npx tsx src/derive-layout-data.ts
 *   npx tsx src/derive-layout-data.ts --raw data/geometry-crawl-raw.v2.ndjson
 */

import { createReadStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { dirname, resolve } from "node:path";

const HERE = dirname(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (m) => m.slice(1)));
const ROOT = resolve(HERE, "../../..");
const DATA = resolve(ROOT, "data");
const RAW_DEFAULT = resolve(DATA, "geometry-crawl-raw.v2.ndjson");
const OUT = resolve(DATA, "layout-crawl");
const REVIEW_PATH = resolve(OUT, "manual-review.v1.json");
const SLOP_TAXONOMY_PROVENANCE = [
  { source: "impeccable.style/slop", role: "seed taxonomy", note: "pattern names and failure modes are hypotheses, not objective truth" },
  { source: "skills/personality/reference/slop-manifest.md", role: "repository ban-list seed", note: "includes the repo's measured signals and the Impeccable/Taste-derived catalogue" },
  { source: "docs/research/2026-08-03-intent-style-layout-space-spec.md", role: "validation policy", note: "frequency is not quality; a pattern becomes slop only when unmotivated, interchangeable, or harmful in context" },
];

type AnyRecord = Record<string, any>;

const clamp01 = (value: number, fallback = 0.5): number => {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(1, value));
};
const round = (value: number, digits = 4): number => Number(value.toFixed(digits));
const median = (values: number[]): number => {
  const xs = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!xs.length) return 0;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid]! : (xs[mid - 1]! + xs[mid]!) / 2;
};
const hash = (value: string): string => {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
};
const safePath = (value: string): string => value.replace(/\\/g, "/");

function parseArgs(argv: string[]): { raw: string; outVersion: string } {
  const out = { raw: RAW_DEFAULT, outVersion: "v1" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--raw" && argv[i + 1]) out.raw = resolve(argv[++i]!);
    else if (argv[i] === "--out-version" && argv[i + 1]) out.outVersion = argv[++i]!;
  }
  return out;
}

function pageKindOf(record: AnyRecord): string {
  const urlHaystack = `${record.url || ""} ${record.host || ""}`.toLowerCase();
  const pageText = `${record.desktop?.sections?.map((s: AnyRecord) => `${s.role} ${s.heading || ""}`).join(" ") || ""} ${record.desktop?.elements?.slice(0, 220).map((e: AnyRecord) => e.textSnippet || "").join(" ") || ""}`.toLowerCase();
  const haystack = `${urlHaystack} ${pageText}`;
  const roles = new Set((record.desktop?.sections || []).map((section: AnyRecord) => section.role));
  const explicitPricingUrl = /\b(pricing|plans?|billing|subscription)\b/.test(urlHaystack);
  const standalonePricing = roles.has("pricing") && !roles.has("hero") && /\b(price|plan|monthly|annual|billing|subscription)\b/.test(pageText);
  if (explicitPricingUrl || standalonePricing) return "pricing";
  if (/\b(docs?|documentation|api-reference|reference|changelog)\b/.test(urlHaystack) ||
    /table of contents|on this page|documentation body|api reference|edit this page/.test(pageText) ||
    (record.desktop?.elements || []).some((e: AnyRecord) => e.landmarkRole === "complementary")) return "docs";
  if (/\b(dashboard|admin|console|analytics|monitor)\b/.test(urlHaystack)) return "dashboard";
  if (/\b(app|workspace|workbench|editor)\b/.test(urlHaystack) || /agent mode|connect your github|ask anything|primary workspace/.test(pageText)) return "app";
  if (/\b(portfolio|gallery|selected work|case studies)\b/.test(haystack)) return "portfolio";
  if (/\b(blog|article|journal|editorial|opinion)\b/.test(urlHaystack) || /latest research from|research articles/.test(pageText)) return "editorial";
  if (roles.has("faq") || roles.has("proof") || roles.has("features")) return "product-with-proof";
  if (/\b(diagram|architecture|how it works|explain)\b/.test(haystack)) return "explain";
  if (roles.has("hero") || roles.has("cta")) return "landing";
  return "marketing";
}

// Roles a section may reclassify into from the captured signals. Keyword rules
// are checked against the section heading text first (cheapest, highest-precision
// signal); landmark/textRole/position signals are the fallback for headings that
// don't name themselves.
// "pricing" and "testimonial" are NOT in this generic keyword table: both
// need evidence beyond a bare word match (a nav link that says "Pricing", or
// body copy that says "see reviews", must not flip the section's role) — see
// priceTokenCount and isTestimonialShape, checked explicitly before this
// table is consulted in reclassifySectionRole.
const SECTION_KEYWORD_RULES: Array<[string, RegExp]> = [
  ["faq", /\b(faq|frequently asked questions?)\b/i],
  ["proof", /\b(trusted by|as seen in|backed by|our customers|case stud(y|ies)|used by|partners?)\b/i],
  ["features", /\b(features?|capabilit(y|ies)|how it works|what you get)\b/i],
  ["cta", /\b(get started|sign up|start (for )?free|try (it |for )?free|book a demo|request a demo|contact (us|sales)|talk to (us|sales))\b/i],
  ["footer", /^footer$/i],
  ["nav", /\b(nav(igation)?|menu)\b/i],
];

// Sections are a separate semantic-detection pass over the page, not
// necessarily a DOM ancestor of the elements that visually belong to them
// (e.g. a "nav" section's real link content can live in a DOM subtree whose
// parentId chain climbs straight past the nav section element to the hero
// container, if the site portals/reflows its header markup). Assign each
// element to the SMALLEST section rect that spatially contains its center —
// geometry is the reliable signal here, DOM ancestry is not.
function elementsBySection(elements: AnyRecord[], sections: AnyRecord[]): Map<string, AnyRecord[]> {
  const ordered = sections
    .filter((s) => s.id && s.rect)
    .map((s) => ({ id: s.id as string, rect: s.rect as AnyRecord, area: Math.max(1, Number(s.rect.width || 0) * Number(s.rect.height || 0)) }))
    .sort((a, b) => a.area - b.area);
  const map = new Map<string, AnyRecord[]>();
  for (const el of elements) {
    if (!el.rect) continue;
    const cx = Number(el.rect.x || 0) + Number(el.rect.width || 0) / 2;
    const cy = Number(el.rect.y || 0) + Number(el.rect.height || 0) / 2;
    for (const s of ordered) {
      if (cx >= s.rect.x && cx <= s.rect.x + s.rect.width && cy >= s.rect.y && cy <= s.rect.y + s.rect.height) {
        if (!map.has(s.id)) map.set(s.id, []);
        map.get(s.id)!.push(el);
        break; // smallest containing section wins
      }
    }
  }
  return map;
}

// A bare section heading ("Free", "Pro") often hides the real signal one
// level down (child text like "$0/Monthly", "billed annually"). Search a
// short aggregate of heading + child heading/body snippets so keyword rules
// see what a human skimming the section would see.
// BUG 2 fix: the old PRICE_PATTERN (`\$\s?\d` alone) fired on a bare "$" next
// to ANY number — view counts, dates, ordinary dollar amounts in body copy —
// which is how a video-thumbnail grid with view counts (futuretools.io) or a
// video+logo hero (groq.com) got mislabeled "pricing" with no pricing table
// in sight. Real price evidence is a currency+number+period token
// ("$49/mo", "$12 per user", "billed annually") OR a bare "$NN" sitting next
// to a tier word (Free/Pro/Plus/Enterprise/...) — the shape of an actual
// pricing card, not a passing dollar figure. priceTokenCount below counts
// how many such tokens a section's text carries; 2+ (a tier structure) is
// treated as strong evidence, but even a single real token is required
// before pricing can fire at all — a lone bare number or view count never is.
const PRICE_TOKEN_PATTERN = /\$\s?\d+(?:\.\d{1,2})?\s*(?:\/\s*|\s+per\s+)(mo|month|yr|year|user|seat)\b|\bbilled\s+(annually|monthly)\b|\bper\s+(seat|user)\b/gi;
// "free" is deliberately excluded here: it's one of the most common words in
// ordinary marketing copy ("Get $200 in free credits!", "try free for 30
// days") and pairing it with any nearby "$NN" produced a false pricing hit
// on futuretools.io's "$200 in free credits" promo blurb (measured) — a
// promo, not a pricing tier. The remaining words are close to exclusively
// used as actual plan-tier names.
const TIER_WORD = /\b(pro|plus|premium|starter|enterprise|business|team|basic)\b/i;
const BARE_PRICE = /\$\s?\d+(?:\.\d{1,2})?\b/g;
function priceTokenCount(text: string): number {
  let count = (text.match(PRICE_TOKEN_PATTERN) || []).length;
  BARE_PRICE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = BARE_PRICE.exec(text))) {
    const window = text.slice(Math.max(0, m.index - 25), m.index + 25);
    if (TIER_WORD.test(window)) count++;
  }
  return count;
}

function sectionText(section: AnyRecord, childElements: AnyRecord[]): string {
  const heading = String(section.heading || "").trim();
  const childText = childElements
    .filter((e) => e.textRole === "heading" || e.textRole === "body" || e.textRole === "label")
    .slice(0, 20)
    .map((e) => String(e.textSnippet || ""))
    .join(" ");
  return `${heading} ${childText}`.slice(0, 600);
}

// Clusters repeated-group children by x-position center, the same "evenly
// spaced siblings" signal columnCount() uses for macro layout — reused here
// to detect a card-row/grid shape (>=3 clusters) as features evidence, even
// when only some elements in the row carry a repeatedGroup id.
function repeatedClusterCount(elements: AnyRecord[]): number {
  const candidates = elements.filter((e) => e.repeatedGroup && e.rect?.width > 40 && e.rect?.height > 20);
  const centers = candidates.map((e) => e.rect.x + e.rect.width / 2).sort((a, b) => a - b);
  const clusters: number[] = [];
  for (const center of centers) {
    const last = clusters[clusters.length - 1];
    if (last == null || center - last > 100) clusters.push(center);
    else clusters[clusters.length - 1] = (last + center) / 2;
  }
  return clusters.length;
}

// A testimonial is a QUOTE plus an ATTRIBUTION, not merely a section whose
// text happens to contain the word "testimonial"/"reviews" (that word shows
// up in nav links and section headings that aren't testimonial content at
// all). Require quote punctuation plus a short name/role line, or a small
// round avatar image, before granting the label.
// Double quotes ONLY — a plain/curly single quote is indistinguishable from
// an ordinary contraction/possessive apostrophe ("it's", "world's",
// "Anthropic's models"), which appears in nearly any body of marketing copy.
// Including it here (an earlier version of this pattern did) meant
// hasQuoteAttributionShape could fire on almost any section that had a
// contraction ANYWHERE plus a two-word Title-Case label anywhere else
// (measured: it flipped anthropic.com's own features sections and hero to
// "testimonial" — a regression caught by rerunning the vision eval after
// broadening BUG 3, before this tightening pass).
const QUOTE_PUNCT = /["“”]/;
// A name/role line reads like "Jane Doe", "Jane Doe, CEO", "Jane Doe — Acme".
const ATTRIBUTION_LINE_PATTERN = /^[A-Z][\p{L}.'-]+(\s+[A-Z][\p{L}.'-]+)+(\s*[,|—-].{0,40})?$/u;
// A bare two-Title-Case-word phrase ("AI Humanizer", "AI Detector", "AI
// Resume Rewriter") is indistinguishable from a bare person name by
// ATTRIBUTION_LINE_PATTERN above — and product/tool names in exactly that
// shape are common in feature grids and mega-menus (walterwrites.ai's tools
// menu, measured: 62 such "label"-role product names). Requiring the
// trailing ", Role"/"— Company" clause makes it MANDATORY rather than
// optional for the repeated-cards path specifically (see
// hasRepeatedTestimonialCards) — a role/company suffix after a name is
// exactly what a product name never carries.
const ATTRIBUTION_LINE_WITH_ROLE_PATTERN = /^[A-Z][\p{L}.'-]+(\s+[A-Z][\p{L}.'-]+)+\s*[,|—-]\s*\S.{1,40}$/u;
function countAttributionLines(childElements: AnyRecord[]): number {
  return childElements.filter((e) => {
    if (e.textRole !== "body" && e.textRole !== "label") return false;
    const text = String(e.textSnippet || "").trim();
    if (!text || text.length > 60) return false;
    return ATTRIBUTION_LINE_PATTERN.test(text);
  }).length;
}
function hasAttributionLine(childElements: AnyRecord[]): boolean {
  return countAttributionLines(childElements) > 0;
}
function hasAvatarImage(childElements: AnyRecord[]): boolean {
  return childElements.some((e) =>
    e.tag === "img" && Number(e.rect?.width || 0) > 0 && Number(e.rect?.width || 0) <= 120 &&
    Number(e.rect?.height || 0) <= 120 && Number(e.borderRadius || 0) >= 40);
}
function countAvatarImages(childElements: AnyRecord[]): number {
  return childElements.filter((e) =>
    e.tag === "img" && Number(e.rect?.width || 0) > 0 && Number(e.rect?.width || 0) <= 120 &&
    Number(e.rect?.height || 0) <= 120 && Number(e.borderRadius || 0) >= 40).length;
}
// Quote text present (real quotation marks, not a contraction) PLUS either a
// name/role attribution line or a round avatar corroborating it — this is
// shapes #1 and #3 from the BUG 3 fix comment below. Quote punctuation is
// required for BOTH: an avatar next to a name-line alone (no quote) is just
// as likely a "meet the team"/about-page card as a testimonial, so it's not
// sufficient on its own.
function hasQuoteAttributionShape(combinedText: string, childElements: AnyRecord[]): boolean {
  if (!QUOTE_PUNCT.test(combinedText)) return false;
  return hasAttributionLine(childElements) || hasAvatarImage(childElements);
}
const TESTIMONIAL_KEYWORD = /\b(testimonials?|what (our\s+)?(customers?|users?|clients?)\s+(really\s+)?say|success stor(y|ies)|customer stor(y|ies))\b/i;
// BUG 3 fix: the old gate required BOTH the literal keyword "testimonial"/
// "what customers say" AND the quote+attribution shape — so a visible
// customer-quote section that never uses that word (vanna.ai, walterwrites.ai,
// datasquirrel.ai) fell through to "features"/"proof" instead (only 24
// testimonial labels in the whole corpus). A section now qualifies on ANY of
// three independent, evidence-based shapes, no keyword required:
//   1. quote punctuation (real quote marks) + a short attribution line
//   2. repeated CARDS: >=3 members of an actual repeatedGroup each carrying
//      a short-ish body, alongside >=3 attribution lines or avatars — the
//      repeatedGroup + raised count requirement is what keeps this from
//      matching an ordinary 2-3-card feature/proof grid (a generic feature
//      card's heading is easily mistaken for a "name" by the attribution
//      regex; requiring 3+ *repeated* instances is the evidence that this is
//      specifically a testimonial carousel/grid, not a features row)
//   3. quote punctuation + an avatar image (folded into hasQuoteAttributionShape)
// The literal keyword is still consulted but only as a last-resort weak
// signal — see isTestimonialShape.
// A repeated nav/footer link list (repeatedGroup-tagged short labels, e.g.
// "Claude Code" / "Claude Design") satisfies a naive ">=3 repeated bodies,
// >=3 Title-Case-looking labels ANYWHERE in the section" check just as
// easily as an actual testimonial grid does — an early version of this
// function measurably mislabeled anthropic.com's nav/footer link panels as
// "testimonial". Require each repeated body to have an attribution-line (or
// avatar) element SPATIALLY NEAR IT (same row, <150px vertical distance) —
// modeling "this specific card has a name right under its quote" rather
// than "the section contains some quotes and some names somewhere" — and
// require >=3 such PAIRED rows before granting the shape.
const QUOTE_BODY_LENGTH = { min: 20, max: 400 };
function rowCenter(e: AnyRecord): number {
  return Number(e.rect?.y || 0) + Number(e.rect?.height || 0) / 2;
}
function hasRepeatedTestimonialCards(childElements: AnyRecord[]): boolean {
  const bodies = childElements.filter((e) => {
    if (!e.repeatedGroup || e.textRole !== "body") return false;
    const text = String(e.textSnippet || "").trim();
    const len = text.length;
    if (len < QUOTE_BODY_LENGTH.min || len > QUOTE_BODY_LENGTH.max) return false;
    // A real quote/blurb is a written sentence and carries sentence-ending
    // punctuation; a concatenated nav/footer/mega-menu link-label blob
    // ("Claude Code for EnterpriseClaude Cowork@Claude...", "WRITING TOOLS
    // AI Humanizer...AI Detector...") almost never does — this is what kept
    // anthropic.com's and walterwrites.ai's menu panels out after the
    // spatial-pairing check alone still let them through (measured).
    return /[.!?]/.test(text);
  });
  if (bodies.length < 3) return false;
  // "label" only, not "body": a name/role byline is captioning text, the
  // same schema role a "$49/mo" price caption or a form-field label carries
  // — a menu/feature grid's short marketing headline ("AI Detector", "AI
  // Resume Rewriter") is tagged "heading" or "body", not "label", in this
  // capture, so restricting to "label" is what keeps a tools mega-menu
  // (walterwrites.ai, measured) from satisfying the attribution pairing
  // just because its per-tool blurb happens to be 2 Title-Case words.
  const attributions = childElements.filter((e) => {
    if (e.textRole !== "label") return false;
    const text = String(e.textSnippet || "").trim();
    return text && text.length <= 60 && ATTRIBUTION_LINE_WITH_ROLE_PATTERN.test(text);
  });
  // Avatar-only pairing (no role-suffixed name) was dropped: a small round
  // brand/sponsor badge (deeplearning.ai's "DeepLearning.AI"/"OpenAI" course
  // logos, measured) is geometrically indistinguishable from a small round
  // headshot by rect size + borderRadius alone, and repeated course/product
  // cards routinely carry one next to a period-punctuated description —
  // exactly this shape. The attribution-WITH-ROLE requirement (a mandatory
  // ", Role"/"— Company" suffix) is the one signal in this function that a
  // product/course card structurally never produces, so it's the only
  // remaining corroborator here.
  const nearAny = (body: AnyRecord, others: AnyRecord[]): boolean =>
    others.some((o) => Math.abs(rowCenter(o) - rowCenter(body)) < 150);
  const pairedWithAttribution = bodies.filter((b) => nearAny(b, attributions)).length;
  return pairedWithAttribution >= 3;
}
function isTestimonialShape(section: AnyRecord, combinedText: string, childElements: AnyRecord[]): boolean {
  if (hasQuoteAttributionShape(combinedText, childElements)) return true;
  if (hasRepeatedTestimonialCards(childElements)) return true;
  // Keyword alone (no shape corroboration) is weaker evidence but still
  // real: a heading literally reading "Testimonials"/"What our customers
  // say" above a card row is legitimate even if individual cards don't each
  // carry a clean attribution-line match. Restricted to the section's OWN
  // heading text — checking the full combined body/nav-link text let a nav
  // link phrase like "Customer Stories" (matches the customerStor(y|ies)
  // alternative) mislabel an unrelated hero/nav band as testimonial
  // (groq.com, measured).
  const headingText = `${section.heading || ""} ${childElements.filter((e) => e.textRole === "heading").map((e) => e.textSnippet || "").join(" ")}`;
  return TESTIMONIAL_KEYWORD.test(headingText);
}

// A short, full-width band with one heading and 1-2 buttons/links and no
// other content is a CTA band (agenta's yellow "Ship agents that actually
// work" strip), not a second hero — heroes carry more supporting content and
// usually sit at the very top of the page.
//
// BUG 1 fix: a real hero is frequently JUST a headline + 1-2 buttons — the
// exact shape this function matches — so without a gate it steals the
// topmost hero band (shields.io, wiley.com, murph.ai measured: real hero
// labeled "cta"/"features", and enforceHeroSingleton then promoted the NEXT
// band to "hero" instead). isTopFoldMaxHeading is true only for the
// topmost-above-fold band carrying the page's largest (or near-largest)
// heading — i.e. the one place a hero is expected to live. A cta-shaped band
// is never granted the "cta" role there; it's left for the hero rule below.
function isCtaBandShape(section: AnyRecord, childElements: AnyRecord[], isTopFoldMaxHeading = false): boolean {
  const heightShare = Number(section.rect?.normalized?.h ?? 1);
  const widthShare = Number(section.rect?.normalized?.w ?? 0);
  if (heightShare <= 0 || heightShare > 0.14 || widthShare < 0.6) return false;
  if (isTopFoldMaxHeading) return false;
  const headings = childElements.filter((e) => e.textRole === "heading");
  const ctas = childElements.filter((e) => e.textRole === "cta");
  // childElements here are un-leaf-reduced (see elementsBySection); empty
  // <div>/<section> ancestor wrappers pick up textRole "body" too. Count
  // only body elements that actually carry text, so wrapper duplication
  // doesn't fail the "1-2 sentences of supporting copy" shape check.
  const bodyCount = childElements.filter((e) => e.textRole === "body" && String(e.textSnippet || "").trim().length > 0).length;
  return headings.length >= 1 && headings.length <= 2 && ctas.length >= 1 && ctas.length <= 2 && bodyCount <= 2;
}

function reclassifySectionRole(section: AnyRecord, childElements: AnyRecord[], options: { excludeRoles?: Set<string>; pageMaxHeadingSize?: number; confidenceOut?: { value: number } } = {}): string {
  const excludeRoles = options.excludeRoles || new Set<string>();
  // decide() is a thin wrapper around every return in this function so a
  // caller can optionally read out WHY a role was picked (roleConfidence,
  // P2) without changing the function's string return type — every existing
  // call site keeps working untouched.
  const decide = (role: string, confidence: number): string => {
    if (options.confidenceOut) options.confidenceOut.value = confidence;
    return role;
  };
  const currentRole = String(section.role || "unknown");
  // Tag-derived roles are already reliable; don't second-guess them — unless
  // the caller is specifically demoting this role (positional-singleton
  // post-pass), in which case excludeRoles forces us past this shortcut.
  if (!excludeRoles.has(currentRole) && (currentRole === "nav" || currentRole === "footer")) return decide(currentRole, 1);
  const heading = String(section.heading || "").trim();
  const combinedText = sectionText(section, childElements);
  // Heading-size/position evidence, computed up front (moved ahead of the
  // pricing/testimonial/cta checks below) so every role check that needs to
  // avoid stealing the topmost above-fold max-heading band — reserved for
  // hero — can share the same isTopFoldMaxHeading flag. See BUG 1's comment
  // further down for the original CTA-vs-hero collision this was built for;
  // BUG 3's broadened testimonial detection (no longer gated behind a
  // literal keyword) turned out to have the exact same failure mode when a
  // synthesized band merges real hero content with an adjacent testimonial
  // card (socialsonic.com, measured: the merged band's testimonial evidence
  // fired before the hero check ever got a look, demoting hero to a later,
  // wrong band).
  const sectionY = Number(section.rect?.y || 0);
  const normY = Number(section.rect?.normalized?.y ?? (sectionY / 900));
  const isAboveFold = normY < 0.6;
  const topHeadingSize = Math.max(0, ...childElements.filter((e) => e.textRole === "heading").map((e) => Number(e.fontSize) || 0));
  const pageMaxHeadingSize = Number(options.pageMaxHeadingSize || 0);
  const isTopFontHeading = pageMaxHeadingSize > 0 && topHeadingSize > 0 && topHeadingSize >= pageMaxHeadingSize * 0.85;
  const isTopFoldMaxHeading = isAboveFold && isTopFontHeading;
  // BUG 2 fix: pricing now requires actual price-token evidence (currency +
  // number + period, or a bare "$NN" beside a tier word) rather than any
  // bare "$" next to any number — see priceTokenCount's comment above for
  // why the old pattern false-fired on futuretools.io (view counts) and
  // groq.com (a date/number near a stray "$"). >=2 tokens is a tier
  // structure and gets higher confidence; a single real token is still
  // sufficient to fire (a page can legitimately show one plan above the
  // fold) but a bare number/date/view-count never is.
  const priceTokens = priceTokenCount(combinedText);
  if (!excludeRoles.has("pricing") && priceTokens >= 1) return decide("pricing", priceTokens >= 2 ? 0.9 : 0.75);
  // BUG 3 fix: testimonial no longer requires the literal keyword — see
  // isTestimonialShape for the three independent evidence shapes now
  // accepted (quote+attribution, avatar+attribution, repeated
  // quote/attribution cards); keyword-only is still one of those shapes.
  // Gated the same way CTA is (see isTopFoldMaxHeading above): never claim
  // the topmost above-fold max-heading band away from hero, even if a
  // testimonial card happens to be merged into it.
  if (!excludeRoles.has("testimonial") && !isTopFoldMaxHeading && isTestimonialShape(section, combinedText, childElements)) {
    return decide("testimonial", TESTIMONIAL_KEYWORD.test(combinedText) ? 0.9 : 0.75);
  }
  for (const [role, re] of SECTION_KEYWORD_RULES) {
    if (excludeRoles.has(role)) continue;
    if (re.test(combinedText)) return decide(role, 0.85);
  }
  const landmarks = new Set(childElements.map((e) => e.landmarkRole).filter(Boolean));
  if (!excludeRoles.has("nav") && landmarks.has("navigation")) return decide("nav", 0.8);
  if (!excludeRoles.has("footer") && landmarks.has("contentinfo")) return decide("footer", 0.8);
  const textRoleCounts: Record<string, number> = {};
  for (const e of childElements) if (e.textRole) textRoleCounts[e.textRole] = (textRoleCounts[e.textRole] || 0) + 1;
  const textTotal = Object.values(textRoleCounts).reduce((a, b) => a + b, 0);
  const ctaShare = textTotal ? (textRoleCounts.cta || 0) / textTotal : 0;
  const hasAnyHeading = childElements.some((e) => e.textRole === "heading");
  const bodyCount = textRoleCounts.body || 0;
  const ctaCount = textRoleCounts.cta || 0;
  // BUG 1 fix: a CTA band and a hero band can share the exact same shape
  // (headline + 1-2 buttons). Only grant "cta" when this ISN'T the topmost
  // above-fold band carrying the page-max heading (isTopFoldMaxHeading,
  // computed up top) — that band is reserved for the hero rule just below.
  // Elsewhere (agenta's yellow "Ship agents that actually work" strip,
  // lower on the page) the CTA-band check still fires regardless of Y
  // position, same as before.
  if (!excludeRoles.has("cta") && isCtaBandShape(section, childElements, isTopFoldMaxHeading)) return decide("cta", 0.8);
  // HERO v3 — burden of proof inverted. The old gate (sectionY<250 AND
  // banner/topHeading AND nonRepeatedBodyCount<=4) required a hero to be
  // short and near the very top, so real heroes with 5+ paragraphs or a
  // slightly lower position fell through to "features" (v2 measured only
  // ~21% hero recall). A hero is now: an above-the-fold section (normalized
  // y < 0.6) that carries a heading whose fontSize is at/near the page's
  // largest (the "top-2" heading), OR is corroborated by a banner landmark
  // or the capture's own element-level sectionRole:"hero" votes (previously
  // ignored here). Body-paragraph count and repeated-content signal no
  // longer disqualify a candidate. Absence of ANY heading is now the only
  // disqualifier; exactly-one-hero-per-page is enforced afterward by
  // enforceHeroSingleton, which also rescues pages where nothing here fired.
  if (!excludeRoles.has("hero")) {
    const elementHeroVotes = childElements.filter((e) => e.sectionRole === "hero").length;
    if (isAboveFold && hasAnyHeading && (isTopFontHeading || landmarks.has("banner") || elementHeroVotes > 0)) {
      return decide("hero", elementHeroVotes > 0 ? 0.9 : isTopFontHeading ? 0.85 : 0.75);
    }
  }
  if (ctaShare >= 0.5 && textTotal >= 2) return decide("cta", 0.7);
  if (landmarks.has("complementary") && /sidebar|toc|table of contents/i.test(heading)) return decide("sidebar", 0.7);
  // "features" is a genuine content-role, not a catch-all for "has some
  // text". Keyword-matched headings already returned above via
  // SECTION_KEYWORD_RULES; the only other admissible evidence is (b) a
  // repeated child group — multiple distinct repeatedGroup ids, or >=3
  // position clusters among repeated candidates (a card row/grid) — or (c) a
  // heading+body+cta triad (a classic feature-row shape). Anything short of
  // that is left "unknown" rather than guessed as "features": an honest
  // unknown is better than a wrong features label.
  const repeatedGroupIds = new Set(childElements.map((e) => e.repeatedGroup).filter(Boolean));
  const hasRepeatedSignal = repeatedGroupIds.size >= 2 || repeatedClusterCount(childElements) >= 3;
  const hasHeadingBodyCtaTriad = hasAnyHeading && bodyCount >= 1 && ctaCount >= 1;
  // A repeated band with little/no text and mostly image/svg children is a
  // logo row/marquee, not a feature grid.
  const imageish = childElements.filter((e) => e.tag === "img" || e.tag === "svg").length;
  if (!excludeRoles.has("proof") && hasRepeatedSignal && !hasAnyHeading && childElements.length > 0 && imageish / childElements.length >= 0.5) return decide("proof", 0.7);
  if (hasRepeatedSignal || hasHeadingBodyCtaTriad) return decide("features", hasRepeatedSignal ? 0.65 : 0.6);
  // BUG 2/3 fix: "pricing" and "testimonial" require positive evidence
  // (priceTokenCount/isTestimonialShape above) EVERY time, including here —
  // the raw crawl's own section.role pre-tag is not trustworthy evidence on
  // its own for either (groq.com's top banner arrived pre-tagged "pricing"
  // from the crawl with zero real price tokens in its text — a `#pricing`
  // anchor-adjacent DOM heuristic upstream, not a pricing table — and would
  // otherwise have silently survived to here since nothing else in this
  // function claimed it).
  if (currentRole && currentRole !== "unknown" && currentRole !== "pricing" && currentRole !== "testimonial" && !excludeRoles.has(currentRole)) return decide(currentRole, 0.5);
  return decide("unknown", 0);
}

// A "page wrapper" section — the DOM ancestor whose rect spans nearly the
// whole page and spatially CONTAINS several other, much smaller sections
// (nav, hero, cards) — is not real page content, it's a container. Emitting
// it as its own section (frequently mislabeled "hero"/"features" downstream)
// both over-counts and puts a bogus section before the real topmost one
// (anthropic.com, adva-soft.com). Drop any near-full-page section that
// visibly contains >= 2 meaningfully smaller siblings.
function dropWrapperSections(sections: AnyRecord[]): AnyRecord[] {
  return sections.filter((section) => {
    const nh = Number(section.rect?.normalized?.h ?? 0);
    const nw = Number(section.rect?.normalized?.w ?? 0);
    if (nh < 0.7 || nw < 0.85) return true;
    const containedCount = sections.filter((other) => other !== section &&
      overlapRatio(section.rect, other.rect) > 0.85 && other.rect.height < section.rect.height * 0.6).length;
    return containedCount < 2;
  });
}

// Recover the page's pixel dimensions from any section's normalized rect, so
// collapsed-band rects can be re-normalized consistently.
function sectionPageScale(sections: AnyRecord[]): { pageWidth: number; pageHeight: number } {
  for (const section of sections) {
    const n = section.rect?.normalized;
    if (n && n.w > 0.001 && n.h > 0.001) {
      return { pageWidth: section.rect.width / n.w, pageHeight: section.rect.height / n.h };
    }
  }
  return { pageWidth: 1440, pageHeight: 900 };
}

// A repeated CARD/LIST-ITEM wall (a directory grid, a logo marquee, a
// footer's link columns) frequently arrives from the crawl as one raw
// section PER item, exploding sections into the hundreds. Cluster
// card-height siblings by width (the stable dimension across a grid/list —
// height varies with wrapped text) and, within a width cluster, split into
// Y-contiguous runs so unrelated same-width bands elsewhere on the page
// don't merge. A run of >= 3 collapses into ONE synthetic band spanning the
// run's bounds; its members are dropped from the individual section list.
function collapseRepeatedSectionBands(sections: AnyRecord[]): AnyRecord[] {
  const CARD_MAX_HEIGHT = 400;
  const RUN_GAP = 260;
  const WIDTH_TOLERANCE = 20;
  const { pageWidth, pageHeight } = sectionPageScale(sections);
  const groups = new Map<string, AnyRecord[]>();
  const rest: AnyRecord[] = [];
  for (const section of sections) {
    if (!section.rect || section.rect.height <= 0 || section.rect.height > CARD_MAX_HEIGHT) {
      rest.push(section);
      continue;
    }
    const key = String(Math.round(section.rect.width / WIDTH_TOLERANCE));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(section);
  }
  const bands: AnyRecord[] = [];
  for (const members of groups.values()) {
    if (members.length < 3) {
      rest.push(...members);
      continue;
    }
    const sorted = [...members].sort((a, b) => a.rect.y - b.rect.y);
    let run: AnyRecord[] = [sorted[0]!];
    const flushRun = () => {
      if (run.length >= 3) bands.push(makeSectionBand(run, pageWidth, pageHeight));
      else rest.push(...run);
      run = [];
    };
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const cur = sorted[i]!;
      if (cur.rect.y - (prev.rect.y + prev.rect.height) > RUN_GAP) {
        flushRun();
        run = [cur];
      } else {
        run.push(cur);
      }
    }
    flushRun();
  }
  return [...rest, ...bands].sort((a, b) => (a.rect.y - b.rect.y) || (b.rect.height - a.rect.height));
}

function makeSectionBand(members: AnyRecord[], pageWidth: number, pageHeight: number): AnyRecord {
  // Off-canvas duplicates (marquee/carousel clones parked far outside the
  // viewport) shouldn't blow the band's bounding box out to absurd width;
  // prefer the on-screen subset for the rect, but keep every member so its
  // (possibly hidden) content still feeds role classification.
  const onscreen = members.filter((m) => m.rect.x >= -100 && m.rect.x <= pageWidth + 100);
  const basis = onscreen.length ? onscreen : members;
  const x0 = Math.min(...basis.map((m) => m.rect.x));
  const y0 = Math.min(...basis.map((m) => m.rect.y));
  const x1 = Math.max(...basis.map((m) => m.rect.x + m.rect.width));
  const y1 = Math.max(...basis.map((m) => m.rect.y + m.rect.height));
  const width = Math.max(1, x1 - x0);
  const height = Math.max(1, y1 - y0);
  const headingMember = members.find((m) => m.heading);
  return {
    id: `band-${hash(members.map((m) => m.id).join(","))}`,
    role: "unknown",
    heading: headingMember ? headingMember.heading : null,
    rect: {
      x: x0,
      y: y0,
      width,
      height,
      normalized: {
        x: clamp01(x0 / pageWidth),
        y: clamp01(y0 / pageHeight),
        w: clamp01(width / pageWidth),
        h: clamp01(height / pageHeight),
      },
      areaShare: members.reduce((sum, m) => sum + Number(m.rect.areaShare || 0), 0),
    },
    focalPoint: ["left", "center", "right"].includes(members[0]!.focalPoint) ? members[0]!.focalPoint : "center",
    composition: "grid",
  };
}

// v3: exactly one hero per page, chosen by best evidence rather than the
// first section that happens to pass a strict per-section gate. If
// reclassifySectionRole already minted >1 hero (rare — two above-fold
// sections both carrying a near-max-size heading), keep the topmost and
// reclassify the rest from their own content. If it minted zero, rescue: the
// topmost above-fold section carrying ANY heading, excluding page landmarks
// and other strong-evidence roles that are unlikely to double as a hero,
// becomes the hero. This directly targets the P1 recall gap (v2 measured
// ~21% hero coverage because the old gate's burden of proof was inverted).
function enforceHeroSingleton(sections: AnyRecord[], sectionElements: Map<string, AnyRecord[]>, pageMaxHeadingSize: number): void {
  const normY = (section: AnyRecord): number => Number(section.rect?.normalized?.y ?? 0);
  const heroes = sections.filter((s) => s.role === "hero");
  if (heroes.length > 1) {
    const top = heroes.reduce((best, s) => (normY(s) < normY(best) ? s : best));
    for (const s of heroes) {
      if (s === top) continue;
      const children = sectionElements.get(s.id) || [];
      const confidenceOut = { value: 0.5 };
      s.role = reclassifySectionRole({ ...s, role: "unknown" }, children, { excludeRoles: new Set(["hero"]), pageMaxHeadingSize, confidenceOut });
      s.roleConfidence = confidenceOut.value;
    }
    return;
  }
  if (heroes.length === 0) {
    const protectedRoles = new Set(["nav", "footer", "faq", "pricing", "testimonial"]);
    const candidates = sections
      .filter((s) => !protectedRoles.has(s.role))
      .filter((s) => normY(s) < 0.6)
      .filter((s) => (sectionElements.get(s.id) || []).some((e) => e.textRole === "heading"))
      .sort((a, b) => normY(a) - normY(b));
    if (candidates.length) {
      const promoted = candidates[0]!;
      promoted.role = "hero";
      promoted.roleConfidence = Math.max(Number(promoted.roleConfidence || 0), 0.55);
    }
  }
}

// v3 P2 — unknown rescue via a fixed positional/neighbor ruleset (no new
// keywords). Sections stay in this array in visual Y order (see cleanSections
// call site), so prev/next array neighbors approximate prev/next role on the
// page. Every rule here is deliberately conservative: it only fires on a
// concrete shape (repeated children, numbered pattern, near-footer CTA
// shape), never on a bare "this is close to something" guess. Anything that
// doesn't match one of these stays "unknown" — an honest unknown remains
// better than a wrong label.
const NUMBERED_STEP_PATTERN = /(^|\s)(step\s?\d|0?[1-9][.)]\s|#\s?[1-9]\b)/i;
function rescueUnknownSections(sections: AnyRecord[], sectionElements: Map<string, AnyRecord[]>): void {
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i]!;
    if (section.role !== "unknown") continue;
    const children = sectionElements.get(section.id) || [];
    const prevRole = sections[i - 1]?.role;
    const nextRole = sections[i + 1]?.role;
    const normY = Number(section.rect?.normalized?.y ?? 0);
    const repeatedMembers = children.filter((e) => e.repeatedGroup);
    const headings = children.filter((e) => e.textRole === "heading");
    const ctas = children.filter((e) => e.textRole === "cta");
    const imageish = children.filter((e) => e.tag === "img" || e.tag === "svg").length;
    const combinedText = sectionText(section, children);
    if (["features", "proof"].includes(String(prevRole)) && ["faq", "footer"].includes(String(nextRole)) && repeatedMembers.length > 0) {
      section.role = "features";
      section.roleConfidence = 0.55;
      continue;
    }
    if (normY > 0.85 && headings.length === 1 && ctas.length >= 1 && ctas.length <= 2) {
      section.role = "cta";
      section.roleConfidence = 0.55;
      continue;
    }
    if (repeatedMembers.length >= 3) {
      section.role = imageish / Math.max(1, children.length) >= 0.5 ? "proof" : "features";
      section.roleConfidence = 0.55;
      continue;
    }
    if (NUMBERED_STEP_PATTERN.test(combinedText)) {
      section.role = "features";
      section.roleConfidence = 0.5;
      continue;
    }
    // A content-free (or near content-free) band sandwiched between two
    // sections that share the SAME settled role is, in practice, a spacer or
    // decorative divider inside that band, not a distinct unrelated section
    // (measured: ~1200 of the corpus's unknowns carry zero kept elements at
    // all — no heading, no repeated group, nothing a keyword or shape rule
    // could ever fire on; this is the one purely-positional inference left
    // that doesn't require guessing content).
    if (prevRole && prevRole === nextRole && !["nav", "footer", "unknown"].includes(String(prevRole))) {
      section.role = String(prevRole);
      section.roleConfidence = 0.45;
      continue;
    }
  }
}

// v3 P3 — additive, defensively-defaulted descriptive shape for a "features"
// section's member content. Never load-bearing for role classification;
// falls back to "plain" whenever the signal isn't clear.
function featureShapeOf(childElements: AnyRecord[]): string {
  if (!childElements || !childElements.length) return "plain";
  const repeatedMembers = childElements.filter((e) => e.repeatedGroup);
  const media = childElements.filter((e) => ["img", "svg", "video", "canvas"].includes(e.tag));
  if (media.some((e) => Number(e.rect?.areaShare || 0) >= 0.5)) return "showcase";
  const stepPattern = /^(step\s?\d|0?[1-9][.)]\s|#\s?[1-9]\b)/i;
  if (childElements.filter((e) => e.textRole === "heading" && stepPattern.test(String(e.textSnippet || "").trim())).length >= 2) return "steps";
  const statPattern = /^\d+[%+kKMx]/;
  if (childElements.filter((e) => statPattern.test(String(e.textSnippet || "").trim())).length >= 2) return "stat-band";
  if (repeatedMembers.length >= 4) {
    const widths = repeatedMembers.map((e) => Number(e.rect?.width || 0)).filter((w) => w > 0);
    if (widths.length >= 4) {
      const meanW = widths.reduce((a, b) => a + b, 0) / widths.length;
      const varW = widths.reduce((sum, w) => sum + (w - meanW) ** 2, 0) / widths.length;
      const cv = meanW > 0 ? Math.sqrt(varW) / meanW : 0;
      if (cv > 0.35) return "bento";
    }
    const leftRight = repeatedMembers
      .filter((e) => ["img", "svg", "video"].includes(e.tag))
      .sort((a, b) => Number(a.rect?.y || 0) - Number(b.rect?.y || 0))
      .map((e) => (Number(e.rect?.x || 0) < 720 ? "L" : "R"));
    if (leftRight.length >= 3) {
      let alternations = 0;
      for (let i = 1; i < leftRight.length; i++) if (leftRight[i] !== leftRight[i - 1]) alternations++;
      if (alternations >= leftRight.length - 1) return "zigzag";
    }
    return "card-grid";
  }
  return "plain";
}

// v3 P3 — area-weighted dominant backgroundColor per section, in visual
// order, forms a "stripe sequence": one of the cheapest reliable signals of a
// page's macro rhythm (alternating dark/light hero-proof-features banding).
function isDarkColor(color: unknown): boolean {
  const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(String(color || ""));
  if (!m) return false;
  const luma = 0.299 * Number(m[1]) + 0.587 * Number(m[2]) + 0.114 * Number(m[3]);
  return luma < 110;
}
function bandRhythmOf(sections: AnyRecord[], sectionElements: Map<string, AnyRecord[]>): AnyRecord {
  const stripes = sections.map((section) => {
    const children = sectionElements.get(section.id) || [];
    const tally = new Map<string, number>();
    for (const e of children) {
      const color = e.backgroundColor;
      if (!color || /rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)|transparent/i.test(String(color))) continue;
      const area = Number(e.rect?.areaShare || 0);
      tally.set(color, (tally.get(color) || 0) + area);
    }
    let dominant: string | null = null;
    let best = 0;
    for (const [color, area] of tally) if (area > best) { best = area; dominant = color; }
    return dominant;
  });
  const known = stripes.filter((s): s is string => !!s);
  const darkBandCount = known.filter(isDarkColor).length;
  let alternations = 0;
  let comparisons = 0;
  for (let i = 1; i < stripes.length; i++) {
    if (!stripes[i] || !stripes[i - 1]) continue;
    comparisons++;
    if (isDarkColor(stripes[i]) !== isDarkColor(stripes[i - 1])) alternations++;
  }
  return {
    sequence: stripes.map((s) => s || "unknown"),
    darkBandCount,
    stripeAlternation: comparisons ? round(clamp01(alternations / comparisons, 0), 3) : 0,
    bgHueCount: new Set(known).size,
  };
}

function cleanSections(record: AnyRecord): { sections: AnyRecord[]; bandRhythm: AnyRecord; synthesized: boolean } {
  let raw = [...(record.desktop?.sections || [])]
    .filter((section) => section && section.rect && section.rect.height > 10)
    .sort((a, b) => (a.rect.y - b.rect.y) || (b.rect.height - a.rect.height));
  raw = dropWrapperSections(raw);
  raw = collapseRepeatedSectionBands(raw);
  const result: AnyRecord[] = [];
  for (const section of raw) {
    const previous = result.find((candidate) => candidate.role === section.role && overlapRatio(candidate.rect, section.rect) > 0.65);
    if (previous) {
      if (section.rect.height > previous.rect.height) Object.assign(previous, section);
      continue;
    }
    result.push(section);
  }
  if (!result.length) return { sections: [{ role: "unknown", heightShare: 1, focalPoint: "center", composition: "stack", featureShape: "plain", roleConfidence: 0 }], bandRhythm: { sequence: [], darkBandCount: 0, stripeAlternation: 0, bgHueCount: 0 }, synthesized: false };
  // Collapsed/hidden menu panels (rect.height === 0, but opacity still > 0)
  // shouldn't be able to flip a whole section's role via a stray
  // landmarkRole/textRole signal nobody actually sees.
  let sectionElements = elementsBySection(visibleElements(record), result);
  const total = result.reduce((sum, section) => sum + Math.max(0, Number(section.rect?.height || 0)), 0) || 1;
  const pageMaxHeadingSize = Math.max(0, ...visibleElements(record).filter((e) => e.textRole === "heading").map((e) => Number(e.fontSize) || 0));
  let classified: AnyRecord[] = result.map((section) => {
    const confidenceOut = { value: 0.5 };
    const role = reclassifySectionRole(section, sectionElements.get(section.id) || [], { pageMaxHeadingSize, confidenceOut });
    return {
      id: section.id,
      rect: section.rect,
      role,
      roleConfidence: confidenceOut.value,
      heightShare: round(Math.max(0, Number(section.rect?.height || 0)) / total, 5),
      focalPoint: ["left", "center", "right"].includes(section.focalPoint) ? section.focalPoint : "center",
      composition: String(section.composition || "stack"),
      featureShape: "plain",
    };
  });

  // v3.1 CHANGE 2 — section synthesis for div-soup/under-segmented pages
  // (modern bespoke/SPA sites that skip <section>/<main> entirely, so the
  // capture only ever sees one wrapper <div>). Only fires when the page is
  // genuinely under-segmented (see isUnderSegmented); pages that already
  // segment well are left byte-for-byte untouched by this block.
  let synthesized = false;
  if (isUnderSegmented(record, classified, sectionElements)) {
    const { pageWidth, pageHeight } = sectionPageScale(result);
    const nav = classified.find((s) => s.role === "nav");
    const footer = classified.find((s) => s.role === "footer");
    const contentTop = nav ? Number(nav.rect.y) + Number(nav.rect.height) : 0;
    const contentBottom = footer ? Number(footer.rect.y) : pageHeight;
    const bands = synthesizeSectionBands(record, contentTop, contentBottom, pageWidth, pageHeight);
    // Require at least 2 synthesized bands — a single band would just
    // reproduce the one big section we're trying to break apart.
    if (bands.length >= 2) {
      const landmarks = classified.filter((s) => s.role === "nav" || s.role === "footer");
      classified = [...landmarks, ...bands].sort((a, b) => Number(a.rect.y) - Number(b.rect.y));
      sectionElements = elementsBySection(visibleElements(record), classified);
      for (const section of classified) {
        if (section.role !== "unknown") continue;
        const confidenceOut = { value: 0.5 };
        section.role = reclassifySectionRole(section, sectionElements.get(section.id) || [], { pageMaxHeadingSize, confidenceOut });
        section.roleConfidence = confidenceOut.value;
      }
      const newTotal = classified.reduce((sum, section) => sum + Math.max(0, Number(section.rect?.height || 0)), 0) || 1;
      for (const section of classified) section.heightShare = round(Math.max(0, Number(section.rect?.height || 0)) / newTotal, 5);
      synthesized = true;
    }
  }

  // BUG 4 fix — split a single OVERSIZED content section even on a page that
  // already has >= 3 content sections and so never trips the page-level
  // isUnderSegmented guard above (sobrief.com: one section is 79% of page
  // height and swallows ~15 rows; wiley.com: 4 real bands got merged into
  // one). Scoped to just the oversized section's own Y-range via
  // synthesizeSectionBands, so the rest of an otherwise well-formed page —
  // anthropic.com, agenta.ai — is left untouched: those pages have no single
  // section anywhere near this tall AND this dense, so the gate never fires.
  const { pageWidth: splitPageWidth, pageHeight: splitPageHeight } = sectionPageScale(result);
  let splitAnyOversized = false;
  // Bounded to 2 rounds: a first split can itself leave one residual
  // oversized band (mac.eltima.com, measured: an 8600px wrapper section
  // split down to a few real bands plus one still-large 63%-of-page
  // leftover) when synthesizeSectionBands' own boundary signals were sparse
  // across the FULL original range. A second pass, scoped to just that
  // smaller leftover band, has a much better chance of finding internal
  // boundaries. Bounded rather than looped-until-stable so a pathological
  // page can never spin this pass indefinitely.
  for (let round = 0; round < 2; round++) {
  let splitThisRound = false;
  for (let i = classified.length - 1; i >= 0; i--) {
    const section = classified[i]!;
    if (section.role === "nav" || section.role === "footer") continue;
    if (Number(section.rect?.normalized?.h ?? 0) <= 0.5) continue;
    const children = sectionElements.get(section.id) || [];
    const headingCount = children.filter((e) => e.textRole === "heading").length;
    const repeatedCount = children.filter((e) => e.repeatedGroup).length;
    if (headingCount < 2 && repeatedCount < 6) continue;
    const y0 = Number(section.rect.y);
    const rawY1 = y0 + Number(section.rect.height);
    // sobrief.com measured: the section's raw DOM rect claimed a height
    // spanning ~79% of the page, but its own kept children only occupied
    // the top ~6% of that span — the rest is a near-empty tail (an
    // oversized/mismeasured wrapper, not real content rows to split).
    // synthesizeSectionBands can't find internal boundaries in space with no
    // elements, so it always returned exactly 1 band spanning just the real
    // content and dropped the (memberless) empty remainder — correctly, but
    // that result failed the ">=2 bands" guard below and the untouched
    //79%-tall section survived unchanged. Clip the search range to the
    // section's own real content extent (+ small padding) whenever that
    // extent is well under half the claimed height, and accept a
    // single-band result in that specific case: even without an internal
    // split, replacing the section with a band sized to its ACTUAL content
    // directly fixes the "swallows most of the page" measurement.
    // Use the SAME source synthesizeSectionBands itself scans internally
    // (nonContainerElements filtered by raw Y range) rather than `children`
    // (elementsBySection's center-containment assignment, a materially
    // different/smaller set here) — otherwise this empty-tail detection and
    // synthesizeSectionBands's own internal notion of "where content ends"
    // can disagree, as measured on an early version of this check.
    const rangeKept = nonContainerElements(record).filter((e) => Number(e.rect?.y || 0) >= y0 - 1 && Number(e.rect?.y || 0) < rawY1);
    const contentMaxY = rangeKept.length ? Math.max(y0, ...rangeKept.map((e) => Number(e.rect?.y || 0) + Number(e.rect?.height || 0))) : rawY1;
    const hasEmptyTail = contentMaxY < y0 + (rawY1 - y0) * 0.5;
    const y1 = hasEmptyTail ? Math.min(rawY1, contentMaxY + 60) : rawY1;
    const bands = synthesizeSectionBands(record, y0, y1, splitPageWidth, splitPageHeight);
    // Same "must actually split into >=2" guard as the page-level pass — a
    // single band would just reproduce the oversized section untouched,
    // UNLESS it's the empty-tail case above, where a single but much
    // SMALLER band is itself the fix.
    if (bands.length < 2 && !(hasEmptyTail && bands.length === 1)) continue;
    classified.splice(i, 1, ...bands);
    splitThisRound = true;
    splitAnyOversized = true;
  }
  if (!splitThisRound) break;
  // Refresh sectionElements before the next round (and before the
  // post-loop reclassification below) so a second pass sees each new
  // band's own children, not the pre-split parent's.
  sectionElements = elementsBySection(visibleElements(record), classified);
  for (const section of classified) {
    if (section.role !== "unknown") continue;
    const confidenceOut = { value: 0.5 };
    section.role = reclassifySectionRole(section, sectionElements.get(section.id) || [], { pageMaxHeadingSize, confidenceOut });
    section.roleConfidence = confidenceOut.value;
  }
  }
  if (splitAnyOversized) {
    const splitTotal = classified.reduce((sum, section) => sum + Math.max(0, Number(section.rect?.height || 0)), 0) || 1;
    for (const section of classified) section.heightShare = round(Math.max(0, Number(section.rect?.height || 0)) / splitTotal, 5);
    synthesized = true;
  }

  enforcePositionalSingletons(classified, sectionElements);
  enforceHeroSingleton(classified, sectionElements, pageMaxHeadingSize);
  rescueUnknownSections(classified, sectionElements);
  for (const section of classified) {
    section.featureShape = section.role === "features" ? featureShapeOf(sectionElements.get(section.id) || []) : "plain";
  }
  const bandRhythm = bandRhythmOf(classified, sectionElements);

  // v3.1 CHANGE 1 — drop content-free spacer/divider bands. ~93% of the
  // corpus's "unknown" sections carry zero kept elements (no heading, no
  // text, no repeated group, no media, no landmark) after every
  // classification/rescue pass above has had its shot — these are spacer or
  // decorative-divider DOM bands, not real sections in the page's content
  // grammar, and inflate unknown% without carrying any signal a downstream
  // consumer could use. nav/footer are page-level landmarks and are never
  // dropped even when thin (e.g. an empty sticky nav bar).
  let pruned = classified;
  const beforeCount = classified.length;
  pruned = classified.filter((section) => {
    if (section.role === "nav" || section.role === "footer") return true;
    if (section.role !== "unknown") return true;
    return hasContentSignal(sectionElements.get(section.id) || []);
  });
  if (pruned.length !== beforeCount) {
    const total2 = pruned.reduce((sum, section) => sum + Math.max(0, Number(section.rect?.height || 0)), 0) || 1;
    for (const section of pruned) section.heightShare = round(Math.max(0, Number(section.rect?.height || 0)) / total2, 5);
  }
  if (!pruned.length) pruned = [{ role: "unknown", rect: classified[0]?.rect, heightShare: 1, focalPoint: "center", composition: "stack", featureShape: "plain", roleConfidence: 0 }];

  const contained = absorbBelowFooter(pruned);
  const ordered = orderSections(contained);
  return { sections: ordered.map(({ id, rect, ...published }) => published), bandRhythm, synthesized };
}

// v3.1 — a section carries real content if it has at least one child
// element that is itself kept signal: heading/body/label/cta text, an
// image/svg/video/canvas asset, a repeated-group member, or a landmark
// role. A section with none of those is a spacer/divider band, not content
// — see the CHANGE 1 drop in cleanSections.
function hasContentSignal(children: AnyRecord[]): boolean {
  return children.some((e) =>
    e.textRole || e.landmarkRole || e.repeatedGroup || ["img", "svg", "video", "canvas"].includes(e.tag));
}

// v3.1 CHANGE 2 gate — fires only when the page is genuinely under-segmented.
// The hard guard is captured content sections < 3 (excluding nav/footer): a
// page that already has 3+ real sections is, by definition, not the
// "div-soup with no <section> tags" shape this pass targets, no matter how
// tall any one of those sections happens to be (a long single-column article
// body legitimately spans 70%+ of the page as ONE section). Within that
// guard, fire when either (a) a single content section spans most of the
// page height and carries a lot of children — the "one big <div> full of
// content" shape — or (b) the page's non-nav/non-footer content spans a
// substantial pixel range with enough captured elements in that range to
// plausibly contain several real sections. Pages that already segment well
// (the corpus median is 8 sections) never satisfy the guard and are left
// untouched.
function isUnderSegmented(record: AnyRecord, classified: AnyRecord[], sectionElements: Map<string, AnyRecord[]>): boolean {
  const content = classified.filter((s) => s.role !== "nav" && s.role !== "footer");
  if (content.length >= 3) return false;
  const bigSingle = content.some((s) =>
    Number(s.rect?.normalized?.h ?? 0) > 0.6 && (sectionElements.get(s.id) || []).length >= 15);
  if (bigSingle) return true;
  const nav = classified.find((s) => s.role === "nav");
  const footer = classified.find((s) => s.role === "footer");
  const contentTop = nav ? Number(nav.rect.y) + Number(nav.rect.height) : 0;
  const contentBottom = footer ? Number(footer.rect.y) : Math.max(contentTop + 1, ...classified.map((s) => Number(s.rect.y) + Number(s.rect.height)));
  if (contentBottom - contentTop < 400) return false;
  // Direct element scan rather than summing sectionElements' members: when
  // content.length is 0 (e.g. boomy.com's baseline [nav, footer] shape) no
  // section exists to have collected the in-between content into, so the
  // sectionElements map itself has nothing to sum.
  const keptInRegion = nonContainerElements(record).filter((e) =>
    Number(e.rect?.y || 0) >= contentTop - 1 && Number(e.rect?.y || 0) < contentBottom).length;
  return keptInRegion >= 20;
}

// v3.1 CHANGE 2 — synthesize section bands for an under-segmented page from
// the captured signal directly (not from the (missing) semantic sections):
// primary boundaries at each heading of level <= 2, reinforced by large
// vertical gaps between leaf content clusters and by backgroundColor
// changes. Bands are classified by the SAME reclassifySectionRole logic
// every real section goes through (see the call site in cleanSections), so
// featureShape/roleConfidence/etc. all apply identically.
function synthesizeSectionBands(record: AnyRecord, contentTop: number, contentBottom: number, pageWidth: number, pageHeight: number): AnyRecord[] {
  const kept = nonContainerElements(record).filter((e) =>
    Number(e.rect?.y || 0) >= contentTop - 1 && Number(e.rect?.y || 0) < contentBottom);
  if (kept.length < 6) return [];
  const sorted = [...kept].sort((a, b) => Number(a.rect.y) - Number(b.rect.y));
  // h1/h2 is the primary boundary signal, but some div-soup pages (measured:
  // mac.eltima.com, a giant mis-measured wrapper section swallowing the
  // whole page) mark every visible heading h3+ (card/testimonial titles,
  // never an h1/h2 below the very top). Two or fewer h1/h2 boundaries isn't
  // enough to split anything, so widen to ANY headingLevel in that case —
  // still real heading elements, just not top-level ones.
  const strictHeadingBoundaries = sorted
    .filter((e) => e.textRole === "heading" && Number(e.headingLevel) >= 1 && Number(e.headingLevel) <= 2)
    .map((e) => Number(e.rect.y));
  const headingBoundaries = strictHeadingBoundaries.length >= 2 ? strictHeadingBoundaries : sorted
    .filter((e) => e.textRole === "heading" && Number.isFinite(Number(e.headingLevel)))
    .map((e) => Number(e.rect.y));
  const GAP_THRESHOLD = 150;
  const gapBoundaries: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prevBottom = Number(sorted[i - 1]!.rect.y) + Number(sorted[i - 1]!.rect.height);
    const curTop = Number(sorted[i]!.rect.y);
    if (curTop - prevBottom > GAP_THRESHOLD) gapBoundaries.push((prevBottom + curTop) / 2);
  }
  // Only WIDE elements (real section-spanning background panels) count as
  // background-change evidence. A row of small colored badges/tag chips
  // (common in feature lists) changes backgroundColor every few pixels of X
  // at the same Y and would otherwise mint a boundary per chip.
  const bgBoundaries: number[] = [];
  let prevColor: string | null = null;
  for (const e of sorted) {
    if (Number(e.rect?.width || 0) < pageWidth * 0.4) continue;
    const color = e.backgroundColor;
    if (!color || /rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)|transparent/i.test(String(color))) continue;
    if (prevColor && color !== prevColor) bgBoundaries.push(Number(e.rect.y));
    prevColor = color;
  }
  const rawBoundaries = [contentTop, ...headingBoundaries, ...gapBoundaries, ...bgBoundaries, contentBottom]
    .filter((y) => y >= contentTop && y <= contentBottom)
    .sort((a, b) => a - b);
  const boundaries: number[] = [];
  const MERGE_DISTANCE = 80;
  for (const y of rawBoundaries) {
    const last = boundaries[boundaries.length - 1];
    if (last == null || y - last > MERGE_DISTANCE) boundaries.push(y);
    else boundaries[boundaries.length - 1] = (last + y) / 2;
  }
  // Cap synthesized band count. A very tall scrollytelling page can carry
  // 20-30 h2-level subheadings (one per feature bullet) — technically real
  // boundaries, but exploding into that many bands would make this pass a
  // net BLOAT source against the corpus's own macro-section grammar (median
  // ~8 sections/page incl. nav+footer), the opposite of its purpose. Keep
  // only the MAX_BANDS strongest boundaries by iteratively merging the
  // closest adjacent pair — this preserves the biggest/most-distinct breaks
  // (usually the gap/bg-reinforced ones) over closely-packed heading noise.
  const MAX_BANDS = 10;
  while (boundaries.length - 1 > MAX_BANDS) {
    let minGap = Infinity;
    let minIdx = -1;
    for (let i = 1; i < boundaries.length; i++) {
      const gap = boundaries[i]! - boundaries[i - 1]!;
      if (gap < minGap) { minGap = gap; minIdx = i; }
    }
    boundaries[minIdx - 1] = (boundaries[minIdx - 1]! + boundaries[minIdx]!) / 2;
    boundaries.splice(minIdx, 1);
  }
  if (boundaries.length < 2) return [];
  const bands: AnyRecord[] = [];
  const MIN_BAND_HEIGHT = 60;
  for (let i = 0; i < boundaries.length - 1; i++) {
    const y0 = boundaries[i]!;
    const y1 = boundaries[i + 1]!;
    if (y1 - y0 < MIN_BAND_HEIGHT) continue;
    const members = sorted.filter((e) => {
      const cy = Number(e.rect.y) + Number(e.rect.height) / 2;
      return cy >= y0 && cy < y1;
    });
    if (!members.length) continue;
    const height = y1 - y0;
    const headingMember = members.find((e) => e.textRole === "heading");
    bands.push({
      id: `synth-${hash(`${y0.toFixed(1)}-${y1.toFixed(1)}-${members.length}`)}`,
      rect: {
        x: 0,
        y: y0,
        width: pageWidth,
        height,
        normalized: {
          x: 0,
          y: clamp01(y0 / pageHeight),
          w: 1,
          h: clamp01(height / pageHeight),
        },
        areaShare: clamp01((pageWidth * height) / Math.max(1, pageWidth * pageHeight)),
      },
      role: "unknown",
      roleConfidence: 0,
      heightShare: 0,
      heading: headingMember ? headingMember.textSnippet : null,
      focalPoint: "center",
      composition: "stack",
      featureShape: "plain",
    });
  }
  return bands;
}

// Once the footer singleton is settled, nothing may start at or below its
// top edge — a footer's own column link-lists sometimes arrive as separate
// trailing sections (anthropic.com). Drop them and renormalize heightShare
// over what remains so the shares still sum to ~1.
function absorbBelowFooter(sections: AnyRecord[]): AnyRecord[] {
  const footer = sections.find((s) => s.role === "footer");
  if (!footer) return sections;
  const footerY = Number(footer.rect?.normalized?.y ?? 1);
  const kept = sections.filter((s) => s === footer || Number(s.rect?.normalized?.y ?? 0) < footerY);
  if (kept.length === sections.length) return sections;
  const total = kept.reduce((sum, s) => sum + Math.max(0, Number(s.rect?.height || 0)), 0) || 1;
  for (const s of kept) s.heightShare = round(Math.max(0, Number(s.rect?.height || 0)) / total, 5);
  return kept;
}

// Final read order is visual Y, with the page-level landmarks pinned to
// where a reader actually encounters them: nav always first (it's the
// masthead, even when it's geometrically nested inside a taller hero rect),
// footer always last.
function orderSections(sections: AnyRecord[]): AnyRecord[] {
  const normY = (section: AnyRecord): number => Number(section.rect?.normalized?.y ?? 0);
  return [...sections].sort((a, b) => {
    if (a.role === "nav" && b.role !== "nav") return -1;
    if (b.role === "nav" && a.role !== "nav") return 1;
    if (a.role === "footer" && b.role !== "footer") return 1;
    if (b.role === "footer" && a.role !== "footer") return -1;
    return normY(a) - normY(b);
  });
}

// "nav" and "footer" are page-level landmarks: a real page has exactly one of
// each. Keyword/landmark signals occasionally fire on a second band (a
// sub-nav strip, a pre-footer CTA band, a cookie-notice bar) that looks like
// the landmark but isn't positioned like it. Keep only the positionally
// correct instance — topmost for nav, bottommost for footer — and
// reclassify every other same-labeled section from its own content,
// excluding the role it just lost so it can't just re-earn the same label
// off a stray keyword/landmark match.
function enforcePositionalSingletons(sections: AnyRecord[], sectionElements: Map<string, AnyRecord[]>): void {
  const normY = (section: AnyRecord): number => Number(section.rect?.normalized?.y ?? 0);
  const reclassifyDemoted = (section: AnyRecord, excludeRoles: Set<string>): string => {
    const children = sectionElements.get(section.id) || [];
    const confidenceOut = { value: 0.5 };
    const role = reclassifySectionRole({ ...section, role: "unknown" }, children, { excludeRoles, confidenceOut });
    section.roleConfidence = confidenceOut.value;
    return role;
  };

  const navs = sections.filter((s) => s.role === "nav");
  if (navs.length > 1) {
    const top = navs.reduce((best, s) => (normY(s) < normY(best) ? s : best));
    for (const s of navs) {
      if (s === top) continue;
      // A demoted "nav" sitting near the page bottom is, in practice, a
      // mislabeled footer (both are link-list bands with a "menu"-ish
      // keyword hit) — treat it as a footer-candidate directly rather than
      // re-running content rules that would just fall through to unknown.
      if (normY(s) >= 0.7) {
        s.role = "footer";
        s.roleConfidence = 0.8;
      } else {
        s.role = reclassifyDemoted(s, new Set(["nav"]));
      }
    }
  }

  // Recomputed fresh (not the pre-nav-pass snapshot) so a nav demoted to
  // "footer" above is included in the singleton check below.
  const footers = sections.filter((s) => s.role === "footer");
  if (footers.length > 1) {
    const bottom = footers.reduce((best, s) => (normY(s) > normY(best) ? s : best));
    for (const s of footers) {
      if (s === bottom) continue;
      s.role = reclassifyDemoted(s, new Set(["footer"]));
    }
  }
}

function overlapRatio(a: AnyRecord, b: AnyRecord): number {
  if (!a || !b) return 0;
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  const inter = Math.max(0, right - left) * Math.max(0, bottom - top);
  const minArea = Math.min(a.width * a.height, b.width * b.height) || 1;
  return inter / minArea;
}

function visibleElements(record: AnyRecord): AnyRecord[] {
  return (record.desktop?.elements || []).filter((element: AnyRecord) =>
    element.rect?.width > 0 && element.rect?.height > 0 && element.visibility?.opacity > 0,
  );
}

function nonContainerElements(record: AnyRecord): AnyRecord[] {
  return visibleElements(record).filter((element) =>
    element.textRole || ["img", "svg", "video", "canvas"].includes(element.tag) || element.landmarkRole,
  );
}

// Kept elements (textRole/media/landmark) frequently include DOM ancestors of
// other kept elements (e.g. <body>/<main> wrappers both get textRole "body"
// because they contain >18 chars of text, same as their leaf descendants).
// Summing/weighting on the raw kept set double- or triple-counts the same
// pixels once per ancestor. Reduce to the leaf-most kept element per branch —
// the element whose kept set has no kept descendant — so area sums and
// alignment voting reflect actual non-overlapping coverage.
function leafKeptElements(elements: AnyRecord[], allElements: AnyRecord[]): AnyRecord[] {
  const keptIds = new Set(elements.map((e) => e.id));
  const byId = new Map(allElements.map((e) => [e.id, e]));
  const hasKeptDescendant = new Set<string>();
  for (const element of elements) {
    let pid = element.parentId;
    let guard = 0;
    while (pid && guard++ < 200) {
      if (keptIds.has(pid)) hasKeptDescendant.add(pid);
      const parent = byId.get(pid);
      pid = parent ? parent.parentId : null;
    }
  }
  return elements.filter((e) => !hasKeptDescendant.has(e.id));
}

// Dedupe repeated-card/list instances so a 5-item feature list doesn't cast 5
// votes for whatever column it happens to sit in.
function dedupeRepeated(list: AnyRecord[]): AnyRecord[] {
  const seen = new Set<string>();
  return list.filter((e) => {
    if (!e.repeatedGroup) return true;
    const key = `${e.repeatedGroup}:${e.textRole}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function marginVotes(list: AnyRecord[]): { left: number; center: number; right: number } {
  const buckets = { left: 0, center: 0, right: 0 };
  for (const element of list) {
    const nx = Number(element.rect?.normalized?.x ?? 0);
    const nw = Number(element.rect?.normalized?.w ?? 0);
    const leftMargin = nx;
    const rightMargin = Math.max(0, 1 - (nx + nw));
    // Bigger type carries more visual weight in setting the page's reading
    // direction than a small caption does.
    const weight = Math.max(8, Number(element.fontSize) || 16);
    if (leftMargin < rightMargin - 0.06) buckets.left += weight;
    else if (rightMargin < leftMargin - 0.06) buckets.right += weight;
    else buckets.center += weight;
  }
  return buckets;
}

// headingElements must come from the RAW (non-leaf-reduced) kept set: real
// heading tags never suffer the wrapper-duplication problem leaf reduction
// exists to fix (only <div>/<body>/<main> wrappers pick up textRole "body"
// from the >18-char rule), and some hero H1s are split into per-word inline
// spans for animation — leaf reduction would drop the H1 itself and keep only
// its decorative word spans, throwing away the real signal. bodyElements
// should be the leaf-reduced set, used only as a fallback when a page has no
// headings at all.
function modalAlignment(headingElements: AnyRecord[], bodyElements: AnyRecord[]): string {
  const headings = dedupeRepeated(headingElements.filter((e) => e.textRole === "heading"));
  let buckets = marginVotes(headings);
  if (!buckets.left && !buckets.center && !buckets.right) {
    buckets = marginVotes(dedupeRepeated(bodyElements.filter((e) => e.textRole === "body")));
  }
  const largest = Object.entries(buckets).sort((a, b) => b[1] - a[1])[0];
  return largest?.[1] ? `${largest[0]}-led` : "left-led";
}

function columnCount(elements: AnyRecord[]): number {
  const candidates = elements.filter((e) => e.repeatedGroup && e.rect.width > 40 && e.rect.height > 30 && e.rect.y < 1800);
  const centers = candidates.map((e) => e.rect.x + e.rect.width / 2).sort((a, b) => a - b);
  const clusters: number[] = [];
  for (const center of centers) {
    const last = clusters[clusters.length - 1];
    if (last == null || center - last > 150) clusters.push(center);
    else clusters[clusters.length - 1] = (last + center) / 2;
  }
  return Math.max(1, Math.min(12, clusters.length || (elements.some((e) => /grid-led/.test(e.sectionRole || "")) ? 4 : 1)));
}

function splitRatio(elements: AnyRecord[]): number {
  const hero = elements.filter((e) => e.sectionRole === "hero" && (e.textRole || ["img", "svg", "video"].includes(e.tag)));
  if (!hero.length) return 0.5;
  const left = hero.filter((e) => e.rect.x + e.rect.width / 2 < 720).reduce((sum, e) => sum + e.rect.areaShare, 0);
  const right = hero.filter((e) => e.rect.x + e.rect.width / 2 >= 720).reduce((sum, e) => sum + e.rect.areaShare, 0);
  if (!left && !right) return 0.5;
  return round(clamp01(left / (left + right), 0.5), 2);
}

function repetitionEntropy(elements: AnyRecord[]): number {
  const counts = new Map<string, number>();
  for (const element of elements) if (element.repeatedGroup) counts.set(element.repeatedGroup, (counts.get(element.repeatedGroup) || 0) + 1);
  const values = [...counts.values()];
  const total = values.reduce((sum, value) => sum + value, 0);
  if (values.length <= 1 || !total) return 0;
  const entropy = -values.reduce((sum, value) => {
    const p = value / total;
    return sum + p * Math.log2(p);
  }, 0);
  return round(clamp01(entropy / Math.log2(values.length)), 3);
}

function materialOf(record: AnyRecord): AnyRecord {
  const elements = visibleElements(record).filter((e) => e.rect.areaShare > 0.00005);
  const radii = { sharp: 0, rounded: 0, pill: 0 };
  let shadows = 0;
  let coloredShadows = 0;
  let borders = 0;
  let gradients = 0;
  const accentColors = new Set<string>();
  for (const element of elements) {
    const radius = Number(element.borderRadius || 0);
    if (radius >= 100) radii.pill++;
    else if (radius >= 8) radii.rounded++;
    else radii.sharp++;
    if (element.boxShadow && element.boxShadow !== "none") {
      shadows++;
      if (/rgba?\([^)]*(?:1[2-9][0-9]|2[0-5][0-9]),|#[0-9a-f]{6}/i.test(element.boxShadow)) coloredShadows++;
    }
    if (element.borderColor) borders++;
    if (element.backgroundImage && element.backgroundImage !== "none") gradients++;
    for (const color of [element.color, element.backgroundColor]) {
      if (color && !/rgba?\(0, 0, 0, 0\)|transparent|lab\([^)]* 0(?:\.0+)?\)/i.test(color)) accentColors.add(color);
    }
  }
  const radiusLanguage = radii.pill > 0 ? "pill-dominant" : radii.rounded > radii.sharp ? "controlled-rounded" : "sharp-minimal";
  const shadowLanguage = shadows === 0 ? "flat-borders-not-shadows" : coloredShadows > Math.max(2, shadows * 0.2) ? "colored-glow-elevation" : "soft-low-elevation";
  const borderLanguage = borders > Math.max(3, elements.length * 0.25) ? "structural-dividers" : borders ? "selective" : "minimal";
  const accentStrategy = accentColors.size <= 2 ? "one-primary-plus-signal" : accentColors.size <= 6 ? "controlled-multi-accent" : "multi-accent";
  const surfaceTexture = gradients > Math.max(2, elements.length * 0.08) ? "gradient-or-textured" : "none-or-subtle";
  return { radiusLanguage, shadowLanguage, borderLanguage, accentStrategy, surfaceTexture };
}

// The real attention cluster is the primary heading + primary CTA near it —
// not the enclosing hero/section rect (which can span the whole viewport and
// pins focalAreaShare near 1.0 regardless of how much of it is actually
// "focal"). Union their normalized bounding boxes.
function focalClusterAreaShare(elements: AnyRecord[]): number {
  const headings = elements.filter((e) => e.textRole === "heading" && e.rect?.normalized);
  const ctas = elements.filter((e) => e.textRole === "cta" && e.rect?.normalized);
  const primaryHeading = [...headings].sort((a, b) => Number(b.fontSize || 0) - Number(a.fontSize || 0))[0];
  const primaryCta = [...ctas].sort((a, b) => Number(b.rect.areaShare || 0) - Number(a.rect.areaShare || 0))[0];
  const cluster = [primaryHeading, primaryCta].filter(Boolean) as AnyRecord[];
  if (!cluster.length) return 0.12;
  const x0 = Math.min(...cluster.map((e) => e.rect.normalized.x));
  const y0 = Math.min(...cluster.map((e) => e.rect.normalized.y));
  const x1 = Math.max(...cluster.map((e) => e.rect.normalized.x + e.rect.normalized.w));
  const y1 = Math.max(...cluster.map((e) => e.rect.normalized.y + e.rect.normalized.h));
  const w = Math.max(0, x1 - x0);
  const h = Math.max(0, y1 - y0);
  return clamp01(w * h, 0.12);
}

// v3 P3 — left-edge histogram of leaf-kept elements approximates the page's
// modal grid, independent of repeatedGroup (so it also picks up CSS-grid
// layouts that don't carry a repeated-card signal). Frequent, closely-spaced
// left edges cluster into "columns"; the tightest gap between adjacent
// column starts is the gutter, and the first column's offset from the page
// edge is the outer margin.
function gridAnalysisOf(elements: AnyRecord[], pageWidth: number): AnyRecord {
  const edges = elements
    .filter((e) => e.rect?.width > 40 && e.rect?.height > 20)
    .map((e) => Number(e.rect.x || 0))
    .filter((x) => Number.isFinite(x))
    .sort((a, b) => a - b);
  if (edges.length < 4 || !(pageWidth > 0)) return { gridColumns: 1, gutterShare: 0, outerMarginShare: 0 };
  const clusters: Array<{ center: number; count: number }> = [];
  for (const x of edges) {
    const last = clusters[clusters.length - 1];
    if (last == null || x - last.center > 24) clusters.push({ center: x, count: 1 });
    else { last.center = (last.center * last.count + x) / (last.count + 1); last.count++; }
  }
  const significant = clusters.filter((c) => c.count >= 2).sort((a, b) => a.center - b.center);
  const gaps: number[] = [];
  for (let i = 1; i < significant.length; i++) gaps.push(significant[i]!.center - significant[i - 1]!.center);
  const modalGap = gaps.length ? median(gaps) : 0;
  const outerMargin = significant.length ? significant[0]!.center : 0;
  return {
    gridColumns: Math.max(1, Math.min(12, significant.length || 1)),
    gutterShare: round(clamp01(modalGap > 0 ? Math.min(modalGap, pageWidth * 0.08) / pageWidth : 0, 0), 4),
    outerMarginShare: round(clamp01(outerMargin / pageWidth, 0), 4),
  };
}

// v3 P3 — Y-ordered headingLevel sequence as a compact "h1>h2>h2>h3" string,
// plus a few cheap outline-quality summaries. headingLevel comes straight
// from the capture (h1..h6); sections with no headingLevel data degrade to
// an empty outline rather than throwing.
function headingOutlineOf(elements: AnyRecord[]): AnyRecord {
  const headings = elements
    .filter((e) => e.textRole === "heading" && Number.isFinite(Number(e.headingLevel)))
    .sort((a, b) => Number(a.rect?.y || 0) - Number(b.rect?.y || 0));
  const levels = headings.map((e) => Number(e.headingLevel));
  const h1Count = levels.filter((l) => l === 1).length;
  let levelSkips = 0;
  for (let i = 1; i < levels.length; i++) if (levels[i]! - levels[i - 1]! > 1) levelSkips++;
  const outlineDepth = levels.length ? Math.max(...levels) - Math.min(...levels) + 1 : 0;
  return { outline: levels.map((l) => `h${l}`).join(">").slice(0, 400), h1Count, levelSkips, outlineDepth };
}

// v3 P3 — 0..1 fraction of leaf elements whose overlapIds point at an
// element living in a DIFFERENT section (stacked panels, sticky headers over
// hero media, backdrop-blurred cards) — boosted when backdropFilter usage or
// a wide zIndex spread corroborate deliberate layering rather than incidental
// overlap. Uses the RAW (uncollapsed) captured sections purely as a spatial
// boundary map; independent of cleanSections' role/band merging.
function layeringDepthOf(record: AnyRecord, elements: AnyRecord[]): number {
  if (!elements.length) return 0;
  const rawSections = (record.desktop?.sections || []).filter((s: AnyRecord) => s && s.id && s.rect);
  const bySection = elementsBySection(elements, rawSections);
  const elementSection = new Map<string, string>();
  for (const [sectionId, members] of bySection) for (const e of members) elementSection.set(e.id, sectionId);
  let crossing = 0;
  for (const e of elements) {
    if (!Array.isArray(e.overlapIds) || !e.overlapIds.length) continue;
    const mySection = elementSection.get(e.id);
    if (e.overlapIds.some((id: string) => {
      const otherSection = elementSection.get(id);
      return otherSection != null && otherSection !== mySection;
    })) crossing++;
  }
  const base = crossing / elements.length;
  const backdropCount = elements.filter((e) => e.backdropFilter && e.backdropFilter !== "none").length;
  const zIndexes = elements.map((e) => Number(e.zIndex) || 0);
  const zSpread = zIndexes.length ? Math.max(...zIndexes) - Math.min(...zIndexes) : 0;
  const boost = clamp01((backdropCount / Math.max(1, elements.length)) * 2 + Math.min(1, zSpread / 20) * 0.3, 0);
  return round(clamp01(base * 0.7 + boost * 0.3, 0), 3);
}

function genomeOf(record: AnyRecord): AnyRecord {
  const rawElements = nonContainerElements(record);
  const elements = leafKeptElements(rawElements, record.desktop?.elements || []);
  const { sections, bandRhythm } = cleanSections(record);
  const bodySizes = elements.filter((e) => e.textRole === "body" && e.fontSize > 0).map((e) => e.fontSize);
  const headingSizes = elements.filter((e) => e.textRole === "heading" && e.fontSize > 0).map((e) => e.fontSize);
  // De-overlapped (leaf-only) area sums: each pixel of the page is counted at
  // most once, instead of once per DOM ancestor that happens to share a
  // textRole/tag with its descendant.
  const textArea = elements.filter((e) => e.textRole === "heading" || e.textRole === "body")
    .reduce((sum, e) => sum + Number(e.rect.areaShare || 0), 0);
  const assetArea = elements.filter((e) => ["img", "svg", "video", "canvas"].includes(e.tag))
    .reduce((sum, e) => sum + Number(e.rect.areaShare || 0), 0);
  const ctas = elements.filter((e) => e.textRole === "cta");
  const maxCta = Math.max(0, ...ctas.map((e) => Number(e.rect.areaShare || 0)));
  const maxText = Math.max(0.0001, ...elements.filter((e) => e.textRole).map((e) => Number(e.rect.areaShare || 0)));
  // No inflation multiplier: textArea/assetArea are already non-overlapping
  // leaf coverage, so their sum is a direct estimate of content density.
  const contentDensity = clamp01(textArea + assetArea, 0.3);
  const focalAreaShare = focalClusterAreaShare(elements);
  const quality = { score: null, confidence: null, provenance: [] as string[] };
  const slop = { score: null, matchedRules: [] as string[] };
  const { pageWidth } = sectionPageScale(record.desktop?.sections || []);
  return {
    pageKind: pageKindOf(record),
    sectionGrammar: sections,
    macro: {
      contentWidthShare: round(clamp01(median(elements.filter((e) => e.rect.width > 300).map((e) => e.rect.width / 1440)), 0.78), 3),
      columnCount: columnCount(elements),
      splitRatio: splitRatio(elements),
      alignment: modalAlignment(rawElements, elements),
      whitespace: round(clamp01(1 - contentDensity), 3),
      contentDensity: round(contentDensity, 3),
      // v3 additive: independent of columnCount/repeatedGroup, from a
      // left-edge histogram — see gridAnalysisOf.
      grid: gridAnalysisOf(elements, pageWidth),
    },
    hierarchy: {
      focalAreaShare: round(focalAreaShare, 3),
      headingScaleRatio: round(clamp01((Math.max(...headingSizes, 24) / Math.max(1, median(bodySizes) || 16)) / 5, 0.5) * 5, 2),
      ctaProminence: round(clamp01(maxCta / maxText, 0.5), 3),
      // Rebalanced so the score spreads across [0,1] instead of clipping at 1
      // for any focalAreaShare above ~0.42 (0.25 + 0.42*1.8 already == 1.0).
      contrastConcentration: round(clamp01(0.1 + focalAreaShare * 1.3 + (maxCta / maxText) * 0.25, 0.35), 3),
      repetitionEntropy: repetitionEntropy(elements),
    },
    material: materialOf(record),
    responsive: { mobileTransform: record.responsiveTransform?.summary || "unobserved" },
    // v3 additive genome fields — see gridAnalysisOf/bandRhythmOf/
    // headingOutlineOf/layeringDepthOf; all optional and defensively
    // defaulted, never load-bearing for existing fields above.
    bandRhythm,
    headingOutline: headingOutlineOf(elements),
    layeringDepth: layeringDepthOf(record, elements),
    quality,
    slop,
  };
}

function slopCandidates(record: AnyRecord): AnyRecord[] {
  const elements = visibleElements(record);
  const matches: AnyRecord[] = [];
  const add = (rule: string, severity: string, evidence: AnyRecord[], rationale: string): void => {
    if (!severity || !evidence.length) return;
    matches.push({ rule, severity, evidence: evidence.slice(0, 8).map((e) => e.id || e.domPath), rationale, basis: "own-crawl-deterministic-candidate" });
  };
  const rounded = elements.filter((e) => Number(e.borderRadius || 0) >= 100);
  const glows = elements.filter((e) => /rgba?\(/.test(e.boxShadow || "") && e.boxShadow !== "none");
  const gradients = elements.filter((e) => (e.backgroundImage || "").includes("gradient"));
  const repeated = elements.filter((e) => e.repeatedGroup);
  const fonts = new Set(elements.map((e) => String(e.fontFamily || "").split(",")[0].replace(/["']/g, "").trim().toLowerCase()).filter(Boolean));
  const cardLike = repeated.filter((e) => e.rect.width > 180 && e.rect.height > 100 && (e.boxShadow !== "none" || e.borderRadius >= 8));
  add("pill-heavy", rounded.length >= 8 && rounded.length / Math.max(1, elements.length) > 0.08 ? "medium" : "", rounded, "Pills are prevalent enough to inspect for unearned UI uniformity; frequency alone is not a final slop judgment.");
  add("colored-glow-shadow", glows.filter((e) => /rgba?\([^)]*(?:[1-9][0-9]|2[0-5][0-9]),/i.test(e.boxShadow || "")).length >= 3 ? "medium" : "", glows, "Colored shadows require visual review for hierarchy or decorative glow misuse.");
  add("gradient-text-or-surface", gradients.length >= 2 || record.fp?.gradientText ? "low" : "", gradients, "Gradient usage is an inspection candidate, not inherently slop.");
  add("single-font-monoculture", fonts.size === 1 && elements.length >= 12 ? "medium" : "", elements.filter((e) => e.textRole), "One family across all roles may erase hierarchy; validate against the page job.");
  add("repeated-card-default", cardLike.length >= 6 ? "medium" : "", cardLike, "Repeated equal modules may indicate the interchangeable-card pattern.");
  add("decorative-grid-background", elements.filter((e) => /repeating-(linear|radial)-gradient|grid/i.test(e.backgroundImage || "")).length ? "medium" : "", elements.filter((e) => /repeating-(linear|radial)-gradient|grid/i.test(e.backgroundImage || "")), "Grid decoration should be validated as subject-grounded rather than ornamental.");
  return matches;
}

function fingerprint(genome: AnyRecord): string {
  const importantRoles = new Set(["nav", "hero", "proof", "features", "pricing", "faq", "cta", "footer"]);
  const roleSet = [...new Set(genome.sectionGrammar.map((section: AnyRecord) => String(section.role || "unknown")))]
    .filter((role) => importantRoles.has(role)).sort();
  const columns = Number(genome.macro.columnCount || 1) >= 4 ? "4+" : String(genome.macro.columnCount || 1);
  return [
    genome.pageKind,
    roleSet.join("+") || "unknown",
    columns,
  ].join("|");
}

function clusterGenomes(records: AnyRecord[]): AnyRecord[] {
  const groups = new Map<string, AnyRecord[]>();
  for (const record of records) {
    const key = fingerprint(record.genome);
    const list = groups.get(key) || [];
    list.push(record);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length || (a[0] < b[0] ? -1 : 1))
    .map(([key, members], index) => ({
      clusterId: `layout-cluster-${String(index + 1).padStart(3, "0")}-${hash(key)}`,
      name: null,
      inspectionStatus: "unreviewed",
      key,
      memberCount: members.length,
      representativeHost: members[0]?.host || null,
      representativeScreenshot: members[0]?.screenshot || null,
      sampleHosts: members.slice(0, 12).map((member) => member.host),
      pageKinds: [...new Set(members.map((member) => member.genome.pageKind))],
    }));
}

function familyScore(family: AnyRecord, genome: AnyRecord): number {
  if (family.pageKind !== genome.pageKind) return 0;
  const familyRoles = family.sectionGrammar.map((s: AnyRecord) => s.role);
  const observedRoles = genome.sectionGrammar.map((s: AnyRecord) => s.role);
  const roleHit = familyRoles.filter((role: string) => observedRoles.includes(role)).length / Math.max(1, familyRoles.length);
  const compositionHit = family.sectionGrammar.filter((section: AnyRecord) => observedRoles.includes(section.role) &&
    genome.sectionGrammar.some((observed: AnyRecord) => observed.role === section.role && observed.composition === section.composition)).length / Math.max(1, familyRoles.length);
  const macro = family.macro || {};
  const macroFit = 1 - (Math.abs(Number(macro.columnCount || 1) - Number(genome.macro.columnCount || 1)) / 12 +
    Math.abs(Number(macro.contentDensity || 0.5) - Number(genome.macro.contentDensity || 0.5)) +
    Math.abs(Number(macro.splitRatio || 0.5) - Number(genome.macro.splitRatio || 0.5))) / 3;
  return clamp01(0.55 * roleHit + 0.25 * compositionHit + 0.2 * macroFit, 0);
}

function makeReviewQueue(records: AnyRecord[], candidates: AnyRecord[]): AnyRecord {
  const byHost = new Map(candidates.map((candidate) => [candidate.host, candidate]));
  const sorted = [...records].sort((a, b) => {
    const aSlop = byHost.get(a.host)?.matches?.length || 0;
    const bSlop = byHost.get(b.host)?.matches?.length || 0;
    return aSlop - bSlop || (b.genome.hierarchy.focalAreaShare - a.genome.hierarchy.focalAreaShare);
  });
  return {
    schemaVersion: "layout-review-queue.v1",
    generatedAt: new Date().toISOString(),
    note: "Candidates are not ground truth. Human review must inspect the linked desktop/mobile screenshots and record evidence.",
    positiveQuality: sorted.slice(0, 24).map((record) => ({ host: record.host, pageKind: record.genome.pageKind, screenshot: record.screenshot, reason: "low deterministic slop-candidate count; inspect hierarchy/craft" })),
    slop: [...records].sort((a, b) => (byHost.get(b.host)?.matches?.length || 0) - (byHost.get(a.host)?.matches?.length || 0)).slice(0, 24)
      .map((record) => ({ host: record.host, pageKind: record.genome.pageKind, screenshot: record.screenshot, matches: byHost.get(record.host)?.matches || [] })),
    uncertain: sorted.slice(Math.floor(sorted.length * 0.45), Math.floor(sorted.length * 0.45) + 24)
      .map((record) => ({ host: record.host, pageKind: record.genome.pageKind, screenshot: record.screenshot, reason: "mixed evidence; inspect before labeling" })),
  };
}

async function loadManualReview(): Promise<Map<string, AnyRecord>> {
  try {
    const parsed = JSON.parse(await readFile(REVIEW_PATH, "utf8"));
    return new Map((parsed.records || []).map((record: AnyRecord) => [record.host, record]));
  } catch {
    return new Map();
  }
}

async function loadFamilies(): Promise<AnyRecord[]> {
  // The module is read-only here; this script only writes data artifacts.
  // @ts-ignore no declaration file exists for the frozen .mjs module.
  const module = await import("../../../apps/engine/layout-families.mjs");
  return module.LAYOUT_FAMILIES as AnyRecord[];
}

async function main(): Promise<void> {
  const { raw, outVersion } = parseArgs(process.argv.slice(2));
  await mkdir(OUT, { recursive: true });
  const genomes: AnyRecord[] = [];
  const candidates: AnyRecord[] = [];
  const hostIndexes = new Map<string, number>();
  const hostCompleteness = new Map<string, number>();
  const rawByHost = new Map<string, AnyRecord>();
  const rawHostCoverage = new Map<string, { desktop: boolean; mobile: boolean }>();
  let rawRecords = 0;
  let rawPhysicalLines = 0;
  let malformedRawLines = 0;
  let duplicateRecords = 0;
  const review = await loadManualReview();
  const input = createReadStream(raw, { encoding: "utf8" });
  const lines = createInterface({ input, crlfDelay: Infinity });
  for await (const line of lines) {
    rawPhysicalLines++;
    if (!line.trim()) continue;
    let record: AnyRecord;
    try { record = JSON.parse(line); } catch { malformedRawLines++; continue; }
    rawRecords++;
    if (record.schemaVersion === "geometry-crawl.v2" && record.host) {
      const coverage = rawHostCoverage.get(record.host) || { desktop: false, mobile: false };
      coverage.desktop ||= !!record.desktop;
      coverage.mobile ||= !!record.mobile;
      rawHostCoverage.set(record.host, coverage);
      const previous = rawByHost.get(record.host);
      if (previous) {
        if (record.desktop) previous.desktop = record.desktop;
        if (record.mobile) previous.mobile = record.mobile;
        previous.ok = previous.ok || record.ok;
        previous.url ||= record.url;
        previous.fp ||= record.fp;
        previous.responsiveTransform ||= record.responsiveTransform;
        record = previous;
      } else {
        rawByHost.set(record.host, record);
      }
    }
    if (record.schemaVersion !== "geometry-crawl.v2" || !record.ok || !record.desktop) continue;
    const completeness = Number(!!record.desktop) + Number(!!record.mobile);
    const existingIndex = hostIndexes.get(record.host);
    if (existingIndex != null && completeness <= (hostCompleteness.get(record.host) || 0)) {
      duplicateRecords++;
      continue;
    }
    const genome = genomeOf(record);
    const manual = review.get(record.host);
    if (manual?.set === "positive-quality") {
      genome.quality = { score: manual.score ?? null, confidence: manual.confidence ?? null, provenance: ["manual-review.v1"] };
    }
    if (manual?.set === "slop") {
      genome.slop = { score: manual.score ?? null, matchedRules: manual.matchedRules || [] };
    }
    const screenshot = {
      desktop: record.desktop.screenshot?.path || null,
      mobile: record.mobile?.screenshot?.path || null,
    };
    const genomeRecord = { host: record.host, url: record.url, screenshot, genome };
    const candidateRecord = {
      host: record.host,
      url: record.url,
      pageKind: genome.pageKind,
      screenshots: screenshot,
      matches: slopCandidates(record),
      provenance: { reviewer: null, date: null, evidence: "deterministic crawl fields", confidence: 0.5, method: "deterministic-candidate" },
    };
    if (existingIndex != null) {
      genomes[existingIndex] = genomeRecord;
      candidates[existingIndex] = candidateRecord;
    } else {
      hostIndexes.set(record.host, genomes.length);
      genomes.push(genomeRecord);
      candidates.push(candidateRecord);
    }
    hostCompleteness.set(record.host, completeness);
  }
  const clusters = clusterGenomes(genomes);
  const families = await loadFamilies();
  const familyValidation = families.map((family) => {
    const scores = genomes.map((record) => ({ record, score: familyScore(family, record.genome) })).sort((a, b) => b.score - a.score);
    const pageKindRecords = genomes.filter((record) => record.genome.pageKind === family.pageKind);
    const matched = scores.filter((item) => item.score >= 0.55);
    const positiveReviewed = genomes.filter((record) => review.get(record.host)?.set === "positive-quality" && record.genome.pageKind === family.pageKind);
    return {
      name: family.name,
      pageKind: family.pageKind,
      prevalenceEvidence: {
        corpusRecords: genomes.length,
        pageKindRecords: pageKindRecords.length,
        pageKindPct: round(pageKindRecords.length / Math.max(1, genomes.length), 4),
        matchedRecords: matched.length,
        matchedPct: round(matched.length / Math.max(1, genomes.length), 4),
        sampleHosts: matched.slice(0, 12).map((item) => item.record.host),
        observedSectionRoles: [...new Set(matched.flatMap((item) => item.record.genome.sectionGrammar.map((section: AnyRecord) => section.role)))],
        bestScores: scores.slice(0, 5).map((item) => ({ host: item.record.host, score: round(item.score, 4) })),
      },
      reviewEvidence: {
        positiveQualityRecordsForPageKind: positiveReviewed.length,
        positiveQualityHosts: positiveReviewed.map((record) => record.host),
      },
      flags: {
        notObservedInCrawl: pageKindRecords.length === 0,
        notObservedAsExactMatch: matched.length === 0,
        notVerifiedAsGood: positiveReviewed.length === 0,
        weakPrevalence: matched.length > 0 && matched.length < Math.max(2, genomes.length * 0.005),
      },
      provenance: "geometry-crawl.v2 + layout-genome-derivation.v1",
    };
  });
  const outputRecords = genomes.map((record) => ({
    schemaVersion: `layout-genome.${outVersion}`,
    host: record.host,
    url: record.url,
    screenshots: record.screenshot,
    ...record.genome,
  }));
  // The primary genome stream is the exact frozen LayoutGenome object. The
  // manifest keeps host/screenshot provenance beside it without polluting the
  // engine-facing schema.
  await writeFile(resolve(OUT, `layout-genomes.${outVersion}.ndjson`), outputRecords.map((record) => JSON.stringify(Object.fromEntries(Object.entries(record).filter(([key]) => !["schemaVersion", "host", "url", "screenshots"].includes(key))))).join("\n") + (outputRecords.length ? "\n" : ""));
  await writeFile(resolve(OUT, `layout-genome-manifest.${outVersion}.ndjson`), outputRecords.map((record) => JSON.stringify({ host: record.host, url: record.url, screenshots: record.screenshots, schemaVersion: record.schemaVersion })).join("\n") + (outputRecords.length ? "\n" : ""));
  // The rest of the derived artifacts (labels, clusters, review queues, family
  // validation) are only regenerated for the canonical v1 run. A non-v1
  // (e.g. v2 re-derivation) run only refreshes the genome stream + manifest so
  // it never touches the v1 label/review/cluster files.
  if (outVersion !== "v1") {
    console.log(`Derived ${outputRecords.length} LayoutGenome records (out-version=${outVersion}); skipped labels/clusters/review-queue/family artifacts to avoid touching v1 files.`);
    return;
  }
  await writeFile(resolve(OUT, "quality-labels.v1.json"), JSON.stringify({
    schemaVersion: "quality-labels.v1",
    independentFromSlop: true,
    provenance: { reviewer: "Codex visual inspection", date: "2026-08-03", evidence: "fixed desktop/mobile screenshots plus written observations", confidence: "reviewer confidence in the independent quality dimensions", modality: "human" },
    records: [...review.values()].filter((record) => record.set === "positive-quality"),
  }, null, 2));
  await writeFile(resolve(OUT, "slop-labels.v1.json"), JSON.stringify({
    schemaVersion: "slop-labels.v1",
    independentFromQuality: true,
    provenance: { reviewer: "Codex visual inspection", date: "2026-08-03", evidence: "fixed desktop/mobile screenshots plus matched-rule observations", confidence: "reviewer confidence that the matched patterns are unmotivated, interchangeable, or harmful in context", modality: "human", deterministicSupport: "own-crawl deterministic candidates only; not ground truth" },
    seedTaxonomies: SLOP_TAXONOMY_PROVENANCE,
    records: [...review.values()].filter((record) => record.set === "slop"),
  }, null, 2));
  await writeFile(resolve(OUT, "uncertain-labels.v1.json"), JSON.stringify({
    schemaVersion: "uncertain-labels.v1",
    excludedFromQualityAndSlop: true,
    provenance: { reviewer: "Codex visual inspection", date: "2026-08-03", evidence: "fixed desktop/mobile screenshots plus uncertainty observations", confidence: "confidence that the available capture is insufficient for a quality or slop label", modality: "human" },
    records: [...review.values()].filter((record) => record.set === "uncertain"),
  }, null, 2));
  await writeFile(resolve(OUT, "slop-candidates.v1.json"), JSON.stringify({ schemaVersion: "slop-candidates.v1", generatedAt: new Date().toISOString(), independentFromQuality: true, seedTaxonomies: SLOP_TAXONOMY_PROVENANCE, validationPolicy: "Candidate matches require human screenshot review; frequency alone never assigns slop.", records: candidates }, null, 2));
  await writeFile(resolve(OUT, "layout-clusters.v1.json"), JSON.stringify({ schemaVersion: "layout-clusters.v1", generatedAt: new Date().toISOString(), naming: "unreviewed-until-representative-inspection", clusters }, null, 2));
  await writeFile(resolve(OUT, "review-queue.v1.json"), JSON.stringify(makeReviewQueue(genomes, candidates), null, 2));
  await writeFile(resolve(OUT, "family-validation.v1.json"), JSON.stringify({ schemaVersion: "family-validation.v1", generatedAt: new Date().toISOString(), source: "geometry-crawl.v2", families: familyValidation }, null, 2));
  const familyProposalPath = resolve(OUT, "family-proposals.v1.json");
  let familyProposal: AnyRecord = { schemaVersion: "family-proposals.v1", generatedAt: new Date().toISOString(), status: "pending-cluster-representative-inspection", families: [] };
  try {
    const existingProposal = JSON.parse(await readFile(familyProposalPath, "utf8"));
    if (Array.isArray(existingProposal.families) && existingProposal.families.length) familyProposal = existingProposal;
  } catch {
    // The first derivation creates the pending proposal envelope.
  }
  await writeFile(familyProposalPath, JSON.stringify(familyProposal, null, 2));
  const coverageValues = [...rawHostCoverage.values()];
  await writeFile(resolve(OUT, "data-track-index.v1.json"), JSON.stringify({
    schemaVersion: "data-track-index.v1",
    generatedAt: new Date().toISOString(),
    sourceRaw: safePath(raw),
    files: {
      raw: { path: safePath(raw).replace(/^.*\/data\//, "data/"), shape: "versioned geometry-crawl.v2 records; canonical repaired stream, old raw remains untouched" },
      rawOriginal: { path: "data/geometry-crawl-raw.v2.ndjson", shape: "original append-only capture stream retained for provenance; may contain malformed partial lines from the first concurrent run" },
      crawlCode: { path: "packages/crawl/src/crawl-features.ts", shape: "legacy feature crawl plus --layout-v2 geometry/semantics/assets/responsive/screenshots capture" },
      recoveryCode: { path: "packages/crawl/src/recover-layout-raw.ts", shape: "streaming recovery of valid versioned records without overwriting raw" },
      genomes: { path: "data/layout-crawl/layout-genomes.v1.ndjson", shape: "one exact LayoutGenome object per successful host" },
      genomeManifest: { path: "data/layout-crawl/layout-genome-manifest.v1.ndjson", shape: "host/url/desktop+mobile screenshot provenance aligned to genome stream order" },
      clusters: { path: "data/layout-crawl/layout-clusters.v1.json", shape: "interpretable fingerprint clusters; names remain null until representative inspection" },
      clusterReview: { path: "data/layout-crawl/cluster-representative-review.v1.json", shape: "human-inspected representative names/status/evidence, separate from deterministic clustering" },
      positiveReview: { path: "data/layout-crawl/manual-review.v1.json", shape: "independent human quality/slop/uncertain labels with provenance" },
      qualityLabels: { path: "data/layout-crawl/quality-labels.v1.json", shape: "positive-quality labels with dimensions and provenance" },
      slopLabels: { path: "data/layout-crawl/slop-labels.v1.json", shape: "independent slop labels with matched rules, severity, and evidence" },
      uncertainLabels: { path: "data/layout-crawl/uncertain-labels.v1.json", shape: "explicitly excluded uncertain examples" },
      slopCandidates: { path: "data/layout-crawl/slop-candidates.v1.json", shape: "deterministic review candidates, not ground truth" },
      reviewQueue: { path: "data/layout-crawl/review-queue.v1.json", shape: "positive/slop/uncertain review queues" },
      familyValidation: { path: "data/layout-crawl/family-validation.v1.json", shape: "prevalence and review coverage for frozen 15 families" },
      familyProposals: { path: "data/layout-crawl/family-proposals.v1.json", shape: "crawl-derived new family metadata objects in the frozen family contract" },
    },
    counts: {
      successfulRecords: outputRecords.length,
      clusters: clusters.length,
      slopCandidateRecords: candidates.filter((record) => record.matches.length).length,
      uniqueRawHosts: rawHostCoverage.size,
      uniqueHostsWithDesktop: coverageValues.filter((coverage) => coverage.desktop).length,
      uniqueHostsWithMobile: coverageValues.filter((coverage) => coverage.mobile).length,
      uniqueHostsWithBothViewports: coverageValues.filter((coverage) => coverage.desktop && coverage.mobile).length,
      uniqueHostsMissingOneViewport: coverageValues.filter((coverage) => coverage.desktop !== coverage.mobile).length,
    },
    rawRecords,
    rawPhysicalLines,
    malformedRawLines,
    duplicateSuccessfulRecordsSkipped: duplicateRecords,
    fontNote: "No font crawl performed. Font-space remains sourced from existing font-neighbors.json + fonts.index.json; validation of pairings is separate.",
  }, null, 2));
  console.log(`Derived ${outputRecords.length} LayoutGenome records, ${clusters.length} clusters, ${candidates.filter((record) => record.matches.length).length} slop-candidate records.`);
}

main().catch((error) => { console.error(error); process.exit(1); });
