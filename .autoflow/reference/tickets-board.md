# Tickets Board

This directory is the state board inside `BOARD_ROOT`.

- `todo/`: tickets that are ready but not started.
- `inprogress/`: claimed `tickets_*.md` files and active verification notes. Legacy planner `plan_*.md` files also use this state while generating tickets.
- `ready-to-merge/`: Ticket Owner Mode tickets that passed owner verification and wait for the single merge bot.
- `merge-blocked/`: ready-to-merge tickets that need ticket-specific repair before merge-bot retry.
- `verifier/`: legacy tickets that finished implementation and wait for verification. Ticket Owner Mode may also resume compatible tickets from this state.
- `done/`: tickets that passed verification and were committed locally (`done/<project-key>/tickets_NNN.md`).
- `reject/`: tickets that failed verification and include `## Reject Reason`.
- `verify_NNN.md`: a verification evidence file created under `inprogress/` and moved beside the final ticket.
- `backlog/`: project specs that have not yet been converted into ticket work.
- `plan/`: legacy role-pipeline plan documents.
- `inprogress/plan_*.md`: legacy plans currently being consumed into tickets.
- `../logs/`: owner / verifier completion logs (`verifier_<ticket-id>_<timestamp>_<outcome>.md`).

Every `tickets_*.md` file under `inprogress/` should carry these owner fields:

- `Claimed By`
- `Execution Owner`
- `Verifier Owner`

Ticket filenames use `tickets_NNN.md`, for example `tickets_001.md`, `tickets_014.md`, or `tickets_120.md`.

## Lifecycle

Default Ticket Owner flow:

```text
tickets/backlog/prd_001.md
  -> tickets/inprogress/tickets_001.md
  -> tickets/inprogress/verify_001.md
  -> tickets/ready-to-merge/tickets_001.md
  -> tickets/ready-to-merge/verify_001.md
  -> tickets/done/prd_001/tickets_001.md
  -> tickets/done/prd_001/prd_001.md
   -> tickets/reject/reject_001.md
```

Legacy role-pipeline flow:

```text
tickets/backlog/prd_001.md
  -> tickets/plan/plan_001.md
  -> tickets/inprogress/plan_001.md
  -> tickets/todo/tickets_001.md
  -> tickets/inprogress/tickets_001.md
  -> tickets/verifier/tickets_001.md
  -> tickets/done/prd_001/tickets_001.md
  -> tickets/done/prd_001/prd_001.md
  -> tickets/done/prd_001/plan_001.md
   -> tickets/reject/reject_001.md
     -> tickets/done/prd_001/reject_001.md
```

These examples use `001`; each board allocates its own numbers.

Verification evidence (`verify_NNN.md`) starts in `tickets/inprogress/`. In Ticket Owner Mode, pass moves it first to `tickets/ready-to-merge/verify_NNN.md`, then merge-bot moves it to `tickets/done/<project-key>/verify_NNN.md`. On fail it moves to `tickets/reject/verify_NNN.md`. Each completed verification also writes a completion log under `BOARD_ROOT/logs/`.

## State Rules

- `todo/`
  - Contains ready work that has not started.
  - Requires clear `Goal`, `References`, `Allowed Paths`, and `Done When`.
  - If a file is in `todo/`, treat it as implementation work even when the title or acceptance criteria mention review or verification.
  - Ticket Owner Mode or legacy `start-todo.sh` claims one file by moving it to `inprogress/`.
- `inprogress/`
  - `tickets_*.md` files are claimed by Ticket Owner Mode or by a legacy todo worker.
  - Legacy `plan_*.md` files mean the planner is generating tickets from a plan.
  - One agent conversation should actively process one `tickets_*.md` file at a time.
  - If the same owner already has an `inprogress` ticket, resume that ticket instead of claiming a new one.
  - Required fields include `Stage`, `Claimed By`, `Execution Owner`, `Verifier Owner`, `Owner`, `Worktree`, `Last Updated`, `Next Action`, and `Resume Context`.
  - In a git repository, the owner works in the ticket worktree when one exists.
  - Runtime context keeps role context and active ticket context separate. Clear only the active ticket context after finishing a ticket.
  - Leave blockers in this state; do not move blocked work back to `todo/`.
  - Ticket Owner Mode continues implementation and verification in one ticket. On pass, `scripts/finish-ticket-owner.*` prepares a worktree snapshot and moves the ticket to `ready-to-merge/`. Legacy todo updates `Notes`, `Result.Summary`, and `Verification: pending`, then moves the file to `verifier/` with `scripts/handoff-todo.*`.
- `ready-to-merge/`
  - Contains owner-verified tickets waiting for the single merge bot.
  - The owner has decided verification pass; merge bot must not change that decision.
  - Merge bot runs `scripts/merge-ready-ticket.*`, integrates the prepared worktree commit into `PROJECT_ROOT`, archives evidence/logs/wiki, and creates the local completion commit.
  - Transient root blockers, such as an active rebase or conflicting dirty root paths, leave the ticket here for retry.
- `merge-blocked/`
  - Contains ready tickets with ticket-specific merge blockers, such as invalid commit scope or cherry-pick conflicts.
  - Repair the ticket worktree/branch, then move the ticket and run file back to `ready-to-merge/` for merge-bot retry.
- `verifier/`
  - Contains legacy tickets waiting for verification. Ticket Owner Mode may resume compatible existing tickets here.
  - Legacy verifier heartbeat claims one ticket and runs verification from the `working_root` returned by `start-verifier.sh`.
  - One agent conversation should actively verify one ticket at a time.
  - On pass, legacy verifier behavior may integrate ticket worktree changes into `PROJECT_ROOT`; Ticket Owner Mode should use `ready-to-merge/` plus merge bot instead.
- `done/`
  - Contains work that passed verification and has a local git commit.
  - Group tickets by project key, for example `done/prd_001/`.
  - Link `Result`, the final verification evidence path, and the completion log.
- `reject/`
  - Contains work that failed verification.
  - Requires `## Reject Reason` with verifier, timestamp, concrete cause, and replanning hint.
  - Legacy planner heartbeat may turn the failure reason into a new `Execution Candidates` entry and set the plan back to ready.
  - File names use `reject_NNN.md`.
  - After retry ticket creation, move the consumed reject file to `done/<project-key>/reject_NNN.md` as history.
- `inprogress/verify_NNN.md`
  - Active verification evidence for Ticket Owner Mode or verifier mode.
  - Run verification commands from `working_root` and write evidence here first.
  - Move this file beside the final ticket when verification completes.
- `backlog/`
  - Contains project specs before ticket execution starts.
  - Autoflow skill conversation authoring fills `project_*.md`.
  - One agent conversation should actively author one `project_*.md` file at a time.
  - After work begins, move the consumed PRD to `done/<project-key>/`.
- `plan/`
  - Contains legacy plans before ticket generation.
  - Legacy planner writes or updates `plan_*.md` from specs and rejects.
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

- `ID`, `Title`, `Stage`, `Owner`, `Claimed By`, `Execution Owner`, `Verifier Owner`
- `Project Key`
- `Goal`, `References`, `Allowed Paths`, `Done When`
- `Worktree`
- `Obsidian Links`
- `Last Updated`, `Next Action`, `Resume Context`
- `Verification`, `Result`
- `## Reject Reason` (only after moving to `reject/`)

Important:

- `References` paths are relative to `BOARD_ROOT`.
- `Allowed Paths` are repository-relative. During implementation, resolve them from the ticket worktree root when present; otherwise resolve them from `PROJECT_ROOT`.
- A ticket number must exist in only one state folder at a time. Retries after reject receive a new ticket number.
- `todo/`, `inprogress/`, `ready-to-merge/`, `merge-blocked/`, `verifier/`, `done/`, and `reject/` are the state board. They may stay empty without nested README files.
- A `done/<project-key>/` ticket must link its final `verify_NNN.md` evidence.
- Each completed owner / verifier run should leave at least one completion log under `BOARD_ROOT/logs/`.
- Link related specs, plans, tickets, and verification notes with `## Obsidian Links`.
- Heartbeat workers do not stop themselves. `status=idle` is a valid waiting state.
- Board location is authoritative. In Ticket Owner Mode, the owner decides pass / fail after verification and merge bot only integrates passed tickets. In the legacy role-pipeline, only verifier mode decides pass / fail.
