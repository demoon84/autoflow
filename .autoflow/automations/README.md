# Automations

Automations connect board folders to recurring workers, stop hooks, and file-watch hooks.

## Reference Model

Default model:

- Claude `/af` / `/autoflow`, Codex `$af` / `$autoflow`, or `#af` / `#autoflow`: manual spec handoff, no heartbeat.
- `ticket-owner`: one runner owns mini-plan, implementation, verification judgment, AI-led merge, and finish.
- wiki managed sections are updated automatically when AI-led merge finalization runs.

Legacy role-pipeline model:

- `#plan`: planner heartbeat.
- `#todo`: todo implementation heartbeat.
- `#veri`: verifier heartbeat.

## Trigger Contract

Autoflow skill handoff (`/af`, `/autoflow`, `$af`, `$autoflow`) and compatibility aliases (`#af`, `#autoflow`):

- Draft the spec in chat first.
- Save only after explicit approval.
- Write only `tickets/backlog/project_NNN.md` and optional conversation handoff.
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

## File Watch Mode

File-watch hooks can dispatch work when board files change.

Typical routes:

- backlog changes -> ticket owner or legacy planner,
- todo changes -> ticket owner or legacy todo,
- verifier changes -> ticket owner or legacy verifier,
- done/reject changes -> planner follow-up when legacy retries are enabled.

Each hook dispatch should write a log under `logs/hooks/`.

## Hook Map

Recommended map:

- `tickets/backlog/`: `ticket` route by default.
- `tickets/todo/`: `ticket` route by default.
- `tickets/verifier/`: `ticket` route by default.
- `tickets/reject/`: legacy `plan` route if role-pipeline is enabled.
- `tickets/done/`: no separate wiki route is needed; AI-led merge finalization updates wiki managed sections automatically.

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

Small projects:

- one Ticket Owner runner,
- optional file watcher.

Larger projects:

- multiple Ticket Owner runners with unique worker IDs,
- legacy role-pipeline only when explicitly needed.

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
