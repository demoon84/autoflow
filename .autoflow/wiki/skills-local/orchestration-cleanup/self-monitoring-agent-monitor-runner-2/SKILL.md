---
name: "self-monitoring-agent-monitor-runner-2"
description: "Self-monitoring agent 도입과 monitor runner 표준화"
pattern_type: orchestration_cleanup
applies_to:
  module: "packages/cli/run-role.sh"
  keywords:
    - "self"
    - "monitoring"
    - "agent"
    - "monitor"
    - "runner"
    - "packages"
    - "cli"
    - "run"
    - "role"
    - "runtime"
    - "board"
    - "scripts"
pinned: false
created_from:
  prd: "prd_185"
  ticket: "tickets_184"
created_at: "2026-05-06T00:01:03Z"
---

# Self-monitoring agent 도입과 monitor runner 표준화

## Trigger

- Reuse when: Self-monitoring agent 도입과 monitor runner 표준화
- Source ticket: `tickets/inprogress/tickets_184.md`

## Recommended Procedure

- `autoflow run monitor <project-root> .autoflow --runner monitor --dry-run` 또는 동등한 monitor role dry-run 이 `status=ok`, `role=monitor`, `runtime_role=monitor`, `runtime_script=start-monitor.sh` 를 출력하며 unknown role 로 실패하지 않는다.
- `bash bin/autoflow monitor scan "$PWD" .autoflow` 가 runner state, board queue, telemetry/metrics, dirty root, needs_user 신호를 읽고 `signal_count=`, `signal.<n>.type=`, `signal.<n>.severity=`, `signal.<n>.confidence=`, `order_created=` 또는 `duplicate_suppressed=` key=value 를 출력한다.
- Temp board smoke 에서 같은 `last_result` 3회 반복 fixture 를 넣으면 `priority: high` 또는 `critical`, `source: autoflow-monitor-agent`, fingerprint evidence, suggested next action 을 포함한 `tickets/inbox/order_NNN.md` 가 1건 생성된다.
- 같은 fixture 를 cooldown 안에서 두 번 실행하면 두 번째 tick 은 새 order 를 만들지 않고 같은 fingerprint 의 duplicate suppression evidence 를 남긴다.
- Telemetry/token-cache 불일치 fixture 에서 source A/B 값과 비율을 order 본문에 기록하고 `confidence=confirmed` 로 분류한다.

## Pitfalls

- Allowed Paths 밖으로 확장하지 말고, 추출 실패가 finalization을 막지 않게 유지한다.

## Verification Pattern

- Command: ``bash -lc 'bash -n packages/cli/run-role.sh runtime/board-scripts/run-role.sh packages/cli/monitor-project.sh .autoflow/scripts/start-monitor.sh runtime/board-scripts/start-monitor.sh packages/cli/runners-project.sh runtime/board-scripts/runners-project.sh packages/cli/doctor-project.sh && bash tests/smoke/monitor-agent-smoke.sh && npm --prefix apps/desktop run check'``

## Source Evidence

- Ticket: `tickets/inprogress/tickets_184.md`
- PRD: `tickets/done/prd_185/prd_185.md`
- Verification: `tickets/inprogress/verify_184.md`
