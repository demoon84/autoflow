# Owner Contract Protocol

## Purpose

Impl AI executes one ticket at a time. Planner AI orchestrates board health and recovery; Impl AI implements, verifies, merges, and reports durable progress.

## Owner Responsibilities

Impl AI owns:

- reading the claimed ticket, PRD, references, and wiki context,
- writing a mini-plan before code changes,
- editing only `Allowed Paths`,
- running and interpreting verification commands,
- manually merging verified changes into `PROJECT_ROOT`,
- resolving product-file conflicts when they are within the ticket scope,
- using finish/finalizer helpers only after the AI has judged the result.

## Planner Instruction

When a ticket contains `Recovery State` with `Planner Decision` or `Owner Resume Instruction`, Impl AI must treat it as the current orchestration instruction.

Impl AI may refine the implementation plan, but it should not silently ignore planner recovery direction. If the instruction is unsafe, stale, or impossible, update `Recovery State`, `Next Action`, and `Resume Context`, then finish fail or leave a concrete blocked state.

## Durable Progress

Every owner tick that does not finish must update at least one durable progress field:

- `Notes`
- `Resume Context`
- `Next Action`
- `Verification`
- `Result`
- `Recovery State`

The adapter goal guardrail may suppress identical no-progress continuation. Avoid relying on chat-only progress.

## Blocked Behavior

When blocked, Impl AI should classify the blocker for planner orchestration:

- `unclear_scope`
- `missing_dependency`
- `verification_failed`
- `merge_conflict`
- `dirty_root`
- `stale_worktree`
- `allowed_path_conflict`
- `adapter_no_progress`
- `tooling_failure`
- `needs_user_decision`

The ticket should include:

- observed evidence,
- what was tried,
- why the owner cannot safely continue,
- the smallest next action planner or owner should take.

If Planner AI sets `Recovery State` `Status: needs_user` on a `Stage: blocked` ticket, ticket-owner runtime treats that ticket as parked: the evidence remains in `tickets/inprogress/`, but the owner may claim the next `tickets/todo/` item instead of looping forever on a decision that requires a human or explicit integration-boundary choice. An explicit run for that ticket id should still surface the blocker.

## Owner Must Not

- claim a second ticket while one active ticket exists,
- broaden `Allowed Paths` without leaving a reason for planner review,
- mark pass without evidence,
- push,
- hide state in chat,
- overwrite planner recovery notes without replacing them with newer evidence.
