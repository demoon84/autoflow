---
kind: source_summary
slug: prd-093-spec-handoff
created: 2026-05-03T23:48:39Z
updated: 2026-05-03T23:48:39Z
raw_source: "wiki-raw/prd-093-spec-handoff.md"
entities:
  - "project_093"
  - "runtime/board-scripts/start-ticket-owner.sh"
  - ".autoflow/scripts/start-ticket-owner.sh"
  - "runtime/board-scripts/finish-ticket-owner.sh"
  - ".autoflow/scripts/finish-ticket-owner.sh"
  - "runtime/board-scripts/merge-ready-ticket.sh"
  - ".autoflow/scripts/merge-ready-ticket.sh"
  - "runtime/board-scripts/common.sh"
  - ".autoflow/scripts/common.sh"
  - "runtime/board-scripts/update-wiki.sh"
  - ".autoflow/scripts/update-wiki.sh"
  - ".autoflow/agents/ticket-owner-agent.md"
  - "scaffold/board/agents/ticket-owner-agent.md"
  - "dogfood-board/agents/ticket-owner-agent.md"
  - ".autoflow/reference/tickets-board.md"
  - "scaffold/board/reference/tickets-board.md"
  - ".autoflow/automations/README.md"
  - "scaffold/board/automations/README.md"
  - "tests/smoke/ticket-owner-*.sh"
  - "tests/smoke/worker-*.sh"
  - "project_093"
  - "runtime/board-scripts/start-ticket-owner.sh"
  - ".autoflow/scripts/start-ticket-owner.sh"
  - "runtime/board-scripts/finish-ticket-owner.sh"
  - ".autoflow/scripts/finish-ticket-owner.sh"
  - "runtime/board-scripts/merge-ready-ticket.sh"
  - ".autoflow/scripts/merge-ready-ticket.sh"
  - "runtime/board-scripts/common.sh"
  - ".autoflow/scripts/common.sh"
  - "runtime/board-scripts/update-wiki.sh"
  - ".autoflow/scripts/update-wiki.sh"
  - ".autoflow/agents/ticket-owner-agent.md"
  - "scaffold/board/agents/ticket-owner-agent.md"
  - "dogfood-board/agents/ticket-owner-agent.md"
  - ".autoflow/reference/tickets-board.md"
  - "scaffold/board/reference/tickets-board.md"
  - ".autoflow/automations/README.md"
  - "scaffold/board/automations/README.md"
  - "tests/smoke/ticket-owner-*.sh"
  - "tests/smoke/worker-*.sh"
concepts:
  - "작업 생명주기 격리"
  - "worktree"
  - "integration branch/worktree"
  - "atomic 통합"
  - "main dirty"
  - "determininstic wiki 갱신"
  - "작업 생명주기 격리"
  - "worktree"
  - "integration branch/worktree"
  - "atomic 통합"
  - "main dirty"
  - "determininstic wiki 갱신"
---

# PRD Handoff

## One-liner

Worker 작업 생명주기 격리를 통해 main working tree 오염을 방지하는 PRD 핸드오프 문서.

## Summary

이 문서는 Worker가 티켓 작업을 수행하는 동안 main working tree를 오염시키지 않도록 작업 생명주기를 격리하는 방법을 다룹니다. Worker는 티켓별 격리 환경에서 개발, 검증, 보드 갱신, 최종화 준비를 진행하며, 검증된 결과는 명시적인 통합 지점에서만 main에 반영됩니다. 주요 내용은 격리 구조 설계, main 변경 유형 분류, 격리 모델 결정, atomic 최종 통합, 실패 시 main 복구, 그리고 기존 보드 원칙과의 조화입니다.

## Entities

- dogfood-board/agents/ticket-owner-agent.md (에이전트 정의): 도그푸드 보드의 티켓 소유자 에이전트 정의
- project_093 (프로젝트): Worker 작업 생명주기 격리 프로젝트
- runtime/board-scripts/common.sh (스크립트): 공통 스크립트
- runtime/board-scripts/finish-ticket-owner.sh (스크립트): 티켓 소유자 완료 스크립트
- runtime/board-scripts/merge-ready-ticket.sh (스크립트): 병합 준비 티켓 스크립트
- runtime/board-scripts/start-ticket-owner.sh (스크립트): 티켓 소유자 시작 스크립트
- runtime/board-scripts/update-wiki.sh (스크립트): 위키 업데이트 스크립트
- scaffold/board/agents/ticket-owner-agent.md (에이전트 정의): 티켓 소유자 에이전트 스캐폴드 정의
- scaffold/board/automations/README.md (문서): 자동화 스캐폴드 README 문서
- scaffold/board/reference/tickets-board.md (참조 문서): 티켓 보드 스캐폴드 참조 문서
- tests/smoke/ticket-owner-*.sh (테스트 스크립트): 티켓 소유자 스모크 테스트
- tests/smoke/worker-*.sh (테스트 스크립트): 워커 스모크 테스트
- .autoflow/agents/ticket-owner-agent.md (에이전트 정의): 티켓 소유자 에이전트 정의
- .autoflow/automations/README.md (문서): 자동화 README 문서
- .autoflow/reference/tickets-board.md (참조 문서): 티켓 보드 참조 문서
- .autoflow/scripts/common.sh (스크립트): 공통 스크립트
- .autoflow/scripts/finish-ticket-owner.sh (스크립트): 티켓 소유자 완료 스크립트
- .autoflow/scripts/merge-ready-ticket.sh (스크립트): 병합 준비 티켓 스크립트
- .autoflow/scripts/start-ticket-owner.sh (스크립트): 티켓 소유자 시작 스크립트
- .autoflow/scripts/update-wiki.sh (스크립트): 위키 업데이트 스크립트

## Concepts

- atomic 통합: 성공적인 최종화 단계에서 모든 변경 사항이 한 번에 반영되고 정리되는 과정
- determininstic wiki 갱신: 예측 가능한 방식으로 위키를 업데이트하는 과정
- integration branch/worktree: main 브랜치에 통합하기 위한 중간 브랜치 또는 작업 트리
- main dirty: Worker 작업으로 인해 main working tree에 커밋되지 않은 변경 사항이 남아있는 상태
- worktree: Git의 독립적인 작업 디렉토리
- 작업 생명주기 격리: Worker가 main working tree를 오염시키지 않도록 작업 환경을 분리하는 개념

## Source

- `wiki-raw/prd-093-spec-handoff.md`
