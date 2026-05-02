# Memo Inbox

`tickets/inbox/` is the lightweight intake queue for small requests that do not deserve a full PRD handoff.

## File Names

- `order_NNN.md`, for example `order_001.md`.

## Rules

- Memo skills and `autoflow order create` may write order files directly after an explicit order request.
- A order preserves the user's original request under `## Request`.
- Hints for scope, allowed paths, and verification are optional. Plan AI must make them concrete before implementation work is created.
- Plan AI treats orders as implementation directives, infers concrete scope from repository context, promotes them into generated `tickets/backlog/prd_NNN.md`, reruns the planner runtime to create a todo ticket, and archives the consumed order under `tickets/done/<project-key>/`.
- Plan AI does not turn order intake into a human-question loop. If a order is unsafe, leave a concrete refusal/blocker note; otherwise create implementation work with the safest narrow interpretation.
- Impl AI never claims directly from `tickets/inbox/`.
