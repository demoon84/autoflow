# Ticket

## Ticket

- ID: Todo-318
- PRD Key: prd_296
- Plan Candidate: board-guard/lint-ticket/path-conflict-check/state-db/integrate-worktree 계열의 bash 본체 잔존 여부 확인 → TS canonical 경로로 축소 → board-utils.ts 재사용 정리 → runtime mirror 동기화 → guard/smoke 검증.
- Title: sh to ts 전환 2단계 보조 스크립트 실제 이관
- Priority: normal
- Change Type: infra
- Stage: blocked
- AI: worker
- Claimed By: worker:parked_after_manual_stop
- Execution AI: worker
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

- Status: blocked
- Detected By:
- Failure Class:
- Evidence: `find .autoflow/scripts runtime/board-scripts -maxdepth 1 -type f -name '*.sh' -exec bash -n {} \;` and `find .autoflow/scripts runtime/board-scripts -maxdepth 1 -type f \( -name '*.ts' -o -name '*.js' \) -exec node --check {} \;` pass, but `./bin/autoflow guard . .autoflow` fails on pre-existing duplicate board tickets (`Todo-291`, `Todo-300`~`Todo-304`, `Todo-314`, `Todo-315`) and leftover worktree warnings unrelated to this ticket's Allowed Paths.
- Planner Decision:
- Owner Resume Instruction: 대상 스크립트 active/runtime mirror 정렬은 완료됐다. 보드 duplicate/leftover worktree 정리 후 guard를 다시 실행하고 마지막 Done When만 닫으면 된다.
- Last Recovery At:

## Done When

- [x] 대상 보조 스크립트의 bash 본체 잔존 여부가 확인된다.
- [x] 가능한 항목은 `.ts` canonical 구현으로 실행되고 `.sh`는 호환 wrapper로 축소된다.
- [x] 공통 파서/보드 유틸은 `board-utils.ts`를 재사용한다.
- [x] `.autoflow/scripts`와 `runtime/board-scripts` mirror가 대상 파일에 대해 맞춰진다.
- [ ] `find .autoflow/scripts runtime/board-scripts -maxdepth 1 -type f -name '*.sh' -exec bash -n {} \; && find .autoflow/scripts runtime/board-scripts -maxdepth 1 -type f \( -name '*.ts' -o -name '*.js' \) -exec node --check {} \; && ./bin/autoflow guard . .autoflow`가 통과한다.

## Next Action
- 다음에 바로 이어서 할 일: 보드 중복/잔존 worktree 문제를 정리한 뒤 `./bin/autoflow guard . .autoflow`를 재실행하고 마지막 Done When을 닫는다.

## Resume Context

- Current state: 대상 helper의 TS wrapper 전환과 runtime mirror 동기화는 끝났고, 보드 guard의 기존 중복 오류 때문에 blocked 상태다.
- Last completed action: `.autoflow/scripts/integrate-worktree.sh`를 TS wrapper로 축소하고 runtime target set을 active와 동일하게 맞춘 뒤 syntax 검증을 통과시켰다.
- First thing to inspect on resume: `./bin/autoflow guard . .autoflow` 실패 원인인 duplicate ticket / leftover worktree 정리 여부.

## Notes

- Mini-plan: ① 대상별 wrapper/legacy/TS 관계 확인 ② TS canonical 가능 항목 선정 ③ shell 축소와 mirror 동기화 ④ smoke/guard 검증.
- 조사 결과: active 기준 `board-guard`, `lint-ticket`, `path-conflict-check`, `state-db`는 이미 `.ts` canonical wrapper였고 `integrate-worktree.sh`만 bash 본체가 남아 있었다.
- 구현 결과: `.autoflow/scripts/integrate-worktree.sh`를 TS wrapper로 축소했고, `runtime/board-scripts`에는 `board-utils.ts` 포함 대상 helper의 `.sh/.ts` mirror를 active와 동일하게 맞췄다.
- 검증 결과: target helper set에 대해 `cmp -s`로 active/runtime mirror 동일성을 확인했고 shell syntax / node check는 통과했다.
- 차단 사유: `./bin/autoflow guard . .autoflow` 는 이번 Allowed Paths 밖의 기존 board duplicate/error (`Todo-291`, `Todo-300`~`Todo-304`, `Todo-314`, `Todo-315`) 와 leftover worktree warning 때문에 실패했다.

- Runtime hydrated worktree dependency at 2026-05-12T08:03:29Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- Runtime hydrated worktree dependency at 2026-05-12T08:03:29Z: linked node_modules -> /Users/demoon2016/Documents/project/autoflow/node_modules
- AI worker prepared todo at 2026-05-12T08:03:28Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_318
- AI worker-2 prepared resume at 2026-05-12T08:03:33Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_318
## Verification
- Result: blocked todo parked after manual stop

## Result

- Summary: TS wrapper 전환과 runtime mirror 정렬은 완료했지만, 보드 guard가 기존 duplicate ticket / leftover worktree 문제로 실패해 마지막 Done When은 미완료 상태로 남음.
- Commit:
