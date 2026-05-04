# Ticket

## Ticket

- ID: tickets_168
- PRD Key: prd_169
- Plan Candidate: Plan AI handoff from tickets/done/prd_169/prd_169.md
- Title: worker last_result self-reset after cleanup
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-03T14:46:29Z

## Goal

- 이번 작업의 목표: PROJECT_ROOT 의 dirty path 가 모두 정리되고 blocked-dirty orchestration cleanup 이 끝난 뒤에도 `worker.state.last_result` 에 `ticket_stage_blocked` 가 stale 상태로 남아 monitor / desktop UI 가 worker 를 계속 "blocked" 으로 표시하는 문제를 끊는다. worker tick 자가 reset 과 planner cleanup 후 명시적 reset 을 동시에 적용해 user-visible "blocked" 표시가 실제 상태와 동기화되도록 한다.

## References

- PRD: tickets/done/prd_169/prd_169.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_169]]
- Plan Note:
- Ticket Note: [[tickets_168]]

## Allowed Paths

- `packages/cli/run-role.sh`
- `.autoflow/scripts/start-plan.sh`
- `runtime/board-scripts/start-plan.sh`
- `.autoflow/scripts/common.sh`
- `runtime/board-scripts/common.sh`

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

- [ ] `packages/cli/run-role.sh` 의 worker(`ticket`) tick 진입부가 `worker.state` 의 `last_result=ticket_stage_blocked` 이면서 active ticket Allowed Paths 가 dirty 가 아니면 `last_result` 를 빈 값(또는 `idle`) 으로 reset 한다.
- [ ] `.autoflow/scripts/start-plan.sh` 와 `runtime/board-scripts/start-plan.sh` 의 blocked-dirty orchestration cleanup 이 마지막 cleanup commit 직후 또는 `blocked-auto-recover` 직전 단계에서 `worker.state` 의 stale `last_result=ticket_stage_blocked` 를 명시적으로 비운다.
- [ ] 두 동작 모두 sidecar(`.autoflow/scripts/*`) 와 install template(`runtime/board-scripts/*`) 에 대칭으로 반영된다.
- [ ] 위 변화는 다른 last_result 값(`adapter_timeout`, `adapter_timeout_fallback` 등) 또는 다른 worker state 필드(active ticket, runner_status 등) 를 변경하지 않는다.
- [ ] 단위 또는 smoke 테스트로 cleanup 직후 1 tick 안에 `last_result` 가 `ticket_stage_blocked` 가 아님을 검증한다.
- [ ] `bash -n` 으로 변경된 모든 sh 파일이 syntax pass 한다.

## Next Action

- 다음에 바로 이어서 할 일: Plan AI 가 Allowed Paths 와 Done When 을 PRD 기준으로 더 좁힌다. Impl AI 는 이 티켓을 todo 에서 claim 한 뒤 mini-plan, 구현, 검증, 머지까지 한 턴에 끝낸다.

## Resume Context

- 현재 상태 요약: Plan AI 가 backlog PRD 에서 todo 티켓을 생성한 직후.
- 직전 작업: scripts/start-plan.sh 가 PRD 를 done 으로 보관하고 todo 티켓을 만들었다.
- 재개 시 먼저 볼 것: PRD, Goal, Allowed Paths, Done When.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_169/prd_169.md at 2026-05-03T14:46:29Z.

## Verification

- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
