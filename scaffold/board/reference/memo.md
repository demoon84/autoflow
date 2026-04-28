# Memo Inbox

`tickets/inbox/` is the lightweight intake queue for small requests that do not deserve a full PRD handoff.

## File Names

- `memo_NNN.md`, for example `memo_001.md`.

## Rules

- Memo skills and `autoflow memo create` may write memo files directly after an explicit memo request.
- A memo preserves the user's original request under `## Request`.
- Hints for scope, allowed paths, and verification are optional. Plan AI must make them concrete before implementation work is created.
- Plan AI treats memos as implementation directives, infers concrete scope from repository context, promotes them into generated `tickets/backlog/prd_NNN.md`, reruns the planner runtime to create a todo ticket, and archives the consumed memo under `tickets/done/<project-key>/`.
- Plan AI does not turn memo intake into a human-question loop. If a memo is unsafe, leave a concrete refusal/blocker note; otherwise create implementation work with the safest narrow interpretation.
- Impl AI never claims directly from `tickets/inbox/`.
