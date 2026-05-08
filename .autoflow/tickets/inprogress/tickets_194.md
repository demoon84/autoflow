# Ticket

## Ticket

- ID: tickets_194
- PRD Key: prd_195
- Plan Candidate: Plan AI handoff from tickets/done/prd_195/prd_195.md
- Title: telemetry 5.2T dirty-root retry finalization
- Priority: high
- Stage: executing
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI:
- Last Updated: 2026-05-08T05:43:30Z

## Goal

- 이번 작업의 목표: `tickets_190`에서 구현과 검증은 끝났지만 `runtime/board-scripts/run-role.sh`의 PROJECT_ROOT dirty overlap 때문에 pass finalization이 막힌 telemetry 5.2T token guard를 재시도하고, 같은 `dirty_project_root_conflict`가 반복되지 않도록 merge/finalization 경계를 명확히 정리한다.

## References

- PRD: tickets/done/prd_195/prd_195.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_195]]
- Plan Note:
- Ticket Note: [[tickets_194]]

## Allowed Paths

- `packages/cli/telemetry-project.sh`
- `packages/cli/run-role.sh`
- `runtime/board-scripts/run-role.sh`
- `apps/desktop/src/main.js`
- `tests/smoke/telemetry-token-usage-sanity-smoke.sh`

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_194`
- Branch: autoflow/tickets_194
- Base Commit: d26d4a8234c97433f7301957e661f0638bf4a36e
- Worktree Commit: 
- Integration Status: pending

## Goal Runtime
- Status: active
- Started At: 2026-05-08T05:43:00Z
- Started Epoch: 1778218980
- Updated At: 2026-05-08T05:43:31Z
- Tick Count: 2
- Time Used Seconds: 31
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: resume
- Last Progress Fingerprint: 3853046530

## Recovery State

- Status: requeued
- Detected By: planner
- Failure Class: dirty_root
- Evidence: `tickets/inbox/order_190_retry_1_20260508T044617Z.md` embeds failed `tickets_190`; `finish-ticket-owner.sh ... pass` was blocked by `reason=dirty_project_root_conflict`, `dirty_path=runtime/board-scripts/run-role.sh` after worktree and PROJECT_ROOT verification had passed.
- Planner Decision: Reissue the original `prd_191` telemetry guard scope as `prd_195` / `tickets_194`, with explicit Done When coverage for root/worktree comparison and pass-finalization boundary handling.
- Owner Resume Instruction: Start from `tickets/done/prd_195/prd_195.md` and the embedded `tickets_190` evidence. Preserve existing PROJECT_ROOT changes, compare `runtime/board-scripts/run-role.sh` root/worktree hunks before integration, rerun verification in both roots, and call pass only when Allowed Paths contain this ticket's explainable final diff.
- Last Recovery At: 2026-05-08T05:42:57Z

## Done When

- [ ] `tests/smoke/telemetry-token-usage-sanity-smoke.sh` contains a fixture with `token_input=5247000554307` and `token_output=5247000065696`, and the smoke asserts this row is skipped while normal rows still sum correctly.
- [ ] A worker adapter fixture that prints numeric noise containing `5247000` but no explicit valid usage object does not write a trillion-scale row to the fixture board's `.autoflow/telemetry/runs.jsonl`.
- [ ] `packages/cli/run-role.sh` and `runtime/board-scripts/run-role.sh` reject or skip telemetry rows whose input, output, or total is at/above the configured max row token threshold before appending raw telemetry.
- [ ] `apps/desktop/src/main.js` excludes raw telemetry rows whose input, output, or total exceeds the same max row token threshold, so desktop totals do not include the 5.2T fixture.
- [ ] Ticket Notes record the `tickets_190` dirty-root failure evidence, the root/worktree comparison decision for `runtime/board-scripts/run-role.sh`, and whether the `5247000` prefix source was reproduced.
- [ ] `bash -lc 'bash -n packages/cli/telemetry-project.sh packages/cli/run-role.sh runtime/board-scripts/run-role.sh && bash tests/smoke/telemetry-token-usage-sanity-smoke.sh && npm run desktop:check'` exits 0 in the ticket worktree.
- [ ] Before pass finalization, PROJECT_ROOT verification with the same command exits 0 and any dirty diff in the Allowed Paths is either this ticket's final integrated diff or is recorded as a blocker without calling pass.

## Next Action
- 다음에 바로 이어서 할 일: Impl AI 는 `tickets_190`의 구현/검증 증거와 `prd_195`의 Done When을 대조하고, `runtime/board-scripts/run-role.sh`의 dirty-root finalization 경계를 먼저 확인한 뒤 구현, 검증, PROJECT_ROOT 통합, pass finalization을 한 턴에 끝낸다.

## Resume Context

- 현재 상태 요약: Plan AI 가 retry order `order_190_retry_1_20260508T044617Z.md`를 `prd_195`로 승격했고, runtime이 `tickets_194`를 생성한 뒤 worker가 claim했다.
- 직전 작업: `scripts/start-plan.sh`가 `prd_195`를 `tickets/done/prd_195/prd_195.md`로 보관하고 이 ticket을 만들었다.
- 재개 시 먼저 볼 것: `tickets/done/prd_195/prd_195.md`, embedded `tickets_190` failure evidence, `runtime/board-scripts/run-role.sh` root/worktree diff.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_195/prd_195.md at 2026-05-08T05:42:45Z.
- Planner wiki pass: `bin/autoflow wiki query --term "telemetry 5.2T token 5247000554307 run-role telemetry-project desktop dirty_root prd_191 ticket_190" --rag` returned `result_count=0`; use board evidence from `tickets/done/prd_191/prd_191.md` and the retry order instead.
- Relevant prior PRD: `tickets/done/prd_191/prd_191.md` defines the exact 5.2T fixture, write-time telemetry guard, desktop aggregation guard, and verification command. This retry should preserve that behavior rather than redesign `prd_181` aggregation.
- Retry blocker to avoid repeating: `tickets_190` had passed worktree and PROJECT_ROOT verification, then pass finalization blocked on `runtime/board-scripts/run-role.sh` dirty-root overlap. The next owner must record the root/worktree comparison decision before pass.

- Runtime hydrated worktree dependency at 2026-05-08T05:43:00Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- Runtime hydrated worktree dependency at 2026-05-08T05:43:00Z: linked node_modules -> /Users/demoon2016/Documents/project/autoflow/node_modules
- AI worker prepared todo at 2026-05-08T05:42:59Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_194
- AI worker prepared resume at 2026-05-08T05:43:30Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_194
## Verification
- Result: pending ticket-owner by worker

## Result

- Summary:
- Remaining risk:
