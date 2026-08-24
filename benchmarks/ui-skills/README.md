# UI skill benchmark

This is a reproducible head-to-head protocol for `fixmyslop`, Impeccable, Taste,
or another UI skill. It does not contain a pre-baked winner.

The frozen pack covers a technical workspace, public-service form, research
story, and creative-tool landing page. Every system gets the same brief, model,
starting commit, time/turn budget, tool/network policy, and viewports. Runs must
use clean contexts and may not inspect another system's output.

Version 1.1 adds brief-specific functional contracts and inspectable evidence
artifacts. It is deliberately stricter than a screenshot-only beauty contest.

## Run it

1. Edit the placeholder model and commit in `briefs.v1.json`, then freeze that
   file for the run.
2. Prepare opaque assignments:

   `node benchmarks/ui-skills/harness.mjs prepare --out benchmarks/ui-skills/runs/2026-08-24 --seed 20260824`

   Preparation also writes `submissions.template.json` and
   `ratings.template.json`; copy them to the non-template filenames instead of
   reconstructing the contracts by hand.

3. Give builders `assignments.json`, not `system-key.private.json`. Record each
   skill revision and dependency, produce the required desktop/mobile artifacts,
   and fill `submissions.json` with the exact shared conditions, global hard gates,
   and every brief-specific `mechanism_checks` entry. Each mechanism result is
   `{ "pass": true, "evidence": "what visibly changed and where", "artifact":
   "artifacts/..." }`. The artifact must exist and should be a short interaction
   recording or a reviewed trace containing the action plus visible before/after
   state; a plausible spec or isolated beauty screenshot is not evidence of an
   interaction. All artifact paths must resolve inside the benchmark run directory.
4. Give at least two raters only the opaque artifacts. Each 0–4 score needs
   visible evidence. Store their records in `ratings.json`.
5. Summarize and unblind:

   `node benchmarks/ui-skills/harness.mjs summarize --run benchmarks/ui-skills/runs/2026-08-24`

The harness refuses missing artifacts, changed conditions, invalid scores, weak
rating evidence, or fewer than two raters. Missing, failed, weakly evidenced, or
artifact-free brief-specific behavior is recorded as a `mechanism:<check-id>`
hard-gate failure.
A gate failure is not averaged into a taste score; that comparison remains
unscored. This prevents a polished surface from outranking a system that actually
implements the requested product.

## Claims policy

Report per-brief, per-dimension wins, ties, losses, and gate failures. The
strongest allowed wording is “observed on this frozen brief set under the
recorded conditions.” Do not turn a small, dependent sample into a universal
claim that one skill produces better UI. Add more briefs, independent raters,
and preregistered statistical analysis before making a broader claim.

`runs/` is ignored because it can contain large screenshots and the private
unblinding key. Publish a deliberately reviewed result bundle elsewhere if a
run should become a permanent benchmark snapshot.
