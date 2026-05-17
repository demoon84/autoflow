# Tickets Board

This directory is the state board inside `BOARD_ROOT`.

- `order/`: quick `order_NNN.md` intake plus verifier replan retry orders (`order_<id>_retry_<N>_<timestamp>.md`).
- `prd/`: approved or generated PRDs that have not yet become ticket work.
- `todo/`: worker-ready tickets that are not started.
- `inprogress/`: claimed `Todo-*.md` files. Verification evidence lives in each ticket's `## Verification` section. Legacy planner `plan_*.md` files may also use this state while generating tickets.
- `verifier/`: active semantic-review lane for the verifier runner. Legacy verifier-compatible tickets may also appear here.
- `done/`: successful tickets, archived PRDs, consumed orders, and legacy history grouped by project key (`done/<project-key>/`).
- `ready-to-merge/` and `merge-blocked/`: legacy compatibility states for older Worker finalization flows.
- `check/`: retired human-review ledger for older planner interventions. It is not part of the default 4-runner flow.
- `plan/`: legacy role-pipeline plan documents.
- `../logs/`: worker / verifier completion logs.

Every active `Todo-*.md` file should carry these claim fields:

- `AI`
- `Claimed By`
- `Execution AI`
- `Verifier Runner`

Legacy tickets may still contain `Verifier AI`; treat it as a read-only alias for `Verifier Runner`.

Ticket filenames use `Todo-NNN.md`, for example `Todo-001.md`, `Todo-014.md`, or `Todo-120.md`.

## Runner Terms

The default actors are four **runners**: `planner`, `worker`, `verifier`, and
`wiki`. A runner is the LLM-backed decision-maker. A **runner tool** is a small
deterministic command the runner calls to mutate or inspect the board safely.
The canonical boundary is `reference/runner-tool-contract.md`.

For Planner work, prefer `autoflow tool runner-tool planner ...` for additive
small actions such as `queue-snapshot`, `reserve-id`, `write-prd`,
`write-ticket`, `item-archive`, `recovery-update`, and `guard`. These tools do
not choose scope or write plans for the runner; they only make the chosen board
operation safe and auditable.

## Lifecycle

Default 4-runner flow:

```text
tickets/order/order_001.md or tickets/prd/prd_001.md
  -> tickets/todo/Todo-001.md
  -> tickets/inprogress/Todo-001.md
  -> tickets/verifier/Todo-001.md
  -> tickets/done/prd_001/Todo-001.md
```

Replan retry flow:

```text
tickets/inprogress/Todo-001.md
  -> tickets/order/order_001_retry_1_<timestamp>.md
  -> tickets/todo/Todo-002.md
```

Legacy role-pipeline flow:

```text
tickets/prd/prd_001.md
  -> tickets/plan/plan_001.md
  -> tickets/inprogress/plan_001.md
  -> tickets/todo/Todo-001.md
  -> tickets/inprogress/Todo-001.md
  -> tickets/verifier/Todo-001.md
  -> tickets/done/prd_001/Todo-001.md
```

These examples use `001`; each board allocates its own numbers.

Verification evidence lives in the ticket markdown (`## Verification`, `## Result`, and related notes). In Worker Mode, the worker runner runs and judges local verification, hands off to verifier before any `PROJECT_ROOT` merge, then handles the verifier decision. On pass, worker manually merges approved changes into `PROJECT_ROOT`, reruns needed verification, and finalization archives the successful ticket under `tickets/done/<project-key>/`. On revise, worker keeps the same worktree and resubmits. On replan, worker creates the order retry, deletes the worktree, and waits for the planner runner to issue the follow-up TODO. Each completed run also writes a completion log under `BOARD_ROOT/logs/`.

## State Rules

- `order/`
  - Contains `order_NNN.md` files captured after user conversation. Ordinary orders feed generated PRDs first.
  - Contains `order_*_retry_*.md` verifier replan retries with retry metadata and the full replaced ticket body under `## Original Ticket`.
  - Order skills and `autoflow order create` may write here directly after an explicit order request.
  - The planner runner treats orders as implementation directives, gathers repository/wiki evidence, and writes generated PRD queue items with assumptions and remaining unknowns. Direct TODO is reserved for explicitly requested, single-file, mechanically obvious changes.
  - Unsafe orders stay here with a concrete blocker note; ambiguity alone should become PRD content, not a repeated human-question loop or a stuck `blocked`/`needs-info` order.
  - The worker runner never claims directly from this folder.
- `prd/`
  - Contains project specs before ticket execution starts.
  - After work begins, move the consumed PRD to `done/<project-key>/`.
- `todo/`
  - Contains ready work that has not started.
  - Requires clear `Goal`, `References`, `Allowed Paths`, and `Done When`.
  - If a file is in `todo/`, treat it as implementation work even when the title or acceptance criteria mention review or verification.
  - Worker Mode or legacy `start-todo.ts` claims one file by moving it to `inprogress/`.
- `inprogress/`
  - `Todo-*.md` files are claimed by Worker Mode or by a legacy todo worker.
  - Legacy `plan_*.md` files mean the planner is generating tickets from a plan.
  - One agent conversation should actively process one `Todo-*.md` file at a time.
  - If the same worker already has an `inprogress` ticket, resume that ticket instead of claiming a new one.
  - Required fields include `Stage`, `AI`, `Claimed By`, `Execution AI`, `Verifier Runner`, `PRD Key`, `Worktree`, `Last Updated`, `Next Action`, and `Resume Context`.
  - In a git repository, the worker works in the ticket worktree when one exists.
  - Leave blockers in this state; do not move blocked work back to `todo/`.
  - Worker Mode continues implementation, local verification, verifier handoff, and verifier-approved merge in one ticket. `autoflow tool finish-ticket` finalizes only after verifier pass and after `PROJECT_ROOT` already contains the worker-merged result.
- `verifier/`
  - Contains tickets waiting for semantic review by the active verifier runner.
  - The verifier compares the finished diff with the ticket Title, Goal, and Done When items.
  - On pass, verifier records a pass marker, moves the original inprogress ticket to worker merge-pending state, removes the verifier copy, and wakes worker.
  - On revise, verifier moves the original inprogress ticket to `revision_requested`, removes the verifier copy, and wakes worker to correct the same worktree.
  - On replan, verifier moves the original inprogress ticket to `replan_requested`, removes the verifier copy, and wakes worker to create a retry order and delete the worktree.
- `done/`
  - Contains work that passed verification and has a local git commit.
  - Group tickets by project key, for example `done/prd_001/`.
  - Link `Result`, ticket `## Verification`, and the completion log.
- `plan/`
  - Contains legacy plans before ticket generation.
  - Legacy planner writes or updates `plan_*.md` from specs and retry orders.
- `inprogress/plan_*.md`
  - Contains legacy plans currently being converted into tickets.
  - Move the plan to `done/<project-key>/plan_NNN.md` after ticket generation.
- `../logs/`
  - Contains worker / verifier completion history.
  - Record pass, revise, and replan outcomes.
  - Each log should include the ticket snapshot and verification evidence snapshot.

Recommended `Stage` sequence:

- `todo` -> `claimed` -> `executing` -> `verifying` -> `verify_pending` -> `verified_pending_merge` / `revision_requested` / `replan_requested` -> `done` / `blocked`

## Required Ticket Fields

Every ticket should keep these sections or fields:

- `ID`, `Title`, `Stage`, `AI`, `Claimed By`, `Execution AI`, `Verifier Runner`
- `PRD Key`
- `Goal`, `References`, `Allowed Paths`, `Done When`
- `Worktree`
- `Goal Runtime`, `Recovery State`
- `Reference Notes`
- `Last Updated`, `Next Action`, `Resume Context`
- `Verification`, `Result`
- `## Replan Reason` only when embedded in a retry order's historical replaced-ticket body.

Important:

- `References` paths are relative to `BOARD_ROOT`.
- `Allowed Paths` are repository-relative. During implementation, resolve them from the ticket worktree root when present; otherwise resolve them from `PROJECT_ROOT`.
- `Goal Runtime` is runner-owned durability metadata. It tracks active/blocked/complete status, tick count, elapsed time, no-progress suppression, and the last ticket fingerprint used by the adapter. Humans and agents may read it, but should not hand-edit it except for explicit board repair.
- `Recovery State` is planner/worker orchestration metadata. The planner runner may edit it to diagnose stalled or blocked work, and the worker runner may edit it to report or clear blockers. It should include status, failure class, evidence, planner decision, and worker resume instruction when recovery is active.
- A ticket number must exist in only one state folder at a time. Retries after replan receive a new ticket number.
- `order/`, `prd/`, `todo/`, `inprogress/`, `verifier/`, and `done/` are the default state board. They may stay empty without nested README files.
- A `done/<project-key>/` ticket must carry its final `## Verification` evidence.
- Each completed worker / verifier run should leave at least one completion log under `BOARD_ROOT/logs/`.
- Link related specs, plans, tickets, and verification notes with `## Reference Notes`.
- Runners do not stop themselves. `status=idle` is a valid waiting state.
- Board location is authoritative. In the 4-runner topology (planner + worker + verifier + wiki), planner owns board orchestration and recovery notes, worker owns implementation and merge preparation, verifier owns semantic diff review, and wiki owns derived knowledge.
