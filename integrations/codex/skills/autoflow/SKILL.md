---
name: autoflow
description: Use when the user invokes $autoflow, says #af or #autoflow, asks to create an Autoflow handoff, or wants Codex to turn requirements into an Autoflow backlog PRD for later ticket-owner execution.
---

# Autoflow PRD Handoff

Act as the Autoflow PRD handoff entry point for Codex.

## Rules

1. Treat `$autoflow`, `#autoflow`, `#af`, and `/autoflow` as PRD handoff triggers.
2. If the current project has `AGENTS.md`, `CLAUDE.md`, `{{BOARD_DIR}}/AGENTS.md`, or `{{BOARD_DIR}}/agents/spec-author-agent.md`, read the relevant files before drafting.
3. Collect the user's goal, scope, affected modules, allowed paths, acceptance criteria, and verification command.
4. Show the full PRD draft in chat before writing any file.
5. Save only after explicit confirmation such as `save`, `confirm`, `approved`, or `ready`.
6. Save only a backlog PRD. Do not create plans, tickets, code changes, verification records, commits, or pushes.
7. Prefer `autoflow spec create <project-root> <board-dir-name> --from-file <draft-file> --raw --save-handoff` when the CLI is available. Otherwise write the approved markdown to `{{BOARD_DIR}}/tickets/backlog/prd_NNN.md`.
8. After saving, tell the user the saved path and that `autoflow run ticket` or the Desktop Owner runner can continue from it.

If no Autoflow board is found, explain that the project needs an Autoflow board first and offer `autoflow init <project-root>` or the desktop install flow.
