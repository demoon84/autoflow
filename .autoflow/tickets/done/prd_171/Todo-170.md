# Ticket

## Ticket

- ID: Todo-170
- PRD Key: prd_171
- Plan Candidate: Plan AI handoff from tickets/done/prd_171/prd_171.md
- Title: worker self-refresh dirty deadlock
- Stage: done
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI: worker
- Last Updated: 2026-05-05T02:00:55Z

## Goal

- 이번 작업의 목표: ticket owner runtime 이 자기 ticket markdown / verification markdown 의 Stage, Last Updated, runtime evidence 갱신을 PROJECT_ROOT dirty overlap 으로 오인해 `ticket_stage_blocked` 를 반복하는 self-refresh deadlock 을 끊는다.

## References

- PRD: tickets/done/prd_171/prd_171.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_171]]
- Plan Note:
- Ticket Note: [[Todo-170]]

## Allowed Paths

- `.autoflow/scripts/start-ticket-owner.sh`
- `runtime/board-scripts/start-ticket-owner.sh`
- `packages/cli/run-role.sh`
- `runtime/board-scripts/run-role.sh`
- `packages/cli/runners-project.sh`
- `runtime/board-scripts/runners-project.sh`

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-170`
- Branch: autoflow/Todo-170
- Base Commit: e4c0ebc18230ff2e2715b26c4283ed114e69a092
- Worktree Commit: 
- Integration Status: already_in_project_root

## Goal Runtime
- Status: complete
- Started At: 2026-05-05T01:53:42Z
- Started Epoch: 1777946022
- Updated At: 2026-05-05T02:00:56Z
- Tick Count: 3
- Time Used Seconds: 434
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: complete
- Last Progress Fingerprint: 1744597555

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [x] When PROJECT_ROOT dirty overlap contains only the active ticket's own `.autoflow/tickets/inprogress/Todo-NNN.md` and/or `.autoflow/tickets/inprogress/verify_NNN.md`, ticket-owner does not return `reason=ticket_stage_blocked`.
- [x] When PROJECT_ROOT dirty overlap contains any non-self-refresh path inside the ticket `Allowed Paths`, the existing blocked dirty / planner orchestration behavior still triggers with explicit path evidence.
- [x] `packages/cli/run-role.sh` and `runtime/board-scripts/run-role.sh` do not preserve a stale `ticket_stage_blocked` state solely because of self-refresh metadata changes.
- [x] `runners-project.sh stop` or the relevant cleanup path can identify and terminate orphan `loop-worker <runner-id>` processes whose command path belongs to a removed ticket worktree, without affecting the main project runner for the same runner id.
- [x] Current sidecar scripts and installed template scripts stay behaviorally aligned for the changed logic.
- [x] `bash -n` passes for every modified shell file.

## Next Action
- Complete: the inline merge finalizer integrated the AI-merged ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: Plan AI 가 backlog PRD 에서 todo 티켓을 생성한 직후.
- 직전 작업: scripts/start-plan.sh 가 `tickets/done/prd_171/prd_171.md` 를 보관하고 `tickets/todo/Todo-170.md` 를 만들었다. Consumed order 는 `tickets/done/prd_171/order_151.md` 로 보관됐다.
- 재개 시 먼저 볼 것: `tickets/done/prd_171/prd_171.md`, `tickets/done/prd_171/order_151.md`, `.autoflow/scripts/start-ticket-owner.sh`, `packages/cli/run-role.sh`, `packages/cli/runners-project.sh`.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_171/prd_171.md at 2026-05-04T00:27:24Z.
- Wiki query `bin/autoflow wiki query --term "worker self-refresh dirty deadlock ticket Stage Allowed Paths run-role runners-project orphan process" --rag` returned `result_count=0`; no prior wiki constraint was found.
- Owner wiki context pass at 2026-05-05T01:54Z used `bin/autoflow wiki query --term "worker self-refresh dirty deadlock ticket Stage Allowed Paths run-role runners-project orphan process ticket_stage_blocked" --rag` from the ticket worktree and returned `result_count=0`; implementation follows the PRD/order constraints without additional wiki-derived constraints.
- Mini-plan: (1) add a narrow self-refresh dirty filter in `start-ticket-owner.sh` and the installed template copy so only the active `Todo-NNN.md` / `verify_NNN.md` paths are ignored, while any other Allowed Paths dirty overlap still blocks with path evidence; (2) update `run-role.sh` and its installed template copy so stale `ticket_stage_blocked` state is cleared when only self-refresh paths are dirty; (3) add worktree-aware orphan `loop-worker <runner-id>` cleanup to both `runners-project.sh` copies; (4) verify with `bash -n`, required grep checks, and focused shell reproductions for self-refresh vs non-self dirty classification.
- Implementation evidence at 2026-05-05T02:00:16Z: `start-ticket-owner.sh` now filters only `.autoflow/tickets/inprogress/Todo-<id>.md` and `verify_<id>.md` from dirty overlap before blocking; `run-role.sh` resets stale `last_result=ticket_stage_blocked` only after excluding those self-refresh paths; `runners-project.sh stop` logs and kills worktree-local orphan `loop-worker <runner-id>` processes while skipping the canonical project script path.
- Verification evidence: focused temp-repo reproduction returned `self_refresh_result=clean` and `nonself_result=dirty`; focused start-filter reproduction emitted no output for only `Todo-170.md`/`verify_170.md` and emitted `packages/cli/run-role.sh` for mixed dirty paths. Required PRD command passed in the ticket worktree and again from PROJECT_ROOT after manual integration.
- Source order evidence: `Todo-163.md` / `verify_163.md` were reported as the dirty overlap that kept returning `reason=ticket_stage_blocked` after every worker self-refresh.
- Scope decision: keep the self-refresh exception limited to the active ticket's own markdown and matching verify file. Non-self dirty paths must still trigger the documented blocked-dirty / planner orchestration flow.
- Related PRDs already cover adjacent symptoms: `prd_168` check ledger live-lock, `prd_169` stale `worker.state.last_result`, and `prd_170` needs_user / repairing parking. Do not broaden this ticket into those areas.
- Guard after ticket creation returned `status=warning`, `error_count=0`, `warning_count=4`; unresolved cleanup candidates are leftover/dirty worktrees for `Todo-119`, `Todo-157`, `Todo-162`, and `Todo-163`. Planner did not delete, reset, or manage those worktrees.

- Runtime hydrated worktree dependency at 2026-05-05T01:53:41Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- AI worker prepared todo at 2026-05-05T01:53:40Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-170; run=tickets/inprogress/verify_170.md
- AI worker prepared resume at 2026-05-05T01:54:18Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-170; run=tickets/inprogress/verify_170.md
- Queued without worktree commit at 2026-05-05T02:00:54Z: PROJECT_ROOT already matches the ticket worktree for all Allowed Paths with code changes.
- Impl AI worker marked verification pass at 2026-05-05T02:00:54Z; runtime finalizer will not perform merge operations.
- Coordinator post-merge cleanup at 2026-05-05T02:00:55Z: removed_worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-170 deleted_branch=autoflow/Todo-170.
- Inline merge finalizer (worker worker) finalized this verified ticket at 2026-05-05T02:00:55Z.
## Verification
- Run file: `tickets/done/prd_171/verify_170.md`
- Log file: `logs/verifier_170_20260505_020056Z_pass.md`
- Result: passed

## Result

- Summary: self-refresh dirty deadlock 방지
- Remaining risk: Long-running runner behavior still depends on subsequent heartbeat observation, as noted in the PRD, but changed shell logic and focused reproductions cover the ticket acceptance criteria.
