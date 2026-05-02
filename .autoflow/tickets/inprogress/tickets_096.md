# Ticket

## Ticket

- ID: tickets_096
- PRD Key: prd_099
- Plan Candidate: Plan AI handoff from tickets/done/prd_099/prd_099.md
- Title: Reject layer dimmed overlay correction
- Stage: executing
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI: worker
- Last Updated: 2026-05-02T01:43:12Z

## Goal

- 이번 작업의 목표: AI 대쉬보드에서 반려 보류 레이어를 열 때 배경 딤드가 화면 전체를 부자연스러운 회색 막처럼 덮거나 사이드바/본문 경계에서 끊겨 보이지 않도록, shared workflow pin layer overlay 를 자연스럽고 읽기 쉬운 상태로 조정한다.

## References

- PRD: tickets/done/prd_099/prd_099.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_099]]
- Plan Note:
- Ticket Note: [[tickets_096]]

## Allowed Paths

- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_096`
- Branch: autoflow/tickets_096
- Base Commit: 2128b0d4348a2fc9520cff063ba8dc5cf5538b26
- Worktree Commit: 
- Integration Status: pending

## Goal Runtime
- Status: active
- Started At: 2026-05-02T01:42:52Z
- Started Epoch: 1777686172
- Updated At: 2026-05-02T01:43:14Z
- Tick Count: 2
- Time Used Seconds: 22
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: resume
- Last Progress Fingerprint: 2518181558

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [ ] AI 대쉬보드에서 `반려 N건 보류` 레이어를 열면 배경이 자연스럽게 어두워지고, 화면 전체가 단순한 회색 막처럼 보이지 않는다.
- [ ] 왼쪽 사이드바와 본문 경계에서 overlay 가 끊기거나 과하게 밝아 보이지 않는다.
- [ ] reject 레이어 패널, 헤더, 목록, 상세 본문의 가독성이 유지된다.
- [ ] ORDER, PRD, TODO 상세 레이어처럼 `WorkflowPinLayer` 또는 같은 dialog overlay 스타일을 공유하는 대표 레이어가 reject 레이어와 일관된 딤드 동작을 보인다.
- [ ] 이전 detail-layer 안정화 선례(`prd_059` / `tickets_061`)와 충돌하지 않는다. 열린 레이어가 board refresh 중 첫 프레임 flicker, stale content flash, backdrop opacity flash 를 보이지 않는다.
- [ ] 구현은 Allowed Paths 안에 머물고 board data loading, runner state, markdown rendering, ticket lifecycle 동작을 바꾸지 않는다.
- [ ] `cd apps/desktop && npx tsc --noEmit` exit 0.
- [ ] `cd apps/desktop && node scripts/check-syntax.mjs` exit 0.

## Next Action
- 다음에 바로 이어서 할 일: 한 owner 가 mini-plan, 구현, 검증, 증거 기록, done/reject 이동까지 이어서 처리한다.

## Resume Context

- 현재 상태 요약: Plan AI 가 `tickets/inbox/memo_064.md` 를 `tickets/done/prd_099/prd_099.md` 로 승격하고 이 todo 티켓을 생성했다. 범위는 `apps/desktop/src/renderer/main.tsx` 와 `apps/desktop/src/renderer/styles.css` 두 파일로 제한한다.
- 직전 작업: wiki context pass 에서 `tickets/done/prd_059/prd_059.md` 와 `tickets/done/prd_059/tickets_061.md` 를 관련 선례로 확인했다. 이 선례는 shared workflow/detail layer 의 first-frame flicker, stale content flash, backdrop class mismatch 를 다시 만들지 말라는 제약이다. `tickets/reject/reject_003.md` 도 검색됐지만 runtime/smoke-contract blocker 이므로 이번 visual overlay 수정에는 포함하지 않는다.
- 재개 시 먼저 볼 것: `tickets/done/prd_099/prd_099.md`, `apps/desktop/src/renderer/styles.css` 의 `.workflow-pin-layer-overlay` / `.af-dialog-backdrop` / `.af-dialog-root`, `apps/desktop/src/renderer/main.tsx` 의 `WorkflowPinLayer` reject/ORDER/PRD/TODO 사용부.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_099/prd_099.md at 2026-05-02T01:42:12Z.
- Wiki context command: `./bin/autoflow wiki query . --term 'Reject 레이어 딤드 표시 수정' --term '딤드 overlay' --term 'WorkflowPinLayer reject detail layer overlay' --term 'ORDER PRD TODO 상세 레이어 overlay' --term 'apps/desktop/src/renderer/main.tsx styles.css' --term 'af-dialog overlay workflow-pin-layer' --limit 12`.
- Planning constraint: preserve prior `prd_059` / `tickets_061` layer stability behavior while adjusting dimmed overlay appearance. Prefer scoped CSS changes; touch React only if class wiring is inconsistent.

- Runtime hydrated worktree dependency at 2026-05-02T01:42:50Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- AI worker prepared todo at 2026-05-02T01:42:49Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_096; run=tickets/inprogress/verify_096.md
- AI worker prepared resume at 2026-05-02T01:43:12Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_096; run=tickets/inprogress/verify_096.md
## Verification
- Run file: `tickets/inprogress/verify_096.md`
- Log file: pending
- Result: pending ticket-owner by worker

## Result

- Summary:
- Remaining risk:
