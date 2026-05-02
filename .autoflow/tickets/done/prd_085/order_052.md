---
id: memo_052
title: TODO 핀 카드 카운트를 미처리/총발행으로 표시
status: inbox
created: 2026-05-01
---

## Request

작업 todo (미처리/발행된 총갯수) 가 나와야함

(첨부 스크린샷: 작업 흐름 핀 영역의 `TODO (14/14)` 카드. 분자/분모가 똑같이 14/14 로 늘 같은 값만 표시되고 있음. 사용자는 분자가 "미처리(아직 todo 상태)" 분모가 "발행된 총갯수(전체 발행 티켓 수)" 가 되길 원함. 옆 카드인 ORDER, PRD 처럼 "현재 대기 / 전체 누계" 패턴.)

## Notes

- 위치: `apps/desktop/src/renderer/main.tsx:4885-4911` 의 핀 영역.
  - 현재 `todoFiles` 는 `board.tickets.todo` 만 포함:
    ```tsx
    const todoTickets = (board?.tickets.todo || []).filter(isTicketBoardFile).map(...);
    const todoFiles: WorkflowFileEntry[] = todoTickets.sort(...);
    const todoPinTitle = `TODO (${todoFiles.length}/${todoFiles.length})`;
    ```
  - 비교용 ORDER / PRD 핀:
    ```tsx
    const prdPinTitle  = `PRD (${backlogSpecs.length}/${specFiles.length})`;       // backlog / (backlog + done)
    const memoPinTitle = `ORDER (${inboxMemos.length}/${memoFiles.length})`;       // inbox  / (inbox  + done)
    ```
- 의도된 동작:
  - 분자(미처리): `board.tickets.todo` 안의 ticket 파일 수 (현재 todoTickets.length).
  - 분모(발행된 총갯수): 발행된 모든 ticket 의 누계. 정의 후보 (Plan AI 가 결정):
    1. `todo + inprogress + done + reject` 의 ticket 파일 수 (현재 보드 스냅샷에 남아 있는 모든 ticket).
    2. `todo + inprogress` 만 (활성 작업의 진행률 강조).
    3. `메트릭` 또는 외부 카운터 사용.
  - 이전 카드들이 "특정 폴더 / (그 폴더 + done) " 패턴을 쓰는 것을 보면, 가장 자연스러운 정의는 후보 1.
- 핀 카드 클릭 시 펼쳐지는 레이어(`WorkflowPinLayer`) 가 `files` 로 받는 목록도 함께 검토해야 함 — 분모를 늘리면 본문 목록도 같이 확장될지, 또는 본문은 todo 만 유지할지(스크린샷의 의도) 를 명확히. 사용자는 카운트만 의도한 것으로 보이니 본문은 그대로(`tickets/todo`) 유지하고 카운트 표시만 미처리/총발행으로 바꾸는 쪽이 무난.
- 동시에 신경 쓸 곳:
  - `apps/desktop/src/renderer/main.tsx:4912` `hasWorkflowPins` 조건은 `todoFiles.length` 만 보고 있어서 todo 가 0이고 inprogress/done/reject 만 있는 경우 핀이 안 떠 버릴 수 있음. 분자/분모 정의를 바꾸면 이 조건도 같이 검토.
  - `WorkflowPinLayer` 내부에 동일한 카운트 표기가 또 있으면 (`pinTitle` 그대로 쓰는 듯) 한 번에 따라간다.

## Scope hint

- 후보 파일:
  - `apps/desktop/src/renderer/main.tsx` (TicketBoard 헤더 영역 핀 카운트 계산)

## Verification hint

- 데스크톱 앱 진행 화면 상단의 TODO 핀 카드 카운트가 `(미처리/총발행)` 형식으로 보이는지 확인. 예: todo 폴더에 14개, inprogress 3, done 200, reject 5 라면 표기는 `TODO (14/222)` 등.
- todo 가 0이고 다른 폴더에만 데이터가 있을 때도 핀이 사라지지 않는지(또는 의도된 fallback) 확인.
- 카드 클릭 시 펼쳐지는 본문 리스트가 의도대로 todo 만 보이는지(또는 합쳐서 보이는지) 회귀 확인.
- ORDER, PRD 카드의 카운트가 회귀되지 않았는지 확인.
