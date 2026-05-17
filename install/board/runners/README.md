# Runners

Runners are local processes that consume Autoflow work.

A runner record may define:

- `id`,
- `role`,
- `agent`,
- `codex_history`,
- `model`,
- `reasoning`,
- `enabled`,
- `command`.

For Codex runners, `codex_history = "isolated"` keeps runner session files in
Autoflow's app data instead of the user's default Codex chat history. Use
`shared` only when a runner intentionally needs the default Codex history home.

Rules:

- `config.toml` is the tracked default topology. `autoflow runners set/add/remove` writes machine-local overrides to ignored `config.local.toml`; readers prefer `config.local.toml` when present.
- Runners are explicit PTY sessions. They start when a user or desktop automation starts them, then react to realtime wake messages; the board no longer stores `mode` or `interval_seconds` scheduling fields.
- Desktop may key live PTY sessions internally by `projectRoot + boardDirName + runnerId` so the same runner id can be open for multiple projects at once. Board-facing state files, wake events, logs, and CLI output still use the public runner id such as `planner`, `worker`, `verifier`, or `wiki`.
- Runner state is process state, not ticket state.
- Tickets remain authoritative.
- Active recovery fields (`active_recovery_reason`, `active_recovery_status`, `active_recovery_failure_class`) are display hints for the current runner tick. When planner recovery is about a resolved ticket worktree, state may also include `active_recovery_worktree_path`, `active_recovery_worktree_status`, and `active_recovery_board_state` so Desktop/CLI can show the cleanup target without deleting it.
- `last_result` should preserve the most recent meaningful runtime or adapter result such as `ticket_stage_blocked`, `planner_recovery_inputs_unchanged`, or `adapter_exit_0`.
- Logs and artifacts should be copied to `runners/logs/`.
- The 4-runner topology (planner + worker + verifier + wiki) is the default. `wiki` is the wiki runner. A coordinator role identifier may appear in old configs, but it is legacy evidence only and new boards must not add a coordinator runner.
- Runners are LLM-backed decision-makers. Runner tools are small deterministic commands those runners call for one safe board action.
- Never push from a runner.
