#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
import { basename } from "node:path";

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

if (failures.length) {
  console.error("Repository hygiene check failed:\n" + failures.map((f) => `- ${f}`).join("\n"));
  process.exit(1);
}

console.log(`Repository hygiene check passed (${files.length} tracked files).`);
