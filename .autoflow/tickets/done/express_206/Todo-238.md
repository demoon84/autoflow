# Ticket

## Ticket

- ID: Todo-238
- PRD Key: express_206
- Plan Candidate: Express promotion from tickets/inbox/order_206.md
- Title: TODO 진행 카운트에 inprogress 티켓 포함
- Priority: normal
- Change Type: code
- Stage: done
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI:
- Last Updated: 2026-05-09T13:17:31Z

## Goal

- 이번 작업의 목표: TODO 카운트가 처리 중(inprogress) 티켓은 안 세서 0/209로 나오는 버그. inprogress도 진행률에 포함돼야 1/209로 보여야 함

## References

- PRD: (express; no PRD authored)
- Order: tickets/done/express_206/order_206.md
- Plan Source: express-skip-prd

## Reference Notes

- Project Note: [[express_206]]
- Plan Note:
- Ticket Note: [[Todo-238]]

## Allowed Paths

- apps/desktop/src/renderer/main.tsx

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_238`
- Branch: autoflow/tickets_238
- Base Commit: ba6f6ad36a46a7b7fd3e881353a9ccfb555b3b18
- Worktree Commit: 
- Integration Status: already_in_project_root

## Goal Runtime
- Status: complete
- Started At: 2026-05-09T13:16:29Z
- Started Epoch: 1778332589
- Updated At: 2026-05-09T13:17:32Z
- Tick Count: 2
- Time Used Seconds: 63
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: complete
- Last Progress Fingerprint: 3009966922

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [x] `todoPinTitle` numerator 가 `todoTickets.length + inprogressTickets.length` 로 계산돼 마지막 티켓 처리 중에도 `TODO (1/209)` 같이 표시된다
- [x] denominator(`todoFiles.length`) 는 그대로 유지 (todo + inprogress + done 합집합)
- [x] `cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check` exits 0

## Next Action
- Complete: the inline merge finalizer integrated the AI-merged ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: Express order 206 가 PRD 없이 todo 로 직접 승격된 직후.
- 직전 작업: scripts/start-plan.sh 의 express 분기가 order 파일을 읽어 todo 를 생성했다.
- 재개 시 먼저 볼 것: Order, Goal, Allowed Paths, Done When.

## Notes

- Created by planner (Plan AI, express path) from tickets/inbox/order_206.md at 2026-05-09T13:14:55Z.
- Express promotion: order_206 의 Allowed Paths 와 Done When 이 모두 명시돼 있어 PRD 단계를 생략했다.
- Planner wiki context: `autoflow wiki query --rag --term 'TODO 진행 카운트 inprogress todoPinTitle apps/desktop/src/renderer/main.tsx'` 결과 `tickets/done/prd_085/`가 직접 매치됐다. 당시 동일 파일에서 `TODO` 핀 분자/분모 정책을 정리했고, 이번 수정도 그 연장선으로 numerator 만 `todo + inprogress`로 넓히고 denominator/목록 동작은 유지하는 쪽이 기존 결정과 맞다.
- Mini-plan: `todoPinTitle` 분자에서 현재 `todoTickets.length`만 쓰는 값을 `todoTickets.length + inprogressTickets.length`로 변경한다. denominator `todoFiles.length`는 유지한다. 변경은 `apps/desktop/src/renderer/main.tsx`의 기존 계산식 한 줄만 조정.
- Wiki evidence: `tickets/done/prd_085/Todo-083.md` 및 `tickets/done/prd_085/prd_085.md`에서 TODO 핀은 총 발행(`todo + inprogress + done`) 분모 유지, 분자 정책은 미처리 todo 기반의 범위를 조정 가능하다는 결론이 확인됨.

### Order Notes

- 위치: `apps/desktop/src/renderer/main.tsx:5566` —
  `` `TODO (${todoTickets.length}/${todoFiles.length})` `` 의 numerator 만 변경.
- `inprogressTickets` 는 같은 컴포넌트(`5556`)에서 이미 spread 되고 있음.
- Express rationale: 한 줄 수식 변경, 동일 컴포넌트 안에 이미 쓰이는 변수 재사용.

### Original Request


TODO 카운트가 처리 중(inprogress) 티켓은 안 세서 0/209로 나오는 버그. inprogress도 진행률에 포함돼야 1/209로 보여야 함

- Runtime hydrated worktree dependency at 2026-05-09T13:16:28Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- Runtime hydrated worktree dependency at 2026-05-09T13:16:28Z: linked node_modules -> /Users/demoon2016/Documents/project/autoflow/node_modules
- AI worker prepared todo at 2026-05-09T13:16:27Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_238
- Queued without worktree commit at 2026-05-09T13:17:31Z: PROJECT_ROOT already matches the ticket worktree for all Allowed Paths with code changes.
- Impl AI worker marked verification pass at 2026-05-09T13:17:31Z; runtime finalizer will not perform merge operations.
- Coordinator post-merge cleanup at 2026-05-09T13:17:31Z: worktree_dirty_already_in_project_root=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_238 removed_worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_238 deleted_branch=autoflow/tickets_238.
- Inline merge finalizer (worker worker) finalized this verified ticket at 2026-05-09T13:17:31Z.
## Verification
- Result: passed by worker at 2026-05-09T13:17:31Z
- Log file: pending AI merge finalization

## Result

- Summary: TODO 분자 inprogress 포함
- Remaining risk: 없음

## Verification (legacy)

- `cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check` — pass
