# Autoflow Board

This directory is a local AI work harness installed inside a host project.
It lets Codex, Claude Code, OpenCode, Gemini CLI, and shell runners share one file-based source of truth.

The chat window can start work, but the board owns work state.

## Default Flow

Use Ticket Owner Mode by default:

1. User starts spec handoff with Claude `/af` / `/autoflow`, Codex `$af` / `$autoflow`, or compatibility aliases `#af` / `#autoflow`.
2. The agent drafts a full spec in chat.
3. The user explicitly approves saving.
4. The approved spec is saved as `tickets/backlog/prd_NNN.md`.
5. A Ticket Owner runner creates or claims one ticket in `tickets/inprogress/`.
6. The same owner writes a mini-plan, implements, runs and judges verification, manually merges verified work into `PROJECT_ROOT`, records evidence, and finishes pass or fail.
7. Passed owner work is finalized only after the AI-merged result is already present in `PROJECT_ROOT`.
8. The finalization runtime validates the AI-merged result, writes the completion log, refreshes derived wiki knowledge, and moves it to `tickets/done/<project-key>/` with a local commit.
9. Failed work moves to `tickets/reject/` with `## Reject Reason`.

Legacy role-pipeline mode (`#plan`, `#todo`, `#veri`) remains available for compatibility, but it is not the default.

## Important Directories

- `tickets/backlog/`: approved specs waiting for execution.
- `tickets/inprogress/`: active Ticket Owner tickets and verification records.
- `tickets/ready-to-merge/`: legacy/compatibility state for verified owner tickets waiting for finalization.
- `tickets/merge-blocked/`: legacy/compatibility state for ready tickets that need ticket-specific AI repair.
- `tickets/todo/`: legacy implementation queue.
- `tickets/verifier/`: legacy verification queue.
- `tickets/done/<project-key>/`: passed tickets, archived specs, archived plans, and verification records.
- `tickets/reject/`: failed tickets with reject reasons.
- `agents/`: AI role instructions.
- `automations/`: heartbeat, hook, and context contracts.
- `reference/`: templates and board documentation.
- `rules/`: verification and wiki maintenance rules.
- `runners/`: local runner configuration, state, and logs.
- `conversations/`: approved handoff summaries.
- `metrics/`: progress snapshots.
- `wiki/`: derived project knowledge.
- `logs/`: completion logs and hook dispatch logs.

## Trigger Summary

- Claude `/af` / `/autoflow`: spec handoff only.
- Codex `$af` / `$autoflow`: spec handoff only.
- `#af` / `#autoflow`: compatibility aliases for spec handoff only.
- `autoflow run ticket`: default Ticket Owner execution.
- `autoflow runners start coordinator-1`: looped coordinator for diagnostics, finalization visibility when present, and wiki-bot maintenance.
- Desktop Owner runner: default Ticket Owner execution from the UI.
- `#plan`: legacy planner heartbeat.
- `#todo`: legacy todo heartbeat.
- `#veri`: legacy verifier heartbeat.

## Spec Handoff Rules

Spec handoff never starts implementation.

The agent must:

1. Read `agents/spec-author-agent.md`.
2. Reserve or resume a spec slot with `scripts/start-spec.*` when available.
3. Ask for missing goal, scope, allowed paths, acceptance criteria, and verification details.
4. Show the complete spec in chat.
5. Save only after explicit user approval.
6. Save only to `tickets/backlog/` and optional `conversations/` archive.

## Ticket Owner Rules

Ticket Owner work should be narrow and durable:

- One owner handles one ticket at a time.
- Work inside the ticket worktree when available.
- Edit only `Allowed Paths`.
- Update `Notes`, `Resume Context`, `Verification`, and `Result` as durable state.
- Use runtime scripts for claim, verification, finish, and context cleanup.
- On pass, the AI owner merges verified changes into `PROJECT_ROOT` itself, resolves conflicts itself, reruns needed verification, and then uses finish/finalization scripts only as bookkeeping tools.
- Do not push.

## Verification Rules

Verification must be evidence-based:

- Run the specified command from the ticket working root.
- Check acceptance criteria, not only command exit code.
- Record stdout/stderr summaries when useful.
- Use browser tools only when rendered behavior must be observed.
- Pass and fail both require a verification record and completion log.

## Wiki Rules

The wiki is a derived knowledge map. It is not the source of truth for stage, ownership, pass/fail, or commit state.

Use the wiki to summarize:

- completed work,
- decisions,
- known patterns,
- repeated failures,
- architecture notes.

## Coordinator Rules

Coordinator mode diagnoses board health and may report finalization opportunities, but it does not own product-code merge.

Use `autoflow runners start coordinator-1` for the default looped coordinator when active tickets are blocked, worktree state looks suspicious, runner state does not explain what to do next, `tickets/ready-to-merge/` contains work, or derived wiki maintenance needs an adapter. The coordinator performs a cheap precheck each tick and runs full doctor diagnostics only when a problem or finalization opportunity is present; unchanged problem fingerprints skip repeated full diagnosis until board state changes. It reports shared Allowed Path blockers, active-ticket worktree health, dirty `PROJECT_ROOT` overlap, shared non-base HEAD groups, runner readiness, and board scaffold issues. It must not implement, verify, rebase, cherry-pick, resolve conflicts, or otherwise merge product code.

Coordinator output is evidence for a next action. Product-code repair and merge remain AI owner work. Finalization scripts may create the local completion commit only after the AI owner has already merged and verified the result. Completed ticket worktrees and their `autoflow/tickets_*` branches are deleted by the finalization runtime before the completion commit so the board does not accumulate merged worktrees. Repair, requeue, reset, deleting non-completed worktrees, and push remain separate human-directed actions.

## Writing Standard

All installed board Markdown should be written in concise, AI-friendly English.

Good board text is:

- explicit about paths,
- explicit about ownership,
- explicit about next action,
- observable in verification,
- safe to resume from after chat compaction.
