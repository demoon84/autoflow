---
name: "inprogress-recovery-parking-and-repairing-timeout"
description: "inprogress recovery parking and repairing timeout"
pattern_type: ticket_completion
applies_to:
  module: ".autoflow/scripts/start-plan.sh"
  keywords:
    - "inprogress"
    - "recovery"
    - "parking"
    - "and"
    - "repairing"
    - "timeout"
    - "autoflow"
    - "scripts"
    - "start"
    - "plan"
    - "common"
    - "runtime"
pinned: false
created_from:
  prd: "prd_170"
  ticket: "tickets_169"
created_at: "2026-05-05T01:52:23Z"
---

# inprogress recovery parking and repairing timeout

## Trigger

- Reuse when: inprogress recovery parking and repairing timeout
- Source ticket: `tickets/done/prd_170/tickets_169.md`

## Recommended Procedure

- planner preflight detects `tickets/inprogress/*.md` with `Stage: blocked` and `Recovery State.Status: needs_user`, records a durable parking decision, and prevents worker from repeatedly blocking on that ticket.
- planner preflight detects `Recovery State.Status: repairing` older than the configured timeout (default 30 minutes), escalates with concrete Evidence / Planner Decision / Owner Resume Instruction, and does not append duplicate Notes for unchanged evidence.
- worker(`ticket`) tick entry validates its active item before dispatch; if the item is parked `needs_user` or timeout-stale `repairing`, it clears stale active item / `ticket_stage_blocked` state narrowly and proceeds to the next eligible todo ticket.
- sidecar `.autoflow/scripts/*` and template `runtime/board-scripts/*` contain equivalent recovery behavior where applicable.
- existing normal blocked-dirty auto-recover and reject auto-replan flows continue to emit their documented `source=` values.

## Pitfalls

- The timeout uses `AUTOFLOW_REPAIRING_TIMEOUT_SECONDS` with default 1800 seconds; deployments with non-UTC timestamps still rely on the existing board ISO timestamp convention.

## Verification Pattern

- Command: ``bash -lc 'bash -n .autoflow/scripts/start-plan.sh .autoflow/scripts/common.sh runtime/board-scripts/start-plan.sh runtime/board-scripts/common.sh packages/cli/run-role.sh && grep -R "ticket_stage_blocked" .autoflow/runners/state/worker.state >/dev/null 2>&1; test $? -ne 0 || grep -R "active_item=" .autoflow/runners/state/worker.state'``

## Source Evidence

- Ticket: `tickets/done/prd_170/tickets_169.md`
- PRD: `tickets/done/prd_170/prd_170.md`
- Verification: `tickets/done/prd_170/verify_169.md`
- Result summary: inprogress recovery parking and repairing timeout
