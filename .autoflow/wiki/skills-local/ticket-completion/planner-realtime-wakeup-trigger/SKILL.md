---
name: "planner-realtime-wakeup-trigger"
description: "Use when Planner realtime wakeup trigger"
version: "1.0"
author: "autoflow-agent"
license: "CC-BY-4.0"
pattern_type: ticket_completion
applies_to:
  module: "packages/cli/runners-project.sh"
  keywords:
    - "planner"
    - "realtime"
    - "wakeup"
    - "trigger"
    - "packages"
    - "cli"
    - "runners"
    - "project"
    - "tests"
    - "smoke"
    - "agents"
pinned: false
created_from:
  prd: "prd_175"
  ticket: "tickets_174"
created_at: "2026-05-04T22:24:10Z"
metadata:
  hermes:
    tags: []
    related_skills: []
---

# Planner realtime wakeup trigger

## Trigger

- Reuse when: Planner realtime wakeup trigger
- Source ticket: `tickets/done/prd_175/tickets_174.md`

## Recommended Procedure

- `AUTOFLOW_PLANNER_REALTIME_ENABLED=1` 상태에서 `.autoflow/tickets/inbox/order_*.md`가 추가되면 planner loop sleep 이 기존 interval 만료 전 조기 종료된다.
- `.autoflow/tickets/backlog/prd_*.md` 추가와 `.autoflow/tickets/reject/reject_*.md` 추가도 같은 wakeup 경로를 사용한다.
- 짧은 시간에 여러 감시 대상 파일이 추가되어도 trigger marker 는 1개 pending 으로 병합되고 planner adapter 가 동시에 2개 이상 실행되지 않는다.
- trigger 로 깨어났지만 입력 manifest hash 가 직전과 같으면 state/log 에 `planner_inputs_unchanged` 또는 기존 idle skip 결과가 남고 adapter LLM 호출은 생략된다.
- `AUTOFLOW_PLANNER_REALTIME_ENABLED=0` 또는 unset 상태에서는 기존 interval / backoff 동작이 유지된다.

## Pitfalls

- 실제 장시간 운영에서 OS별 파일 생성 타이밍과 planner adapter 처리량은 runner log의 `planner_realtime_wakeup` / `planner_inputs_unchanged` 비율로 추가 관찰하면 좋다.

## Verification Pattern

- Command: ``bash tests/smoke/planner-realtime-wakeup-smoke.sh && bash tests/smoke/runner-tick-backoff-smoke.sh && npm run desktop:check``

## Source Evidence

- Ticket: `tickets/done/prd_175/tickets_174.md`
- PRD: `tickets/done/prd_175/prd_175.md`
- Verification: `tickets/done/prd_175/verify_174.md`
- Result summary: planner realtime wakeup trigger with polling fallback
