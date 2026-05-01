---
id: memo_049
title: 칸반 좌우 컬럼 항상 노출 — PRD/발급 티켓 탭도 함께 적용
status: inbox
created: 2026-05-01
---

## Request

조금전 요청했던 사항을 정리 해서 PRD, 발급 티켓에도 적용해야함

(맥락: 직전 오더 `memo_048` 에서 "티켓 페이지 칸반 좌우 컬럼이 항목 수가 0이어도 항상 보여야 한다" 를 요청했고, 그때 예시는 Order 탭이었다. 사용자는 이번에 같은 규칙이 PRD 탭과 발급 티켓 탭에도 동일하게 적용되어야 함을 명확히 하길 원함. → 사실상 `memo_048` 의 적용 범위를 세 탭 전체로 못박는 보강 오더.)

## Notes

- 직전 오더: `.autoflow/tickets/inbox/memo_048.md`. 같은 PRD 로 묶어서 처리하는 편이 자연스러움.
- 적용 대상 탭과 기대 컬럼 (`apps/desktop/src/renderer/main.tsx:3713-3733` 의 `ticketWorkspaceTabs` / `ticketKanbanFolderMeta` / `ticketKanbanFolderOrder` 정의 기준):
  - **PRD 탭** (`key: "prd"`): 기대 컬럼 = `backlog`, `done`. 둘 다 0개라도 두 컬럼 골격을 노출하고 각각 "비어 있음" 안내만 표시.
  - **Order 탭** (`key: "inbox"`): 기대 컬럼 = `inbox`, `done`. (memo_048 의 1차 케이스)
  - **발급 티켓 탭** (`key: "issued"`): 기대 컬럼 = `todo`, `inprogress`, `done`, `reject`. 어느 컬럼이든 0개여도 컬럼이 사라지지 않아야 함.
- 핵심 변경 지점 재확인:
  1. `ticketWorkspaceKanbanColumnsForFiles` (`apps/desktop/src/renderer/main.tsx:4052-4067`) 가 "현재 탭이 다루는 기대 폴더 키" 를 union 으로 받도록 확장.
  2. `TicketWorkspaceKanbanView` (`apps/desktop/src/renderer/main.tsx:4079-4338`) 의 `items.length === 0` 단일 empty card 분기를 제거 또는 컬럼 골격 유지로 교체.
  3. 호출부(PRD/Order/발급 티켓 각 탭) 가 자기 탭의 기대 폴더 키 집합을 props 로 넘기도록 수정.
- 컬럼 폭 변수: `--ticket-kanban-column-count` (`apps/desktop/src/renderer/main.tsx:4186`). 탭별로 기대 컬럼 수가 2~4개로 다르므로 자연스러운 그리드가 유지되어야 함.
- 가능하면 한 PRD 로 세 탭에 동시에 적용해 회귀 위험을 줄이는 게 바람직. (memo_048 + memo_049 → 단일 PRD 로 합쳐 처리)

## Scope hint

- 후보 파일:
  - `apps/desktop/src/renderer/main.tsx` (`ticketWorkspaceKanbanColumnsForFiles`, `TicketWorkspaceKanbanView`, PRD/Order/발급 티켓 탭 렌더 호출부)
  - `apps/desktop/src/renderer/styles.css` (필요 시 컬럼 폭 / `.ticket-kanban-column-empty` 보정)

## Verification hint

- 세 탭(PRD / Order / 발급 티켓) 각각에서 그 탭이 다루는 컬럼 전부가 0개인 상태로 진입했을 때, 컬럼 골격이 그대로 보이고 각 컬럼에 "비어 있음" 메시지만 노출되는지 확인.
- 일부 컬럼만 0개인 혼합 상태에서도 사라진 컬럼이 없는지 확인.
- 평상시 데이터가 있는 화면에서 컬럼 수 / 폭 / 선택 동작에 회귀 없는지 확인.
- 좁은 폭(윈도우 minWidth 1040 부근) 에서도 컬럼 골격이 유지되고 그리드가 깨지지 않는지 확인.
