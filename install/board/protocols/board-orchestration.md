# Board Orchestration Protocol

## Purpose

The planner runner is the board orchestrator. It owns the meaning of board state, not just PRD-to-ticket conversion.

The shell runtime is a safety kernel. It may claim files, create worktrees, validate state, refresh deterministic wiki pages, and create local commits after pass. It must not be the workflow brain.

Use `autoflow tool list` as the canonical catalog when you need a stable inventory of planner/worker/verifier/wiki entrypoints and helper contracts; the catalog is descriptive, and the AI still owns workflow decisions.

## Orchestrator Responsibilities

The planner runner watches the full planning lane and the health signals that the worker runner leaves in tickets:

- `tickets/order/` (also receives verifier replan retry orders)
- `tickets/prd/`
- `tickets/todo/`
- `tickets/inprogress/`
- `tickets/done/`
- runner state and logs when needed for stalled or blocked diagnosis

The planner runner may rewrite, split, requeue, or annotate ticket markdown when the change stays inside board state and improves the next worker turn.

## Decision Order

On each planner tick:

1. Run the normal plan preflight script if configured.
2. Inspect actionable order/retry/PRD work.
3. Inspect health of active and todo tickets before creating more work when there is evidence of runner stall, stale worktree metadata, repeated retry, or blocked worker state.
4. Use wiki query for repeated failures, related done tickets, or architectural constraints.
5. Choose exactly one safe board action for the tick.

## Board Actions

The planner runner may perform these actions directly in markdown:

- Promote a clear memo to one or more generated PRDs.
- Create one or more todo tickets from a plan or generated PRD.
- Fold retry/replan evidence into a new ticket attempt.
- Add or update `Recovery State` for a stalled or blocked ticket.
- Rewrite `Next Action`, `Resume Context`, `Notes`, `Allowed Paths`, `Done When`, or `Verification` when the worker needs a clearer next move.
- Split a broad or repeatedly failing ticket into narrower todo tickets.
- Requeue a ticket only when the old state is archived or explicitly explained in `Recovery State`.

The planner runner must not:

- author new product code,
- create or delete git worktrees directly,
- manage runner or OS processes directly (`kill`, `pkill`, runner start/stop/restart, background cleanup),
- resolve merge conflicts in product files; actual conflict resolution belongs to the worker runner,
- run final pass/replan bookkeeping for the worker runner,
- push (`git push` is forbidden in every mode), `git reset --hard`, `git clean -fd`, amend non-orchestration commits, or `git rm` files.

Dirty root conflicts are recovery evidence, not planner cleanup work. Record the evidence in board markdown and route the next action to the worker runner or user boundary instead of staging, stashing, committing, or cleaning PROJECT_ROOT from a planner turn.

Default action is integrate, not stop. The Autoflow first principle (`멈추지 않는다`) outranks classification perfectionism.

## Planner Recovery Action Contract

When the runner wakes planner for `active_recovery_reason`, the tick is a board-repair turn before normal planning. The planner runner must leave a durable markdown decision first:

- Read `protocols/board-orchestration.md` and `protocols/recovery.md`.
- Update the affected ticket's `Recovery State`, `Next Action`, `Resume Context`, and `Notes` so the next worker turn has an explicit instruction.
- Keep the edit idempotent when the evidence and planner decision are unchanged.
- If no safe board-only repair exists, set `Recovery State` status to `needs_user`, choose an explicit failure class, and park the ticket with a worker resume instruction.
- Run `autoflow guard` after the markdown repair and fix guard errors before creating any new plan or ticket work.
- Do not call worker/finalizer helpers, start or stop runners, kill processes, or clean git worktrees from the planner turn.

## State Source

The source of truth is ticket markdown and board folders. Chat output is only a tick summary.

When a planner adapter wakes for recovery instead of normal PRD work, runner state/logs should expose `active_item`, `active_ticket_id`, `active_ticket_title`, `active_stage`, `active_spec_ref`, `active_recovery_reason`, `active_recovery_status`, and `active_recovery_failure_class` so UI and future ticks can explain the wake-up without scraping prompts. The loop manager must preserve those fields after the adapter returns and the runner goes back to `loop_waiting_*`; otherwise Desktop will look idle even though planner is actively holding a recovery decision.

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
- run `autoflow guard` after markdown recovery edits,
- finalize pass/replan logs,
- refresh deterministic wiki baseline,
- create local pass commits.

The helper output is evidence. The planner runner still decides the recovery meaning and the next board action.

## Execution Boundary Matrix

| Helper or command | Safety-kernel responsibility | AI-owned decision |
| --- | --- | --- |
| `autoflow run planner` | Atomically promote clear order/prd inputs (including verifier replan retry orders) into generated PRD/todo files, expose idle signals. | Decide whether the source request is safe, whether to split/requeue, and what recovery instruction belongs in markdown. |
| `autoflow run ticket` | Report owned active ticket context or the next todo candidate. It must not claim tickets, create worktrees, choose work, or fall back to `PROJECT_ROOT`. | Choose the ticket, call `autoflow tool runner-tool worker claim` or `autoflow tool runner-tool worker worktree-ensure` explicitly, write the mini-plan, and decide whether blocked evidence requires worker repair, planner re-orchestration, or user input. |
| `autoflow tool list` | List stable CLI/script/helper entrypoints and their thin contracts. | Decide which helper to call, in what order, and how to interpret its output in the current ticket or planner turn. |
| `autoflow tool runner-tool worker verification-record` / `autoflow tool verify-ticket` | Record verification evidence when the worker runner has already run and inspected the command. | Decide whether verification proves the ticket goal and Done When are satisfied. |
| `autoflow tool runner-tool worker submit-to-verifier|create-retry-order|finalize-approved` | Backend finalizer wrappers. They run mechanical sanity gates, create retry orders, and validate/archive/commit the merged result after worker decisions. | Decide pass/revise/replan, integrate verifier-approved changes into `PROJECT_ROOT`, resolve conflicts, and rerun needed verification before final approval finalization. |
| `autoflow tool merge-ready-ticket` | Validate that worker-merged product state matches ticket/worktree expectations and refuse unsafe merge states. | Perform rebases, cherry-picks, conflict resolution, and product-file merge decisions. |
| `autoflow wiki update` | Refresh deterministic wiki baseline pages from done/log/retry board evidence. | Synthesize semantic wiki knowledge; this belongs to `wiki`, not inline worker finalization. |
| `autoflow guard` | Validate board invariants after AI-authored markdown edits. | Interpret guard output and repair ticket markdown before creating more work. |

If a helper reports `blocked`, `needs_ai_merge`, `warning`, or `error`, do not route around it with another shell step. Preserve the evidence in board markdown and let the responsible runner choose the next safe action.

If runner or process health looks wrong, the planner's safe action is to record the evidence in ticket `Recovery State`, `Next Action`, or `Resume Context`. It must not kill processes, restart runners, or clean up unrelated background commands from inside the adapter turn.
