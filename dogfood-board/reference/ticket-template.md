# Ticket Template

## Ticket

- ID:
- Project Key:
- Plan Candidate:
- Title:
- Stage: todo
- Owner: unassigned
- Claimed By: unclaimed
- Execution Owner: unassigned
- Verifier Owner: unassigned
- Last Updated:

## Goal

- 이번 작업의 목표:

## References

- Project Spec:
- Feature Spec:
- Plan Source:

## Obsidian Links

- Project Note:
- Plan Note:
- Ticket Note:

## Allowed Paths

- ...

## Worktree

- Path:
- Branch:
- Base Commit:
- Worktree Commit:
- Integration Status: pending_claim

## Done When

- [ ] ...
- [ ] ...

## Next Action

- 다음에 바로 이어서 할 일:

## Resume Context

- 현재 상태 요약:
- 직전 작업:
- 재개 시 먼저 볼 것:

## Notes

- ...

## Verification

- Run file:
- Log file:
- Result:

## Result

- Summary:
- Remaining risk:

## Path Notes

- `References` 는 `BOARD_ROOT` 상대 경로다.
- `Allowed Paths` 는 구현 worktree 루트 기준 상대 경로다. worktree 가 없으면 `PROJECT_ROOT` 기준이다.
- `Worktree` 는 todo claim 시 자동으로 채워진다. 보드는 중앙 `BOARD_ROOT` 를 유지하고, 제품 코드는 티켓별 worktree 에서 수정한다.
- `Obsidian Links` 는 note 이름 기준 (`[[project_001]]`, `[[plan_001]]`, `[[tickets_001]]`) 으로 적는다.
- `Plan Candidate` 는 plan 의 `Execution Candidates` 에 있던 문구를 **글자 그대로** 옮긴다. 중복 ticketing 감지에 쓰이므로 agent 가 Title 이나 Goal 을 다듬더라도 이 필드는 건드리지 않는다. Title / Goal / Done When / Verification 은 spec 맥락을 반영해 풍부하게 작성해도 된다.
