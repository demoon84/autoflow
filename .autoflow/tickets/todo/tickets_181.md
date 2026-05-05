# Ticket

## Ticket

- ID: tickets_181
- PRD Key: prd_182
- Plan Candidate: Plan AI handoff from tickets/done/prd_182/prd_182.md
- Title: runner live log finalize cleanup
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-05T00:09:56Z

## Goal

- 이번 작업의 목표: adapter 호출이 정상 종료, 실패, timeout 으로 끝난 뒤 `.autoflow/runners/logs/` 에 완료된 `*_live_stdout.log` / `*_live_stderr.log` 파일이 남지 않도록 finalize와 stale janitor 경로를 보강하고, 현재 진행 중인 live log만 active 상태로 남게 만든다.

## References

- PRD: tickets/done/prd_182/prd_182.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_182]]
- Plan Note:
- Ticket Note: [[tickets_181]]

## Allowed Paths

- `packages/cli/run-role.sh`
- `runtime/board-scripts/run-role.sh`
- `packages/cli/runners-project.sh`
- `runtime/board-scripts/runners-project.sh`
- `packages/cli/cleanup-runner-logs.sh`
- `tests/smoke/runner-live-log-finalize-smoke.sh`
- `.autoflow/runners/logs/`

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

- [ ] fake adapter 정상 종료 fixture에서 adapter 실행 중에는 `_live_stdout.log`가 관찰되고, adapter 종료 후 해당 invocation의 `*_live_stdout.log` / `*_live_stderr.log`가 남지 않는다.
- [ ] fake adapter non-zero 종료와 timeout exit `124` fixture에서도 완료된 `*_live_stdout.log` / `*_live_stderr.log`가 남지 않고, runner state/log에는 기존 result 계약과 cleanup evidence가 남는다.
- [ ] active-running fixture(`active_stage=adapter_running`, current `last_stdout_log` 또는 `last_stderr_log`, 최근 mtime)는 stale janitor가 삭제하거나 rename하지 않는다.
- [ ] stale janitor는 runner state가 가리키지 않고 active loop PID도 없는 오래된 `_live_stdout.log` / `_live_stderr.log`만 정리하며, `cleaned_count=` 또는 동등한 key=value evidence를 출력한다.
- [ ] 현재 보드에서 active live file을 제외한 stale `*_live_stdout.log` 수가 정리 전보다 감소하거나, 감소하지 않는 경우 각 파일의 보존 사유가 verification evidence에 기록된다.
- [ ] `packages/cli/run-role.sh` 변경은 PRD_142/PRD_125 계약을 깨지 않는다: caller stdin 보존(`printf "data\n" | run_with_timeout 5 1 cat -` 출력 `data`)과 timeout exit code `124`가 유지된다.
- [ ] 새 구현은 완료된 adapter stdout을 무제한 `_stdout.log`로 영구 persist하지 않는다. smoke fixture에서 완료 후 새 `*_stdout.log` 누적이 발생하지 않는다.
- [ ] `bash -n packages/cli/run-role.sh runtime/board-scripts/run-role.sh packages/cli/runners-project.sh runtime/board-scripts/runners-project.sh packages/cli/cleanup-runner-logs.sh`, `bash tests/smoke/runner-live-log-finalize-smoke.sh`, and `npm run desktop:check` exit 0.

## Next Action

- 다음에 바로 이어서 할 일: 현재 active `tickets_177`가 같은 runner adapter 파일을 소유 중이므로, worker는 `tickets_177` 완료 후 이 티켓을 claim하고 `tickets/done/prd_182/prd_182.md`의 lifecycle/cleanup 제약을 기준으로 mini-plan, 구현, 검증, 머지까지 이어간다.

## Resume Context

- 현재 상태 요약: Plan AI 가 `order_163`을 `prd_182`와 `tickets_181`로 승격했고, source order는 `tickets/done/prd_182/order_163.md`로 보관됐다.
- 직전 작업: `.autoflow/scripts/start-plan.sh 182`가 `prd_182`를 `tickets/done/prd_182/prd_182.md`로 보관하고 `tickets/todo/tickets_181.md`를 만들었다.
- 재개 시 먼저 볼 것: `tickets/done/prd_182/prd_182.md`, `packages/cli/run-role.sh` adapter finalize path, `packages/cli/cleanup-runner-logs.sh`, stale live-log sweep, 현재 active `tickets_177`의 완료 여부.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_182/prd_182.md at 2026-05-05T00:09:56Z.
- Planner wiki pass: `bin/autoflow wiki query /Users/demoon2016/Documents/project/autoflow .autoflow --term "live_stdout log leak finalize rename run-role.sh" --term "adapter timeout cleanup _live_stdout.log runner logs" --term "PRD-135 stop reason marker run-role finalize" --term "order_134 bash leak order_136 fork-bomb order_162 token-cache stale" --term "adapter-running state heartbeat tickets_177" --limit 10 --rag` returned `result_count=0`; no direct wiki chunk constrained the scope.
- Relevant ticket finding: `tickets/done/prd_120/prd_120.md` already introduced stale live-log sweep and `cleanup-runner-logs`; extend that path safely instead of creating a disconnected cleaner.
- Relevant ticket finding: `tickets/done/prd_123/prd_123.md` ended unbounded `_stdout.log` persistence. Even though the source order suggests `_live_stdout.log` -> `_stdout.log` rename, this ticket must not revive completed stdout accumulation.
- Relevant ticket finding: `tickets/done/prd_142/prd_142.md` and `tickets/done/prd_125/prd_125.md` cover `run_with_timeout` watchdog cleanup and stdin preservation. Keep those as regression checks, not a broad rewrite.
- Relevant ticket finding: `tickets/done/prd_177/prd_177.md` still treats current `_live_stdout.log` as an active-token source, so cleanup must run after telemetry/token extraction consumes the live file.
- Active queue constraint: `tickets/inprogress/tickets_177.md` currently owns overlapping `run-role.sh` / `runners-project.sh` files for adapter-running heartbeat. Worker serialization should naturally defer this ticket until that active ticket lands.
- Guard warning: `bin/autoflow guard /Users/demoon2016/Documents/project/autoflow .autoflow` at 2026-05-05T00:10Z returned `status=warning`, `error_count=0`, `warning_count=2`; unrelated cleanup candidates are leftover worktree `autoflow/tickets_119` with no board ticket and dirty done-ticket worktree `autoflow/tickets_163`. Planner recorded the evidence and did not delete or reset worktrees.

## Verification

- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
