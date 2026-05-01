# Ticket

## Ticket

- ID: tickets_095
- PRD Key: prd_097
- Plan Candidate: Plan AI handoff from tickets/done/prd_097/prd_097.md
- Title: AI work for prd_097
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-01T22:41:47Z

## Goal

- 이번 작업의 목표: Implement the approved spec for prd_097.

## References

- PRD: tickets/done/prd_097/prd_097.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_097]]
- Plan Note:
- Ticket Note: [[tickets_095]]

## Allowed Paths

- .autoflow/scripts/common.sh
- runtime/board-scripts/common.sh
- tests/smoke/ticket-owner-replan-smoke.sh
- scaffold/board/AGENTS.md
- scaffold/board/agents/plan-to-ticket-agent.md
- scaffold/board/automations/README.md

## Worktree

- Path:
- Branch:
- Base Commit:
- Worktree Commit:
- Integration Status: pending_claim

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
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [ ] `.autoflow/scripts/common.sh` 의 `reject_max_retries()` 가 `AUTOFLOW_REJECT_MAX_RETRIES` 미지정 시 `3` 을 반환한다.
- [ ] `runtime/board-scripts/common.sh` 의 `reject_max_retries()` 가 `AUTOFLOW_REJECT_MAX_RETRIES` 미지정 시 `3` 을 반환한다.
- [ ] `AUTOFLOW_REJECT_MAX_RETRIES=5` 처럼 환경변수가 명시되면 함수가 그 값을 그대로 반환한다 (override 동작 유지).
- [ ] ticket 의 `Retry → Max Retries` override 가 있는 경우 환경변수/기본값보다 ticket 값이 우선한다 (`ticket_max_retries` 동작 유지).
- [ ] `bash -n .autoflow/scripts/common.sh` 와 `bash -n runtime/board-scripts/common.sh` 가 통과한다.
- [ ] `bash tests/smoke/ticket-owner-replan-smoke.sh` 가 끝까지 `status=ok` 로 통과한다 (회귀 없음).
- [ ] `scaffold/board/AGENTS.md`, `scaffold/board/agents/plan-to-ticket-agent.md`, `scaffold/board/automations/README.md` 에서 reject auto-replan 한도를 다루는 문장이 새 기본값과 모순되는 표현(예: "기본 10회") 을 남기지 않는다.
- [ ] `replan_skipped.*` 출력 키 이름과 key=value 포맷, `failure_class=retry_limit`, `recovery_state=needs_user` 의미가 그대로 유지된다.

## Next Action

- 다음에 바로 이어서 할 일: Plan AI 가 Allowed Paths 와 Done When 을 PRD 기준으로 더 좁힌다. Impl AI 는 이 티켓을 todo 에서 claim 한 뒤 mini-plan, 구현, 검증, 머지까지 한 턴에 끝낸다.

## Resume Context

- 현재 상태 요약: Plan AI 가 backlog PRD 에서 todo 티켓을 생성한 직후.
- 직전 작업: scripts/start-plan.sh 가 PRD 를 done 으로 보관하고 todo 티켓을 만들었다.
- 재개 시 먼저 볼 것: PRD, Goal, Allowed Paths, Done When.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_097/prd_097.md at 2026-05-01T22:41:47Z.

## Verification

- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
