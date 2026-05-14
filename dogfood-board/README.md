# Autoflow Board

This directory is a local AI work harness installed inside a host project.
It lets Codex, Claude Code, OpenCode, Gemini CLI, and local runners share one file-based source of truth.

The chat window can start work, but the board owns work state.

## Default Flow

Use Worker Mode by default:

1. User starts PRD handoff with Claude `/autoflow`, Codex `$autoflow`, or compatibility alias `#autoflow`. For small changes, the user may instead drop a quick order with Claude `/order`, Codex `$order`, `#order`, or `autoflow order create`.
2. The agent gathers requirements in lightweight chat with short questions and decision recaps.
3. If the scope is too large for one safe handoff, the agent proposes a short PRD split map before drafting.
4. The agent renders a full PRD draft, or multiple PRD drafts from an accepted split map, only after an explicit draft trigger such as `초안`, `초안 작성`, `초안 보여줘`, `정리해줘`, `draft`, `draft prd`, or `show draft`.
5. The user explicitly approves saving after the draft is shown. A draft trigger is not save approval; multiple drafts need per-PRD approval or a clear save-all confirmation.
6. The approved spec is saved as `tickets/prd/prd_NNN.md`. Split PRDs are saved as separate PRD files, one active slot at a time.
7. The planner runner acts as Planner AI: it promotes order/retry/PRD work and repairs ticket markdown when worker work stalls or breaks.
8. A Worker runner creates or claims one ticket in `tickets/inprogress/`.
9. The same worker writes a mini-plan, implements, runs and judges local verification, and calls `finish-ticket.ts pass` to hand off to verifier before any `PROJECT_ROOT` merge.
10. Verifier AI checks semantic alignment. On pass it records a marker and wakes the worker; on fail it routes the ticket to order retry.
11. Only after verifier pass does the worker merge the approved worktree into `PROJECT_ROOT`, rerun verification, and call `finish-ticket.ts pass` again.
12. The finalization runtime validates the verifier marker and merged result via the mechanical sanity gate, writes the completion log, and moves it to `tickets/done/<project-key>/` with a local commit.
13. Wiki AI refreshes derived knowledge later when source change weight crosses the debounce threshold.
14. Failed work embeds the entire ticket body inside `tickets/order/order_<id>_retry_<N>_<ts>.md` (under `## Original Ticket`) and removes the inprogress ticket. The planner re-plans it like any other order. Same fingerprint reaching `retry_max` flips `retry_decision=needs_user` so the order parks in order until the user redirects. `done/<key>/` only contains successful tickets.

Legacy role-pipeline mode (`#plan`, `#todo`) remains available for compatibility, but it is not the default.

## Important Directories

- `tickets/order/`: quick orders + worker fail retry orders waiting for Planner AI promotion. Failed tickets are embedded inside `order_<id>_retry_<N>_<ts>.md` here.
- `tickets/prd/`: approved or generated PRDs waiting for execution.
- `tickets/todo/`: tickets the Planner has issued and the Worker is about to claim.
- `tickets/inprogress/`: active Worker tickets (only one alive worktree at a time).
- `tickets/done/<project-key>/`: successful tickets, archived PRDs, and legacy `verify_*.md` / `reject_*.md` history. Successful only — fail flow no longer writes here.
- `agents/`: AI role instructions.
- `automations/`: heartbeat, hook, and context contracts.
- `reference/`: templates and board documentation.
- `protocols/`: AI-first orchestration, worker, and recovery contracts.
- `rules/`: verification and wiki maintenance rules.
- `runners/`: local runner configuration, state, and logs.
- `conversations/`: approved handoff summaries.
- `metrics/`: progress snapshots.
- `wiki/`: derived project knowledge.
- `logs/`: completion logs and hook dispatch logs.

## Runners And Runner Tools

Autoflow uses four default **runners**:

- `planner`: turns orders, retry orders, and PRD queue items into worker-ready todo tickets.
- `worker`: claims one todo ticket, implements it, verifies locally, and prepares the AI-led merge.
- `verifier`: checks the finished diff against the ticket title, goal, and Done When items.
- `wiki`: turns completed work and decisions into derived wiki knowledge.

The canonical responsibility boundary is `reference/runner-tool-contract.md`.
Short version: a runner is the LLM-backed decision-maker; a runner tool is a
small deterministic command the runner calls for one explicit action. Runner
tools must not choose scope, draft `Done When`, decide pass/fail, resolve merge
strategy, decide wiki meaning, or drive the whole workflow.

Current split tools live behind `scripts/runner-tool.ts`; run
`autoflow tool list` for the installed tool catalog and contract summary.
Large script-driven flows such as `start-plan.ts` and `start-ticket.ts`
remain compatibility wrappers while their behavior is split into smaller
TypeScript runner tools.

## Trigger Summary

- Claude `/autoflow`: PRD handoff only.
- Codex `$autoflow`: PRD handoff only.
- `#autoflow`: compatibility alias for PRD handoff only.
- Claude `/order`, Codex `$order`, `#order`, or `autoflow order create`: quick order intake only.
- `autoflow runners start planner`: Planner AI loop runner — order/retry/prd → todo plus markdown recovery for stalled/blocked work.
- `autoflow run ticket` / `autoflow runners start worker`: Impl AI — todo claim → mini-plan → implementation → AI-led verification → AI-led merge → done/order-retry. Default Worker execution.
- `autoflow runners start wiki`: Wiki AI loop runner — refreshes the deterministic wiki baseline only when source changes require it, then layers AI synthesis.
- `autoflow guard`: safety-kernel validation for board invariants and leftover ticket worktrees after AI-authored markdown recovery.
- Desktop Worker runner: default Impl AI execution from the UI.
- `autoflow runners start coordinator-1`: legacy looped coordinator (DEPRECATED, not part of default 4-runner topology).
- `#plan`: legacy planner heartbeat (Plan AI runner replaces this).
- `#todo`: legacy todo heartbeat (Impl AI claims todo directly).

## Spec Handoff Rules

Spec handoff never starts implementation.

The agent must:

1. Read `agents/spec-author-agent.md`.
2. Reserve or resume a spec slot with `scripts/start-spec.ts` when available.
3. Gather missing goal, scope, allowed paths, acceptance criteria, and verification details through short questions and decision recaps.
4. If the scope is large, propose a lightweight PRD split map with boundaries, dependency order, and verification focus.
5. Do not show the complete PRD draft until the user gives an explicit draft trigger (`초안`, `초안 작성`, `초안 보여줘`, `정리해줘`, `draft`, `draft prd`, `show draft`, or equivalent).
6. After a draft trigger, show the complete spec in chat and mark unknowns as `TBD` / `미정`. For split work, show each PRD draft separately.
7. Save only after separate explicit user approval. The draft trigger is not save approval.
8. Save only to `tickets/prd/` and optional `conversations/` archive. Split PRDs must be separate PRD files with sibling references in `Conversation Handoff` or `Notes`.

## Order Intake Rules

Quick order intake never starts implementation.

The agent must:

1. Preserve the user's original request in `tickets/order/order_NNN.md`.
2. Add scope, allowed path, and verification hints only when obvious.
3. Avoid drafting a full PRD in chat.
4. Let Planner AI promote the order into a generated PRD and todo ticket when safe.
5. Treat order requests as directives and infer the safest narrow implementation scope; only unsafe orders should be blocked.

## Worker Rules

Worker work should be narrow and durable:

- One worker handles one ticket at a time.
- Work inside the ticket worktree when available.
- Edit only `Allowed Paths`.
- Update `Notes`, `Resume Context`, `Verification`, and `Result` as durable state.
- Follow `Recovery State` planner instructions when present, and update it when blocked or recovered.
- Prefer `scripts/runner-tool.ts worker ...` for claim, worktree setup, status snapshots, evidence recording, and mechanical checks. Use legacy runtime scripts only where the small tool has not yet replaced the macro.
- On worktree pass, the AI worker hands off to verifier first. Only after verifier pass does it merge approved changes into `PROJECT_ROOT`, resolve conflicts, rerun needed verification, and then use finish/finalization scripts as bookkeeping tools.
- Do not push.

## Verification Rules

Verification must be evidence-based:

- Run the specified command from the ticket working root.
- Check acceptance criteria, not only command exit code.
- Record stdout/stderr summaries when useful.
- Use browser tools only when rendered behavior must be observed.
- Pass and fail both require a verification record and completion log.

## Wiki Rules

The wiki is a derived knowledge map. It is not the source of truth for stage, claim, pass/fail, or commit state.

Use the wiki to summarize:

- completed work,
- decisions,
- known patterns,
- repeated failures,
- architecture notes.

## Coordinator Rules (DEPRECATED)

Coordinator is no longer a default runner in the 4-runner topology. Its responsibilities have been split: Impl AI (`worker`) owns implementation and local verification evidence, Verifier AI (`verifier`) owns semantic diff review, and Wiki AI (`wiki`) owns material wiki baseline refresh plus AI synthesis. The role identifier `coordinator` is kept for backwards compatibility with users who opted into a coordinator runner before the topology refactor; new boards should not add one.

If you do run a legacy coordinator, the historical contract still applies: it diagnoses board health (shared Allowed Path blockers, active-ticket worktree health, dirty `PROJECT_ROOT` overlap, shared non-base HEAD groups, runner readiness, board scaffold issues) and may produce evidence for a next action. It must not implement, verify, rebase, cherry-pick, resolve conflicts, or otherwise merge product code; product-code repair and merge are Impl AI's responsibility. Finalization scripts may create the local completion commit only after the AI worker has already merged and verified the result. Completed ticket worktrees and their `autoflow/tickets_*` branches are deleted by the finalization runtime before the completion commit so the board does not accumulate merged worktrees. Repair, requeue, reset, deleting non-completed worktrees, and push remain separate human-directed actions.

## Writing Standard

All installed board Markdown should be written in concise, AI-friendly English.

Good board text is:

- explicit about paths,
- explicit about claim,
- explicit about next action,
- observable in verification,
- safe to resume from after chat compaction.
