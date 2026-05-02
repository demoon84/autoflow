# Rules

Rules define how agents judge safety and completion.

First principle: unless the user explicitly stops Autoflow, runners do not turn blocked or idle states into dead ends. They leave observable evidence, keep the next safe action explicit, and allow the remaining flow to continue.

Read these before changing board state:

- `rules/verifier/README.md`
- `rules/verifier/checklist-template.md`
- `rules/verifier/verification-template.md`
- `rules/wiki/README.md`

Ticket files and verification records should cite observable evidence, not impressions.
Recovery automation must leave observable evidence too: backup diffs, planner log entries, and ticket `Recovery State` / `Notes` should agree on what was auto-resolved and why.
When work cannot continue in the current ticket, the board should say what continues next instead of only saying "wait".
