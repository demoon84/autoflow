# Ticket

## Ticket

- ID: tickets_141
- PRD Key: prd_142
- Plan Candidate: Plan AI handoff from tickets/done/prd_142/prd_142.md
- Title: runner adapter process leak guard
- Stage: done
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI: worker
- Last Updated: 2026-05-03T11:10:01Z

## Goal

- 이번 작업의 목표: Autoflow runner / adapter 호출 경로가 tick 반복 중 `bash`, `awk`, `sleep` 계열 자식 프로세스를 누적해 macOS user process limit 을 잠식하지 않도록 watchdog cleanup, process tree cleanup, process-pressure guard 를 보강한다.

## References

- PRD: tickets/done/prd_142/prd_142.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_142]]
- Plan Note:
- Ticket Note: [[tickets_141]]

## Allowed Paths

- `packages/cli/run-role.sh`
- `packages/cli/runners-project.sh`

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_141`
- Branch: autoflow/tickets_141
- Base Commit: e76b3178c5e6d5669a3dc810a35997bc44f17ee1
- Worktree Commit: 
- Integration Status: already_in_project_root

## Goal Runtime
- Status: complete
- Started At: 2026-05-03T11:04:16Z
- Started Epoch: 1777806256
- Updated At: 2026-05-03T11:10:02Z
- Tick Count: 3
- Time Used Seconds: 346
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: complete
- Last Progress Fingerprint: 2433935565

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [x] `packages/cli/run-role.sh`의 `run_with_timeout`은 adapter 명령이 정상 종료되면 watchdog `sleep` 프로세스와 marker file 을 즉시 정리하고, 빠른 정상 종료 반복 호출 후 `sleep 1200` 또는 동등한 watchdog sleep 이 누적되지 않는다.
- [x] `run_with_timeout` timeout 경로는 child process 뿐 아니라 adapter command 가 만든 direct child/grandchild process tree 를 가능한 범위에서 정리하며, timeout 후 exit code `124` 계약을 유지한다.
- [x] `run_with_timeout` 수정은 `prd_125`에서 보장한 caller stdin 보존 동작을 깨지 않는다.
- [x] `packages/cli/runners-project.sh`의 loop-worker `TERM` / `INT` 및 `runners stop` 경로는 현재 tick child 와 그 하위 process tree 를 정리하고, stale child 를 남기지 않는 증거를 제공한다.
- [x] runner tick 시작 전 또는 adapter spawn 전 process-pressure guard 가 현재 사용자 process 수 / runner child 수를 관찰하고, 임계 초과 시 `process_pressure_guard` 또는 동등한 key=value warning 을 runner log/state 에 남긴다.
- [x] process-pressure guard 는 시스템 보호를 위해 이번 tick 의 adapter spawn 을 건너뛰거나 보수적으로 실패시킬 수 있지만, 사용자 명시 stop marker 없이 enabled runner 를 영구 stopped 상태로 남기지 않는다.
- [x] 구현은 `packages/cli/run-role.sh`와 `packages/cli/runners-project.sh` 안에만 머문다.
- [x] `bash -n packages/cli/run-role.sh packages/cli/runners-project.sh` exits 0.

## Next Action
- Complete: the inline merge finalizer integrated the AI-merged ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: Plan AI 가 `order_134`를 `prd_142`와 `tickets_141`로 승격했다.
- 직전 작업: `start-plan.sh 142`가 `prd_142`를 `tickets/done/prd_142/prd_142.md`로 보관하고 `tickets/todo/tickets_141.md`를 만들었다.
- 재개 시 먼저 볼 것: `run_with_timeout`의 watchdog cleanup, caller stdin 보존 회귀(`prd_125`), `runners-project.sh`의 loop-worker/stop process-tree cleanup, process-pressure guard 위치.
- Wiki/ticket constraints: wiki RAG는 직접 관련 결과 0건이었다. `prd_125`는 `run_with_timeout` stdin 보존을 이미 다뤘고, `prd_135`는 runner self-resurrect/user stop marker, `prd_140`/`prd_141`은 desktop readBoard 및 doctor/metrics latency를 다뤘으므로 이 티켓은 `run-role.sh`와 `runners-project.sh`에만 집중한다.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_142/prd_142.md at 2026-05-03T11:02:32Z.
- Planner wiki pass: `bin/autoflow wiki query --term "bash awk subshell leak run_with_timeout watchdog sleep 1200" --term "runner process leak process limit posix_spawn failed" --term "packages/cli/run-role.sh runners-project.sh process group cleanup" --term "order_127 self-resurrect runner cleanup" --term "doctor metrics IPC timeout system process limit" --limit 8 --rag` returned `result_count=0`.
- Relevant prior ticket: `tickets/done/prd_125/prd_125.md` requires `run_with_timeout` stdin preservation to remain covered while changing watchdog cleanup.
- Related scope boundaries: `tickets/done/prd_135/prd_135.md` owns runner self-resurrect/user stop marker behavior, `tickets/done/prd_140/prd_140.md` owns desktop `readBoard` fallback, and active `tickets_140` / `prd_141` owns doctor/metrics CLI latency. Do not edit `apps/desktop/src/main.js`, `packages/cli/metrics-project.sh`, `packages/cli/doctor-project.sh`, or `packages/cli/cli-common.sh` for this ticket.
- Guard warning: `bin/autoflow guard` at 2026-05-03T11:02:32Z returned `status=warning`, `error_count=0`, `warning_count=1`; warning was unrelated leftover worktree `autoflow/tickets_119` with no board ticket. Planner recorded it as cleanup evidence and did not delete or reset the worktree.

- Runtime hydrated worktree dependency at 2026-05-03T11:04:15Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- AI worker prepared todo at 2026-05-03T11:04:14Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_141; run=tickets/inprogress/verify_141.md
- AI worker prepared resume at 2026-05-03T11:04:32Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_141; run=tickets/inprogress/verify_141.md
- AI mini-plan at 2026-05-03T11:18:00Z:
  1. `packages/cli/run-role.sh`의 `run_with_timeout`에 재귀 process-tree TERM/KILL helper를 추가하고, 정상 종료 시 watchdog `sleep`과 marker를 즉시 정리한다.
  2. adapter spawn 직전에 process-pressure guard를 실행해 user process 수와 현재 runner child tree 수를 기록하고, 임계 초과 시 `process_pressure_guard` state/log를 남긴 뒤 adapter spawn만 건너뛰며 runner를 영구 stopped로 두지 않는다.
  3. `packages/cli/runners-project.sh`의 loop-worker `TERM`/`INT`, `runners stop`, tick/sleep child 정리를 동일한 process-tree cleanup helper로 통일하고, loop tick 전 guard warning/skip evidence를 남긴다.
  4. `prd_125`의 stdin 보존 회귀 조건은 PRD verification command의 `printf "data\n" | run_with_timeout 5 1 cat -`로 확인한다.
  5. Wiki pass: planner 기록의 RAG result 0건을 확인했고, owner도 `autoflow wiki query /Users/demoon2016/Documents/project/autoflow .autoflow ... --rag`를 재실행했다. 결과가 직접 관련 wiki 제약 없음이면 prior-ticket constraints는 `tickets/done/prd_125/prd_125.md`, `tickets/done/prd_135/prd_135.md`, `tickets/done/prd_140/prd_140.md` 범위를 따른다.
- Implementation completed at 2026-05-03T11:32:00Z inside allowed paths only:
  - `packages/cli/run-role.sh`: `run_with_timeout` now cleans child process trees on timeout, preserves stdin behavior, removes marker/watchdog state on normal exit, and adds adapter-spawn process-pressure guard evidence with idle skip semantics.
  - `packages/cli/runners-project.sh`: loop-worker stop and tick cleanup now use process-tree cleanup, and loop ticks emit `process_pressure_guard` state/log evidence before spawning adapters when thresholds are exceeded.
  - Wiki query against `/Users/demoon2016/Documents/project/autoflow .autoflow` returned `result_count=0`, matching planner context.
  - Worktree verification and PROJECT_ROOT post-merge verification both passed the PRD command; extra grandchild cleanup check returned `rc=124 before=0 after=0`.
- Queued without worktree commit at 2026-05-03T11:10:01Z: PROJECT_ROOT already matches the ticket worktree for all Allowed Paths with code changes.
- Impl AI worker marked verification pass at 2026-05-03T11:10:01Z; runtime finalizer will not perform merge operations.
- Coordinator post-merge cleanup at 2026-05-03T11:10:01Z: removed_worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_141 deleted_branch=autoflow/tickets_141.
- Inline merge finalizer (worker worker) finalized this verified ticket at 2026-05-03T11:10:01Z.
## Verification
- Run file: `tickets/done/prd_142/verify_141.md`
- Log file: `logs/verifier_141_20260503_111002Z_pass.md`
- Result: passed

## Result

- Summary: runner adapter process leak guard
- Remaining risk: timeout tests still produce bash `Terminated: 15` noise on stderr when the killed child is a shell; contract checks pass and no stale sleep remains.
