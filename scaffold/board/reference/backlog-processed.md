# Processed Backlog

Older Autoflow versions used `tickets/backlog/processed/` for consumed specs.

Current rules:

- Ticket Owner moves consumed specs to `tickets/done/<project-key>/`.
- Legacy planner also archives consumed specs under `tickets/done/<project-key>/`.
- Upgrade scripts migrate old processed specs into the done project folder.
- New boards should not create this folder.
