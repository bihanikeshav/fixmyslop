// apps/engine/cli.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));
const cli = resolve(dir, "cli.mjs");
const run = (...args) => JSON.parse(execFileSync("node", [cli, ...args], { encoding: "utf8" }));

test("cli: shadow (positional) + check_palette (json) + snake→camel", () => {
  assert.ok(run("shadow", "4").layers.length >= 2);
  const p = run("check_palette", JSON.stringify({ ground: "#eceae3", ink: "#17150f", accent: "#b5522f" }));
  assert.equal(typeof p.pass, "boolean");
  assert.ok(run("type_scale", JSON.stringify({ base: 16, ratio: 1.25 })).length > 1);
});
