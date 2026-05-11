# Ticket

## Ticket

- ID: Todo-267
- PRD Key: prd_263
- Plan Candidate: Candidate 1: planner-janitor.js 신규 구현 + plan-to-ticket-agent.md 명시
- Title: Planner stuck state janitor — stale lock / atomic 위반 / 좀비 자동 복구
- Priority: high
- Change Type: code
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-10T21:05Z

## Goal

`.autoflow/scripts/planner-janitor.js`를 5개 mechanical 점검 함수로 구현한다. planner 매 tick 첫 단계에서 자동 호출해 stale ownership lock, atomic 위반, 빈 worktree 좀비, 고아 worktree, Stage/폴더 mismatch를 자동 복구한다. `plan-to-ticket-agent.md`에 janitor 책임 섹션을 추가하고 `board-guard.sh`에 관련 룰을 추가한다.

## References

- PRD: tickets/done/prd_263/prd_263.md
- Feature PRD:
- Plan:

## Reference Notes

- Project Note: [[prd_263]]

## Allowed Paths

- `.autoflow/scripts/planner-janitor.js`
- `.autoflow/scripts/start-plan.sh`
- `.autoflow/scripts/board-guard.sh`
- `.autoflow/agents/plan-to-ticket-agent.md`
- `runtime/board-scripts/`

## Worktree
- Path:
- Branch:
- Base Commit:
- Worktree Commit:
- Integration Status: pending

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

## Recovery State

- Status: healthy
- Detected By: planner (2026-05-10T21:05Z)
- Failure Class:
- Evidence:
- Planner Decision: Todo-265(prd_261, ownership lock)와 Todo-266(prd_262, runner-wake.js) 완료 후 진행. plan-to-ticket-agent.md 경로 충돌 방지(Todo-264/266이 수정 중). ownership lock 포맷(order_230)과 호환 필요.
- Owner Resume Instruction: `ls .autoflow/tickets/done/prd_261/ .autoflow/tickets/done/prd_262/` 로 Todo-265/266 완료 확인 후 구현 시작. runner-id:pid:iso 포맷 기준 liveness check 구현.
- Last Recovery At: 2026-05-10T21:05Z

## Done When

- [x] planner tick에서 1-5 점검 단계 실행 (`planner-janitor.js` 또는 inline)
- [x] stale ownership lock 자동 정리: 임의 ticket에 dead PID 박은 lock 라인 → 1 tick 후 라인 삭제
- [x] atomic 위반 자동 복구: inprogress 2건 (1건 worktree 빔) → 1 tick 후 빈 쪽이 todo 이동
- [x] 고아 worktree 자동 prune: 매칭 ticket 없는 worktree → 1 tick 후 제거
- [x] 모든 cleanup 후 ticket Notes / planner state에 audit 항목 추가
- [x] 1원칙 보존: cleanup 실패 시 needs_user로 park, planner 자체는 계속 동작
- [x] `plan-to-ticket-agent.md`에 janitor 책임 1 섹션 추가
- [x] `rg -n "stale lock|atomic violation|orphan worktree|planner.*cleared" .autoflow/scripts/start-plan.* .autoflow/scripts/planner-janitor.* 2>/dev/null` 결과에 핵심 패턴 포함

## Next Action
- 다음에 바로 이어서 할 일: Todo-265/266 완료 확인 후 claim. planner-janitor.js 신규 구현 → start-plan 호출 연결 → agent.md 섹션 추가.

## Resume Context

- Current state: Todo 상태, Todo-265/266 선행 완료 필요
- Last completed action: Planner가 order_231에서 이 티켓 생성 (2026-05-10T21:05Z)
- First thing to inspect on resume: `ls .autoflow/tickets/done/prd_261/ .autoflow/tickets/done/prd_262/` 로 선행 티켓 완료 확인

## Notes

- Mini-plan: (1) 265/266 완료 확인 → (2) planner-janitor.js 구현(5개 함수) → (3) start-plan.sh에 janitor 호출 추가 → (4) board-guard.sh 룰 추가 → (5) plan-to-ticket-agent.md 섹션 추가 → (6) runtime/board-scripts/ 동기화 → (7) 검증
- Progress: 신규 구현 필요
- worker가 자기 ticket 정상 종료 담당, planner janitor는 abandon/크래시 잔해만 정리 — 역할 분리 유지
- ownership lock 포맷: `<runner-id>:<pid>:<iso>` (prd_261과 호환)

## Verification

- Command: `rg -n "stale lock|atomic violation|orphan worktree|planner.*cleared" .autoflow/scripts/start-plan.* .autoflow/scripts/planner-janitor.* 2>/dev/null`
- Run file:
- Result:

## Result

- Summary:
- Commit:

## Notes
