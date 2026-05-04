---
name: "token-telemetry-regression-recovery"
description: "token telemetry regression recovery"
pattern_type: ticket_completion
applies_to:
  module: "packages/cli/run-role.sh"
  keywords:
    - "token"
    - "telemetry"
    - "regression"
    - "recovery"
    - "packages"
    - "cli"
    - "run"
    - "role"
    - "runtime"
    - "board"
    - "scripts"
    - "project"
pinned: false
created_from:
  prd: "prd_177"
  ticket: "tickets_176"
created_at: "2026-05-04T22:32:20Z"
---

# token telemetry regression recovery

## Trigger

- Reuse when: token telemetry regression recovery
- Source ticket: `tickets/done/prd_177/tickets_176.md`

## Recommended Procedure

- A fixture adapter completion through `run_role_record_worker_tick_telemetry` records a JSONL row under `.autoflow/telemetry/runs.jsonl` with `runner_id`, `result`, `token_input`, and `token_output`, and `token_input + token_output > 0` for a prompt/stdout fixture with no explicit token marker. Evidence: `tests/smoke/metrics-token-usage-smoke.sh` runs `packages/cli/run-role.sh ticket <tmp> .autoflow --runner worker` with a fixture command and asserts the fresh worker success row has positive `token_input` and `token_output`.
- `packages/cli/telemetry-project.sh --project-root <tmp> token-usage --runner worker` returns a positive token total after the fixture row is recorded. Evidence: smoke test asserts `^token_usage=[1-9][0-9]*$`.
- `packages/cli/metrics-project.sh <tmp> .autoflow` prints `autoflow_token_usage_count=<positive integer>` and `autoflow_token_report_count=<positive integer>` from `.autoflow/telemetry/runs.jsonl`. Evidence: smoke test clears metrics cache after the fixture row and asserts both metrics are positive.
- Desktop aggregation in `apps/desktop/src/main.js` prefers fresh `.autoflow/telemetry/runs.jsonl` totals over stale `metrics/token-cache.tsv`, while still adding current `_live_stdout.log` token values for active adapters. Evidence: inspected `readRunnerTokenUsage` keeps telemetry totals primary, only fills missing runners from `metrics/token-cache.tsv`, and adds `aggregateLiveTokenUsage` totals afterward; `node --check apps/desktop/src/main.js` and `npm run desktop:check` passed.
- `tests/smoke/metrics-token-usage-smoke.sh` covers the regression with a temporary board: stale/empty token-cache plus fresh telemetry rows must produce positive metrics output and not depend on `.autoflow/metrics/telemetry-runs.jsonl`. Evidence: smoke test writes stale `metrics/token-cache.tsv` and stale `.autoflow/metrics/telemetry-runs.jsonl`, then rejects output containing the legacy total while requiring positive fresh telemetry metrics.

## Pitfalls

- Desktop aggregation behavior was verified by code inspection and `desktop:check`; no browser UI run was required for this non-visual regression.

## Verification Pattern

- Command: ``bash -lc 'bash -n packages/cli/run-role.sh runtime/board-scripts/run-role.sh packages/cli/telemetry-project.sh packages/cli/metrics-project.sh && node --check apps/desktop/src/main.js && bash tests/smoke/metrics-token-usage-smoke.sh && npm run desktop:check && packages/cli/metrics-project.sh "$PWD" .autoflow | rg "autoflow_token_usage_count|autoflow_token_report_count"'``

## Source Evidence

- Ticket: `tickets/done/prd_177/tickets_176.md`
- PRD: `tickets/done/prd_177/prd_177.md`
- Verification: `tickets/done/prd_177/verify_176.md`
- Result summary: telemetry token regression smoke coverage added
