# Ticket

## Ticket

- ID: Todo-203
- PRD Key: prd_204
- Plan Candidate: Plan AI handoff from tickets/done/prd_204/prd_204.md
- Title: 워크플로 핀 레이어 안내 문구 제거 dirty-root retry
- Priority: normal
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-08T06:32:40Z

## Goal

- 이번 작업의 목표: `Todo-197`에서 검증된 WorkflowPinLayer 안내 문구 제거 hunk를 현재 PROJECT_ROOT의 `main.tsx` 변경 상태를 보존하면서 통합하고, `npm run desktop:check`가 PROJECT_ROOT에서 exit 0인 상태로 마무리한다.

## References

- PRD: tickets/done/prd_204/prd_204.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_204]]
- Plan Note:
- Ticket Note: [[Todo-203]]

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

- [x] `apps/desktop/src/renderer/main.tsx`에서 ORDER 핀 레이어의 `들어온 빠른 오더 목록입니다. 항목을 클릭하면 오더 본문이 이 화면에서 열립니다.` 문자열이 렌더링 경로에 없다.
- [x] `apps/desktop/src/renderer/main.tsx`에서 PRD 핀 레이어의 `작성된 PRD 목록입니다. 항목을 클릭하면 본문이 이 화면에서 열립니다.` 문자열이 렌더링 경로에 없다.
- [x] `apps/desktop/src/renderer/main.tsx`에서 TODO 핀 레이어의 `아직 시작되지 않은 TODO 티켓 목록입니다. 항목을 클릭하면 티켓 본문이 이 화면에서 열립니다.` 문자열이 렌더링 경로에 없다.
- [x] `WorkflowPinLayer` 호출부 또는 prop type 변경 후 ORDER/PRD/TODO 핀의 button title/count, list item click, detail preview, emptyText 동작을 담당하는 기존 코드 경로가 유지된다.
- [x] PROJECT_ROOT의 `apps/desktop/src/renderer/main.tsx`에 있던 `SkillsPanel` / AI skill UI 계열 선행 변경을 덮어쓰지 않았는지 `git diff -- apps/desktop/src/renderer/main.tsx` 검토 결과를 ticket evidence에 남긴다.
- [x] `npm run desktop:check` from `/Users/demoon2016/Documents/project/autoflow` exits 0.

## Next Action

- 다음에 바로 이어서 할 일: Impl AI 는 이 티켓을 todo 에서 claim 한 뒤 현재 PROJECT_ROOT의 `apps/desktop/src/renderer/main.tsx`를 먼저 읽고, 선행 `SkillsPanel` / AI skill UI 계열 dirty-root 변경을 보존하면서 `Todo-197`의 검증된 `WorkflowPinLayer` hunk를 통합한다. worktree와 PROJECT_ROOT의 차이를 확인하고 `npm run desktop:check`가 PROJECT_ROOT에서 exit 0일 때만 pass finalizer를 호출한다.

## Resume Context

- 현재 상태 요약: `Todo-197` retry order를 `prd_204` / `Todo-203`으로 재발행했다. 원 구현은 worktree에서 검증됐지만 PROJECT_ROOT의 `SkillsPanel` 미정의 dirty-root 상태 때문에 root 검증이 실패했다.
- 직전 작업: `scripts/start-plan.sh`가 `tickets/done/prd_204/prd_204.md`와 `tickets/todo/Todo-203.md`를 만들고 `tickets/inbox/order_197_retry_1_20260508T061256Z.md`를 `tickets/done/prd_204/`에 보관했다. Planner wiki pass는 `result_count=0`이었다.
- 재개 시 먼저 볼 것: `tickets/done/prd_204/prd_204.md`, `tickets/done/prd_204/order_197_retry_1_20260508T061256Z.md`, `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-197`의 기존 hunk, 그리고 PROJECT_ROOT의 `git diff -- apps/desktop/src/renderer/main.tsx`.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_204/prd_204.md at 2026-05-08T06:32:40Z.
- Planner wiki pass: `bin/autoflow wiki query --term "WorkflowPinLayer layerHelpText TODO PRD ORDER SkillsPanel dirty_root main.tsx desktop" --rag` returned `result_count=0`; use the embedded retry order evidence and `tickets/done/prd_198/prd_198.md` as the primary scope reference.
- Retry evidence: original `Todo-197` reported `failure_class=dirty_root`; worker evidence says the ticket worktree passed `npm run desktop:check`, but PROJECT_ROOT verification failed with `src/renderer/main.tsx(2642,24): error TS2304: Cannot find name 'SkillsPanel'` after a temporary merge attempt.
- Planner decision: this is not planner-side dirty-root cleanup. The retry is a narrow same-file owner task so Impl AI can preserve current PROJECT_ROOT changes, reconcile only the WorkflowPinLayer help-text hunk, verify PROJECT_ROOT, and pass only when finalizer staging is safe for `apps/desktop/src/renderer/main.tsx`.
- Related wiki finding: `.autoflow/wiki/features/desktop-ui-updates-2026-05.md` records prd_198 help text removal as a desktop UI refinement; it adds no extra implementation constraint beyond preserving the existing pin layer behavior.
- Queue note: `tickets/inprogress/Todo-202.md`, `tickets/todo/Todo-200.md`, and `tickets/todo/Todo-201.md` also include `apps/desktop/src/renderer/main.tsx`. Single-worker execution should serialize these, but the owner must inspect current file state before editing.
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
