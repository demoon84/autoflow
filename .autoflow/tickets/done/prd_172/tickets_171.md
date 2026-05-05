# Ticket

## Ticket

- ID: tickets_171
- PRD Key: prd_172
- Plan Candidate: Plan AI handoff from tickets/done/prd_172/prd_172.md
- Title: runner commit volume throttle
- Stage: done
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI: worker
- Last Updated: 2026-05-05T02:08:41Z

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
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_171`
- Branch: autoflow/tickets_171
- Base Commit: e61f52adcc38a7b49b9a2a678f39b58e5e9734f9
- Worktree Commit: 
- Integration Status: already_in_project_root

## Goal Runtime
- Status: complete
- Started At: 2026-05-05T02:02:33Z
- Started Epoch: 1777946553
- Updated At: 2026-05-05T02:08:42Z
- Tick Count: 3
- Time Used Seconds: 369
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: complete
- Last Progress Fingerprint: 591323935

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [x] A planner blocked-dirty orchestration tick with multiple board/runtime dirty paths creates no more than one housekeeping cleanup commit for that tick unless a mechanical git conflict forces a split and the reason is logged.
- [x] A telemetry-only dirty set such as `.autoflow/telemetry/runs.jsonl` plus runtime/check markdown does not create one commit per path or one commit per telemetry line.
- [x] Wiki debounce logic does not trigger a wiki commit solely because `wiki/operations/runner-timing.md`, `wiki/operations/runner-health.md`, and `wiki/agents/prompt-evolution.md` were refreshed from telemetry summaries.
- [x] Meaningful wiki source changes from done/reject/backlog/order content still trigger wiki update after the configured debounce threshold or max age.
- [x] Adapter timeout / SIGTERM / output truncation evidence in `packages/cli/run-role.sh` is classified in runner logs so a normal adapter finish is distinguishable from timeout cleanup.
- [x] Current sidecar scripts and installed template scripts stay behaviorally aligned for the changed cleanup, debounce, and watchdog logic.
- [x] `bash -n` passes for every modified shell file.

## Next Action
- Complete: the inline merge finalizer integrated the AI-merged ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: Plan AI 가 `tickets/inbox/order_152.md` 를 `tickets/done/prd_172/prd_172.md` 로 승격하고 이 todo 티켓을 생성했다.
- 직전 작업: `.autoflow/scripts/start-plan.sh` 가 `source=backlog-to-todo`, `lint_status=ok`, `lint_vagueness_score=0` 으로 `tickets_171.md` 를 만들고 consumed order 를 `tickets/done/prd_172/order_152.md` 로 보관했다.
- 재개 시 먼저 볼 것: `tickets/done/prd_172/prd_172.md`, `tickets/done/prd_172/order_152.md`, `.autoflow/scripts/start-plan.sh`, `packages/cli/run-role.sh`, `packages/cli/wiki-project.sh`, 그리고 runtime mirror 파일들.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_172/prd_172.md at 2026-05-04T01:45:40Z.
- Mini-plan (2026-05-05T02:15Z): keep changes inside the six Allowed Paths; make blocked-dirty orchestration emit a one-commit-per-tick cleanup policy and dirty path count; teach wiki debounce to separate meaningful source changes from telemetry-summary-only wiki refreshes; add adapter finish classification fields so timeout/SIGTERM cleanup and output truncation are distinguishable from normal adapter finish; mirror behavior in installed runtime scripts where those files exist.
- Wiki context pass (2026-05-05T02:15Z): `bin/autoflow wiki query --term "runner commit volume throttle blocked-dirty orchestration cleanup telemetry wiki debounce adapter timeout output_truncated" --rag`, `--term "runner-timing runner-health prompt-evolution metric-only wiki update" --rag`, and `--term "ticket_164 orchestration cleanup telemetry evidence" --rag` each returned `result_count=0`; no new wiki constraint was found.
- Wiki query `bin/autoflow wiki query --term "commit granularity debounce adapter timeout wiki runner-timing telemetry cleanup ticket_164" --rag` returned `result_count=0`; no prior wiki constraint was found.
- Related completed ticket finding: `tickets/done/prd_128/tickets_127.md` already expanded runner telemetry across roles. Preserve the shared `.autoflow/telemetry/runs.jsonl` path while reducing commit churn.
- Related completed ticket finding: `tickets/done/prd_154/tickets_153.md` added output caps and `output_truncated=true` / `adapter_finish` logging. Classify timeout/truncation evidence without removing those markers.
- Related runtime evidence: `tickets/done/prd_164/tickets_163.md` and `tickets/inprogress/tickets_164.md` show repeated blocked-dirty cleanup commits bundling telemetry, check ledger, wiki pages, and ticket runtime refresh. This ticket should reduce commit fragmentation rather than broaden product scope.
- Active queue constraint: `tickets_167` (`prd_168`), `tickets_168` (`prd_169`), `tickets_169` (`prd_170`), and `tickets_170` (`prd_171`) overlap `packages/cli/run-role.sh`, `.autoflow/scripts/start-plan.sh`, or runtime mirrors. The single `worker` runner should serialize those edits; this ticket must not absorb their adjacent scopes.
- Guard after ticket creation returned `status=warning`, `error_count=0`, `warning_count=2`; unresolved cleanup candidates are the existing `tickets_119` leftover worktree with no board ticket and dirty done-ticket worktree for `tickets/done/prd_164/tickets_163.md`. Planner did not delete, reset, or manage those worktrees.

- Runtime hydrated worktree dependency at 2026-05-05T02:02:32Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- AI worker prepared todo at 2026-05-05T02:02:32Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_171; run=tickets/inprogress/verify_171.md
- AI worker prepared resume at 2026-05-05T02:03:04Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_171; run=tickets/inprogress/verify_171.md
- Implemented at 2026-05-05T02:08:04Z: blocked-dirty orchestration now emits `cleanup_commit_policy=single_housekeeping_commit_per_tick`, `cleanup_commit_max_per_tick=1`, and split-exception guidance in both `.autoflow/scripts/start-plan.sh` and `runtime/board-scripts/start-plan.sh`.
- Implemented at 2026-05-05T02:08:04Z: wiki debounce now counts `wiki/operations/runner-health.md`, `wiki/operations/runner-timing.md`, and `wiki/agents/prompt-evolution.md` as telemetry-summary changes separate from meaningful source changes, and only meaningful changes can satisfy debounce threshold/max-age release.
- Implemented at 2026-05-05T02:08:04Z: adapter finish logs now include `finish_class`, `watchdog_signal`, `timeout_cleanup`, and `output_truncated` fields; timeout paths emit `adapter_timeout` with `finish_class=adapter_timeout_sigterm`.
- AI-led merge at 2026-05-05T02:08:04Z: applied the verified worktree diff to `/Users/demoon2016/Documents/project/autoflow` after confirming the six Allowed Paths were clean in PROJECT_ROOT, then reran the PRD verification command from PROJECT_ROOT with exit 0.
- Queued without worktree commit at 2026-05-05T02:08:41Z: PROJECT_ROOT already matches the ticket worktree for all Allowed Paths with code changes.
- Impl AI worker marked verification pass at 2026-05-05T02:08:41Z; runtime finalizer will not perform merge operations.
- Coordinator post-merge cleanup at 2026-05-05T02:08:41Z: removed_worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_171 deleted_branch=autoflow/tickets_171.
- Inline merge finalizer (worker worker) finalized this verified ticket at 2026-05-05T02:08:41Z.
## Verification
- Run file: `tickets/done/prd_172/verify_171.md`
- Log file: `logs/verifier_171_20260505_020842Z_pass.md`
- Result: passed

## Result

- Summary: runner commit volume throttle implemented and verified
- Remaining risk: Runtime `wiki-project.sh` is a wrapper in installed templates; deeper behavioral tests for live loop commit volume require post-merge runner observation, but deterministic shell verification and root recheck passed.
