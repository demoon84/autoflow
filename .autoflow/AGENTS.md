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
- `tickets/backlog/`: approved spec queue before execution.
- `tickets/plan/`: legacy planning queue.
- `tickets/todo/`: legacy implementation queue.
- `tickets/inprogress/`: active Ticket Owner tickets, active verification records, and legacy claimed plans/tickets.
- `tickets/verifier/`: legacy verification queue.
- `tickets/done/<project-key>/`: passed tickets, archived specs, archived plans, and archived reject records.
- `tickets/reject/`: failed tickets with `## Reject Reason`.
- `reference/`: templates and board reference material.
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
4. `reference/plan.md`
5. `automations/README.md`
6. `reference/tickets-board.md`
7. `rules/verifier/README.md`
8. Role-specific files:
   - PRD handoff: `agents/spec-author-agent.md`
   - default execution: `agents/ticket-owner-agent.md`
   - legacy planning: `agents/plan-to-ticket-agent.md`
   - legacy todo implementation: `agents/todo-queue-agent.md`
   - legacy verification: `agents/verifier-agent.md`
   - wiki maintenance: `agents/wiki-maintainer-agent.md` or coordinator-backed wiki turns
   - coordinator diagnostics / merge / wiki-bot maintenance: `agents/coordinator-agent.md`

## Runtime Command Convention

- On Windows, prefer `scripts/*.ps1` wrappers.
- In Bash-only environments, use the matching `scripts/*.sh` entrypoint.
- When docs say `start-ticket-owner runtime`, `verify-ticket-owner runtime`, `finish-ticket-owner runtime`, `start-plan runtime`, `start-todo runtime`, `handoff-todo runtime`, `start-verifier runtime`, or `write-verifier-log runtime`, choose `.ps1` or `.sh` for the current environment.

## Core Rules

1. Do not create plans or tickets without an approved spec.
2. Claude `/af` / `/autoflow`, Codex `$af` / `$autoflow`, and compatibility aliases `#af` / `#autoflow` are PRD handoff triggers only. They never create plans, tickets, implementation changes, verification records, commits, or pushes.
3. The default executor is Ticket Owner Mode. Prefer `autoflow run ticket`, Desktop Owner runner, or `scripts/start-ticket-owner.*` over splitting planner/todo/verifier roles.
4. A Ticket Owner runner claims or creates one `tickets_NNN.md`, writes its mini-plan inside the ticket, implements within `Allowed Paths`, runs verification, records evidence, and finishes with ready-to-merge or reject.
5. Legacy `#plan`, `#todo`, and `#veri` remain compatibility triggers only.
6. Board stage is authoritative. If a ticket is in `todo/` or `inprogress/`, treat it as implementation work even if the title sounds like review or verification.
7. `Allowed Paths` are repo-relative. In git repositories, ticket worktrees are preferred. If no ticket worktree exists, paths fall back to `PROJECT_ROOT`.
8. Never edit outside `Allowed Paths` unless the user explicitly expands scope.
9. Never run `git push` from automation or agent work. Remote publication is always a human decision.
10. Ticket Owner and verifier may run local verification commands, use built-in browser tools when needed, and move board files without asking again. Coordinator integrates ready worktrees and creates local pass commits inside `PROJECT_ROOT`.
11. If a browser tool is opened during a turn, close it before the turn ends unless the user asks to keep it open.
12. Prefer non-browser checks first. Use the current agent's built-in browser tool only when rendered behavior matters. Do not use Playwright for verifier checks.
13. There must not be two copies of the same `tickets_NNN.md` in different state folders.
14. `tickets/inprogress/tickets_NNN.md` must keep `Owner`, `Stage`, `Claimed By`, `Execution Owner`, `Verifier Owner`, `Last Updated`, `Next Action`, and `Resume Context` current.
15. Resume from board files, not chat memory. Use `Resume Context`, `References`, `Obsidian Links`, run files, and logs.
16. `automations/state/*.context` is runtime state for stop hooks and worker identity. Clear active ticket context at tick end, but keep role/worker context when a heartbeat must continue.
17. Verification records start as `tickets/inprogress/verify_NNN.md`, move to `tickets/ready-to-merge/verify_NNN.md` after owner pass, and move beside the final ticket after coordinator/merge completion. Failed records move to `tickets/reject/verify_NNN.md`.
18. Done tickets must link `Verification`, `Result`, the final `verify_NNN.md`, and the completion log. Coordinator/merge completion automatically updates wiki managed sections; do not require a separate wiki runner for normal completion.
19. Ticket filenames use `tickets_001.md`. New IDs are max existing ID + 1.
20. In git repositories, Ticket Owner work happens in the ticket worktree when available. On pass, `scripts/finish-ticket-owner.*` prepares a worktree snapshot and queues `tickets/ready-to-merge/`; coordinator/merge runtime is the single `PROJECT_ROOT` writer and commits code plus board changes locally.
21. If central `PROJECT_ROOT` has unrelated dirty files outside the board, do not mix them into verification commits.
22. Heartbeat workers do not stop themselves. Idle means wait for the next wake-up.
23. At the end of every heartbeat or runner tick, report the current progress percentage. Prefer `autoflow metrics` or board spec/ticket counts, and include the percentage in the tick's final chat or log summary.
24. User-visible AI conversation, progress summaries, and explanations in terminal, adapter, and heartbeat output should be Korean by default. Keep key=value output, paths, commands, code, ticket fields, parser-sensitive formats, and AI-facing board contracts in their required language and format.

## Agent Modes

### 1. Spec Authoring Mode

Trigger: Claude `/af` / `/autoflow`, Codex `$af` / `$autoflow`, or compatibility aliases `#af` / `#autoflow`.

Purpose: turn the conversation into one approved backlog spec.

Read:

- `agents/spec-author-agent.md`
- host `AGENTS.md` or `CLAUDE.md` when present
- existing backlog, plan, inprogress, and done specs
- `reference/project-spec-template.md`

Do:

- Run `scripts/start-spec.*` to reserve or resume a spec slot.
- Ask for goal, scope, modules, allowed paths, acceptance criteria, and verification command.
- Show the full spec draft in chat before writing.
- Save only after explicit user confirmation.
- Save only `tickets/backlog/prd_NNN.md` and optional conversation handoff.

Do not:

- Write a spec without confirmation.
- Create plan files.
- Create tickets.
- Implement, verify, commit, or push.

### 2. Ticket Owner Mode

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

### 3. Legacy Plan Automation Mode

Trigger: `#plan`.

Purpose: convert populated specs and reject reasons into todo tickets.

Do:

- Keep a 1-minute heartbeat alive until the user stops it.
- Use `scripts/start-plan.*`.
- Create or update `plan_NNN.md` from specs or rejects.
- Generate todo ticket bodies from `Execution Candidates`.
- Archive consumed specs/plans/rejects under `done/<project-key>/`.

Do not implement, verify, commit, or push.

### 4. Legacy Todo Queue Mode

Trigger: `#todo`.

Purpose: claim a todo ticket and implement it.

Do:

- Keep a 1-minute heartbeat alive until the user stops it.
- Resume owned inprogress work first.
- Use `scripts/start-todo.*` and `scripts/handoff-todo.*`.
- Implement within `Allowed Paths`.
- Move completed implementation to `tickets/verifier/`.

Do not verify, reject, commit, or push.

### 5. Legacy Verification Mode

Trigger: `#veri`.

Purpose: verify tickets in `tickets/verifier/`.

Do:

- Keep a 1-minute heartbeat alive until the user stops it.
- Use `scripts/start-verifier.*`.
- Run verification from `working_root`.
- Pass: integrate worktree, move to done, write completion log, create local commit.
- Fail: append `## Reject Reason`, move to reject, write completion log.

Do not fix code, create tickets, or push.

### 6. Coordinator Mode

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
- `Obsidian Links`
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

- AI-facing Markdown files (`agents/`, `rules/`, `reference/`, ticket files, verification records, logs, runtime contracts, and board operating docs) must be concise, AI-friendly English.
- Human-facing documents (product README content, desktop UI copy, user guides, release notes for the user) should be Korean by default unless the user requests another language.
- User-visible terminal or chat prose from runners should be Korean by default while preserving machine-readable formats.
- Mixed-audience documents should separate machine-readable English contracts from Korean human explanation instead of mixing languages inside one checklist or parser-sensitive template.
- Prefer observable statements over vague quality words.
- Use checklists only when each item can be judged.
- Keep durable context in board files, not chat.
- Preserve parser-sensitive headings exactly.

## Conflict Priority

1. Direct user request.
2. This `AGENTS.md`.
3. Folder README files and templates.
