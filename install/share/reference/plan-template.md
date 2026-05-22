# Plan 템플릿

## Plan

- ID: plan_NNN
- PRD Key: PRD-NNN
- Title:
- Status: draft
- Created By:
- Last Updated:

권장 status 값:

- `draft`: planner가 아직 plan을 다듬고 있다.
- `ready`: runtime이 ticket을 생성할 수 있다.
- `inprogress`: planner가 ticket generation을 claim했다.
- `ticketed`: ticket이 생성되었다.
- `done`: plan이 archive되었다.

## Goal

- 이 plan이 다루는 더 큰 goal을 적는다.

## PRD References

- PRD:
- Feature PRD:

## Reference Notes

- Project Note:
- Plan Note:

## Scope

- In Scope: 이 plan에 포함되는 범위를 적는다.
- Out of Scope: 이 plan에서 제외되는 범위를 적는다.

## Execution Candidates

- [ ] 실행 가능한 candidate task 1.
- [ ] 실행 가능한 candidate task 2.
- [ ] 실행 가능한 candidate task 3.

## Ticket 규칙

- Allowed Paths:
  - `path/to/file-or-folder`
- Ticket split notes: split 기준과 주의사항을 적는다.

## Generated Tickets

- 아직 없음.

## Notes

- Allowed Paths는 repo-relative다. 구현 중에는 ticket worktree root 기준으로 해석한다. Worktree가 없으면 `PROJECT_ROOT` 기준으로 fallback한다.
- Reference Notes는 `[[PRD-001]]`, `[[plan_001]]` 같은 note name을 쓴다.
- 사람이 읽는 plan 본문은 기본적으로 한국어로 쓴다. Parser-sensitive heading, field name, id, project key, path, command, code, runtime format은 보존한다.
