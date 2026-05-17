# Automations

Autoflow's default execution model is **not** an external recurring
automation. The desktop app starts long-lived PTY runners, pushes `[wake]`
messages when board files change, and uses a safety poller so pending queue
work is not missed.

This directory documents automation-adjacent contracts only:

- stop-hook context,
- runner identity context,
- realtime wake expectations,
- legacy file-watch compatibility.

## Default Wake Model

Default 4-runner topology:

- `planner`: promotes `tickets/order/` and `tickets/prd/` inputs into
  worker-ready todo tickets and records recovery decisions.
- `worker`: owns one ticket end-to-end through claim, worktree preparation,
  implementation, local verification, verifier handoff, verifier decision
  handling, merge, and finalization.
- `verifier`: checks semantic fit and records pass, revise, or replan.
- `wiki`: refreshes derived wiki knowledge when completed work or material
  wiki source changes require it.

Wake sources:

- Desktop `fs.watch` pushes `[wake] <path>` into matching live PTY runners.
- Desktop safety polling sends a wake when queue work is pending and a runner
  appears idle or stalled.
- Runner tools can emit durable wake queue events through
  `autoflow tool runner-wake emit`.
- Each runner must still scan its queues at startup before waiting for a wake.

Idle is valid. It means no actionable board item was available for this tick,
not that the workflow is permanently finished.

## Trigger Contract

Autoflow skill handoff (`/autoflow`, `$autoflow`) and compatibility alias
(`#autoflow`):

- Gather requirements in lightweight chat first.
- Render full PRD drafts only after an explicit draft trigger such as `초안`,
  `초안 작성`, `초안 보여줘`, `정리해줘`, `draft`, `draft prd`, or `show draft`.
- Save only after separate explicit approval.
- Write only `tickets/prd/prd_NNN.md` and optional conversation handoff.
- Do not create plans, tickets, code, verification records, commits, or pushes.

Order skill handoff (`/order`, `$order`, `#order`) and
`autoflow order create`:

- Save only a quick order under `tickets/order/order_*.md`.
- Preserve the original request and optional hints.
- Do not create PRDs, tickets, code, verification records, commits, or pushes.
- The planner runner decides whether clear orders need generated PRDs first or
  can become narrow direct TODO tickets.

## Optional Stop Hook

The stop hook checks for unfinished worker or legacy work before an agent exits
too early.

It may block exit when:

- a worker ticket is active,
- todo tickets are waiting,
- verifier tickets are waiting,
- retry orders require planning,
- active context says work remains.

The stop hook supplements runner wakeups. It does not replace the runner loop.

## Legacy File-Watch Mode

File-watch hooks (`watch-board.ts` -> `run-hook.ts`) are deprecated legacy
script-driven triggers. The supported model is PTY runner wakeup plus runner
tools. Use file-watch only as a backwards-compatibility fallback.

Typical routes when file-watch fallback is explicitly enabled:

- order changes -> planner,
- prd changes -> planner,
- todo changes -> worker,
- verifier changes -> verifier or worker depending on the recorded decision,
- done changes -> wiki.

Hook dispatch history belongs in `logs/hooks/`. Normal runner logs and live
PTY artifacts belong in `runners/logs/`.

## Operating Principle

Board stage is authoritative. The chat transcript is not.

Planner, worker, verifier, and wiki are runners. A runner is the LLM-backed
decision-maker. Runner tools are small deterministic commands the runner calls
for one safe action. Runtime scripts and runner tools must not be the actor
that plans recovery, implements, verifies, rebases, cherry-picks, resolves
conflicts, merges product code, or updates wiki meaning by themselves.

Wiki baseline updates follow the same AI-first rule. The wiki runner inspects
inputs first and calls `autoflow wiki update` only when a baseline refresh is
warranted. Check-only state belongs under `runners/state/`.

## Context Lifecycle

- Runtime may store role and worker identity in `automations/state/`.
- Active ticket context should be cleared at tick end when possible.
- Role and worker context may remain for runner continuity.
- The next tick resumes from ticket files, references, run files, and logs.

## Worker Identity Contract

Recommended environment variables:

- `AUTOFLOW_WORKER_ID`
- `AUTOFLOW_THREAD_ID`
- `AUTOFLOW_ROLE`
- `AUTOFLOW_BOARD_ROOT`
- `AUTOFLOW_PROJECT_ROOT`

## Recommended Topology

Default:

- one planner runner (`planner`),
- one worker runner (`worker`),
- one verifier runner (`verifier`),
- one wiki runner (`wiki`).

The runners are path-disjoint and wake on board changes without conflicting.
Scale only after profiling shows the pipeline is starved. Running multiple
worker runners increases worktree base drift and Allowed Paths conflicts, so
the default config intentionally serializes worker execution. `coordinator` is
not a runner. `merge` / `merge-bot` are worker-runner compatibility aliases;
verifier-approved merge remains owned by `worker`.

## Non-Goals

- No external recurring automation templates in the installed board.
- No automatic push.
- No hidden pass/revise/replan.
- No implementation during PRD handoff.
- No wiki-as-source-of-truth.
