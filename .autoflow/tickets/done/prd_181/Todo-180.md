# Ticket

## Ticket

- ID: Todo-180
- PRD Key: prd_181
- Plan Candidate: Plan AI handoff from tickets/done/prd_181/prd_181.md
- Title: telemetry token usage sanity correction
- Priority: critical
- Stage: done
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI: worker
- Last Updated: 2026-05-05T00:42:01Z

## Goal

- 이번 작업의 목표: `telemetry-project.sh token-usage`가 단위 mismatch, 잘못 파싱된 token row, 또는 비현실적인 단일 row 때문에 86B 같은 불가능한 사용량을 반환하지 않게 하고, 그 값이 `token_budget_exceeded` false trigger로 worker를 막지 않게 만든다.

## References

- PRD: tickets/done/prd_181/prd_181.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_181]]
- Plan Note:
- Ticket Note: [[Todo-180]]

## Allowed Paths

- `packages/cli/telemetry-project.sh`
- `packages/cli/run-role.sh`
- `runtime/board-scripts/run-role.sh`
- `tests/smoke/telemetry-token-usage-sanity-smoke.sh`

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-180`
- Branch: autoflow/Todo-180
- Base Commit: db14cd6090d2f794be35fe21b4887ef8601bbae0
- Worktree Commit: 
- Integration Status: already_in_project_root

## Goal Runtime
- Status: complete
- Started At: 2026-05-05T00:31:48Z
- Started Epoch: 1777941108
- Updated At: 2026-05-05T00:42:02Z
- Tick Count: 3
- Time Used Seconds: 614
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: complete
- Last Progress Fingerprint: 746060536

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [x] `bash packages/cli/telemetry-project.sh token-usage --project-root "$PWD" --runner worker --since "2026-05-03T22:47:35Z"` no longer returns `86004270902` or any value at/above `100000000` when the only source of excess is an impossible single telemetry row.
- [x] A temporary smoke fixture with one corrupt row (`token_input=43000004027`, `token_output=43000000020`) and one normal worker row returns the normal worker total, preserves the `--since` / `--until` filters, and records warning evidence for the skipped corrupt row.
- [x] `run-role.sh` token extraction ignores board/wiki snippet text and numeric fingerprints as token counts, while still parsing explicit adapter token markers and JSON usage objects.
- [x] budget preflight does not write `last_result=token_budget_exceeded` when the sanitized telemetry command reports that the total is suspicious/impossible rather than trusted budget usage.
- [x] The implementation does not edit or delete `.autoflow/telemetry/runs.jsonl`, `.autoflow/metrics/token-cache.tsv`, or `.autoflow/policies/budget.toml`; fixture data stays inside temporary smoke-test boards.
- [x] `bash -n packages/cli/telemetry-project.sh packages/cli/run-role.sh runtime/board-scripts/run-role.sh`, `bash tests/smoke/telemetry-token-usage-sanity-smoke.sh`, and `bash packages/cli/telemetry-project.sh token-usage --project-root "$PWD" --runner worker --since "2026-05-03T22:47:35Z"` exit 0 with trusted token usage below the 100M daily quota.

## Next Action
- Complete: the inline merge finalizer integrated the AI-merged ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: Plan AI 가 `order_169`를 `prd_181`과 `Todo-180`으로 승격했고, 후속 `order_170`의 planner/worker 동시 `token_budget_exceeded` 확산 증거를 이 티켓에 흡수했다. 이 티켓은 stale token-cache guard(`Todo-178`)나 repeated preflight breaker(`Todo-179`)가 아니라, current telemetry source 안의 불가능한 token row와 token parser/sanity 문제를 고친다.
- 직전 작업: `.autoflow/scripts/start-plan.sh 181`가 `prd_181`를 `tickets/done/prd_181/prd_181.md`로 보관하고 `tickets/todo/Todo-180.md`를 만들었다. `tickets/done/prd_181/order_169.md`에 원 요청이 보존됐고, 2026-05-05T00:01:51Z planner 턴에서 `order_170` 확산 증거가 `tickets/done/prd_181/order_170.md`로 보관됐다.
- 재개 시 먼저 볼 것: 구현은 worktree 와 PROJECT_ROOT 양쪽에 반영됐고, 2026-05-05T00:41:19Z 기준 루트 검증 명령이 exit 0 이었다. `finish-ticket-owner.sh pass` 가 실패하면 `/tmp/autoflow-token-usage-sanity-root.out` 의 `token_usage=173036`, `token_usage_trusted=true`, `skipped_suspicious_token_rows=0` 증거와 `tests/smoke/telemetry-token-usage-sanity-smoke.sh` 통과 결과를 기준으로 finalizer 조건을 점검한다.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_181/prd_181.md at 2026-05-04T22:55:19Z.
- Planner wiki pass: `bin/autoflow wiki query /Users/demoon2016/Documents/project/autoflow .autoflow --term "telemetry-project token-usage token_budget_exceeded" --term "order_167 order_168 worker token budget" --term "token-cache PRD-129" --term "runner_budget_preflight_or_exit" --limit 10 --rag` returned `result_count=1`, pointing to `tickets/done/prd_179/prd_179.md`.
- Relevant prior ticket: `tickets/done/prd_179/prd_179.md` / `tickets/todo/Todo-178.md` owns stale budget source/freshness handling. Do not duplicate that scope; this ticket should handle impossible values from the current telemetry source.
- Relevant prior ticket: `tickets/done/prd_177/prd_177.md` established `.autoflow/telemetry/runs.jsonl` as the shipped telemetry source. Current diagnostic evidence shows one worker row for `Todo-176` with `token_input=43000004027` and `token_output=43000000020`; fix row validation and upstream parser behavior without rewriting operating data.
- Relevant prior ticket: `tickets/done/prd_129/Todo-130.md` introduced token extraction/fallback behavior. Preserve explicit adapter token parsing and bounded byte-estimation fallback while preventing board/wiki snippets or progress fingerprints from being counted as token usage.
- Diagnostic command in this planner tick confirmed `bash packages/cli/telemetry-project.sh token-usage --project-root /Users/demoon2016/Documents/project/autoflow --runner worker --since "2026-05-03T22:47:35Z"` returns `token_usage=86004270902` before this ticket is implemented.
- Guard warning: `bin/autoflow guard` at 2026-05-04T22:55Z returned `status=warning`, `error_count=0`, `warning_count=2`; existing cleanup candidates are leftover worktree `autoflow/Todo-119` with no board ticket and dirty done-ticket worktree `autoflow/Todo-163`. Planner recorded evidence and did not delete or reset worktrees.
- Planner dedupe decision: `order_170` reports the same impossible `token_budget_exceeded` root cause spreading from worker to planner. No new product-code ticket was created because `Todo-180` already owns `packages/cli/telemetry-project.sh`, `packages/cli/run-role.sh`, `runtime/board-scripts/run-role.sh`, and the sanity smoke coverage. The consumed escalation order is archived at `tickets/done/prd_181/order_170.md`.
- Order 170 evidence: monitoring tick #19 at 2026-05-04T22:59:15Z reported planner `last_result=token_budget_exceeded` once and worker `last_result=token_budget_exceeded` 10 consecutive times. Treat this as priority evidence for the `prd_181` root-cause fix, not as a separate implementation scope.
- Planner wiki pass for order_170: `bin/autoflow wiki query --term "token_budget_exceeded telemetry-project token-usage budget.toml order_169 run-role daily_token_quota" --rag` returned `result_count=0`; relevant context came from board evidence in `tickets/done/prd_181/order_169.md`, `tickets/done/prd_181/prd_181.md`, and this ticket.

- Runtime hydrated worktree dependency at 2026-05-05T00:31:47Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- AI worker prepared todo at 2026-05-05T00:31:47Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-180; run=tickets/inprogress/verify_180.md
- AI worker prepared resume at 2026-05-05T00:32:07Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-180; run=tickets/inprogress/verify_180.md
- Mini-plan at 2026-05-05T00:33:50Z: wiki RAG query for `telemetry token-usage impossible row token_budget_exceeded`, `run-role token extraction JSON usage fingerprint`, and `budget preflight sanitized telemetry suspicious` returned `result_count=0`; using the existing board findings from `tickets/done/prd_181/prd_181.md`, `tickets/done/prd_179/prd_179.md`, `tickets/done/prd_177/prd_177.md`, and `tickets/done/prd_129/Todo-130.md` as constraints. Plan: add row-level token sanity to `packages/cli/telemetry-project.sh token-usage` without rewriting `.autoflow/telemetry/runs.jsonl`; tighten `packages/cli/run-role.sh` parser to accept explicit token markers/JSON usage objects while ignoring markdown snippets and fingerprints; make package/runtime budget preflight skip `token_budget_exceeded` when telemetry reports suspicious skipped rows; add `tests/smoke/telemetry-token-usage-sanity-smoke.sh` with temporary board fixtures covering corrupt row skip, time filters, parser behavior, and preflight behavior.
- Verification at 2026-05-05T00:41:19Z: worktree and PROJECT_ROOT both passed `bash -n packages/cli/telemetry-project.sh packages/cli/run-role.sh runtime/board-scripts/run-role.sh`, `bash tests/smoke/telemetry-token-usage-sanity-smoke.sh`, and token usage guard. Additional regression `bash tests/smoke/metrics-token-usage-smoke.sh` passed in both roots. PROJECT_ROOT token usage check returned `token_usage=173036`, `token_usage_trusted=true`, `skipped_suspicious_token_rows=0`, below the 100M quota.
- Queued without worktree commit at 2026-05-05T00:42:00Z: PROJECT_ROOT already matches the ticket worktree for all Allowed Paths with code changes.
- Impl AI worker marked verification pass at 2026-05-05T00:41:59Z; runtime finalizer will not perform merge operations.
- Coordinator post-merge cleanup at 2026-05-05T00:42:01Z: removed_worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-180 deleted_branch=autoflow/Todo-180.
- Inline merge finalizer (worker worker) finalized this verified ticket at 2026-05-05T00:42:01Z.
## Verification
- Run file: `tickets/done/prd_181/verify_180.md`
- Log file: `logs/verifier_180_20260505_004202Z_pass.md`
- Result: passed

## Result

- Summary: telemetry token usage sanity correction
- Remaining risk: Low; row sanity threshold defaults to `100000000` and can be overridden with `AUTOFLOW_TELEMETRY_MAX_ROW_TOKENS` if future adapter limits change.
