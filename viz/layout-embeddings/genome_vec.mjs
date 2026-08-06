// Rough numeric flattening of the LayoutGenome for a genome-distance stand-in.
// NOT the production genome-distance metric (that's Luna's data/crawl track) —
// this is only for sketching visual+genome late fusion in this prototype.
export function loadGenomes() {
  return { manifestPath: "data/layout-crawl/layout-genome-manifest.v3.ndjson", genomesPath: "data/layout-crawl/layout-genomes.v3.ndjson" };
}

const NUM_FIELDS = [
  (g) => g.macro?.contentWidthShare ?? 0,
  (g) => g.macro?.columnCount ?? 0,
  (g) => g.macro?.splitRatio ?? 0,
  (g) => g.macro?.whitespace ?? 0,
  (g) => g.macro?.contentDensity ?? 0,
  (g) => g.macro?.grid?.gridColumns ?? 0,
  (g) => g.macro?.grid?.gutterShare ?? 0,
  (g) => g.macro?.grid?.outerMarginShare ?? 0,
  (g) => g.hierarchy?.focalAreaShare ?? 0,
  (g) => g.hierarchy?.headingScaleRatio ?? 0,
  (g) => g.hierarchy?.ctaProminence ?? 0,
  (g) => g.hierarchy?.contrastConcentration ?? 0,
  (g) => g.hierarchy?.repetitionEntropy ?? 0,
  (g) => g.layeringDepth ?? 0,
  (g) => g.bandRhythm?.darkBandCount ?? 0,
  (g) => g.bandRhythm?.stripeAlternation ?? 0,
  (g) => g.bandRhythm?.bgHueCount ?? 0,
  (g) => g.headingOutline?.h1Count ?? 0,
  (g) => g.headingOutline?.levelSkips ?? 0,
  (g) => g.headingOutline?.outlineDepth ?? 0,
  (g) => (g.sectionGrammar?.length ?? 0),
];

const CATS = {
  pageKind: ["marketing", "docs", "app", "blog", "gallery", "portfolio"],
  "macro.alignment": ["left-led", "center-led", "right-led", "asymmetric"],
  "material.radiusLanguage": ["sharp-minimal", "soft-rounded", "pill", "mixed"],
  "material.shadowLanguage": ["flat-borders-not-shadows", "soft-elevation", "hard-drop", "none"],
};
function get(g, path) {
  return path.split(".").reduce((o, k) => o?.[k], g);
}

export function genomeVec(g) {
  const v = NUM_FIELDS.map((f) => f(g));
  for (const [path, vals] of Object.entries(CATS)) {
    const cur = get(g, path);
    for (const val of vals) v.push(cur === val ? 1 : 0);
  }
  const n = Math.hypot(...v) || 1;
  return v.map((x) => x / n);
}

export function cos(a, b) {
  let d = 0;
  for (let i = 0; i < a.length; i++) d += a[i] * b[i];
  return d;
}
