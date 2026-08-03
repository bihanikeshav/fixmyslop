// apps/engine/layout-families.mjs — Subsystem 3: LayoutGenome (pure math, no AI, no Math.random,
// no Date.now — deterministic; runs in a Cloudflare Worker and the browser).
//
// This module is our v1 *definition of good layout*: a hand-authored seed library of 15
// interpretable families, each replacing a specific slop default, plus deterministic retrieval
// (`suggestLayout`) that gates by page kind + dials and ranks by fit with a diversity penalty.
// The calling agent supplies a resolved StyleIntent; this module never reads free text.

import { round } from "./system.mjs";

const clamp01 = (n, fallback = 0.5) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.min(1, Math.max(0, x));
};
const clampRange = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
// three-band pick over a [0,1] dial (low / mid / high)
const band3 = (x, low, mid, high) => (x < 0.34 ? low : x < 0.67 ? mid : high);

// ── The 15 families. Each is our positive answer to one recurring slop default. ────────────────
export const LAYOUT_FAMILIES = [
  {
    name: "asymmetric-proof-stack",
    pageKind: "product-with-proof",
    whenToUse: ["explain-and-convert", "product-with-proof", "show-a-tool-earning-trust"],
    notFor: ["dense-admin-workflow", "long-form-reading", "pure-brand-statement"],
    dialCompatibility: { layoutVariance: [0.55, 0.95], contentDensity: [0.2, 0.7] },
    requiredContent: ["headline", "proof", "primaryAction"],
    antiPatterns: ["centered-hero-plus-equal-three-card-row", "decorative-grid-without-function"],
    mobileTransform: "stack-and-preserve-focal-order",
    materialSlots: ["hero-surface", "proof-rail", "feature-lead-card", "accent-signal"],
    sectionGrammar: [
      { role: "nav", heightShare: 0.06, focalPoint: "left", composition: "logo-left-actions-right" },
      { role: "hero", heightShare: 0.26, focalPoint: "left", composition: "split-text-led" },
      { role: "proof", heightShare: 0.12, focalPoint: "center", composition: "logo-rail" },
      { role: "features", heightShare: 0.3, focalPoint: "left", composition: "asymmetric-stack" },
      { role: "cta", heightShare: 0.14, focalPoint: "center", composition: "contrast-band" },
      { role: "footer", heightShare: 0.12, focalPoint: "left", composition: "column-directory" },
    ],
    macro: { contentWidthShare: 0.78, columnCount: 2, splitRatio: 0.58, alignment: "left-led", whitespace: 0.62, contentDensity: 0.43 },
    provenance: "hand-authored",
  },
  {
    name: "hero-thesis-single",
    pageKind: "landing",
    whenToUse: ["explain-and-convert", "state-a-strong-thesis", "single-product-launch"],
    notFor: ["dense-admin-workflow", "data-heavy-comparison", "multi-topic-catalogue"],
    dialCompatibility: { layoutVariance: [0.4, 0.85], contentDensity: [0.15, 0.55] },
    requiredContent: ["thesis", "supportingEvidence", "primaryAction"],
    antiPatterns: ["headline-subhead-plus-two-buttons-default", "hero-illustration-filler"],
    mobileTransform: "stack-thesis-first-collapse-secondary",
    materialSlots: ["thesis-surface", "evidence-line", "accent-signal"],
    sectionGrammar: [
      { role: "nav", heightShare: 0.07, focalPoint: "left", composition: "minimal-wordmark" },
      { role: "hero", heightShare: 0.42, focalPoint: "left", composition: "oversized-thesis" },
      { role: "evidence", heightShare: 0.2, focalPoint: "center", composition: "single-argument-run" },
      { role: "cta", heightShare: 0.16, focalPoint: "center", composition: "committed-single-action" },
      { role: "footer", heightShare: 0.15, focalPoint: "left", composition: "quiet-directory" },
    ],
    macro: { contentWidthShare: 0.7, columnCount: 1, splitRatio: 0.5, alignment: "left-led", whitespace: 0.72, contentDensity: 0.3 },
    provenance: "hand-authored",
  },
  {
    name: "contrast-band-flow",
    pageKind: "marketing",
    whenToUse: ["explain-and-convert", "guide-a-narrative-scroll", "differentiate-sections"],
    notFor: ["dense-admin-workflow", "long-form-reading", "single-screen-tool"],
    dialCompatibility: { layoutVariance: [0.45, 0.9], contentDensity: [0.25, 0.6] },
    requiredContent: ["headline", "sectionThemes", "primaryAction"],
    antiPatterns: ["uniform-white-sections-stacked", "same-treatment-every-band"],
    mobileTransform: "keep-band-rhythm-stack-inner-columns",
    materialSlots: ["dark-band-surface", "light-band-surface", "cta-band", "accent-signal"],
    sectionGrammar: [
      { role: "nav", heightShare: 0.06, focalPoint: "left", composition: "transparent-over-first-band" },
      { role: "intro-band", heightShare: 0.2, focalPoint: "left", composition: "light-band-text-led" },
      { role: "dark-band", heightShare: 0.22, focalPoint: "center", composition: "inverted-feature-set" },
      { role: "light-band", heightShare: 0.22, focalPoint: "right", composition: "light-band-figure-led" },
      { role: "cta-band", heightShare: 0.18, focalPoint: "center", composition: "high-contrast-close" },
      { role: "footer", heightShare: 0.12, focalPoint: "left", composition: "column-directory" },
    ],
    macro: { contentWidthShare: 0.82, columnCount: 2, splitRatio: 0.5, alignment: "alternating", whitespace: 0.58, contentDensity: 0.42 },
    provenance: "hand-authored",
  },
  {
    name: "stacked-narrative-scroll",
    pageKind: "story",
    whenToUse: ["tell-a-sequential-story", "guide-a-narrative-scroll", "onboard-with-a-throughline"],
    notFor: ["dense-admin-workflow", "quick-reference-lookup", "data-comparison"],
    dialCompatibility: { layoutVariance: [0.4, 0.85], contentDensity: [0.25, 0.65] },
    requiredContent: ["openingHook", "sequentialBeats", "resolution"],
    antiPatterns: ["static-feature-list", "unordered-icon-grid"],
    mobileTransform: "preserve-beat-order-full-width-stack",
    materialSlots: ["chapter-surface", "figure-frame", "accent-signal"],
    sectionGrammar: [
      { role: "nav", heightShare: 0.06, focalPoint: "left", composition: "minimal-wordmark" },
      { role: "opening", heightShare: 0.18, focalPoint: "center", composition: "hook-statement" },
      { role: "chapter-1", heightShare: 0.2, focalPoint: "left", composition: "figure-left-text-right" },
      { role: "chapter-2", heightShare: 0.2, focalPoint: "right", composition: "text-left-figure-right" },
      { role: "chapter-3", heightShare: 0.18, focalPoint: "center", composition: "full-bleed-beat" },
      { role: "resolution-cta", heightShare: 0.1, focalPoint: "center", composition: "earned-close" },
      { role: "footer", heightShare: 0.08, focalPoint: "left", composition: "quiet-directory" },
    ],
    macro: { contentWidthShare: 0.74, columnCount: 2, splitRatio: 0.5, alignment: "alternating", whitespace: 0.66, contentDensity: 0.38 },
    provenance: "hand-authored",
  },
  {
    name: "split-marquee",
    pageKind: "brand",
    whenToUse: ["make-a-brand-statement", "single-product-launch", "identity-forward-landing"],
    notFor: ["dense-admin-workflow", "data-comparison", "long-form-reading"],
    dialCompatibility: { layoutVariance: [0.5, 0.95], contentDensity: [0.1, 0.5] },
    requiredContent: ["brandStatement", "signatureVisual", "primaryAction"],
    antiPatterns: ["centered-logo-plus-tagline", "symmetric-hero-with-stock-illustration"],
    mobileTransform: "visual-over-statement-stack",
    materialSlots: ["marquee-visual", "statement-surface", "accent-signal"],
    sectionGrammar: [
      { role: "nav", heightShare: 0.06, focalPoint: "left", composition: "wordmark-over-marquee" },
      { role: "marquee", heightShare: 0.46, focalPoint: "right", composition: "split-statement-plus-visual" },
      { role: "statement", heightShare: 0.18, focalPoint: "left", composition: "single-manifesto-line" },
      { role: "proof", heightShare: 0.14, focalPoint: "center", composition: "logo-rail" },
      { role: "footer", heightShare: 0.16, focalPoint: "left", composition: "column-directory" },
    ],
    macro: { contentWidthShare: 0.86, columnCount: 2, splitRatio: 0.55, alignment: "split", whitespace: 0.74, contentDensity: 0.26 },
    provenance: "hand-authored",
  },
  {
    name: "editorial-broadsheet",
    pageKind: "editorial",
    whenToUse: ["long-form-reading", "feature-article", "publish-an-opinion-piece"],
    notFor: ["dense-admin-workflow", "single-screen-tool", "data-comparison"],
    dialCompatibility: { layoutVariance: [0.3, 0.75], contentDensity: [0.3, 0.7] },
    requiredContent: ["headline", "byline", "articleBody"],
    antiPatterns: ["single-centered-column-no-hierarchy", "uniform-blog-card-grid"],
    mobileTransform: "collapse-to-single-measure-keep-pull-quotes-inline",
    materialSlots: ["masthead-rule", "lede-surface", "pull-aside"],
    sectionGrammar: [
      { role: "masthead", heightShare: 0.08, focalPoint: "left", composition: "titled-rule" },
      { role: "lede", heightShare: 0.22, focalPoint: "left", composition: "drop-headline-plus-standfirst" },
      { role: "body-columns", heightShare: 0.4, focalPoint: "left", composition: "multi-column-measure" },
      { role: "pull-aside", heightShare: 0.16, focalPoint: "right", composition: "margin-notes-and-quotes" },
      { role: "footer", heightShare: 0.14, focalPoint: "left", composition: "column-directory" },
    ],
    macro: { contentWidthShare: 0.8, columnCount: 3, splitRatio: 0.62, alignment: "left-led", whitespace: 0.5, contentDensity: 0.55 },
    provenance: "hand-authored",
  },
  {
    name: "sidebar-doc",
    pageKind: "docs",
    whenToUse: ["long-form", "api-reference", "structured-documentation"],
    notFor: ["pure-brand-statement", "single-product-launch", "data-comparison"],
    dialCompatibility: { layoutVariance: [0.1, 0.5], contentDensity: [0.2, 0.6] },
    requiredContent: ["navigationTree", "pageHeading", "documentationBody"],
    antiPatterns: ["full-width-prose-no-nav", "prose-wall-without-anchors"],
    mobileTransform: "collapse-sidebar-to-drawer-toc-inline-top",
    materialSlots: ["sidebar-rail", "code-block-surface", "callout-accent"],
    sectionGrammar: [
      { role: "topbar", heightShare: 0.06, focalPoint: "left", composition: "product-plus-search" },
      { role: "page-header", heightShare: 0.12, focalPoint: "left", composition: "breadcrumb-plus-title" },
      { role: "article-body", heightShare: 0.62, focalPoint: "left", composition: "sidebar-nav-plus-measure-plus-toc" },
      { role: "related", heightShare: 0.1, focalPoint: "left", composition: "prev-next-and-links" },
      { role: "footer", heightShare: 0.1, focalPoint: "left", composition: "quiet-directory" },
    ],
    macro: { contentWidthShare: 0.9, columnCount: 3, splitRatio: 0.24, alignment: "left-led", whitespace: 0.44, contentDensity: 0.5 },
    provenance: "hand-authored",
  },
  {
    name: "two-pane-reader",
    pageKind: "reading",
    whenToUse: ["mobile-first-reading", "focused-reading", "annotate-alongside-source"],
    notFor: ["dense-admin-workflow", "data-comparison", "pure-brand-statement"],
    dialCompatibility: { layoutVariance: [0.1, 0.55], contentDensity: [0.25, 0.65] },
    requiredContent: ["readingHeader", "primaryText", "secondaryContext"],
    antiPatterns: ["desktop-layout-shrunk-to-fit", "tap-target-crowding"],
    mobileTransform: "single-pane-source-first-context-as-sheet",
    materialSlots: ["reading-pane", "context-pane", "highlight-accent"],
    sectionGrammar: [
      { role: "topbar", heightShare: 0.06, focalPoint: "left", composition: "back-and-progress" },
      { role: "reading-header", heightShare: 0.14, focalPoint: "left", composition: "title-and-meta" },
      { role: "pane-body", heightShare: 0.64, focalPoint: "left", composition: "primary-pane-plus-context-pane" },
      { role: "footnotes", heightShare: 0.08, focalPoint: "left", composition: "reference-list" },
      { role: "footer", heightShare: 0.08, focalPoint: "left", composition: "quiet-directory" },
    ],
    macro: { contentWidthShare: 0.88, columnCount: 2, splitRatio: 0.62, alignment: "left-led", whitespace: 0.52, contentDensity: 0.46 },
    provenance: "hand-authored",
  },
  {
    name: "instrument-console",
    pageKind: "dashboard",
    whenToUse: ["monitor", "operate-a-live-system", "at-a-glance-status"],
    notFor: ["long-form-reading", "pure-brand-statement", "single-product-launch"],
    dialCompatibility: { layoutVariance: [0.1, 0.5], contentDensity: [0.55, 0.95] },
    requiredContent: ["primaryMetric", "supportingMetrics", "systemStatus"],
    antiPatterns: ["equal-card-grid-of-kpis", "every-metric-same-visual-weight"],
    mobileTransform: "prioritized-single-column-primary-instrument-first",
    materialSlots: ["primary-instrument", "status-chip", "alert-accent"],
    sectionGrammar: [
      { role: "topbar", heightShare: 0.08, focalPoint: "left", composition: "context-switch-and-time-range" },
      { role: "status-strip", heightShare: 0.14, focalPoint: "left", composition: "health-summary-row" },
      { role: "primary-instrument", heightShare: 0.34, focalPoint: "left", composition: "dominant-chart-plus-readout" },
      { role: "secondary-metrics", heightShare: 0.26, focalPoint: "left", composition: "ranked-metric-cluster" },
      { role: "activity-log", heightShare: 0.18, focalPoint: "left", composition: "chronological-stream" },
    ],
    macro: { contentWidthShare: 0.96, columnCount: 12, splitRatio: 0.66, alignment: "grid-led", whitespace: 0.3, contentDensity: 0.78 },
    provenance: "hand-authored",
  },
  {
    name: "ledger-table",
    pageKind: "data-admin",
    whenToUse: ["scan-and-act-on-records", "data-comparison", "bulk-operations"],
    notFor: ["pure-brand-statement", "long-form-reading", "single-product-launch"],
    dialCompatibility: { layoutVariance: [0.05, 0.45], contentDensity: [0.6, 1.0] },
    requiredContent: ["recordColumns", "filterControls", "rowActions"],
    antiPatterns: ["styled-cards-hiding-a-table", "one-record-per-oversized-card"],
    mobileTransform: "prioritized-columns-plus-row-detail-sheet",
    materialSlots: ["table-surface", "row-hover-state", "status-accent"],
    sectionGrammar: [
      { role: "topbar", heightShare: 0.08, focalPoint: "left", composition: "title-and-primary-action" },
      { role: "filter-bar", heightShare: 0.1, focalPoint: "left", composition: "facets-and-search" },
      { role: "table-head", heightShare: 0.06, focalPoint: "left", composition: "sortable-column-labels" },
      { role: "table-body", heightShare: 0.62, focalPoint: "left", composition: "dense-aligned-rows" },
      { role: "pagination", heightShare: 0.06, focalPoint: "right", composition: "range-and-page-controls" },
      { role: "footer", heightShare: 0.08, focalPoint: "left", composition: "quiet-directory" },
    ],
    macro: { contentWidthShare: 0.98, columnCount: 12, splitRatio: 0.5, alignment: "grid-led", whitespace: 0.22, contentDensity: 0.86 },
    provenance: "hand-authored",
  },
  {
    name: "app-shell-workbench",
    pageKind: "app",
    whenToUse: ["operate-a-tool", "create-and-edit", "focused-productive-work"],
    notFor: ["pure-brand-statement", "long-form-reading", "explain-and-convert"],
    dialCompatibility: { layoutVariance: [0.1, 0.55], contentDensity: [0.45, 0.9] },
    requiredContent: ["primaryWorkspace", "commandSurface", "objectInspector"],
    antiPatterns: ["marketing-chrome-on-a-tool", "hero-band-above-the-workspace"],
    mobileTransform: "workspace-full-bleed-panels-become-sheets",
    materialSlots: ["workspace-surface", "panel-surface", "selection-accent"],
    sectionGrammar: [
      { role: "appbar", heightShare: 0.08, focalPoint: "left", composition: "app-identity-and-account" },
      { role: "toolbar", heightShare: 0.08, focalPoint: "left", composition: "contextual-commands" },
      { role: "workspace", heightShare: 0.6, focalPoint: "center", composition: "canvas-plus-inspector-split" },
      { role: "inspector-panel", heightShare: 0.16, focalPoint: "right", composition: "properties-of-selection" },
      { role: "statusbar", heightShare: 0.08, focalPoint: "left", composition: "state-and-shortcuts" },
    ],
    macro: { contentWidthShare: 1.0, columnCount: 12, splitRatio: 0.72, alignment: "grid-led", whitespace: 0.28, contentDensity: 0.7 },
    provenance: "hand-authored",
  },
  {
    name: "spec-sheet",
    pageKind: "technical",
    whenToUse: ["present-technical-specs", "product-with-proof", "compare-by-attribute"],
    notFor: ["pure-brand-statement", "guide-a-narrative-scroll", "single-screen-tool"],
    dialCompatibility: { layoutVariance: [0.15, 0.6], contentDensity: [0.45, 0.9] },
    requiredContent: ["specGroups", "attributeValues", "summaryClaim"],
    antiPatterns: ["prose-describing-specs", "buried-numbers-in-paragraphs"],
    mobileTransform: "spec-groups-stack-keep-label-value-pairing",
    materialSlots: ["spec-group-surface", "diagram-frame", "highlight-accent"],
    sectionGrammar: [
      { role: "header", heightShare: 0.08, focalPoint: "left", composition: "product-and-summary" },
      { role: "summary", heightShare: 0.14, focalPoint: "left", composition: "headline-figures" },
      { role: "spec-groups", heightShare: 0.5, focalPoint: "left", composition: "grouped-label-value-tables" },
      { role: "diagram", heightShare: 0.18, focalPoint: "center", composition: "annotated-technical-figure" },
      { role: "footer", heightShare: 0.1, focalPoint: "left", composition: "quiet-directory" },
    ],
    macro: { contentWidthShare: 0.86, columnCount: 4, splitRatio: 0.5, alignment: "left-led", whitespace: 0.36, contentDensity: 0.72 },
    provenance: "hand-authored",
  },
  {
    name: "full-bleed-diagram",
    pageKind: "explain",
    whenToUse: ["explain-a-system", "explain-and-convert", "show-how-it-works"],
    notFor: ["dense-admin-workflow", "long-form-reading", "data-comparison"],
    dialCompatibility: { layoutVariance: [0.35, 0.8], contentDensity: [0.2, 0.6] },
    requiredContent: ["systemDiagram", "annotationFlow", "primaryAction"],
    antiPatterns: ["screenshot-in-a-rounded-card", "diagram-shrunk-into-a-column"],
    mobileTransform: "diagram-becomes-vertical-scroll-with-stepped-annotations",
    materialSlots: ["diagram-canvas", "annotation-callout", "accent-signal"],
    sectionGrammar: [
      { role: "nav", heightShare: 0.06, focalPoint: "left", composition: "minimal-wordmark" },
      { role: "intro", heightShare: 0.14, focalPoint: "center", composition: "one-line-premise" },
      { role: "full-bleed-diagram", heightShare: 0.46, focalPoint: "center", composition: "edge-to-edge-system-map" },
      { role: "annotation-flow", heightShare: 0.22, focalPoint: "left", composition: "stepped-explanations" },
      { role: "cta", heightShare: 0.12, focalPoint: "center", composition: "committed-single-action" },
    ],
    macro: { contentWidthShare: 1.0, columnCount: 1, splitRatio: 0.5, alignment: "center-anchored", whitespace: 0.6, contentDensity: 0.34 },
    provenance: "hand-authored",
  },
  {
    name: "gallery-mosaic",
    pageKind: "portfolio",
    whenToUse: ["show-visual-work", "portfolio-index", "let-imagery-lead"],
    notFor: ["dense-admin-workflow", "long-form-reading", "data-comparison"],
    dialCompatibility: { layoutVariance: [0.4, 0.9], contentDensity: [0.2, 0.65] },
    requiredContent: ["workThumbnails", "selectedPieceDetail", "contact"],
    antiPatterns: ["equal-image-grid-uniform-crop", "same-aspect-ratio-every-tile"],
    mobileTransform: "single-column-priority-order-preserve-featured",
    materialSlots: ["mosaic-tile", "selected-detail-surface", "caption-accent"],
    sectionGrammar: [
      { role: "header", heightShare: 0.1, focalPoint: "left", composition: "name-and-discipline" },
      { role: "mosaic", heightShare: 0.58, focalPoint: "center", composition: "varied-aspect-masonry" },
      { role: "selected-detail", heightShare: 0.18, focalPoint: "left", composition: "featured-piece-writeup" },
      { role: "contact", heightShare: 0.14, focalPoint: "center", composition: "direct-reach-out" },
    ],
    macro: { contentWidthShare: 0.94, columnCount: 6, splitRatio: 0.5, alignment: "grid-led", whitespace: 0.48, contentDensity: 0.44 },
    provenance: "hand-authored",
  },
  {
    name: "pricing-comparison",
    pageKind: "pricing",
    whenToUse: ["compare-plans", "guide-to-the-right-tier", "convert-on-price"],
    notFor: ["long-form-reading", "pure-brand-statement", "single-screen-tool"],
    dialCompatibility: { layoutVariance: [0.15, 0.6], contentDensity: [0.35, 0.75] },
    requiredContent: ["planTiers", "featureMatrix", "recommendedPlan"],
    antiPatterns: ["equal-three-tier-cards-no-emphasis", "feature-checklist-without-comparison"],
    mobileTransform: "recommended-tier-first-matrix-becomes-per-plan-accordions",
    materialSlots: ["recommended-tier-surface", "comparison-matrix", "value-accent"],
    sectionGrammar: [
      { role: "header", heightShare: 0.1, focalPoint: "center", composition: "value-framing" },
      { role: "plan-toggle", heightShare: 0.08, focalPoint: "center", composition: "billing-period-switch" },
      { role: "comparison-matrix", heightShare: 0.5, focalPoint: "center", composition: "emphasized-tier-plus-attribute-rows" },
      { role: "faq", heightShare: 0.2, focalPoint: "left", composition: "objection-handling" },
      { role: "cta", heightShare: 0.12, focalPoint: "center", composition: "committed-single-action" },
    ],
    macro: { contentWidthShare: 0.84, columnCount: 3, splitRatio: 0.5, alignment: "center-anchored", whitespace: 0.46, contentDensity: 0.56 },
    provenance: "hand-authored",
  },
];

// The required keys every family must carry — for validators/tests.
export const LAYOUT_FAMILY_SCHEMA_KEYS = [
  "name", "pageKind", "whenToUse", "notFor", "dialCompatibility", "requiredContent",
  "antiPatterns", "mobileTransform", "materialSlots", "sectionGrammar", "macro", "provenance",
];

// ── Surface → compatible page kinds. This is the hard gate that keeps a centered-hero landing
// family off a dashboard, and a table off a brand page. Missing/unknown surface = no page-kind
// restriction (dials still gate). Tool surfaces (dashboard/app) deliberately exclude all
// marketing/landing/brand page kinds. ─────────────────────────────────────────────────────────
export const SURFACE_PAGEKINDS = {
  "landing-page": ["landing", "brand", "product-with-proof", "story", "marketing", "explain"],
  marketing: ["marketing", "story", "landing", "brand", "product-with-proof", "explain"],
  pricing: ["pricing", "product-with-proof"],
  portfolio: ["portfolio", "brand", "editorial"],
  editorial: ["editorial", "reading", "story"],
  docs: ["docs", "reading", "technical", "editorial"],
  dashboard: ["dashboard", "data-admin", "app"],
  app: ["app", "dashboard", "data-admin"],
};

// contentModel → a page kind it implies (used to boost fit, never to widen the surface gate).
const CONTENT_MODEL_PAGEKIND = {
  "product-with-proof": "product-with-proof",
  technical: "technical",
  "spec-sheet": "technical",
  explain: "explain",
  story: "story",
  reference: "docs",
  "data-records": "data-admin",
};

const DIVERSITY_PENALTY = 0.5;
const GATE_DIALS = ["layoutVariance", "contentDensity"];

const sectionOrder = (family) => family.sectionGrammar.map((s) => s.role).join(">");

// pull a dial off an intent, clamped, neutral fallback
const dialOf = (intent, name) => clamp01(intent && intent[name], 0.5);

function pageKindAllowed(family, intent) {
  const surface = intent && intent.surface;
  const allowed = surface != null ? SURFACE_PAGEKINDS[String(surface)] : null;
  if (!allowed) return true; // unknown/missing surface — page kind unrestricted
  return allowed.includes(family.pageKind);
}

function passesDialGate(family, intent) {
  for (const dial of GATE_DIALS) {
    const range = family.dialCompatibility[dial];
    if (!range) continue;
    const v = dialOf(intent, dial);
    if (v < range[0] || v > range[1]) return false;
  }
  return true;
}

// A fingerprint may be a bare string (family name or section-order hash) or an object carrying
// `.layoutFamily`/`.family`/`.name` and/or `.sectionOrderHash`.
function penaltyFor(family, recentFingerprints) {
  if (!Array.isArray(recentFingerprints) || !recentFingerprints.length) return 0;
  const order = sectionOrder(family);
  for (const fp of recentFingerprints) {
    if (typeof fp === "string") {
      if (fp === family.name || fp === order) return DIVERSITY_PENALTY;
    } else if (fp && typeof fp === "object") {
      const named = fp.layoutFamily || fp.family || fp.name;
      if (named === family.name) return DIVERSITY_PENALTY;
      if (fp.sectionOrderHash && fp.sectionOrderHash === order) return DIVERSITY_PENALTY;
    }
  }
  return 0;
}

// Fit = dial closeness to the family's compatibility midpoints, + a small boost when the family's
// whenToUse names the intent's job/contentModel or the contentModel implies its page kind,
// − the diversity penalty. Deterministic.
function fitFor(family, intent, recentFingerprints) {
  let dist = 0, n = 0;
  for (const dial of Object.keys(family.dialCompatibility)) {
    const [min, max] = family.dialCompatibility[dial];
    const mid = (min + max) / 2;
    dist += Math.abs(dialOf(intent, dial) - mid);
    n++;
  }
  const closeness = 1 - dist / (n || 1);
  let boost = 0;
  if (intent && intent.job && family.whenToUse.includes(String(intent.job))) boost += 0.1;
  if (intent && intent.contentModel && family.whenToUse.includes(String(intent.contentModel))) boost += 0.1;
  if (intent && intent.contentModel && CONTENT_MODEL_PAGEKIND[String(intent.contentModel)] === family.pageKind) boost += 0.08;
  const penalty = penaltyFor(family, recentFingerprints);
  return round(closeness + boost - penalty, 4);
}

// ── Derive the hierarchy/material numbers from family + intent (deterministic). ────────────────
const TOOL_KINDS = new Set(["dashboard", "data-admin", "app"]);

function deriveHierarchy(family, iv) {
  const maxShare = family.sectionGrammar.reduce((m, s) => Math.max(m, s.heightShare), 0);
  return {
    focalAreaShare: round(clampRange(maxShare * (0.4 + 0.3 * iv.layoutVariance), 0.1, 0.5), 2),
    headingScaleRatio: round(1.5 + 2.2 * iv.layoutVariance * (1 - 0.4 * iv.contentDensity), 2),
    ctaProminence: round(clamp01(0.25 + 0.55 * iv.energy + 0.15 * (1 - iv.contentDensity)), 2),
    contrastConcentration: round(clamp01(0.25 + 0.6 * iv.contrastPreference), 2),
    repetitionEntropy: round(clamp01(0.2 + 0.6 * iv.layoutVariance), 2),
  };
}

function deriveMaterial(family, iv) {
  const m = iv.materiality;
  const accentStrategy = TOOL_KINDS.has(family.pageKind)
    ? "state-color-coded"
    : iv.energy > 0.6
      ? "one-primary-plus-secondary"
      : "one-primary-plus-signal";
  return {
    radiusLanguage: band3(m, "sharp-minimal", "controlled-mixed", "soft-rounded"),
    shadowLanguage: band3(m, "flat-borders-not-shadows", "soft-low-elevation", "layered-elevation"),
    borderLanguage: iv.contentDensity > 0.6 ? "structural-dividers" : band3(m, "hairline-selective", "selective", "selective-plus-fill"),
    accentStrategy,
    surfaceTexture: band3(m, "none", "none-or-subtle", "subtle-gradient"),
  };
}

// Compose a full LayoutGenome candidate from a family + intent.
function composeGenome(family, intent, iv, recentFingerprints) {
  const macro = {
    ...family.macro,
    // contentDensity → whitespace; blend the family's authored value with the intent so the
    // family keeps its character but the intent moves it.
    contentDensity: round(iv.contentDensity, 2),
    whitespace: round(clamp01(0.4 * family.macro.whitespace + 0.6 * (1 - iv.contentDensity)), 2),
  };
  return {
    family: family.name,
    fit: fitFor(family, intent, recentFingerprints),
    pageKind: family.pageKind,
    sectionGrammar: family.sectionGrammar.map((s) => ({ ...s })),
    macro,
    hierarchy: deriveHierarchy(family, iv),
    material: deriveMaterial(family, iv),
    responsive: { mobileTransform: family.mobileTransform },
    quality: { score: null, confidence: null, provenance: ["hand-authored"] },
    slop: { score: null, matchedRules: [] },
  };
}

/**
 * suggestLayout(intent, { recentFingerprints }) → ranked LayoutGenome candidates (best first).
 * Pure, deterministic. Hard-gates by surface→pageKind and dial compatibility, then ranks by fit
 * minus a diversity penalty against recent fingerprints.
 */
export function suggestLayout(intent = {}, { recentFingerprints = [] } = {}) {
  const iv = {
    layoutVariance: dialOf(intent, "layoutVariance"),
    contentDensity: dialOf(intent, "contentDensity"),
    materiality: dialOf(intent, "materiality"),
    energy: dialOf(intent, "energy"),
    contrastPreference: dialOf(intent, "contrastPreference"),
    craft: dialOf(intent, "craft"),
  };
  const survivors = LAYOUT_FAMILIES.filter(
    (f) => pageKindAllowed(f, intent) && passesDialGate(f, intent),
  );
  const candidates = survivors.map((f) => composeGenome(f, intent, iv, recentFingerprints));
  // Sort by fit desc; break ties by name for a stable, deterministic order.
  candidates.sort((a, b) => (b.fit - a.fit) || (a.family < b.family ? -1 : a.family > b.family ? 1 : 0));
  return candidates;
}
