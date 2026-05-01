# Ticket

## Ticket

- ID: tickets_089
- PRD Key: prd_091
- Plan Candidate: Plan AI handoff from tickets/done/prd_091/prd_091.md
- Title: TODO 레이어 레이아웃 깨짐 수정
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-01T21:22:52Z

## Goal

- 이번 작업의 목표: 데스크톱 앱 작업 흐름 TODO 핀 레이어에서 티켓 목록 row의 배경, 구분선, 제목, badge, 날짜가 서로 겹치지 않고 읽기 좋게 표시되도록 수정한다.

## References

- PRD: tickets/done/prd_091/prd_091.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_091]]
- Plan Note:
- Ticket Note: [[tickets_089]]

## Allowed Paths

- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`

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

- [ ] TODO 핀 레이어를 열었을 때 `ticket-088`부터 인접 TODO row들의 둥근 배경, border, 텍스트가 세로로 겹쳐 보이지 않는다.
- [ ] 긴 ticket 제목은 row 안에서 읽을 수 있게 줄바꿈되거나 말줄임 처리되며, `TODO` badge와 날짜를 침범하지 않는다.
- [ ] `TODO` badge와 날짜는 제목과 같은 행 또는 보조 행에 배치되더라도 서로 겹치지 않고 최소 간격을 유지한다.
- [ ] TODO 목록의 마지막 row는 레이어 하단과 붙지 않고 시각적으로 안정적인 하단 여백을 가진다.
- [ ] TODO 항목 클릭 시 기존처럼 티켓 본문 detail view가 열리고, back/close 동작은 유지된다.
- [ ] PRD, ORDER, reject 핀 레이어의 목록 item과 detail 열기 흐름은 회귀하지 않는다.
- [ ] 구현은 Allowed Paths 안에만 머문다.
- [ ] `cd apps/desktop && npx tsc --noEmit && node scripts/check-syntax.mjs` 가 통과한다.

## Next Action

- 다음에 바로 이어서 할 일: Plan AI 가 Allowed Paths 와 Done When 을 PRD 기준으로 더 좁힌다. Impl AI 는 이 티켓을 todo 에서 claim 한 뒤 mini-plan, 구현, 검증, 머지까지 한 턴에 끝낸다.

## Resume Context

- 현재 상태 요약: Plan AI 가 backlog PRD 에서 todo 티켓을 생성한 직후.
- 직전 작업: scripts/start-plan.sh 가 PRD 를 done 으로 보관하고 todo 티켓을 만들었다.
- 재개 시 먼저 볼 것: PRD, Goal, Allowed Paths, Done When.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_091/prd_091.md at 2026-05-01T21:22:52Z.

## Verification

- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
