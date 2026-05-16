# Autoflow Board

This directory is a local AI work harness installed inside a host project.
It lets Codex, Claude Code, Gemini CLI, and local runners share one file-based source of truth.

The chat window can start work, but the board owns work state.

## Default Flow

Use Worker Mode by default:

1. User starts PRD handoff with Claude `/autoflow`, Codex `$autoflow`, or compatibility alias `#autoflow`. For small changes, the user may instead drop a quick order with Claude `/order`, Codex `$order`, `#order`, or `autoflow order create`.
2. The agent gathers requirements in lightweight chat with short questions and decision recaps.
3. If the scope is too large for one safe handoff, the agent proposes a short PRD split map before drafting.
4. The agent renders a full PRD draft, or multiple PRD drafts from an accepted split map, only after an explicit draft trigger such as `초안`, `초안 작성`, `초안 보여줘`, `정리해줘`, `draft`, `draft prd`, or `show draft`.
5. The user explicitly approves saving after the draft is shown. A draft trigger is not save approval; multiple drafts need per-PRD approval or a clear save-all confirmation.
6. The approved spec is saved as `tickets/prd/prd_NNN.md`. Split PRDs are saved as separate PRD files, one active slot at a time.
7. The planner runner promotes order/retry/PRD work and repairs ticket markdown when worker work stalls or breaks.
8. The worker runner creates or claims one ticket in `tickets/inprogress/`.
9. The same worker writes a mini-plan, implements, runs and judges local verification, and calls `autoflow tool runner-tool worker submit-to-verifier` to hand off to verifier before any `PROJECT_ROOT` merge.
10. The verifier runner checks semantic alignment and chooses pass, revise, or replan.
11. On pass, verifier records a marker and wakes the worker for merge/finalization. Only then does the worker merge the approved worktree into `PROJECT_ROOT`, rerun verification, and call `autoflow tool runner-tool worker finalize-approved`.
12. On revise, verifier wakes the worker to keep the same worktree, correct the issue, and submit to verifier again.
13. On replan, verifier wakes the worker to create an order retry, delete the worktree, and wait for the planner runner's follow-up TODO.
14. The finalization runtime validates the verifier marker and merged result via the mechanical sanity gate, writes the completion log, and moves it to `tickets/done/<project-key>/` with a local commit.
15. The wiki runner refreshes derived knowledge later when source change weight crosses the debounce threshold.
16. Replanned work embeds the entire ticket body inside `tickets/order/order_<id>_retry_<N>_<ts>.md` (under `## Original Ticket`) and removes the inprogress ticket. The planner re-plans it like any other order. Same fingerprint reaching `retry_max` flips `retry_decision=needs_user` so the order parks in order until the user redirects. `done/<key>/` only contains successful tickets.

Legacy role-pipeline mode (`#plan`, `#todo`) remains available for compatibility, but it is not the default.

## Important Directories

- `tickets/order/`: quick orders + verifier replan retry orders waiting for planner runner promotion. Replanned tickets are embedded inside `order_<id>_retry_<N>_<ts>.md` here.
- `tickets/prd/`: approved or generated PRDs waiting for execution.
- `tickets/todo/`: tickets the Planner has issued and the Worker is about to claim.
- `tickets/inprogress/`: active Worker tickets (only one alive worktree at a time).
- `tickets/done/<project-key>/`: successful tickets, archived PRDs, and legacy history. Successful only — replan flow writes retry orders under `tickets/order/`.
- `agents/`: runner and compatibility role instructions.
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
tools must not choose scope, draft `Done When`, decide pass/revise/replan, resolve merge
strategy, decide wiki meaning, or drive the whole workflow.

Current split tools live behind `autoflow tool runner-tool`; run
`autoflow tool list` for the installed tool catalog and contract summary.
Large script-driven flows are coarse runtime helpers only. In particular,
`autoflow run ticket` is startup context: it may report active/todo state, but
must not choose or claim tickets, create worktrees, or hand `PROJECT_ROOT` to a
worker as an implementation fallback.

## Trigger Summary

- Claude `/autoflow`: PRD handoff only.
- Codex `$autoflow`: PRD handoff only.
- `#autoflow`: compatibility alias for PRD handoff only.
- Claude `/order`, Codex `$order`, `#order`, or `autoflow order create`: quick order intake only.
- `autoflow runners start planner`: planner runner — order/retry/prd → todo plus markdown recovery for stalled/blocked work.
- `autoflow run ticket` / `autoflow runners start worker`: worker runner — todo claim → mini-plan → implementation → local verification → verifier pass/revise/replan handling → runner-led merge → done/order-retry. Default Worker execution.
- `autoflow runners start wiki`: wiki runner — refreshes the deterministic wiki baseline only when source changes require it, then layers AI synthesis.
- `autoflow guard`: safety-kernel validation for board invariants and leftover ticket worktrees after AI-authored markdown recovery.
- Desktop worker runner: default worker execution from the UI.
- `#plan`: legacy planner heartbeat (planner runner replaces this).
- `#todo`: legacy todo heartbeat (worker runner claims todo directly).

## Spec Handoff Rules

Spec handoff never starts implementation.

The agent must:

1. Read `agents/spec-author-agent.md`.
2. Reserve or resume a spec slot with `autoflow spec create` when available.
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
4. Let the planner runner promote the order into a generated PRD and todo ticket when safe.
5. Treat order requests as directives and infer the safest narrow implementation scope; only unsafe orders should be blocked.

## Worker Rules

Worker work should be narrow and durable:

- One worker handles one ticket at a time.
- Work inside the ticket worktree when available.
- Edit only `Allowed Paths`.
- Update `Notes`, `Resume Context`, `Verification`, and `Result` as durable state.
- Follow `Recovery State` planner instructions when present, and update it when blocked or recovered.
- Prefer `autoflow tool runner-tool worker ...` for claim, worktree setup, status snapshots, evidence recording, and mechanical checks. Use legacy runtime scripts only where the small tool has not yet replaced the macro.
- On worktree pass, the AI worker hands off to verifier first. If verifier says revise, keep the same worktree and resubmit. If verifier says replan, create the retry order and delete the worktree. Only after verifier pass does the worker merge approved changes into `PROJECT_ROOT`, resolve conflicts, rerun needed verification, and then use finish/finalization scripts as bookkeeping tools.
- Do not push.

## Verification Rules

Verification must be evidence-based:

- Run the specified command from the ticket working root.
- Check acceptance criteria, not only command exit code.
- Record stdout/stderr summaries when useful.
- Use browser tools only when rendered behavior must be observed.
- Pass, revise, and replan decisions all require durable verification evidence and a verifier log.

## Wiki Rules

The wiki is a derived knowledge map. It is not the source of truth for stage, claim, verifier decision, or commit state.

Use the wiki to summarize:

- completed work,
- decisions,
- known patterns,
- repeated failures,
- architecture notes.

## Legacy Coordinator Evidence

Coordinator is not a runner in the 4-runner topology. Its old responsibilities have been split: worker (`worker`) owns implementation and local verification evidence, verifier (`verifier`) owns semantic diff review, and wiki (`wiki`) owns material wiki baseline refresh plus AI synthesis. New boards must not add or start a coordinator runner.

If you inspect legacy coordinator state, treat it as compatibility evidence only. It may explain board health (shared Allowed Path blockers, active-ticket worktree health, dirty `PROJECT_ROOT` overlap, shared non-base HEAD groups, runner readiness, board scaffold issues), but it must route any next action to planner, worker, verifier, or wiki. It must not implement, verify, rebase, cherry-pick, resolve conflicts, or otherwise merge product code; product-code repair and merge are the worker runner's responsibility. Finalization helpers may create the local completion commit only after the worker has already merged and verified the result. Completed ticket worktrees and their `autoflow/tickets_*` branches are deleted by the finalization runtime before the completion commit so the board does not accumulate merged worktrees. Repair, requeue, reset, deleting non-completed worktrees, and push remain separate human-directed actions.

## Writing Standard

All installed board Markdown should be written in concise, AI-friendly English.

Good board text is:

- explicit about paths,
- explicit about claim,
- explicit about next action,
- observable in verification,
- safe to resume from after chat compaction.
