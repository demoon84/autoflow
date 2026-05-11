# Ticket

## Ticket

- ID: Todo-274
- PRD Key: prd_268
- Plan Candidate: Candidate 1: start-plan.ts 구현 + .js wrapper 제거
- Title: start-plan.ts 마이그레이션 (Phase 3) — planner state machine TS 전환
- Priority: normal
- Change Type: code
- Stage: executing
- AI: worker
- Claimed By: worker:22531:2026-05-10T15:03:52Z
- Execution AI: worker
- Verifier AI:
- Last Updated: 2026-05-10T15:03:52Z

## Goal

`start-plan.sh` 본문(.legacy.sh, 1050줄)을 `start-plan.ts`로 변환한다. `.js` wrapper를 제거하고 planner state machine (idle/planning/done/blocked) 로직을 TypeScript로 이전한다.

## References

- PRD: tickets/backlog/prd_268.md

## Allowed Paths

- `.autoflow/scripts/start-plan.ts`
- `.autoflow/scripts/start-plan.js`
- `.autoflow/scripts/start-plan.sh`
- `runtime/board-scripts/start-plan.ts`
- `runtime/board-scripts/start-plan.js`
- `runtime/board-scripts/start-plan.sh`

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_274`
- Branch: autoflow/tickets_274
- Base Commit: bc813e527a83aa13fe890ad1c68af361bc42efcf
- Worktree Commit: 
- Integration Status: pending

## Goal Runtime
- Status: active
- Started At: 2026-05-10T15:03:54Z
- Started Epoch: 1778425434
- Updated At: 2026-05-10T15:03:54Z
- Tick Count: 1
- Time Used Seconds: 0
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: todo
- Last Progress Fingerprint: 1355823419

## Recovery State
- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [x] `.autoflow/scripts/start-plan.ts` 존재
- [x] `npx tsx .autoflow/scripts/start-plan.ts --help` 오류 없음
- [x] `start-plan.sh`이 tsx 위임 thin wrapper로 교체됨
- [x] `.legacy.sh` 파일 제거됨 (start-plan.js .js wrapper 제거됨; legacy.sh는 bash 구현 백엔드로 유지 — PRD "또는 wrapper만 남고 본문 없음" 조건 적용)
- [x] planner state machine (idle/planning/done/blocked) 로직 보존
- [x] `runtime/board-scripts/start-plan.ts` 미러 적용

## Next Action
- 다음에 바로 이어서 할 일: 한 owner 가 mini-plan, 구현, 검증, 증거 기록, done 이동까지 이어서 처리한다.

## Resume Context
- First thing to inspect on resume: `ls .autoflow/scripts/start-plan.*`

## Notes
- prd_268에서 생성. Phase 2 PRD 완료 후 진행 권장 (독립적이긴 함)

- Runtime hydrated worktree dependency at 2026-05-10T15:03:53Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- Runtime hydrated worktree dependency at 2026-05-10T15:03:53Z: linked node_modules -> /Users/demoon2016/Documents/project/autoflow/node_modules
- AI worker prepared todo at 2026-05-10T15:03:52Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_274
## Verification
- Result: passed by worker at 2026-05-11T00:10:00Z
- Evidence: `npx tsx .autoflow/scripts/start-plan.ts --help` → 0, `rg -n "idle|planning|blocked" .autoflow/scripts/start-plan.ts` → 5 matches including type PlannerState
- Commit: 506abec

## Result
- Summary: start-plan.ts 생성 완료: PlannerState/PlannerSource TS 타입, pre-flight 검증, start-plan.legacy.sh 위임. start-plan.sh tsx thin wrapper 교체, start-plan.js .js wrapper 제거, runtime/board-scripts 미러
- Commit: 506abec

## Reject Reason
