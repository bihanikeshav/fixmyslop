import { readFile } from "node:fs/promises";
import { createEngine } from "../../apps/engine/engine.mjs";
import { connectedExploreDirections, connectedIntent, connectedStyleGenome } from "../../apps/engine/connected.mjs";
import corpus from "../../apps/engine/data/corpus.json" with { type: "json" };
import brands from "../../apps/engine/data/brands.json" with { type: "json" };
import fonts from "../../apps/engine/data/fonts.json" with { type: "json" };

const fixture = JSON.parse(await readFile(new URL("./semantic-routing.v1.json", import.meta.url), "utf8"));
const engine = createEngine({ corpus, brands, fonts });
const failures = [];
const results = [];

for (const testCase of fixture.cases) {
  const intent = connectedIntent(testCase.input);
  const caseResult = { id: testCase.id, profile: intent.profile, score: intent.semantic.score, seeds: [] };
  if (intent.profile !== testCase.profile) failures.push(`${testCase.id}: profile ${intent.profile} != ${testCase.profile}`);
  for (const seed of fixture.seeds) {
    const genome = connectedStyleGenome(engine, testCase.input, { seed });
    const explored = connectedExploreDirections(engine, testCase.input, { seed, count: 4 });
    const readable = genome.type?.display?.readabilityChecks?.displaySuitable !== false
      && genome.type?.body?.readabilityChecks?.bodySuitable !== false;
    const record = {
      seed,
      mechanism: genome.connected?.mechanism?.id,
      centrepiece: genome.expression?.centrepiece,
      directions: explored.directions.length,
      readable,
      directionRealizations: [...new Set(explored.directions.map((direction) => direction.artDirection?.id).filter(Boolean))],
    };
    caseResult.seeds.push(record);
    if (record.mechanism !== testCase.mechanism) failures.push(`${testCase.id}/${seed}: mechanism ${record.mechanism} != ${testCase.mechanism}`);
    if (record.centrepiece !== testCase.centrepiece) failures.push(`${testCase.id}/${seed}: centrepiece ${record.centrepiece} != ${testCase.centrepiece}`);
    if (record.directions < 2) failures.push(`${testCase.id}/${seed}: fewer than two directions`);
    if (record.directionRealizations.length < 2) failures.push(`${testCase.id}/${seed}: directions do not diverge by authored realization`);
    if (!record.readable) failures.push(`${testCase.id}/${seed}: unreadable connected font role`);
  }
  results.push(caseResult);
}

const report = { version: fixture.version, benchmark: fixture.name, cases: results.length, seeds: fixture.seeds.length, checks: results.length * fixture.seeds.length, failures, results };
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
