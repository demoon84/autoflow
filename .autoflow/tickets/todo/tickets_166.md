# Ticket

## Ticket

- ID: tickets_166
- PRD Key: prd_167
- Plan Candidate: Plan AI handoff from tickets/done/prd_167/prd_167.md
- Title: AI work for prd_167
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-03T13:26:28Z

## Goal

- 이번 작업의 목표: Implement the approved spec for prd_167.

## References

- PRD: tickets/done/prd_167/prd_167.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_167]]
- Plan Note:
- Ticket Note: [[tickets_166]]

## Allowed Paths

- `packages/cli/runners-project.sh`
- `packages/cli/run-role.sh`
- `apps/desktop/src/main.js`
- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`
- `AGENTS.md`

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
- Iteration Fingerprints: []
- Last Lint Status: ok
- Last Lint Vagueness Score: 0

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [ ] `bash bin/autoflow runners stop worker "$PWD" .autoflow` 실행 후 state 에 `stop_pending=true`, `stop_requested_at=<ISO>` 마킹되고 PID 가 살아있다.
- [ ] 다음 tick 에서 graceful 종료 → state `status=stopped`, `last_stop_reason=graceful_stop_completed`.
- [ ] `--force` 플래그는 즉시 SIGKILL + `last_stop_reason=user_force`.
- [ ] `AUTOFLOW_GRACEFUL_STOP_MAX_WAIT_SECONDS=10` 환경에서 길어진 tick 이 10s 후 SIGTERM → 30s 후 SIGKILL fallback 까지 진행 (`last_stop_reason=graceful_stop_max_wait_force`).
- [ ] 데스크톱 stop 클릭 시 버튼이 `중지 예약 중...` 으로 바뀌고 첫 토스트 "중지 예약됨" 출력, state stopped 시 두 번째 토스트 "멈춤 완료" 출력 + 버튼 `시작` 재활성.
- [ ] graceful pending 중 재클릭 → 확인 다이얼로그 → Yes 시 force stop 동작.
- [ ] emergency stop / `halt --all` 은 force 유지 (회귀 없음).
- [ ] `npm run desktop:check` 통과.

## Next Action

- 다음에 바로 이어서 할 일: Plan AI 가 Allowed Paths 와 Done When 을 PRD 기준으로 더 좁힌다. Impl AI 는 이 티켓을 todo 에서 claim 한 뒤 mini-plan, 구현, 검증, 머지까지 한 턴에 끝낸다.

## Resume Context

- 현재 상태 요약: Plan AI 가 backlog PRD 에서 todo 티켓을 생성한 직후.
- 직전 작업: scripts/start-plan.sh 가 PRD 를 done 으로 보관하고 todo 티켓을 만들었다.
- 재개 시 먼저 볼 것: PRD, Goal, Allowed Paths, Done When.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_167/prd_167.md at 2026-05-03T13:26:28Z.

## Verification

- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
