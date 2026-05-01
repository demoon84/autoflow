# Ticket

## Ticket

- ID: tickets_083
- PRD Key: prd_085
- Plan Candidate: Plan AI handoff from tickets/done/prd_085/prd_085.md
- Title: TODO 핀 카드 미처리/총발행 카운트 표시
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-04-30T23:46:24Z

## Goal

- 이번 작업의 목표: 데스크톱 작업 흐름 핀 영역의 `TODO` 카드가 현재 `TODO (todo/todo)`처럼 같은 값을 반복하지 않고, 미처리 todo 티켓 수와 발행된 전체 ticket 수를 `TODO (미처리/총발행)` 형식으로 표시한다.

## References

- PRD: tickets/done/prd_085/prd_085.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_085]]
- Plan Note:
- Ticket Note: [[tickets_083]]

## Allowed Paths

- `apps/desktop/src/renderer/main.tsx`

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

- [ ] `TODO` 카드 분자는 `board.tickets.todo` 안의 `tickets_*.md` 수로 표시된다.
- [ ] `TODO` 카드 분모는 `board.tickets.todo`, `board.tickets.inprogress`, `board.tickets.done`, `board.tickets.reject` 에 존재하는 `tickets_*.md` 수의 합으로 표시된다.
- [ ] todo가 0개이고 inprogress/done/reject ticket 이 하나 이상 있으면 `TODO (0/N)` 핀 카드가 표시된다.
- [ ] `TODO` 핀 카드를 열었을 때 본문 목록은 기존처럼 todo 상태 ticket 만 보여준다.
- [ ] `ORDER` 와 `PRD` 핀의 분자/분모 계산 및 본문 목록은 변경되지 않는다.
- [ ] 구현은 Allowed Paths 안에만 머문다.
- [ ] `npm run desktop:check` 가 통과한다.

## Next Action

- 다음에 바로 이어서 할 일: Impl AI 는 `apps/desktop/src/renderer/main.tsx` 의 작업 흐름 핀 계산부를 확인하고, `TODO` 카드 분모만 발행된 ticket 누계로 바꾸되 레이어 본문은 `todoFiles` 그대로 유지한다.

## Resume Context

- 현재 상태 요약: Plan AI 가 `tickets/inbox/memo_052.md` 를 `prd_085` 로 승격하고, 이 todo 티켓을 생성했다.
- 직전 작업: planner-1 이 wiki context query 를 실행했고 관련 기존 결정은 발견되지 않았다. 총발행 분모는 `todo + inprogress + done + reject` 의 `tickets_*.md` 누계로 결정했다.
- 재개 시 먼저 볼 것: `apps/desktop/src/renderer/main.tsx` 의 `todoTickets`, `todoFiles`, `todoPinTitle`, `hasWorkflowPins`, `WorkflowPinLayer` 호출부.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_085/prd_085.md at 2026-04-30T23:45:59Z.
- Planner wiki context: `TODO 핀 카드 카운트 미처리 총발행`, `WorkflowPinLayer todoPinTitle todoFiles`, `workflow pins ORDER PRD TODO count`, `board.tickets.todo inprogress done reject` 질의 결과 `result_count=0`; 이 변경을 제한하는 기존 wiki/ticket 결정은 발견되지 않았다.
- Planner constraint: `TODO` 핀 카드 표시 카운트만 `미처리/총발행`으로 바꾸고, 핀 레이어 본문 목록은 미처리 todo 티켓만 유지한다.

## Verification

- Command: `npm run desktop:check`
- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
