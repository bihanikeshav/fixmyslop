// apps/engine/cli.mjs — offline front door over the engine. `node cli.mjs <fn> [args]`.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createEngine } from "./engine.mjs";

const dir = dirname(fileURLToPath(import.meta.url));
const load = (f) => JSON.parse(readFileSync(resolve(dir, "data", f), "utf8"));
const engine = createEngine({ corpus: load("corpus.json"), brands: load("brands.json"), fonts: load("fonts.json") });

const [, , fnRaw, ...rest] = process.argv;
if (!fnRaw) { console.error("usage: node cli.mjs <fn> [jsonArg | positional...]"); process.exit(1); }
const camel = fnRaw.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
const fn = engine[camel] || engine[fnRaw];
if (typeof fn !== "function") { console.error(`unknown fn: ${fnRaw}`); process.exit(1); }

const parseArgs = (a, func) => {
  if (a.length === 1 && /^\s*[[{]/.test(a[0])) {
    const parsed = JSON.parse(a[0]);
    if (typeof parsed === "object" && !Array.isArray(parsed)) {
      // For objects, try to extract function parameter names and spread accordingly
      const paramStr = func.toString().match(/\(([^)]*)\)/)?.[1] || "";
      const params = paramStr.split(",").map((p) => p.trim().split("=")[0].trim()).filter(Boolean);
      // If function expects multiple named parameters, spread the object
      if (params.length > 1 && !paramStr.includes("{")) {
        return params.map((p) => parsed[p]);
      }
    }
    return [parsed];
  }
  return a.map((x) => (/^-?\d+\.?\d*$/.test(x) ? Number(x) : x));
};
console.log(JSON.stringify(fn(...parseArgs(rest, fn)), null, 2));
