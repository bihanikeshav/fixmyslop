import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_SYSTEMS = ["fixmyslop", "impeccable", "taste"];

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function opaqueId(seed, briefId, system) {
  return `candidate-${createHash("sha256").update(`${seed}|${briefId}|${system}`).digest("hex").slice(0, 12)}`;
}

function stableOrder(seed, briefId, systems) {
  return [...systems].sort((a, b) => {
    const ah = createHash("sha256").update(`${seed}|order|${briefId}|${a}`).digest("hex");
    const bh = createHash("sha256").update(`${seed}|order|${briefId}|${b}`).digest("hex");
    return ah.localeCompare(bh);
  });
}

export function prepareRun({ outDir, seed = "20260824", systems = DEFAULT_SYSTEMS } = {}) {
  if (!outDir) throw new Error("prepare requires outDir");
  if (new Set(systems).size !== systems.length || systems.length < 2) {
    throw new Error("prepare requires at least two unique systems");
  }
  const briefs = readJson(resolve(HERE, "briefs.v1.json"));
  const rubric = readJson(resolve(HERE, "rubric.v1.json"));
  const key = {};
  const assignments = briefs.briefs.map((brief) => {
    const candidates = stableOrder(seed, brief.id, systems).map((system) => {
      const candidateId = opaqueId(seed, brief.id, system);
      key[candidateId] = { system, brief_id: brief.id };
      return {
        candidate_id: candidateId,
        artifact_contract: {
          desktop: `artifacts/${brief.id}/${candidateId}-desktop.png`,
          mobile: `artifacts/${brief.id}/${candidateId}-mobile.png`
        }
      };
    });
    return { brief, candidates };
  });
  const publicRun = {
    schema: "fixmyslop-ui-run/1.0",
    benchmark_version: briefs.version,
    rubric_version: rubric.version,
    seed: String(seed),
    conditions: briefs.run_conditions,
    assignments
  };
  writeJson(resolve(outDir, "assignments.json"), publicRun);
  writeJson(resolve(outDir, "system-key.private.json"), {
    schema: "fixmyslop-ui-system-key/1.0",
    systems,
    candidates: key
  });
  const submissionCandidates = {};
  for (const assignment of assignments) {
    for (const candidate of assignment.candidates) {
      submissionCandidates[candidate.candidate_id] = {
        conditions: briefs.run_conditions,
        skill_revision: "record-exact-skill-revision",
        artifacts: candidate.artifact_contract,
        gates: Object.fromEntries(rubric.required_gates.map((gate) => [gate, false])),
        mechanism_checks: Object.fromEntries((assignment.brief.required_functional_checks ?? []).map((check) => [
          check.id,
          {
            pass: false,
            evidence: `replace with visible before/after evidence for: ${check.requirement}`,
            artifact: `artifacts/${assignment.brief.id}/${candidate.candidate_id}-${check.id}.json`
          }
        ]))
      };
    }
  }
  writeJson(resolve(outDir, "submissions.template.json"), {
    schema: "fixmyslop-ui-submissions/1.1",
    candidates: submissionCandidates
  });
  writeJson(resolve(outDir, "ratings.template.json"), {
    schema: "fixmyslop-ui-ratings/1.0",
    note: "Duplicate one evidence-backed rating row per blinded rater and candidate.",
    ratings: []
  });
  return publicRun;
}

function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function artifactExists(runDir, path) {
  if (typeof path !== "string" || !path.trim()) return false;
  const root = resolve(runDir);
  const artifact = resolve(root, path);
  if (artifact !== root && !artifact.startsWith(`${root}${sep}`)) return false;
  return existsSync(artifact);
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function summarizeRun({ runDir } = {}) {
  if (!runDir) throw new Error("summarize requires runDir");
  const assignments = readJson(resolve(runDir, "assignments.json"));
  const key = readJson(resolve(runDir, "system-key.private.json"));
  const submissions = readJson(resolve(runDir, "submissions.json"));
  const ratings = readJson(resolve(runDir, "ratings.json"));
  const rubric = readJson(resolve(HERE, "rubric.v1.json"));
  const candidateIds = assignments.assignments.flatMap((row) => row.candidates.map((candidate) => candidate.candidate_id));
  const dimensions = rubric.rated_dimensions.map((dimension) => dimension.id);
  const rows = [];
  const briefById = new Map(assignments.assignments.map((assignment) => [assignment.brief.id, assignment.brief]));

  for (const candidateId of candidateIds) {
    const submission = submissions.candidates?.[candidateId];
    if (!submission) throw new Error(`missing submission for ${candidateId}`);
    const briefId = key.candidates[candidateId].brief_id;
    const brief = briefById.get(briefId);
    if (!brief) throw new Error(`missing benchmark brief for ${candidateId}`);
    if (!sameJson(submission.conditions, assignments.conditions)) {
      throw new Error(`run conditions differ for ${candidateId}`);
    }
    for (const viewport of ["desktop", "mobile"]) {
      const path = submission.artifacts?.[viewport];
      if (!path || !artifactExists(runDir, path)) throw new Error(`missing ${viewport} artifact for ${candidateId}`);
    }
    const failedGates = rubric.required_gates.filter((gate) => submission.gates?.[gate] !== true);
    for (const check of brief.required_functional_checks ?? []) {
      const result = submission.mechanism_checks?.[check.id];
      const hasEvidence = typeof result?.evidence === "string" && result.evidence.trim().length >= 20;
      const evidenceArtifact = typeof result?.artifact === "string" && artifactExists(runDir, result.artifact);
      if (result?.pass !== true || !hasEvidence || !evidenceArtifact) failedGates.push(`mechanism:${check.id}`);
    }
    const candidateRatings = ratings.ratings?.filter((rating) => rating.candidate_id === candidateId) ?? [];
    const raters = new Set(candidateRatings.map((rating) => rating.rater_id));
    if (raters.size < 2) throw new Error(`${candidateId} needs ratings from at least two blinded raters`);
    const scores = {};
    for (const dimension of dimensions) {
      const values = candidateRatings.map((rating) => {
        const score = rating.scores?.[dimension];
        const evidence = rating.evidence?.[dimension];
        if (!Number.isInteger(score) || score < 0 || score > 4) throw new Error(`invalid ${dimension} score for ${candidateId}`);
        if (typeof evidence !== "string" || evidence.trim().length < 12) throw new Error(`missing evidence for ${candidateId}/${dimension}`);
        return score;
      });
      scores[dimension] = Number(mean(values).toFixed(3));
    }
    rows.push({
      candidate_id: candidateId,
      brief_id: briefId,
      system: key.candidates[candidateId].system,
      gate_pass: failedGates.length === 0,
      failed_gates: failedGates,
      raters: raters.size,
      scores
    });
  }

  const comparisons = [];
  for (const assignment of assignments.assignments) {
    const briefRows = rows.filter((row) => row.brief_id === assignment.brief.id);
    for (let i = 0; i < briefRows.length; i++) {
      for (let j = i + 1; j < briefRows.length; j++) {
        const a = briefRows[i];
        const b = briefRows[j];
        for (const dimension of dimensions) {
          let result = "not_compared_due_to_gate_failure";
          if (a.gate_pass && b.gate_pass) {
            const delta = a.scores[dimension] - b.scores[dimension];
            result = Math.abs(delta) < 0.25 ? "tie" : delta > 0 ? `${a.system}_wins` : `${b.system}_wins`;
          }
          comparisons.push({ brief_id: assignment.brief.id, dimension, systems: [a.system, b.system].sort(), result });
        }
      }
    }
  }

  const summary = {
    schema: "fixmyslop-ui-summary/1.0",
    benchmark_version: assignments.benchmark_version,
    rubric_version: assignments.rubric_version,
    scope_statement: "Observed results on this frozen brief set under the recorded conditions. This is not evidence of general UI-skill superiority.",
    rows,
    comparisons
  };
  writeJson(resolve(runDir, "summary.json"), summary);
  return summary;
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const value = (name) => {
    const index = rest.indexOf(name);
    return index >= 0 ? rest[index + 1] : undefined;
  };
  return { command, outDir: value("--out"), runDir: value("--run"), seed: value("--seed") };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === "prepare") prepareRun({ outDir: resolve(args.outDir ?? "benchmarks/ui-skills/runs/current"), seed: args.seed });
  else if (args.command === "summarize") summarizeRun({ runDir: resolve(args.runDir ?? "benchmarks/ui-skills/runs/current") });
  else throw new Error("usage: harness.mjs prepare --out <dir> [--seed <value>] | summarize --run <dir>");
}
