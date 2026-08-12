// apps/engine/role-aliases.mjs — spec §1.5 ROLE_ALIASES, split into its own module (no deps) so
// both layout-families.mjs (which re-exports ROLE_ALIASES/canonicalRole for callers, per spec §4
// "export ROLE_ALIASES from layout-families.mjs") and perturb.mjs (which needs canonicalRole for
// the §2 rule 6/7/8 "never nav/hero/cta/footer" guards) can import it without a circular
// dependency (layout-families.mjs imports perturb.mjs to wire perturbGenome into composeGenome).
//
// Crawl/vectorizer vocab = 10 roles (nav,hero,features,proof,pricing,faq,cta,testimonial,footer,
// unknown). Authored families use ~30 bespoke roles for RENDERING (sectionGrammar keeps them
// verbatim — never rewritten). ROLE_ALIASES is used ONLY for vectorization + the §3 fingerprint
// distance. `hashSections`/`sectionOrderHash` (genome.mjs) keep hashing RAW roles — identity
// preservation for the diversity penalty (spec trap 7) — canonical is ONLY used inside distance.
export const ROLE_ALIASES = {
  // nav ← topbar, appbar, masthead, header(top). "header" is treated as nav uniformly here: on
  // every authored/crawl family it occupies the nav slot (first section, identity+wayfinding).
  topbar: "nav", appbar: "nav", masthead: "nav", header: "nav",
  // hero ← marquee, opening, lede, page-header, reading-header, summary, intro, intro-band
  marquee: "hero", opening: "hero", lede: "hero", "page-header": "hero", "reading-header": "hero",
  summary: "hero", intro: "hero", "intro-band": "hero",
  // features ← chapter-*, body-columns, article-body, spec-groups, workspace, table-body, mosaic,
  // pane-body, primary-instrument, secondary-metrics, dark-band, light-band, full-bleed-diagram,
  // annotation-flow, comparison-matrix, filter-bar, table-head, toolbar, evidence, selected-detail,
  // diagram  ("chapter-*" is a prefix wildcard — handled in canonicalRole(), not listed here)
  "body-columns": "features", "article-body": "features", "spec-groups": "features",
  workspace: "features", "table-body": "features", mosaic: "features", "pane-body": "features",
  "primary-instrument": "features", "secondary-metrics": "features", "dark-band": "features",
  "light-band": "features", "full-bleed-diagram": "features", "annotation-flow": "features",
  "comparison-matrix": "features", "filter-bar": "features", "table-head": "features",
  toolbar: "features", evidence: "features", "selected-detail": "features", diagram: "features",
  // proof ← status-strip, pull-aside
  "status-strip": "proof", "pull-aside": "proof",
  // cta ← cta-band, resolution-cta, contact, related, plan-toggle, pagination
  "cta-band": "cta", "resolution-cta": "cta", contact: "cta", related: "cta",
  "plan-toggle": "cta", pagination: "cta",
  // faq ← faq (identity — already canonical)
  faq: "faq",
  // footer ← statusbar
  statusbar: "footer",
};

// The 10-role crawl/vectorizer vocabulary — canonicalRole() never returns anything outside this
// set (bespoke roles not covered by ROLE_ALIASES/the chapter-* wildcard fall through to "unknown").
export const CANONICAL_ROLES = new Set([
  "nav", "hero", "features", "proof", "pricing", "faq", "cta", "testimonial", "footer", "unknown",
]);

// canonicalRole(rawRole) → one of CANONICAL_ROLES. Pure lookup + one prefix rule (chapter-*).
// Used ONLY for vectorization/fingerprint distance (§3) — never for rendering/sectionGrammar.
export function canonicalRole(role) {
  const r = String(role || "");
  if (CANONICAL_ROLES.has(r)) return r;
  if (ROLE_ALIASES[r]) return ROLE_ALIASES[r];
  if (r.startsWith("chapter-")) return "features";
  return "unknown";
}
