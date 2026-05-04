# Ticket

## Ticket

- ID: tickets_171
- PRD Key: prd_172
- Plan Candidate: Plan AI handoff from tickets/done/prd_172/prd_172.md
- Title: runner commit volume throttle
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-04T01:45:40Z

## Goal

- 이번 작업의 목표: `tickets/inbox/order_152.md` 가 보고한 시간당 과도한 cleanup/wiki/runtime commit 생성을 줄이고, worker adapter timeout/truncation 증거를 추적 가능하게 만들어 실제 구현 없이 보드/위키/telemetry commit 만 누적되는 상태를 차단한다.

## References

- PRD: tickets/done/prd_172/prd_172.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_172]]
- Plan Note:
- Ticket Note: [[tickets_171]]

## Allowed Paths

- `.autoflow/scripts/start-plan.sh`
- `runtime/board-scripts/start-plan.sh`
- `packages/cli/run-role.sh`
- `runtime/board-scripts/run-role.sh`
- `packages/cli/wiki-project.sh`
- `runtime/board-scripts/wiki-project.sh`

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

- [ ] A planner blocked-dirty orchestration tick with multiple board/runtime dirty paths creates no more than one housekeeping cleanup commit for that tick unless a mechanical git conflict forces a split and the reason is logged.
- [ ] A telemetry-only dirty set such as `.autoflow/telemetry/runs.jsonl` plus runtime/check markdown does not create one commit per path or one commit per telemetry line.
- [ ] Wiki debounce logic does not trigger a wiki commit solely because `wiki/operations/runner-timing.md`, `wiki/operations/runner-health.md`, and `wiki/agents/prompt-evolution.md` were refreshed from telemetry summaries.
- [ ] Meaningful wiki source changes from done/reject/backlog/order content still trigger wiki update after the configured debounce threshold or max age.
- [ ] Adapter timeout / SIGTERM / output truncation evidence in `packages/cli/run-role.sh` is classified in runner logs so a normal adapter finish is distinguishable from timeout cleanup.
- [ ] Current sidecar scripts and installed template scripts stay behaviorally aligned for the changed cleanup, debounce, and watchdog logic.
- [ ] `bash -n` passes for every modified shell file.

## Next Action

- 다음에 바로 이어서 할 일: Impl AI 는 이 티켓을 todo 에서 claim 한 뒤 cleanup batching, wiki metric-only debounce filtering, adapter watchdog evidence classification 을 Allowed Paths 안에서 구현하고, `prd_168`/`prd_169`/`prd_171` 범위를 흡수하지 않는다.

## Resume Context

- 현재 상태 요약: Plan AI 가 `tickets/inbox/order_152.md` 를 `tickets/done/prd_172/prd_172.md` 로 승격하고 이 todo 티켓을 생성했다.
- 직전 작업: `.autoflow/scripts/start-plan.sh` 가 `source=backlog-to-todo`, `lint_status=ok`, `lint_vagueness_score=0` 으로 `tickets_171.md` 를 만들고 consumed order 를 `tickets/done/prd_172/order_152.md` 로 보관했다.
- 재개 시 먼저 볼 것: `tickets/done/prd_172/prd_172.md`, `tickets/done/prd_172/order_152.md`, `.autoflow/scripts/start-plan.sh`, `packages/cli/run-role.sh`, `packages/cli/wiki-project.sh`, 그리고 runtime mirror 파일들.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_172/prd_172.md at 2026-05-04T01:45:40Z.
- Wiki query `bin/autoflow wiki query --term "commit granularity debounce adapter timeout wiki runner-timing telemetry cleanup ticket_164" --rag` returned `result_count=0`; no prior wiki constraint was found.
- Related completed ticket finding: `tickets/done/prd_128/tickets_127.md` already expanded runner telemetry across roles. Preserve the shared `.autoflow/telemetry/runs.jsonl` path while reducing commit churn.
- Related completed ticket finding: `tickets/done/prd_154/tickets_153.md` added output caps and `output_truncated=true` / `adapter_finish` logging. Classify timeout/truncation evidence without removing those markers.
- Related runtime evidence: `tickets/done/prd_164/tickets_163.md` and `tickets/inprogress/tickets_164.md` show repeated blocked-dirty cleanup commits bundling telemetry, check ledger, wiki pages, and ticket runtime refresh. This ticket should reduce commit fragmentation rather than broaden product scope.
- Active queue constraint: `tickets_167` (`prd_168`), `tickets_168` (`prd_169`), `tickets_169` (`prd_170`), and `tickets_170` (`prd_171`) overlap `packages/cli/run-role.sh`, `.autoflow/scripts/start-plan.sh`, or runtime mirrors. The single `worker` runner should serialize those edits; this ticket must not absorb their adjacent scopes.
- Guard after ticket creation returned `status=warning`, `error_count=0`, `warning_count=2`; unresolved cleanup candidates are the existing `tickets_119` leftover worktree with no board ticket and dirty done-ticket worktree for `tickets/done/prd_164/tickets_163.md`. Planner did not delete, reset, or manage those worktrees.

## Verification

- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
