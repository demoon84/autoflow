# Ticket

## Ticket

- ID: Todo-179
- PRD Key: prd_180
- Plan Candidate: Plan AI handoff from tickets/done/prd_180/prd_180.md
- Title: repeated preflight failure recovery circuit
- Priority: critical
- Stage: done
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI: worker
- Last Updated: 2026-05-05T00:30:14Z

## Goal

- 이번 작업의 목표: worker 가 같은 `token_budget_exceeded` preflight skip 을 반복하면서 활성 티켓과 queue 를 계속 붙잡지 않도록, 반복 실패 카운터와 planner-visible recovery signal 을 추가한다.

## References

- PRD: tickets/done/prd_180/prd_180.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_180]]
- Plan Note:
- Ticket Note: [[Todo-179]]

## Allowed Paths

- `packages/cli/run-role.sh`
- `runtime/board-scripts/run-role.sh`
- `packages/cli/runners-project.sh`
- `runtime/board-scripts/runners-project.sh`
- `.autoflow/scripts/start-plan.sh`
- `runtime/board-scripts/start-plan.sh`
- `apps/desktop/src/main.js`
- `tests/smoke/repeated-preflight-circuit-breaker-smoke.sh`

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-179`
- Branch: autoflow/Todo-179
- Base Commit: 144e0b696d40d504ef9ea844fd46ab730fd9995c
- Worktree Commit: 
- Integration Status: already_in_project_root

## Goal Runtime
- Status: complete
- Started At: 2026-05-05T00:15:02Z
- Started Epoch: 1777940102
- Updated At: 2026-05-05T00:30:16Z
- Tick Count: 5
- Time Used Seconds: 914
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: complete
- Last Progress Fingerprint: 2186293242

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [x] budget/rate/prompt preflight skip 이 발생할 때 runner state 에 같은 skip result 의 연속 횟수와 마지막 skip 시각이 기록된다.
- [x] adapter 가 정상 종료되거나 skip result 가 바뀌면 preflight skip 연속 카운터가 0 또는 새 result 기준 1로 reset 된다.
- [x] 같은 `token_budget_exceeded` preflight skip 이 3회 연속 발생하는 임시 board smoke 에서 adapter command 는 4번째 동일 prompt retry 로 이어지지 않고 `circuit_breaker_tripped` evidence 를 남긴다.
- [x] circuit breaker evidence 에 원인 result(`token_budget_exceeded`), count, threshold, cooldown 종료 시각 또는 다음 허용 조건이 key=value 로 남는다.
- [x] active ticket 이 있는 상태에서 반복 preflight breaker 가 발동하면 runner state/list 또는 planner runtime output 에 `active_recovery_status=blocked`, `active_recovery_failure_class=tooling_failure`, `active_recovery_reason=repeated_preflight_skip` 또는 동등한 recovery signal 이 노출된다.
- [x] `tickets/inprogress/Todo-177.md` 같은 active ticket 이 `healthy` recovery 상태로만 보이는 모순이 재발하지 않도록, failure result 와 recovery signal 이 동시에 관찰된다.
- [x] `tickets/todo/Todo-178.md`가 소유한 stale token-cache guard 범위를 재구현하지 않고, 그 티켓과 충돌하는 테스트 파일/Allowed Paths 변경을 피한다.
- [x] `bash -n packages/cli/run-role.sh runtime/board-scripts/run-role.sh packages/cli/runners-project.sh runtime/board-scripts/runners-project.sh .autoflow/scripts/start-plan.sh runtime/board-scripts/start-plan.sh`, `node --check apps/desktop/src/main.js`, `bash tests/smoke/repeated-preflight-circuit-breaker-smoke.sh`, and `npm run desktop:check` exit 0.

## Next Action
- Complete: the inline merge finalizer integrated the AI-merged ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: 반복 preflight skip counter, `circuit_breaker_tripped` state/log/output, active recovery fields, runners list passthrough, desktop bridge parsing, and smoke coverage were implemented inside Allowed Paths.
- 직전 작업: worktree verification and PROJECT_ROOT post-merge verification both passed with `bash -lc 'bash -n packages/cli/run-role.sh runtime/board-scripts/run-role.sh packages/cli/runners-project.sh runtime/board-scripts/runners-project.sh .autoflow/scripts/start-plan.sh runtime/board-scripts/start-plan.sh && node --check apps/desktop/src/main.js && bash tests/smoke/repeated-preflight-circuit-breaker-smoke.sh && npm run desktop:check'`.
- 재개 시 먼저 볼 것: finalizer output only. The initial `verify-ticket-owner.sh` run failed because the PRD command was extracted with surrounding backticks; the same command was rerun with an explicit override and passed at 2026-05-05T00:29:34Z.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_180/prd_180.md at 2026-05-04T22:46:50Z.
- Planner wiki pass: `bin/autoflow wiki query --term "token_budget_exceeded circuit breaker worker active_recovery_status runner state" --rag` returned `result_count=0`.
- Relevant prior ticket: `tickets/done/prd_147/prd_147.md` implemented the first runner self-protection preflight and already covers timeout-only `consecutive_timeout_count`. Keep timeout fallback behavior intact; add a separate repeated preflight skip counter.
- Related active/todo ticket: `tickets/todo/Todo-178.md` owns stale token-cache source/freshness handling for `token_budget_exceeded`. This ticket should only handle repeated skip loop recovery and recovery visibility.
- Active blocker evidence from this planner tick: `.autoflow/runners/state/worker.state` still reports `active_ticket_id=Todo-177`, `active_recovery_status=healthy`, and `last_result=token_budget_exceeded`. The new implementation should make that contradiction observable as `blocked` / `tooling_failure` / `repeated_preflight_skip` or equivalent, without stopping or restarting runner processes.
- Guard warning: `bin/autoflow guard` at 2026-05-04T22:47Z returned `status=warning`, `error_count=0`, `warning_count=2`; existing cleanup candidates are leftover worktree `autoflow/Todo-119` with no board ticket and dirty done-ticket worktree `autoflow/Todo-163`. Planner recorded evidence and did not delete or reset worktrees.

- Runtime hydrated worktree dependency at 2026-05-05T00:15:01Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- AI worker prepared todo at 2026-05-05T00:15:01Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-179; run=tickets/inprogress/verify_179.md
- AI mini-plan at 2026-05-05T00:18Z:
  1. Add preflight-skip streak state to `packages/cli/run-role.sh` and mirror it in `runtime/board-scripts/run-role.sh`, keeping it separate from `consecutive_timeout_count`.
  2. Trip a repeated preflight circuit at threshold 3 with `last_result=circuit_breaker_tripped`, cause/count/threshold/cooldown key=value evidence, and active ticket recovery fields `blocked` / `tooling_failure` / `repeated_preflight_skip`.
  3. Preserve runner list and Desktop bridge passthrough fields, and add a focused smoke that proves the 3rd repeated `token_budget_exceeded` skip trips the breaker without a 4th adapter invocation.
  4. Do not implement stale token-cache source/freshness handling owned by `tickets/todo/Todo-178.md`.
- Wiki context pass during this owner tick: planner's prior wiki query in this ticket and `prd_180` returned `result_count=0`; a direct owner `autoflow wiki query` attempt with repeated preflight terms produced no output within 20s and was interrupted. Relevant constraints came from `tickets/done/prd_147/prd_147.md` and `tickets/todo/Todo-178.md`, not from wiki content.
- AI worker prepared resume at 2026-05-05T00:25:43Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-179; run=tickets/inprogress/verify_179.md
- Ticket owner verification failed by worker at 2026-05-05T00:29:11Z: command exited 127
- Ticket owner verification passed by worker at 2026-05-05T00:29:34Z: command exited 0
- Owner wiki context pass at 2026-05-05T00:26Z: `autoflow wiki query ... --rag` returned `result_count=0`; implementation followed `prd_180`, `tickets/done/prd_147/prd_147.md`, and `tickets/todo/Todo-178.md` constraints.
- Implementation evidence: `tests/smoke/repeated-preflight-circuit-breaker-smoke.sh` observes first/second `token_budget_exceeded` streak states, third-run `reason=circuit_breaker_tripped`, key=value cause/count/threshold/until fields, runner state/list recovery fields, and no adapter marker through the fourth run.
- Merge evidence: tracked Allowed Path content in `PROJECT_ROOT` matches the verified worktree for modified tracked files; new smoke file was added to `PROJECT_ROOT`; full verification passed from `PROJECT_ROOT`.
- Queued without worktree commit at 2026-05-05T00:30:13Z: PROJECT_ROOT already matches the ticket worktree for all Allowed Paths with code changes.
- Impl AI worker marked verification pass at 2026-05-05T00:30:13Z; runtime finalizer will not perform merge operations.
- Coordinator post-merge cleanup at 2026-05-05T00:30:14Z: removed_worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-179 deleted_branch=autoflow/Todo-179.
- Inline merge finalizer (worker worker) finalized this verified ticket at 2026-05-05T00:30:14Z.
## Verification
- Run file: `tickets/done/prd_180/verify_179.md`
- Log file: `logs/verifier_179_20260505_003015Z_pass.md`
- Result: passed

## Result

- Summary: repeated preflight skip circuit breaker
- Remaining risk: `Todo-178` still owns stale token-cache freshness/source handling and was intentionally not implemented here.
