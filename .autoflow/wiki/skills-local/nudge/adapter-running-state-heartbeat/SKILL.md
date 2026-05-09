---
name: "adapter-running-state-heartbeat"
description: "Use when adapter-running state heartbeat"
version: "1.0"
author: "autoflow-agent"
license: "CC-BY-4.0"
pattern_type: skill_nudge
applies_to:
  module: "packages/cli/run-role.sh"
  keywords:
    - "adapter"
    - "running"
    - "state"
    - "heartbeat"
    - "packages"
    - "cli"
    - "run"
    - "role"
    - "runners"
    - "project"
    - "runtime"
    - "board"
pinned: false
created_from:
  prd: "prd_178"
  ticket: "tickets_177"
created_at: "2026-05-04T22:44:50Z"
metadata:
  hermes:
    tags: []
    related_skills: []
---

# adapter-running state heartbeat

## Trigger

- Reuse when: adapter-running state heartbeat
- Source ticket: `tickets/done/prd_178/tickets_177.md`

## Recommended Procedure

- fake adapter 를 5초 이상 실행하고 heartbeat interval 을 1초로 낮춘 smoke test 에서 `.autoflow/runners/state/<runner>.state` 의 `last_event_at` 이 adapter 호출 시작 시각에 고정되지 않고 호출 중 2회 이상 증가한다.
- 같은 smoke test 에서 adapter 호출 중 state 에 `active_stage=adapter_running` 이 관찰되고, adapter 종료 후 tick finish state 가 기존 result/stage 계약을 유지한다.
- adapter stdout/stderr 에 새 output 이 기록되는 동안 `last_adapter_chunk_at` 이 존재하고 ISO8601 timestamp 로 갱신된다. chunk 관찰이 불가능한 adapter path 는 그 이유를 test note 또는 code comment 로 남기고 `last_event_at` heartbeat 로 freshness 를 보장한다.
- heartbeat state write 이후에도 `active_item`, `active_ticket_id`, `active_ticket_title`, `active_spec_ref`, `last_runtime_log`, `last_prompt_log`, `last_stdout_log`, `last_stderr_log` 중 기존에 값이 있던 필드는 사라지지 않는다.
- `bin/autoflow runners list "$PWD" .autoflow` 또는 동등한 list path 가 `runner.N.last_adapter_chunk_at=` 을 출력한다.

## Pitfalls

- Allowed Paths 밖으로 확장하지 말고, 추출 실패가 finalization을 막지 않게 유지한다.

## Verification Pattern

- Command: ``bash -lc 'bash -n packages/cli/run-role.sh packages/cli/runners-project.sh runtime/board-scripts/run-role.sh runtime/board-scripts/runners-project.sh && node --check apps/desktop/src/main.js && bash tests/smoke/runner-adapter-heartbeat-smoke.sh && tmp="$(mktemp)"; awk "/^run_with_timeout\\(\\)/,/^}/ { print }" packages/cli/run-role.sh > "$tmp"; . "$tmp"; rm -f "$tmp"; output="$(printf "data\\n" | run_with_timeout 5 1 cat -)"; [ "$output" = data ]; set +e; run_with_timeout 1 1 bash -c "sleep 5"; rc=$?; set -e; [ "$rc" -eq 124 ]; npm run desktop:check'``

## Source Evidence

- Ticket: `tickets/done/prd_178/tickets_177.md`
- PRD: `tickets/done/prd_178/prd_178.md`
- Verification: `tickets/done/prd_178/verify_177.md`
