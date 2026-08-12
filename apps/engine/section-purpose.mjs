// apps/engine/section-purpose.mjs — section-role → CONTENT PURPOSE map + centrepiece-section
// selection. Pure, deterministic, no deps beyond plain data/logic (no engine, no randomness).
//
// WHY THIS EXISTS (dead-space fix, root cause): layout-families.mjs's sectionGrammar tells a build
// model WHICH sections to build and HOW BIG (heightShare), but never WHAT CONTENT each section
// holds or WHERE the page's one centrepiece goes. Left to infer, weak models build a hero + a small
// trace card + a CTA + a footer and leave the big mandated mid-page section (the 40-46%
// full-bleed-diagram/marquee/primary-instrument band) EMPTY — the #1 defect blocking every
// generated page (a ~900px dead-space void, sometimes solid black). This module makes it
// impossible to follow the spec and leave a section blank: every role in every shipped family gets
// a concrete content directive, and exactly one section per family is named as the centrepiece slot
// (the largest non-chrome band — the diagram/instrument/feature/marquee/table this family exists to
// showcase), so the centrepiece has a designated home instead of getting squeezed into the hero.

// Structural/chrome roles never compete for the centrepiece slot — they're navigation, headers,
// and directories, not the section the page is "about". A role not in this set is eligible.
export const CHROME_ROLES = new Set([
  "nav", "footer", "topbar", "appbar", "statusbar", "masthead", "page-header", "header",
  "filter-bar", "table-head", "pagination", "plan-toggle", "reading-header",
]);

// role → concrete content directive. Covers every role used by the 18 shipped families
// (layout-families.mjs) — see section-purpose.test.mjs for the coverage assertion. Fallback
// directive (below, exported as DEFAULT_PURPOSE) covers any future/unlisted role so this never
// throws — but every role a shipped family actually uses must have a real entry here, not the
// fallback (that's the point of the coverage test).
export const SECTION_PURPOSE = {
  // chrome / structural
  nav: "Site identity + primary nav actions only. No page content lives here — keep it short.",
  topbar: "Product identity + search/context switcher. Chrome, not content.",
  appbar: "App identity + account/workspace switcher. Chrome, not content.",
  masthead: "Publication identity + section rule. Chrome, not content.",
  header: "Product name + one-line summary. Chrome, not content.",
  "page-header": "Breadcrumb trail + the current page's title. Chrome, not content.",
  "reading-header": "Title + reading metadata (author, length, date). Chrome, not content.",
  "filter-bar": "Facets + search for the records below. Chrome, not content.",
  "table-head": "Sortable column labels for the table body below. Chrome, not content.",
  pagination: "Range indicator + page controls. Chrome, not content.",
  "plan-toggle": "Billing-period switch (monthly/annual). Chrome, not content.",
  toolbar: "Contextual command bar for the workspace below. Chrome, not content.",
  statusbar: "Current state + keyboard shortcuts. Chrome, not content.",
  footer: "Column directory: links, legal, secondary nav. Quiet and structural — do not add hero-scale content here.",

  // hero / opening
  hero: "Headline + subhead + primary CTA + a real product visual grounded in the subject — never a placeholder graphic or generic illustration.",
  intro: "One-line premise that sets up the section(s) that follow — earn what comes next, don't restate the hero.",
  "intro-band": "One-line premise on a light band, text-led — sets up the band rhythm that follows.",
  opening: "A hook statement that opens the narrative — one strong line, not a paragraph.",

  // the diagram / instrument / evidence bands (frequent centrepiece homes)
  "full-bleed-diagram": "Build the subject-grounded system/data diagram edge-to-edge, filling this section at full width. This is where the diagram lives — do not shrink it into the hero.",
  "annotation-flow": "3-5 stepped explanations that walk through the diagram above, in order — real copy per step, each tied to a specific part of the diagram.",
  "primary-instrument": "The one dominant chart/readout for this dashboard, built large with real or realistic sample data — never a generic placeholder graph.",
  "secondary-metrics": "A ranked cluster of supporting metrics with real numbers and varied visual weight — never a grid of identical equal-weight cards.",
  "activity-log": "A chronological event stream with real, timestamped entries.",
  "status-strip": "A health-summary row of real status chips (not placeholder greens) for the systems/metrics this page tracks.",
  marquee: "The signature split statement + visual — built large and specific to the subject, not a generic hero graphic.",
  statement: "One bold manifesto/thesis line, standing alone — no supporting paragraph underneath it.",
  evidence: "A single sustained argument or evidence run that backs the thesis with real facts/numbers — not a bullet list of adjectives.",
  workspace: "The actual working canvas for this tool, built full and functional-looking — populated with real-looking content, not an empty panel.",
  "inspector-panel": "Properties of the current selection, populated with real field values.",
  "spec-groups": "Grouped label/value spec tables, fully populated with real attribute values (not placeholder dashes).",
  diagram: "An annotated technical figure illustrating the spec above it — real and labeled, never decorative filler.",
  "comparison-matrix": "The full attribute-by-attribute plan comparison — real feature rows, with the recommended tier visually emphasized.",
  "table-body": "Dense, aligned data rows — real records filling the section. This IS the page; build it full, not sparse.",
  mosaic: "A varied-aspect masonry grid of real work samples — never a uniform-crop grid of placeholders.",
  "body-columns": "The full article body copy in a real multi-column measure — actual prose, never lorem ipsum or a truncated excerpt.",
  "article-body": "Sidebar nav + full documentation/reading body + inline table-of-contents, real content filling the whole measure.",
  "pane-body": "Primary reading pane + secondary context pane, side by side, BOTH fully populated with real text — neither pane may render empty.",
  features: "The feature/content band this layout exists to showcase — real, distinct blocks with concrete copy, never equal-weight filler cards.",

  // proof / social / narrative
  proof: "Real testimonial content, a logo rail, or a concrete metric — actual names/numbers, never placeholder logos or fake stats.",
  faq: "Real objection-handling Q&A — questions an actual buyer would ask, never generic filler questions.",
  pricing: "A task-aligned pricing comparison — real tiers and prices relevant to this product, not a generic 3-tier template.",
  "dark-band": "An inverted feature set on a dark ground with real feature copy — not just a color swap of the band above it.",
  "light-band": "A figure-led band: a real supporting visual paired with real copy.",
  "chapter-1": "The first narrative beat — real story content advancing the sequence, figure paired with text.",
  "chapter-2": "The second narrative beat — real story content advancing the sequence, figure paired with text, distinct from chapter 1.",
  "chapter-3": "The third narrative beat, full-bleed — real story content that closes out the sequence.",
  lede: "A drop headline + standfirst paragraph that frames the whole piece.",
  "pull-aside": "Margin notes / pull-quotes commenting on the body — real quoted lines lifted from the article, not invented filler.",
  related: "Prev/next links plus related reading — small and structural.",
  footnotes: "A reference list for the piece — real citations, not placeholders.",
  "selected-detail": "One featured piece of work with a real write-up — never a caption-only card.",
  contact: "One direct, real reach-out action (email link, contact form) — a single committed path, not a wall of channels.",
  summary: "3-5 real headline figures/specs at a glance.",

  // CTAs / closes
  cta: "One committed single action + one line of supporting copy — nothing else competes for attention here.",
  "cta-band": "One committed single action on a high-contrast band — the close of the page's argument.",
  "resolution-cta": "The earned close of the narrative: one committed action that follows naturally from the story above it.",
};

// Directive used for a role that has no entry above (should not happen for shipped families — see
// the coverage test — but keeps this module total for any future/external family).
export const DEFAULT_PURPOSE =
  "Build this section with real, concrete content proportional to its height share — never leave it decoratively empty.";

export function purposeForRole(role) {
  return SECTION_PURPOSE[role] || DEFAULT_PURPOSE;
}

/**
 * centrepieceRoleOf(sectionGrammar) → the role string of this family's centrepiece section: the
 * largest heightShare section that isn't chrome (CHROME_ROLES). Deterministic tie-break: first
 * section in grammar order among the max-heightShare ties (stable, matches sectionGrammar's
 * authored order).
 *
 * This is why FIX 1 works: in every one of the 18 shipped families, the largest non-chrome section
 * IS the diagram/instrument/marquee/table/workspace/feature band the family exists to showcase (see
 * layout-families.mjs sectionGrammar) — so this heuristic needs no per-family override table.
 */
export function centrepieceRoleOf(sectionGrammar = []) {
  let best = null;
  for (const s of sectionGrammar) {
    if (!s || CHROME_ROLES.has(s.role)) continue;
    if (!best || s.heightShare > best.heightShare) best = s;
  }
  return best ? best.role : null;
}
