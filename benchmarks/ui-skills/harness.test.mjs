import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { prepareRun, summarizeRun } from "./harness.mjs";

const dimensions = [
  "intent_fidelity", "mechanism_legibility", "hierarchy", "system_coherence",
  "state_completeness", "responsive_translation", "distinctive_restraint", "truth_and_provenance"
];
const gates = [
  "loads_without_errors", "desktop_and_mobile_complete", "keyboard_path_complete", "visible_focus",
  "contrast_and_non_color_cues", "reduced_motion_path", "required_states_present", "no_blocking_overflow"
];

function fixture() {
  const runDir = mkdtempSync(join(tmpdir(), "ui-skill-bench-"));
  const run = prepareRun({ outDir: runDir, seed: "test-seed" });
  const candidates = {};
  const ratings = [];
  for (const assignment of run.assignments) {
    for (const candidate of assignment.candidates) {
      for (const path of Object.values(candidate.artifact_contract)) {
        const absolute = join(runDir, path);
        mkdirSync(join(absolute, ".."), { recursive: true });
        writeFileSync(absolute, "image-fixture");
      }
      const mechanism_checks = Object.fromEntries(assignment.brief.required_functional_checks.map((check) => {
        const artifact = `artifacts/${assignment.brief.id}/${candidate.candidate_id}-${check.id}.json`;
        const absolute = join(runDir, artifact);
        mkdirSync(join(absolute, ".."), { recursive: true });
        writeFileSync(absolute, JSON.stringify({
          check_id: check.id,
          actions: ["perform representative action"],
          visible_before: "Initial representative state",
          visible_after: "Changed representative state"
        }));
        return [check.id, {
          pass: true,
          evidence: `Visible fixture evidence verifies ${check.requirement}`,
          artifact
        }];
      }));
      candidates[candidate.candidate_id] = {
        conditions: run.conditions,
        skill_revision: "fixture-revision",
        artifacts: candidate.artifact_contract,
        gates: Object.fromEntries(gates.map((gate) => [gate, true])),
        mechanism_checks
      };
      for (const rater_id of ["rater-a", "rater-b"]) {
        ratings.push({
          rater_id,
          candidate_id: candidate.candidate_id,
          scores: Object.fromEntries(dimensions.map((dimension) => [dimension, 3])),
          evidence: Object.fromEntries(dimensions.map((dimension) => [dimension, "Specific visible evidence in both recorded viewports."]))
        });
      }
    }
  }
  writeFileSync(join(runDir, "submissions.json"), `${JSON.stringify({ candidates }, null, 2)}\n`);
  writeFileSync(join(runDir, "ratings.json"), `${JSON.stringify({ ratings }, null, 2)}\n`);
  return { runDir, run };
}

test("prepare is deterministic and hides system labels from public assignments", () => {
  const aDir = mkdtempSync(join(tmpdir(), "ui-a-"));
  const a = prepareRun({ outDir: aDir, seed: "fixed" });
  const b = prepareRun({ outDir: mkdtempSync(join(tmpdir(), "ui-b-")), seed: "fixed" });
  assert.deepEqual(a, b);
  assert.ok(a.assignments.flatMap((assignment) => assignment.candidates)
    .every((candidate) => !("system" in candidate) && /^candidate-[0-9a-f]{12}$/.test(candidate.candidate_id)));
  assert.equal(a.assignments.length, 4);
  const template = JSON.parse(readFileSync(join(aDir, "submissions.template.json"), "utf8"));
  const firstAssignment = a.assignments[0];
  const firstCandidate = firstAssignment.candidates[0].candidate_id;
  assert.deepEqual(
    Object.keys(template.candidates[firstCandidate].mechanism_checks),
    firstAssignment.brief.required_functional_checks.map((check) => check.id),
  );
  assert.ok(Object.values(template.candidates[firstCandidate].gates).every((value) => value === false));
});

test("summarize requires hard gates, two raters, evidence, and bounded language", () => {
  const { runDir, run } = fixture();
  const summary = summarizeRun({ runDir });
  assert.equal(summary.rows.length, run.assignments.length * 3);
  assert.ok(summary.rows.every((row) => row.gate_pass && row.raters === 2));
  assert.match(summary.scope_statement, /not evidence of general UI-skill superiority/i);
  assert.ok(summary.comparisons.every((comparison) => comparison.result === "tie"));
});

test("summarize rejects unequal conditions and fewer than two raters", () => {
  const unequal = fixture();
  const submissionsPath = join(unequal.runDir, "submissions.json");
  const submissions = JSON.parse(readFileSync(submissionsPath, "utf8"));
  const firstCandidate = Object.keys(submissions.candidates)[0];
  submissions.candidates[firstCandidate].conditions = { ...submissions.candidates[firstCandidate].conditions, max_turns: 99 };
  writeFileSync(submissionsPath, JSON.stringify(submissions));
  assert.throws(() => summarizeRun({ runDir: unequal.runDir }), /run conditions differ/);

  const underRated = fixture();
  const ratingsPath = join(underRated.runDir, "ratings.json");
  const ratingData = JSON.parse(readFileSync(ratingsPath, "utf8"));
  const candidate = ratingData.ratings[0].candidate_id;
  ratingData.ratings = ratingData.ratings.filter((rating) => rating.candidate_id !== candidate || rating.rater_id === "rater-a");
  writeFileSync(ratingsPath, JSON.stringify(ratingData));
  assert.throws(() => summarizeRun({ runDir: underRated.runDir }), /at least two blinded raters/);
});

test("brief-specific mechanism checks are hard gates, not taste points", () => {
  const { runDir } = fixture();
  const submissionsPath = join(runDir, "submissions.json");
  const submissions = JSON.parse(readFileSync(submissionsPath, "utf8"));
  const firstCandidate = Object.keys(submissions.candidates)[0];
  const firstCheck = Object.keys(submissions.candidates[firstCandidate].mechanism_checks)[0];
  submissions.candidates[firstCandidate].mechanism_checks[firstCheck] = {
    pass: false,
    evidence: "The supplied artifact does not expose the required interaction.",
    artifact: submissions.candidates[firstCandidate].mechanism_checks[firstCheck].artifact
  };
  writeFileSync(submissionsPath, JSON.stringify(submissions));

  const summary = summarizeRun({ runDir });
  const row = summary.rows.find((candidate) => candidate.candidate_id === firstCandidate);
  assert.equal(row.gate_pass, false);
  assert.deepEqual(row.failed_gates, [`mechanism:${firstCheck}`]);
  assert.ok(summary.comparisons
    .filter((comparison) => comparison.brief_id === row.brief_id && comparison.systems.includes(row.system))
    .every((comparison) => comparison.result === "not_compared_due_to_gate_failure"));
});

test("mechanism claims without an inspectable evidence artifact fail closed", () => {
  const { runDir } = fixture();
  const submissionsPath = join(runDir, "submissions.json");
  const submissions = JSON.parse(readFileSync(submissionsPath, "utf8"));
  const firstCandidate = Object.keys(submissions.candidates)[0];
  const firstCheck = Object.keys(submissions.candidates[firstCandidate].mechanism_checks)[0];
  submissions.candidates[firstCandidate].mechanism_checks[firstCheck].artifact = "artifacts/does-not-exist.webm";
  writeFileSync(submissionsPath, JSON.stringify(submissions));

  const summary = summarizeRun({ runDir });
  const row = summary.rows.find((candidate) => candidate.candidate_id === firstCandidate);
  assert.equal(row.gate_pass, false);
  assert.ok(row.failed_gates.includes(`mechanism:${firstCheck}`));
});

test("artifact paths cannot escape the benchmark run directory", () => {
  const { runDir } = fixture();
  const submissionsPath = join(runDir, "submissions.json");
  const submissions = JSON.parse(readFileSync(submissionsPath, "utf8"));
  const firstCandidate = Object.keys(submissions.candidates)[0];
  submissions.candidates[firstCandidate].artifacts.desktop = join(runDir, "..", "outside.png");
  writeFileSync(join(runDir, "..", "outside.png"), "not valid in-run evidence");
  writeFileSync(submissionsPath, JSON.stringify(submissions));
  assert.throws(() => summarizeRun({ runDir }), /missing desktop artifact/);
});
