# Ticket

## Ticket

- ID: tickets_185
- PRD Key: prd_186
- Plan Candidate: Plan AI handoff from tickets/done/prd_186/prd_186.md
- Title: worktree-bound runner loop orphan cleanup
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-05T00:37:00Z

## Goal

- 이번 작업의 목표: ticket worktree 안에서 실행되던 long-running runner loop 가 worktree merge/remove 뒤에도 살아남아 삭제된 경로를 계속 참조하지 않도록, worktree cleanup 전 process cleanup 과 loop-worker self-stop 안전망을 추가한다.

## References

- PRD: tickets/done/prd_186/prd_186.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_186]]
- Plan Note:
- Ticket Note: [[tickets_185]]

## Allowed Paths

- `packages/cli/runners-project.sh`
- `runtime/board-scripts/runners-project.sh`
- `runtime/board-scripts/merge-ready-ticket.sh`
- `.autoflow/scripts/merge-ready-ticket.sh`
- `runtime/board-scripts/common.sh`
- `.autoflow/scripts/common.sh`
- `tests/smoke/runner-worktree-orphan-cleanup-smoke.sh`

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

- [ ] `cleanup_completed_ticket_worktree` 또는 같은 완료 cleanup 경로가 `git worktree remove --force <ticket-worktree>` 호출 전에 `<ticket-worktree>` 경로를 command/cwd/script path 로 참조하는 fixture process tree 에 SIGTERM 후 필요 시 SIGKILL 을 보내고, cleanup 뒤 해당 fixture process count 가 `0` 이다.
- [ ] stale todo worktree cleanup 경로가 이미 merged 된 stale worktree를 제거하기 전에 같은 worktree 경로를 참조하는 fixture process tree 를 정리하고, cleanup 뒤 해당 fixture process count 가 `0` 이다.
- [ ] `loop-worker`는 `SCRIPT_DIR/run-role.sh` 또는 `runtime_scripts_root/runner-common.sh`가 사라진 fixture 상황에서 다음 tick을 무한 반복하지 않고 `last_result=loop_runtime_missing` 또는 동등한 key=value evidence 를 남긴 뒤 exit code `0` 으로 종료한다.
- [ ] 완료 cleanup / stale cleanup 이 정리 대상으로 삼는 process 는 ticket worktree path prefix 와 매칭되는 fixture process 로 제한되며, host project root 또는 다른 ticket worktree path 를 참조하는 fixture process 는 종료하지 않는다.
- [ ] 구현은 Allowed Paths 밖의 제품 파일을 수정하지 않고, `.autoflow/telemetry/`, `.autoflow/runners/state/`, `.autoflow/runners/logs/` 운영 데이터를 test fixture 밖에서 직접 정리하지 않는다.
- [ ] `bash -n packages/cli/runners-project.sh runtime/board-scripts/runners-project.sh runtime/board-scripts/merge-ready-ticket.sh .autoflow/scripts/merge-ready-ticket.sh runtime/board-scripts/common.sh .autoflow/scripts/common.sh tests/smoke/runner-worktree-orphan-cleanup-smoke.sh` exits 0.
- [ ] `bash tests/smoke/runner-worktree-orphan-cleanup-smoke.sh` exits 0 and prints evidence lines for `completed_cleanup_orphans=0`, `stale_cleanup_orphans=0`, and `loop_runtime_missing_exit=0`.

## Next Action

- 다음에 바로 이어서 할 일: Impl AI 는 이 티켓을 todo 에서 claim 한 뒤 `tickets/done/prd_186/prd_186.md`의 범위와 prior-ticket constraints를 확인하고, worktree-bound runner loop cleanup 구현, smoke test 작성, 검증, 머지까지 한 턴에 끝낸다.

## Resume Context

- 현재 상태 요약: Plan AI 가 `order_155`를 `prd_186`과 `tickets_185`로 승격했다. 이 티켓은 `tickets_155` worktree 제거 뒤에도 `packages/cli/runners-project.sh loop-worker`가 11시간 이상 살아남아 삭제된 runtime path를 반복 참조한 root cause를 다룬다.
- 직전 작업: `.autoflow/scripts/start-plan.sh 186`가 `prd_186`를 `tickets/done/prd_186/prd_186.md`로 보관하고 `tickets/todo/tickets_185.md`를 만들었다. 원 요청은 `tickets/done/prd_186/order_155.md`에 보존됐다.
- 재개 시 먼저 볼 것: `tickets/done/prd_186/prd_186.md`, `packages/cli/runners-project.sh`의 `loop_runner_worker` / `runner_kill_process_tree`, `runtime/board-scripts/merge-ready-ticket.sh`의 `cleanup_completed_ticket_worktree`, `runtime/board-scripts/common.sh`의 stale todo worktree cleanup 경로.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_186/prd_186.md at 2026-05-05T00:36:47Z.
- Planner wiki pass: `bin/autoflow wiki query /Users/demoon2016/Documents/project/autoflow .autoflow --term "worktree-bound runner loop orphan cleanup runners-project loop-worker" --term "worktree remove runner loop orphan process" --term "order_134 process leak guard PRD_142" --term "tickets_155 runner-common No such file" --limit 10 --rag` returned `result_count=0`.
- Relevant prior ticket: `tickets/done/prd_142/prd_142.md` / `tickets/done/prd_142/tickets_141.md` already covered adapter watchdog cleanup, runner process tree cleanup, and process-pressure guard. Do not duplicate broad process-pressure work; this ticket targets worktree-bound long-running loops after ticket worktree removal.
- Scope boundary from `order_155`: desktop stale process display and bulk cleanup button are intentionally out of scope. Verification must use fixture processes only and must not kill existing user environment processes under `/Library/Caches/autoflow/worktrees/`.
- Repository context: `runtime/board-scripts/merge-ready-ticket.sh` and `.autoflow/scripts/merge-ready-ticket.sh` are currently identical, as are `runtime/board-scripts/common.sh` and `.autoflow/scripts/common.sh`; keep those mirror pairs in sync if changed.
- Guard warning: `bin/autoflow guard` at 2026-05-05T00:37Z returned `status=warning`, `error_count=0`, `warning_count=2`; existing cleanup candidates are leftover worktree `autoflow/tickets_119` with no board ticket and dirty done-ticket worktree `autoflow/tickets_163`. Planner recorded evidence and did not delete or reset worktrees.

## Verification

- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
