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

## Reference Notes

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

## Goal Runtime

- Status:
- Started At:
- Started Epoch:
- Updated At:
- Tick Count: 0
- Time Used Seconds: 0
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
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [ ] 명령/증거로 확인한 완료 조건을 충족했는지를 표시한다.
- [ ] 충족된 항목은 `[x]`, 미충족/미실행 항목은 `[ ]`으로 남기고, ticket 문서 자체가 최종 상태 증거로 보존된다.

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
- `Reference Notes` use note names such as `[[prd_001]]`, `[[plan_001]]`, and `[[tickets_001]]`.
- `Plan Candidate` must copy the exact candidate text from `Execution Candidates`. It is a duplicate-detection key.
- Human-readable ticket prose should be Korean by default. Preserve parser-sensitive headings, field names, ids, project keys, paths, commands, code, and runtime formats.
