# Ticket

## Ticket

- ID: tickets_087
- PRD Key: prd_089
- Plan Candidate: Plan AI handoff from tickets/done/prd_089/prd_089.md
- Title: 대기 Order 항목 삭제 버튼
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-01T00:37:57Z

## Goal

- 이번 작업의 목표: 데스크톱 앱 Order 탭에서 아직 발급되지 않은 `tickets/inbox/memo_*.md` 대기 항목을 사용자가 확인 후 삭제할 수 있게 한다.

## References

- PRD: tickets/done/prd_089/prd_089.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_089]]
- Plan Note:
- Ticket Note: [[tickets_087]]

## Allowed Paths

- `apps/desktop/src/main.js`
- `apps/desktop/src/preload.js`
- `apps/desktop/src/renderer/vite-env.d.ts`
- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`
- `apps/desktop/src/components/ui/dialog.tsx`

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

- [ ] Order 탭의 `tickets/inbox/memo_*.md` 대기 항목 카드에 삭제 아이콘 버튼이 보인다.
- [ ] 삭제 버튼을 눌러도 카드 상세 Dialog가 같이 열리지 않고, 삭제 확인 Dialog가 먼저 열린다.
- [ ] 확인 Dialog는 삭제 대상 Order ID 또는 파일명을 보여주고, 취소하면 파일과 카드 목록이 그대로 유지된다.
- [ ] 확인 후에는 해당 `tickets/inbox/memo_*.md` 파일만 삭제되고 Order 탭 목록에서 사라진다.
- [ ] 삭제 IPC는 `tickets/inbox/memo_*.md` 밖의 경로, done에 보관된 memo, PRD, ticket, reject 파일 삭제 요청을 거부한다.
- [ ] 삭제 성공/실패 결과가 사용자에게 toast, inline error, 또는 Dialog 상태로 관찰 가능하게 표시된다.
- [ ] 삭제 후 기존 PRD/발급 티켓/완료/반려 목록과 상세 미리보기 흐름은 회귀하지 않는다.
- [ ] 구현은 Allowed Paths 안에만 머문다.
- [ ] `cd apps/desktop && npx tsc --noEmit && node scripts/check-syntax.mjs` 가 통과한다.

## Next Action

- 다음에 바로 이어서 할 일: Impl AI 는 이 티켓을 todo 에서 claim 한 뒤, Order 탭 `tickets/inbox/memo_*.md` 카드 삭제 버튼과 inbox memo 전용 Electron IPC를 Allowed Paths 안에서 구현하고 `cd apps/desktop && npx tsc --noEmit && node scripts/check-syntax.mjs` 로 검증한다.

## Resume Context

- 현재 상태 요약: Plan AI 가 `tickets/inbox/memo_056.md` 를 `tickets/done/prd_089/prd_089.md` 생성 PRD 로 승격하고 이 todo 티켓을 만들었다.
- 직전 작업: wiki context pass 후 `scripts/start-plan.sh 089` 가 PRD 를 done 으로 보관하고 todo 티켓을 만들었다.
- 재개 시 먼저 볼 것: `tickets/done/prd_089/prd_089.md`, `TicketWorkspaceKanbanView`의 inbox memo 카드 렌더링, Electron preload/main IPC 경계.
- 최근 결정: 삭제 기능은 아직 발급되지 않은 `tickets/inbox/memo_*.md`에만 적용한다. done memo, PRD, ticket, reject 삭제는 명시적으로 제외한다.
- 관련 주의: `tickets/reject/reject_003.md`는 max-retry Wiki preview reject이며 `cleanup_status=ok`/runner snapshot smoke 실패 맥락을 제공하지만, 이 티켓의 구현 범위가 아니다.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_089/prd_089.md at 2026-05-01T00:37:57Z.
- Wiki context: `./bin/autoflow wiki query . --term '대기 Order 항목 삭제 버튼 tickets/inbox memo 삭제' --term 'Order 탭 inbox memo 삭제 버튼' --term 'apps/desktop/src/renderer/main.tsx styles.css' --limit 12` 계열 query에서 직접 선행 완료 티켓은 확인되지 않았다. 새 기능으로 좁게 처리한다.
- Wiki context: 같은 query에서 `tickets/reject/reject_003.md`가 surfaced 됐다. 이는 unrelated runtime/smoke blocker이므로 Order deletion 구현에 섞지 않는다.
- Repository context: `TicketWorkspaceKanbanView`가 inbox memo를 `memo` item으로 표시하고, `preload.js`는 현재 `readBoardFile` 등 읽기 API만 노출한다. 임의 경로 삭제 API 대신 `tickets/inbox/memo_*.md`만 제거하는 전용 IPC가 필요하다.

## Verification

- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
