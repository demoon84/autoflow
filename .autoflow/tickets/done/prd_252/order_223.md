# Autoflow Order

## Order

- ID: order_223
- Title: PTY worker active ticket UI 회귀 fix
- Status: inbox
- Priority: high
- Created At: 2026-05-10T11:02:24Z
- Source: autoflow order create

## Request

# Autoflow Order

## Order

- Title: PTY worker active ticket UI 표시 회귀 + 영구 fix
- Priority: high
- Status: ready
- Change Type: code


worker 카드의 "실행 중" 배지 + 진행 슬라이더가 PTY 모드에서 inprogress ticket 을 표시하지 못함. 예전엔 표시됐었는데 회귀.

원인:
- legacy run-role.sh 가 `active_ticket_id` / `active_ticket_title` / `active_stage` 를 state 파일에 썼지만 PTY 경로는 그 단계가 없어 빈 채로 UI 에 전달됨
- `apps/desktop/src/main.js` 의 `parseRunnerListOutput` 직후에 filesystem 에서 읽어 채우는 enrichment (`enrichRunnerActiveTicketFromFs`) 가 한 번 추가됐다가 사라짐 — 다른 worker 작업과 conflict 하면서 revert 된 것으로 추정
- 직전 patch 로 PROJECT_ROOT main.js 에는 다시 박혀있지만 (working tree 에만), 안정적 commit + 재현 가능한 위치에 정착시키고 회귀 방지 가드도 같이 넣어야 함

## Allowed Paths

- apps/desktop/src/main.js
- apps/desktop/src/renderer/main.tsx

## Done When

- [ ] `apps/desktop/src/main.js` 의 readBoard 흐름에 `enrichRunnerActiveTicketFromFs` 함수가 정의되어 있고 `parseRunnerListOutput → enrichRunnerTerminalPreviews` 직후 호출됨
- [ ] PTY 모드 worker (`mode=pty`, `role=ticket-owner`) 가 inprogress 에 Todo-*.md 가 있을 때 그 ticket id + Title 을 `runner.activeTicketId` / `runner.activeTicketTitle` 로 채움
- [ ] 활성 ticket 이 있을 때 progress slider 의 `active_stage` 가 `inprogress` 로 설정돼 슬라이더가 "구현" 단계 highlighting
- [ ] PTY 모드 planner 가 inbox 에 order_*.md 또는 backlog 에 prd_*.md 가 있을 때 동일 enrichment 적용 (slider "계획" 단계)
- [ ] state 파일이 active_ticket_id 를 이미 채워둔 legacy 케이스에서는 enrichment 가 그 값을 덮어쓰지 않음 (호환)
- [ ] 새로 추가한 함수는 다른 worker 의 main.js 편집과 충돌 없이 안전한 위치 (예: `enrichRunnerTerminalPreviews` 정의 직후) 에 두기 — 이후 회귀 방지

## Verification

- Command: rg -n "enrichRunnerActiveTicketFromFs|active_ticket_id" apps/desktop/src/main.js

## Notes

- 이 ticket 처리 후 데스크톱 재시작 필요 (main.js 변경이라 hot-reload 안 됨)
- 회귀 원인은 다른 worker 가 같은 파일의 동일 인접 영역을 편집하면서 의도치 않게 함수 정의를 덮어쓴 것으로 추정. 함수를 모듈 단위로 분리 (예: `apps/desktop/src/main/enrich-active-ticket.js`) 하면 회귀 가능성 감소
- 또는 PTY status payload broadcast 시 main process 가 즉시 active_ticket_* 필드를 state file 에 쓰는 방향도 고려 — readBoard 의존도 없이 fs.watch event 로 UI 가 즉시 반응

## Hints

### Scope

- pending Plan AI inference

### Allowed Paths

- pending Plan AI inference

### Verification

- Command: pending Plan AI inference

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
