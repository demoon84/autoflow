# Automations

Automations connect board folders to recurring workers, stop hooks, and file-watch hooks.

## Reference Model

Default 4-runner topology (planner + worker + verifier + wiki):

- Claude `/autoflow`, Codex `$autoflow`, or `#autoflow`: manual PRD handoff, no heartbeat.
- `planner` (Planner runner): converts quick orders, retry orders, and populated backlog PRDs into todo tickets, then supervises board health when owner work stalls or breaks. Path scope: `tickets/{inbox,backlog,todo,inprogress,done}/` for markdown-only orchestration. Owns order promotion and `Recovery State` decisions.
- `worker` (Impl AI): claims one ticket from `tickets/todo/`, writes a mini-plan, implements, runs and judges verification, manually merges into `PROJECT_ROOT`, and finishes pass or fail. It does not refresh or stage wiki pages during ticket completion.
- `verifier` (Verifier runner): reads verifier-lane tickets, compares the diff against the ticket title, goal, and Done When items, and records pass/fail semantics without implementing code.
- `wiki` (Wiki AI): ticks every minute, inspects whether source changes require wiki work, calls `autoflow wiki update` only for material baseline drift, and layers AI synthesis (`autoflow wiki query --synth`, `autoflow wiki lint --semantic`) when needed. Path scope: `.autoflow/wiki/` only for real content updates; check-only state belongs under `.autoflow/runners/state/`.
- The four runners write to disjoint paths so concurrent ticks avoid merge conflicts.

Legacy role-pipeline model (compatibility only — DEPRECATED):

- `#plan`: planner heartbeat (Plan AI runner replaces this).
- `#todo`: todo implementation heartbeat (Impl AI claims todo directly).
- `#veri`: legacy verifier heartbeat. The active `verifier` runner replaces this in the default topology.

## Trigger Contract

Autoflow skill handoff (`/autoflow`, `$autoflow`) and compatibility alias (`#autoflow`):

- Gather requirements in lightweight chat first; use short questions and decision recaps instead of rendering the PRD template every turn.
- If scope is too large for one safe handoff, propose a lightweight PRD split map before drafting.
- Render the full PRD draft(s) only after an explicit draft trigger such as `초안`, `초안 작성`, `초안 보여줘`, `정리해줘`, `draft`, `draft prd`, or `show draft`.
- Save only after separate explicit approval. A draft trigger is not save approval; multiple drafts need per-PRD approval or a clear save-all confirmation.
- Write only `tickets/backlog/prd_NNN.md` and optional conversation handoff. Split PRDs are separate backlog files saved one active slot at a time.
- Do not create plans, tickets, code, verification records, commits, or pushes.

Order skill handoff (`/order`, `$order`, `#order`) and `autoflow order create`:

- Save only a quick order under `tickets/inbox/order_*.md`.
- Preserve the original request and optional hints.
- Do not create PRDs, tickets, code, verification records, commits, or pushes.
- Plan AI promotes clear orders into generated PRDs and todo tickets.

`ticket-owner`:

- Claims or creates one active ticket.
- Reads planner `Recovery State` / owner resume instruction when present.
- Writes a mini-plan in the ticket.
- Implements within `Allowed Paths`.
- Runs verification commands directly, judges evidence, and records evidence.
- Manually merges verified changes into `PROJECT_ROOT`, resolving conflicts when needed.
- Finishes pass or fail.

Legacy `#plan`:

- Reads backlog specs and reject reasons.
- Creates or updates plans.
- Generates todo tickets from execution candidates.

Legacy `#todo`:

- Claims todo tickets.
- Implements only.
- Hands off to verifier.

Legacy `#veri`:

- Verifies tickets waiting in `tickets/verifier/`.
- Pass moves to done with local commit.
- Fail moves to reject with `## Reject Reason`.

## Heartbeat Policy

- Heartbeats must not stop themselves.
- Idle is a valid state.
- The user is the only actor who stops a heartbeat.
- One chat should own one active item at a time.
- Durable progress belongs in board files.

## Optional Stop Hook

The stop hook checks for unfinished owner or legacy work before the agent exits too early.

It may block exit when:

- a Ticket Owner ticket is active,
- todo tickets are waiting,
- verifier tickets are waiting,
- reject records require planning,
- active context says work remains.

The stop hook supplements heartbeats. It does not replace them.

## File Watch Mode (DEPRECATED legacy script-driven trigger)

File-watch hooks (`watch-board.ts` -> `run-hook.ts`) can dispatch work
when board files change. **This is the legacy script-driven trigger
pattern**; the supported execution model is the heartbeat-driven
4-runner topology where AI runners read board state each minute and
call scripts as tools. Use file-watch only as a backwards-compat
fallback for environments where the 1-minute heartbeat is unreliable.

Typical routes (when file-watch is enabled):

- inbox changes -> planner,
- backlog changes -> ticket owner or legacy planner,
- todo changes -> ticket owner or legacy todo,
- verifier changes -> ticket owner or legacy verifier,
- done/retry changes -> planner follow-up when legacy retries are enabled.

Each hook dispatch writes a log under `logs/hooks/`.

## Hook Map (legacy file-watch only)

Recommended map (when running file-watch alongside the heartbeat as a
fallback):

- `tickets/inbox/`: `plan` route when file-watch fallback is enabled.
- `tickets/backlog/`: `ticket` route by default.
- `tickets/todo/`: `ticket` route by default.
- `tickets/verifier/`: `ticket` route by default.
- `tickets/inbox/order_*_retry_*.md`: `plan` route when file-watch fallback is enabled.
- `tickets/done/`: no script-driven wiki route is needed. `wiki` inspects done/log/retry sources on its own heartbeat and calls `autoflow wiki update` as a tool only when the managed baseline materially changes.

## Operating Principle

Board stage is authoritative. The chat transcript is not.

Planner, worker, verifier, and wiki are runners. A runner is the LLM-backed decision-maker. Runner tools are small deterministic commands the runner calls for one safe action. Runtime scripts and runner tools must not be the actor that plans recovery, implements, verifies, rebases, cherry-picks, resolves conflicts, merges product code, or updates wiki meaning by themselves.

Protocol files under `protocols/` define the AI-first workflow:

- `board-orchestration.md`: planner-owned board supervision and shell safety boundary.
- `recovery.md`: stalled/blocked/requeue classification and evidence rules.
- `owner-contract.md`: owner execution contract and planner instruction handling.

Use `autoflow guard` or `scripts/board-guard.ts` after AI-authored board repair to catch duplicate ticket states, stale todo worktree metadata, leftover ticket worktrees for rejected/done tickets, and missing active-ticket recovery sections.

Wiki baseline updates follow the same AI-first rule. The Wiki AI inspects inputs first and calls `autoflow wiki update` as a deterministic tool only when a baseline refresh is warranted. The tool must not rewrite committed wiki pages for check timestamps alone; check metadata is recorded in `runners/state/wiki-baseline.history`.

## Context Lifecycle

- Runtime may store role and worker identity in `automations/state/`.
- Active ticket context should be cleared at tick end when possible.
- Role and worker context may remain for heartbeat continuity.
- Next tick resumes from ticket files, references, run files, and logs.

## Worker Identity Contract

Recommended environment variables:

- `AUTOFLOW_WORKER_ID`
- `AUTOFLOW_THREAD_ID`
- `AUTOFLOW_ROLE`
- `AUTOFLOW_BOARD_ROOT`
- `AUTOFLOW_PROJECT_ROOT`

## Recommended Topology

Default (all sizes):

- one Planner AI (`planner`),
- one Impl AI (`worker`),
- one Verifier AI (`verifier`),
- one Wiki AI (`wiki`).

The runners are path-disjoint and tick on heartbeat/realtime wakeups without conflicting. Scale only after profiling shows the pipeline is starved — running multiple Impl AI instances increases worktree base drift / Allowed Paths conflicts and is intentionally serialized to one Impl AI in the default config. Legacy role-pipeline (`#plan`, `#todo`, `#veri`, `coordinator`, `merge-bot`) and the file-watcher are kept reachable for backwards compatibility but are not part of the default topology.

## Thread Coordination Rules

- One chat owns one active item.
- Do not claim a new ticket while an owned one is active.
- Do not keep critical state only in chat.
- Use `Resume Context` for restart safety.

## Non-Goals

- No automatic push.
- No hidden pass/fail.
- No implementation during PRD handoff.
- No wiki-as-source-of-truth.

## Template Files

Heartbeat templates live under `automations/templates/` and can be rendered by `autoflow render-heartbeats`.
Runner add/remove does not rewrite `automations/heartbeat-set.toml` by default. Treat the file as an explicit automation source; edit it intentionally, or opt in with `AUTOFLOW_RUNNERS_SYNC_HEARTBEAT_SET=1` only when legacy rendered heartbeats must track runner ids automatically.
