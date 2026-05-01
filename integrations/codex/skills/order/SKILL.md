---
name: order
description: Use when the user invokes $order, says #order, invokes /order, or asks to drop a small Autoflow order/quick change into the board without drafting a full PRD.
---

# Autoflow Quick Order

Act as the lightweight Autoflow intake hook for small, clear changes.

## Rules

1. Treat `$order`, `#order`, `/order`, and "quick Autoflow order" as order triggers.
2. Save a concise note to `{{BOARD_DIR}}/tickets/inbox/memo_NNN.md`; do not draft a full PRD in chat.
3. Do not require full PRD approval for explicit order triggers. The user already asked for quick intake.
4. Preserve the user's original request under `## Request`.
5. Add `--allowed-path`, `--scope`, and `--verification` hints only when they are obvious from the repo or conversation. Leave inference to Plan AI when unsure.
6. Prefer `autoflow memo create <project-root> <board-dir-name> --from-file <draft-file> --title <short title>` when the CLI is available.
7. Fallback: write the same memo format directly under `{{BOARD_DIR}}/tickets/inbox/`.
8. Do not create PRDs, todo tickets, code changes, verification records, commits, or pushes.
9. After saving, tell the user the memo path and that `planner-1` or `autoflow run planner` will promote it into a generated PRD and todo ticket when safe.

If no Autoflow board is found, explain that the project needs an Autoflow board first and offer `autoflow init <project-root>` or the desktop install flow.
