---
name: "token-budget-stale-data-guard"
description: "token budget stale-data guard"
pattern_type: blocked_recovery
applies_to:
  module: "apps/desktop/src/renderer/main.tsx"
  keywords:
    - "token"
    - "budget"
    - "stale"
    - "data"
    - "guard"
    - "packages"
    - "cli"
    - "run"
    - "role"
    - "runtime"
    - "board"
    - "scripts"
pinned: false
created_from:
  prd: "prd_179"
  ticket: "tickets/done/prd_179/tickets_178.md"
created_at: "2026-05-05T13:51:53Z"
---

# token budget stale-data guard

## Trigger

- Reuse when: token budget stale-data guard
- Source ticket: `tickets/done/prd_179/tickets_178.md`

## Recommended Procedure

- `rg -n "token_budget_exceeded|TOKEN_BUDGET|token budget" packages/cli runtime/board-scripts apps/desktop/src`로 확인한 모든 budget-exceeded write path에 source/freshness 판단이 명시된다.
- stale `.autoflow/metrics/token-cache.tsv`만 존재하는 temporary board fixture에서 budget 검사 결과가 `token_budget_exceeded`가 아니며, skip/warning marker와 stale age evidence가 runner log 또는 state에 남는다.
- fresh `.autoflow/telemetry/runs.jsonl` token row가 존재하는 fixture에서는 telemetry totals가 token-cache fallback보다 우선 사용되고, budget 판정 source가 telemetry임을 확인할 수 있다.
- `AUTOFLOW_TOKEN_BUDGET_MAX_DATA_AGE_SECONDS=1`로 stale 조건을 강제한 smoke test가 exit 0으로 통과하고, stale cache만으로 worker 진행을 blocked/failed 처리하지 않는다.
- Desktop bridge가 budget skip marker를 받을 때 `lastResult` 또는 표시용 status를 `token_budget_exceeded` false failure로 노출하지 않는다.

## Pitfalls

- Allowed Paths 밖으로 확장하지 말고, 추출 실패가 finalization을 막지 않게 유지한다.

## Verification Pattern

- Command: ``bash -lc 'bash -n packages/cli/run-role.sh runtime/board-scripts/run-role.sh packages/cli/runners-project.sh packages/cli/metrics-project.sh packages/cli/telemetry-project.sh && node --check apps/desktop/src/main.js && bash tests/smoke/token-budget-stale-data-smoke.sh && npm run desktop:check'``

## Source Evidence

- Ticket: `tickets/done/prd_179/tickets_178.md`
- PRD: `tickets/done/prd_179/prd_179.md`
