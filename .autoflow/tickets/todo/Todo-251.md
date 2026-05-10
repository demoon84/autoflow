# Ticket

## Ticket

- ID: Todo-251
- PRD Key: prd_246
- Plan Candidate: Plan AI handoff from tickets/done/prd_246/prd_246.md
- Title: fs.watch runner wakeup smoke verification
- Priority: low
- Change Type: docs
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-10T08:37:25Z

## Goal

- 이번 작업의 목표: Implement the approved spec for prd_246.

## References

- PRD: tickets/done/prd_246/prd_246.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_246]]
- Plan Note:
- Ticket Note: [[Todo-251]]

## Allowed Paths

- `.autoflow/scripts/watch-board.sh`
- `packages/cli/runners-project.sh`
- `tests/smoke/planner-realtime-wakeup-smoke.sh`
- `tests/smoke/runner-tick-backoff-smoke.sh`

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

- [ ] `bash tests/smoke/planner-realtime-wakeup-smoke.sh`가 성공(`exit 0`)한다.
- [ ] `bash tests/smoke/runner-tick-backoff-smoke.sh`가 성공(`exit 0`)한다.
- [ ] `order_test_fswatch_1778390423.md`는 PRD 처리 소스(`Conversation Handoff Source`)와 일치하고, planner 실행 로그에서 fs.watch 기반 wakeup 처리 흔적을 확인할 수 있다.

## Next Action

- 다음에 바로 이어서 할 일: Plan AI 가 Allowed Paths 와 Done When 을 PRD 기준으로 더 좁힌다. Impl AI 는 이 티켓을 todo 에서 claim 한 뒤 mini-plan, 구현, 검증, 머지까지 한 턴에 끝낸다.

## Resume Context

- 현재 상태 요약: Plan AI 가 backlog PRD 에서 todo 티켓을 생성한 직후.
- 직전 작업: scripts/start-plan.sh 가 PRD 를 done 으로 보관하고 todo 티켓을 만들었다.
- 재개 시 먼저 볼 것: PRD, Goal, Allowed Paths, Done When.

## Notes

- Created by 019e1107-331c-7bb0-8157-6037a0de44e1 (Plan AI) from tickets/done/prd_246/prd_246.md at 2026-05-10T08:37:25Z.

## Verification

- Command: `bash tests/smoke/planner-realtime-wakeup-smoke.sh && bash tests/smoke/runner-tick-backoff-smoke.sh`
- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
