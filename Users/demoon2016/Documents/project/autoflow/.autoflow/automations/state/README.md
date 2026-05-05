# Automation State

Runtime state for heartbeats and stop hooks.

Rules:

- `threads/<thread-key>.context` stores per-thread role and worker identity.
- `current.context` is a fallback when no thread ID is available.
- Prefer `set-thread-context.*` and `clear-thread-context.*` over manual edits.
- Ticket Owner, legacy todo, and legacy verifier clear active ticket context at tick end but may keep role/worker context.
- Resume from tickets, references, logs, and `Resume Context`, not from chat history.
