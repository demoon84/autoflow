# AGENTS.md

This board is an Autoflow sidecar harness installed inside a host project.
The default execution model is **Ticket Owner Mode**: one runner owns one ticket from local planning through implementation, verification, evidence, and done/reject routing.

## Canonical Flow

Default Ticket Owner flow:

```text
PROJECT_ROOT
  -> .autoflow/tickets/backlog/prd_NNN.md
  -> .autoflow/tickets/inprogress/tickets_NNN.md
  -> .autoflow/tickets/inprogress/verify_NNN.md
  -> .autoflow/logs/verifier_NNN_<timestamp>_<outcome>.md
  -> .autoflow/tickets/done/<project-key>/tickets_NNN.md
```

Legacy role-pipeline compatibility flow:

```text
PROJECT_ROOT
  -> .autoflow/tickets/backlog
  -> .autoflow/tickets/plan
  -> .autoflow/tickets/inprogress/plan_NNN.md
  -> .autoflow/tickets/todo
  -> .autoflow/tickets/inprogress/tickets_NNN.md
  -> .autoflow/tickets/verifier
  -> .autoflow/tickets/inprogress/verify_NNN.md
  -> .autoflow/logs
  -> .autoflow/tickets/done/<project-key>/verify_NNN.md
```

Directory meanings:

- `PROJECT_ROOT`: the real product repository root.
- `tickets/inbox/`: quick order queue before Orchestrator AI promotion.
- `tickets/backlog/`: approved spec queue before execution.
- `tickets/plan/`: legacy planning queue.
- `tickets/todo/`: legacy implementation queue.
- `tickets/inprogress/`: active Ticket Owner tickets, active verification records, and legacy claimed plans/tickets.
- `tickets/verifier/`: legacy verification queue.
- `tickets/done/<project-key>/`: passed tickets, archived specs, archived plans, and archived reject records.
- `tickets/reject/`: failed tickets with `## Reject Reason`.
- `reference/`: templates and board reference material.
- `protocols/`: AI-first orchestration, owner, and recovery contracts.
- `rules/`: operating rules and verifier criteria.
- `automations/`: hook, heartbeat, and runtime context contracts.
- `agents/`: role prompts used by human or local runner agents.
- `logs/`: completion logs and hook dispatch logs.
- `wiki/`: generated and human-maintained project knowledge derived from completed work.

## Read Order

At the start of work, read in this order:

1. `README.md`
2. `rules/README.md`
3. `reference/backlog.md`
4. `reference/order.md`
5. `reference/plan.md`
6. `automations/README.md`
7. `reference/tickets-board.md`
8. `rules/verifier/README.md`
9. Role-specific files:
   - PRD handoff: `agents/spec-author-agent.md`
   - default execution: `agents/ticket-owner-agent.md`
   - orchestration / legacy planning: `agents/plan-to-ticket-agent.md`
   - legacy todo implementation: `agents/todo-queue-agent.md`
   - legacy verification: `agents/verifier-agent.md`
   - wiki maintenance: `agents/wiki-maintainer-agent.md` or coordinator-backed wiki turns
   - coordinator diagnostics / merge / wiki-bot maintenance: `agents/coordinator-agent.md`

## Runtime Command Convention

- Use the matching `scripts/*.sh` entrypoint for runtime commands.
- When docs say `start-ticket-owner runtime`, `verify-ticket-owner runtime`, `finish-ticket-owner runtime`, `start-plan runtime`, `start-todo runtime`, `handoff-todo runtime`, `start-verifier runtime`, or `write-verifier-log runtime`, run the `.sh` script.

## Core Rules

1. Do not create plans or tickets without an approved spec or a clear quick order promoted by Orchestrator AI.
2. Claude `/autoflow`, Codex `$autoflow`, and compatibility alias `#autoflow` are PRD handoff triggers only. They never create plans, tickets, implementation changes, verification records, commits, or pushes.
3. Claude `/order`, Codex `$order`, and compatibility alias `#order` are quick intake triggers only (quick intake triggers only. They write `tickets/inbox/order_*.md` and never create PRDs, tickets, implementation changes, verification records, commits, or pushes.
4. The default execution path is Orchestrator AI plus Ticket Owner Mode: `planner` promotes order/backlog/reject inputs into todo work and writes `Recovery State` repair instructions, then `worker` / Desktop Owner / `scripts/start-ticket-owner.*` implements the resulting ticket. Prefer `autoflow run planner` before `autoflow run ticket` for fresh backlog PRDs; legacy planner/todo/verifier splitting remains compatibility-only.
5. A Ticket Owner runner claims or creates one `tickets_NNN.md`, writes its mini-plan inside the ticket, implements within `Allowed Paths`, runs verification, records evidence, and finishes with ready-to-merge or reject.
6. Legacy `#plan`, `#todo`, and `#veri` remain compatibility triggers only.
7. Board stage is authoritative. If a ticket is in `todo/` or `inprogress/`, treat it as implementation work even if the title sounds like review or verification.
8. `Allowed Paths` are repo-relative. In git repositories, ticket worktrees are preferred. If no ticket worktree exists, paths fall back to `PROJECT_ROOT`.
9. Never edit outside `Allowed Paths` unless the user explicitly expands scope.
10. Never run `git push` from automation or agent work. Remote publication is always a human decision.
11. Ticket Owner and verifier may run local verification commands, use built-in browser tools when needed, and move board files without asking again. Coordinator integrates ready worktrees and creates local pass commits inside `PROJECT_ROOT`.
12. If a browser tool is opened during a turn, close it before the turn ends unless the user asks to keep it open.
13. Prefer non-browser checks first. Use the current agent's built-in browser tool only when rendered behavior matters. Do not use Playwright for verifier checks.
14. There must not be two copies of the same `tickets_NNN.md` in different state folders.
15. `tickets/inprogress/tickets_NNN.md` must keep `Owner`, `Stage`, `Claimed By`, `Execution Owner`, `Verifier Owner`, `Last Updated`, `Next Action`, and `Resume Context` current.
16. Resume from board files, not chat memory. Use `Resume Context`, `References`, `Reference Notes`, run files, and logs.
17. `automations/state/*.context` is runtime state for stop hooks and worker identity. Clear active ticket context at tick end, but keep role/worker context when a heartbeat must continue.
18. Verification records start as `tickets/inprogress/verify_NNN.md`, move to `tickets/ready-to-merge/verify_NNN.md` after owner pass, and move beside the final ticket after coordinator/merge completion. Failed records move to `tickets/reject/verify_NNN.md`.
19. Done tickets must link `Verification`, `Result`, the final `verify_NNN.md`, and the completion log. Coordinator/merge completion automatically updates wiki managed sections; do not require a separate wiki runner for normal completion.
20. Ticket filenames use `tickets_001.md`. New IDs are max existing ID + 1.
21. In git repositories, Ticket Owner work happens in the ticket worktree when available. On pass, `scripts/finish-ticket-owner.*` prepares a worktree snapshot and queues `tickets/ready-to-merge/`; coordinator/merge runtime is the single `PROJECT_ROOT` writer and commits code plus board changes locally.
22. If central `PROJECT_ROOT` has unrelated dirty files outside the board, do not mix them into verification commits.
23. Heartbeat workers do not stop themselves. Idle means wait for the next wake-up.
24. At the end of every heartbeat or runner tick, report the current progress percentage. Prefer `autoflow metrics` or board spec/ticket counts, and include the percentage in the tick's final chat or log summary.
25. User-visible AI conversation, progress summaries, and explanations in terminal, adapter, and heartbeat output should be Korean by default. Newly generated PRD, plan, ticket, and user-friendly order prose should also be Korean by default. Keep key=value output, paths, commands, code, ticket fields, parser-sensitive section names, ids, project keys, runtime formats, and AI-facing board contracts in their required language and format.

## Agent Modes

### 1. Spec Authoring Mode

Trigger: Claude `/autoflow`, Codex `$autoflow`, or compatibility alias `#autoflow`.

Purpose: turn the conversation into one approved backlog spec, or a small ordered PRD set when the scope is too large for one safe spec.

Read:

- `agents/spec-author-agent.md`
- host `AGENTS.md` or `CLAUDE.md` when present
- existing backlog, plan, inprogress, and done specs
- `reference/project-spec-template.md`

Do:

- Run `scripts/start-spec.*` to reserve or resume a spec slot.
- Gather goal, scope, modules, allowed paths, acceptance criteria, and verification command through lightweight chat.
- If the request spans multiple independent outcomes, modules, releases, or verification paths, propose a short PRD split map before drafting.
- Use short questions and decision recaps; do not render the PRD template every turn.
- Render the full spec draft only after the user gives an explicit draft trigger such as `초안`, `초안 작성`, `초안 보여줘`, `정리해줘`, `draft`, `draft prd`, or `show draft`.
- For a PRD set, render each PRD draft separately and include sibling references in `Conversation Handoff` or `Notes`.
- Save only after separate explicit user confirmation. A draft trigger is not save approval; multiple drafts need per-PRD approval or a clear save-all confirmation.
- Save only `tickets/backlog/prd_NNN.md` and optional conversation handoff. Multiple PRDs must be separate backlog files, saved one active slot at a time.

Do not:

- Write a spec without confirmation.
- Create plan files.
- Create tickets.
- Implement, verify, commit, or push.

### 2. Quick Order Intake Mode

Trigger: Claude `/order`, Codex `$order`, or compatibility alias `#order`.

Purpose: capture a small request without a full PRD handoff.

Do:

- Preserve the original user request in `tickets/inbox/order_*.md`.
- Add scope, Allowed Paths, and verification hints only when obvious.
- Let Plan AI promote the inbox note into a generated PRD and todo ticket when safe.

Do not:

- Draft a full PRD in chat.
- Create PRDs or tickets directly.
- Implement, verify, commit, or push.

### 3. Ticket Owner Mode

Purpose: one owner completes one ticket end to end.

Read:

- `agents/ticket-owner-agent.md`
- target spec or ticket
- referenced docs, rules, and verifier checklist

Do:

- Resume an owned active ticket first.
- Otherwise claim or create one ticket from backlog/todo/verifier.
- Write a short mini-plan in `Notes`.
- Implement only within `Allowed Paths`.
- Run verification and capture evidence.
- Finish pass or fail through the runtime scripts.

Do not:

- Split work into planner/todo/verifier roles unless the user explicitly requests legacy mode.
- Push.
- Modify unrelated files.

### 4. Legacy Plan Automation Mode

Trigger: `#plan`.

Purpose: convert quick orders, populated specs, and reject reasons into todo tickets.

Do:

- Keep a 1-minute heartbeat alive until the user stops it.
- Use `scripts/start-plan.*`.
- Treat orders as implementation directives and promote them into generated PRDs and todo tickets with the safest narrow interpretation; do not make ambiguous orders into repeated human-question loops.
- Create or update `plan_NNN.md` from specs or rejects.
- Generate todo ticket bodies from `Execution Candidates`.
- Archive consumed specs/plans/rejects under `done/<project-key>/`.

Do not implement, verify, commit, or push.

### 5. Legacy Todo Queue Mode

Trigger: `#todo`.

Purpose: claim a todo ticket and implement it.

Do:

- Keep a 1-minute heartbeat alive until the user stops it.
- Resume owned inprogress work first.
- Use `scripts/start-todo.*` and `scripts/handoff-todo.*`.
- Implement within `Allowed Paths`.
- Move completed implementation to `tickets/verifier/`.

Do not verify, reject, commit, or push.

### 6. Legacy Verification Mode

Trigger: `#veri`.

Purpose: verify tickets in `tickets/verifier/`.

Do:

- Keep a 1-minute heartbeat alive until the user stops it.
- Use `scripts/start-verifier.*`.
- Run verification from `working_root`.
- Pass: integrate worktree, move to done, write completion log, create local commit. Commit message format is `[PRD_NNN][ticket_NNN] 작업내용 요약본`; use the ticket `PRD Key` / project key for the uppercase `PRD_` bracket, the ticket ID for the lower-case `ticket_` bracket, and fall back to `[ticket_NNN]` only for legacy tickets without a PRD key.
- Fail: append `## Reject Reason`, move to reject, write completion log.

Do not fix code, create tickets, or push.

### 7. Coordinator Mode

Purpose: explain board/runtime health, blocked work, process one ready-to-merge ticket when present, and maintain derived wiki knowledge.

Do:

- Outside a coordinator adapter turn, run or resume `autoflow runners start coordinator-1` to keep the long-lived coordinator alive.
- Inside a coordinator adapter turn, do not start, restart, or run the coordinator recursively. Execute the provided runtime script directly once.
- Inspect shared Allowed Path blockers, dirty root overlap, worktree health, runner state, and scaffold checks.
- If `tickets/ready-to-merge/` has a ticket, use the merge runtime for exactly one ready ticket.
- After merge or during explicit wiki turns, update derived wiki pages from authoritative done tickets, verification records, logs, and conversation handoffs.
- Recommend the smallest safe next action.

Do not implement, requeue, reset, hand-edit merge results, or push.

## Required Ticket Fields

Every ticket must keep these sections or fields current:

- `ID`
- `Project Key`
- `Title`
- `Stage`
- `Owner`
- `Claimed By`
- `Execution Owner`
- `Verifier Owner`
- `Goal`
- `References`
- `Reference Notes`
- `Allowed Paths`
- `Worktree`
- `Done When`
- `Last Updated`
- `Next Action`
- `Resume Context`
- `Verification`
- `Result`

## Duplicate Prevention

Before creating a ticket, check:

- `tickets/todo/`
- `tickets/inprogress/`
- `tickets/verifier/`
- `tickets/done/`
- `tickets/reject/`

Do not create a duplicate for the same goal or same plan source. A reject retry gets a new ticket ID and archives the old reject as history.

## Completion Standard

A ticket may move to done only when:

1. Every `Done When` item is satisfied.
2. Verification was run under `rules/verifier/` criteria.
3. The final `verify_NNN.md` is beside the final ticket.
4. A completion log exists under `logs/`.
5. The ticket links the verification record and log.
6. `Result` is filled.

## File Writing Style

Use this language split:

- Newly generated PRD, plan, ticket, and user-friendly order prose should be Korean by default.
- Human-facing documents (product README content, desktop UI copy, user guides, release notes for the user) should be Korean by default unless the user requests another language.
- User-visible terminal or chat prose from runners should be Korean by default while preserving machine-readable formats.
- AI-facing Markdown files (`agents/`, `rules/`, `reference/`, runtime contracts, and board operating docs) should keep concise, parser-compatible structure. Human-readable placeholder and guidance prose may be Korean when it shapes generated PRD/plan/ticket/order output.
- Mixed-audience documents should preserve machine-readable English contracts and use Korean for human-facing explanation where appropriate.
- Prefer observable statements over vague quality words.
- Use checklists only when each item can be judged.
- Keep durable context in board files, not chat.
- Preserve parser-sensitive headings, field names, ids, project keys, paths, commands, code, key=value output, and runtime formats exactly.

## Conflict Priority

1. Direct user request.
2. This `AGENTS.md`.
3. Folder README files and templates.
