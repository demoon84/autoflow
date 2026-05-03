# Ticket

## Ticket

- ID: tickets_140
- PRD Key: prd_141
- Plan Candidate: Plan AI handoff from tickets/done/prd_141/prd_141.md
- Title: doctor metrics concurrent CLI latency guard
- Stage: done
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI: worker
- Last Updated: 2026-05-03T11:02:55Z

## Goal

- 이번 작업의 목표: `bin/autoflow doctor`와 `bin/autoflow metrics`가 데스크톱 보드 refresh에서 병렬 호출될 때 30초 IPC timeout을 유발하지 않도록 CLI 쪽 병목과 중복 traversal을 줄인다.

## References

- PRD: tickets/done/prd_141/prd_141.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_141]]
- Plan Note:
- Ticket Note: [[tickets_140]]

## Allowed Paths

- `packages/cli/metrics-project.sh`
- `packages/cli/doctor-project.sh`
- `packages/cli/cli-common.sh`

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_140`
- Branch: autoflow/tickets_140
- Base Commit: 3918d37a47139916ef78cb8234386e4cd6558467
- Worktree Commit: 
- Integration Status: already_in_project_root

## Goal Runtime
- Status: complete
- Started At: 2026-05-03T10:57:00Z
- Started Epoch: 1777805820
- Updated At: 2026-05-03T11:02:55Z
- Tick Count: 3
- Time Used Seconds: 355
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: complete
- Last Progress Fingerprint: 1064176809

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [x] `packages/cli/metrics-project.sh`에서 `.autoflow/tickets/done` 전체 ticket/git history scan, `.autoflow/logs` verifier scan, `.autoflow/telemetry/runs.jsonl` token aggregation 중 무거운 계산이 병렬 호출마다 중복 실행되지 않도록 bounded cache, incremental read, 또는 stale fallback이 적용된다.
- [x] `packages/cli/doctor-project.sh`에서 active ticket / worktree diagnostics는 유지하되, `metrics`와 동시에 실행될 때 같은 board-wide traversal을 장시간 직렬화하지 않는 guard가 있다.
- [x] `doctor`와 `metrics`가 같은 cache 또는 traversal lock을 사용할 경우 lock 대기는 30초 IPC timeout까지 기다리지 않고 즉시 stale 값 또는 partial key=value 결과로 돌아온다.
- [x] 병렬 검증에서 `status`, `doctor`, `metrics`, `stop-hook-status`, `watch-status`를 동시에 실행해도 각 command가 5초 미만에 exit 0으로 끝난다.
- [x] `bash -n packages/cli/metrics-project.sh packages/cli/doctor-project.sh packages/cli/cli-common.sh` exits 0.

## Next Action
- Complete: the inline merge finalizer integrated the AI-merged ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: Plan AI 가 `order_133`을 `prd_141`과 `tickets_140`으로 승격했다.
- 직전 작업: `start-plan.sh 141`이 `prd_141`을 `tickets/done/prd_141/prd_141.md`로 보관하고 `tickets/todo/tickets_140.md`를 만들었다.
- 재개 시 먼저 볼 것: PRD, Goal, Allowed Paths, Done When, 그리고 `packages/cli/metrics-project.sh`의 `count_autoflow_commit_metrics`, `count_autoflow_token_metrics`, `count_latest_verifier_outcomes` 및 `packages/cli/doctor-project.sh`의 active ticket/worktree diagnostics.
- Wiki/ticket constraints: wiki RAG는 `tickets/done/prd_140/prd_140.md`를 관련 맥락으로 반환했다. `prd_140` / active `tickets_139`가 `apps/desktop/src/main.js`의 `readBoard` stale fallback을 소유하므로 이 티켓은 CLI doctor/metrics 병목에 집중하고 Electron main process는 수정하지 않는다.
- 완료 직전 상태: worktree와 PROJECT_ROOT 모두 `packages/cli/metrics-project.sh`, `packages/cli/doctor-project.sh`, `packages/cli/cli-common.sh`만 수정했다. PROJECT_ROOT에서 syntax check와 병렬 command 검증이 exit 0으로 통과했다.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_141/prd_141.md at 2026-05-03T10:56:16Z.
- Planner wiki pass: `bin/autoflow wiki query --term "doctor metrics lock desktop-cache" --term "metrics-project.sh doctor-project.sh cli traversal lock" --term "readBoard IPC timeout doctor metrics" --term "telemetry-runs.jsonl tickets done logs traversal" --term "apps/desktop/src/main.js cache stale-while-revalidate" --limit 8 --rag` returned `result_count=2`.
- Relevant prior ticket: `tickets/done/prd_140/prd_140.md` already covers `readBoard` stale-while-revalidate fallback in `apps/desktop/src/main.js`; keep this ticket disjoint from active `tickets_139`.
- Repository context: `metrics-project.sh` scans `tickets/done`, `.autoflow/logs`, and `.autoflow/telemetry/runs.jsonl`; `doctor-project.sh` records active ticket/worktree diagnostics and repeated verifier failure recovery candidates.
- Runtime note: unscoped rerun of `start-plan.sh` after PRD creation surfaced next inbox item `order_134`; planner then scoped `start-plan.sh 141` to complete this order's PRD-to-todo handoff without starting the next order.
- Guard warning: `bin/autoflow guard` at 2026-05-03T10:56:28Z returned `status=warning`, `error_count=0`, `warning_count=1`; warning was unrelated leftover worktree `autoflow/tickets_119` and planner did not delete or reset it.

- Runtime hydrated worktree dependency at 2026-05-03T10:56:59Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- AI worker prepared todo at 2026-05-03T10:56:58Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_140; run=tickets/inprogress/verify_140.md
- AI worker prepared resume at 2026-05-03T10:57:14Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_140; run=tickets/inprogress/verify_140.md
- AI mini-plan at 2026-05-03T10:59:30Z:
  - Wiki context pass: `bin/autoflow wiki query --term "doctor metrics concurrent CLI latency guard" --term "metrics-project.sh doctor-project.sh traversal cache lock" --term "telemetry runs tickets done logs verifier scan" --term "readBoard IPC timeout stale fallback prd_140" --limit 8 --rag` returned `tickets/done/prd_141/prd_141.md`; existing ticket note also records prior `tickets/done/prd_140/prd_140.md` as the Electron `readBoard` stale fallback owner, so this owner will not edit `apps/desktop/src/main.js`.
  - Implement a bounded CLI cache/lock in `packages/cli/cli-common.sh` and use it from `packages/cli/metrics-project.sh` for done-ticket git history, verifier log outcomes, and telemetry token aggregation.
  - Keep `doctor` active ticket/worktree diagnostics, but add a NOWAIT guard so it emits partial diagnostic keys instead of waiting behind the metrics heavy traversal lock.
  - Verify with syntax check and the PRD parallel command from the worktree, then merge the same allowed-path changes to PROJECT_ROOT and rerun verification there.
- Implementation evidence:
  - `cli-common.sh`에 `.autoflow/runners/state/cli-cache` 기반 cache path, cache age/freshness, NOWAIT lock acquire/release helper를 추가했다.
  - `metrics-project.sh`는 verifier log outcomes, done-ticket git history/code volume, telemetry token aggregation을 `metrics-heavy.kv` TTL cache로 묶고 lock busy 시 `stale_lock_busy` 또는 `partial_lock_busy_no_cache`를 출력한다.
  - `doctor-project.sh`는 같은 `metrics-heavy` lock이 busy이면 active ticket count와 `doctor.active_ticket_diagnostics_status=partial_lock_busy`를 출력하고 상세 worktree traversal을 기다리지 않는다.
  - Lock fallback spot-check: 강제로 `metrics-heavy.lock`을 잡은 상태에서 `AUTOFLOW_METRICS_HEAVY_CACHE_TTL_SECONDS=0 bin/autoflow metrics /Users/demoon2016/Documents/project/autoflow`가 `metrics_heavy_cache_status=stale_lock_busy`를 출력했고, `bin/autoflow doctor /Users/demoon2016/Documents/project/autoflow`는 `doctor.active_ticket_diagnostics_status=partial_lock_busy`와 `check.operational_blockers=partial_lock_busy`를 출력했다.
  - PROJECT_ROOT verification: `bash -lc 'bash -n packages/cli/metrics-project.sh packages/cli/doctor-project.sh packages/cli/cli-common.sh && python3 -c "...parallel status/doctor/metrics/stop-hook-status/watch-status..."'` exited 0 with durations `{'status': 0.43, 'doctor': 2.32, 'metrics': 2.28, 'stop-hook-status': 0.19, 'watch-status': 0.06}`.
- Queued without worktree commit at 2026-05-03T11:02:54Z: PROJECT_ROOT already matches the ticket worktree for all Allowed Paths with code changes.
- Impl AI worker marked verification pass at 2026-05-03T11:02:54Z; runtime finalizer will not perform merge operations.
- Coordinator post-merge cleanup at 2026-05-03T11:02:55Z: removed_worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_140 deleted_branch=autoflow/tickets_140.
- Inline merge finalizer (worker worker) finalized this verified ticket at 2026-05-03T11:02:55Z.
## Verification
- Run file: `tickets/done/prd_141/verify_140.md`
- Log file: `logs/verifier_140_20260503_110255Z_pass.md`
- Result: passed

## Result

- Summary: CLI metrics heavy traversal cache and doctor NOWAIT guard
- Remaining risk: Metrics cache TTL is intentionally short (`AUTOFLOW_METRICS_HEAVY_CACHE_TTL_SECONDS`, default 10s), so near-real-time values can be stale during refresh contention but commands return before the IPC timeout.
