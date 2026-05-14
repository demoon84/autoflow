# AGENTS.md

This board is an Autoflow sidecar harness installed inside a host project.
The default execution model is **4-runner mode**: Planner AI creates tickets, Impl AI owns implementation, Verifier AI checks semantic fit, and Wiki AI maintains derived knowledge. Failures route to order retry orders, not an active reject queue.

## Canonical Flow

Default 4-runner flow:

```text
PROJECT_ROOT
  -> .autoflow/tickets/order/order_NNN.md             (사용자 /order 또는 worker fail retry)
  -> .autoflow/tickets/prd/prd_NNN.md             (Planner 가 승격 / 사용자 /autoflow)
  -> .autoflow/tickets/todo/Todo-NNN.md               (Planner 가 발급)
  -> .autoflow/tickets/inprogress/Todo-NNN.md         (Worker active, worktree 1 개)
  -> .autoflow/tickets/verifier/Todo-NNN.md           (Verifier semantic review)
  -> .autoflow/tickets/done/<project-key>/Todo-NNN.md (성공만 모임)
```

Worker fail 시 ticket 본문은 `tickets/order/order_<id>_retry_<N>_<ts>.md` 의 `## Original Ticket` 섹션에 통째 embed 되고 inprogress markdown 은 `rm`. 별도 reject 큐 없음.

Directory meanings:

- `PROJECT_ROOT`: the real product repository root.
- `tickets/order/`: quick order + worker-fail retry order 큐. Planner AI 가 promotion.
- `tickets/prd/`: approved spec 큐.
- `tickets/todo/`: Planner 가 발급한 ticket 큐. Worker claim 대기.
- `tickets/inprogress/`: active Worker ticket (single live worktree).
- `tickets/done/<project-key>/`: passed ticket, archived spec/plan, completion log. 성공만 모임.
- `reference/`: templates and board reference material.
- `protocols/`: AI-first orchestration, worker, and recovery contracts.
- `rules/`: operating rules and wiki linting.
- `automations/`: hook, heartbeat, and runtime context contracts.
- `agents/`: role prompts used by human or local runner agents.
- `logs/`: completion logs and hook dispatch logs.
- `wiki/`: generated and human-maintained project knowledge derived from completed work.

Removed (refactor 2026-05-07): `tickets/reject/` fail routing and `tickets/check/` monitor ledger. `tickets/verifier/` was reintroduced for semantic review in the 4-runner topology. Verification evidence lives directly in the ticket markdown's `## Verification` section.

## Read Order

At the start of work, read in this order:

1. `README.md`
2. `rules/README.md`
3. `reference/prd.md`
4. `reference/order.md`
5. `reference/plan.md`
6. `automations/README.md`
7. `reference/tickets-board.md`
8. `reference/runner-tool-contract.md`
9. `reference/runner-startup-common.md`
10. Role-specific startup rules under `reference/runner-startup-rules/`
11. Role-specific files:
   - PRD handoff: `agents/spec-author-agent.md`
   - default execution (Impl AI): `agents/worker-agent.md`
   - orchestration (Planner AI): `agents/plan-to-ticket-agent.md`
   - verifier review (Verifier AI): `agents/verifier-agent.md`
   - wiki maintenance (Wiki AI): `agents/wiki-maintainer-agent.md`
   - legacy compat: `agents/todo-queue-agent.md`, `agents/coordinator-agent.md`, `agents/merge-bot-agent.md`

## Runtime Command Convention

- Use the matching `scripts/*.ts` entrypoint for runtime commands.
- When docs say `start-ticket runtime`, `verify-ticket runtime`, `finish-ticket runtime`, `start-plan runtime`, or `merge-ready-ticket runtime`, run the `.ts` script in `scripts/`.
- `planner`, `worker`, `verifier`, and `wiki` are runners. The canonical runner/tool boundary is `reference/runner-tool-contract.md`: runners decide, runner tools execute one explicit deterministic action and return inspectable results. For new Planner work prefer `scripts/runner-tool.ts planner ...`, for new Worker claim/worktree/evidence/check operations prefer `scripts/runner-tool.ts worker ...`, for new Verifier semantic-review evidence/decision routing prefer `scripts/runner-tool.ts verifier ...`, and for new Wiki source/update/query/lint/write helpers prefer `scripts/runner-tool.ts wiki ...`. Add new helper behavior as a one-feature file under `scripts/runner-tool/<role>/` and export it through that folder's `index.ts`.

## Core Rules

1. Do not create plans or tickets without an approved spec or a clear quick order promoted by Planner AI.
2. Claude `/autoflow`, Codex `$autoflow`, and compatibility alias `#autoflow` are PRD handoff triggers only. They never create plans, tickets, implementation changes, verification records, commits, or pushes.
3. Claude `/order`, Codex `$order`, and compatibility alias `#order` are quick intake triggers only. They write `tickets/order/order_*.md` and never create PRDs, tickets, implementation changes, verification records, commits, or pushes.
4. The default execution path uses four runners: `planner` promotes order/prd/retry inputs into todo work and writes `Recovery State` repair instructions, `worker` implements the resulting ticket, `verifier` checks semantic alignment, and `wiki` maintains derived knowledge. Prefer `autoflow run planner` before `autoflow run ticket` for fresh PRD queue items; legacy planner/todo/verifier splitting remains compatibility-only.
5. A Worker runner claims or creates one `Todo-NNN.md`, writes its mini-plan inside the ticket, implements within `Allowed Paths`, runs verification, records evidence, and requests pass/fail finalization. The verifier runner owns semantic review when the ticket enters the verifier lane.
6. Legacy `#plan`, `#todo`, and `#veri` remain compatibility triggers only.
7. Board stage is authoritative. If a ticket is in `todo/` or `inprogress/`, treat it as implementation work even if the title sounds like review or verification.
8. `Allowed Paths` are repo-relative. In git repositories, ticket worktrees are preferred. If no ticket worktree exists, paths fall back to `PROJECT_ROOT`.
9. Never edit outside `Allowed Paths` unless the user explicitly expands scope.
10. Never run `git push` from automation or agent work. Remote publication is always a human decision.
11. Worker may run local verification commands, use built-in browser tools when needed, and move board files without asking again. The finalizer's mechanical sanity gate (git diff >= 1 + every Done When `[x]`) blocks false pass mechanically.
12. If a browser tool is opened during a turn, close it before the turn ends unless the user asks to keep it open.
13. Prefer non-browser checks first. Use the current agent's built-in browser tool only when rendered behavior matters. Do not use Playwright.
14. There must not be two copies of the same `Todo-NNN.md` in different state folders.
15. `tickets/inprogress/Todo-NNN.md` must keep `AI`, `Stage`, `Claimed By`, `Execution AI`, `Last Updated`, `Next Action`, and `Resume Context` current.
16. Resume from board files, not chat memory. Use `Resume Context`, `References`, `Reference Notes`, run files, and logs.
17. `automations/state/*.context` is runtime state for stop hooks and worker identity. Clear active ticket context at tick end, but keep role/worker context when a heartbeat must continue.
18. Verification evidence lives directly in the ticket markdown's `## Verification` section (Result / Exit Code / Last Run). Separate `verify_NNN.md` sidecar files were retired 2026-05-07.
19. Done tickets keep `Verification`, `Result`, and `## Done When` (every item `[x]`) up to date. Wiki AI refreshes derived knowledge separately; no inline wiki update at finalize.
20. Ticket filenames use `Todo-001.md`. New IDs are max existing ID + 1.
21. In git repositories, Worker work happens in the ticket worktree when available. The first `scripts/finish-ticket.ts pass` happens after local worktree verification and before PROJECT_ROOT merge, handing off to Verifier AI. Only after verifier pass may worker merge and run the final `finish-ticket.ts pass`; finalizer scripts perform bookkeeping and mechanical gates, not semantic decisions.
22. If central `PROJECT_ROOT` has unrelated dirty files outside the board, do not mix them into verification commits.
23. Heartbeat workers do not stop themselves. Idle means wait for the next wake-up.
24. At the end of every heartbeat or runner tick, report the current progress percentage. Prefer `autoflow metrics` or board spec/ticket counts, and include the percentage in the tick's final chat or log summary.
25. User-visible AI conversation, progress summaries, and explanations in terminal, adapter, and heartbeat output should be Korean by default. Newly generated PRD, plan, ticket, and user-friendly order prose should also be Korean by default. Keep key=value output, paths, commands, code, ticket fields, parser-sensitive section names, ids, project keys, runtime formats, and AI-facing board contracts in their required language and format.

## Agent Modes

### 1. Spec Authoring Mode

Trigger: Claude `/autoflow`, Codex `$autoflow`, or compatibility alias `#autoflow`.

Purpose: turn the conversation into one approved PRD queue spec, or a small ordered PRD set when the scope is too large for one safe spec.

Read:

- `agents/spec-author-agent.md`
- host `AGENTS.md` or `CLAUDE.md` when present
- existing prd, plan, inprogress, and done specs
- `reference/project-spec-template.md`

Do:

- Run `scripts/start-spec.ts` to reserve or resume a spec slot.
- Gather goal, scope, modules, allowed paths, acceptance criteria, and verification command through lightweight chat.
- If the request spans multiple independent outcomes, modules, releases, or verification paths, propose a short PRD split map before drafting.
- Use short questions and decision recaps; do not render the PRD template every turn.
- Render the full spec draft only after the user gives an explicit draft trigger such as `초안`, `초안 작성`, `초안 보여줘`, `정리해줘`, `draft`, `draft prd`, or `show draft`.
- For a PRD set, render each PRD draft separately and include sibling references in `Conversation Handoff` or `Notes`.
- Save only after separate explicit user confirmation. A draft trigger is not save approval; multiple drafts need per-PRD approval or a clear save-all confirmation.
- Save only `tickets/prd/prd_NNN.md` and optional conversation handoff. Multiple PRDs must be separate PRD files, saved one active slot at a time.

Do not:

- Write a spec without confirmation.
- Create plan files.
- Create tickets.
- Implement, verify, commit, or push.

### 2. Quick Order Intake Mode

Trigger: Claude `/order`, Codex `$order`, or compatibility alias `#order`.

Purpose: capture a small request without a full PRD handoff.

Do:

- Preserve the original user request in `tickets/order/order_*.md`.
- Add scope, Allowed Paths, and verification hints only when obvious.
- Let Plan AI promote the order note into a generated PRD and todo ticket when safe.

Do not:

- Draft a full PRD in chat.
- Create PRDs or tickets directly.
- Implement, verify, commit, or push.

### 3. Worker Mode

Purpose: one worker completes one ticket end to end.

Read:

- `agents/worker-agent.md`
- target spec or ticket
- referenced docs, rules, and verifier checklist

Do:

- Resume an owned active ticket first.
- Otherwise claim or create one ticket from prd/todo/verifier.
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
- Use `scripts/runner-tool.ts planner queue-snapshot` to inspect candidates and choose the next action yourself. Use `scripts/start-plan.ts` only for compatibility branches that have not yet been split into runner tools.
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
- Use `scripts/start-todo.*` and `scripts/handoff-todo.js`.
- Implement within `Allowed Paths`.
- On local completion, the worker calls `finish-ticket.ts pass` to hand off to verifier before any merge. After verifier pass, the worker merges approved work into `PROJECT_ROOT`, reruns verification, then calls the finalizer for bookkeeping and the local completion commit.

Do not push.

### 6. Verifier Mode

The active `verifier` runner owns semantic review of verifier-lane tickets. It compares the finished diff with the ticket Title, Goal, and Done When items, records the decision, and routes pass/fail through `scripts/runner-tool.ts verifier ...`. Legacy `#veri` remains compatibility-only.

### 7. Coordinator Mode

Purpose: explain legacy board/runtime health and blocked work when explicitly enabled.

Do:

- Outside a coordinator adapter turn, run or resume `autoflow runners start coordinator-1` to keep the long-lived coordinator alive.
- Inside a coordinator adapter turn, do not start, restart, or run the coordinator recursively. Execute the provided runtime script directly once.
- Inspect shared Allowed Path blockers, dirty root overlap, worktree health, runner state, and scaffold checks.
- Recommend the smallest safe next action.

Do not implement, requeue, reset, hand-edit merge results, or push.

## Required Ticket Fields

Every ticket must keep these sections or fields current:

- `ID`
- `Project Key`
- `Title`
- `Stage`
- `AI`
- `Claimed By`
- `Execution AI`
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
- `tickets/done/`
- `tickets/order/` (for `order_*_retry_*.md` from worker fail)

Do not create a duplicate for the same goal or same plan source. A retry order gets a new file under `tickets/order/` with `retry_count` incremented.

## Retry Order Retention Policy

- Retry artifacts are evidence for failure history and must be preserved, not deleted, once created.
- Files matching `done/<prd>/order_*_retry_*.md` should remain in `tickets/done/<prd>/` until a planner/worker decision removes them.
- If a retry is reissued, create a fresh `tickets/order/order_<id>_retry_<N>_<ts>.md` file with updated metadata and keep the previous order in the done archive path for audit.
- Do not delete retry files from done as part of cleanup unless a higher-priority runbook explicitly mandates retention reset.

## Completion Standard

A ticket may move to done only when:

1. Every `## Done When` item is `[x]` (mechanically enforced by the shell sanity gate at finalize).
2. `git diff <Worktree.Base Commit>..HEAD` line count ≥ 1 (mechanically enforced).
3. The ticket markdown's `## Verification` section records the run result inline.
4. A completion log exists under `logs/`.
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
