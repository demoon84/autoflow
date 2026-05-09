# Ticket

## Ticket

- ID: Todo-146
- PRD Key: prd_147
- Plan Candidate: Plan AI handoff from tickets/done/prd_147/prd_147.md
- Title: runner self-protection budget guard
- Stage: done
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI: worker
- Last Updated: 2026-05-03T11:55:16Z

## Goal

- 이번 작업의 목표: Autoflow runner 가 adapter 호출 전에 토큰 quota, 호출 간격, prompt 크기, 반복 timeout 상태를 검사해 비용 폭탄과 provider rate limit 을 막고, 차단 사유를 runner state/log 에 남기게 한다.

## References

- PRD: tickets/done/prd_147/prd_147.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_147]]
- Plan Note:
- Ticket Note: [[Todo-146]]

## Allowed Paths

- `packages/cli/run-role.sh`
- `packages/cli/telemetry-project.sh`
- `.autoflow/policies/budget.toml`

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-146`
- Branch: autoflow/Todo-146
- Base Commit: 9168880767e524ffbcdba470acaf43c52f2a5c1e
- Worktree Commit: 
- Integration Status: already_in_project_root

## Goal Runtime
- Status: complete
- Started At: 2026-05-03T11:48:38Z
- Started Epoch: 1777808918
- Updated At: 2026-05-03T11:55:17Z
- Tick Count: 3
- Time Used Seconds: 399
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: complete
- Last Progress Fingerprint: 2640157237

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [x] `.autoflow/policies/budget.toml` 가 존재하고 `planner`, `worker`, `verifier`, `wiki`, `default` policy 섹션 또는 동등한 runner별 override 구조를 포함한다.
- [x] `packages/cli/run-role.sh` 는 adapter spawn 전에 token quota, minimum interval, prompt byte cap, timeout circuit breaker 를 검사하는 단일 preflight 경로를 가진다.
- [x] runner 별 token quota 초과 시 adapter command 는 실행되지 않고 runner state 에 `last_result=token_budget_exceeded`, `status=idle`, quota/usage evidence 가 기록된다.
- [x] `minimum_interval_seconds` 미달 시 adapter command 는 실행되지 않고 runner state/log 에 `last_result=rate_limited` 와 다음 허용 시각 또는 남은 초가 기록된다.
- [x] prompt byte cap 초과 시 adapter command 는 실행되지 않고 runner state/log 에 `last_result=prompt_size_exceeded`, `prompt_bytes=N`, `prompt_byte_cap=M` 이 기록된다.
- [x] `consecutive_timeout_count >= timeout_circuit_breaker_threshold` 상태에서 cooldown 이 남아 있으면 adapter command 는 실행되지 않고 runner state/log 에 `last_result=circuit_breaker_tripped`, `circuit_breaker_until=<ISO8601>` 이 기록된다.
- [x] quota/rate/prompt/circuit breaker 중 어떤 preflight 차단도 기존 `adapter_timeout` exit 124 기록, 성공 시 `consecutive_timeout_count=0` reset, telemetry recording 경로를 깨지 않는다.
- [x] 구현은 Allowed Paths 안에만 머문다.
- [x] `bash -lc 'bash -n packages/cli/run-role.sh packages/cli/telemetry-project.sh && test -f .autoflow/policies/budget.toml && grep -q "token_budget_exceeded" packages/cli/run-role.sh && grep -q "rate_limited" packages/cli/run-role.sh && grep -q "prompt_size_exceeded" packages/cli/run-role.sh && grep -q "circuit_breaker_tripped" packages/cli/run-role.sh'` exits 0.

## Next Action
- Complete: the inline merge finalizer integrated the AI-merged ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: Plan AI 가 `order_139`를 `prd_147`과 `Todo-146`으로 승격했다.
- 직전 작업: `.autoflow/scripts/start-plan.sh 147`이 `prd_147`을 `tickets/done/prd_147/prd_147.md`로 보관하고 `tickets/todo/Todo-146.md`를 만들었다.
- 재개 시 먼저 볼 것: `tickets/done/prd_147/prd_147.md`, `packages/cli/run-role.sh`의 adapter 호출 직전 경로, `run_role_record_worker_tick_telemetry`, `consecutive_timeout_count` / `adapter_timeout_fallback` state write, `packages/cli/telemetry-project.sh`의 `runs.jsonl` query/record schema.
- Wiki/ticket constraints: wiki RAG는 직접 관련 budget/rate precedent 대신 `tickets/done/prd_145/prd_145.md` priority scheduling verification chunk 1건만 반환했다. 관련 완료 티켓 기준으로 `prd_142`는 generic runner process leak guard, `prd_144`는 Desktop standalone `listRunners` fork-bomb guard, `prd_143`는 check_NNN ledger, `prd_128`/`prd_123`은 telemetry source 를 각각 완료했다. 이 티켓은 `run-role.sh` preflight 와 `.autoflow/policies/budget.toml`에만 집중한다.
- 구현/검증 결과: Allowed Paths 세 파일만 변경했고 worktree 및 PROJECT_ROOT 에서 필수 verification command 가 exit 0. `telemetry-project.sh self-test` 도 exit 0. 임시 policy smoke 로 `token_budget_exceeded`, `rate_limited`, `prompt_size_exceeded`, `circuit_breaker_tripped` 모두 adapter spawn 전 skip evidence 를 확인했다.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_147/prd_147.md at 2026-05-03T11:42:48Z.
- Planner wiki pass: `bin/autoflow wiki query --term "resource exhaustion DOS PID fan-out token budget rate limit anomaly detection fork-bomb" --term "listRunners IPC fork-bomb order_134 order_136 child process timeout cleanup" --term "telemetry token budget PRD-129 runs.jsonl budget policy" --term "prompt injection order inbox create 1000 PRDs spawn workers" --term "emergency stop halt all circuit breaker runner timeout" --limit 12 --rag` returned `result_count=1`, but the only RAG chunk was `tickets/done/prd_145/prd_145.md` lines 79-103 and did not alter this budget/rate scope.
- Relevant prior ticket: `tickets/done/prd_142/prd_142.md` / `Todo-141` already completed `run_with_timeout` process-tree cleanup and process-pressure guard. Do not rework PID cleanup in this ticket.
- Relevant prior ticket: `tickets/done/prd_144/prd_144.md` / `Todo-143` already completed Desktop `autoflow:listRunners` inflight/TTL guard and child cleanup. Do not edit `apps/desktop/src/main.js`.
- Relevant prior ticket: `tickets/done/prd_128/prd_128.md` expanded telemetry recording beyond worker, and `tickets/done/prd_123/prd_123.md` moved token aggregation to `.autoflow/telemetry/runs.jsonl`. Use telemetry as the usage source.
- Active queue constraint: `tickets/inprogress/Todo-144.md` owns priority-aware queue sorting across `.autoflow/scripts/common.sh`, start scripts, agents, `AGENTS.md`, and Desktop renderer; `tickets/todo/Todo-145.md` owns order priority input metadata. Keep this ticket inside its Allowed Paths.
- Guard warning after planner creation: `bin/autoflow guard . .autoflow` returned `status=warning`, `error_count=0`, `warning.1=autoflow/Todo-119 has a ticket worktree but no board ticket: /Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-119`. This is a cleanup candidate only; planner did not delete or reset the worktree.

- Runtime hydrated worktree dependency at 2026-05-03T11:48:37Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- AI worker prepared todo at 2026-05-03T11:48:36Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-146; run=tickets/inprogress/verify_146.md
- 2026-05-03 mini-plan by worker: `bin/autoflow wiki query --term "runner token budget rate limit prompt byte cap timeout circuit breaker" --term "run-role telemetry runs.jsonl consecutive_timeout_count adapter_timeout_fallback" --term "budget policy planner worker verifier wiki" --limit 12 --rag` returned `result_count=0`; no direct budget/rate precedent changed scope. Implement a single adapter preflight in `packages/cli/run-role.sh` after prompt generation and before any adapter command; add runner/default policy defaults in `.autoflow/policies/budget.toml`; extend `packages/cli/telemetry-project.sh` with a runner token usage query backed by `.autoflow/telemetry/runs.jsonl`. Keep prior constraints: do not rework `prd_142` PID cleanup, `prd_144` Desktop fork-bomb guard, or queue priority/order priority files.
- 2026-05-03 verification by worker: required command exited 0 in worktree and after AI-led copy merge in PROJECT_ROOT. Additional checks: `bash packages/cli/telemetry-project.sh self-test` exit 0, `git diff --check` exit 0, token usage query returned `token_usage=4644952` for worker since 2026-05-02T00:00:00Z.
- AI worker prepared resume at 2026-05-03T11:49:02Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-146; run=tickets/inprogress/verify_146.md
- Queued without worktree commit at 2026-05-03T11:55:16Z: PROJECT_ROOT already matches the ticket worktree for all Allowed Paths with code changes.
- Impl AI worker marked verification pass at 2026-05-03T11:55:15Z; runtime finalizer will not perform merge operations.
- Coordinator post-merge cleanup at 2026-05-03T11:55:16Z: removed_worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-146 deleted_branch=autoflow/Todo-146.
- Inline merge finalizer (worker worker) finalized this verified ticket at 2026-05-03T11:55:16Z.
## Verification
- Run file: `tickets/done/prd_147/verify_146.md`
- Log file: `logs/verifier_146_20260503_115517Z_pass.md`
- Result: passed

## Result

- Summary: runner adapter budget/rate/prompt/circuit preflight
- Remaining risk: Preflight policy parsing is intentionally minimal TOML-style section/key parsing for numeric policy values only; richer policy syntax remains out of scope.
