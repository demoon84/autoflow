# Runner Harness

Autoflow runners are local processes that consume board queues.

The board stores what should happen. A runner performs the next step for one
role:

- planner: spec and reject queue to plans and tickets
- todo: todo ticket to implementation and verifier handoff
- verifier: verifier ticket to pass or reject
- wiki-maintainer: done/reject/logs to wiki pages
- watcher: filesystem event to role wake-up

Runner process state belongs in `runners/`. Work state belongs in `tickets/`.

