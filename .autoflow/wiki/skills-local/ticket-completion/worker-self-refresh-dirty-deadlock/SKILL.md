---
name: "worker-self-refresh-dirty-deadlock"
description: "worker self-refresh dirty deadlock"
pattern_type: ticket_completion
applies_to:
  module: ".autoflow/scripts/start-ticket-owner.sh"
  keywords:
    - "worker"
    - "self"
    - "refresh"
    - "dirty"
    - "deadlock"
    - "autoflow"
    - "scripts"
    - "start"
    - "ticket"
    - "owner"
    - "runtime"
    - "board"
pinned: false
created_from:
  prd: "prd_171"
  ticket: "tickets_170"
created_at: "2026-05-05T02:00:57Z"
---

# worker self-refresh dirty deadlock

## Trigger

- Reuse when: worker self-refresh dirty deadlock
- Source ticket: `tickets/done/prd_171/tickets_170.md`

## Recommended Procedure

- When PROJECT_ROOT dirty overlap contains only the active ticket's own `.autoflow/tickets/inprogress/tickets_NNN.md` and/or `.autoflow/tickets/inprogress/verify_NNN.md`, ticket-owner does not return `reason=ticket_stage_blocked`.
- When PROJECT_ROOT dirty overlap contains any non-self-refresh path inside the ticket `Allowed Paths`, the existing blocked dirty / planner orchestration behavior still triggers with explicit path evidence.
- `packages/cli/run-role.sh` and `runtime/board-scripts/run-role.sh` do not preserve a stale `ticket_stage_blocked` state solely because of self-refresh metadata changes.
- `runners-project.sh stop` or the relevant cleanup path can identify and terminate orphan `loop-worker <runner-id>` processes whose command path belongs to a removed ticket worktree, without affecting the main project runner for the same runner id.
- Current sidecar scripts and installed template scripts stay behaviorally aligned for the changed logic.

## Pitfalls

- Long-running runner behavior still depends on subsequent heartbeat observation, as noted in the PRD, but changed shell logic and focused reproductions cover the ticket acceptance criteria.

## Verification Pattern

- Command: ``bash -lc 'bash -n .autoflow/scripts/start-ticket-owner.sh runtime/board-scripts/start-ticket-owner.sh packages/cli/run-role.sh runtime/board-scripts/run-role.sh packages/cli/runners-project.sh runtime/board-scripts/runners-project.sh && grep -n "ticket_stage_blocked" .autoflow/scripts/start-ticket-owner.sh runtime/board-scripts/start-ticket-owner.sh packages/cli/run-role.sh runtime/board-scripts/run-role.sh && grep -n "loop-worker" packages/cli/runners-project.sh runtime/board-scripts/runners-project.sh'``

## Source Evidence

- Ticket: `tickets/done/prd_171/tickets_170.md`
- PRD: `tickets/done/prd_171/prd_171.md`
- Verification: `tickets/done/prd_171/verify_170.md`
- Result summary: self-refresh dirty deadlock 방지
