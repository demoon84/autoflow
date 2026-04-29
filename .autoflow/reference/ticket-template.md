# Ticket Template

## Ticket

- ID: tickets_NNN
- PRD Key: prd_NNN
- Plan Candidate:
- Title:
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated:

## Goal

- 이 티켓이 달성해야 하는 구체적 목표를 한국어로 적는다.

## References

- PRD:
- Feature PRD:
- Plan:

## Obsidian Links

- Project Note:
- Plan Note:
- Ticket Note:

## Allowed Paths

- `path/to/file-or-folder`

## Worktree

- Branch:
- Path:
- Base:
- Created At:

## Done When

- [ ] 명령, UI 관찰, 또는 파일 검토로 확인할 수 있는 완료 조건.
- [ ] 사용자에게 보이는 동작 또는 시스템에 보이는 결과가 기대와 일치한다.

## Next Action

- 다음에 바로 실행할 작업을 한국어로 적는다.

## Resume Context

- Current state: 현재 상태를 한국어로 적는다.
- Last completed action: 마지막으로 끝낸 작업을 한국어로 적는다.
- First thing to inspect on resume: 재개 시 먼저 확인할 대상을 한국어로 적는다.

## Notes

- Mini-plan: 구현 전 짧은 계획을 한국어로 적는다.
- Progress: 진행 상황과 관련 wiki/ticket 참고를 한국어로 적는다.

## Verification

- Command: `command-to-run`
- Run file:
- Result:

## Result

- Summary: 결과 요약을 한국어로 적는다.
- Commit:

## Path Notes

- `References` are relative to `BOARD_ROOT`.
- `Allowed Paths` are relative to the implementation worktree root. If no worktree exists, they fall back to `PROJECT_ROOT`.
- `Worktree` is filled during claim when a worktree is available.
- `Obsidian Links` use note names such as `[[prd_001]]`, `[[plan_001]]`, and `[[tickets_001]]`.
- `Plan Candidate` must copy the exact candidate text from `Execution Candidates`. It is a duplicate-detection key.
- Human-readable ticket prose should be Korean by default. Preserve parser-sensitive headings, field names, ids, project keys, paths, commands, code, and runtime formats.
