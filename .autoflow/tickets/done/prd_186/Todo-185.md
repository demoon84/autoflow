# Ticket

## Ticket

- ID: Todo-185
- PRD Key: prd_186
- Plan Candidate: Plan AI handoff from tickets/done/prd_186/prd_186.md
- Title: worktree-bound runner loop orphan cleanup
- Stage: done
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI: worker
- Last Updated: 2026-05-06T00:46:28Z

## Goal

- 이번 작업의 목표: ticket worktree 안에서 실행되던 long-running runner loop 가 worktree merge/remove 뒤에도 살아남아 삭제된 경로를 계속 참조하지 않도록, worktree cleanup 전 process cleanup 과 loop-worker self-stop 안전망을 추가한다.

## References

- PRD: tickets/done/prd_186/prd_186.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_186]]
- Plan Note:
- Ticket Note: [[Todo-185]]

## Allowed Paths

- `packages/cli/runners-project.sh`
- `runtime/board-scripts/runners-project.sh`
- `runtime/board-scripts/merge-ready-ticket.sh`
- `.autoflow/scripts/merge-ready-ticket.sh`
- `runtime/board-scripts/common.sh`
- `.autoflow/scripts/common.sh`
- `tests/smoke/runner-worktree-orphan-cleanup-smoke.sh`

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-185`
- Branch: autoflow/Todo-185
- Base Commit: e2bbc55eca4e31597f857e37c2172d5827d90d09
- Worktree Commit: 
- Integration Status: already_in_project_root

## Goal Runtime
- Status: complete
- Started At: 2026-05-06T00:28:20Z
- Started Epoch: 1778027300
- Updated At: 2026-05-06T00:46:29Z
- Tick Count: 8
- Time Used Seconds: 1089
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: complete
- Last Progress Fingerprint: 1783985729

## Recovery State

- Status: healthy
- Detected By: planner
- Failure Class: dirty_root_cleared
- Evidence: PROJECT_ROOT no longer reports dirty Allowed Paths overlapping this ticket; auto-recovered at 2026-05-06T00:28:13Z. Planner recovery turn at 2026-05-06T00:41:46Z read `tickets/inprogress/verify_185.md` pass evidence, `start-plan.sh` output (`status=idle`, `blocked_recover_skip.4.failure_class=dirty_root_cleared`, `reason=failure_class_out_of_scope`), and wiki RAG terms for `worktree-bound runner loop orphan cleanup` / `Todo-185` / `blocked_post_merge_cleanup` returned `result_count=0`.
- Planner Decision: Treat the dirty-root blocker as resolved and unblock this ticket for Impl AI finalization only. PROJECT_ROOT already carries the verified Allowed Paths, so planner changed board state only and did not edit product code, verify, commit, or run finalization.
- Owner Resume Instruction: Resume `Todo-185` in place; inspect `tickets/inprogress/verify_185.md`, refresh the declared verification only if the staged Allowed Paths have changed, then run `.autoflow/scripts/finish-ticket-owner.sh 185 pass "worktree-bound runner loop orphan cleanup"` as the bookkeeping/finalization tool. Do not reclaim/reimplement this ticket or claim another ticket before this finalization attempt clears.
- Last Recovery At: 2026-05-06T00:41:46Z

## Done When

- [x] `cleanup_completed_ticket_worktree` 또는 같은 완료 cleanup 경로가 `git worktree remove --force <ticket-worktree>` 호출 전에 `<ticket-worktree>` 경로를 command/cwd/script path 로 참조하는 fixture process tree 에 SIGTERM 후 필요 시 SIGKILL 을 보내고, cleanup 뒤 해당 fixture process count 가 `0` 이다.
- [x] stale todo worktree cleanup 경로가 이미 merged 된 stale worktree를 제거하기 전에 같은 worktree 경로를 참조하는 fixture process tree 를 정리하고, cleanup 뒤 해당 fixture process count 가 `0` 이다.
- [x] `loop-worker`는 `SCRIPT_DIR/run-role.sh` 또는 `runtime_scripts_root/runner-common.sh`가 사라진 fixture 상황에서 다음 tick을 무한 반복하지 않고 `last_result=loop_runtime_missing` 또는 동등한 key=value evidence 를 남긴 뒤 exit code `0` 으로 종료한다.
- [x] 완료 cleanup / stale cleanup 이 정리 대상으로 삼는 process 는 ticket worktree path prefix 와 매칭되는 fixture process 로 제한되며, host project root 또는 다른 ticket worktree path 를 참조하는 fixture process 는 종료하지 않는다.
- [x] cleanup helper 는 같은 worktree path 를 command/cwd 로 참조하더라도 현재 finalizer/adapter 의 self/ancestor process chain 은 종료하지 않는다.
- [x] 구현은 Allowed Paths 밖의 제품 파일을 수정하지 않고, `.autoflow/telemetry/`, `.autoflow/runners/state/`, `.autoflow/runners/logs/` 운영 데이터를 test fixture 밖에서 직접 정리하지 않는다.
- [x] `bash -n packages/cli/runners-project.sh runtime/board-scripts/runners-project.sh runtime/board-scripts/merge-ready-ticket.sh .autoflow/scripts/merge-ready-ticket.sh runtime/board-scripts/common.sh .autoflow/scripts/common.sh tests/smoke/runner-worktree-orphan-cleanup-smoke.sh` exits 0.
- [x] `bash tests/smoke/runner-worktree-orphan-cleanup-smoke.sh` exits 0 and prints evidence lines for `completed_cleanup_orphans=0`, `stale_cleanup_orphans=0`, and `loop_runtime_missing_exit=0`.

## Next Action
- Complete: the inline merge finalizer integrated the AI-merged ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: Plan AI 가 `order_155`를 `prd_186`과 `Todo-185`로 승격했다. 이 티켓은 `Todo-155` worktree 제거 뒤에도 `packages/cli/runners-project.sh loop-worker`가 11시간 이상 살아남아 삭제된 runtime path를 반복 참조한 root cause를 다룬다.
- 직전 작업: `.autoflow/scripts/start-plan.sh 186`가 `prd_186`를 `tickets/done/prd_186/prd_186.md`로 보관하고 `tickets/todo/Todo-185.md`를 만들었다. 원 요청은 `tickets/done/prd_186/order_155.md`에 보존됐다.
- 재개 시 먼저 볼 것: worktree와 PROJECT_ROOT 모두에서 PRD verification command 가 통과했다. 변경은 PROJECT_ROOT에 AI-led merge 완료 상태이며, evidence 는 `tickets/inprogress/verify_185.md`에 기록되어 있다.
- Planner recovery context: 2026-05-06T00:41:46Z planner resolved the stale blocked metadata left after `blocked_post_merge_cleanup`: `start-plan.sh` had no normal plan work and skipped `dirty_root_cleared` as out of scope, wiki RAG returned `result_count=0`, and `git diff --cached --stat` showed the ticket Allowed Paths staged in PROJECT_ROOT. Next owner action is finalization only.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_186/prd_186.md at 2026-05-05T00:36:47Z.
- Planner wiki pass: `bin/autoflow wiki query /Users/demoon2016/Documents/project/autoflow .autoflow --term "worktree-bound runner loop orphan cleanup runners-project loop-worker" --term "worktree remove runner loop orphan process" --term "order_134 process leak guard PRD_142" --term "Todo-155 runner-common No such file" --limit 10 --rag` returned `result_count=0`.
- Relevant prior ticket: `tickets/done/prd_142/prd_142.md` / `tickets/done/prd_142/Todo-141.md` already covered adapter watchdog cleanup, runner process tree cleanup, and process-pressure guard. Do not duplicate broad process-pressure work; this ticket targets worktree-bound long-running loops after ticket worktree removal.
- Scope boundary from `order_155`: desktop stale process display and bulk cleanup button are intentionally out of scope. Verification must use fixture processes only and must not kill existing user environment processes under `/Library/Caches/autoflow/worktrees/`.
- Repository context: `runtime/board-scripts/merge-ready-ticket.sh` and `.autoflow/scripts/merge-ready-ticket.sh` are currently identical, as are `runtime/board-scripts/common.sh` and `.autoflow/scripts/common.sh`; keep those mirror pairs in sync if changed.
- Guard warning: `bin/autoflow guard` at 2026-05-05T00:37Z returned `status=warning`, `error_count=0`, `warning_count=2`; existing cleanup candidates are leftover worktree `autoflow/Todo-119` with no board ticket and dirty done-ticket worktree `autoflow/Todo-163`. Planner recorded evidence and did not delete or reset worktrees.

- Runtime hydrated worktree dependency at 2026-05-06T00:26:12Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- Runtime hydrated worktree dependency at 2026-05-06T00:26:12Z: linked node_modules -> /Users/demoon2016/Documents/project/autoflow/node_modules
- Runtime auto-blocked: dirty_project_root_conflict at 2026-05-06T00:26:11Z; dirty_paths=runtime/board-scripts/common.sh, .autoflow/scripts/common.sh
- Auto-recovery at 2026-05-06T00:28:13Z: dirty_project_root_conflict cleared; ticket returned to todo for fresh claim.
- Cleaned stale todo worktree metadata at 2026-05-06T00:28:17Z: removed already-merged worktree /Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-185 before fresh claim.
- Runtime hydrated worktree dependency at 2026-05-06T00:28:18Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- Runtime hydrated worktree dependency at 2026-05-06T00:28:18Z: linked node_modules -> /Users/demoon2016/Documents/project/autoflow/node_modules
- AI worker prepared todo at 2026-05-06T00:28:17Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-185; run=tickets/inprogress/verify_185.md
- Mini-plan at 2026-05-06T00:35:00Z: add a path-prefix-scoped worktree process cleanup helper in the mirrored `common.sh` scripts, call it before completed-ticket and stale-todo `git worktree remove`, add a `loop-worker` runtime-missing self-stop guard in both runner entrypoints, then cover those behaviors with a fixture-only smoke test. Prior context from `tickets/done/prd_142/` is treated as a boundary: keep existing broad process-pressure/watchdog behavior intact and only target worktree-bound orphan loops.
- Verification at 2026-05-06T00:35:30Z: worktree and PROJECT_ROOT both passed `bash -lc 'bash -n ... && diff -q ... && bash tests/smoke/runner-worktree-orphan-cleanup-smoke.sh'`; smoke output included `completed_cleanup_orphans=0`, `stale_cleanup_orphans=0`, and `loop_runtime_missing_exit=0`.
- Finish paused at 2026-05-06T00:36:51Z: worktree HEAD e2bbc55eca4e31597f857e37c2172d5827d90d09 does not contain PROJECT_ROOT HEAD 2b02211d099f8f929a5a354ec058cf8154ffea49. AI must perform the rebase/merge; script did not run git rebase.
- Queued without worktree commit at 2026-05-06T00:37:51Z: PROJECT_ROOT already matches the ticket worktree for all Allowed Paths with code changes.
- Impl AI worker marked verification pass at 2026-05-06T00:37:51Z; runtime finalizer will not perform merge operations.
- Recovery patch at 2026-05-06T00:45Z: cleanup process discovery now excludes the current finalizer/adapter self and ancestor PID chain before terminating worktree-bound processes; root and ticket worktree both passed the full ticket verification command including `self_cleanup_survived=1`.
- Planner recovery at 2026-05-06T00:41:46Z: `dirty_root_cleared` recovery was converted from blocked metadata to `healthy`; `Integration Status` is `already_in_project_root` and `Next Action` instructs worker to rerun finish finalization only. Wiki RAG for the direct recovery terms returned `result_count=0`.
- AI worker prepared resume at 2026-05-06T00:43:49Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-185; run=tickets/inprogress/verify_185.md
- Queued without worktree commit at 2026-05-06T00:46:10Z: PROJECT_ROOT already matches the ticket worktree for all Allowed Paths with code changes.
- Impl AI worker marked verification pass at 2026-05-06T00:46:10Z; runtime finalizer will not perform merge operations.
- Queued without worktree commit at 2026-05-06T00:46:27Z: PROJECT_ROOT already matches the ticket worktree for all Allowed Paths with code changes.
- Impl AI worker marked verification pass at 2026-05-06T00:46:27Z; runtime finalizer will not perform merge operations.
- Coordinator post-merge cleanup at 2026-05-06T00:46:28Z: worktree_processes_stopped=0 removed_worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-185 deleted_branch=autoflow/Todo-185.
- Inline merge finalizer (worker worker) finalized this verified ticket at 2026-05-06T00:46:28Z.
## Verification
- Run file: `tickets/done/prd_186/verify_185.md`
- Log file: `logs/verifier_185_20260506_004629Z_pass.md`
- Result: passed

## Result

- Summary: worktree-bound runner loop orphan cleanup
- Remaining risk: Low; process matching is limited to absolute worktree path prefix via command/cwd and the smoke verifies sibling worktree processes survive.
