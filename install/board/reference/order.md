# Order Intake

`tickets/order/` is the lightweight intake queue for requests captured after a user conversation. Ordinary order intake feeds generated PRD work first; detailed TODO tickets come from the PRD-to-ticket flow.

## File Names

- `order_*.md`, for example `order_001.md`.

## Rules

- Order skills and `autoflow order create` may write order files directly after an explicit order request.
- An order intake preserves the user's original request under `## Request`.
- Hints for scope, allowed paths, and verification are optional. The planner runner must make them concrete before implementation work is created.
- Use `reference/order-template.md` for direct order writes. Ordinary orders must not contain `## Done When` or final acceptance checklists; use `## Planner Hints` for non-authoritative evidence and let the generated PRD/Todo own acceptance criteria.
- The planner runner treats orders as implementation directives, gathers repository/wiki evidence, and creates generated `tickets/prd/prd_NNN.md` work with assumptions, scope, unknowns, acceptance criteria, and verification notes. It archives the consumed order under the relevant `tickets/done/` evidence folder.
- One order may generate multiple PRDs when the request has independent outcomes, modules, release boundaries, or verification paths. Use `## PRD Split Map` to make the fan-out explicit; otherwise the planner runner may keep the order as one generated PRD.
- The planner runner does not turn order intake into a human-question loop. Missing detail is captured in the generated PRD, not left as `blocked`, `needs-info`, or `needs_user`. If an order is unsafe, leave a concrete refusal/blocker note; otherwise create the PRD with the safest bounded interpretation.
- Direct TODO from an order is reserved for an explicitly requested, single-file, mechanically obvious change.
- The worker runner never claims directly from `tickets/order/`.
