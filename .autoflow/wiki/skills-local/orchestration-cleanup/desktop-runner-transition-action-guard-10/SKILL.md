---
name: "desktop-runner-transition-action-guard-10"
description: "desktop runner transition action guard"
pattern_type: orchestration_cleanup
applies_to:
  module: "apps/desktop/src/renderer/main.tsx"
  keywords:
    - "desktop"
    - "runner"
    - "transition"
    - "action"
    - "guard"
    - "apps"
    - "src"
    - "renderer"
    - "main"
    - "tsx"
    - "styles"
    - "css"
pinned: false
created_from:
  prd: "prd_192"
  ticket: "tickets_191"
created_at: "2026-05-05T22:26:32Z"
---

# desktop runner transition action guard

## Trigger

- Reuse when: desktop runner transition action guard
- Source ticket: `tickets/inprogress/tickets_191.md`

## Recommended Procedure

- Start 클릭 후 IPC 응답이 먼저 도착해도 해당 runner 의 control buttons remain disabled until observed runner state has `status=running`.
- Graceful stop 클릭 후 `stop_pending=true` 또는 equivalent pending evidence 가 관찰되는 동안 stop UI shows `중지 예약 중...` with a spinner, and normal start/restart/config/run/dry-run actions for that runner remain disabled until `status=stopped`.
- Graceful stop pending 중 force stop 경로는 확인 다이얼로그를 통해서만 활성화되고, force 선택 후 UI shows `강제 종료 중...` until `status=stopped`.
- Restart 클릭 후 action state remains active through the stop and subsequent start phases, and clears only after the final target state is observed.
- Transition state is tracked per runner id: one runner in `"starting"` or `"stopping_pending"` does not disable controls for another runner.

## Pitfalls

- Allowed Paths 밖으로 확장하지 말고, 추출 실패가 finalization을 막지 않게 유지한다.

## Verification Pattern

- Command: ``npm run desktop:check``

## Source Evidence

- Ticket: `tickets/inprogress/tickets_191.md`
- PRD: `tickets/done/prd_192/prd_192.md`
- Verification: `tickets/inprogress/verify_191.md`
