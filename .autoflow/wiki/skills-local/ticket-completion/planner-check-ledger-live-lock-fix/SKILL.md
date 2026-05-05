---
name: "planner-check-ledger-live-lock-fix"
description: "planner check ledger live-lock fix"
pattern_type: ticket_completion
applies_to:
  module: ".autoflow/scripts/start-plan.sh"
  keywords:
    - "planner"
    - "check"
    - "ledger"
    - "live"
    - "lock"
    - "fix"
    - "autoflow"
    - "scripts"
    - "start"
    - "plan"
    - "common"
    - "runtime"
pinned: false
created_from:
  prd: "prd_168"
  ticket: "tickets_167"
created_at: "2026-05-05T01:35:28Z"
---

# planner check ledger live-lock fix

## Trigger

- Reuse when: planner check ledger live-lock fix
- Source ticket: `tickets/done/prd_168/tickets_167.md`

## Recommended Procedure

- start-plan.sh 가 dirty inventory 가 **오직 `.autoflow/tickets/check/check_NNN.md` 신규 파일로만 구성된 경우** 를 감지해 `source=blocked-dirty-orchestration` 을 emit 하지 않는다.
- 동일 ticket 의 orchestration cleanup commit 이 5건 이상 누적되면 start-plan.sh 가 ticket Recovery State 를 `needs_user` 로 자동 set 하고 fixpoint guard evidence 를 출력한다 (`source=blocked-cleanup-fixpoint-exceeded`).
- 위 두 가지 변화는 `runtime/board-scripts/start-plan.sh` 와 `.autoflow/scripts/start-plan.sh` 에 대칭으로 반영된다.
- `tickets/check/` 누적 증가가 같은 blocked ticket 에 대해 자동으로 멈춤을 smoke 또는 단위 테스트로 검증한다.
- 기존 정상 blocked-dirty 케이스(다양한 dirty path 가 섞여있을 때) 는 회귀 없이 그대로 동작한다.

## Pitfalls

- Existing PRD command is stored with Markdown backticks, so `verify-ticket-owner.sh` required an explicit command override to record pass evidence; the command itself passes in both worktree and PROJECT_ROOT.

## Verification Pattern

- Command: ``bash -lc 'bash -n .autoflow/scripts/start-plan.sh runtime/board-scripts/start-plan.sh .autoflow/scripts/common.sh runtime/board-scripts/common.sh packages/cli/run-role.sh && tests/smoke/blocked-dirty-orchestration-fixpoint-smoke.sh'``

## Source Evidence

- Ticket: `tickets/done/prd_168/tickets_167.md`
- PRD: `tickets/done/prd_168/prd_168.md`
- Verification: `tickets/done/prd_168/verify_167.md`
- Result summary: planner check ledger live-lock guard
