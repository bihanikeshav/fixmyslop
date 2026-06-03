import { readFile } from "node:fs/promises";
const matrix = JSON.parse(await readFile("data/slop-matrix.json", "utf8"));

// Aggregate font frequency within rank bands across all vibe/model lists.
function band(lo, hi) {
  const m = new Map();
  for (const run of matrix.runs) {
    run.fonts.slice(lo - 1, hi).forEach((f) => m.set(f, (m.get(f) ?? 0) + 1));
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
}

const show = (title, arr) => {
  console.log(`\n=== ${title} ===`);
  console.log(arr.map(([f, c]) => `${f} (${c})`).join("  ·  "));
};

show("FIRST-ORDER SLOP — rank 1 (the instinct)", band(1, 1));
show("SECOND-ORDER SLOP — ranks 2-4 (first escape when told 'too overused')", band(2, 4));
show("THIRD-ORDER — ranks 5-10 (deeper escape)", band(5, 10));
show("DEEP CUTS — ranks 11-20 (where it finally gets fresh)", band(11, 20));
