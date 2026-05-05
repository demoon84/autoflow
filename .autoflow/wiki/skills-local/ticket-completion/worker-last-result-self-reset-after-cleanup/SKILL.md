---
name: "worker-last-result-self-reset-after-cleanup"
description: "worker last_result self-reset after cleanup"
pattern_type: ticket_completion
applies_to:
  module: "packages/cli/run-role.sh"
  keywords:
    - "worker"
    - "last"
    - "result"
    - "self"
    - "reset"
    - "after"
    - "cleanup"
    - "packages"
    - "cli"
    - "run"
    - "role"
    - "autoflow"
pinned: false
created_from:
  prd: "prd_169"
  ticket: "tickets_168"
created_at: "2026-05-05T01:43:00Z"
---

# worker last_result self-reset after cleanup

## Trigger

- Reuse when: worker last_result self-reset after cleanup
- Source ticket: `tickets/done/prd_169/tickets_168.md`

## Recommended Procedure

- `packages/cli/run-role.sh` 의 worker(`ticket`) tick 진입부가 `worker.state` 의 `last_result=ticket_stage_blocked` 이면서 active ticket Allowed Paths 가 dirty 가 아니면 `last_result` 를 빈 값(또는 `idle`) 으로 reset 한다.
- `.autoflow/scripts/start-plan.sh` 와 `runtime/board-scripts/start-plan.sh` 의 blocked-dirty orchestration cleanup 이 마지막 cleanup commit 직후 또는 `blocked-auto-recover` 직전 단계에서 `worker.state` 의 stale `last_result=ticket_stage_blocked` 를 명시적으로 비운다.
- 두 동작 모두 sidecar(`.autoflow/scripts/*`) 와 install template(`runtime/board-scripts/*`) 에 대칭으로 반영된다.
- 위 변화는 다른 last_result 값(`adapter_timeout`, `adapter_timeout_fallback` 등) 또는 다른 worker state 필드(active ticket, runner_status 등) 를 변경하지 않는다.
- 단위 또는 smoke 테스트로 cleanup 직후 1 tick 안에 `last_result` 가 `ticket_stage_blocked` 가 아님을 검증한다.

## Pitfalls

- low; reset is intentionally limited to exact `last_result=ticket_stage_blocked` and does not handle other sticky result values by design.

## Verification Pattern

- Command: ```bash -lc 'bash -n packages/cli/run-role.sh .autoflow/scripts/start-plan.sh runtime/board-scripts/start-plan.sh .autoflow/scripts/common.sh runtime/board-scripts/common.sh && grep -E "^last_result=" .autoflow/runners/state/worker.state | grep -v "ticket_stage_blocked"'```

## Source Evidence

- Ticket: `tickets/done/prd_169/tickets_168.md`
- PRD: `tickets/done/prd_169/prd_169.md`
- Verification: `tickets/done/prd_169/verify_168.md`
- Result summary: worker stale blocked last_result reset
