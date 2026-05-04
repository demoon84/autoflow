# Ticket

## Ticket

- ID: tickets_169
- PRD Key: prd_170
- Plan Candidate: Plan AI handoff from tickets/done/prd_170/prd_170.md
- Title: inprogress recovery parking and repairing timeout
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-04T00:23:16Z

## Goal

- 이번 작업의 목표: `tickets/inprogress/` 의 ticket 이 `Recovery State: needs_user` 또는 장시간 `repairing` 상태로 남아 worker 가 같은 blocked ticket 을 반복해서 보며 진보하지 못하는 상태를 끊는다. planner 는 worker 시야에서 human-bound ticket 을 분리하거나 명확히 park 하고, worker tick 은 stale active item 을 해제해 다음 todo 로 진행할 수 있어야 한다.

## References

- PRD: tickets/done/prd_170/prd_170.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_170]]
- Plan Note:
- Ticket Note: [[tickets_169]]

## Allowed Paths

- `.autoflow/scripts/start-plan.sh`
- `.autoflow/scripts/common.sh`
- `runtime/board-scripts/start-plan.sh`
- `runtime/board-scripts/common.sh`
- `packages/cli/run-role.sh`

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

- [ ] planner preflight detects `tickets/inprogress/*.md` with `Stage: blocked` and `Recovery State.Status: needs_user`, records a durable parking decision, and prevents worker from repeatedly blocking on that ticket.
- [ ] planner preflight detects `Recovery State.Status: repairing` older than the configured timeout (default 30 minutes), escalates with concrete Evidence / Planner Decision / Owner Resume Instruction, and does not append duplicate Notes for unchanged evidence.
- [ ] worker(`ticket`) tick entry validates its active item before dispatch; if the item is parked `needs_user` or timeout-stale `repairing`, it clears stale active item / `ticket_stage_blocked` state narrowly and proceeds to the next eligible todo ticket.
- [ ] sidecar `.autoflow/scripts/*` and template `runtime/board-scripts/*` contain equivalent recovery behavior where applicable.
- [ ] existing normal blocked-dirty auto-recover and reject auto-replan flows continue to emit their documented `source=` values.
- [ ] `bash -n` passes for every modified shell file.

## Next Action

- 다음에 바로 이어서 할 일: Impl AI 는 이 티켓을 claim 한 뒤 `prd_168` / `prd_169` 와 중복되지 않게 needs_user parking, repairing timeout, worker active item validation 만 구현하고 `bash -n` 검증을 실행한다.

## Resume Context

- 현재 상태 요약: Plan AI 가 backlog PRD 에서 todo 티켓을 생성한 직후.
- 직전 작업: scripts/start-plan.sh 가 PRD 를 done 으로 보관하고 todo 티켓을 만들었다.
- 재개 시 먼저 볼 것: `tickets/done/prd_170/prd_170.md`, `tickets/done/prd_168/prd_168.md`, `tickets/done/prd_169/prd_169.md`, Allowed Paths, Done When.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_170/prd_170.md at 2026-05-04T00:23:16Z.
- Wiki query `needs_user repairing inprogress worker stage_blocked check ledger live-lock` returned `result_count=0`; no wiki constraint was found.
- Related ticket context: `prd_168` already covers check ledger live-lock and `prd_169` already covers stale `worker.state.last_result=ticket_stage_blocked`; keep this ticket focused on inprogress recovery parking and repairing timeout.
- Guard after ticket creation reported only existing resolved-ticket worktree warnings for tickets_119, tickets_157, tickets_162, and tickets_163; planner did not delete or reset those worktrees.

## Verification

- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
