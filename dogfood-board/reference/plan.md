# Plans

`tickets/plan/` stores legacy role-pipeline plans.

## Templates

- `reference/plan-template.md`
- `reference/roadmap.md`

## Rules

- The legacy planner reads `tickets/backlog/` and creates or updates `plan_NNN.md`.
- When ticket generation starts, the plan moves to `tickets/inprogress/plan_NNN.md`.
- When tickets are generated, the plan and PRD move to `tickets/done/<project-key>/`.
- Reject reasons may be folded into plans as new execution candidates.
- PRD handoff and Ticket Owner work should not edit this folder unless legacy mode is requested.
