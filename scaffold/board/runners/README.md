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
- `watch`: react to file-watch events.

Rules:

- Runner state is process state, not ticket state.
- Tickets remain authoritative.
- Logs and artifacts should be copied to `runners/logs/`.
- The coordinator may also serve wiki-bot adapter turns; a separate `wiki-maintainer` runner is optional compatibility.
- Never push from a runner.
