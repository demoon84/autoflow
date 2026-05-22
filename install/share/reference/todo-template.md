# Todo 템플릿

`tickets/todo/TODO-NNN.md` 파일에는 이 템플릿을 쓴다. 생성 경로는 두 가지다.

1. 플래너 러너가 PRD를 하나 이상의 Todo ticket으로 승격한다.
2. 작업이 단일 파일의 기계적 변경이고 PRD가 필요 없으면 `/atodo` skill 또는 `autoflow todo create`가 Todo ticket을 직접 쓴다.

Todo ticket은 구현 계약이다. 구체적인 `Allowed Paths`, 비어 있지 않은
`## Done When` checklist, verification instruction을 반드시 포함해야 한다.

```md
# TODO-NNN: <title>

## Ticket

- ID: TODO-NNN
- PRD Key: PRD-NNN
- PRD Slice: 1/1
- Plan Candidate:
- Title: <title>
- Priority: normal
- Change Type: code
- Stage: todo
- AI: planner
- Claimed By:
- Execution AI:
- Verifier Runner:
- Last Updated:

## Goal

- <구체적인 구현 goal 하나>

## References

- PRD: tickets/prd/PRD-NNN.md   # /atodo-direct ticket이면 비운다
- Related: <선택적 done/wiki reference>

## Reference Notes

- Project Note: <이 ticket이 필요한 이유>
- Plan Note: <scope narrowing 또는 sequencing note>
- Ticket Note: <worker-facing caution>

## Allowed Paths

- path/to/file-or-folder

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

- [ ] <관찰 가능한 implementation result>
- [ ] <verification 또는 evidence result>
- [ ] <계속 유지되어야 하는 regression/reset/error behavior>

## Next Action

- <다음 구체적 워커 작업>

## Resume Context

- Current state: <현재 상태>
- Last completed action: <마지막 완료 작업>
- First thing to inspect on resume: <먼저 확인할 파일, 명령, 또는 ticket 섹션>

## Notes

- Mini-plan: <짧은 워커 계획>
- Progress: <progress/evidence note>

## Verification

- Command: npm run test
- Run file:
- Result:

## Result

- Summary:
- Commit:
```

## Notes

- `Done When`은 여기와 PRD에서 authoritative하다.
- Priority 기본값은 `normal`이다. `high`는 사용자가 해당 ticket이 다른 작업을 막는다고 명시했거나 urgent/긴급/최우선/blocking이라고 부른 경우에만 쓴다. 중요한 기능, 마이그레이션 후속, 일반 follow-up만으로는 `high`가 아니다.
- 체크된 모든 항목은 implementation diff, verification output, deterministic evidence, 명확한 manual observation note 중 하나로 뒷받침되어야 한다.
- Todo ticket 본문은 기본적으로 한국어로 쓴다.
- Verifier replan 이후 `## Goal Runtime`은 `Replan Count`, `Replan Max`, `Replan Decision`, `Replan Fingerprint`를 담고, `## Replan Reason`은 이전 시도가 통과하지 못한 이유를 기록한다.
