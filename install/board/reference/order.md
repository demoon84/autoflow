# Order Intake

`tickets/order/` is the lightweight intake queue for requests captured after a user conversation. Ordinary order intake feeds a generated PRD first; the detailed TODO comes from the PRD-to-ticket flow.

## File Names

- `order_*.md`, for example `order_001.md`.

## Rules

- Order skills and `autoflow order create` may write order files directly after an explicit order request.
- An order intake preserves the user's original request under `## Request`.
- Hints for scope, allowed paths, and verification are optional. The planner runner must make them concrete before implementation work is created.
- The planner runner treats orders as implementation directives, gathers repository/wiki evidence, and creates a generated `tickets/prd/prd_NNN.md` with assumptions, scope, unknowns, acceptance criteria, and verification notes. It archives the consumed order under `tickets/done/<project-key>/`.
- The planner runner does not turn order intake into a human-question loop. Missing detail is captured in the generated PRD, not left as `blocked`, `needs-info`, or `needs_user`. If an order is unsafe, leave a concrete refusal/blocker note; otherwise create the PRD with the safest bounded interpretation.
- Direct TODO from an order is reserved for an explicitly requested, single-file, mechanically obvious change.
- The worker runner never claims directly from `tickets/order/`.
