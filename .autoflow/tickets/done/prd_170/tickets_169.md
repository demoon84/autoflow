# Ticket

## Ticket

- ID: tickets_169
- PRD Key: prd_170
- Plan Candidate: Plan AI handoff from tickets/done/prd_170/prd_170.md
- Title: inprogress recovery parking and repairing timeout
- Stage: done
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI: worker
- Last Updated: 2026-05-05T01:52:21Z

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
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_169`
- Branch: autoflow/tickets_169
- Base Commit: 4d2980aa33d3aa9d59334ae4180b2be216a47944
- Worktree Commit: 
- Integration Status: already_in_project_root

## Goal Runtime
- Status: complete
- Started At: 2026-05-05T01:44:32Z
- Started Epoch: 1777945472
- Updated At: 2026-05-05T01:52:22Z
- Tick Count: 3
- Time Used Seconds: 470
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: complete
- Last Progress Fingerprint: 518120026

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [x] planner preflight detects `tickets/inprogress/*.md` with `Stage: blocked` and `Recovery State.Status: needs_user`, records a durable parking decision, and prevents worker from repeatedly blocking on that ticket.
- [x] planner preflight detects `Recovery State.Status: repairing` older than the configured timeout (default 30 minutes), escalates with concrete Evidence / Planner Decision / Owner Resume Instruction, and does not append duplicate Notes for unchanged evidence.
- [x] worker(`ticket`) tick entry validates its active item before dispatch; if the item is parked `needs_user` or timeout-stale `repairing`, it clears stale active item / `ticket_stage_blocked` state narrowly and proceeds to the next eligible todo ticket.
- [x] sidecar `.autoflow/scripts/*` and template `runtime/board-scripts/*` contain equivalent recovery behavior where applicable.
- [x] existing normal blocked-dirty auto-recover and reject auto-replan flows continue to emit their documented `source=` values.
- [x] `bash -n` passes for every modified shell file.

## Next Action
- Complete: the inline merge finalizer integrated the AI-merged ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: 구현, worktree 검증, PROJECT_ROOT 수동 적용, post-merge 검증이 모두 통과했다.
- 직전 작업: Allowed Paths 5개 파일의 verified diff를 PROJECT_ROOT에 적용했고 PRD verification command를 PROJECT_ROOT에서 exit 0으로 재실행했다.
- 재개 시 먼저 볼 것: `tickets/inprogress/verify_169.md`, PROJECT_ROOT의 Allowed Paths diff, `finish-ticket-owner.sh 169 pass` 결과.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_170/prd_170.md at 2026-05-04T00:23:16Z.
- Wiki query `needs_user repairing inprogress worker stage_blocked check ledger live-lock` returned `result_count=0`; no wiki constraint was found.
- Related ticket context: `prd_168` already covers check ledger live-lock and `prd_169` already covers stale `worker.state.last_result=ticket_stage_blocked`; keep this ticket focused on inprogress recovery parking and repairing timeout.
- Guard after ticket creation reported only existing resolved-ticket worktree warnings for tickets_119, tickets_157, tickets_162, and tickets_163; planner did not delete or reset those worktrees.

- Runtime hydrated worktree dependency at 2026-05-05T01:44:31Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- AI worker prepared todo at 2026-05-05T01:44:30Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_169; run=tickets/inprogress/verify_169.md
- AI worker prepared resume at 2026-05-05T01:45:11Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_169; run=tickets/inprogress/verify_169.md
- Mini-plan at 2026-05-05T02:09:00Z: wiki query `needs_user repairing inprogress ticket_stage_blocked active_item parking timeout` returned `result_count=0`; use PRD_170 plus related PRD_168/169 as constraints. Add shared recovery helpers for `needs_user` parking and stale `repairing` timeout, call them from planner preflight before dirty-root recovery, and make `packages/cli/run-role.sh` clear stale worker active state before dispatch so the next todo can be claimed.
- Implementation complete: added `inprogress-needs-user-parked` and `inprogress-repairing-timeout` planner preflight branches before dirty-root recovery, shared sidecar/template timeout helpers, and worker active-state clearing before adapter dispatch. Preserved existing `blocked-dirty-orchestration`, `blocked-auto-recover`, and `reject-replan` source values.
- Verification evidence: `bash -n` and the PRD verification command passed in the ticket worktree and again from PROJECT_ROOT after applying the verified diff. Smoke fixtures confirmed `source=inprogress-needs-user-parked`, `source=inprogress-repairing-timeout`, and worker active item clearing for parked `needs_user`.
- Queued without worktree commit at 2026-05-05T01:52:21Z: PROJECT_ROOT already matches the ticket worktree for all Allowed Paths with code changes.
- Impl AI worker marked verification pass at 2026-05-05T01:52:21Z; runtime finalizer will not perform merge operations.
- Coordinator post-merge cleanup at 2026-05-05T01:52:21Z: removed_worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_169 deleted_branch=autoflow/tickets_169.
- Inline merge finalizer (worker worker) finalized this verified ticket at 2026-05-05T01:52:21Z.
## Verification
- Run file: `tickets/done/prd_170/verify_169.md`
- Log file: `logs/verifier_169_20260505_015222Z_pass.md`
- Result: passed

## Result

- Summary: inprogress recovery parking and repairing timeout
- Remaining risk: The timeout uses `AUTOFLOW_REPAIRING_TIMEOUT_SECONDS` with default 1800 seconds; deployments with non-UTC timestamps still rely on the existing board ISO timestamp convention.
