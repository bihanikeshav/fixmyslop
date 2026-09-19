// genome-vector.mjs — a thin RE-EXPORT. The implementation lives in
// apps/engine/genome-vector.mjs.
//
// Why: this module needs `canonicalRole()` from apps/engine/role-aliases.mjs, while
// apps/engine/retrieval.mjs and apps/engine/scripts/build-retrieval-index.mjs needed
// this module — so the engine imported UP into viz and viz imported back DOWN into the
// engine. That is a cycle across a boundary the engine is meant to sit below, and it
// made the engine unbuildable on its own (the Worker bundle would have had to reach
// outside apps/ to compile).
//
// The vector space is unchanged — same fields, same normalization, same weights, same
// numbers. Every viz/ and packages/crawl/ script that imports this path keeps working
// verbatim; new code inside apps/engine should import ../genome-vector.mjs directly.
export {
  NUMERIC_FIELDS,
  ROLE_VOCAB,
  GROUP_WEIGHTS,
  fitGenomeCorpus,
  genomeVector,
  cosine,
} from "../../apps/engine/genome-vector.mjs";
