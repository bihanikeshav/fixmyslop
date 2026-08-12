import { createEngine } from "../apps/engine/engine.mjs";

const engine = createEngine();
for (const role of ["display", "body"]) {
  const rows = engine.retrieveFonts({ role, n: 40 }).slice(0, 20).map((font) => ({
    family: font.family,
    category: font.category,
    quality: font.quality,
    rank: font.popularityRank,
    usage: font.usageEvidence?.total || font.usage?.total || 0,
    asset: font.asset?.available === true,
    fit: Number(font.featureDistance?.toFixed?.(3) ?? font.featureDistance),
  }));
  console.log(role, JSON.stringify(rows, null, 2));
}
