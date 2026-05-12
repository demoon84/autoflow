# Ticket

## Ticket

- ID: Todo-322
- PRD Key: prd_300
- Plan Candidate: runner drain-stop 상태 파일/CLI 명령 설계 → planner/worker/verifier/wiki preflight에서 신규 claim 차단 → desktop stop control에 drain-stop 옵션 추가 → smoke로 현재 작업 유지와 신규 claim 차단 검증.
- Title: 진행 중 작업 완료 후 정지 기능
- Priority: normal
- Change Type: infra
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-12T08:08:00Z

## Goal

runner를 즉시 kill하지 않고 현재 이미 잡은 ticket/verifier/wiki 작업은 끝까지 처리하되, 새 ticket/PRD claim은 막은 뒤 안전하게 종료하는 drain-stop 기능을 구현한다.

## References

- PRD: tickets/done/prd_300/prd_300.md

## Reference Notes

- Project Note: 기존 graceful stop/중지 예약은 참고 대상이고, 이번 티켓은 신규 claim 차단을 포함한 drain-stop semantics를 추가한다.
- Ticket Note: force/emergency stop은 기존 즉시 종료 경로로 유지한다.

## Allowed Paths

- `bin/autoflow`
- `packages/cli/runners-project.sh`
- `packages/cli/run-role.sh`
- `runtime/board-scripts/runners-project.sh`
- `runtime/board-scripts/run-role.sh`
- `apps/desktop/src/main.js`
- `apps/desktop/src/main/runner-pty-manager.js`
- `apps/desktop/src/renderer/main.tsx`
- `.autoflow/scripts/start-plan.sh`
- `.autoflow/scripts/start-ticket-owner.sh`
- `.autoflow/scripts/start-verifier.ts`
- `runtime/board-scripts/start-plan.sh`
- `runtime/board-scripts/start-ticket-owner.sh`
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

- [ ] CLI 또는 desktop에서 drain-stop을 요청할 수 있다.
- [ ] drain-stop 요청 후 planner는 새 PRD/todo promotion을 시작하지 않고 drain 상태를 보고한다.
- [ ] drain-stop 요청 후 worker/verifier/wiki는 이미 잡은 현재 작업을 계속 처리하지만 새 todo/verifier/wiki claim은 시작하지 않는다.
- [ ] 현재 작업이 없거나 현재 작업이 완료된 runner는 stopped/drained 상태로 전환된다.
- [ ] 기존 force/emergency stop은 즉시 종료 경로로 유지된다.
- [ ] runner state와 board queue 기준으로 drain-stop 동작을 재현하는 smoke 또는 단위 검증이 추가된다.
- [ ] `./bin/autoflow runners list . .autoflow && ./bin/autoflow doctor . .autoflow`와 drain-stop smoke가 통과한다.

## Next Action

기존 `runners stop`/desktop `stop()` 흐름과 runner state 파일 구조를 확인한 뒤, drain-stop 요청을 저장할 위치와 각 role preflight에서 신규 claim을 차단할 조건을 먼저 설계한다.

## Resume Context

- Current state: ticket 생성됨, worker 클레임 대기 중.
- Last completed action: order_321을 prd_300/Todo-322로 승격했다.
- First thing to inspect on resume: `bin/autoflow`의 `runners stop` dispatch, `packages/cli/runners-project.sh`, `packages/cli/run-role.sh`, desktop PTY stop IPC.

## Notes

- Mini-plan: ① 기존 graceful stop/force stop 흐름 확인 ② drain-stop state contract 설계 ③ planner/worker/verifier/wiki preflight claim gate 추가 ④ desktop/CLI control 연결 ⑤ smoke 작성.
- Progress: generated from order_321.

## Verification

- Command: `./bin/autoflow runners list . .autoflow && ./bin/autoflow doctor . .autoflow`
- Command: `bash tests/smoke/runner-drain-stop-smoke.sh`
- Run file:
- Result:

## Result

- Summary:
- Commit:
