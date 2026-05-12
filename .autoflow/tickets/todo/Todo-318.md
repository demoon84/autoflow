# Ticket

## Ticket

- ID: Todo-318
- PRD Key: prd_296
- Plan Candidate: board-guard/lint-ticket/path-conflict-check/state-db/integrate-worktree 계열의 bash 본체 잔존 여부 확인 → TS canonical 경로로 축소 → board-utils.ts 재사용 정리 → runtime mirror 동기화 → guard/smoke 검증.
- Title: sh to ts 전환 2단계 보조 스크립트 실제 이관
- Priority: normal
- Change Type: infra
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-12T08:03:33Z

## Goal

이미 TypeScript 구현이 존재하거나 독립성이 높은 보조 스크립트부터 `.sh` 본체 로직을 `.ts` 중심으로 실제 이관한다. shell은 호환 진입점만 남기거나 제거 가능한 상태로 축소한다.

## References

- PRD: tickets/done/prd_296/prd_296.md

## Reference Notes

- Project Note: 보조 스크립트 실제 이관. wrapper-only 변경 금지, `board-utils.ts` 재사용 우선.
- Ticket Note: start-plan/worker/finalizer/packages CLI 대형 shell은 후속 단계에서 처리한다.

## Allowed Paths

- `.autoflow/scripts/board-guard.sh`
- `.autoflow/scripts/board-guard.ts`
- `.autoflow/scripts/lint-ticket.sh`
- `.autoflow/scripts/lint-ticket.ts`
- `.autoflow/scripts/path-conflict-check.sh`
- `.autoflow/scripts/path-conflict-check.ts`
- `.autoflow/scripts/state-db.sh`
- `.autoflow/scripts/state-db.ts`
- `.autoflow/scripts/integrate-worktree.sh`
- `.autoflow/scripts/integrate-worktree.ts`
- `.autoflow/scripts/board-utils.ts`
- `runtime/board-scripts`
- `tests/smoke`

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_318`
- Branch: autoflow/tickets_318
- Base Commit: b66a1560db9aae61374d3a551dec8d4f1679ea2a
- Worktree Commit: 
- Integration Status: pending

## Goal Runtime
- Status: active
- Started At: 2026-05-12T08:03:30Z
- Started Epoch: 1778573010
- Updated At: 2026-05-12T08:15:00Z
- Tick Count: 2
- Time Used Seconds: 3
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: parked_for_stop
- Last Progress Fingerprint: 2546855469

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [ ] 대상 보조 스크립트의 bash 본체 잔존 여부가 확인된다.
- [ ] 가능한 항목은 `.ts` canonical 구현으로 실행되고 `.sh`는 호환 wrapper로 축소된다.
- [ ] 공통 파서/보드 유틸은 `board-utils.ts`를 재사용한다.
- [ ] `.autoflow/scripts`와 `runtime/board-scripts` mirror가 대상 파일에 대해 맞춰진다.
- [ ] `find .autoflow/scripts runtime/board-scripts -maxdepth 1 -type f -name '*.sh' -exec bash -n {} \; && find .autoflow/scripts runtime/board-scripts -maxdepth 1 -type f \( -name '*.ts' -o -name '*.js' \) -exec node --check {} \; && ./bin/autoflow guard . .autoflow`가 통과한다.

## Next Action
- 다음에 바로 이어서 할 일: worker 재시작 후 wrapper/legacy/canonical 관계를 다시 확인하고 mini-plan부터 이어간다.

## Resume Context

- Current state: worker stop 요청으로 구현 시작 전에 todo로 되돌렸다.
- Last completed action: worker 정지 전에 active claim을 해제하고 todo 큐로 복귀시켰다.
- First thing to inspect on resume: 대상 파일의 wrapper/legacy/canonical 관계.

## Notes

- Mini-plan: ① 대상별 wrapper/legacy/TS 관계 확인 ② TS canonical 가능 항목 선정 ③ shell 축소와 mirror 동기화 ④ smoke/guard 검증.

- Runtime hydrated worktree dependency at 2026-05-12T08:03:29Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- Runtime hydrated worktree dependency at 2026-05-12T08:03:29Z: linked node_modules -> /Users/demoon2016/Documents/project/autoflow/node_modules
- AI worker prepared todo at 2026-05-12T08:03:28Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_318
- AI worker-2 prepared resume at 2026-05-12T08:03:33Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_318
## Verification
- Result: pending todo retry after worker stop

## Result

- Summary:
- Commit:
