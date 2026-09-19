#!/usr/bin/env node
import { copyFileSync, cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const sourceDir = join(root, "apps", "web", "demo");
const outputDir = join(root, "apps", "web", "build");
// Only the entry the live pages actually load: index.html mounts the decision
// bench (build/app.js) via build/engine-bootstrap.mjs. The Slop-o-meter demo
// and its page components (tweaks-panel, chrome, slop-act, second-order-act,
// pg-*, index-act, pg-text) live in archive/web-slop-o-meter/ now — they are
// not compiled or shipped.
const entries = ["app.jsx"];

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });

for (const entry of entries) {
  const source = readFileSync(join(sourceDir, entry), "utf8");
  const result = ts.transpileModule(source, {
    fileName: entry,
    compilerOptions: {
      jsx: ts.JsxEmit.React,
      module: ts.ModuleKind.None,
      target: ts.ScriptTarget.ES2020,
      newLine: ts.NewLineKind.LineFeed,
      removeComments: false,
      sourceMap: false,
    },
    reportDiagnostics: true,
  });
  const errors = (result.diagnostics || []).filter((d) => d.category === ts.DiagnosticCategory.Error);
  if (errors.length) {
    const details = errors.map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n")).join("\n");
    throw new Error(`${entry} failed to compile:\n${details}`);
  }
  writeFileSync(join(outputDir, entry.replace(/\.jsx$/, ".js")), result.outputText, "utf8");
}

// Browser-connected engine. Keep the authoritative pure modules and empirical
// catalogues in their repository-relative topology so native ESM imports keep
// working in the static build without a second implementation drifting away.
const engineFiles = [
  "background.mjs", "components.mjs", "connected-v2.mjs", "connected.mjs",
  "dashboard.mjs", "divergence.mjs", "engine.mjs", "explore.mjs", "fingerprint.mjs",
  "font-pair-judgments.v2.json", "genome-vector.mjs", "genome.mjs", "intent.mjs",
  "layout-families.mjs", "motion.mjs", "perturb.mjs", "retrieval.mjs",
  "role-aliases.mjs", "section-purpose.mjs", "spec.mjs", "system.mjs",
];
const builtEngineDir = join(outputDir, "apps", "engine");
mkdirSync(builtEngineDir, { recursive: true });
for (const file of engineFiles) copyFileSync(join(root, "apps", "engine", file), join(builtEngineDir, file));
cpSync(join(root, "apps", "engine", "data"), join(builtEngineDir, "data"), { recursive: true });

const v2Files = [
  "font-space.v2.json", "component-personality.v1.json",
  "expression-treatments.v1.json", "expression-compatibility.v1.json",
  "color-scene-space.v2.json", "material-texture-space.v2.json",
];
const builtResearchDir = join(outputDir, "data", "research", "master-v2");
mkdirSync(builtResearchDir, { recursive: true });
for (const file of v2Files) copyFileSync(join(root, "data", "research", "master-v2", file), join(builtResearchDir, file));

const builtVectorDir = join(outputDir, "viz", "layout-embeddings");
mkdirSync(builtVectorDir, { recursive: true });
copyFileSync(join(root, "viz", "layout-embeddings", "genome-vector.mjs"), join(builtVectorDir, "genome-vector.mjs"));
copyFileSync(join(sourceDir, "engine-bootstrap.mjs"), join(outputDir, "engine-bootstrap.mjs"));

// Cache-busting: stamp index.html's `?v=` query params with a short hash of
// the files that actually change output (the stylesheet + the compiled entry
// point), instead of the old hand-maintained `?b=51`/`?b=52` counters that
// drifted out of sync with each other. Bump automatically on every build —
// nothing to remember to edit by hand.
const stylesheetSource = readFileSync(join(sourceDir, "app-styles.css"), "utf8");
const bootstrapSourceForHash = readFileSync(join(sourceDir, "engine-bootstrap.mjs"), "utf8");
const compiledAppSource = readFileSync(join(outputDir, "app.js"), "utf8");
const buildId = createHash("sha256")
  .update(stylesheetSource)
  .update(bootstrapSourceForHash)
  .update(compiledAppSource)
  .digest("hex")
  .slice(0, 10);

const indexPath = join(root, "apps", "web", "index.html");
const indexHtml = readFileSync(indexPath, "utf8")
  .replace(/(demo\/app-styles\.css)\?[^"]*/, `$1?v=${buildId}`)
  .replace(/(build\/engine-bootstrap\.mjs)\?[^"]*/, `$1?v=${buildId}`);
writeFileSync(indexPath, indexHtml, "utf8");

console.log(`Built ${entries.length} browser scripts and the connected engine runtime in apps/web/build.`);
console.log(`Stamped index.html cache-busting query with build id ${buildId}.`);
