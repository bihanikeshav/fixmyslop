// Re-run the canonical ten design briefs through two deterministic paths:
// A = the frozen core genome, B = the connected v2 adapter.
//
// This is deliberately an output-level A/B harness. It does not alter the
// frozen engine interfaces; it records full genomes/specs so a later browser
// renderer can perform the visual half of the comparison.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { styleGenome } from "../genome.mjs";
import { exploreDirections } from "../explore.mjs";
import { genomeToSpec } from "../spec.mjs";
import { createEngine } from "../engine.mjs";
import { connectedStyleGenome, connectedExploreDirections, connectedBuildSpec } from "../connected.mjs";
import { checkBackgroundViolations } from "../background.mjs";
import { checkMotionViolations } from "../motion.mjs";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const OUT = path.join(ROOT, "data", "tmp", "engine-v2-ab");
const A_DIR = path.join(OUT, "a-legacy-core");
const B_DIR = path.join(OUT, "b-connected-v2");
mkdirSync(A_DIR, { recursive: true });
mkdirSync(B_DIR, { recursive: true });

// Keep this list and seed schedule aligned with run-autonomous-cases.mjs.
const CASES = [
  {
    id: "01-coffee-editorial",
    intent: { surface: "marketing", job: "explain-and-convert", contentModel: "story", theme: "light", audience: ["coffee curious adults"], sourceBrief: "A tactile independent coffee roastery: origin stories, craft, and a calm subscription conversion path." },
  },
  {
    id: "02-observability-console",
    intent: { surface: "dashboard", job: "monitor", contentModel: "metrics", theme: "dark", audience: ["SRE teams"], sourceBrief: "A precise observability console for incident response, with calm urgency and high signal density." },
  },
  {
    id: "03-archive-portfolio",
    intent: { surface: "portfolio", job: "showcase-work", contentModel: "gallery", theme: "light", audience: ["creative directors"], sourceBrief: "An art director portfolio built around a single moving image archive, asymmetrical pacing, and editorial confidence." },
  },
  {
    id: "04-developer-docs",
    intent: { surface: "docs", job: "long-form", contentModel: "reference", theme: "light", audience: ["developers"], sourceBrief: "Documentation for a small, serious developer tool: readable, navigable, restrained, and quietly crafted." },
  },
  {
    id: "05-project-workspace",
    intent: { surface: "app", job: "manage-work", contentModel: "workflow", theme: "light", audience: ["small product teams"], sourceBrief: "A project workspace that makes handoffs, decisions, and next actions feel clear without becoming sterile." },
  },
  {
    id: "06-ethical-pricing",
    intent: { surface: "pricing", job: "explain-and-convert", contentModel: "comparison", theme: "light", audience: ["independent businesses"], sourceBrief: "Straightforward pricing for an ethical cooperative software product; transparent, warm, and confidence-building." },
  },
  {
    id: "07-climate-journal",
    intent: { surface: "editorial", job: "long-form", contentModel: "story", theme: "light", audience: ["curious readers"], sourceBrief: "A climate field journal with maps, field notes, photographs, and long-form reporting that should feel human rather than corporate." },
  },
  {
    id: "08-neon-music-launch",
    intent: { surface: "landing-page", job: "explain-and-convert", contentModel: "campaign", theme: "dark", audience: ["music fans"], sourceBrief: "A launch page for an experimental electronic record: kinetic, nocturnal, physical, and unmistakably tied to sound." },
  },
  {
    id: "09-ceramic-studio",
    intent: { surface: "marketing", job: "explain-and-convert", contentModel: "catalogue", theme: "light", audience: ["design-conscious buyers"], sourceBrief: "A small ceramic studio selling limited vessels, with material tactility, restraint, and one memorable product moment." },
  },
  {
    id: "10-public-library",
    intent: { surface: "landing-page", job: "explain-and-convert", contentModel: "service", theme: "light", audience: ["families and local residents"], sourceBrief: "A public library redesign: welcoming, legible, civic, and alive without looking like a generic SaaS landing page." },
  },
];

function uniq(values) {
  return [...new Set(values.filter((value) => value != null && value !== ""))];
}

function themeViolations(engine, color, theme) {
  if (!color || !theme) return [];
  const ground = engine.classify(color.ground)?.oklch?.L;
  const ink = engine.classify(color.ink)?.oklch?.L;
  if (!Number.isFinite(ground) || !Number.isFinite(ink)) return ["theme-lightness-unreadable"];
  if (theme === "dark" && (ground > 0.35 || ink <= ground)) return ["dark-theme-palette-mismatch"];
  if (theme === "light" && (ground < 0.65 || ink >= ground)) return ["light-theme-palette-mismatch"];
  return [];
}

function contentSections(layout) {
  return (layout?.sectionGrammar || []).filter((section) => !["nav", "header", "footer"].includes(section.role));
}

function largestSection(layout) {
  return contentSections(layout).reduce((best, section) => (
    best == null || Number(section.heightShare || 0) > Number(best.heightShare || 0) ? section : best
  ), null);
}

function validate(engine, genome, intent, { connected = false } = {}) {
  const palette = engine.checkPalette(genome.color?.ground, genome.color?.ink, genome.color?.accent, genome.color?.accent2);
  const type = engine.checkTypeFit({ display: genome.type?.display?.family, body: genome.type?.body?.family }, intent);
  const backgroundViolations = checkBackgroundViolations(genome.background, genome.layout);
  const motionViolations = checkMotionViolations(genome.motion?.design, genome.layout);
  const themeMismatch = themeViolations(engine, genome.color, intent.theme);
  const hardFailures = [];
  const warnings = [];
  const expressionTreatments = genome.expression?.treatments || [];

  if (!palette.pass) hardFailures.push(`palette:${palette.verdict || "FAIL"}`);
  if (!type.pass) hardFailures.push(`type:${(type.violations || []).map((v) => v.reason).join("; ")}`);
  if (backgroundViolations.length) hardFailures.push(`background:${backgroundViolations.join(",")}`);
  if (motionViolations.length) hardFailures.push(`motion:${motionViolations.join(",")}`);
  if (themeMismatch.length) hardFailures.push(`theme:${themeMismatch.join(",")}`);
  if (Number(genome.color?.contrast) < 4.5) hardFailures.push(`contrast:${genome.color?.contrast}`);
  if (!genome.motion?.design?.defaults?.respectsReducedMotion) hardFailures.push("reduced-motion-missing");
  if (genome.motion?.design?.reveal?.gatesCoreContent !== false) hardFailures.push("core-content-gated");
  if (!genome.type?.display?.family || !genome.type?.body?.family) hardFailures.push("font-pair-missing");
  if (genome.type?.display?.family === genome.type?.body?.family) hardFailures.push("display-body-collision");
  if (!contentSections(genome.layout).length) warnings.push("centrepiece-context-thin");

  if (connected) {
    if (!genome.type?.pairing?.v2?.display?.available || !genome.type?.pairing?.v2?.body?.available) hardFailures.push("font-v2-evidence-missing");
    if (genome.type?.accent?.family && [genome.type?.display?.family, genome.type?.body?.family].includes(genome.type.accent.family)) hardFailures.push("accent-font-collision");
    if (!genome.material?.component?.dialect || !genome.material?.component?.button?.restingShadow) hardFailures.push("component-v2-missing");
    if (!genome.color?.scene?.axes?.textureRef || !genome.material?.texture?.dialect) hardFailures.push("material-v2-missing");
    if (expressionTreatments.length > 2) hardFailures.push("expression-budget-exceeded");
    for (const treatment of expressionTreatments) {
      if (!genome.expression?.responsive?.[treatment.id]) hardFailures.push(`expression-mobile-fallback-missing:${treatment.id}`);
      if (!genome.expression?.reducedMotion?.[treatment.id]) hardFailures.push(`expression-reduced-motion-missing:${treatment.id}`);
    }
  }

  return {
    hardFailures,
    warnings,
    gates: {
      palette,
      type,
      backgroundViolations,
      motionViolations,
      themeMismatch,
      contrast: genome.color?.contrast ?? null,
    },
  };
}

function summary(genome, validation, spec) {
  const expression = genome.expression || {};
  return {
    layoutFamily: genome.layout?.family || null,
    pageKind: genome.layout?.pageKind || null,
    displayFont: genome.type?.display?.family || null,
    bodyFont: genome.type?.body?.family || null,
    accentFont: genome.type?.accent?.family || null,
    fontPair: [genome.type?.display?.family, genome.type?.body?.family].filter(Boolean),
    componentDialect: genome.material?.component?.dialect || null,
    buttonPersonality: genome.material?.component?.button?.interaction || null,
    shadowLanguage: genome.material?.component?.shadow?.language || genome.material?.shadowLanguage || null,
    textureDialect: genome.material?.texture?.dialect || null,
    textureEnabled: genome.material?.texture?.enabled ?? false,
    expressionCentrepiece: expression.centrepiece || null,
    expressionTreatments: (expression.treatments || []).map((treatment) => treatment.id),
    sectionCount: contentSections(genome.layout).length,
    largestSection: largestSection(genome.layout),
    contrast: genome.color?.contrast ?? null,
    specChars: spec.length,
    hardFailures: validation.hardFailures,
    warnings: validation.warnings,
  };
}

function directionRecord(direction, engine, intent, connected) {
  const genome = direction.genome;
  const validation = validate(engine, genome, intent, { connected });
  return {
    name: direction.name,
    retrieval: direction.retrieval || null,
    groundedIn: direction.groundedIn || null,
    warnings: direction.warnings || [],
    summary: summary(genome, validation, genomeToSpec(genome)),
    genome,
  };
}

function delta(a, b) {
  return {
    layoutFamilyChanged: a.layoutFamily !== b.layoutFamily,
    fontPairChanged: a.fontPair.join("|") !== b.fontPair.join("|"),
    accentAdded: !a.accentFont && !!b.accentFont,
    componentAdded: !a.componentDialect && !!b.componentDialect,
    textureAdded: !a.textureEnabled && !!b.textureEnabled,
    expressionAdded: !a.expressionCentrepiece && !!b.expressionCentrepiece,
    expressionChanged: a.expressionCentrepiece !== b.expressionCentrepiece || a.expressionTreatments.join("|") !== b.expressionTreatments.join("|"),
    specCharsDelta: b.specChars - a.specChars,
    hardFailureDelta: b.hardFailures.length - a.hardFailures.length,
  };
}

const engine = createEngine();
const cases = [];
const aRun = [];
const bRun = [];
const comparisons = [];

for (const [index, item] of CASES.entries()) {
  const seed = 1701 + index * 97;
  const aGenome = styleGenome(engine, item.intent, { seed });
  const aDirections = exploreDirections(engine, item.intent, { seed, count: 4 });
  const aSpec = genomeToSpec(aGenome);
  const aValidation = validate(engine, aGenome, item.intent);
  const aSummary = summary(aGenome, aValidation, aSpec);

  const bBuilt = connectedBuildSpec(engine, item.intent, { seed });
  const bGenome = bBuilt.genome;
  const bDirections = connectedExploreDirections(engine, item.intent, { seed, count: 4 });
  const bSpec = bBuilt.spec;
  const bValidation = validate(engine, bGenome, item.intent, { connected: true });
  const bSummary = summary(bGenome, bValidation, bSpec);

  const aSpecPath = path.join(A_DIR, `${item.id}.spec.md`);
  const bSpecPath = path.join(B_DIR, `${item.id}.spec.md`);
  writeFileSync(aSpecPath, `${aSpec}\n`);
  writeFileSync(bSpecPath, `${bSpec}\n`);

  aRun.push({ id: item.id, seed, intent: item.intent, summary: aSummary, validation: aValidation, specPath: path.relative(ROOT, aSpecPath).replaceAll("\\", "/"), genome: aGenome, directions: aDirections.directions.map((direction) => directionRecord(direction, engine, item.intent, false)), directionWarnings: aDirections.warnings || [] });
  bRun.push({ id: item.id, seed, intent: item.intent, summary: bSummary, validation: bValidation, specPath: path.relative(ROOT, bSpecPath).replaceAll("\\", "/"), genome: bGenome, directions: bDirections.directions.map((direction) => directionRecord(direction, engine, item.intent, true)), directionWarnings: bDirections.warnings || [] });
  comparisons.push({ id: item.id, seed, intent: item.intent, a: aSummary, b: bSummary, delta: delta(aSummary, bSummary) });
}

const report = {
  schemaVersion: "engine-ab-cases.v1",
  generatedAt: new Date().toISOString(),
  runner: "apps/engine/scripts/run-ab-cases.mjs",
  baseline: {
    a: "legacy-core",
    b: "connected-v2",
    note: "A is the frozen core genome path. No separately persisted pre-v2 connected report existed, so this is a clean feature-path A/B rather than a screenshot diff against an earlier adapter run.",
  },
  briefs: CASES.map((item, index) => ({ id: item.id, seed: 1701 + index * 97, intent: item.intent })),
  aggregate: {
    caseCount: comparisons.length,
    aHardFailureCount: aRun.reduce((sum, item) => sum + item.validation.hardFailures.length, 0),
    bHardFailureCount: bRun.reduce((sum, item) => sum + item.validation.hardFailures.length, 0),
    bFontV2Coverage: bRun.filter((item) => item.genome.type?.pairing?.v2?.display?.available && item.genome.type?.pairing?.v2?.body?.available).length,
    bMaterialV2Coverage: bRun.filter((item) => item.genome.material?.component?.dialect && item.genome.material?.texture?.dialect && item.genome.color?.scene?.axes?.textureRef).length,
    bExpressionFallbackCoverage: bRun.filter((item) => (item.genome.expression?.treatments || []).every((treatment) => item.genome.expression?.responsive?.[treatment.id] && item.genome.expression?.reducedMotion?.[treatment.id])).length,
    layoutChanges: comparisons.filter((item) => item.delta.layoutFamilyChanged).length,
    fontPairChanges: comparisons.filter((item) => item.delta.fontPairChanged).length,
    accentAdded: comparisons.filter((item) => item.delta.accentAdded).length,
    componentAdded: comparisons.filter((item) => item.delta.componentAdded).length,
    textureAdded: comparisons.filter((item) => item.delta.textureAdded).length,
    expressionAdded: comparisons.filter((item) => item.delta.expressionAdded).length,
    expressionChanged: comparisons.filter((item) => item.delta.expressionChanged).length,
    casesWithFewerHardFailuresInB: comparisons.filter((item) => item.delta.hardFailureDelta < 0).map((item) => item.id),
    casesWithMoreHardFailuresInB: comparisons.filter((item) => item.delta.hardFailureDelta > 0).map((item) => item.id),
    componentDialectsInB: uniq(bRun.map((item) => item.summary.componentDialect)),
    textureDialectsInB: uniq(bRun.map((item) => item.summary.textureDialect)),
    expressionCentrepiecesInB: uniq(bRun.map((item) => item.summary.expressionCentrepiece)),
  },
  comparisons,
};

writeFileSync(path.join(OUT, "run-a-legacy-core.json"), JSON.stringify({ schemaVersion: "engine-ab-side.v1", side: "A", label: "legacy-core", generatedAt: report.generatedAt, cases: aRun }, null, 2) + "\n");
writeFileSync(path.join(OUT, "run-b-connected-v2.json"), JSON.stringify({ schemaVersion: "engine-ab-side.v1", side: "B", label: "connected-v2", generatedAt: report.generatedAt, cases: bRun }, null, 2) + "\n");
writeFileSync(path.join(OUT, "ab-comparison.v1.json"), JSON.stringify(report, null, 2) + "\n");

console.log(JSON.stringify({
  caseCount: report.aggregate.caseCount,
  aHardFailureCount: report.aggregate.aHardFailureCount,
  bHardFailureCount: report.aggregate.bHardFailureCount,
  bFontV2Coverage: report.aggregate.bFontV2Coverage,
  bMaterialV2Coverage: report.aggregate.bMaterialV2Coverage,
  bExpressionFallbackCoverage: report.aggregate.bExpressionFallbackCoverage,
  layoutChanges: report.aggregate.layoutChanges,
  fontPairChanges: report.aggregate.fontPairChanges,
  accentAdded: report.aggregate.accentAdded,
  textureAdded: report.aggregate.textureAdded,
  expressionAdded: report.aggregate.expressionAdded,
}));
