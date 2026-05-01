# Ticket

## Ticket

- ID: tickets_083
- PRD Key: prd_085
- Plan Candidate: Plan AI handoff from tickets/done/prd_085/prd_085.md
- Title: TODO 핀 카드 미처리/총발행 카운트 표시
- Stage: done
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI: worker
- Last Updated: 2026-05-01T19:28:54Z

## Goal

- 이번 작업의 목표: 데스크톱 작업 흐름 핀 영역의 `TODO` 카드가 현재 `TODO (todo/todo)`처럼 같은 값을 반복하지 않고, 미처리 todo 티켓 수와 발행된 전체 ticket 수를 `TODO (미처리/총발행)` 형식으로 표시한다.

## References

- PRD: tickets/done/prd_085/prd_085.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_085]]
- Plan Note:
- Ticket Note: [[tickets_083]]

## Allowed Paths

- `apps/desktop/src/renderer/main.tsx`

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_083`
- Branch: autoflow/tickets_083
- Base Commit: f006f772750d00c4d89c4605f70b2ae7439d7e33
- Worktree Commit: f1b94fab1363ea13dd8dc76a918dd101b7baf624
- Integration Status: integrated

## Goal Runtime
- Status: complete
- Started At: 2026-05-01T19:28:02Z
- Started Epoch: 1777663682
- Updated At: 2026-05-01T19:28:55Z
- Tick Count: 3
- Time Used Seconds: 53
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: complete
- Last Progress Fingerprint: 570213183

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [ ] `TODO` 카드 분자는 `board.tickets.todo` 안의 `tickets_*.md` 수로 표시된다.
- [ ] `TODO` 카드 분모는 `board.tickets.todo`, `board.tickets.inprogress`, `board.tickets.done`, `board.tickets.reject` 에 존재하는 `tickets_*.md` 수의 합으로 표시된다.
- [ ] todo가 0개이고 inprogress/done/reject ticket 이 하나 이상 있으면 `TODO (0/N)` 핀 카드가 표시된다.
- [ ] `TODO` 핀 카드를 열었을 때 본문 목록은 기존처럼 todo 상태 ticket 만 보여준다.
- [ ] `ORDER` 와 `PRD` 핀의 분자/분모 계산 및 본문 목록은 변경되지 않는다.
- [ ] 구현은 Allowed Paths 안에만 머문다.
- [ ] `npm run desktop:check` 가 통과한다.

## Next Action
- Complete: the inline merge finalizer integrated the AI-merged ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: Plan AI 가 `tickets/inbox/memo_052.md` 를 `prd_085` 로 승격하고, 이 todo 티켓을 생성했다.
- 직전 작업: planner-1 이 wiki context query 를 실행했고 관련 기존 결정은 발견되지 않았다. 총발행 분모는 `todo + inprogress + done + reject` 의 `tickets_*.md` 누계로 결정했다.
- 재개 시 먼저 볼 것: `apps/desktop/src/renderer/main.tsx` 의 `todoTickets`, `todoFiles`, `todoPinTitle`, `hasWorkflowPins`, `WorkflowPinLayer` 호출부.
- 현재 진행 상태: `todoIssueTotal` 분모 산식을 `board.tickets.todo|inprogress|done|reject`에서 `tickets_*.md`만 합산하도록 반영했고, `PROJECT_ROOT/apps/desktop/src/renderer/main.tsx`로 동일 변경을 병합한 뒤 `npm run desktop:check` 재실행을 통과했다.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_085/prd_085.md at 2026-04-30T23:45:59Z.
- Planner wiki context: `TODO 핀 카드 카운트 미처리 총발행`, `WorkflowPinLayer todoPinTitle todoFiles`, `workflow pins ORDER PRD TODO count`, `board.tickets.todo inprogress done reject` 질의 결과 `result_count=0`; 이 변경을 제한하는 기존 wiki/ticket 결정은 발견되지 않았다.
- Planner constraint: `TODO` 핀 카드 표시 카운트만 `미처리/총발행`으로 바꾸고, 핀 레이어 본문 목록은 미처리 todo 티켓만 유지한다.
- Mini-plan (owner): `main.tsx`의 `todoPins` 계산에서 분자만 기존 todoFiles로 유지하고, 분모를 `board.tickets.todo`, `board.tickets.inprogress`, `board.tickets.done`, `board.tickets.reject`에서 `isTicketBoardFile`인 파일만 합산하도록 변경한다. [[TODO 핀 카드 미처리 총발행]].
- Implementation: 핀 제목은 `TODO (${todoFiles.length}/${todoIssueTotal})`로 렌더링하고, 핀 상세 목록은 `todoFiles` 그대로 사용해 기존처럼 미처리 상태만 표시한다.
- Verification: `npm run desktop:check` 통과 후 TODO 분기 산출물이 변경 사항과 일치하는지 확인한다.

- Runtime hydrated worktree dependency at 2026-05-01T19:28:01Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- AI worker prepared todo at 2026-05-01T19:28:01Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_083; run=tickets/inprogress/verify_083.md
- AI worker prepared resume at 2026-05-01T19:28:11Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_083; run=tickets/inprogress/verify_083.md
- Prepared worktree commit f1b94fab1363ea13dd8dc76a918dd101b7baf624 at 2026-05-01T19:28:54Z; Impl AI integrates it into PROJECT_ROOT and the inline finalizer creates the local completion commit.
- Impl AI worker marked verification pass at 2026-05-01T19:28:53Z; runtime finalizer will not perform merge operations.
- Merge finalizer verified at 2026-05-01T19:28:54Z: AI already integrated worktree commit f1b94fab1363ea13dd8dc76a918dd101b7baf624 into PROJECT_ROOT; script performed no rebase or cherry-pick.
- Inline merge finalizer (worker worker) finalized this verified ticket at 2026-05-01T19:28:54Z.
- Coordinator post-merge cleanup at 2026-05-01T19:28:54Z: removed_worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_083 deleted_branch=autoflow/tickets_083.
## Verification
- Run file: `tickets/done/prd_085/verify_083.md`
- Log file: `logs/verifier_083_20260501_192854Z_pass.md`
- Result: passed

## Result

- Summary: TODO 핀 미처리/총발행 카운트 반영
- Remaining risk: 없음
