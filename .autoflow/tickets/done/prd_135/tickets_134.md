# Ticket

## Ticket

- ID: tickets_134
- PRD Key: prd_135
- Plan Candidate: Plan AI handoff from tickets/done/prd_135/prd_135.md
- Title: runner self-resurrect 복구
- Stage: done
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI: worker
- Last Updated: 2026-05-03T09:58:03Z

## Goal

- 이번 작업의 목표: desktop app 재시작, dev reload, 호스트 재기동 후 enabled runner 가 `status=stopped` / `last_result=loop_stopped` 상태로 방치되지 않도록, 사용자 명시 stop 과 비의도 parent 종료를 구분하고 desktop startup 경로에서 runner 를 자동 복구한다.

## References

- PRD: tickets/done/prd_135/prd_135.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_135]]
- Plan Note:
- Ticket Note: [[tickets_134]]

## Allowed Paths

- apps/desktop/src/main.js
- packages/cli/runners-project.sh

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_134`
- Branch: autoflow/tickets_134
- Base Commit: 43cad27b48a58ffc967646e0240554ed0b60f926
- Worktree Commit: 
- Integration Status: already_in_project_root

## Goal Runtime
- Status: complete
- Started At: 2026-05-03T09:48:24Z
- Started Epoch: 1777801704
- Updated At: 2026-05-03T09:58:04Z
- Tick Count: 5
- Time Used Seconds: 580
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: complete
- Last Progress Fingerprint: 536340969

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [x] `packages/cli/runners-project.sh stop` 이 runner state 에 사용자 명시 stop marker (`stopped_by=user` 또는 동등한 key) 를 기록한다.
- [x] `loop-worker` 가 `TERM` / `INT` 로 정지될 때 사용자 명시 stop marker 를 무조건 남기지 않고, desktop parent 종료와 구분 가능한 state key (`last_stop_reason=parent_terminated` 또는 동등한 key) 를 기록한다.
- [x] `apps/desktop/src/main.js` 가 startup 또는 project scope 등록 직후 enabled runner 중 `status=stopped` 이고 사용자 명시 stop marker 가 없는 runner 를 자동으로 `runners start` 한다.
- [x] `apps/desktop/src/main.js` self-heal 경로가 동일 runner 에 대해 병렬 중복 start 를 만들지 않는다.
- [x] 사용자가 UI stop 또는 CLI stop 으로 명시 정지한 runner 는 desktop restart self-heal 에 의해 자동 시작되지 않는다.
- [x] desktop quit/reload 로 인해 `last_result=loop_stopped` 가 기록된 runner 는 다음 desktop startup self-heal 대상이 된다.
- [x] `runner_status_count` 에서 `runner_stopped_count` 가 양수인 상태라도, enabled + non-user stopped runner 는 self-heal 후 5초 안에 `status=running` 으로 전환된다.
- [x] `node --check apps/desktop/src/main.js` 와 `bash -n packages/cli/runners-project.sh` 가 exit 0 으로 통과한다.

## Next Action
- Complete: the inline merge finalizer integrated the AI-merged ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: Plan AI 가 `tickets/inbox/order_127.md` 를 `tickets/done/prd_135/prd_135.md` 로 승격하고 todo 티켓을 생성했다.
- 직전 작업: `scripts/start-plan.sh` 가 PRD 와 order 를 `tickets/done/prd_135/` 로 보관하고 `tickets/todo/tickets_134.md` 를 만들었다.
- 재개 시 먼저 볼 것: `tickets/done/prd_135/prd_135.md`, `apps/desktop/src/main.js` 의 `app.whenReady()` / `rememberProjectScope()` / runner shutdown 경로, `packages/cli/runners-project.sh` 의 `stop_runner()` / `loop-worker` trap.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_135/prd_135.md at 2026-05-03T09:44:21Z.
- Planner wiki context at 2026-05-03T09:43:43Z: `bin/autoflow wiki query --term "runner self-heal desktop restart loop_stopped stopped_by user ensure-running main.js runners-project.sh" --term "Autoflow 1원칙 runner stopped desktop 재시작 자동 재기동" --term "status=stopped last_result=loop_stopped runner_status_count runner_stopped_count" --rag` returned `result_count=0`; direct wiki constraint was not found.
- Planner code inspection: `apps/desktop/src/main.js` currently terminates known project runner PIDs during `before-quit` and writes `status=stopped`; startup registers IPC handlers and opens the window but does not self-heal stopped enabled runners.
- Planner code inspection: `packages/cli/runners-project.sh` currently writes `last_result=loop_stopped` from `loop-worker` TERM/INT handling and `stop_runner()` writes `status=stopped`; no `stopped_by=user` marker was found by grep.
- Queue context: existing todo `tickets_133` owns `packages/cli/metrics-project.sh`; this ticket owns only `apps/desktop/src/main.js` and `packages/cli/runners-project.sh`, so there is no Allowed Paths overlap with the current todo queue.
- Guard warning at 2026-05-03T09:44:21Z: `bin/autoflow guard` reported leftover worktree cleanup candidate `autoflow/tickets_119` at `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_119`; planner did not delete or reset it because worktree cleanup is outside this ticket's action.

- Runtime hydrated worktree dependency at 2026-05-03T09:48:23Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- AI worker prepared todo at 2026-05-03T09:48:22Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_134; run=tickets/inprogress/verify_134.md
- Owner wiki context at 2026-05-03T09:59:00Z: `bin/autoflow wiki query --term "runner self-heal desktop restart loop_stopped stopped_by user ensure-running main.js runners-project.sh" --term "status=stopped last_result=loop_stopped runner_status_count runner_stopped_count" --term "parent_terminated runner stop reason desktop before-quit" --rag` returned only `tickets/done/prd_135/prd_135.md` lines 53-82, so no older implementation pattern or repeated failure constraint was found beyond this PRD's acceptance criteria.
- Mini-plan at 2026-05-03T09:59:00Z:
  1. In `packages/cli/runners-project.sh`, make explicit `stop` write `stopped_by=user` / `last_stop_reason=user_requested`, and make loop TERM/INT preserve that marker while non-user loop termination writes `last_stop_reason=parent_terminated`.
  2. In `apps/desktop/src/main.js`, mark desktop shutdown state as non-user stopped and add startup/project-scope self-heal for enabled stopped runners whose state lacks `stopped_by=user`.
  3. Verify syntax, explicit-stop negative case, non-user self-heal positive case, and runner status recovery evidence without using `git push`.
- AI worker prepared resume at 2026-05-03T09:53:48Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_134; run=tickets/inprogress/verify_134.md
- Owner wiki context at 2026-05-03T09:55:00Z from PROJECT_ROOT: `bin/autoflow wiki query --term "runner self-resurrect stopped loop_stopped" --rag` and `bin/autoflow wiki query --term "runners-project stop loop-worker main.js" --rag` both returned `result_count=0`; no prior implementation constraint was found.
- Implementation completed at 2026-05-03T09:57:18Z:
  1. `packages/cli/runners-project.sh` explicit `stop` now writes `stopped_by=user`, `last_stop_reason=user_requested`, and `last_result=user_stopped`; start/restart/loop-running paths clear stale stop markers.
  2. `loop-worker` TERM/INT now preserves an existing user marker only when present; otherwise it records `last_stop_reason=parent_terminated` with `last_result=loop_stopped`.
  3. `apps/desktop/src/main.js` records desktop shutdown as non-user `parent_terminated` / `loop_stopped`, and `rememberProjectScope()` runs self-heal for enabled stopped runners whose state lacks `stopped_by=user`.
  4. Self-heal uses existing `controlRunner()` and therefore shares `runnerControlInflight`; an isolated VM test with two concurrent self-heal calls produced one `runners start planner /tmp/project .autoflow` call, while user-stopped and disabled runners were skipped.
- Verification at 2026-05-03T09:57:18Z: worktree and PROJECT_ROOT both passed `node --check apps/desktop/src/main.js` and `bash -n packages/cli/runners-project.sh`; `git diff --check -- apps/desktop/src/main.js packages/cli/runners-project.sh` passed in the worktree. Isolated state tests verified explicit stop and loop TERM markers.
- Queued without worktree commit at 2026-05-03T09:58:02Z: PROJECT_ROOT already matches the ticket worktree for all Allowed Paths with code changes.
- Impl AI worker marked verification pass at 2026-05-03T09:58:02Z; runtime finalizer will not perform merge operations.
- Coordinator post-merge cleanup at 2026-05-03T09:58:03Z: removed_worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_134 deleted_branch=autoflow/tickets_134.
- Inline merge finalizer (worker worker) finalized this verified ticket at 2026-05-03T09:58:03Z.
## Verification
- Run file: `tickets/done/prd_135/verify_134.md`
- Log file: `logs/verifier_134_20260503_095803Z_pass.md`
- Result: passed

## Result

- Summary: runner stop reason marker와 desktop self-heal 복구 구현
- Remaining risk: live 프로젝트에서 `bin/autoflow runners stop worker "$PWD" .autoflow` 는 현재 adapter 프로세스 트리를 종료할 수 있어 실행하지 않았고, 동등한 stop/loop/self-heal 검증은 격리 하네스로 수행했다.
