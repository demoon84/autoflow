# Ticket

## Ticket

- ID: Todo-204
- PRD Key: prd_205
- Plan Candidate: Plan AI handoff from tickets/done/prd_205/prd_205.md
- Title: retry order 파일 노출 dirty-root retry
- Priority: normal
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-08T06:38:00Z

## Goal

- 이번 작업의 목표: `Todo-198`에서 검증된 retry order 파일 분류 hunk를 현재 PROJECT_ROOT의 `apps/desktop/src/renderer/main.tsx` 변경 상태를 보존하면서 완료하고, `npm run desktop:check`가 PROJECT_ROOT에서 exit 0인 상태로 finalization 가능하게 만든다.

## References

- PRD: tickets/done/prd_205/prd_205.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_205]]
- Plan Note:
- Ticket Note: [[Todo-204]]

## Allowed Paths

- `apps/desktop/src/renderer/main.tsx`

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
- Iteration Fingerprints: []
- Last Lint Status: ok
- Last Lint Vagueness Score: 0

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [x] `isOrderBoardFile`가 `order_181.md` 같은 일반 order와 `order_192_retry_1_20260508T051707Z.md` 같은 retry order 파일명을 모두 order로 판정한다.
- [x] `isOrderBoardFile`가 `prd_199.md`, `Todo-197.md`, `reject_001.md`, `order_retry.md` 같은 비대상 파일명을 order로 판정하지 않는다.
- [x] ORDER pin layer의 `inboxOrders`, `doneOrders`, `orderFiles` 계산과 Ticket Workspace order listing이 retry order를 포함해 목록과 count에서 누락하지 않는다.
- [x] retry order가 Ticket Workspace detail에서 `kind: "order"` / order status fallback으로 유지되고, ticket이나 prd로 오분류되지 않는다.
- [x] PROJECT_ROOT의 `apps/desktop/src/renderer/main.tsx`에 있던 선행 dirty-root 변경을 덮어쓰지 않았는지 `git diff -- apps/desktop/src/renderer/main.tsx` 검토 결과를 ticket evidence에 남긴다.
- [x] `npm run desktop:check` from `/Users/demoon2016/Documents/project/autoflow` exits 0.

## Next Action

- 다음에 바로 이어서 할 일: Impl AI 는 이 티켓을 todo 에서 claim 한 뒤 현재 PROJECT_ROOT의 `apps/desktop/src/renderer/main.tsx`를 먼저 읽고, 선행 dirty-root 변경을 보존하면서 `Todo-198`의 retry order classifier hunk가 유지되는지 확인한다. 누락된 hunk만 재적용하고, PROJECT_ROOT에서 `npm run desktop:check`가 exit 0이며 finalizer staging이 안전할 때만 pass finalizer를 호출한다.

## Resume Context

- 현재 상태 요약: Plan AI 가 backlog PRD 에서 todo 티켓을 생성한 직후.
- 직전 작업: scripts/start-plan.sh 가 `tickets/done/prd_205/prd_205.md`를 보관하고 `tickets/todo/Todo-204.md`를 만들었다. Planner가 retry order evidence와 wiki/guard context를 ticket에 보강했다.
- 재개 시 먼저 볼 것: `tickets/done/prd_205/prd_205.md`, `tickets/done/prd_205/order_198_retry_1_20260508T062937Z.md`, 기존 `tickets/done/prd_199/prd_199.md`, 그리고 PROJECT_ROOT의 `git diff -- apps/desktop/src/renderer/main.tsx`.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_205/prd_205.md at 2026-05-08T06:36:56Z.
- Planner wiki pass: `bin/autoflow wiki query --term "desktop retry order isOrderBoardFile dirty_root apps/desktop/src/renderer/main.tsx prd_199 Todo-198" --rag` returned `result_count=0`; 이번 retry는 embedded retry order evidence와 `tickets/done/prd_199/prd_199.md`를 기준으로 진행한다.
- Retry evidence: original `Todo-198` reported `failure_class=dirty_root`; worker evidence says both worktree and PROJECT_ROOT passed `npm run desktop:check`, but finalization would have staged unrelated pre-existing `apps/desktop/src/renderer/main.tsx` dirty-root work together with the ticket hunk.
- Planner decision: this is not planner-side dirty-root cleanup. Reissue as a narrow owner retry so Impl AI can preserve current PROJECT_ROOT edits, reconcile only the retry order classifier hunk if needed, verify PROJECT_ROOT, and pass only when finalizer staging is safe for `apps/desktop/src/renderer/main.tsx`.
- Related PRD: `tickets/done/prd_199/prd_199.md` defines the original retry order desktop listing scope and remains the source acceptance basis for this retry.
- Queue note: `tickets/todo/Todo-201.md` and `tickets/todo/Todo-203.md` also include `apps/desktop/src/renderer/main.tsx`. Single-worker execution should serialize these, but Impl AI must inspect the current file state before editing.
- Guard warning after planner handoff: `bin/autoflow guard` returned `error_count=0`, `warning_count=4` for leftover worktree cleanup candidates `autoflow/Todo-194`, `autoflow/Todo-196`, `autoflow/Todo-197`, and `autoflow/Todo-198`. These are unrelated cleanup candidates; planner did not delete or reset worktrees.

## Verification

- Command: `npm run desktop:check`
- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:


## Manual Closure Note

- Closed manually 2026-05-08 by user request: worker codex usage limit until 2026-05-12. Code changes already match all Done When in main: ticket_201 sidebar label rename, ticket_203 helpText prop removal, ticket_204 isOrderBoardFile regex already covers retry order via existing implementation.
- Stage: done (manual)
