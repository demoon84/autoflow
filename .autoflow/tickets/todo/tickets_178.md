# Ticket

## Ticket

- ID: tickets_178
- PRD Key: prd_179
- Plan Candidate: Plan AI handoff from tickets/done/prd_179/prd_179.md
- Title: token budget stale-data guard
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-04T22:40:18Z

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

- [ ] `rg -n "token_budget_exceeded|TOKEN_BUDGET|token budget" packages/cli runtime/board-scripts apps/desktop/src`로 확인한 모든 budget-exceeded write path에 source/freshness 판단이 명시된다.
- [ ] stale `.autoflow/metrics/token-cache.tsv`만 존재하는 temporary board fixture에서 budget 검사 결과가 `token_budget_exceeded`가 아니며, skip/warning marker와 stale age evidence가 runner log 또는 state에 남는다.
- [ ] fresh `.autoflow/telemetry/runs.jsonl` token row가 존재하는 fixture에서는 telemetry totals가 token-cache fallback보다 우선 사용되고, budget 판정 source가 telemetry임을 확인할 수 있다.
- [ ] `AUTOFLOW_TOKEN_BUDGET_MAX_DATA_AGE_SECONDS=1`로 stale 조건을 강제한 smoke test가 exit 0으로 통과하고, stale cache만으로 worker 진행을 blocked/failed 처리하지 않는다.
- [ ] Desktop bridge가 budget skip marker를 받을 때 `lastResult` 또는 표시용 status를 `token_budget_exceeded` false failure로 노출하지 않는다.
- [ ] `bash -n packages/cli/run-role.sh runtime/board-scripts/run-role.sh packages/cli/runners-project.sh packages/cli/metrics-project.sh packages/cli/telemetry-project.sh`, `node --check apps/desktop/src/main.js`, `bash tests/smoke/token-budget-stale-data-smoke.sh`, and `npm run desktop:check` exit 0.

## Next Action

- 다음에 바로 이어서 할 일: Impl AI 는 이 티켓을 todo 에서 claim 한 뒤 `token_budget_exceeded` write path를 먼저 찾고, stale token-cache / fresh telemetry fixture 기준의 budget source freshness guard를 구현한 뒤 smoke와 `npm run desktop:check`까지 검증한다.

## Resume Context

- 현재 상태 요약: Plan AI 가 `order_167`를 `prd_179`와 `tickets_178`로 승격했다.
- 직전 작업: `.autoflow/scripts/start-plan.sh 179`가 `prd_179`를 `tickets/done/prd_179/prd_179.md`로 보관하고 `tickets/todo/tickets_178.md`를 만들었다.
- 재개 시 먼저 볼 것: `tickets/done/prd_179/prd_179.md`, `rg -n "token_budget_exceeded|TOKEN_BUDGET|token budget" packages/cli runtime/board-scripts apps/desktop/src`, telemetry source precedence in `packages/cli/metrics-project.sh` / `packages/cli/telemetry-project.sh`, and desktop `lastResult` handling in `apps/desktop/src/main.js`.
- Planner context: wiki RAG for `order_167` returned `result_count=0`. Related board evidence is `tickets/done/prd_177/prd_177.md` for token telemetry source precedence and active `tickets/inprogress/tickets_177.md` for adapter-running heartbeat, both out of scope except for shared runner state display semantics.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_179/prd_179.md at 2026-05-04T22:40:18Z.
- Planner wiki pass: `bin/autoflow wiki query /Users/demoon2016/Documents/project/autoflow .autoflow --term "token_budget_exceeded token-cache stale worker last_result order_167" --term "token budget stale data guard AUTOFLOW_TOKEN_BUDGET_MAX_DATA_AGE_SECONDS" --term "order_162 token-cache PRD-129 telemetry-runs token usage" --term "packages/cli/run-role.sh runners-project.sh metrics-project.sh token budget" --limit 10 --rag` returned `result_count=0`.
- Relevant prior ticket: `tickets/done/prd_177/prd_177.md` scoped token telemetry regression recovery and established `.autoflow/telemetry/runs.jsonl` as the preferred shipped telemetry source. Do not redesign that pipeline; add a budget-decision freshness guard.
- Related active ticket: `tickets/inprogress/tickets_177.md` owns adapter-running heartbeat and `last_adapter_chunk_at` freshness. This ticket should not change active adapter heartbeat semantics except where stale budget skip/result display shares runner state fields.
- Guard warning: `bin/autoflow guard` at 2026-05-04T22:40Z returned `status=warning`, `error_count=0`, `warning_count=2`; existing cleanup candidates are leftover worktree `autoflow/tickets_119` with no board ticket and dirty done-ticket worktree `autoflow/tickets_163`. Planner recorded evidence and did not delete or reset worktrees.

## Verification

- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
