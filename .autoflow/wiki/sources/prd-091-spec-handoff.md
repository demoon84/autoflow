---
kind: source_summary
slug: prd-091-spec-handoff
created: 2026-05-03T23:48:39Z
updated: 2026-05-03T23:48:39Z
raw_source: "wiki-raw/prd-091-spec-handoff.md"
entities:
  - "runtime/board-scripts/common.sh"
  - ".autoflow/scripts/common.sh"
  - "runtime/board-scripts/start-plan.sh"
  - ".autoflow/scripts/start-plan.sh"
  - "packages/cli/run-role.sh"
  - "runtime/board-scripts/run-role.sh"
  - ".autoflow/agents/plan-to-ticket-agent.md"
  - "scaffold/board/agents/plan-to-ticket-agent.md"
  - ".autoflow/protocols/recovery.md"
  - "scaffold/board/protocols/recovery.md"
  - "tests/smoke/ticket-owner-replan-smoke.sh"
  - "신규 또는 보강 smoke test 파일"
  - "runtime/board-scripts/common.sh"
  - ".autoflow/scripts/common.sh"
  - "runtime/board-scripts/start-plan.sh"
  - ".autoflow/scripts/start-plan.sh"
  - "packages/cli/run-role.sh"
  - "runtime/board-scripts/run-role.sh"
  - ".autoflow/agents/plan-to-ticket-agent.md"
  - "scaffold/board/agents/plan-to-ticket-agent.md"
  - ".autoflow/protocols/recovery.md"
  - "scaffold/board/protocols/recovery.md"
  - "tests/smoke/ticket-owner-replan-smoke.sh"
  - "신규 또는 보강 smoke test 파일"
concepts:
  - "반려 최대 재시도 Planner 처리"
  - "AUTOFLOW_REJECT_MAX_RETRIES"
  - "max_retries_reached"
  - "Planner AI Planner"
  - "Recovery State"
  - "Failure Class"
  - "needs_user"
  - "board-only 복구"
  - "반려 최대 재시도 Planner 처리"
  - "AUTOFLOW_REJECT_MAX_RETRIES"
  - "max_retries_reached"
  - "Planner AI Planner"
  - "Recovery State"
  - "Failure Class"
  - "needs_user"
  - "board-only 복구"
---

# 반려 최대 재시도 Planner 처리

## One-liner

반려 티켓이 최대 재시도 횟수에 도달했을 때 Planner AI Planner가 해당 상태를 명확한 복구/주차 상태로 처리하도록 하는 것이 목표입니다.

## Summary

이 PRD는 반려된 티켓이 자동 재시도 최대 횟수(10회)에 도달했을 때 기존의 안전장치를 유지하면서 Planner AI Planner가 이를 명확한 복구/주차 상태로 처리하도록 하는 것을 목표로 합니다. 최대 재시도 횟수 초과 후에는 같은 티켓을 다시 todo로 보내지 않고, 실패 원인을 보드에 기록하며, 필요한 경우 별도의 복구 티켓으로 전환할 수 있도록 합니다. 이는 `max_retries_reached` 상태를 recovery signal로 노출하고, Planner AI가 이를 진단하여 `Recovery State` 및 `Failure Class`를 기록하도록 계약을 추가하는 것을 포함합니다.

## Entities

- packages/cli/run-role.sh (File)
- runtime/board-scripts/common.sh (File)
- runtime/board-scripts/run-role.sh (File)
- runtime/board-scripts/start-plan.sh (File)
- scaffold/board/agents/plan-to-ticket-agent.md (Agent File)
- scaffold/board/protocols/recovery.md (Protocol File)
- tests/smoke/ticket-owner-replan-smoke.sh (Test File)
- .autoflow/agents/plan-to-ticket-agent.md (Agent File)
- .autoflow/protocols/recovery.md (Protocol File)
- .autoflow/scripts/common.sh (File)
- .autoflow/scripts/start-plan.sh (File)
- 신규 또는 보강 smoke test 파일 (Test File)

## Concepts

- AUTOFLOW_REJECT_MAX_RETRIES: 최대 재시도 횟수, 기본값 10
- Failure Class: 실패 분류
- Planner AI Planner: 재시도 초과 상태를 처리하는 AI
- Recovery State: 복구 상태
- board-only 복구: 보드 내에서만 가능한 복구
- max_retries_reached: 재시도 횟수 초과 상태
- needs_user: 사용자 개입 필요 상태
- 반려 최대 재시도 Planner 처리: 프로젝트 목표

## Source

- `wiki-raw/prd-091-spec-handoff.md`
