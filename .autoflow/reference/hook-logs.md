# Hook Logs

`logs/hooks/` stores file-watch hook dispatch records.

Typical log name:

```text
hook_<route>_<timestamp>.md
```

Each log should record:

- triggering file event,
- selected route,
- dispatch mode,
- command or prompt summary,
- result and next action.

Hook logs are dispatch history. Ticket state still belongs in `tickets/`.
