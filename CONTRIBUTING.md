# Contributing

Read [`AGENTS.md`](AGENTS.md) first — it has the repo map and the rules that bite.

## Setup

Node 20+ and Python 3.11+.

```bash
npm ci
npm test && npm run typecheck && npm run build && npm run test:web
npm run benchmark:engine
python -m pip install pytest && python -m pytest -q
node scripts/check-repo-hygiene.mjs
```

All of these run in CI on every push and pull request.

## Conventions

- **Tests live next to code.** `apps/*`, `benchmarks/*` → `node:test` (`*.test.mjs`).
  `packages/*` → vitest (`*.test.ts`). Python → `tests/`. Don't run vitest against `apps/`.
- **Every heuristic gets a regression test** naming the input that motivated it
  (see `packages/crawl` and `apps/engine` for the style).
- **Engine determinism is a contract.** If an engine change alters output for an existing
  input + seed, say so in the PR and update the frozen benchmark pack deliberately.
- **Generated files are never hand-edited** — see the list in `AGENTS.md`.
- **Comments explain why**, usually by citing the case that forced the decision.
- Formatting: 2-space indent, LF, UTF-8 (`.editorconfig`). There is no linter yet; match
  the surrounding code.
- Commits: imperative subject, one logical change. Branch off `main`.

## What not to commit

Corpora, crawl output, screenshots, recordings, cookies, `.env`, anything under `data/`
that is not already allow-listed in `.gitignore`. Large binaries that slip into a commit
stay in `.git` until pruned — check `git status` before `git add -A`.

## Changes and releases

User-visible changes go in [`CHANGELOG.md`](CHANGELOG.md). Deployment: `apps/DEPLOY.md`.
