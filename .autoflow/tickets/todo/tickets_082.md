# Ticket

## Ticket

- ID: tickets_082
- PRD Key: prd_084
- Plan Candidate: Plan AI handoff from tickets/done/prd_084/prd_084.md
- Title: 티켓 표시 ID prefix 소문자 통일
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-04-30T23:40:27Z

## Goal

- 이번 작업의 목표: 데스크톱 UI에서 사용자에게 보이는 보드 파일 표시 ID prefix를 `prd-`, `reject-`, `order-`, `ticket-`처럼 소문자 하이픈 형식으로 통일한다.

## References

- PRD: tickets/done/prd_084/prd_084.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_084]]
- Plan Note:
- Ticket Note: [[tickets_082]]

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

- [ ] `workflowFileDisplayName`가 `prd_NNN.md`와 `project_NNN.md`를 `prd-NNN`으로 표시한다.
- [ ] `workflowFileDisplayName`가 `reject_NNN.md`, `memo_NNN.md`, `tickets_NNN.md`를 각각 `reject-NNN`, `order-NNN`, `ticket-NNN`으로 표시한다.
- [ ] 티켓 디테일 레이어 헤더/메타 ID, 칸반 카드 ID, workflow pin 레이어/목록, runner 진행 카드의 활성 티켓 표시가 같은 표시 ID 규칙을 공유한다.
- [ ] 실제 파일명(`memo_NNN.md`, `prd_NNN.md`, `tickets_NNN.md`, `reject_NNN.md`), `PRD Key` 값(`prd_NNN`), parser contract, runner/storage id는 변경하지 않는다.
- [ ] `npm run desktop:check`가 통과한다.

## Next Action

- 다음에 바로 이어서 할 일: Impl AI 는 `workflowFileDisplayName`의 표시 prefix만 소문자 하이픈 형식으로 바꾸고, 같은 함수 결과를 노출하는 화면들이 별도 대문자 prefix를 만들지 않는지 확인한다.

## Resume Context

- 현재 상태 요약: Plan AI 가 `memo_051`을 `prd_084`로 승격하고 `tickets_082` todo 티켓을 만들었다.
- 직전 작업: `scripts/start-plan.sh 084`가 PRD와 원본 memo를 `tickets/done/prd_084/`로 보관하고 todo 티켓을 만들었다.
- 재개 시 먼저 볼 것: `apps/desktop/src/renderer/main.tsx`의 `workflowFileDisplayName`와 그 결과를 쓰는 `displayId` 노출 경로.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_084/prd_084.md at 2026-04-30T23:40:03Z.
- Wiki context: `workflowFileDisplayName displayId Order PRD Ticket prefix lowercase`, `티켓 표시 ID prefix 소문자 prd order ticket reject`, `apps/desktop/src/renderer/main.tsx workflowFileDisplayName displayId`, `desktop tickets kanban display id ticket detail`, `worker display policy 사용자 표시 storage identifier`, `PRD terminology rename lowercase display labels` 조회 결과는 모두 `result_count=0`이었다. 기존 wiki 결정으로 제한되는 범위는 발견되지 않았다.
- Planning decision: 사용자가 prefix 대소문자를 지적했고 기존 표시 함수가 하이픈 기반이므로, 저장 key의 underscore 형식이 아니라 표시 전용 소문자 하이픈 형식으로 통일한다.
- Constraint: 파일명, `PRD Key`, parser field, runner/storage id, role key, runtime key=value 출력은 변경하지 않는다.

## Verification

- Command: `npm run desktop:check`
- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
