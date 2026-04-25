# Runners

`runners/` stores local runner configuration, state, and logs.

Autoflow runners are local processes assigned to a role such as planner, todo,
verifier, wiki-maintainer, or watcher. A runner consumes one board item at a
time and records enough state for the desktop app and the next heartbeat to
resume safely.

Suggested layout:

```text
runners/
  config.toml
  state/
  logs/
```

`tickets/` remains the source of truth for work state. Runner files describe
process state only.

`config.toml` uses a small `[[runners]]` subset:

- `id`: stable runner id, for example `todo-1`
- `role`: `planner`, `todo`, `verifier`, `wiki-maintainer`, or `watcher`
- `agent`: `shell`, `manual`, `codex`, `claude`, `opencode`, or `gemini`
- `model`: optional model name passed to local agent adapters
- `reasoning`: optional reasoning profile passed to local agent adapters
- `mode`: `one-shot`, `loop`, or `watch`
- `interval_seconds`: loop delay in seconds when `mode=loop`
- `enabled`: `true` or `false`
- `command`: optional adapter command override

Runtime state files use key/value snapshots under `state/<runner-id>.state`.
Lifecycle diagnostics append to `logs/<runner-id>.log`.
For `mode=loop`, `autoflow runners start` launches a background loop that calls
`autoflow run` repeatedly until `autoflow runners stop` terminates the stored
PID. `interval_seconds` controls the delay between loop ticks. Direct
`autoflow run` remains a one-shot command.
`autoflow runners list` emits `runner.N.command_preview` so the desktop app and
CLI users can inspect the effective local command before starting a runner.
The same listing also exposes `artifact_status`, per-artifact status fields,
`last_runtime_log`, `last_prompt_log`, `last_stdout_log`, and
`last_stderr_log` when a runner has recorded execution artifacts.
`autoflow doctor` checks these artifact pointers when present and warns if a
stored path is missing or outside the board root.

Use the package CLI to change this file:

- `autoflow runners add <runner-id> <role>`
- `autoflow runners remove <runner-id>`
- `autoflow runners set <runner-id> key=value...`
- `autoflow runners artifacts <runner-id>`
