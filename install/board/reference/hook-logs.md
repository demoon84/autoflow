# Hook Logs (DEPRECATED — legacy file-watch path)

`logs/hooks/` stores file-watch hook dispatch records produced by
`watch-board.*` -> `run-hook.*`. The file-watch trigger path is
DEPRECATED in favor of the realtime-wake 4-runner topology
(planner + worker + verifier + wiki); these logs only appear when a user
explicitly runs `autoflow watch-bg`. PTY runners log to `runners/logs/`
instead.

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
