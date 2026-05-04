# Ticket

## Ticket

- ID: tickets_170
- PRD Key: prd_171
- Plan Candidate: Plan AI handoff from tickets/done/prd_171/prd_171.md
- Title: worker self-refresh dirty deadlock
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-04T00:27:24Z

## Goal

- 이번 작업의 목표: ticket owner runtime 이 자기 ticket markdown / verification markdown 의 Stage, Last Updated, runtime evidence 갱신을 PROJECT_ROOT dirty overlap 으로 오인해 `ticket_stage_blocked` 를 반복하는 self-refresh deadlock 을 끊는다.

## References

- PRD: tickets/done/prd_171/prd_171.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_171]]
- Plan Note:
- Ticket Note: [[tickets_170]]

## Allowed Paths

- `.autoflow/scripts/start-ticket-owner.sh`
- `runtime/board-scripts/start-ticket-owner.sh`
- `packages/cli/run-role.sh`
- `runtime/board-scripts/run-role.sh`
- `packages/cli/runners-project.sh`
- `runtime/board-scripts/runners-project.sh`

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

- [ ] When PROJECT_ROOT dirty overlap contains only the active ticket's own `.autoflow/tickets/inprogress/tickets_NNN.md` and/or `.autoflow/tickets/inprogress/verify_NNN.md`, ticket-owner does not return `reason=ticket_stage_blocked`.
- [ ] When PROJECT_ROOT dirty overlap contains any non-self-refresh path inside the ticket `Allowed Paths`, the existing blocked dirty / planner orchestration behavior still triggers with explicit path evidence.
- [ ] `packages/cli/run-role.sh` and `runtime/board-scripts/run-role.sh` do not preserve a stale `ticket_stage_blocked` state solely because of self-refresh metadata changes.
- [ ] `runners-project.sh stop` or the relevant cleanup path can identify and terminate orphan `loop-worker <runner-id>` processes whose command path belongs to a removed ticket worktree, without affecting the main project runner for the same runner id.
- [ ] Current sidecar scripts and installed template scripts stay behaviorally aligned for the changed logic.
- [ ] `bash -n` passes for every modified shell file.

## Next Action

- 다음에 바로 이어서 할 일: Impl AI 는 이 티켓을 todo 에서 claim 한 뒤 self-refresh metadata dirty filtering 을 먼저 구현하고, 그 다음 stale `ticket_stage_blocked` state 보존 방지와 worktree-aware orphan runner cleanup 을 좁게 구현한다. 제품 파일 dirty overlap 은 기존처럼 block 되어야 한다.

## Resume Context

- 현재 상태 요약: Plan AI 가 backlog PRD 에서 todo 티켓을 생성한 직후.
- 직전 작업: scripts/start-plan.sh 가 `tickets/done/prd_171/prd_171.md` 를 보관하고 `tickets/todo/tickets_170.md` 를 만들었다. Consumed order 는 `tickets/done/prd_171/order_151.md` 로 보관됐다.
- 재개 시 먼저 볼 것: `tickets/done/prd_171/prd_171.md`, `tickets/done/prd_171/order_151.md`, `.autoflow/scripts/start-ticket-owner.sh`, `packages/cli/run-role.sh`, `packages/cli/runners-project.sh`.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_171/prd_171.md at 2026-05-04T00:27:24Z.
- Wiki query `bin/autoflow wiki query --term "worker self-refresh dirty deadlock ticket Stage Allowed Paths run-role runners-project orphan process" --rag` returned `result_count=0`; no prior wiki constraint was found.
- Source order evidence: `tickets_163.md` / `verify_163.md` were reported as the dirty overlap that kept returning `reason=ticket_stage_blocked` after every worker self-refresh.
- Scope decision: keep the self-refresh exception limited to the active ticket's own markdown and matching verify file. Non-self dirty paths must still trigger the documented blocked-dirty / planner orchestration flow.
- Related PRDs already cover adjacent symptoms: `prd_168` check ledger live-lock, `prd_169` stale `worker.state.last_result`, and `prd_170` needs_user / repairing parking. Do not broaden this ticket into those areas.
- Guard after ticket creation returned `status=warning`, `error_count=0`, `warning_count=4`; unresolved cleanup candidates are leftover/dirty worktrees for `tickets_119`, `tickets_157`, `tickets_162`, and `tickets_163`. Planner did not delete, reset, or manage those worktrees.

## Verification

- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
