# Ticket 템플릿

## Ticket

- ID: TODO-NNN
- PRD Key: PRD-NNN
- Plan Candidate:
- Title:
- Priority: normal
- Change Type: code
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier Runner:
- Last Updated:

## Goal

- 이 ticket이 달성해야 하는 구체적인 goal을 적는다.

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
- Token Budget:
- Tokens Used:
- Continuation Suppressed: false
- Last Event:
- Last Progress Fingerprint:
- Iteration Fingerprints: []
- Last Lint Status:
- Last Lint Vagueness Score:

## Done When

- [ ] Command output 또는 evidence로 completion condition 충족 여부를 표시한다.
- [ ] 충족된 항목은 `[x]`로 표시하고, 미충족 또는 미실행 항목은 `[ ]`로 남긴다. Ticket document는 final state evidence로 보존된다.

## Priority 기준

- 기본값은 `normal`이다.
- `high`는 사용자가 해당 ticket이 다른 작업을 막는다고 명시했거나 urgent/긴급/최우선/blocking이라고 부른 경우에만 쓴다.
- 중요한 기능, 마이그레이션 후속, scope 확장, 일반 follow-up만으로는 `high`가 아니다.
- `critical`은 보드 무결성 손상, 보안 노출, 실행 환경 고갈처럼 즉시 복구가 필요한 장애에만 쓴다.

## Next Action

- 다음 구체적 작업을 적는다.

## Resume Context

- Current state: 현재 상태를 적는다.
- Last completed action: 마지막으로 완료한 작업을 적는다.
- First thing to inspect on resume: 재개 시 먼저 확인할 파일, 명령, ticket 섹션을 적는다.

## Notes

- Mini-plan: 편집 전에 짧은 구현 계획을 적는다.
- Progress: 진행 상황과 관련 wiki/ticket reference를 기록한다.

## Verification

- Command: `command-to-run`
- Run file:
- Result:

## Result

- Summary: 결과를 요약한다.
- Commit:

## Path Notes

- `References`는 `BOARD_ROOT` 기준 상대 경로다.
- `Allowed Paths`는 implementation worktree root 기준 상대 경로다. Worktree가 없으면 `PROJECT_ROOT` 기준으로 fallback한다.
- `Worktree`는 worktree를 사용할 수 있을 때 claim 중 채워진다.
- `Reference Notes`는 `[[PRD-001]]`, `[[plan_001]]`, `[[TODO-001]]` 같은 note name을 쓴다.
- `Plan Candidate`는 `Execution Candidates`의 정확한 candidate text를 복사해야 한다. 이는 duplicate-detection key다.
- 사람이 읽는 ticket 본문은 기본적으로 한국어로 쓴다. Parser-sensitive heading, field name, id, project key, path, command, code, runtime format은 보존한다.
