# Autoflow Board

This directory is a local AI work harness installed inside a host project.
It lets Codex, Claude Code, OpenCode, Gemini CLI, and shell runners share one file-based source of truth.

The chat window can start work, but the board owns work state.

## Default Flow

Use Ticket Owner Mode by default:

1. User starts PRD handoff with Claude `/autoflow`, Codex `$autoflow`, or compatibility alias `#autoflow`. For small changes, the user may instead drop a quick order with Claude `/order`, Codex `$order`, `#order`, or `autoflow memo create`.
2. The agent gathers requirements in lightweight chat with short questions and decision recaps.
3. If the scope is too large for one safe handoff, the agent proposes a short PRD split map before drafting.
4. The agent renders a full PRD draft, or multiple PRD drafts from an accepted split map, only after an explicit draft trigger such as `초안`, `초안 작성`, `초안 보여줘`, `정리해줘`, `draft`, `draft prd`, or `show draft`.
5. The user explicitly approves saving after the draft is shown. A draft trigger is not save approval; multiple drafts need per-PRD approval or a clear save-all confirmation.
6. The approved spec is saved as `tickets/backlog/prd_NNN.md`. Split PRDs are saved as separate backlog files, one active slot at a time.
7. The planner runner acts as Orchestrator AI: it promotes memo/backlog/reject work and repairs ticket markdown when owner work stalls or breaks.
8. A Ticket Owner runner creates or claims one ticket in `tickets/inprogress/`.
9. The same owner writes a mini-plan, implements, runs and judges verification, manually merges verified work into `PROJECT_ROOT`, records evidence, and finishes pass or fail.
10. Passed owner work is finalized only after the AI-merged result is already present in `PROJECT_ROOT`.
11. The finalization runtime validates the AI-merged result, writes the completion log, refreshes derived wiki knowledge, and moves it to `tickets/done/<project-key>/` with a local commit.
12. Failed work moves to `tickets/reject/` with `## Reject Reason`; recoverable blocked/stalled work is described in `Recovery State` for planner orchestration.

Legacy role-pipeline mode (`#plan`, `#todo`, `#veri`) remains available for compatibility, but it is not the default.

## Important Directories

- `tickets/inbox/`: quick memos waiting for Orchestrator AI promotion into generated PRDs and todo tickets.
- `tickets/backlog/`: approved or generated specs waiting for execution.
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
- `protocols/`: AI-first orchestration, owner, and recovery contracts.
- `rules/`: verification and wiki maintenance rules.
- `runners/`: local runner configuration, state, and logs.
- `conversations/`: approved handoff summaries.
- `metrics/`: progress snapshots.
- `wiki/`: derived project knowledge.
- `logs/`: completion logs and hook dispatch logs.

## Trigger Summary

- Claude `/autoflow`: PRD handoff only.
- Codex `$autoflow`: PRD handoff only.
- `#autoflow`: compatibility alias for PRD handoff only.
- Claude `/order`, Codex `$order`, `#order`, or `autoflow memo create`: quick order intake only.
- `autoflow runners start planner`: Orchestrator AI loop runner — backlog/reject → todo plus markdown recovery for stalled/blocked work.
- `autoflow run ticket` / `autoflow runners start worker`: Impl AI — todo claim → mini-plan → implementation → AI-led verification → AI-led merge → done/reject. Default Ticket Owner execution.
- `autoflow runners start wiki`: Wiki AI loop runner — refreshes the deterministic wiki baseline only when source changes require it, then layers AI synthesis.
- `autoflow guard`: safety-kernel validation for board invariants and leftover ticket worktrees after AI-authored markdown recovery.
- Desktop Owner runner: default Impl AI execution from the UI.
- `autoflow runners start coordinator-1`: legacy looped coordinator (DEPRECATED, not scaffolded by default — opt in via `autoflow runners add coordinator-1 coordinator`).
- `#plan`: legacy planner heartbeat (Plan AI runner replaces this).
- `#todo`: legacy todo heartbeat (Impl AI claims todo directly).
- `#veri`: legacy verifier heartbeat (Impl AI runs AI-led verification inline).

## Spec Handoff Rules

Spec handoff never starts implementation.

The agent must:

1. Read `agents/spec-author-agent.md`.
2. Reserve or resume a spec slot with `scripts/start-spec.*` when available.
3. Gather missing goal, scope, allowed paths, acceptance criteria, and verification details through short questions and decision recaps.
4. If the scope is large, propose a lightweight PRD split map with boundaries, dependency order, and verification focus.
5. Do not show the complete PRD draft until the user gives an explicit draft trigger (`초안`, `초안 작성`, `초안 보여줘`, `정리해줘`, `draft`, `draft prd`, `show draft`, or equivalent).
6. After a draft trigger, show the complete spec in chat and mark unknowns as `TBD` / `미정`. For split work, show each PRD draft separately.
7. Save only after separate explicit user approval. The draft trigger is not save approval.
8. Save only to `tickets/backlog/` and optional `conversations/` archive. Split PRDs must be separate backlog files with sibling references in `Conversation Handoff` or `Notes`.

## Memo Intake Rules

Quick memo intake never starts implementation.

The agent must:

1. Preserve the user's original request in `tickets/inbox/memo_NNN.md`.
2. Add scope, allowed path, and verification hints only when obvious.
3. Avoid drafting a full PRD in chat.
4. Let Orchestrator AI promote the memo into a generated PRD and todo ticket when safe.
5. Treat memo requests as directives and infer the safest narrow implementation scope; only unsafe memos should be blocked.

## Ticket Owner Rules

Ticket Owner work should be narrow and durable:

- One owner handles one ticket at a time.
- Work inside the ticket worktree when available.
- Edit only `Allowed Paths`.
- Update `Notes`, `Resume Context`, `Verification`, and `Result` as durable state.
- Follow `Recovery State` planner instructions when present, and update it when blocked or recovered.
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

## Coordinator Rules (DEPRECATED)

Coordinator is no longer a default runner in the 3-runner topology. Its responsibilities have been split: Impl AI (`worker`) runs AI-led verification and merge inline via `verify-ticket-owner.*` + `finish-ticket-owner.*` (which calls `merge-ready-ticket.*` as a non-merging finalizer); Wiki AI (`wiki`) owns material wiki baseline refresh plus AI synthesis. The role identifier `coordinator` is kept for backwards compatibility with users who opted into a coordinator runner before the topology refactor; new boards should not add one.

If you do run a legacy coordinator, the historical contract still applies: it diagnoses board health (shared Allowed Path blockers, active-ticket worktree health, dirty `PROJECT_ROOT` overlap, shared non-base HEAD groups, runner readiness, board scaffold issues) and may produce evidence for a next action. It must not implement, verify, rebase, cherry-pick, resolve conflicts, or otherwise merge product code; product-code repair and merge are Impl AI's responsibility. Finalization scripts may create the local completion commit only after the AI owner has already merged and verified the result. Completed ticket worktrees and their `autoflow/tickets_*` branches are deleted by the finalization runtime before the completion commit so the board does not accumulate merged worktrees. Repair, requeue, reset, deleting non-completed worktrees, and push remain separate human-directed actions.

## Writing Standard

All installed board Markdown should be written in concise, AI-friendly English.

Good board text is:

- explicit about paths,
- explicit about ownership,
- explicit about next action,
- observable in verification,
- safe to resume from after chat compaction.
