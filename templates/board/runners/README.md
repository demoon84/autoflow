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

