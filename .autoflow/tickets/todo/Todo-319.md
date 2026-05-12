# Ticket

## Ticket

- ID: Todo-319
- PRD Key: prd_297
- Plan Candidate: start-plan.legacy.sh orchestration flow 분석 → start-plan.ts에 retry/order/backlog/express/priority 로직 이관 → legacy fallback 축소 → runtime mirror 동기화 → planner smoke 검증.
- Title: sh to ts 전환 3단계 planner start-plan 실제 이관
- Priority: normal
- Change Type: infra
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-12T07:55:00Z

## Goal

planner 핵심 진입점 `start-plan`의 실제 orchestration 로직을 `start-plan.ts`로 이관하고 `start-plan.legacy.sh` 의존을 제거 가능하거나 fallback-only로 제한한다.

## References

- PRD: tickets/done/prd_297/prd_297.md

## Reference Notes

- Project Note: start-plan output contract와 priority/backlog-first 정책 보존이 핵심이다.
- Ticket Note: prd_211의 planner prioritization 정책을 회귀 기준으로 본다.

## Allowed Paths

- `.autoflow/scripts/start-plan.sh`
- `.autoflow/scripts/start-plan.ts`
- `.autoflow/scripts/start-plan.legacy.sh`
- `.autoflow/scripts/board-utils.ts`
- `.autoflow/scripts/promote-order-to-ticket.ts`
- `runtime/board-scripts/start-plan.sh`
- `runtime/board-scripts/start-plan.ts`
- `runtime/board-scripts/start-plan.legacy.sh`
- `tests/smoke`

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

- [ ] `start-plan.ts`가 primary planner implementation으로 동작한다.
- [ ] retry/order/backlog/express promotion 로직이 TS 경로로 이관된다.
- [ ] `status/source/todo_ticket/reason/next_action` 출력 계약이 유지된다.
- [ ] priority ordering, express order, retry order, backlog-first 정책이 보존된다.
- [ ] active/runtime `start-plan*` mirror가 동기화된다.
- [ ] `find .autoflow/scripts runtime/board-scripts -maxdepth 1 -type f -name 'start-plan*.sh' -exec bash -n {} \; && node --check .autoflow/scripts/start-plan.ts && AUTOFLOW_BACKGROUND=1 AUTOFLOW_ROLE=plan AUTOFLOW_WORKER_ID=planner ./.autoflow/scripts/start-plan.sh 999999`가 통과한다.

## Next Action

`start-plan.legacy.sh`의 selection/output flow를 작은 함수 단위로 읽고 `start-plan.ts`에 동일 key=value contract로 옮긴다.

## Resume Context

- Current state: ticket 생성됨, worker 클레임 대기 중.
- Last completed action: order_318을 prd_297/Todo-319로 승격했다.
- First thing to inspect on resume: `start-plan.legacy.sh`의 order/retry/backlog branch 순서와 출력 key.

## Notes

- Mini-plan: ① legacy branch 구조 파악 ② TS 함수로 selection 이관 ③ output contract 보존 ④ runtime mirror 동기화 ⑤ planner smoke 실행.

## Verification

- Command: `find .autoflow/scripts runtime/board-scripts -maxdepth 1 -type f -name 'start-plan*.sh' -exec bash -n {} \; && node --check .autoflow/scripts/start-plan.ts && AUTOFLOW_BACKGROUND=1 AUTOFLOW_ROLE=plan AUTOFLOW_WORKER_ID=planner ./.autoflow/scripts/start-plan.sh 999999`
- Run file:
- Result:

## Result

- Summary:
- Commit:
