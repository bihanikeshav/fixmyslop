#!/usr/bin/env node
import { copyFileSync, cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const sourceDir = join(root, "apps", "web", "demo");
const outputDir = join(root, "apps", "web", "build");
const entries = [
  "tweaks-panel.jsx",
  "chrome.jsx",
  "slop-act.jsx",
  "second-order-act.jsx",
  "pg-glass.jsx",
  "pg-color.jsx",
  "pg-imagery.jsx",
  "pg-controls.jsx",
  "pg-motion.jsx",
  "pg-type.jsx",
  "pg-compose.jsx",
  "pg-copy.jsx",
  "pg-text.jsx",
  "index-act.jsx",
  "app.jsx",
];

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
  "font-pair-judgments.v2.json", "genome.mjs", "intent.mjs",
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

console.log(`Built ${entries.length} browser scripts and the connected engine runtime in apps/web/build.`);
