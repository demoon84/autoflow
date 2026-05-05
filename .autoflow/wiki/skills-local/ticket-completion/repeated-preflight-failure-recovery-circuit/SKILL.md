---
name: "repeated-preflight-failure-recovery-circuit"
description: "repeated preflight failure recovery circuit"
pattern_type: ticket_completion
applies_to:
  module: "packages/cli/run-role.sh"
  keywords:
    - "repeated"
    - "preflight"
    - "failure"
    - "recovery"
    - "circuit"
    - "packages"
    - "cli"
    - "run"
    - "role"
    - "runtime"
    - "board"
    - "scripts"
pinned: false
created_from:
  prd: "prd_180"
  ticket: "tickets_179"
created_at: "2026-05-05T00:30:16Z"
---

# repeated preflight failure recovery circuit

## Trigger

- Reuse when: repeated preflight failure recovery circuit
- Source ticket: `tickets/done/prd_180/tickets_179.md`

## Recommended Procedure

- budget/rate/prompt preflight skip 이 발생할 때 runner state 에 같은 skip result 의 연속 횟수와 마지막 skip 시각이 기록된다.
- adapter 가 정상 종료되거나 skip result 가 바뀌면 preflight skip 연속 카운터가 0 또는 새 result 기준 1로 reset 된다.
- 같은 `token_budget_exceeded` preflight skip 이 3회 연속 발생하는 임시 board smoke 에서 adapter command 는 4번째 동일 prompt retry 로 이어지지 않고 `circuit_breaker_tripped` evidence 를 남긴다.
- circuit breaker evidence 에 원인 result(`token_budget_exceeded`), count, threshold, cooldown 종료 시각 또는 다음 허용 조건이 key=value 로 남는다.
- active ticket 이 있는 상태에서 반복 preflight breaker 가 발동하면 runner state/list 또는 planner runtime output 에 `active_recovery_status=blocked`, `active_recovery_failure_class=tooling_failure`, `active_recovery_reason=repeated_preflight_skip` 또는 동등한 recovery signal 이 노출된다.

## Pitfalls

- `tickets_178` still owns stale token-cache freshness/source handling and was intentionally not implemented here.

## Verification Pattern

- Command: ``bash -lc 'bash -n packages/cli/run-role.sh runtime/board-scripts/run-role.sh packages/cli/runners-project.sh runtime/board-scripts/runners-project.sh .autoflow/scripts/start-plan.sh runtime/board-scripts/start-plan.sh && node --check apps/desktop/src/main.js && bash tests/smoke/repeated-preflight-circuit-breaker-smoke.sh && npm run desktop:check'``

## Source Evidence

- Ticket: `tickets/done/prd_180/tickets_179.md`
- PRD: `tickets/done/prd_180/prd_180.md`
- Verification: `tickets/done/prd_180/verify_179.md`
- Result summary: repeated preflight skip circuit breaker
