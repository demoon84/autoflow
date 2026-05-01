# Ticket

## Ticket

- ID: tickets_092
- PRD Key: prd_094
- Plan Candidate: Plan AI handoff from tickets/done/prd_094/prd_094.md
- Title: AI work for prd_094
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-01T22:37:38Z

## Goal

- 이번 작업의 목표: Implement the approved spec for prd_094.

## References

- PRD: tickets/done/prd_094/prd_094.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_094]]
- Plan Note:
- Ticket Note: [[tickets_092]]

## Allowed Paths

- apps/desktop/src/renderer/main.tsx
- apps/desktop/src/renderer/styles.css

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

- [ ] Worker 행에서 아이콘, Worker 라벨, 토큰 사용량 텍스트, 우측 제어가 모두 같은 시각적 baseline 또는 세로 중앙 기준으로 정렬되어 어긋나 보이지 않는다.
- [ ] 라벨과 토큰 사용량이 flex 컨테이너로 묶여 있고, worker 행에서는 두 요소가 가로 행으로 자연스럽게 이어진다.
- [ ] 긴 토큰 사용량 문자열이 들어와도 Worker 행의 높이가 갑자기 두 배 이상으로 커지거나 좌우 패딩이 불안정해지지 않는다.
- [ ] 토큰 사용량이 비어 있을 때도 라벨 위치와 우측 제어 위치가 어긋나지 않는다.
- [ ] 비-worker progress row(planner/owner 등 track 노출 row)의 기존 정렬과 그리드 레이아웃은 회귀 없이 유지된다.
- [ ] runner enable/select 토글, 시작/중지 버튼 동작과 키보드 포커스 흐름은 그대로다.

## Next Action

- 다음에 바로 이어서 할 일: Plan AI 가 Allowed Paths 와 Done When 을 PRD 기준으로 더 좁힌다. Impl AI 는 이 티켓을 todo 에서 claim 한 뒤 mini-plan, 구현, 검증, 머지까지 한 턴에 끝낸다.

## Resume Context

- 현재 상태 요약: Plan AI 가 backlog PRD 에서 todo 티켓을 생성한 직후.
- 직전 작업: scripts/start-plan.sh 가 PRD 를 done 으로 보관하고 todo 티켓을 만들었다.
- 재개 시 먼저 볼 것: PRD, Goal, Allowed Paths, Done When.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_094/prd_094.md at 2026-05-01T22:37:38Z.

## Verification

- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
