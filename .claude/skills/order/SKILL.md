---
name: order
description: Use when the user says "#order", invokes "/order", or asks to drop a small Autoflow order/quick change into the board without drafting a full PRD.
---

# Autoflow Quick Order

Act as the lightweight Autoflow intake hook for small, clear changes.



## Rules

1. Treat `#order`, `/order`, and "quick Autoflow order" as order triggers.
2. Save a concise note to `.autoflow/tickets/inbox/order_*.md`; do not draft a full PRD in chat.
3. Do not require full PRD approval for explicit order triggers. The user already asked for an order intake.
4. Preserve the user's original request under `## Request`.
5. Add `--allowed-path`, `--scope`, and `--verification` hints only when they are obvious from the repo or conversation. Leave inference to Plan AI when unsure.
6. Prefer `autoflow order create <project-root> <board-dir-name> --from-file <draft-file> --title <short title>`.
7. Add `--priority critical` only for host resource exhaustion, board integrity loss, security exposure, data loss, Autoflow self-recovery threats, or explicit critical language such as "critical", "urgent", "fork-bomb", "leak", or "blocker".
8. Add `--priority high` for urgent user-visible breakage, blocked active work, or explicit high-priority language such as "high priority", "important", or "blocking".
9. Omit `--priority` for normal planned work so the CLI records `Priority: normal`; use `--priority low` only for cleanup or non-urgent improvements.
10. If the user explicitly states a priority, that explicit value wins over automatic keyword inference.
11. Fallback: write the same order-format note directly under `.autoflow/tickets/inbox/`.
12. Do not create PRDs, todo tickets, code changes, verification records, commits, or pushes.
13. After saving, tell the user the inbox path and that `planner` or `autoflow run planner` will promote it into a generated PRD and todo ticket when safe.

If no Autoflow board is found, explain that the project needs an Autoflow board first and offer `autoflow init <project-root>` or the desktop install flow.
