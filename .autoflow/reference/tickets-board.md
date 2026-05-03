# Tickets Board

This directory is the state board inside `BOARD_ROOT`.

- `todo/`: tickets that are ready but not started.
- `inprogress/`: claimed `tickets_*.md` files and active verification notes. Legacy planner `plan_*.md` files also use this state while generating tickets.
- `ready-to-merge/`: legacy/compatibility state for Ticket Owner Mode tickets that passed owner verification and wait for finalization.
- `merge-blocked/`: legacy/compatibility state for ready tickets that need ticket-specific AI repair.
- `verifier/`: legacy tickets that finished implementation and wait for verification. Ticket Owner Mode may also resume compatible tickets from this state.
- `done/`: tickets that passed verification and were committed locally (`done/<project-key>/tickets_NNN.md`).
- `reject/`: tickets that failed verification and include `## Reject Reason`.
- `check/`: human-review ledger for automatic planner interventions. Files use `check_NNN.md`, start at `check_001.md`, and are separate from ticket / PRD / reject sequences.
- `verify_NNN.md`: a verification evidence file created under `inprogress/` and moved beside the final ticket.
- `inbox/`: quick order intake files that Plan AI may promote into generated PRDs and todo tickets.
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
  -> AI-led merge into PROJECT_ROOT
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

Verification evidence (`verify_NNN.md`) starts in `tickets/inprogress/`. In Ticket Owner Mode, the AI owner runs and judges verification, manually merges verified changes into `PROJECT_ROOT`, reruns needed verification, then finish/finalization moves the evidence to `tickets/done/<project-key>/verify_NNN.md`. On fail it moves to `tickets/reject/verify_NNN.md`. Each completed verification also writes a completion log under `BOARD_ROOT/logs/`.

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
  - Ticket Owner Mode continues implementation, AI-led verification, and AI-led merge in one ticket. On pass, `scripts/finish-ticket-owner.*` may prepare a worktree snapshot and finalize only after `PROJECT_ROOT` already contains the AI-merged result. Legacy todo updates `Notes`, `Result.Summary`, and `Verification: pending`, then moves the file to `verifier/` with `scripts/handoff-todo.*`.
- `ready-to-merge/`
  - Legacy/compatibility state for owner-verified tickets waiting for finalization.
  - The owner has decided verification pass; finalization must not change that decision.
  - Finalization scripts validate that the AI owner already merged the prepared work into `PROJECT_ROOT`, then archive evidence/logs/wiki and create the local completion commit.
  - Finalization scripts delete the completed ticket worktree and matching `autoflow/tickets_*` branch before the completion commit; cleanup notes belong in the same commit.
  - Finalization scripts must not rebase, cherry-pick, resolve conflicts, or otherwise merge product code.
- `merge-blocked/`
  - Contains ready tickets with ticket-specific blockers, such as invalid commit scope.
  - Repair the ticket worktree/branch as AI owner work, then rerun finish/finalization.
- `verifier/`
  - Contains legacy tickets waiting for verification. Ticket Owner Mode may resume compatible existing tickets here.
  - Legacy verifier heartbeat claims one ticket and runs verification from the `working_root` returned by `start-verifier.sh`.
  - One agent conversation should actively verify one ticket at a time.
  - On pass, legacy verifier behavior must also treat scripts as tools: prepare evidence/snapshots, then leave product-code merge and conflict resolution to AI-led work.
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
- `check/`
  - Contains best-effort records for automatic planner interventions such as reject auto-replan, reject auto-close, blocked-auto-recover, blocked-dirty-orchestration, and planner-authored orchestration cleanup commits.
  - File names use `check_NNN.md`; this sequence is independent from `tickets_NNN`, `prd_NNN`, `order_NNN`, and `reject_NNN`.
  - Each check file must include `title`, `created_at`, `event_type`, `prd_key`, `ticket_id`, and `source` metadata plus `## What Happened`, `## Evidence`, `## Recommended Human Action`, and `## Status`.
  - `## Status` must include `- [ ] 사람 확인 완료`. A human may mark it as `- [x] 사람 확인 완료` after review; desktop refresh treats checked files as confirmed.
  - Archiving or moving a check file out of `tickets/check/` removes it from the active desktop count on the next board refresh. Check files are review evidence only; they do not determine ticket pass/fail or runner stage.
- `inprogress/verify_NNN.md`
  - Active verification evidence for Ticket Owner Mode or verifier mode.
  - Run verification commands from `working_root` and write evidence here first.
  - Move this file beside the final ticket when verification completes.
- `backlog/`
  - Contains project specs before ticket execution starts.
  - Autoflow skill conversation authoring fills `project_*.md`.
  - One agent conversation should actively author one `project_*.md` file at a time.
  - After work begins, move the consumed PRD to `done/<project-key>/`.
- `inbox/`
  - Contains `orderNNN.md` files for small requests that do not need a full PRD handoff.
  - Order skills and `autoflow order create` may write here directly after an explicit order request.
  - Plan AI treats orders as implementation directives and promotes them into generated backlog PRDs and todo tickets using the safest narrow interpretation.
  - Unsafe orders stay here with a concrete blocker note; ambiguity alone should not create a repeated human-question loop.
  - Impl AI never claims directly from this folder.
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
- `Goal Runtime`, `Recovery State`
- `Reference Notes`
- `Last Updated`, `Next Action`, `Resume Context`
- `Verification`, `Result`
- `## Reject Reason` (only after moving to `reject/`)

Important:

- `References` paths are relative to `BOARD_ROOT`.
- `Allowed Paths` are repository-relative. During implementation, resolve them from the ticket worktree root when present; otherwise resolve them from `PROJECT_ROOT`.
- `Goal Runtime` is runner-owned durability metadata. It tracks active/blocked/complete status, tick count, elapsed time, no-progress suppression, and the last ticket fingerprint used by the adapter. Humans and agents may read it, but should not hand-edit it except for explicit board repair.
- `Recovery State` is planner/owner orchestration metadata. Planner AI may edit it to diagnose stalled or blocked work, and Impl AI may edit it to report or clear blockers. It should include status, failure class, evidence, planner decision, and owner resume instruction when recovery is active.
- A ticket number must exist in only one state folder at a time. Retries after reject receive a new ticket number.
- `todo/`, `inprogress/`, `ready-to-merge/`, `merge-blocked/`, `verifier/`, `done/`, and `reject/` are the state board. They may stay empty without nested README files.
- A `done/<project-key>/` ticket must link its final `verify_NNN.md` evidence.
- Each completed owner / verifier run should leave at least one completion log under `BOARD_ROOT/logs/`.
- Link related specs, plans, tickets, and verification notes with `## Reference Notes`.
- Heartbeat workers do not stop themselves. `status=idle` is a valid waiting state.
- Board location is authoritative. In the 3-runner topology (planner + worker + wiki), planner is the Orchestrator AI for board health and recovery, while Impl AI (`worker`) decides pass / fail after AI-led verification and runs the inline merge finalizer (`merge-ready-ticket.*`) itself. In the legacy role-pipeline, only verifier mode decides pass / fail.
