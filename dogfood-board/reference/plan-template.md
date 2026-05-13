# Plan Template

## Plan

- ID: plan_NNN
- PRD Key: prd_NNN
- Title:
- Status: draft
- Created By:
- Last Updated:

Recommended status values:

- `draft`: planner is still shaping the plan.
- `ready`: runtime may generate tickets.
- `inprogress`: planner has claimed ticket generation.
- `ticketed`: tickets were generated.
- `done`: plan was archived.

## Goal

- 이 plan이 다루는 큰 목표를 한국어로 적는다.

## PRD References

- PRD:
- Feature PRD:

## Reference Notes

- Project Note:
- Plan Note:

## Scope

- In Scope: 이번 plan에 포함되는 범위를 한국어로 적는다.
- Out of Scope: 이번 plan에서 제외되는 범위를 한국어로 적는다.

## Execution Candidates

- [ ] 실행 가능한 후보 작업 1
- [ ] 실행 가능한 후보 작업 2
- [ ] 실행 가능한 후보 작업 3

## Ticket Rules

- Allowed Paths:
  - `path/to/file-or-folder`
- Ticket split notes: 티켓 분할 기준과 주의사항을 한국어로 적는다.

## Generated Tickets

- None yet.

## Notes

- Allowed Paths are repo-relative. During implementation they are interpreted from the ticket worktree root. If no worktree exists, they fall back to `PROJECT_ROOT`.
- Reference Notes use note names such as `[[prd_001]]` and `[[plan_001]]`.
- Human-readable plan prose should be Korean by default. Preserve parser-sensitive headings, field names, ids, project keys, paths, commands, code, and runtime formats.
