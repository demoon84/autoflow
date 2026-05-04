---
kind: raw_source
slug: skill_006
original_path: ".autoflow/wiki/skills/skill_006.md"
ingested_at: 2026-05-04T00:50:21Z
updated_at: 2026-05-04T00:50:21Z
sha256: d6e876cd216b7c14e592b18b18eba55360a1c1d990231a5b7baf07724119ad1d
---

---
title: "planner differential context prompt dispatch"
pattern_type: ticket_owner_pattern
applies_to:
  - "packages/cli/run-role.sh"
  - "packages/cli/cli-common.sh"
  - "runtime/board-scripts/run-role.sh"
  - "runtime/board-scripts/start-plan.sh"
  - ".autoflow/scripts/start-plan.sh"
  - "tests/smoke/planner-differential-context-smoke.sh"
  - "packages/cli/README.md"
  - "AGENTS.md"
keywords:
  - "planner"
  - "differential"
  - "context"
  - "prompt"
  - "dispatch"
  - "packages"
  - "cli"
  - "run"
  - "role"
  - "common"
  - "runtime"
  - "board"
success_count: 0
failure_count: 0
last_used_at: ""
created_from: "tickets/done/prd_159/tickets_158.md"
created_at: "2026-05-03T13:50:39Z"
enabled: true
---

# planner differential context prompt dispatch

## Trigger

- Reuse when: planner differential context prompt dispatch
- Source ticket: `tickets/done/prd_159/tickets_158.md`

## Recommended Procedure

- `AUTOFLOW_PLANNER_DIFFERENTIAL_ENABLED=0` 또는 미설정 상태에서는 planner prompt 내용/로그/telemetry 동작이 기존과 동일하다.
- opt-in 상태의 첫 planner tick 은 전체 board context 를 전달하고 `.autoflow/runners/state/planner.differential.state` 또는 동등한 runner-scoped state 에 board manifest fingerprint 와 one-line summary 를 기록한다.
- opt-in 상태에서 board 변경이 threshold 미만이면 planner prompt 가 이전 tick summary, changed/added/removed 파일 목록, 변경된 파일 본문 또는 excerpt 를 포함하고 unchanged 파일은 path/title 수준으로만 elide 한다.
- changed file 비율이 `AUTOFLOW_PLANNER_DIFFERENTIAL_FULL_THRESHOLD_PERCENT` 이상이면 전체 board context fallback 으로 돌아가며 fallback reason 이 runner log 또는 dry-run 출력에서 관찰된다.
- planner output 이 "전체 컨텍스트 필요" marker 를 남기는 경우 다음 planner tick 1회는 전체 board context 로 fallback 한다.

## Pitfalls

- wiki query CLI 응답 지연은 differential prompt 자체와 별개로 남아 있어, 운영 telemetry로 지속 관찰이 필요하다.

## Verification Pattern

- Command: ``bash tests/smoke/planner-differential-context-smoke.sh && bash tests/smoke/runner-idle-preflight-skip-smoke.sh && npm run desktop:check``

## Source Evidence

- Ticket: `tickets/done/prd_159/tickets_158.md`
- PRD: `tickets/done/prd_159/prd_159.md`
- Verification: `tickets/done/prd_159/verify_158.md`
- Result summary: planner differential context dispatch 구현
