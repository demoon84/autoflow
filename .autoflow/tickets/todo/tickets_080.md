# Ticket

## Ticket

- ID: tickets_080
- PRD Key: prd_082
- Plan Candidate: Plan AI handoff from tickets/done/prd_082/prd_082.md
- Title: Tickets workspace empty kanban columns
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-04-30T23:28:42Z

## Goal

- 이번 작업의 목표: Desktop Tickets 화면의 PRD, Order, 발급 티켓 탭에서 해당 탭이 다루는 기본 폴더 컬럼을 파일 수와 무관하게 항상 노출하고, 파일이 0개인 컬럼에는 기존 빈 상태 메시지를 유지한다.

## References

- PRD: tickets/done/prd_082/prd_082.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Obsidian Links

- Project Note: [[prd_082]]
- Plan Note:
- Ticket Note: [[tickets_080]]

## Allowed Paths

- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`

## Worktree

- Path:
- Branch:
- Base Commit:
- Worktree Commit:
- Integration Status: pending_claim

## Goal Runtime

- Status:
- Started At:
- Started Epoch:
- Updated At:
- Tick Count: 0
- Time Used Seconds: 0
- Token Budget:
- Tokens Used:
- Continuation Suppressed: false
- Last Event:
- Last Progress Fingerprint:

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [ ] Order 탭에서 `tickets/inbox/` 항목이 0개여도 좌측 `Order` / `tickets/inbox` 컬럼이 보이고, 컬럼 내부에는 `비어 있음` 상태가 보인다.
- [ ] Order 탭에서 완료된 order/memo 항목이 없어도 우측 `완료` / `tickets/done` 컬럼이 함께 유지된다.
- [ ] PRD 탭에서 `tickets/backlog/` 항목이 0개여도 `Backlog` / `tickets/backlog` 컬럼이 유지되고, `tickets/done` 컬럼도 함께 유지된다.
- [ ] 발급 티켓 탭에서 `todo`, `inprogress`, `done`, `reject` 중 일부 또는 전부가 0개여도 네 기본 컬럼이 모두 보인다.
- [ ] 실제 파일이 있는 폴더는 기존처럼 해당 컬럼에 카드가 표시되고, 카드 클릭 detail layer, status badge, 선택/focus 복귀 동작은 유지된다.
- [ ] 탭별 기본 컬럼 외에 예상하지 못한 폴더 파일이 들어오면 기존 ordering 뒤에 정렬되어 표시되는 확장 동작을 유지한다.
- [ ] `items.length === 0` 경로에서도 `.ticket-workspace-empty-card` 하나만 보이는 상태로 퇴행하지 않는다.
- [ ] `--ticket-kanban-column-count`가 기본 컬럼 수와 union 결과를 반영해 빈 상태에서도 칸반 grid 폭과 가로 스크롤이 깨지지 않는다.
- [ ] 구현은 Allowed Paths 안에만 머문다.

## Next Action

- 다음에 바로 이어서 할 일: Impl AI 는 이 티켓을 claim 한 뒤 `tickets/done/prd_082/prd_082.md`를 읽고, `ticketWorkspaceKanbanColumnsForFiles`, `TicketWorkspaceKanbanView`, `TicketKanban` 호출부에서 탭별 기본 폴더 컬럼을 유지하도록 구현한다.

## Resume Context

- 현재 상태 요약: Plan AI 가 `tickets/inbox/memo_048.md`를 `tickets/done/prd_082/prd_082.md`로 승격하고 이 todo 티켓을 생성했으며, `tickets/inbox/memo_049.md`는 같은 범위를 PRD/Order/발급 티켓 탭 전체로 못박는 보강 입력으로 확인했다.
- 직전 작업: wiki context pass와 코드 스캔으로 Tickets workspace 칸반 컬럼이 현재 실제 파일이 있는 폴더에서만 생성되고, `items.length === 0`일 때 단일 empty card로 빠지는 원인을 확인했다. `memo_049`는 새 PRD를 만들지 않고 이 티켓의 보강 context로 합쳤다.
- 재개 시 먼저 볼 것: `tickets/done/prd_082/prd_082.md`, `apps/desktop/src/renderer/main.tsx`의 `ticketWorkspaceKanbanColumnsForFiles`, `TicketWorkspaceKanbanView`, `TicketKanban` 탭별 호출부, 그리고 필요 시 `apps/desktop/src/renderer/styles.css`의 `.ticket-workspace-kanban-columns`.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_082/prd_082.md at 2026-04-30T23:23:49Z.
- Source memo archived at `tickets/done/prd_082/memo_048.md`.
- Supplemental source memo archived at `tickets/done/prd_082/memo_049.md`; it confirms the same empty-column rule must apply to PRD, Order, and issued-ticket tabs, so no duplicate PRD/ticket was created.
- Wiki context: `wiki/features/ticket-workspace-tabs.md` says the active Tickets workspace uses PRD, inbox/order, and issued-ticket tabs with a click-to-open detail layer; preserve those tabs and detail-layer behavior.
- Wiki context: `tickets/done/prd_010/tickets_010.md` records the original kanban expectation that empty columns still expose their header and count `0`.
- Wiki context: `tickets/done/prd_061/prd_061.md` and `tickets/done/prd_061/tickets_063.md` require user-visible `Order`/`오더` wording while keeping `tickets/inbox/memo_NNN.md` and internal `memo` identifiers unchanged.
- Wiki/ticket context: `tickets/done/prd_082/prd_082.md` already contains the PRD/Order/issued-ticket acceptance criteria requested by `memo_049`; use `tickets_080` as the single implementation ticket for this scope.
- Wiki query context: queries for `ticketWorkspaceKanbanColumnsForFiles`, `TicketWorkspaceKanbanView`, `ticketWorkspaceTabs`, `memo_048`, and `memo_049` returned no more-specific completed ticket than `prd_082`; broad renderer-path results also warned that these files have had prior merge/dirtiness blockers, so Impl AI should keep the diff narrow.
- Planning constraint: keep the change scoped to the Tickets workspace kanban column calculation and empty-state branch; do not alter board scanner/runtime semantics.

## Verification

- Command: `npm run desktop:check`
- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
