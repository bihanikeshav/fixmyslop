// Production LayoutGenome vectorization for the hybrid layout-retrieval index.
//
// Replaces the stand-in `genome_vec.mjs` (which just min-flattened raw fields
// with no normalization, no bigrams, and no group balancing). This module:
//   1. z-score normalizes numeric macro/hierarchy/layering/bandRhythm/headingOutline
//      fields, fit over the clean (non-quarantined) corpus.
//   2. one-hot encodes categorical `macro.alignment`.
//   3. encodes `sectionGrammar` as a normalized role-count histogram (unigram)
//      PLUS a normalized role-bigram histogram (captures section ORDER, e.g.
//      hero->features->cta vs hero->pricing->cta read as different signatures).
//   4. concatenates all four groups, each independently scaled to unit L2 norm
//      before a final weight is applied, so no single group (esp. the 100-dim
//      bigram histogram) can dominate cosine distance just by having more dims.
//
// ROLE MAPPING FIX (2026-08, gallery-corpus-v1 recalibration): sectionGrammar roles are mapped to
// the 10-role crawl vocabulary via apps/engine/role-aliases.mjs's `canonicalRole()` — the SAME
// mapping perturb.mjs/layout-families.mjs use for the §3 fingerprint distance — not a private
// literal-match check. Using a literal check here silently collapsed every hand-authored
// LAYOUT_FAMILIES section (bespoke names like "intro"/"full-bleed-diagram"/"annotation-flow" —
// role-aliases.mjs exists specifically to canonicalize these) into "unknown", so every retrieval
// QUERY vector (built from a family's composed genome) ended up with a role histogram dominated
// by a single "unknown" bucket. That made any REAL corpus entry whose own parse also skews
// heavily "unknown" (a common crawl artifact — SPA shells, heading-only pages, JS-driven feature
// lists the section detector couldn't classify) cosine-match almost every query, regardless of
// intent — the actual mechanism behind the "central hosts recur across every direction" fidelity
// gap the index-swap task flagged. Importing the real alias table fixes this at the source.
//
// Usage:
//   import { fitGenomeCorpus, genomeVector, cosine } from "./genome-vector.mjs";
//   const stats = fitGenomeCorpus(genomes);           // compute mean/std once
//   const vec = genomeVector(genome, stats);          // per-genome vector
//   const sim = cosine(vecA, vecB);
import { canonicalRole } from "../../apps/engine/role-aliases.mjs";

// ---------------------------------------------------------------------------
// 1. Numeric scalar fields (z-score normalized across the corpus)
// ---------------------------------------------------------------------------
export const NUMERIC_FIELDS = [
  ["macro.whitespace", (g) => g.macro?.whitespace],
  ["macro.contentDensity", (g) => g.macro?.contentDensity],
  ["macro.splitRatio", (g) => g.macro?.splitRatio],
  ["macro.columnCount", (g) => g.macro?.columnCount],
  ["macro.contentWidthShare", (g) => g.macro?.contentWidthShare],
  ["macro.grid.gridColumns", (g) => g.macro?.grid?.gridColumns],
  ["macro.grid.gutterShare", (g) => g.macro?.grid?.gutterShare],
  ["macro.grid.outerMarginShare", (g) => g.macro?.grid?.outerMarginShare],
  ["hierarchy.focalAreaShare", (g) => g.hierarchy?.focalAreaShare],
  ["hierarchy.contrastConcentration", (g) => g.hierarchy?.contrastConcentration],
  ["hierarchy.headingScaleRatio", (g) => g.hierarchy?.headingScaleRatio],
  ["hierarchy.ctaProminence", (g) => g.hierarchy?.ctaProminence],
  ["hierarchy.repetitionEntropy", (g) => g.hierarchy?.repetitionEntropy],
  ["layeringDepth", (g) => g.layeringDepth],
  ["bandRhythm.darkBandCount", (g) => g.bandRhythm?.darkBandCount],
  ["bandRhythm.stripeAlternation", (g) => g.bandRhythm?.stripeAlternation],
  ["bandRhythm.bgHueCount", (g) => g.bandRhythm?.bgHueCount],
  ["headingOutline.h1Count", (g) => g.headingOutline?.h1Count],
  ["headingOutline.outlineDepth", (g) => g.headingOutline?.outlineDepth],
  ["headingOutline.levelSkips", (g) => g.headingOutline?.levelSkips],
];

// ---------------------------------------------------------------------------
// 2. Categorical fields (one-hot)
// ---------------------------------------------------------------------------
const ALIGNMENT_VALUES = ["left-led", "center-led", "right-led", "asymmetric"];

// ---------------------------------------------------------------------------
// 3. sectionGrammar -> role histogram + role bigram histogram
// ---------------------------------------------------------------------------
export const ROLE_VOCAB = ["nav", "hero", "features", "proof", "pricing", "faq", "cta", "testimonial", "footer", "unknown"];

function normalizeRole(role) {
  // canonicalRole() maps the ~30 bespoke hand-authored family role names (and any other
  // crawl-parser role string) onto the 10-role ROLE_VOCAB — see the header comment above for why
  // this must be the real alias table, not a literal ROLE_VOCAB membership check.
  const canonical = canonicalRole(role);
  return ROLE_VOCAB.includes(canonical) ? canonical : "unknown";
}

function roleHistogram(sectionGrammar) {
  const counts = Object.fromEntries(ROLE_VOCAB.map((r) => [r, 0]));
  for (const s of sectionGrammar ?? []) counts[normalizeRole(s.role)] += 1;
  const total = sectionGrammar?.length || 1;
  return ROLE_VOCAB.map((r) => counts[r] / total);
}

function roleBigramHistogram(sectionGrammar) {
  const pairs = {};
  const roles = (sectionGrammar ?? []).map((s) => normalizeRole(s.role));
  for (let i = 0; i < roles.length - 1; i++) {
    const key = `${roles[i]}>${roles[i + 1]}`;
    pairs[key] = (pairs[key] ?? 0) + 1;
  }
  const total = Math.max(roles.length - 1, 1);
  const vec = [];
  for (const a of ROLE_VOCAB) for (const b of ROLE_VOCAB) vec.push((pairs[`${a}>${b}`] ?? 0) / total);
  return vec; // 100-dim (10x10)
}

// ---------------------------------------------------------------------------
// Group weights — each group is first scaled to unit L2 norm (so a 100-dim
// bigram histogram doesn't automatically outweigh a 20-dim numeric block just
// by dimensionality), THEN multiplied by these weights before concatenation.
// Tune here. Numeric+categorical carry the most discriminative macro/hierarchy
// signal; role histogram matters (what sections exist); bigram is a weaker,
// secondary signal (order) since section-detection roleConfidence is noisy.
// ---------------------------------------------------------------------------
export const GROUP_WEIGHTS = {
  numeric: 1.0,
  alignment: 0.5,
  roleHistogram: 0.9,
  roleBigram: 0.6,
};

function mean(xs) {
  return xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
}
function std(xs, m) {
  const v = mean(xs.map((x) => (x - m) ** 2));
  return Math.sqrt(v);
}

// Fit z-score mean/std per numeric field over a corpus of genomes (array of
// parsed LayoutGenome objects). Call once; pass result into genomeVector().
export function fitGenomeCorpus(genomes) {
  const stats = NUMERIC_FIELDS.map(([name, get]) => {
    const xs = genomes.map((g) => Number(get(g) ?? 0)).filter((x) => Number.isFinite(x));
    const m = mean(xs);
    const s = std(xs, m);
    return { name, m, s: s < 1e-9 ? 1 : s, constant: s < 1e-9 }; // guard divide-by-zero (constant field)
  });
  return { numericStats: stats };
}

function unitNorm(v) {
  const n = Math.hypot(...v) || 1;
  return v.map((x) => x / n);
}

// Build the final feature vector for one genome given fitted corpus stats.
export function genomeVector(g, stats) {
  // --- group 1: numeric, z-scored ---
  const numeric = NUMERIC_FIELDS.map(([, get], i) => {
    const { m, s } = stats.numericStats[i];
    const raw = Number(get(g) ?? 0);
    return (raw - m) / s;
  });

  // --- group 2: categorical alignment, one-hot ---
  const alignment = ALIGNMENT_VALUES.map((v) => (g.macro?.alignment === v ? 1 : 0));

  // --- group 3 & 4: sectionGrammar histograms ---
  const roleHist = roleHistogram(g.sectionGrammar);
  const bigramHist = roleBigramHistogram(g.sectionGrammar);

  const groups = [
    unitNorm(numeric).map((x) => x * GROUP_WEIGHTS.numeric),
    unitNorm(alignment).map((x) => x * GROUP_WEIGHTS.alignment),
    unitNorm(roleHist).map((x) => x * GROUP_WEIGHTS.roleHistogram),
    unitNorm(bigramHist).map((x) => x * GROUP_WEIGHTS.roleBigram),
  ];

  return groups.flat();
}

export function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom < 1e-12 ? 0 : dot / denom;
}
