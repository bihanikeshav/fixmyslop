#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const web = resolve(root, "apps", "web");
const html = readFileSync(resolve(web, "index.html"), "utf8");
const failures = [];

for (const forbidden of ["text/babel", "react.development.js", "react-dom.development.js", "@babel/standalone"]) {
  if (html.includes(forbidden)) failures.push(`index.html still ships ${forbidden}`);
}

const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((match) => match[1].split("?")[0]);
for (const script of scripts.filter((src) => !/^https?:/.test(src))) {
  if (!existsSync(resolve(web, script))) failures.push(`missing browser script: ${script}`);
}

// The Slop-o-meter demo (and its unused PageText/TextSlopBench summary route)
// moved to archive/web-slop-o-meter/ — index.html must not reference it.
for (const dead of ["build/pg-text.js"]) {
  if (scripts.includes(dead)) failures.push(`index.html must not load the archived ${dead}`);
}

const compiledApp = readFileSync(resolve(web, "build", "app.js"), "utf8");
const bootstrap = readFileSync(resolve(web, "build", "engine-bootstrap.mjs"), "utf8");
const styles = readFileSync(resolve(web, "demo", "app-styles.css"), "utf8");
for (const contract of ["aria-modal", "app-page-layer", "prefers-reduced-motion", "Escape"]) {
  if (!compiledApp.includes(contract)) failures.push(`compiled route shell is missing ${contract}`);
}
for (const contract of ["window.FIXMYSLOP_BROWSER", "new URL(\"./apps/engine/data/\", import.meta.url)", "fixed-acceptance-demo"]) {
  if (!bootstrap.includes(contract)) failures.push(`engine bootstrap is missing ${contract}`);
}
for (const contract of [
  ".direction-option { width: 100%; min-width: 0;",
  ".diagram-compact.diagram-connected { display: grid; grid-template-columns: minmax(0, 1fr)",
  ".revision-control input { display: block; width: calc(100% - 2px)",
]) {
  if (!styles.includes(contract)) failures.push(`responsive proof layout is missing ${contract}`);
}

for (const runtimeFile of [
  "engine-bootstrap.mjs",
  "apps/engine/connected.mjs",
  "apps/engine/connected-v2.mjs",
  "apps/engine/explore.mjs",
  "apps/engine/divergence.mjs",
  "apps/engine/data/corpus.json",
]) {
  if (!existsSync(resolve(web, "build", runtimeFile))) failures.push(`connected browser runtime is missing ${runtimeFile}`);
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}
console.log(`Web build check passed (${scripts.length} scripts).`);
