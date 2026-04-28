# Automations

Automations connect board folders to recurring workers, stop hooks, and file-watch hooks.

## Reference Model

Default 3-runner topology (planner-1 + owner-1 + wiki-1):

- Claude `/af` / `/autoflow`, Codex `$af` / `$autoflow`, or `#af` / `#autoflow`: manual PRD handoff, no heartbeat.
- `planner-1` (Plan AI): converts populated backlog PRDs and reject records into todo tickets. Path scope: `tickets/{backlog,todo,reject,done}/`. Owns reject auto-replan up to `AUTOFLOW_REJECT_MAX_RETRIES`.
- `owner-1` (Impl AI): claims one ticket from `tickets/todo/`, writes a mini-plan, implements, runs and judges verification, manually merges into `PROJECT_ROOT`, and finishes pass or fail. Refreshes the deterministic wiki baseline inline at merge time.
- `wiki-1` (Wiki AI): ticks every minute and layers AI synthesis (`autoflow wiki query --synth`, `autoflow wiki lint --semantic`) over the deterministic baseline whenever `tickets/done/` or `tickets/reject/` changes. Path scope: `.autoflow/wiki/` only.
- The three runners write to disjoint paths so concurrent ticks never produce merge conflicts.

Legacy role-pipeline model (compatibility only — DEPRECATED):

- `#plan`: planner heartbeat (Plan AI runner replaces this).
- `#todo`: todo implementation heartbeat (Impl AI claims todo directly).
- `#veri`: verifier heartbeat (Impl AI runs AI-led verification inline).

## Trigger Contract

Autoflow skill handoff (`/af`, `/autoflow`, `$af`, `$autoflow`) and compatibility aliases (`#af`, `#autoflow`):

- Draft the spec in chat first.
- Save only after explicit approval.
- Write only `tickets/backlog/prd_NNN.md` and optional conversation handoff.
- Do not create plans, tickets, code, verification records, commits, or pushes.

`ticket-owner`:

- Claims or creates one active ticket.
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

File-watch hooks (`watch-board.sh` / `watch-board.ps1` → `run-hook.sh` /
`run-hook.ps1`) can dispatch work when board files change. **This is the
legacy script-driven trigger pattern**; the supported execution model is
the heartbeat-driven 3-runner topology where AI runners read board state
each minute and call scripts as tools. Use file-watch only as a
backwards-compat fallback for environments where the minute heartbeat is
unreliable.

Typical routes (when file-watch is enabled):

- backlog changes -> ticket owner or legacy planner,
- todo changes -> ticket owner or legacy todo,
- verifier changes -> ticket owner or legacy verifier,
- done/reject changes -> planner follow-up when legacy retries are enabled.

Each hook dispatch writes a log under `logs/hooks/`.

## Hook Map (legacy file-watch only)

Recommended map (when running file-watch alongside the heartbeat as a
fallback):

- `tickets/backlog/`: `ticket` route by default.
- `tickets/todo/`: `ticket` route by default.
- `tickets/verifier/`: `ticket` route by default.
- `tickets/reject/`: legacy `plan` route if role-pipeline is enabled.
- `tickets/done/`: no separate wiki route is needed; Impl AI's `finish-ticket-owner pass` runs the deterministic `update-wiki.sh` inline so the baseline stays fresh, and `wiki-1` layers AI synthesis on its own heartbeat.

## Operating Principle

Board stage is authoritative. The chat transcript is not.

Ticket-owner AI is the actor. Runtime scripts are tools for claim/state/evidence/finalization; they must not be the actor that implements, verifies, rebases, cherry-picks, resolves conflicts, or merges product code.

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

- one Plan AI (`planner-1`),
- one Impl AI (`owner-1`),
- one Wiki AI (`wiki-1`).

The three are path-disjoint and tick on the same 1-minute heartbeat without conflicting. Scale only after profiling shows the pipeline is starved — running multiple Impl AI instances increases worktree base drift / Allowed Paths conflicts and is intentionally serialized to one Impl AI in the default config. Legacy role-pipeline (`#plan`, `#todo`, `#veri`, `coordinator`, `merge-bot`) and the file-watcher are kept reachable for backwards compatibility but are not part of the default topology.

## Thread Coordination Rules

- One chat owns one active item.
- Do not claim a new ticket while an owned one is active.
- Do not keep critical state only in chat.
- Use `Resume Context` for restart safety.

## Non-Goals

- No automatic push.
- No hidden pass/fail.
- No implementation during spec handoff.
- No wiki-as-source-of-truth.

## Template Files

Heartbeat templates live under `automations/templates/` and can be rendered by `autoflow render-heartbeats`.
