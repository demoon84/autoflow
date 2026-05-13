# Tickets Board

This directory is the state board inside `BOARD_ROOT`.

- `inbox/`: quick `order_NNN.md` intake plus worker fail retry orders (`order_<id>_retry_<N>_<timestamp>.md`).
- `backlog/`: approved or generated PRDs that have not yet become ticket work.
- `todo/`: worker-ready tickets that are not started.
- `inprogress/`: claimed `Todo-*.md` files. Verification evidence lives in each ticket's `## Verification` section. Legacy planner `plan_*.md` files may also use this state while generating tickets.
- `verifier/`: active semantic-review lane for the Verifier AI. Legacy verifier-compatible tickets may also appear here.
- `done/`: successful tickets, archived PRDs, consumed orders, and legacy history grouped by project key (`done/<project-key>/`).
- `ready-to-merge/` and `merge-blocked/`: legacy compatibility states for older Ticket Owner finalization flows.
- `check/`: retired human-review ledger for older planner interventions. It is not part of the default 4-runner flow.
- `plan/`: legacy role-pipeline plan documents.
- `../logs/`: owner / verifier completion logs.

Every active `Todo-*.md` file should carry these ownership fields:

- `AI`
- `Claimed By`
- `Execution AI`
- `Verifier AI`

Ticket filenames use `Todo-NNN.md`, for example `Todo-001.md`, `Todo-014.md`, or `Todo-120.md`.

## Runner Terms

The default actors are four **runners**: `planner`, `worker`, `verifier`, and
`wiki`. A runner is the LLM-backed decision-maker. A **runner tool** is a small
deterministic command the runner calls to mutate or inspect the board safely.
The canonical boundary is `reference/runner-tool-contract.md`.

For Planner work, prefer `scripts/runner-tool.ts planner ...` for additive
small actions such as `queue-snapshot`, `reserve-id`, `write-prd`,
`write-ticket`, `item-archive`, `recovery-update`, and `guard`. These tools do
not choose scope or write plans for the runner; they only make the chosen board
operation safe and auditable.

## Lifecycle

Default 4-runner flow:

```text
tickets/inbox/order_001.md or tickets/backlog/prd_001.md
  -> tickets/todo/Todo-001.md
  -> tickets/inprogress/Todo-001.md
  -> tickets/verifier/Todo-001.md
  -> tickets/done/prd_001/Todo-001.md
```

Fail retry flow:

```text
tickets/inprogress/Todo-001.md or tickets/verifier/Todo-001.md
  -> tickets/inbox/order_001_retry_1_<timestamp>.md
  -> tickets/todo/Todo-002.md
```

Legacy role-pipeline flow:

```text
tickets/backlog/prd_001.md
  -> tickets/plan/plan_001.md
  -> tickets/inprogress/plan_001.md
  -> tickets/todo/Todo-001.md
  -> tickets/inprogress/Todo-001.md
  -> tickets/verifier/Todo-001.md
  -> tickets/done/prd_001/Todo-001.md
```

These examples use `001`; each board allocates its own numbers.

Verification evidence lives in the ticket markdown (`## Verification`, `## Result`, and related notes). In Ticket Owner Mode, the AI owner runs and judges local verification, manually merges verified changes into `PROJECT_ROOT`, reruns needed verification, then finalization archives the successful ticket under `tickets/done/<project-key>/`. On fail, the full ticket body is embedded in an inbox retry order. Each completed run also writes a completion log under `BOARD_ROOT/logs/`.

## State Rules

- `inbox/`
  - Contains `order_NNN.md` files for small requests that do not need a full PRD handoff.
  - Contains `order_*_retry_*.md` worker fail retries with retry metadata and the full failed ticket body under `## Original Ticket`.
  - Order skills and `autoflow order create` may write here directly after an explicit order request.
  - Plan AI treats orders as implementation directives and promotes them into generated backlog PRDs and todo tickets using the safest narrow interpretation.
  - Unsafe orders stay here with a concrete blocker note; ambiguity alone should not create a repeated human-question loop.
  - Impl AI never claims directly from this folder.
- `backlog/`
  - Contains project specs before ticket execution starts.
  - After work begins, move the consumed PRD to `done/<project-key>/`.
- `todo/`
  - Contains ready work that has not started.
  - Requires clear `Goal`, `References`, `Allowed Paths`, and `Done When`.
  - If a file is in `todo/`, treat it as implementation work even when the title or acceptance criteria mention review or verification.
  - Ticket Owner Mode or legacy `start-todo.ts` claims one file by moving it to `inprogress/`.
- `inprogress/`
  - `Todo-*.md` files are claimed by Ticket Owner Mode or by a legacy todo worker.
  - Legacy `plan_*.md` files mean the planner is generating tickets from a plan.
  - One agent conversation should actively process one `Todo-*.md` file at a time.
  - If the same owner already has an `inprogress` ticket, resume that ticket instead of claiming a new one.
  - Required fields include `Stage`, `AI`, `Claimed By`, `Execution AI`, `Verifier AI`, `PRD Key`, `Worktree`, `Last Updated`, `Next Action`, and `Resume Context`.
  - In a git repository, the owner works in the ticket worktree when one exists.
  - Leave blockers in this state; do not move blocked work back to `todo/`.
  - Ticket Owner Mode continues implementation, local verification, and AI-led merge preparation in one ticket. On pass, `scripts/finish-ticket-owner.ts` finalizes only after `PROJECT_ROOT` already contains the AI-merged result.
- `verifier/`
  - Contains tickets waiting for semantic review by the active Verifier AI.
  - The verifier compares the finished diff with the ticket Title, Goal, and Done When items.
  - On pass, the finalizer may create the local completion commit. On fail, the ticket becomes an inbox retry order.
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
  - Contains owner / verifier completion history.
  - Record both pass and fail outcomes.
  - Each log should include the ticket snapshot and verification evidence snapshot.

Recommended `Stage` sequence:

- `todo` -> `claimed` -> `executing` -> `verifying` -> `done` / `rejected` / `blocked`

## Required Ticket Fields

Every ticket should keep these sections or fields:

- `ID`, `Title`, `Stage`, `AI`, `Claimed By`, `Execution AI`, `Verifier AI`
- `PRD Key`
- `Goal`, `References`, `Allowed Paths`, `Done When`
- `Worktree`
- `Goal Runtime`, `Recovery State`
- `Reference Notes`
- `Last Updated`, `Next Action`, `Resume Context`
- `Verification`, `Result`
- `## Reject Reason` only when embedded in a retry order's historical failed-ticket body.

Important:

- `References` paths are relative to `BOARD_ROOT`.
- `Allowed Paths` are repository-relative. During implementation, resolve them from the ticket worktree root when present; otherwise resolve them from `PROJECT_ROOT`.
- `Goal Runtime` is runner-owned durability metadata. It tracks active/blocked/complete status, tick count, elapsed time, no-progress suppression, and the last ticket fingerprint used by the adapter. Humans and agents may read it, but should not hand-edit it except for explicit board repair.
- `Recovery State` is planner/owner orchestration metadata. Planner AI may edit it to diagnose stalled or blocked work, and Impl AI may edit it to report or clear blockers. It should include status, failure class, evidence, planner decision, and owner resume instruction when recovery is active.
- A ticket number must exist in only one state folder at a time. Retries after fail receive a new ticket number.
- `inbox/`, `backlog/`, `todo/`, `inprogress/`, `verifier/`, and `done/` are the default state board. They may stay empty without nested README files.
- A `done/<project-key>/` ticket must carry its final `## Verification` evidence.
- Each completed owner / verifier run should leave at least one completion log under `BOARD_ROOT/logs/`.
- Link related specs, plans, tickets, and verification notes with `## Reference Notes`.
- Heartbeat workers do not stop themselves. `status=idle` is a valid waiting state.
- Board location is authoritative. In the 4-runner topology (planner + worker + verifier + wiki), planner owns board orchestration and recovery notes, worker owns implementation and merge preparation, verifier owns semantic diff review, and wiki owns derived knowledge.
