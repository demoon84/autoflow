---
name: atodo
description: Use when the user says "#atodo", invokes "/atodo", or asks to drop a small, clear Autoflow task directly into tickets/todo/ without drafting a full PRD.
---

# Autoflow Direct Todo Intake

Act as the lightweight Autoflow intake hook for small, clear changes that a worker runner can claim immediately. You write a complete Todo ticket directly under `{{BOARD_DIR}}/tickets/todo/TODO-NNN.md`. There is no PRD step.

## Lookup Before Saving

Before writing the todo, surface relevant prior work so the user can build on past decisions instead of re-doing them.

1. Identify 1–3 distinctive keywords from the user's request: feature noun, file path basename, error string, UI element name, etc.
2. Run, best-effort (any error → treat as "no hits", continue):
   - `autoflow origin search "<keyword>"` — past PRDs/todos matching prompt, prd_path, ticket title, or commit subject.
   - `autoflow wiki query --term "<keyword>" --rag --limit 3` — prior decisions, learnings, failed/retried approaches, and related done-ticket context. Use multiple `--term` flags when you have multiple strong keywords.
3. If non-trivial hits return, briefly summarize origin and wiki findings in Korean to the user:
   "비슷한 과거 작업: prd_142 (...), Todo-088 (...). 그대로 발행할까요?"
4. Use relevant wiki findings to tighten the obvious `--allowed-path`, `--done`, `--verification` hints.
5. Proceed to save the todo regardless of lookup outcome — the user's intent is the source of truth, lookup only highlights duplicates or relevant context.

Skip lookup for very short requests (≤ 8 chars) where keywords are unreliable.

## When to Use This Skill vs `/aprd`

- `/atodo`: single, narrow, mechanically obvious change with a clear `Allowed Paths` boundary and concrete `Done When`. Worker runner can claim it on the next tick.
- `/aprd`: anything that needs scope discussion, multi-file slicing, an explicit `## Out of Scope`, or splits into multiple PRDs/tickets. Refer the user to `/aprd` if scope is genuinely unclear.

## Rules

1. Treat `#atodo`, `/atodo`, and "quick Autoflow todo" as direct-todo triggers.
2. Save a complete worker-claimable ticket to `{{BOARD_DIR}}/tickets/todo/TODO-NNN.md` — never leave required fields empty or as `TBD`.
3. Required fields a worker depends on: `Title`, `Goal`, `Allowed Paths` (concrete repo-relative), `Done When` (≥ 2 observable items), `Verification.Command` (either a real command or `none-shell` with a file-review note).
4. Preserve the user's original request verbatim under `## Notes` (one bullet starting with `User request: ...`). If the user explicitly bounded scope, mirror that in `Done When` or `Allowed Paths`, not as a separate `Out of Scope` section.
5. Add `Priority: critical` only for host resource exhaustion, board integrity loss, security exposure, data loss, Autoflow self-recovery threats, or explicit critical language. `Priority: high` only when the user *explicitly* asks for priority in this turn. Otherwise `Priority: normal`. Use `low` only for non-urgent cleanup.
6. Prefer `autoflow todo create <project-root> <board-dir-name> --title "<title>" --allowed-path <path>... --done "<item>"... --verification "<cmd>"` when the CLI is available. The CLI assigns the next free `TODO-NNN` id atomically. If you must write the file directly, derive the next id by scanning `tickets/`-wide for the highest `TODO-NNN` and incrementing.
7. Do not create PRDs, code changes, verification records, commits, or pushes.
8. Write canonical todo prose in Korean. Parser-sensitive fields, paths, commands, and ids stay in their required format.
9. After saving, tell the user the saved TODO-NNN path and that the worker runner (`autoflow run worker`) will claim it on the next tick.

## Direct Todo Template

Use this exact shape when writing a todo directly. Every section below is required for worker claim.

```md
# Ticket

## Ticket

- ID: TODO-NNN
- PRD Key:
- PRD Slice: 1/1
- Plan Candidate: atodo direct intake
- Title: <short title>
- Priority: normal
- Change Type: code | docs | cleanup | infra
- Stage: todo
- AI: atodo
- Claimed By:
- Execution AI:
- Verifier Runner:
- Last Updated:

## Goal

- <one-sentence implementation goal a worker can act on>

## References

- PRD:
- Feature Spec:
- Plan Source: atodo-direct

## Reference Notes

- Project Note:
- Plan Note:
- Ticket Note: [[TODO-NNN]]

## Allowed Paths

- path/to/file-or-folder

## Worktree

- Path:
- Branch:
- Base Commit:
- Worktree Commit:
- Integration Status: pending_claim

## Goal Runtime

- Status:
- Started At:
- Started Epoch:
- Updated At:
- Tick Count: 0
- Token Budget:
- Tokens Used:
- Continuation Suppressed: false
- Last Event:
- Last Progress Fingerprint:
- Iteration Fingerprints: []
- Last Lint Status:
- Last Lint Vagueness Score:

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Worker Resume Instruction:
- Last Recovery At:

## Done When

- [ ] <Allowed Paths 안의 변경이 "Goal" 결과를 반영한다>
- [ ] <검증 명령이 exit 0으로 끝나거나, none-shell이면 파일 검토 근거가 기록된다>
- [ ] <최종 diff가 Allowed Paths 밖의 파일을 포함하지 않는다>

## Next Action

- 워커 러너가 claim 후 mini-plan을 작성하고 Allowed Paths 안에서 구현, 검증, 검증 러너 handoff까지 진행한다.

## Resume Context

- Current state: atodo가 직접 등록한 todo ticket이다.
- Last completed action: atodo skill이 이 ticket을 작성했다.
- First thing to inspect on resume: Goal, Allowed Paths, Done When.

## Notes

- User request: <preserve the user's original wording verbatim>
- <optional risk / assumption / related wiki ref>

## Verification

- Command: <real command or none-shell>
- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
```

If no Autoflow board is found, explain that the project needs an Autoflow board first and offer `autoflow init <project-root>` or the desktop install flow.
