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
- Active recovery fields (`active_recovery_reason`, `active_recovery_status`, `active_recovery_failure_class`) are display hints for the current runner tick. When planner recovery is about a resolved ticket worktree, state may also include `active_recovery_worktree_path`, `active_recovery_worktree_status`, and `active_recovery_board_state` so Desktop/CLI can show the cleanup target without deleting it.
- In `loop` mode, `last_result` should preserve the most recent meaningful runtime or adapter result such as `ticket_stage_blocked`, `planner_recovery_inputs_unchanged`, or `adapter_exit_0`. The loop wrapper may only use `loop_waiting_exit_N` when there is no more specific result, or when the child process exits non-zero.
- `runners list` may derive a display `last_result` from recent runner log events when an older loop worker has only written `loop_waiting_exit_0`.
- Logs and artifacts should be copied to `runners/logs/`.
- The 3-runner topology (planner + worker + wiki) is the default. `wiki` (role=`wiki-maintainer`) is the wiki AI adapter; the older coordinator-as-wiki-bot fallback was removed in db8cc57. A coordinator runner remains reachable as legacy backwards-compat only.
- Never push from a runner.
