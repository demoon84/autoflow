# Ticket

## Ticket

- ID: tickets_167
- PRD Key: prd_168
- Plan Candidate: Plan AI handoff from tickets/done/prd_168/prd_168.md
- Title: planner check ledger live-lock fix
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-03T14:46:06Z

## Goal

- 이번 작업의 목표: planner blocked-dirty orchestration cleanup 이 자기 자신이 만든 `tickets/check/check_NNN.md` 를 다음 tick 의 dirty path 로 잡아 무한 루프하는 자기참조 live-lock 을 차단하고, 해당 ticket(현재 `tickets_162`) 가 정상적으로 `blocked-auto-recover` 또는 done 으로 진행할 수 있게 한다.

## References

- PRD: tickets/done/prd_168/prd_168.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_168]]
- Plan Note:
- Ticket Note: [[tickets_167]]

## Allowed Paths

- `.autoflow/scripts/start-plan.sh`
- `.autoflow/scripts/common.sh`
- `runtime/board-scripts/start-plan.sh`
- `runtime/board-scripts/common.sh`
- `packages/cli/run-role.sh`

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

- [ ] start-plan.sh 가 dirty inventory 가 **오직 `.autoflow/tickets/check/check_NNN.md` 신규 파일로만 구성된 경우** 를 감지해 `source=blocked-dirty-orchestration` 을 emit 하지 않는다.
- [ ] 동일 ticket 의 orchestration cleanup commit 이 5건 이상 누적되면 start-plan.sh 가 ticket Recovery State 를 `needs_user` 로 자동 set 하고 fixpoint guard evidence 를 출력한다 (`source=blocked-cleanup-fixpoint-exceeded`).
- [ ] 위 두 가지 변화는 `runtime/board-scripts/start-plan.sh` 와 `.autoflow/scripts/start-plan.sh` 에 대칭으로 반영된다.
- [ ] `tickets/check/` 누적 증가가 같은 blocked ticket 에 대해 자동으로 멈춤을 smoke 또는 단위 테스트로 검증한다.
- [ ] 기존 정상 blocked-dirty 케이스(다양한 dirty path 가 섞여있을 때) 는 회귀 없이 그대로 동작한다.
- [ ] `npm run desktop:check` 통과 (영향 받는 경우).

## Next Action

- 다음에 바로 이어서 할 일: Plan AI 가 Allowed Paths 와 Done When 을 PRD 기준으로 더 좁힌다. Impl AI 는 이 티켓을 todo 에서 claim 한 뒤 mini-plan, 구현, 검증, 머지까지 한 턴에 끝낸다.

## Resume Context

- 현재 상태 요약: Plan AI 가 backlog PRD 에서 todo 티켓을 생성한 직후.
- 직전 작업: scripts/start-plan.sh 가 PRD 를 done 으로 보관하고 todo 티켓을 만들었다.
- 재개 시 먼저 볼 것: PRD, Goal, Allowed Paths, Done When.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_168/prd_168.md at 2026-05-03T14:46:06Z.

## Verification

- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
