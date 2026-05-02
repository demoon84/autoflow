---
kind: source_summary
slug: prd-093-handoff
created: 2026-05-02T00:58:37Z
updated: 2026-05-02T00:58:37Z
raw_source: "wiki-raw/prd-093-handoff.md"
entities:
  - "Worker"
  - "Main Working Tree"
  - "Isolation Context"
concepts:
  - "Lifecycle Isolation Contract"
  - "Atomic Finalization"
  - "Recovery State"
---

# Worker 작업 생명주기 격리 (PRD-093)

## One-liner

Worker 작업 시작부터 완료까지 메인 작업 트리의 오염을 방지하기 위한 격리 환경 및 생명주기 계약 정의.

## Summary

Worker가 티켓을 할당받은 순간부터 최종 완료 처리까지 제품 코드와 보드 변경사항이 메인 작업 트리를 더럽히지 않도록 worktree 또는 branch 기반의 격리 환경을 구축하는 지침입니다. 작업 성공 시에는 원자적으로 최종 통합을 수행하고, 실패나 중단 시에도 메인 트리를 깨끗하게 유지하며 필요시 복구 정보를 기록하는 생명주기 계약을 포함합니다.

## Entities

- Isolation Context (Environment): 티켓별로 생성되는 worktree 또는 branch 기반의 독립된 작업 공간입니다.
- Main Working Tree (Environment): Worker의 중간 작업 과정에서 오염되지 않아야 하며, 오직 검증된 결과만 최종적으로 반영되는 주 작업 트리입니다.
- Worker (Role): 티켓별 구현, 검증, 보드 상태 업데이트를 수행하며 격리 환경에서 작업하는 주체입니다.

## Concepts

- Atomic Finalization: 작업 성공 시 메인 트리에 변경 반영, 커밋, 위키 갱신, 격리 환경 정리를 한 번에 수행하여 일관성을 보장하는 방식입니다.
- Lifecycle Isolation Contract: Worker 작업의 전 과정(시작, 실행, 종료)에서 격리를 보장하고 메인 트리의 상태를 관리하는 규칙입니다.
- Recovery State: 작업 종료 전 정리에 실패했을 때, 다음 작업을 막고 수동 복구를 위해 티켓에 기록되는 상태 정보입니다.

## Source

- `wiki-raw/prd-093-handoff.md`
