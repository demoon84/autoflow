# Backlog

`tickets/backlog/` is the queue for approved PRDs.

## Templates

- `reference/project-spec-template.md`
- `reference/feature-spec-template.md`

## Rules

- Autoflow skill handoff (`/af`, `/autoflow`, `$af`, `$autoflow`) and compatibility aliases (`#af`, `#autoflow`) may create or update one `prd_NNN.md` only after explicit user approval.
- Ticket Owner consumes populated PRDs directly.
- Legacy planner may convert populated specs into plans and todo tickets.
- A consumed PRD moves to `tickets/done/<project-key>/`.
- Generated plans, tickets, verification records, and logs should link back with `## Obsidian Links`.
