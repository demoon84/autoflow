# Order Intake

`tickets/order/` is the lightweight intake queue for requests captured after a user conversation. Intake does not decide whether PRD authoring is needed; the planner runner makes that call.

## File Names

- `order_*.md`, for example `order_001.md`.

## Rules

- Order skills and `autoflow order create` may write order files directly after an explicit order request.
- An order intake preserves the user's original request under `## Request`.
- Hints for scope, allowed paths, and verification are optional. The planner runner must make them concrete before implementation work is created.
- The planner runner treats order as implementation directives, infers concrete scope from repository context, and decides whether to create a generated `tickets/prd/prd_NNN.md` first or write a narrow direct TODO ticket. It archives the consumed order under `tickets/done/<project-key>/`.
- The planner runner does not turn order intake into a human-question loop. If a order is unsafe, leave a concrete refusal/blocker note; otherwise create implementation work with the safest narrow interpretation.
- The worker runner never claims directly from `tickets/order/`.
