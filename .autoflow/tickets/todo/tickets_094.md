# Ticket

## Ticket

- ID: tickets_094
- PRD Key: prd_096
- Plan Candidate: Plan AI handoff from tickets/done/prd_096/prd_096.md
- Title: AI work for prd_096
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-01T22:39:21Z

## Goal

- 이번 작업의 목표: Implement the approved spec for prd_096.

## References

- PRD: tickets/done/prd_096/prd_096.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_096]]
- Plan Note:
- Ticket Note: [[tickets_094]]

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

- [ ] AI 설정/대쉬보드에서 `planner-1` 카드의 역할 라벨이 "Plan AI" 만 단독 노출하지 않고, 오케스트레이터 역할이 함께 드러나는 한국어 표기로 보인다.
- [ ] `displayProgressRoleLabel` 이 planner role 에 대해 반환하는 짧은 라벨이 `"Planner"` 영문 단독에서 오케스트레이터 의미가 보이는 한국어(혹은 한국어 + 영문 보조) 표기로 바뀌어 진행 상태 카드/뱃지에 일관되게 노출된다.
- [ ] AI 설정 페이지 우측의 역할 안내 카피와 runner 가 없는 빈 상태 문구가 Plan AI 의 오케스트레이터 역할을 함께 설명한다.
- [ ] runner id (`planner-1`), runtime role 키 (`planner`/`plan`), runner state 파일 이름, board runtime 출력(`autoflow run planner` 등)에는 변화가 없다.
- [ ] `Impl AI` / `Wiki AI` 카드의 라벨, 진행 상태 표시, 안내 문구는 회귀 없이 그대로 유지된다.
- [ ] 라벨 길이가 늘어나도 runner 카드/툴바/빈 상태 영역에서 텍스트가 카드 밖으로 넘치거나 우측 시작/중지 버튼과 겹치지 않는다.
- [ ] `cd apps/desktop && npx tsc --noEmit` 가 통과한다.
- [ ] `cd apps/desktop && node scripts/check-syntax.mjs` 가 통과한다.

## Next Action

- 다음에 바로 이어서 할 일: Plan AI 가 Allowed Paths 와 Done When 을 PRD 기준으로 더 좁힌다. Impl AI 는 이 티켓을 todo 에서 claim 한 뒤 mini-plan, 구현, 검증, 머지까지 한 턴에 끝낸다.

## Resume Context

- 현재 상태 요약: Plan AI 가 backlog PRD 에서 todo 티켓을 생성한 직후.
- 직전 작업: scripts/start-plan.sh 가 PRD 를 done 으로 보관하고 todo 티켓을 만들었다.
- 재개 시 먼저 볼 것: PRD, Goal, Allowed Paths, Done When.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_096/prd_096.md at 2026-05-01T22:39:21Z.

## Verification

- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
