# Connected engine benchmark

`semantic-routing.v1.json` is a frozen, mechanism-first pack for the connected adapter. It checks the failure mode that a pretty surface can still be semantically wrong: each brief must select the expected subject profile, mechanism, proof centrepiece, at least two authored alternatives, and readable display/body roles across several deterministic seeds.

Run it with:

```sh
npm run benchmark:engine
```

The output is a report, not a quality score. A failure means the adapter did not meet the brief contract and should be fixed before visual comparison. Extend the frozen pack with new subjects rather than tuning a single keyword until it passes.

## What is measured

Correctness of the connected adapter's *semantic* routing, not visual quality:
for each frozen brief and each of several deterministic seeds, whether the
adapter selected the expected subject profile, mechanism, proof centrepiece,
at least two authored alternatives, and readable display/body font roles.
This is a mechanism check, not a beauty contest — it exists to catch "pretty
but semantically wrong."

## Claims policy

A pass/fail report against the frozen `semantic-routing.v1.json` pack only.
The strongest allowed wording is "the connected adapter meets its brief
contract on this frozen pack, this run" — not a general claim about output
quality. Extend the pack with new subjects to broaden coverage rather than
tuning behavior until an existing case passes.

## CI status

Runs in CI: `.github/workflows/ci.yml`'s "Connected semantic benchmark" step
runs `npm run benchmark:engine` on every push/PR. A failure fails the build.
