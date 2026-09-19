# benchmarks/

Index of the two benchmark packs in this repo. Both are frozen packs with an
explicit claims policy — read the sub-README before citing either as
evidence of general quality.

| Pack | What it measures | Run with | CI |
|---|---|---|---|
| [`engine/`](engine/README.md) | Semantic-routing correctness of the connected adapter (mechanism/subject/proof selection), not visual quality | `npm run benchmark:engine` | Runs on every push/PR (`.github/workflows/ci.yml`) |
| [`ui-skills/`](ui-skills/README.md) | Blinded, multi-rater head-to-head of UI skills (`fixmyslop`, Impeccable, Taste, etc.) across 4 frozen briefs, 8 taste dimensions + functional mechanism gates | `node benchmarks/ui-skills/harness.mjs prepare` / `summarize` (manual, needs human builders + ≥2 human raters) | Only the harness's own unit tests run in CI (`npm run test:ui-bench`); the actual benchmark protocol is not automatable and is not run in CI |

Neither pack should be cited as a general "X is better" claim outside its own
claims-policy section — see each README for the exact allowed wording.

Related but not here: `viz/personality-test/RESULTS*.md` are informal,
unblinded, single-author dev logs from iterating the `/personality` skill —
not benchmark evidence. `ui-skills/` is the blinded harness that supersedes
those logs as evidence.
