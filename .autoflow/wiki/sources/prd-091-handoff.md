---
kind: source_summary
slug: prd-091-handoff
created: 2026-05-02T00:58:23Z
updated: 2026-05-02T00:58:23Z
raw_source: "wiki-raw/prd-091-handoff.md"
entities:
  - "Planner AI"
  - "Orchestrator"
concepts:
  - "max_retries_reached"
  - "Recovery State"
  - "Failure Class"
---

# 반려 최대 재시도 Planner 처리 PRD

## One-liner

반려 티켓 재시도 한도 도달 시 Planner AI가 이를 인지하고 복구 또는 주차 상태로 관리하도록 개선.

## Summary

반려 티켓의 최대 재시도 횟수(10회) 도달 시, 자동 재시도를 멈추는 기존 안전장치는 유지하되 Planner AI가 해당 상태를 명확히 진단하여 대응하도록 합니다. 실패한 티켓을 단순히 다시 할당하는 대신, 실패 원인을 보드에 요약 기록하고 '사용자 확인 필요(needs_user)' 상태로 주차하거나 별도의 복구 티켓을 생성하는 등의 체계적인 복구 프로세스를 구축하는 것이 핵심입니다.

## Entities

- Orchestrator (System Module): 전반적인 워크플로우를 제어하며 실패 루프를 끊고 보드 상태를 관리함.
- Planner AI (Agent): 재시도 한도 초과 상태를 진단하고 후속 조치(복구 또는 주차)를 결정하는 Planner 엔진.

## Concepts

- Failure Class: 재시도 제한 도달(retry_limit) 등 실패의 성격을 분류하여 보드에 기록하는 메타데이터.
- Recovery State: 재시도 실패 시 Planner가 설정하는 상태로, 실패 원인 분류 및 사용자 개입 필요 여부를 정의함.
- max_retries_reached: 티켓의 반려 횟수가 설정된 최대 재시도 횟수에 도달했음을 나타내는 상태 신호.

## Source

- `wiki-raw/prd-091-handoff.md`
