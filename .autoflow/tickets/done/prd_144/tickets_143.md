# Ticket

## Ticket

- ID: tickets_143
- PRD Key: prd_144
- Plan Candidate: Plan AI handoff from tickets/done/prd_144/prd_144.md
- Title: desktop listRunners IPC fork-bomb guard
- Stage: done
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI: worker
- Last Updated: 2026-05-03T11:35:37Z

## Goal

- 이번 작업의 목표: Desktop `autoflow:listRunners` IPC가 반복 호출될 때 `runners-project.sh list` subprocess를 무제한 생성하지 않도록 inflight/TTL guard와 timeout cleanup 경계를 추가한다.

## References

- PRD: tickets/done/prd_144/prd_144.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_144]]
- Plan Note:
- Ticket Note: [[tickets_143]]

## Allowed Paths

- `apps/desktop/src/main.js`
- `packages/cli/runners-project.sh`

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_143`
- Branch: autoflow/tickets_143
- Base Commit: 17fe1bfa180cf3746b68763a209b8dd04cb88c4b
- Worktree Commit: 
- Integration Status: already_in_project_root

## Goal Runtime
- Status: complete
- Started At: 2026-05-03T11:28:31Z
- Started Epoch: 1777807711
- Updated At: 2026-05-03T11:35:38Z
- Tick Count: 5
- Time Used Seconds: 427
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: complete
- Last Progress Fingerprint: 665730294

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [x] `apps/desktop/src/main.js`의 `autoflow:listRunners` handler는 같은 `projectRoot`/`boardDirName`에 대해 진행 중인 runner list 호출이 있으면 동일 Promise 또는 fallback/cache 결과를 반환하고 새 `runners-project.sh list` subprocess를 만들지 않는다.
- [x] runner list TTL cache가 있어 2초 내 반복 standalone `autoflow:listRunners` 호출은 새 subprocess 없이 cached result 또는 machine-readable fallback result를 반환한다.
- [x] IPC 30초 timeout 또는 caller cancellation이 발생하면 해당 invocation에서 시작한 runner-list child process가 SIGTERM을 받고, 정해진 grace period 후에도 남아 있으면 SIGKILL 대상이 된다.
- [x] `ps`로 관찰 가능한 `runners-project.sh list <project> .autoflow` 프로세스가 Desktop runner 화면을 30초 유지한 뒤 누적 증가하지 않는 구조임을 코드와 smoke 절차로 확인할 수 있다.
- [x] `packages/cli/runners-project.sh list`에 자기 호출 loop나 unbounded child fan-out이 발견되면 제거되고, 발견되지 않으면 수정 없이 evidence를 남긴다.
- [x] 구현은 `apps/desktop/src/main.js`와 `packages/cli/runners-project.sh` 안에만 머문다.
- [x] `bash -lc 'bash -n packages/cli/runners-project.sh && npm run desktop:check'` exits 0.

## Next Action
- Complete: the inline merge finalizer integrated the AI-merged ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: Plan AI 가 backlog PRD 에서 todo 티켓을 생성한 직후.
- 직전 작업: `scripts/start-plan.sh 144`가 `prd_144`를 `tickets/done/prd_144/prd_144.md`로 보관하고 `tickets/todo/tickets_143.md`를 만들었다.
- 재개 시 먼저 볼 것: `tickets/done/prd_144/prd_144.md`, `apps/desktop/src/main.js`의 `listRunners`, `listRunnersCachedOrRefresh`, `withTimeout`, `runAutoflowArgs`, 그리고 `ipcMain.handle("autoflow:listRunners", ...)`.
- Wiki/ticket constraints: wiki RAG는 직접 관련 결과 0건이었다. `prd_140`은 `readBoard` timeout fallback 범위이고, `prd_142`는 generic runner adapter watchdog/process cleanup 범위이므로 이번 작업은 standalone `autoflow:listRunners` IPC 방어에 집중한다.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_144/prd_144.md at 2026-05-03T11:20:50Z.
- Planner wiki pass: `bin/autoflow wiki query --term "listRunners IPC fork-bomb runners-project.sh list child process timeout" --term "priority order PRD todo verify list_matching_files extract_priority_rank" --term "blocked-dirty orchestration worker stuck tickets_142 dirty_root auto-recover" --term "orchestration intervention check ledger tickets/check automatic intervention history" --limit 10 --rag` returned `result_count=0`.
- Relevant prior ticket: `tickets/done/prd_140/prd_140.md` explicitly left standalone `autoflow:listRunners` IPC redesign to `order_136`; do not rework the broader `readBoard` fallback in this ticket.
- Relevant prior ticket: `tickets/done/prd_142/prd_142.md` owns generic runner adapter watchdog/process cleanup; do not broaden this ticket into `packages/cli/run-role.sh` or generic runner lifecycle changes.

- Runtime hydrated worktree dependency at 2026-05-03T11:28:30Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- AI worker prepared todo at 2026-05-03T11:28:29Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_143; run=tickets/inprogress/verify_143.md
- Mini-plan (worker, 2026-05-03): `bin/autoflow wiki query --term "listRunners IPC fork-bomb runners-project.sh list child process timeout" --term "autoflow:listRunners listRunnersCachedOrRefresh withTimeout runAutoflowArgs" --term "desktop runner list TTL cache inflight Promise cancellation" --limit 10 --rag` returned only `tickets/done/prd_144/prd_144.md`, so implementation follows the current PRD with no extra wiki constraints. Plan: (1) add cancellable child cleanup to `runAutoflowArgs`/IPC timeout so timeout or invocation cancel sends SIGTERM and bounded SIGKILL to the spawned CLI process tree, (2) route standalone `autoflow:listRunners` through per-scope inflight sharing plus a 2s TTL cache instead of direct `listRunners`, (3) inspect `packages/cli/runners-project.sh list` for self-recursive fan-out and leave it unchanged if none is present, then run the declared verification from the worktree and project root after merge.
- AI worker prepared resume at 2026-05-03T11:31:42Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_143; run=tickets/inprogress/verify_143.md
- Implementation evidence (worker, 2026-05-03T11:34:24Z): `ipcMain.handle("autoflow:listRunners", ...)` now calls `listRunnersStandalone`, which uses the shared `readBoardRunnerListCache` key by `projectRoot`/`boardDirName`, returns a fresh result within `standaloneRunnerListCacheTtlMs = 2000`, and awaits the existing `entry.promise` when a refresh is in flight instead of spawning a new `runners-project.sh list`.
- Timeout/cancellation evidence: `withTimeout` now attaches an `AbortSignal` to IPC options, `runAutoflowArgs` listens to that signal, and `cancelInvocation`/timeout both route through `terminateAutoflowChild`, which sends SIGTERM to the spawned child process tree and schedules SIGKILL after `autoflowChildKillGraceMs = 1500`.
- Smoke/evidence: before cleanup, `ps -ef | grep 'runners-project.sh list /Users/demoon2016/Documents/project/autoflow .autoflow' | grep -v grep | wc -l` showed `2735`, causing `fork: Resource temporarily unavailable`; after exact target cleanup and code verification, the same count was `0`. The new IPC path prevents repeated Desktop runner screen refreshes from creating a new standalone list subprocess while a same-scope refresh is in flight or while the 2s cache is fresh.
- CLI inspection evidence: `packages/cli/runners-project.sh` `list_runners()` only reads config/state/log fields and prints runner records; grep found self-spawn only for `loop-worker` start paths, not for `list`, so `packages/cli/runners-project.sh` was left unchanged.
- Verification evidence: worktree command `bash -lc 'bash -n packages/cli/runners-project.sh && npm run desktop:check'` exited 0; PROJECT_ROOT rerun of the same command exited 0 after integration.
- Queued without worktree commit at 2026-05-03T11:35:37Z: PROJECT_ROOT already matches the ticket worktree for all Allowed Paths with code changes.
- Impl AI worker marked verification pass at 2026-05-03T11:35:36Z; runtime finalizer will not perform merge operations.
- Coordinator post-merge cleanup at 2026-05-03T11:35:37Z: removed_worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_143 deleted_branch=autoflow/tickets_143.
- Inline merge finalizer (worker worker) finalized this verified ticket at 2026-05-03T11:35:37Z.
## Verification
- Run file: `tickets/done/prd_144/verify_143.md`
- Log file: `logs/verifier_143_20260503_113538Z_pass.md`
- Result: passed

## Result

- Summary: standalone listRunners IPC inflight TTL guard and child cleanup
- Remaining risk: Manual UI smoke was represented by process-count observation and static code path review in this non-interactive tick; no browser tab was opened.
