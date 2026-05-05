---
name: "ai-work-for-prd-167"
description: "AI work for prd_167"
pattern_type: orchestration_cleanup
applies_to:
  module: "packages/cli/runners-project.sh"
  keywords:
    - "work"
    - "for"
    - "prd"
    - "167"
    - "packages"
    - "cli"
    - "runners"
    - "project"
    - "run"
    - "role"
    - "apps"
    - "desktop"
pinned: false
created_from:
  prd: "prd_167"
  ticket: "tickets_166"
created_at: "2026-05-05T00:45:39Z"
---

# AI work for prd_167

## Trigger

- Reuse when: AI work for prd_167
- Source ticket: `tickets/inprogress/tickets_166.md`

## Recommended Procedure

- `bash bin/autoflow runners stop worker "$PWD" .autoflow` 실행 후 state 에 `stop_pending=true`, `stop_requested_at=<ISO>` 마킹되고 PID 가 살아있다.
- 다음 tick 에서 graceful 종료 → state `status=stopped`, `last_stop_reason=graceful_stop_completed`.
- `--force` 플래그는 즉시 SIGKILL + `last_stop_reason=user_force`.
- `AUTOFLOW_GRACEFUL_STOP_MAX_WAIT_SECONDS=10` 환경에서 길어진 tick 이 10s 후 SIGTERM → 30s 후 SIGKILL fallback 까지 진행 (`last_stop_reason=graceful_stop_max_wait_force`).
- 데스크톱 stop 클릭 시 버튼이 `중지 예약 중...` 으로 바뀌고 첫 토스트 "중지 예약됨" 출력, state stopped 시 두 번째 토스트 "멈춤 완료" 출력 + 버튼 `시작` 재활성.

## Pitfalls

- Allowed Paths 밖으로 확장하지 말고, 추출 실패가 finalization을 막지 않게 유지한다.

## Verification Pattern

- Command: ``npm run desktop:check``

## Source Evidence

- Ticket: `tickets/inprogress/tickets_166.md`
- PRD: `tickets/done/prd_167/prd_167.md`
- Verification: `tickets/inprogress/verify_166.md`
