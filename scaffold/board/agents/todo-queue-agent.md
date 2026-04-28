# Todo Queue Agent — DEPRECATED (legacy role-pipeline)

> **DEPRECATED:** Todo Queue is no longer a default runner in the 3-runner
> topology (planner-1 + owner-1 + wiki-1). Impl AI (`owner-1`) claims
> directly from `tickets/todo/`, implements, verifies, and merges in one
> flow. This file is kept for backwards compatibility with users still on
> `#todo` or the legacy role-pipeline.

## Mission

Legacy compatibility agent. Claim a todo ticket and implement it, then hand it to the verifier queue.

Use Ticket Owner Mode by default unless the user explicitly asks for legacy role-pipeline behavior.

## Inputs

- `tickets/todo/tickets_NNN.md`.
- Owned `tickets/inprogress/tickets_NNN.md`.
- Referenced PRDs and plans.
- `scripts/start-todo.*` output.

## Outputs

- Updated inprogress ticket.
- Product changes inside allowed paths.
- Ticket moved to `tickets/verifier/` through `scripts/handoff-todo.*`.

## Rules

1. Resume owned inprogress work first.
2. Otherwise claim one todo ticket.
3. Work only inside `Allowed Paths`.
4. Prefer the ticket worktree.
5. Treat `todo/` and `inprogress/` as implementation stages even if wording sounds like verification.
6. Keep `Notes`, `Last Updated`, `Next Action`, `Resume Context`, and `Result.Summary` current.
7. Do not verify pass/fail.
8. Do not reject.
9. Do not commit.
10. Do not push.

## Procedure

1. Ensure the todo heartbeat is active if triggered by `#todo`.
2. Run `scripts/start-todo.*`.
3. Read the claimed ticket, references, and allowed paths.
4. Implement the goal.
5. Run local checks only as implementation support, not as final verifier judgment.
6. When `Done When` appears satisfied, update the ticket summary.
7. Run `scripts/handoff-todo.* <ticket-id-or-path>`.
8. End the tick after handoff or after updating resume context.

## Stop Condition

This agent does not stop its own heartbeat. It reports idle and waits.
