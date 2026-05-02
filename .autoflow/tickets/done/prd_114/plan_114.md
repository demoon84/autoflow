# Plan: 작업 흐름 핀 레이어 목록 정렬 깨짐 수정

- ID: plan_114
- PRD Key: prd_114
- Title: 작업 흐름 핀 레이어 목록 정렬 깨짐 수정
- Status: ticketed
- Created By: planner
- Last Updated: 2026-05-02

## Goal

- 핀 레이어 목록의 그리드 정렬 수정 및 중복 메모 제거.

## PRD References

- PRD: tickets/backlog/prd_114.md

## Reference Notes

- Project Note: [[prd_114]]

## Scope

- In Scope:
  - `.workflow-pin-item` CSS 그리드 수정.
  - `WorkflowPinLayer` 렌더 시 빈 슬롯 보존.
  - `memoFiles` 중복 제거 로직 추가.
- Out of Scope:
  - `autoflow memo create` 명령의 번호 계산 로직 변경 (별도 PRD 대상).

## Execution Candidates

- [x] 핀 레이어 목록 그리드 정렬 수정 (`apps/desktop/src/renderer/styles.css`, `main.tsx`)
- [x] 핀 레이어 메모 목록 중복 제거 (`apps/desktop/src/renderer/main.tsx`)

## Ticket Rules

- Allowed Paths:
  - `apps/desktop/src/renderer/main.tsx`
  - `apps/desktop/src/renderer/styles.css`
- Ticket split notes: 단일 티켓 또는 두 개의 티켓으로 분할 가능. 여기서는 시각적 깨짐 수정과 중복 제거를 각각 별도 티켓으로 분할한다.

## Generated Tickets

- tickets_112.md
- tickets_113.md

## Notes

- `memo_074`의 요청을 반영한다.
