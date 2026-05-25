# Work Item Template

PRD-derived TODO에는 이 템플릿을 쓴다. TODO는 사용자가 직접 선택하는 단위가 아니라 Planner가 PRD에서 만든 내부 실행 단위다.

```md
# WORK-NNN: <title>

## Work Item

- ID: WORK-NNN
- PRD Key: PRD-NNN
- PRD Slice: 1/1
- Title: <title>
- Change Type: code
- State: pending
- Assigned Runner:
- Assignment ID:
- Lease Version:
- Contract ID:
- Contract Digest:
- Last Updated:

## Goal

- <구체적인 구현 goal 하나>

## References

- PRD: tickets/prd/PRD-NNN.md
- Related: <선택적 done/wiki reference>

## Reference Notes

- Project Note: <이 work item이 필요한 이유>
- Plan Note: <scope narrowing 또는 sequencing note>
- Work Note: <worker-facing caution>

## Allowed Paths

- path/to/file-or-folder

## Worktree

- Branch:
- Path:
- Base:
- Created At:

## Runtime State

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

## Done When

- [ ] <관찰 가능한 implementation result>
- [ ] <verification 또는 evidence result>
- [ ] <계속 유지되어야 하는 regression/reset/error behavior>

## Next Action

- <다음 구체적 worker role action>

## Resume Context

- Current state: <현재 상태>
- Last completed action: <마지막 완료 작업>
- First thing to inspect on resume: <먼저 확인할 파일, 명령, 또는 section>

## Notes

- Mini-plan: <짧은 worker role 계획>
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

- `Done When`은 PRD와 work item에서 authoritative하다.
- 체크된 모든 항목은 implementation diff, verification output, deterministic evidence, 명확한 manual observation note 중 하나로 뒷받침되어야 한다.
- Work item 본문은 기본적으로 한국어로 쓴다.
