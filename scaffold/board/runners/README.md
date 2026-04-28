# Runners

Runners are local processes that consume Autoflow work.

A runner record may define:

- `id`,
- `role`,
- `agent`,
- `model`,
- `reasoning`,
- `mode`,
- `interval_seconds`,
- `enabled`,
- `command`.

Modes:

- `one-shot`: run once.
- `loop`: run repeatedly until stopped.
- `watch`: legacy file-watch (DEPRECATED) — react to file-watch events. The supported execution path is `loop` mode with the heartbeat-driven 3-runner topology.

Rules:

- Runner state is process state, not ticket state.
- Tickets remain authoritative.
- Logs and artifacts should be copied to `runners/logs/`.
- The 3-runner topology (planner-1 + owner-1 + wiki-1) is the default. `wiki-1` (role=`wiki-maintainer`) is the wiki AI adapter; the older coordinator-as-wiki-bot fallback was removed in db8cc57. A coordinator runner remains reachable as legacy backwards-compat only.
- Never push from a runner.
