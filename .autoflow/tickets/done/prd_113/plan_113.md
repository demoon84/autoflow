# Plan: 로그 페이지 리스트 머리글 영역 제거

- ID: plan_113
- PRD Key: prd_113
- Title: 로그 페이지 리스트 머리글 영역 제거
- Status: ticketed
- Created By: planner
- Last Updated: 2026-05-02

## Goal

- 로그 페이지 좌측 패널 상단의 머리글 영역을 제거하여 목록이 즉시 노출되도록 한다.

## PRD References

- PRD: tickets/backlog/prd_113.md

## Reference Notes

- Project Note: [[prd_113]]

## Scope

- In Scope:
  - `apps/desktop/src/renderer/main.tsx` 에서 로그 섹션의 `log-list-heading` div 제거.
  - `apps/desktop/src/renderer/styles.css` 에서 관련 스타일 정리.
- Out of Scope:
  - 로그 목록(`LogList`) 내부 로직 변경.
  - 다른 페이지의 헤더 영역 변경.

## Execution Candidates

- [x] 로그 페이지 리스트 머리글 영역 제거 (`apps/desktop/src/renderer/main.tsx`)

## Ticket Rules

- Allowed Paths:
  - `apps/desktop/src/renderer/main.tsx`
  - `apps/desktop/src/renderer/styles.css`
- Ticket split notes: 단일 티켓으로 진행한다.

## Generated Tickets

- Todo-111.md

## Notes

- `memo_073`의 요청을 반영한다.
- `apps/desktop/src/renderer/main.tsx` 의 2044-2053 라인 부근을 수정한다.
