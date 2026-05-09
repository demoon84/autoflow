# Ticket

## Ticket

- ID: Todo-100
- PRD Key: prd_104
- Plan Candidate: Plan AI handoff from tickets/done/prd_104/prd_104.md
- Title: 데스크톱 readBoard metrics 콜드 스타트 타임아웃 제거
- Stage: done
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI: worker
- Last Updated: 2026-05-02T02:26:14Z

## Goal

- 이번 작업의 목표: 데스크톱 앱 시작 직후 `autoflow:readBoard` IPC가 `autoflow metrics` 콜드 실행을 기다리다가 30초 타임아웃으로 실패하지 않도록, metrics 진단을 readBoard critical path 밖으로 빼거나 stale/empty 값을 즉시 반환하도록 정리한다.

## References

- PRD: tickets/done/prd_104/prd_104.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_104]]
- Plan Note:
- Ticket Note: [[Todo-100]]

## Allowed Paths

- `apps/desktop/src/main.js`

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-100`
- Branch: autoflow/Todo-100
- Base Commit: d28c98ef2d6defa80307e7c3f54552225b50e6ac
- Worktree Commit: 
- Integration Status: already_in_project_root

## Goal Runtime
- Status: complete
- Started At: 2026-05-02T02:11:05Z
- Started Epoch: 1777687865
- Updated At: 2026-05-02T02:26:15Z
- Tick Count: 5
- Time Used Seconds: 910
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: complete
- Last Progress Fingerprint: 2169562807

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [x] 데스크톱 앱 cold start 직후 첫 `window.autoflow.readBoard(...)` 호출이 `autoflow metrics` 콜드 실행을 기다리느라 30초 IPC 타임아웃으로 실패하지 않는다. Evidence: `readBoard()` now calls `runAutoflowCachedOrRefresh("metrics", ...)`; cold miss starts `startCachedAutoflowRefresh()` in the background and immediately returns `emptyCachedAutoflowResult()` instead of awaiting the metrics promise.
- [x] `readBoard()`는 metrics 캐시가 없을 때도 board status, tickets, runners, logs, wiki files 등 핵심 snapshot을 반환한다. Evidence: only the metrics diagnostic uses the new non-blocking helper; status, runners, doctor, stop-hook, watch, tickets, logs, and wiki file collection remain on the existing path.
- [x] metrics 캐시가 있으면 stale 값이라도 즉시 반환되고, 백그라운드 refresh가 시작되어 다음 readBoard에서 갱신된 metrics를 사용할 수 있다. Evidence: `runAutoflowCachedOrRefresh()` clones fresh/stale `entry.result` immediately and starts `startCachedAutoflowRefresh()` when the cached result is stale and no refresh is already running.
- [x] `autoflow metrics` CLI가 느린 상태여도 `autoflow:readBoard`의 `withTimeout(..., 30000)` 한계 안에서 응답한다. Evidence: metrics cold miss no longer contributes an awaited metrics CLI promise to `readBoard()`; the IPC handler still uses `withTimeout(withScopeMemory(readBoard), 30000)`.
- [x] `writeMetricsSnapshot()` 이후 cache clear 상태에서도 다음 `readBoard()`가 metrics 갱신 완료를 동기적으로 기다리지 않는다. Evidence: `clearReadBoardDiagnosticCache("metrics", ...)` removes the entry, and the next `runAutoflowCachedOrRefresh("metrics", ...)` creates a background refresh while returning an empty metrics result immediately.
- [x] `doctor` 캐시, status/runners/stop-hook/watch 진단 결과, 기존 `board.metrics` parsing shape는 의도치 않게 깨지지 않는다. Evidence: `runAutoflowCached()` remains unchanged for `doctor`; other diagnostics are unchanged; `board.metrics` still parses `metricsResult.stdout`, which is `{}` on empty stdout and normal key/value shape when cached metrics exists.
- [x] 구현은 Allowed Paths 안에 머문다. Evidence: worktree product diff only changes `apps/desktop/src/main.js`.
- [x] `npm run desktop:check` exit 0. Evidence: 직접 실행 및 `verify-ticket-owner.sh 100 'npm run desktop:check'` both recorded exit 0 in `tickets/inprogress/verify_100.md`.

## Next Action
- Complete: the inline merge finalizer integrated the AI-merged ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: worktree에서 `apps/desktop/src/main.js`만 수정해 metrics cold-miss/stale path를 `readBoard()` critical path 밖으로 분리했고, `npm run desktop:check`가 통과했다.
- 직전 작업: PROJECT_ROOT의 `apps/desktop/src/main.js`가 ticket worktree와 동일함을 `git diff --no-index` exit 0으로 확인했고, PROJECT_ROOT에서 `npm run desktop:check`를 직접 재실행해 exit 0을 확인했다.
- 재개 시 먼저 볼 것: finalizer pass 결과.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_104/prd_104.md at 2026-05-02T02:08:44Z.
- Planner wiki context: `./bin/autoflow wiki query . --term 'readBoard IPC timeout' --term 'autoflow:readBoard' --term 'runAutoflowCached' --term 'autoflow metrics' --term 'desktop cold start metrics 82s' --term 'apps/desktop/src/main.js' --term 'desktop renderer dirty root finalization blocker' --term 'planner-worker lifecycle boundaries' --limit 12` surfaced prior `apps/desktop/src/main.js` IPC work in `tickets/done/prd_002/Todo-002.md` and `tickets/done/prd_079/Todo-077.md`, plus metrics usage context in `tickets/done/prd_013/prd_013.md`; no completed metrics cold-start fix was found.
- AI worker mini-plan at 2026-05-02T02:12:02Z: wiki query `./bin/autoflow wiki query . --term 'readBoard IPC timeout' --term 'autoflow:readBoard' --term 'runAutoflowCached' --term 'autoflow metrics' --term 'apps/desktop/src/main.js' --limit 12` again surfaced `tickets/done/prd_002/Todo-002.md`, `tickets/done/prd_079/prd_079.md`, and this `tickets/done/prd_104/prd_104.md`; it confirmed prior main-process IPC work but no existing metrics cold-start fix. Plan: add a metrics-specific cached runner that returns a cloned fresh/stale result immediately, starts a background refresh on stale/missing cache, and returns an empty successful metrics result on cold miss so `readBoard()` can still build status/tickets/runners/logs/wiki snapshot within the IPC timeout. Keep doctor/status/runners/stop-hook/watch behavior unchanged and verify with `npm run desktop:check`.
- Planning constraint: current code awaits `runAutoflowCached("metrics", ...)` inside `readBoard()`'s diagnostic `Promise.all`, and cold-miss `runAutoflowCached()` waits for `startCachedAutoflowRefresh(...).then(cloneRunResult)`. Fix the critical path without changing the `autoflow:readBoard` IPC channel.
- Planning constraint: keep this main-process-only unless implementation proves impossible. Renderer lazy metrics UI or a new `autoflow:readMetrics` IPC should be a follow-up PRD because it broadens preload/renderer contracts.
- Planning constraint: `reject_003`, `reject_071`, and `reject_074` remain parked as `needs_user` retry-limit/dirty-root blockers. Do not requeue or mix those blockers into this implementation.

- Runtime hydrated worktree dependency at 2026-05-02T02:11:04Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- AI worker prepared todo at 2026-05-02T02:11:03Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-100; run=tickets/inprogress/verify_100.md
- Ticket owner verification failed by worker at 2026-05-02T02:13:05Z: command exited 127
- Ticket owner verification passed by worker at 2026-05-02T02:13:14Z: command exited 0
- AI worker prepared resume at 2026-05-02T02:25:16Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-100; run=tickets/inprogress/verify_100.md
- AI worker merge audit at 2026-05-02T02:25:57Z: `PROJECT_ROOT/apps/desktop/src/main.js` matched the ticket worktree (`git diff --no-index` exit 0); PROJECT_ROOT `npm run desktop:check` exit 0. Wiki query for `readBoard metrics cold start timeout apps/desktop/src/main.js` returned `result_count=0`, so no additional wiki constraint changed the plan.
- Queued without worktree commit at 2026-05-02T02:26:13Z: PROJECT_ROOT already matches the ticket worktree for all Allowed Paths with code changes.
- Impl AI worker marked verification pass at 2026-05-02T02:26:13Z; runtime finalizer will not perform merge operations.
- Coordinator post-merge cleanup at 2026-05-02T02:26:14Z: removed_worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-100 deleted_branch=autoflow/Todo-100.
- Inline merge finalizer (worker worker) finalized this verified ticket at 2026-05-02T02:26:14Z.
## Verification
- Run file: `tickets/done/prd_104/verify_100.md`
- Log file: `logs/verifier_100_20260502_022615Z_pass.md`
- Result: passed

## Result

- Summary: readBoard metrics 진단을 non-blocking cache refresh로 전환해 cold start IPC timeout을 제거
- Remaining risk: 수동 앱 cold-start 브라우저 확인은 수행하지 않았고, 코드 경로 검토와 `npm run desktop:check`로 검증했다.
