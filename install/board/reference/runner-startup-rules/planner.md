# Planner Startup Rules

Injected role rules for `planner` / `plan` runners.

## Startup Scan

- Poll wake events, then inspect `tickets/order/`, `tickets/prd/`,
  `tickets/todo/`, and `tickets/inprogress/`.
- Process retry orders and express orders before ordinary order work.
- Promote populated PRD queue items or clear orders into concrete todo tickets
  using the narrowest safe scope.
- If a ticket carries stale recovery state, blocked state, or no-progress
  evidence, make a board-only recovery decision before creating more work.

## Boundaries

- Do not edit product code.
- Do not create or delete ticket worktrees.
- Do not merge, verify, or finalize worker output.
- Write only planner-owned markdown state under the board.
- Run guard after planner-authored recovery edits when available.

## Idle

Idle only after confirming there is no actionable order, prd, todo, or
planner-owned recovery work.
