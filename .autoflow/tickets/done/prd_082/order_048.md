---
id: memo_048
title: 티켓 칸반 좌우 컬럼 항상 노출
status: inbox
created: 2026-05-01
---

## Request

좌우 목록이 항상 보이게 해줘 order 목록이 0이라고

(첨부 스크린샷: 티켓 페이지 Order 탭의 칸반. 좌측 `Order tickets/inbox` 컬럼과 우측 `완료 tickets/done` 컬럼이 보이는 화면. 사용자는 inbox 의 항목 수가 0이 되어도 좌측 Order 컬럼이 사라지지 않고 항상 한 자리에 보이길 원함. 우측 완료 컬럼도 마찬가지.)

## Notes

- 위치: `apps/desktop/src/renderer/main.tsx:4052-4067` 의 `ticketWorkspaceKanbanColumnsForFiles`. 현재 컬럼은 "파일이 존재하는 폴더" 만으로 만들어짐:
  ```tsx
  const folderKeys = new Set(files.map(ticketFolderKeyFromFile).filter(Boolean));
  ```
  → inbox 폴더에 파일이 0개면 `inbox` 가 `folderKeys` 에 없어서 Order 컬럼이 통째로 사라짐.
- 추가 위치: `apps/desktop/src/renderer/main.tsx:4268-4279` 의 분기 — `items.length === 0` 이면 카드 1개짜리 empty state 만 보여 주고 좌/우 컬럼이 모두 사라짐. Order 탭에서 메모가 0개면 이 분기로 빠질 수 있음.
- 탭 → 폴더 매핑 정의: `apps/desktop/src/renderer/main.tsx:3713-3733` 의 `ticketKanbanFolderOrder` / `ticketKanbanFolderMeta` / `ticketWorkspaceTabs`.
  - PRD 탭: `backlog` + `done`
  - Order 탭: `inbox` + `done`
  - 발급 티켓 탭: `todo` + `inprogress` + `done` + `reject`
- 의도된 동작:
  - 현재 탭이 다루는 "기대 폴더" 집합을 항상 컬럼으로 노출하고, 해당 폴더에 파일이 0개이면 컬럼은 그대로 둔 채 "비어 있음" 안내(이미 `ticket-kanban-column-empty` 존재) 만 보여 준다.
  - `items.length === 0` 일 때도 단일 empty card 로 떨어뜨리지 말고, 기본 컬럼 골격은 유지.
- 가능한 처리 방향 (Plan AI 가 결정):
  1. `TicketWorkspaceKanbanView` 가 props 로 "이 탭의 기대 폴더 키 집합"을 받게 하거나, 호출부에서 탭별 기본 컬럼을 계산해 전달.
  2. `ticketWorkspaceKanbanColumnsForFiles` 가 (files, expectedFolderKeys) 를 받아 union 으로 컬럼 생성.
  3. `items.length === 0` 분기를 컬럼 골격 + empty 셀로 대체.
- 부수: 칸반 그리드 폭 변수 `--ticket-kanban-column-count` (`apps/desktop/src/renderer/main.tsx:4186`) 도 새 컬럼 수에 맞춰 자연스럽게 갱신되어야 함.

## Scope hint

- 후보 파일:
  - `apps/desktop/src/renderer/main.tsx` (`ticketWorkspaceKanbanColumnsForFiles`, `TicketWorkspaceKanbanView`, 호출부)
  - `apps/desktop/src/renderer/styles.css` (필요 시 `.ticket-kanban-column-empty` / 빈 컬럼 폭 보정)

## Verification hint

- Order 탭에서 `tickets/inbox/` 가 0개일 때도 좌측 Order 컬럼이 그대로 보이고 안에 "비어 있음" 메시지가 노출되는지 확인.
- PRD 탭에서 `tickets/backlog/` 가 0개일 때 좌측 Backlog 컬럼이 유지되는지 확인.
- 발급 티켓 탭에서 todo/inprogress/done/reject 중 일부가 0개여도 컬럼이 유지되는지 확인.
- 평소 데이터가 있는 경우의 회귀 (컬럼 수, 폭, 선택 동작) 가 깨지지 않는지 확인.
