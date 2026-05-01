---
name: autoflow
description: Use when the user says "#autoflow", invokes "/autoflow", or wants to hand off requirements into one or more Autoflow backlog PRDs for later Plan AI to Impl AI execution.
---

# Autoflow PRD Handoff

When triggered, act as the Autoflow PRD handoff entry point.

## Rules

1. Treat `#autoflow` and `/autoflow` as PRD handoff triggers.
2. If the current project has `CLAUDE.md`, `AGENTS.md`, `.autoflow/AGENTS.md`, or `.autoflow/agents/spec-author-agent.md`, read the relevant files before drafting.
3. Hold a free-form conversation to collect the user's goal, scope, affected modules, allowed paths, acceptance criteria, and verification command. Use short questions and bullet recaps — do **not** render the PRD template every turn.
4. If the scope spans multiple independent outcomes, modules, releases, risk areas, or verification paths, propose a lightweight PRD split map before drafting.
5. **Do not produce the full PRD draft until the user issues an explicit draft trigger** such as `초안`, `초안 작성`, `초안 보여줘`, `정리해줘`, `draft`, `draft prd`, `show draft`, or an equivalent clear request.
6. When the draft trigger fires, render the complete PRD once based on the information gathered so far. For split work, render each PRD draft separately and include sibling references in `Conversation Handoff` or `Notes`. Mark anything still unknown as `TBD` / `미정` rather than guessing.
7. Save only after a separate explicit save confirmation such as `save`, `저장`, `confirm`, `approved`, or `ready`. A draft trigger is **not** save approval. Multiple drafts need per-PRD approval or a clear `save all` / `전부 저장` confirmation.
8. Save only backlog PRDs. Do not create plans, tickets, code changes, verification records, commits, or pushes.
9. Prefer `autoflow spec create <project-root> <board-dir-name> --from-file <draft-file> --raw --save-handoff` when the CLI is available. Otherwise write approved markdown to `.autoflow/tickets/backlog/prd_NNN.md`. For multiple PRDs, save separate `prd_NNN.md` files one active slot at a time.
10. After saving, tell the user the saved path(s), intended order when relevant, and that `planner-1` or `autoflow run planner` will turn the PRD into todo work before `owner-1` / `autoflow run ticket` implements it.

If no Autoflow board is found, explain that the project needs an Autoflow board first and offer `autoflow init <project-root>` or the desktop install flow.
