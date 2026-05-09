# Ticket

## Ticket

- ID: Todo-233
- PRD Key: prd_231
- Plan Candidate: Plan AI handoff from tickets/done/prd_231/prd_231.md
- Title: worker idle 슬라이더 오표시 수정
- Priority: normal
- Change Type: code
- Stage: done
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI:
- Last Updated: 2026-05-09T12:29:04Z

## Goal

- 이번 작업의 목표: 데스크톱 작업 흐름 화면에서 worker(ticket-owner) runner 가 실제로는 idle 상태(`last_result=ticket_inputs_unchanged`, `no_todo_available`)인데도 `runnerStageKey()` 의 포괄적인 done 정규식이 `lastLogLine`/`conversationPreview` 등 텍스트에 반응해 슬라이더를 "완료" 단계로 잘못 표시하는 버그를 고친다. `apps/desktop/src/renderer/main.tsx` 의 worker 분기에서 idle 신호를 done 판정보다 먼저 감지해, 해당 경우는 항상 "대기" 단계로 표시되게 만든다.

## References

- PRD: tickets/done/prd_231/prd_231.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_231]]
- Plan Note:
- Ticket Note: [[Todo-233]]

## Allowed Paths

- `apps/desktop/src/renderer/main.tsx`

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_233`
- Branch: autoflow/tickets_233
- Base Commit: c9e66aafd478d9eefc0a20e9ac0eabe244f567d5
- Worktree Commit: 
- Integration Status: already_in_project_root

## Goal Runtime
- Status: complete
- Started At: 2026-05-09T12:27:04Z
- Started Epoch: 1778329624
- Updated At: 2026-05-09T12:29:05Z
- Tick Count: 6
- Time Used Seconds: 121
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: complete
- Last Progress Fingerprint: 909636113

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [x] `apps/desktop/src/renderer/main.tsx` 의 `runnerStageKey()` worker 경로에서 `ticket_inputs_unchanged` idle 신호가 done 판정보다 먼저 처리된다.
- [x] active ticket 이 없는 worker runner 에서 `last_result=ticket_inputs_unchanged` 인 상태는 슬라이더 첫 단계 `대기` 로 매핑된다.
- [x] active ticket 이 없는 worker runner 에서 `last_result=no_todo_available` 인 상태도 슬라이더 첫 단계 `대기` 로 매핑된다.
- [x] `cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check` exits 0.

## Next Action
- Complete: the inline merge finalizer integrated the AI-merged ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: Plan AI 가 `prd_231` 을 `Todo-233` 으로 승격했고, 구현 범위는 `main.tsx` 의 worker stage 매핑 한 파일로 확정됐다.
- 직전 작업: `scripts/start-plan.sh` 가 `tickets/done/prd_231/prd_231.md` 를 기준으로 todo 티켓을 만들었고, planner 가 `Allowed Paths` 를 `apps/desktop/src/renderer/main.tsx` 로 확정했다.
- 재개 시 먼저 볼 것: `tickets/done/prd_231/prd_231.md`, `apps/desktop/src/renderer/main.tsx` 의 `runnerStageKey()` worker branch, `ticket_inputs_unchanged` / `no_todo_available` signal 처리 순서.
- 구현 상태: `runnerStageKey()` worker idle 신호 선순위 패치 반영 완료(실행 검증 대기).

## Notes

- Created by planner (Plan AI) from tickets/done/prd_231/prd_231.md at 2026-05-09T12:26:06Z.
- Mini-plan: 앱 데스크탑 `runnerStageKey()`에서 `ticket_inputs_unchanged`, `no_todo_available` idle 신호를 hasActiveTicket이 없을 때 done 정규식보다 먼저 `todo`로 반환하도록 선순위 반영한다.
- 참고: [[prd_155]], [[Todo-154]]에서 worker idle 신호를 완료 오표시에서 제외한 선행 결정이 있었음.
- Wiki / done 컨텍스트: `[[prd_014]]`, `[[Todo-014]]` 는 planner branch 에서 idle 상태를 done 보다 먼저 분기했던 선행 보정이고, `[[prd_025]]`, `[[Todo-025]]` 는 worker branch 를 `대기/구현/완료/반려` 4단계로 유지해야 한다는 제약을 남겼다. 이번 티켓은 그 구조를 유지한 채 idle signal 만 선반영한다.
- Wiki / done 컨텍스트: `[[prd_155]]`, `[[Todo-154]]` 에서 `ticket_inputs_unchanged` 가 worker idle preflight 결과로 정착했으므로, UI 매핑도 동일한 의미(`todo`)를 반영해야 한다.
- Planner guard warning: `bin/autoflow guard` 는 `autoflow/tickets_222` leftover worktree 경고를 보고했지만, 현재 티켓 scope 와 무관하고 board error 는 없었다. 이번 티켓은 그대로 진행한다.

- Runtime hydrated worktree dependency at 2026-05-09T12:27:03Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- Runtime hydrated worktree dependency at 2026-05-09T12:27:03Z: linked node_modules -> /Users/demoon2016/Documents/project/autoflow/node_modules
- AI worker prepared todo at 2026-05-09T12:27:02Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_233
- Shell sanity gate refused pass at 2026-05-09T12:28:21Z: done_when_unchecked; 1 of 4 Done When item(s) still unchecked; check every item or split the ticket scope
- Queued without worktree commit at 2026-05-09T12:28:37Z: PROJECT_ROOT already matches the ticket worktree for all Allowed Paths with code changes.
- Impl AI worker marked verification pass at 2026-05-09T12:28:37Z; runtime finalizer will not perform merge operations.
- AI worker prepared resume at 2026-05-09T12:28:54Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_233
- Queued without worktree commit at 2026-05-09T12:29:04Z: PROJECT_ROOT already matches the ticket worktree for all Allowed Paths with code changes.
- Impl AI worker marked verification pass at 2026-05-09T12:29:04Z; runtime finalizer will not perform merge operations.
- Coordinator post-merge cleanup at 2026-05-09T12:29:04Z: worktree_dirty_already_in_project_root=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_233 removed_worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_233 deleted_branch=autoflow/tickets_233.
- Inline merge finalizer (worker worker) finalized this verified ticket at 2026-05-09T12:29:04Z.
## Verification
- Result: passed by worker at 2026-05-09T12:29:04Z
- Log file: pending AI merge finalization

## Result

- Summary: worker idle 신호를 runnerStageKey() worker 분기에서 todo 우선 매핑으로 수정
- Remaining risk: 없음
