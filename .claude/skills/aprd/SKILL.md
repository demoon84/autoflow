---
name: aprd
description: Use when the user says "#aprd", invokes "/aprd", or wants to hand off requirements into one or more Autoflow PRD queue items for later planner-runner to worker-runner execution.
---

# Autoflow PRD Handoff

When triggered, act as the Autoflow PRD handoff entry point.

## Lookup Before Drafting

Before drafting any PRD content, surface relevant prior work so the new PRD references and reuses existing decisions instead of contradicting them.

1. Identify 1–3 distinctive keywords from the user's stated goal/scope (feature noun, module name, file path, etc.).
2. Run, best-effort (any error → treat as "no hits", continue):
   - `autoflow origin search "<keyword>"` — past PRDs and resulting commits.
   - `autoflow wiki query --term "<keyword>" --rag --limit 3` — prior decisions, learnings, failed/retried approaches, and related done-ticket context. Use multiple `--term` flags when you have multiple strong keywords.
3. If hits return, briefly summarize origin and wiki findings in Korean and ask whether to:
   (a) extend an existing PRD, (b) split into a new sibling PRD with cross-references, or (c) supersede prior work (note in `Conversation Handoff`).
4. Use relevant wiki findings as design constraints when shaping scope, risks, `Allowed Paths`, acceptance criteria, and verification hints. Cite useful wiki/ticket references in `Conversation Handoff` or `Notes` when the draft proceeds.
5. Then proceed with the conversation phase. Do NOT block PRD drafting on lookup failure.

## Rules

1. Treat `#aprd` and `/aprd` as PRD handoff triggers. Small, single-file mechanical changes belong in `/atodo` (direct todo) — use this skill only when the work needs planner-driven slicing or genuine scope discussion.
2. If the current project has `CLAUDE.md`, `AGENTS.md`, `{{BOARD_DIR}}/AGENTS.md`, or `{{BOARD_DIR}}/agents/spec-author-agent.md`, read the relevant files before drafting.
3. Hold a free-form conversation to collect the user's goal, scope, affected modules, allowed paths, acceptance criteria, and verification command. Use short questions and bullet recaps — do **not** render the PRD template every turn.
4. If the scope spans multiple independent outcomes, modules, releases, risk areas, or verification paths, propose a lightweight PRD split map before drafting.
5. **Do not produce the full PRD draft until the user issues an explicit draft trigger** such as `초안`, `초안 작성`, `초안 보여줘`, `정리해줘`, `draft`, `draft prd`, `show draft`, or an equivalent clear request.
6. When the draft trigger fires, render the complete PRD once based on the information gathered so far. For split work, render each PRD draft separately and include sibling references in `Conversation Handoff` or `Notes`. Mark anything still unknown as `TBD` / `undecided` rather than guessing.
7. Save only after a separate explicit save confirmation such as `save`, `저장`, `confirm`, `approved`, or `ready`. A draft trigger is **not** save approval. Multiple drafts need per-PRD approval or a clear `save all` / `전부 저장` confirmation.
8. Save only PRD queue items. Do not create todo tickets, code changes, verification records, commits, or pushes.
9. Prefer `autoflow spec create <project-root> <board-dir-name> --from-file <draft-file> --raw --save-handoff` when the CLI is available. Otherwise write approved markdown to `{{BOARD_DIR}}/tickets/prd/prd_NNN.md`. For multiple PRDs, save separate `prd_NNN.md` files one active slot at a time.
10. After saving, tell the user the saved path(s), intended order when relevant, and that the planner runner (`autoflow run planner`) will turn each PRD into one or more todo tickets before the worker runner continues through desktop PTY or focused worker startup/tool flow (`autoflow run worker`, alias `autoflow run ticket`).
11. Write canonical PRD prose in Korean by default. If the conversation is not in Korean, preserve exact user wording only where required and write the PRD's problem, goal, scope, acceptance criteria, handoff, and notes in Korean.

## PRD Draft Template

When the draft trigger fires, render PRDs in this exact shape. The PRD is the first authoritative place for scope, assumptions, acceptance criteria, and verification intent. Todo tickets are planner-owned (or `/atodo`-owned for direct simple work) and must not be written by this skill.

```md
# PRD prd_NNN: <title>

## Project

- ID: prd_NNN
- Title: <title>
- AI: <authoring agent>
- Status: draft
- Priority: normal
- Change Type: code | docs | cleanup | infra
- Requires Secrets: []

## Source

- Origin: conversation
- User Request: "<short preserved request summary>"
- Related Work: <wiki/ticket references, or none>

## Problem

<what is wrong, missing, confusing, or requested>

## Goal

<the outcome this PRD must make possible>

## Scope

- In Scope: <included behavior/modules/docs>
- Out of Scope: <excluded behavior/modules/docs>
- Assumptions: <explicit assumptions>
- Remaining Unknowns: <unknowns that do not block ticket creation>

## Main Screens / Modules

- Module: <screen, module, command, or document area>
- Path: `path/to/file-or-folder`

## Allowed Paths

- path/to/file-or-folder

## Global Acceptance Criteria

- [ ] <observable criterion grounded in command output, UI observation, or file review>
- [ ] <observable criterion with concrete paths, states, examples, exit codes, or numeric signals>
- [ ] <related regression/reset/error condition>

## Verification

- Command: <repo-relative command or none-shell>
- Notes: <verification scope, manual checks, browser checks, or evidence expectations>

## Conversation Handoff

- Source: conversation
- Summary: <short English handoff for the next runner>

## Notes

- <constraints, risks, split/follow-up notes, related wiki/ticket references>
```

If no Autoflow board is found, explain that the project needs an Autoflow board first and offer `autoflow init <project-root>` or the desktop install flow.
