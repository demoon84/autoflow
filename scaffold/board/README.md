# Autoflow Board

This directory is a local AI work harness installed inside a host project.
It lets Codex, Claude Code, OpenCode, Gemini CLI, and shell runners share one file-based source of truth.

The chat window can start work, but the board owns work state.

## Default Flow

Use Ticket Owner Mode by default:

1. User starts PRD handoff with Claude `/af` / `/autoflow`, Codex `$af` / `$autoflow`, or compatibility aliases `#af` / `#autoflow`.
2. The agent drafts a full PRD in chat.
3. The user explicitly approves saving.
4. The approved PRD is saved as `tickets/backlog/prd_NNN.md`.
5. A Ticket Owner runner creates or claims one ticket in `tickets/inprogress/`.
6. The same owner writes a mini-plan, implements, verifies, records evidence, and finishes pass or fail.
7. Passed work moves to `tickets/done/<project-key>/` with a local commit.
8. Failed work moves to `tickets/reject/` with `## Reject Reason`.

Legacy role-pipeline mode (`#plan`, `#todo`, `#veri`) remains available for compatibility, but it is not the default.

## Important Directories

- `tickets/backlog/`: approved PRDs waiting for execution.
- `tickets/inprogress/`: active Ticket Owner tickets and verification records.
- `tickets/todo/`: legacy implementation queue.
- `tickets/verifier/`: legacy verification queue.
- `tickets/done/<project-key>/`: passed tickets, archived PRDs, archived plans, and verification records.
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

- Claude `/af` / `/autoflow`: PRD handoff only.
- Codex `$af` / `$autoflow`: PRD handoff only.
- `#af` / `#autoflow`: compatibility aliases for PRD handoff only.
- `autoflow run ticket`: default Ticket Owner execution.
- Desktop Owner runner: default Ticket Owner execution from the UI.
- `#plan`: legacy planner heartbeat.
- `#todo`: legacy todo heartbeat.
- `#veri`: legacy verifier heartbeat.

## PRD Handoff Rules

PRD handoff never starts implementation.

The agent must:

1. Read `agents/spec-author-agent.md`.
2. Reserve or resume a PRD slot with `scripts/start-spec.*` when available.
3. Ask for missing goal, scope, allowed paths, acceptance criteria, and verification details.
4. Show the complete PRD in chat.
5. Save only after explicit user approval.
6. Save only to `tickets/backlog/` and optional `conversations/` archive.

## Ticket Owner Rules

Ticket Owner work should be narrow and durable:

- One owner handles one ticket at a time.
- Work inside the ticket worktree when available.
- Edit only `Allowed Paths`.
- Update `Notes`, `Resume Context`, `Verification`, and `Result` as durable state.
- Use runtime scripts for claim, verification, finish, and context cleanup.
- Do not push.

Wiki maintainer follow-up is optional and non-blocking:

- A pass finish may trigger one enabled `wiki-maintainer` runner in one-shot mode.
- `AUTOFLOW_WIKI_MAINTAINER_AUTO=off` disables the trigger.
- `autoflow wiki query --synth` and `autoflow wiki lint --semantic` reuse the same adapter path when configured, otherwise they report skipped status without failing the base command.

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

## Writing Standard

All installed board Markdown should be written in concise, AI-friendly English.

Good board text is:

- explicit about paths,
- explicit about ownership,
- explicit about next action,
- observable in verification,
- safe to resume from after chat compaction.
