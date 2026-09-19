/**
 * Run the synthetic signal: sample the LLM N times, record its font defaults as
 * Observations (signal: "synthetic", window 0).
 *
 *   ANTHROPIC_API_KEY=... npx tsx src/sample-synthetic.ts [count] [--fresh]
 *
 * Skips cleanly (exit 0) when no API key is set.
 *
 * By default, each run ACCUMULATES: prior observations.synthetic.json
 * contents are aged by one window and the new run is appended as window 0
 * (see observations-merge.ts), so saturation's multi-window trend/decay logic
 * has more than one window to work with. Pass --fresh to restore the old
 * overwrite-every-run behaviour.
 */

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { Observation } from "@fixmyslop/core";
import { loadObservations, mergeObservations } from "./observations-merge.js";
import {
  SAMPLE_PRODUCTS,
  buildPrompt,
  parseChoice,
  choiceToFontIds,
  callAnthropic,
  resolveLlmConfig,
} from "./signals/synthetic.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(HERE, "../../../data");

async function main(): Promise<void> {
  const cfg = resolveLlmConfig(process.env);
  if (!cfg) {
    console.log("No ANTHROPIC_API_KEY set — skipping synthetic sampling (key-ready, not run).");
    return;
  }
  const args = process.argv.slice(2);
  const fresh = args.includes("--fresh");
  const positional = args.filter((a) => a !== "--fresh");
  const count = Number(positional[0] ?? "20");
  console.log(`Sampling ${count} synthetic landing-page designs with ${cfg.model}...`);

  const display = new Map<string, number>();
  const body = new Map<string, number>();
  let ok = 0;

  for (let i = 0; i < count; i++) {
    const product = SAMPLE_PRODUCTS[i % SAMPLE_PRODUCTS.length]!;
    try {
      const text = await callAnthropic(buildPrompt(product), cfg);
      const choice = parseChoice(text);
      if (!choice) continue;
      const { headingId, bodyId } = choiceToFontIds(choice);
      display.set(headingId, (display.get(headingId) ?? 0) + 1);
      body.set(bodyId, (body.get(bodyId) ?? 0) + 1);
      ok++;
    } catch (e) {
      console.warn(`  ! sample ${i}: ${(e as Error).message}`);
    }
  }

  const freshObservations: Observation[] = [
    ...[...display].map(([fontId, c]): Observation => ({
      fontId, role: "display", window: 0, count: c, signal: "synthetic",
    })),
    ...[...body].map(([fontId, c]): Observation => ({
      fontId, role: "body", window: 0, count: c, signal: "synthetic",
    })),
  ];

  const outPath = resolve(DATA_DIR, "observations.synthetic.json");
  const observations = fresh
    ? freshObservations
    : mergeObservations(await loadObservations(outPath), freshObservations);

  await writeFile(outPath, JSON.stringify(observations, null, 2));
  console.log(
    `\nDone. ${ok}/${count} parsed (${fresh ? "overwritten (--fresh)" : "accumulated"}, ` +
      `${observations.length} observations total). Top AI display defaults:`,
  );
  for (const [id, c] of [...display].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
    console.log(`  ${id.padEnd(24)} ${c}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
