# Runners

`runners/` stores local runner configuration, state, and process logs.

Runner files describe process state only. Ticket state remains in `tickets/`.

Suggested layout:

```text
runners/
  config.toml
  state/
  logs/
```

