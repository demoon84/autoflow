# Ticket

## Ticket

- ID: tickets_178
- PRD Key: prd_179
- Plan Candidate: Plan AI handoff from tickets/done/prd_179/prd_179.md
- Title: token budget stale-data guard
- Stage: blocked
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI: worker
- Last Updated: 2026-05-05T22:45:16Z

## Goal

- 이번 작업의 목표: worker state 의 `last_result=token_budget_exceeded`가 오래된 token-cache 같은 신뢰할 수 없는 데이터로 잘못 기록되지 않도록 budget 판정 source와 freshness guard를 명확히 하고, stale 데이터 상황에서는 자율 흐름을 막지 않는 경고성 결과로 처리한다.

## References

- PRD: tickets/done/prd_179/prd_179.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_179]]
- Plan Note:
- Ticket Note: [[tickets_178]]

## Allowed Paths

- `packages/cli/run-role.sh`
- `runtime/board-scripts/run-role.sh`
- `packages/cli/runners-project.sh`
- `packages/cli/metrics-project.sh`
- `packages/cli/telemetry-project.sh`
- `apps/desktop/src/main.js`
- `tests/smoke/token-budget-stale-data-smoke.sh`

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_178`
- Branch: autoflow/tickets_178
- Base Commit: 96a7a247a76c2e0664c42b9c03d8c6906c261775
- Worktree Commit: 
- Integration Status: blocked_stale_todo_worktree

## Goal Runtime
- Status: blocked
- Started At: 2026-05-05T22:35:54Z
- Started Epoch: 1778020554
- Updated At: 2026-05-05T22:45:19Z
- Tick Count: 1
- Time Used Seconds: 565
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: true
- Last Event: stale_todo_worktree
- Last Progress Fingerprint: 2703108516

## Recovery State

- Status: needs_user
- Detected By: planner
- Failure Class: stale_todo_worktree
- Evidence: `.autoflow/scripts/start-plan.sh` at 2026-05-05T22:45:16Z returned `status=idle`, `reason=no_actionable_plan_input`, and `blocked_recover_skip.2.failure_class=stale_todo_worktree` / `reason=failure_class_out_of_scope` for `tickets/inprogress/tickets_178.md`. Required wiki RAG terms for `token budget stale-data guard`, `token_budget_exceeded`, `token-cache`, `run-role`, telemetry, metrics, and desktop `lastResult` returned `result_count=0`. The stale ticket worktree exists at `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_178` on HEAD `3503590de558b7414486da577aff87968f0685bc` and still has unmerged/dirty paths: `apps/desktop/src/main.js`, `packages/cli/run-role.sh`, `packages/cli/runners-project.sh`, `packages/cli/telemetry-project.sh`, `runtime/board-scripts/run-role.sh`, and `tests/smoke/token-budget-stale-data-smoke.sh`.
- Planner Decision: Park this ticket as `needs_user` because `stale_todo_worktree` is outside runtime auto-recovery and planner must not delete, reset, merge, or salvage the ticket worktree. The previous PROJECT_ROOT dirty-path blocker was already integrated by cleanup commits `ad6261c` and `212b049`; the remaining blocker is the stale ticket worktree state itself.
- Owner Resume Instruction: Do not claim or continue `tickets_178` automatically until a human or ticket-owner recovery turn explicitly decides whether to salvage the dirty worktree changes, park them, or discard the stale worktree after backup. Other eligible todo tickets may proceed while this parked ticket remains in `needs_user`.
- Last Recovery At: 2026-05-05T22:45:16Z

## Done When

- [ ] `rg -n "token_budget_exceeded|TOKEN_BUDGET|token budget" packages/cli runtime/board-scripts apps/desktop/src`로 확인한 모든 budget-exceeded write path에 source/freshness 판단이 명시된다.
- [ ] stale `.autoflow/metrics/token-cache.tsv`만 존재하는 temporary board fixture에서 budget 검사 결과가 `token_budget_exceeded`가 아니며, skip/warning marker와 stale age evidence가 runner log 또는 state에 남는다.
- [ ] fresh `.autoflow/telemetry/runs.jsonl` token row가 존재하는 fixture에서는 telemetry totals가 token-cache fallback보다 우선 사용되고, budget 판정 source가 telemetry임을 확인할 수 있다.
- [ ] `AUTOFLOW_TOKEN_BUDGET_MAX_DATA_AGE_SECONDS=1`로 stale 조건을 강제한 smoke test가 exit 0으로 통과하고, stale cache만으로 worker 진행을 blocked/failed 처리하지 않는다.
- [ ] Desktop bridge가 budget skip marker를 받을 때 `lastResult` 또는 표시용 status를 `token_budget_exceeded` false failure로 노출하지 않는다.
- [ ] `bash -n packages/cli/run-role.sh runtime/board-scripts/run-role.sh packages/cli/runners-project.sh packages/cli/metrics-project.sh packages/cli/telemetry-project.sh`, `node --check apps/desktop/src/main.js`, `bash tests/smoke/token-budget-stale-data-smoke.sh`, and `npm run desktop:check` exit 0.

## Next Action
- Parked needs_user: resolve the stale worktree at `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_178` by explicit salvage/park/discard decision before `tickets_178` is claimed again; worker may continue with the next eligible todo.

## Resume Context

- 현재 상태 요약: Plan AI 가 `order_167`를 `prd_179`와 `tickets_178`로 승격했다.
- 직전 작업: `.autoflow/scripts/start-plan.sh 179`가 `prd_179`를 `tickets/done/prd_179/prd_179.md`로 보관하고 `tickets/todo/tickets_178.md`를 만들었다.
- 재개 시 먼저 볼 것: `tickets/done/prd_179/prd_179.md`, `rg -n "token_budget_exceeded|TOKEN_BUDGET|token budget" packages/cli runtime/board-scripts apps/desktop/src`, telemetry source precedence in `packages/cli/metrics-project.sh` / `packages/cli/telemetry-project.sh`, and desktop `lastResult` handling in `apps/desktop/src/main.js`.
- Planner context: wiki RAG for `order_167` returned `result_count=0`. Related board evidence is `tickets/done/prd_177/prd_177.md` for token telemetry source precedence and active `tickets/inprogress/tickets_177.md` for adapter-running heartbeat, both out of scope except for shared runner state display semantics.
- Planner recovery context: 2026-05-05T13:50:16Z blocked-dirty orchestration committed the runtime-listed dirty Allowed Paths as `ad6261c`, then committed a trailing `packages/cli/run-role.sh` Allowed Path hunk as `212b049`; wiki RAG for the direct recovery terms returned `result_count=0`. 2026-05-05T22:45:16Z planner parked the remaining stale ticket worktree blocker as `needs_user`; next safe action is explicit salvage/park/discard decision, not product-code editing by planner.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_179/prd_179.md at 2026-05-04T22:40:18Z.
- Planner wiki pass: `bin/autoflow wiki query /Users/demoon2016/Documents/project/autoflow .autoflow --term "token_budget_exceeded token-cache stale worker last_result order_167" --term "token budget stale data guard AUTOFLOW_TOKEN_BUDGET_MAX_DATA_AGE_SECONDS" --term "order_162 token-cache PRD-129 telemetry-runs token usage" --term "packages/cli/run-role.sh runners-project.sh metrics-project.sh token budget" --limit 10 --rag` returned `result_count=0`.
- Relevant prior ticket: `tickets/done/prd_177/prd_177.md` scoped token telemetry regression recovery and established `.autoflow/telemetry/runs.jsonl` as the preferred shipped telemetry source. Do not redesign that pipeline; add a budget-decision freshness guard.
- Related active ticket: `tickets/inprogress/tickets_177.md` owns adapter-running heartbeat and `last_adapter_chunk_at` freshness. This ticket should not change active adapter heartbeat semantics except where stale budget skip/result display shares runner state fields.
- Guard warning: `bin/autoflow guard` at 2026-05-04T22:40Z returned `status=warning`, `error_count=0`, `warning_count=2`; existing cleanup candidates are leftover worktree `autoflow/tickets_119` with no board ticket and dirty done-ticket worktree `autoflow/tickets_163`. Planner recorded evidence and did not delete or reset worktrees.

- Runtime hydrated worktree dependency at 2026-05-05T13:32:52Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- Runtime hydrated worktree dependency at 2026-05-05T13:32:52Z: linked node_modules -> /Users/demoon2016/Documents/project/autoflow/node_modules
- Mini-plan (worker, 2026-05-05): `tickets/done/prd_179/prd_179.md` wiki RAG만 관련 결과로 반환되어 PRD acceptance를 기준으로 진행한다. `rg` 결과상 `token_budget_exceeded` write path는 `packages/cli/run-role.sh`와 `runtime/board-scripts/run-role.sh`의 budget preflight 두 곳이며, desktop bridge는 `apps/desktop/src/main.js`에서 `.autoflow/metrics/token-cache.tsv`를 telemetry fallback으로 읽는다.
- Mini-plan (worker, 2026-05-05): `packages/cli/telemetry-project.sh`에 token usage `source`, `freshness`, `stale age` metadata를 추가하고 fresh telemetry가 있으면 cache fallback을 쓰지 않게 한다. stale cache만 있는 경우는 `token_budget_exceeded` 대신 `budget_preflight_warning` 및 state marker로 남기고 adapter를 계속 진행하게 한다.
- Mini-plan (worker, 2026-05-05): desktop bridge는 stale budget skip marker를 false failure로 전달하지 않도록 `lastResult` normalization과 token-cache freshness guard를 추가한다. smoke test는 stale cache-only, fresh telemetry-over-cache, `AUTOFLOW_TOKEN_BUDGET_MAX_DATA_AGE_SECONDS=1` 강제 조건을 검증한다.
- AI worker prepared resume at 2026-05-05T13:40:39Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_178; run=tickets/inprogress/verify_178.md
- Runtime auto-blocked: dirty_project_root_conflict at 2026-05-05T13:45:36Z; dirty_paths=packages/cli/run-role.sh, runtime/board-scripts/run-role.sh, packages/cli/runners-project.sh, apps/desktop/src/main.js, tests/smoke/token-budget-stale-data-smoke.sh
- Planner blocked-dirty orchestration at 2026-05-05T13:50:16Z: `start-plan.sh` emitted `source=blocked-dirty-orchestration` for `tickets_178` and listed `apps/desktop/src/main.js`, `packages/cli/run-role.sh`, `packages/cli/runners-project.sh`, `packages/cli/telemetry-project.sh`, `runtime/board-scripts/run-role.sh`, and `tests/smoke/token-budget-stale-data-smoke.sh`. Wiki RAG returned `result_count=0`. Cleanup commits `ad6261c` and `212b049` integrated those Allowed Paths only; review ledger entries are `tickets/check/check_226.md` and `tickets/check/check_227.md`.
- Guard at 2026-05-05T13:50:16Z: `bin/autoflow guard /Users/demoon2016/Documents/project/autoflow .autoflow` returned `status=ok`, `error_count=0`, `warning_count=0`. The runtime-listed dirty paths were clean after commits `ad6261c` and `212b049`; unrelated dirty paths remain outside this blocked-dirty orchestration set and were not staged.
- Auto-recovery at 2026-05-05T13:51:52Z: dirty_project_root_conflict cleared; ticket returned to todo for fresh claim.
- Blocked stale todo worktree at 2026-05-05T22:35:53Z: /Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_178 still has unmerged or dirty state, so the runtime refused to reuse it silently.
- AI worker prepared todo at 2026-05-05T22:35:53Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_178; run=tickets/inprogress/verify_178.md
- Planner recovery at 2026-05-05T22:45:16Z: `start-plan.sh` returned idle with `blocked_recover_skip.2.failure_class=stale_todo_worktree` and `reason=failure_class_out_of_scope`; required wiki RAG returned `result_count=0`. Non-destructive worktree inspection showed dirty paths in the stale ticket worktree, so planner parked `tickets_178` as `needs_user` for explicit salvage/park/discard decision and did not manage the worktree.
## Verification
- Run file: `tickets/inprogress/verify_178.md`
- Log file: pending
- Result: pending ticket-owner by worker

## Result

- Summary:
- Remaining risk:
