# Planner Startup Rules

Injected role rules for `planner` / `plan` runners.

## Startup Scan

- Run `autoflow tool runner-tool planner queue-snapshot --runner <runner-id>
  --max-items 12` once before opening files.
- If `snapshot.ai_followup_recommended=false`, summarize the compact result and
  idle without opening source files.
- If work is needed, inspect only
  `snapshot.ai_followup_scope.inspect_only_recent_sources`.
- Do not open files outside that scope, and do not follow references inside the
  scoped files unless the compact output explicitly makes them required.
- Process retry orders before ordinary order work.
- For every ordinary order, the planner runner uses a PRD-first intake flow:
  read the order, collect repository/wiki evidence, write assumptions and
  remaining unknowns into a generated PRD, then let the PRD-to-ticket flow
  create the detailed TODO. Intake hints such as `Planner Direct-TODO Hint` or
  legacy `Express` fields are non-authoritative. Direct TODO is reserved for an
  explicitly requested, single-file, mechanically obvious change.
- When an ordinary order is consumed into a generated PRD, preserve the original
  order as done evidence by moving it from `tickets/order/order_NNN.md` to
  `tickets/done/<prd-key>/order_NNN.md` after the PRD records the original
  `tickets/order/order_NNN.md` source path. Do not leave consumed ordinary
  orders in `tickets/order/`; stale source files make the queue look stuck even
  though `planner queue-snapshot` suppresses already-promoted orders.
- Do not leave ordinary order ambiguity as `blocked`, `needs-info`, or
  `needs_user`. Only unsafe requests may be refused instead of becoming a PRD.
- Promote populated PRD queue items or clear orders into concrete todo tickets
  using the narrowest safe scope.
- If a ticket carries stale recovery state, blocked state, or no-progress
  evidence, make a board-only recovery decision before creating more work.
- Create at most one worker-facing todo per focused startup turn. If the turn
  first translates an ordinary order into a generated PRD and that PRD is
  concrete enough to promote, continue directly to the PRD-to-ticket handoff
  before idling; do not leave a runnable generated PRD waiting for a second
  wake just to create the todo.
- After a PRD-backed TODO is written, the source `tickets/prd/prd_NNN.md` must
  be gone from the active PRD queue in the same focused turn. Prefer the
  `write-ticket` tool's `archived_prds` result; if it reports missing/empty for
  an existing PRD source, run `item-archive` for that PRD before idling.

## Boundaries

- Do not edit product code.
- Do not create or delete ticket worktrees.
- Do not merge, verify, or finalize worker output.
- Write only planner-owned markdown state under the board.
- Run guard after planner-authored recovery edits when available.
- Do not call `runner-wake`, `runner-stage`, `runner-tokens`, or `date` during
  the focused startup turn.

## Idle

Idle only after confirming there is no actionable order, prd, todo, or
planner-owned recovery work.
