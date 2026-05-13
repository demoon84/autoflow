# Board Orchestration Protocol

## Purpose

Planner AI is the board orchestrator. It owns the meaning of board state, not just PRD-to-ticket conversion.

The shell runtime is a safety kernel. It may claim files, create worktrees, validate state, refresh deterministic wiki pages, and create local commits after pass. It must not be the workflow brain.

Use `autoflow tool list` as the canonical catalog when you need a stable inventory of planner/worker/verifier/wiki entrypoints and helper contracts; the catalog is descriptive, and the AI still owns workflow decisions.

## Orchestrator Responsibilities

Planner AI watches the full planning lane and the health signals that Impl AI leaves in tickets:

- `tickets/inbox/` (also receives worker-fail retry orders)
- `tickets/backlog/`
- `tickets/todo/`
- `tickets/inprogress/`
- `tickets/done/`
- runner state and logs when needed for stalled or blocked diagnosis

Planner AI may rewrite, split, requeue, or annotate ticket markdown when the change stays inside board state and improves the next owner turn.

## Decision Order

On each planner tick:

1. Run the normal plan preflight script if configured.
2. Inspect actionable inbox/retry/backlog work.
3. Inspect health of active and todo tickets before creating more work when there is evidence of runner stall, stale worktree metadata, repeated retry, or blocked owner state.
4. Use wiki query for repeated failures, related done tickets, or architectural constraints.
5. Choose exactly one safe board action for the tick.

## Board Actions

Planner AI may perform these actions directly in markdown:

- Promote a clear memo to a generated PRD.
- Create todo tickets from a plan or generated PRD.
- Fold reject evidence into a new ticket attempt.
- Add or update `Recovery State` for a stalled or blocked ticket.
- Rewrite `Next Action`, `Resume Context`, `Notes`, `Allowed Paths`, `Done When`, or `Verification` when the owner needs a clearer next move.
- Split a broad or repeatedly failing ticket into narrower todo tickets.
- Requeue a ticket only when the old state is archived or explicitly explained in `Recovery State`.

Planner AI must not:

- author new product code (it may stage and commit changes that are *already* dirty in PROJECT_ROOT during blocked-dirty orchestration, but it does not write fresh implementation),
- create or delete git worktrees directly,
- manage runner or OS processes directly (`kill`, `pkill`, runner start/stop/restart, background cleanup),
- resolve merge conflicts in product files (during blocked-dirty orchestration, planner integrates already-dirty changes only — actual conflict resolution belongs to Impl AI),
- run final pass/fail bookkeeping for Impl AI,
- push (`git push` is forbidden in every mode), `git reset --hard`, `git clean -fd`, amend non-orchestration commits, or `git rm` files.

Planner AI **may** during blocked-dirty orchestration only:

- read PROJECT_ROOT working tree (`git status`, `git diff`, `git log`, `git show`),
- `git add` paths the runtime listed under `dirty_paths`,
- create local commits using `[PRD_NNN][ticket_NNN] orchestration cleanup: <summary>` (or `[ticket_NNN] ...` when no PRD key),
- `git stash push -m "<ticket_id>: ..."` instead of committing when committing is genuinely impossible.

Default action is integrate, not stop. The Autoflow first principle (`멈추지 않는다`) outranks classification perfectionism.

## Planner Recovery Action Contract

When the runner wakes planner for `active_recovery_reason`, the tick is a board-repair turn before normal planning. Planner AI must leave a durable markdown decision first:

- Read `protocols/board-orchestration.md` and `protocols/recovery.md`.
- Update the affected ticket's `Recovery State`, `Next Action`, `Resume Context`, and `Notes` so the next owner turn has an explicit instruction.
- Keep the edit idempotent when the evidence and planner decision are unchanged.
- If no safe board-only repair exists, set `Recovery State` status to `needs_user`, choose an explicit failure class, and park the ticket with an owner resume instruction.
- Run `autoflow guard` or `scripts/board-guard.ts` after the markdown repair and fix guard errors before creating any new plan or ticket work.
- Do not call owner/finalizer helpers, start or stop runners, kill processes, or clean git worktrees from the planner turn.

## State Source

The source of truth is ticket markdown and board folders. Chat output is only a tick summary.

When a planner adapter wakes for recovery instead of normal backlog work, runner state/logs should expose `active_item`, `active_ticket_id`, `active_ticket_title`, `active_stage`, `active_spec_ref`, `active_recovery_reason`, `active_recovery_status`, and `active_recovery_failure_class` so UI and future ticks can explain the wake-up without scraping prompts. The loop manager must preserve those fields after the adapter returns and the runner goes back to `loop_waiting_*`; otherwise Desktop will look idle even though planner is actively holding a recovery decision.

When planner changes a ticket because of orchestration or recovery, it must leave durable evidence in:

- `Recovery State`
- `Next Action`
- `Resume Context`
- `Notes`

Recovery evidence must be idempotent across loop ticks. If the current `Recovery State`, `Next Action`, and `Resume Context` already describe the same blocker and the same planner decision, do not append another confirmation note or rewrite `Last Recovery At`. Report the unchanged blocker in the tick summary and leave the ticket markdown stable until new evidence appears.

The runner may skip an unchanged planner recovery adapter turn using a scoped recovery fingerprint after the first AI diagnosis. This is a throttle, not a decision engine: new actionable plan inputs, changed orchestration signals, or changed active-ticket recovery fields must wake the planner again, while unrelated `tickets/done` or wiki churn must not keep re-waking the same blocked ticket.

## Safety Kernel Boundary

Use shell or CLI helpers only for operations where atomicity matters:

- lock or claim a ticket,
- move files between state folders,
- create, prune, or inspect git worktrees,
- validate board invariants,
- run `autoflow guard` / `scripts/board-guard.ts` after markdown recovery edits,
- finalize pass/reject logs,
- refresh deterministic wiki baseline,
- create local pass commits.

The helper output is evidence. Planner AI still decides the recovery meaning and the next board action.

## Execution Boundary Matrix

| Helper or command | Safety-kernel responsibility | AI-owned decision |
| --- | --- | --- |
| `start-plan.ts` | Atomically promote clear inbox/backlog inputs (including worker-fail retry orders) into generated PRD/todo files, expose idle signals. | Decide whether the source request is safe, whether to split/requeue, and what recovery instruction belongs in markdown. |
| `start-ticket-owner.ts` | Claim or resume exactly one ticket, create/inspect its worktree, and block unsafe worktree states. | Write the mini-plan, choose implementation approach, and decide whether blocked evidence requires owner repair, planner re-orchestration, or user input. |
| `autoflow tool list` | List stable CLI/script/helper entrypoints and their thin contracts. | Decide which helper to call, in what order, and how to interpret its output in the current ticket or planner turn. |
| `verify-ticket-owner.ts` | Record verification evidence when the AI has already run and inspected the command. | Decide whether verification proves the ticket goal and Done When are satisfied. |
| `finish-ticket-owner.ts` | Move pass/fail bookkeeping forward, archive evidence, call deterministic finalizers, and create local completion commits after AI merge. | Decide pass/fail, integrate verified changes into `PROJECT_ROOT`, resolve conflicts, and rerun needed verification before pass. |
| `merge-ready-ticket.ts` | Validate that AI-merged product state matches ticket/worktree expectations and refuse unsafe merge states. | Perform rebases, cherry-picks, conflict resolution, and product-file merge decisions. |
| `update-wiki.ts` | Refresh deterministic wiki baseline pages from done/log/retry board evidence. | Synthesize semantic wiki knowledge; this belongs to `wiki`, not inline owner finalization. |
| `autoflow guard` / `scripts/board-guard.ts` | Validate board invariants after AI-authored markdown edits. | Interpret guard output and repair ticket markdown before creating more work. |

If a helper reports `blocked`, `needs_ai_merge`, `warning`, or `error`, do not route around it with another shell step. Preserve the evidence in board markdown and let the responsible AI role choose the next safe action.

If runner or process health looks wrong, the planner's safe action is to record the evidence in ticket `Recovery State`, `Next Action`, or `Resume Context`. It must not kill processes, restart runners, or clean up unrelated background commands from inside the adapter turn.
