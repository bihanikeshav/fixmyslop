// Autonomous end-to-end case runner. It exercises the public engine seam,
// writes machine-readable case artifacts, and deliberately treats warnings and
// aesthetic suspicion signals separately from hard contract failures.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createEngine } from "../engine.mjs";
import { connectedStyleGenome, connectedExploreDirections, connectedBuildSpec } from "../connected.mjs";
import { evaluateSet } from "../fingerprint.mjs";
import { evaluateCrossAxis } from "../divergence.mjs";
import { checkBackgroundViolations } from "../background.mjs";
import { checkMotionViolations } from "../motion.mjs";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const OUT = path.join(ROOT, "data", "tmp", "engine-v2");
mkdirSync(OUT, { recursive: true });

const cases = [
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

function uniq(values) { return [...new Set(values.filter((value) => value != null && value !== ""))]; }
function nonChromeSections(layout) { return (layout?.sectionGrammar || []).filter((section) => !["nav", "header", "footer"].includes(section.role)); }
function maxBy(rows, fn) { return rows.reduce((best, row) => (best == null || fn(row) > fn(best) ? row : best), null); }
function themeViolations(engine, color, theme) {
  if (!color || !theme) return [];
  const ground = engine.classify(color.ground)?.oklch?.L;
  const ink = engine.classify(color.ink)?.oklch?.L;
  if (!Number.isFinite(ground) || !Number.isFinite(ink)) return ["theme-lightness-unreadable"];
  if (theme === "dark" && (ground > 0.35 || ink <= ground)) return ["dark-theme-palette-mismatch"];
  if (theme === "light" && (ground < 0.65 || ink >= ground)) return ["light-theme-palette-mismatch"];
  return [];
}

function inspectCase(engine, item, seed) {
  const one = connectedStyleGenome(engine, item.intent, { seed });
  const directions = connectedExploreDirections(engine, item.intent, { seed, count: 4 });
  const palette = engine.checkPalette(one.color.ground, one.color.ink, one.color.accent, one.color.accent2);
  const type = engine.checkTypeFit({ display: one.type?.display?.family, body: one.type?.body?.family }, item.intent);
  const backgroundViolations = checkBackgroundViolations(one.background, one.layout);
  const motionViolations = checkMotionViolations(one.motion.design, one.layout);
  const themeMismatch = themeViolations(engine, one.color, item.intent.theme);
  const fingerprints = directions.directions.map((direction) => direction.fingerprint).filter(Boolean);
  const setEvaluation = evaluateSet(fingerprints);
  const axisEvaluation = evaluateCrossAxis(directions.directions);
  const spec = connectedBuildSpec(engine, item.intent, { seed }).spec;
  const sections = nonChromeSections(one.layout);
  const centrepiece = maxBy(sections, (section) => Number(section.heightShare || 0));
  const hardFailures = [];
  const suspicionSignals = [];
  const expressionTreatments = one.expression?.treatments || [];

  if (one.warnings?.length) suspicionSignals.push(...one.warnings.map((warning) => `intent-warning:${warning}`));
  if (!palette.pass) hardFailures.push(`palette:${palette.verdict || "FAIL"}`);
  if (!type.pass) hardFailures.push(`type:${type.violations.map((v) => v.reason).join("; ")}`);
  if (backgroundViolations.length) hardFailures.push(`background:${backgroundViolations.join(",")}`);
  if (motionViolations.length) hardFailures.push(`motion:${motionViolations.join(",")}`);
  if (themeMismatch.length) hardFailures.push(`theme:${themeMismatch.join(",")}`);
  if (one.color.contrast < 4.5) hardFailures.push(`contrast:${one.color.contrast}`);
  if (!one.motion.design?.defaults?.respectsReducedMotion) hardFailures.push("reduced-motion-missing");
  if (one.motion.design?.reveal?.gatesCoreContent !== false) hardFailures.push("core-content-gated");
  if (!one.type?.display?.family || !one.type?.body?.family) hardFailures.push("font-pair-missing");
  if (one.type.display.family === one.type.body.family) hardFailures.push("display-body-collision");
  if (!one.type?.pairing?.v2 || !one.type?.pairing?.v2?.display?.available || !one.type?.pairing?.v2?.body?.available) hardFailures.push("font-v2-evidence-missing");
  if (one.type.accent?.family && [one.type.display.family, one.type.body.family].includes(one.type.accent.family)) hardFailures.push("accent-font-collision");
  if (!one.material?.component?.dialect || !one.material?.component?.button?.restingShadow) suspicionSignals.push("component-personality-thin");
  if (!one.color?.scene?.axes?.textureRef || !one.material?.texture?.dialect) hardFailures.push("material-v2-missing");
  if (expressionTreatments.length > 2) hardFailures.push("expression-budget-exceeded");
  for (const treatment of expressionTreatments) {
    if (!one.expression?.responsive?.[treatment.id]) hardFailures.push(`expression-mobile-fallback-missing:${treatment.id}`);
    if (!one.expression?.reducedMotion?.[treatment.id]) hardFailures.push(`expression-reduced-motion-missing:${treatment.id}`);
  }
  if (!centrepiece) hardFailures.push("centrepiece-missing");
  const acceptedDegradedThinPool = directions.directions.length === 2 && directions.warnings.some((warning) => String(warning).startsWith("engine-synthesis-degraded"));
  if (directions.directions.length !== 4 && !acceptedDegradedThinPool) hardFailures.push(`direction-count:${directions.directions.length}`);
  if (setEvaluation.violations?.length) suspicionSignals.push(`direction-divergence:${setEvaluation.violations.length}`);
  if (axisEvaluation.violations?.length) suspicionSignals.push(`axis-divergence:${axisEvaluation.violations.length}`);
  if (uniq(directions.directions.map((direction) => direction.genome?.layout?.family)).length < Math.min(3, directions.directions.length)) suspicionSignals.push("low-layout-family-variation");
  if (uniq(directions.directions.map((direction) => direction.genome?.type?.display?.family)).length < Math.min(3, directions.directions.length)) suspicionSignals.push("low-display-font-variation");
  if (uniq(directions.directions.map((direction) => direction.genome?.color?.mood)).length < 2) suspicionSignals.push("single-color-mood");
  if (one.layout?.macro?.contentDensity > 0.75 && one.layout?.macro?.whitespace > 0.45) suspicionSignals.push("density-whitespace-mismatch");
  if (sections.length > 0 && sections.every((section) => section.composition === sections[0].composition)) suspicionSignals.push("uniform-section-composition");
  if (spec.length < 1000) suspicionSignals.push("thin-build-spec");

  return {
    id: item.id,
    seed,
    intent: item.intent,
    oneShot: {
      warnings: one.warnings,
      layoutFamily: one.layout.family,
      pageKind: one.layout.pageKind,
      displayFont: one.type.display.family,
      bodyFont: one.type.body.family,
      accentFont: one.type.accent?.family || null,
      connectedProfile: one.connected?.profile || one.type?.pairing?.register || null,
      pairing: one.type?.pairing || null,
      componentDialect: one.material?.component?.dialect || null,
      textureDialect: one.material?.texture?.dialect || null,
      expressionCentrepiece: one.expression?.centrepiece || null,
      expressionTreatments: expressionTreatments.map((treatment) => treatment.id),
      palette: one.color,
      typeGate: type,
      paletteGate: palette,
      backgroundViolations,
      motionViolations,
      themeMismatch,
      centrepiece,
      sectionCount: sections.length,
      responsive: one.responsive,
      specChars: spec.length,
      fingerprint: one.fingerprint,
    },
    directions: directions.directions.map((direction) => ({
      name: direction.name,
      family: direction.genome?.layout?.family,
      pageKind: direction.genome?.layout?.pageKind,
      displayFont: direction.genome?.type?.display?.family,
      bodyFont: direction.genome?.type?.body?.family,
      accentFont: direction.genome?.type?.accent?.family || null,
      componentDialect: direction.genome?.material?.component?.dialect || null,
      textureDialect: direction.genome?.material?.texture?.dialect || null,
      expressionCentrepiece: direction.genome?.expression?.centrepiece || null,
      expressionTreatments: (direction.genome?.expression?.treatments || []).map((treatment) => treatment.id),
      mood: direction.genome?.color?.mood,
      hue: direction.genome?.color?.hue,
      retrieval: direction.retrieval || null,
      groundedIn: direction.groundedIn || null,
      warnings: direction.warnings || [],
    })),
    divergence: { setEvaluation, axisEvaluation, warnings: directions.warnings },
    hardFailures,
    suspicionSignals: uniq(suspicionSignals),
  };
}

const engine = createEngine();
const results = cases.map((item, index) => inspectCase(engine, item, 1701 + index * 97));
const report = {
  schemaVersion: "autonomous-engine-cases.v1",
  generatedAt: new Date().toISOString(),
  runner: "apps/engine/scripts/run-autonomous-cases.mjs",
  caseCount: results.length,
  directionCount: results.reduce((sum, result) => sum + result.directions.length, 0),
  hardFailureCount: results.reduce((sum, result) => sum + result.hardFailures.length, 0),
  casesWithHardFailures: results.filter((result) => result.hardFailures.length).map((result) => result.id),
  suspicionCount: results.reduce((sum, result) => sum + result.suspicionSignals.length, 0),
  results,
};
writeFileSync(path.join(OUT, "autonomous-cases.v1.json"), JSON.stringify(report, null, 2) + "\n");
for (const result of results) writeFileSync(path.join(OUT, `${result.id}.spec.md`), connectedBuildSpec(engine, result.intent, { seed: result.seed }).spec);
console.log(JSON.stringify({ caseCount: report.caseCount, directionCount: report.directionCount, hardFailureCount: report.hardFailureCount, casesWithHardFailures: report.casesWithHardFailures, suspicionCount: report.suspicionCount }));
