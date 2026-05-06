# Ticket

## Ticket

- ID: tickets_190
- PRD Key: prd_191
- Plan Candidate: Plan AI handoff from tickets/done/prd_191/prd_191.md
- Title: telemetry 5.2T spike root-cause trace
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-05T12:44:01Z

## Goal

- 이번 작업의 목표: `order_174`의 worker 5.2T token row가 어디서 raw telemetry 값으로 기록됐는지 추적하고, 이미 완료된 `prd_181`의 aggregation skip guard를 중복하지 않으면서 raw write path와 desktop aggregation path가 같은 비정상 row에 다시 오염되지 않게 보강한다.

## References

- PRD: tickets/done/prd_191/prd_191.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_191]]
- Plan Note:
- Ticket Note: [[tickets_190]]

## Allowed Paths

- `packages/cli/telemetry-project.sh`
- `packages/cli/run-role.sh`
- `runtime/board-scripts/run-role.sh`
- `apps/desktop/src/main.js`
- `tests/smoke/telemetry-token-usage-sanity-smoke.sh`

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

- [ ] `tests/smoke/telemetry-token-usage-sanity-smoke.sh` contains a fixture with `token_input=5247000554307` and `token_output=5247000065696`, and the test asserts this row is skipped while normal rows still sum correctly.
- [ ] A worker adapter fixture that prints numeric noise containing `5247000` but no explicit valid usage object does not write a trillion-scale row to the fixture board's `.autoflow/telemetry/runs.jsonl`.
- [ ] `packages/cli/run-role.sh` and `runtime/board-scripts/run-role.sh` apply a write-time sanity guard or equivalent parser rejection before recording telemetry rows whose input, output, or total is at/above the configured max row token threshold.
- [ ] `apps/desktop/src/main.js` skips or excludes raw telemetry rows whose input, output, or total exceeds the same max row token threshold, so desktop totals do not include the 5.2T fixture.
- [ ] Ticket Notes identify the most likely source of the `5247000` prefix, or explicitly record that the exact source could not be reproduced after checking parser branches and fixture output.
- [ ] `bash -n packages/cli/telemetry-project.sh packages/cli/run-role.sh runtime/board-scripts/run-role.sh`, `bash tests/smoke/telemetry-token-usage-sanity-smoke.sh`, and `npm run desktop:check` exit 0.

## Next Action

- 다음에 바로 이어서 할 일: Plan AI 가 Allowed Paths 와 Done When 을 PRD 기준으로 더 좁힌다. Impl AI 는 이 티켓을 todo 에서 claim 한 뒤 mini-plan, 구현, 검증, 머지까지 한 턴에 끝낸다.

## Resume Context

- 현재 상태 요약: Plan AI 가 backlog PRD 에서 todo 티켓을 생성한 직후.
- 직전 작업: scripts/start-plan.sh 가 PRD 를 done 으로 보관하고 todo 티켓을 만들었다.
- 재개 시 먼저 볼 것: PRD, Goal, Allowed Paths, Done When.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_191/prd_191.md at 2026-05-05T12:44:01Z.

## Verification

- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
