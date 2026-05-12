# Ticket

## Ticket

- ID: Todo-314
- PRD Key: express_314
- Plan Candidate: 여러 ticket-owner runner가 있을 때 active ticket fallback과 progress card label을 실제 runner 소유권 기준으로 보정한다.
- Title: 데스크탑 runner 카드 active ticket 중복/stale 표기 보정
- Priority: normal
- Change Type: code
- Stage: done
- AI: verifier
- Claimed By: 
- Execution AI: 
- Verifier AI:
- Last Updated: 2026-05-12T07:29:03Z

## Goal

- 데스크탑 AI Autoflow runner 카드에서 여러 ticket-owner runner가 있을 때 idle worker 카드에 다른 runner의 active ticket이 fallback으로 붙지 않도록 한다.
- `apps/desktop/src/main.js`의 PTY fallback active ticket 보강은 `tickets/inprogress/Todo-*.md` 첫 파일을 모든 ticket-owner runner에 붙이지 않고, ticket 본문의 `AI` / `Claimed By` / `Execution AI` 또는 runner state가 가리키는 실제 owner runner에만 적용한다.
- state file이 `active_stage=idle`이고 `active_ticket_id`가 비어 있는 runner에는 fallback이 완료 티켓 또는 타 runner 티켓을 덮어씌우지 않도록 한다.
- 완료되어 `done/`에 있는 `Todo-312` 같은 티켓은 active badge에 남지 않게 한다.
- 여러 ticket-owner runner가 enabled 상태이면 progress card 제목을 `Worker` / `Worker-2`처럼 runner id 기준으로 구분해 표시하고, 단일 worker일 때는 기존처럼 `Worker`로 표시한다.
- renderer의 active ticket 버튼은 실제 `activeTicketId`가 있을 때만 `tickets/inprogress/<id>.md`를 열도록 유지/보정한다.

## References

- PRD: tickets/done/express_314/order_313.md
- Feature PRD:
- Plan:

## Reference Notes

- Project Note: Express auto-promoted (confidence: high) — order_313. 요청에 Allowed Paths와 Verification hint가 명시되어 있어 PRD 작성 없이 단일 구현 티켓으로 승격.
- Plan Note:
- Ticket Note: Desktop runner card active ticket display and multi-worker label only. 기존 `express_313`은 완료된 `order_312` 작업이 사용 중이라, 이번 실행은 다음 빈 key `express_314`로 발행한다.

## Allowed Paths

- `apps/desktop/src/main.js`
- `apps/desktop/src/renderer/main.tsx`

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_314`
- Branch: autoflow/tickets_314
- Base Commit: 0f728a5e5fbda24cd4d5d05cd6412186d2186507
- Worktree Commit: 
- Integration Status: already_in_project_root

## Goal Runtime
- Status: complete
- Started At: 2026-05-12T07:04:19Z
- Started Epoch: 1778569459
- Updated At: 2026-05-12T07:29:05Z
- Tick Count: 9
- Time Used Seconds: 1486
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: complete
- Last Progress Fingerprint: 2621261117

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [x] `enrichRunnerActiveTicketFromFs`가 inprogress 첫 ticket을 모든 ticket-owner runner에 무조건 붙이지 않는다.
- [x] idle이고 `active_ticket_id`가 비어 있는 runner에는 다른 runner의 active ticket fallback이 표시되지 않는다.
- [x] 완료된 `done/` ticket(`Todo-312` 등)은 runner active badge에 남지 않는다.
- [x] 여러 ticket-owner runner가 enabled 상태일 때 progress card 제목이 `Worker` / `Worker-2`처럼 구분된다.
- [x] active ticket 버튼은 실제 `activeTicketId`가 있을 때만 `tickets/inprogress/<id>.md`를 대상으로 한다.
- [x] `./bin/autoflow runners list . .autoflow`와 `cd apps/desktop && npm run check`가 통과한다.

## Next Action
- Complete: the inline merge finalizer integrated the AI-merged ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- Current state: verifier handoff complete, semantic review pending.
- Last completed action: `Todo-314 pass` finalizer가 `status=verify_pending`을 반환하며 `tickets/verifier/Todo-314.md`를 생성했다.
- First thing to inspect on resume: verifier가 fail로 되돌렸는지, 아니면 done 이동과 merge 정리가 끝났는지 확인.

## Notes

- Mini-plan: ① main process fallback이 runner state와 ticket owner fields를 대조하도록 수정 ② idle/no active id runner에는 fallback 미적용 ③ done/verifier 완료 ticket이 active badge에 남지 않는지 확인 ④ renderer에서 다중 ticket-owner label을 runner id 기반으로 표시 ⑤ 지정 검증 명령 실행.
- Express auto-promoted (confidence: high)
- 구현: `apps/desktop/src/main.js`에 ticket owner canonicalization과 owner-meta 매칭을 추가해 inprogress fallback을 실제 소유 runner에만 붙이도록 제한했다.
- 구현: `apps/desktop/src/renderer/main.tsx`에서 worker alias 표기를 `worker` / `worker-N` 규칙으로 정규화하고 progress card 제목에 전체 runner 목록 기반 라벨을 주입했다.
- 검증: worktree에서 `./bin/autoflow runners list . .autoflow` 통과.
- 검증: worktree에서 `cd apps/desktop && npm run check` 통과.
- 검증: PROJECT_ROOT에서 `./bin/autoflow runners list . .autoflow` 통과.
- 검증: PROJECT_ROOT에서 `cd apps/desktop && npm run check` 통과.
- close-out: `./.autoflow/scripts/finish-ticket-owner.sh Todo-314 pass "runner active ticket fallback/label ownership 보정 완료"` -> `status=verify_pending`

- Runtime hydrated worktree dependency at 2026-05-12T07:04:18Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- Runtime hydrated worktree dependency at 2026-05-12T07:04:18Z: linked node_modules -> /Users/demoon2016/Documents/project/autoflow/node_modules
- AI worker prepared todo at 2026-05-12T07:04:17Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_314
- AI worker prepared resume at 2026-05-12T07:27:27Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_314
- AI worker-2 prepared resume at 2026-05-12T07:28:02Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_314
- Queued without worktree commit at 2026-05-12T07:29:03Z: PROJECT_ROOT already matches the ticket worktree for all Allowed Paths with code changes.
- Impl AI verifier marked verification pass at 2026-05-12T07:29:03Z; runtime finalizer will not perform merge operations.
- Coordinator post-merge cleanup at 2026-05-12T07:29:04Z: worktree_dirty_already_in_project_root=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_314 removed_worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_314 deleted_branch=autoflow/tickets_314.
- Inline merge finalizer (worker verifier) finalized this verified ticket at 2026-05-12T07:29:04Z.
## Inference Trace

- keywords: enrichRunnerActiveTicketFromFs, displayProgressRoleLabel, displayWorkflowRunnerId, activeTicketId, ticket-owner
- paths found: apps/desktop/src/main.js, apps/desktop/src/renderer/main.tsx (order hints에서 명시)
- confidence: high (두 파일로 제한된 desktop runner card active ticket 표시/라벨 변경)

## Verification
- Result: passed by verifier at 2026-05-12T07:29:03Z
- Log file: pending AI merge finalization

## Result

- Summary: desktop runner active ticket ownership/label 보정이 Goal과 정합하고 PROJECT_ROOT 검증도 통과함
- Commit:
