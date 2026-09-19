#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { basename, posix } from "node:path";

const raw = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" });
const files = raw.split("\0").filter(Boolean);
const forbidden = [
  /(^|\/)(cookies?|youtube_cookies)(\.[^/]*)?$/i,
  /(^|\/)credentials\.json$/i,
  /(^|\/)(login data|local state)$/i,
];

const failures = [];
for (const file of files) {
  if (forbidden.some((pattern) => pattern.test(file))) {
    failures.push(`${file}: credential/session filename must not be tracked`);
  }
  if (/^\.env(?:\..+)?$/i.test(basename(file)) && basename(file).toLowerCase() !== ".env.example") {
    failures.push(`${file}: environment secret file must not be tracked`);
  }
  const size = statSync(file).size;
  if (size > 50 * 1024 * 1024) {
    failures.push(`${file}: ${(size / 1024 / 1024).toFixed(1)} MiB tracked file exceeds the 50 MiB hygiene gate`);
  }
  if (/\.(png|jpe?g)$/i.test(basename(file)) && !/^(apps\/web|viz\/personality-test)\//.test(file.replaceAll("\\", "/"))) {
    failures.push(`${file}: visual QA artifacts must live under apps/web or viz/personality-test`);
  }
}

// Fresh-clone guard: a tracked module must not statically import a relative file that is
// untracked (e.g. a gitignored data/*.json). It works locally and breaks every clone + CI.
const tracked = new Set(files.map((f) => f.replaceAll("\\", "/")));
const importRe = /(?:^|\n)\s*(?:import|export)\s[^'"\n;]*?from\s*["'](\.{1,2}\/[^"']+)["']|(?:^|\n)\s*import\s*["'](\.{1,2}\/[^"']+)["']/g;
for (const file of tracked) {
  if (!/\.(mjs|js|ts|jsx|tsx)$/.test(file) || /^(archive|apps\/web\/(build|vendor))\//.test(file)) continue;
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(importRe)) {
    const spec = match[1] || match[2];
    if (!/\.(json|mjs|js|ts|jsx)$/.test(spec) || /(^|\/)(dist|build)\//.test(spec)) continue; // build outputs are made by `npm run build`
    const target = posix.normalize(posix.join(posix.dirname(file), spec));
    const candidates = [target, target.replace(/\.js$/, ".ts"), target.replace(/\.js$/, ".tsx"), target.replace(/\.js$/, ".mjs")];
    if (!candidates.some((c) => tracked.has(c))) {
      failures.push(`${file}: imports "${spec}", which is not tracked (fresh clones will fail)`);
    }
  }
}

// Index guard: every area keeps the README an agent lands on first (see AGENTS.md).
const requiredIndexes = [
  "AGENTS.md", "README.md", "docs/README.md", "apps/README.md", "apps/engine/README.md",
  "apps/web/README.md", "packages/core/README.md", "packages/pipeline/README.md",
  "packages/crawl/README.md", "skills/README.md", "scripts/README.md", "tests/README.md",
  "viz/README.md", "benchmarks/README.md", "textslopbench/README.md", "archive/README.md",
];
for (const index of requiredIndexes) {
  if (!tracked.has(index)) failures.push(`${index}: required index file is missing or untracked`);
}

if (failures.length) {
  console.error("Repository hygiene check failed:\n" + failures.map((f) => `- ${f}`).join("\n"));
  process.exit(1);
}

console.log(`Repository hygiene check passed (${files.length} tracked files).`);
