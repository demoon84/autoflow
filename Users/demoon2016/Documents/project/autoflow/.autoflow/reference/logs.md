# Logs

`logs/` stores completion and hook logs.

Verifier log naming:

```text
verifier_<ticket-id>_<timestamp>_<outcome>.md
```

Rules:

- Write a log after pass and fail.
- Keep the final verification record beside the final ticket.
- Use logs for quick audit summaries, not as the source of truth.
- Hook dispatch logs live under `logs/hooks/`.
