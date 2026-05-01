# Ticket

## Ticket

- ID: tickets_081
- PRD Key: prd_083
- Plan Candidate: Plan AI handoff from tickets/done/prd_083/prd_083.md
- Title: 작업 메뉴 진행 카드 역할 라벨 AI 표기 통일
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-04-30T23:35:05Z

## Goal

- 이번 작업의 목표: 데스크톱 앱의 "작업" 메뉴 진행 카드 헤더에서 runner role 라벨을 `Planner` / `Worker` / `위키봇` 대신 `Planner AI` / `Worker AI` / `Wiki AI` 로 표시한다.

## References

- PRD: tickets/done/prd_083/prd_083.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_083]]
- Plan Note:
- Ticket Note: [[tickets_081]]

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

- [ ] 작업 메뉴 진행 카드의 planner role 라벨이 `Planner AI` 로 표시된다.
- [ ] 작업 메뉴 진행 카드의 ticket-owner/owner role 라벨이 `Worker AI` 로 표시된다.
- [ ] 작업 메뉴 진행 카드의 wiki-maintainer/wiki role 라벨이 `Wiki AI` 로 표시된다.
- [ ] fallback 라벨, agent 표시, model/reasoning controls, runner id 표시 helper 는 이번 변경으로 의미가 달라지지 않는다.
- [ ] `planner-1`, `owner-1`, `wiki-1`, `planner`, `ticket-owner`, `wiki-maintainer` 같은 storage id / role key / parser-sensitive 값은 그대로 유지된다.
- [ ] `Planner AI` / `Worker AI` / `Wiki AI` 라벨이 작업 메뉴 카드 헤더에서 줄바꿈/잘림/겹침 없이 보인다.
- [ ] 구현은 Allowed Paths 안에 머문다.

## Next Action

- 다음에 바로 이어서 할 일: Impl AI 는 `displayProgressRoleLabel` 의 role 기반 반환 문자열만 `Planner AI` / `Worker AI` / `Wiki AI` 로 바꾸고, runner id / role key / `displayWorkflowRunnerId` 정책은 건드리지 않는다.

## Resume Context

- 현재 상태 요약: Plan AI 가 `tickets/inbox/memo_050.md` 를 `tickets/done/prd_083/prd_083.md` 로 승격하고 이 todo 티켓을 만들었다.
- 직전 작업: wiki context pass 후 `scripts/start-plan.sh 083` 이 PRD 와 memo 를 `tickets/done/prd_083/` 로 보관하고 `tickets_081` 을 생성했다.
- 재개 시 먼저 볼 것: `apps/desktop/src/renderer/main.tsx` 의 `displayProgressRoleLabel` 및 PRD Notes 의 wiki/ticket 제약.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_083/prd_083.md at 2026-04-30T23:35:05Z.
- Wiki context: `worker-display-policy` 는 internal storage id 와 user-facing label 을 분리한다. 이번 작업은 진행 카드 라벨만 변경하고 `planner-1`, `owner-1`, `wiki-1` 같은 storage id 는 유지한다.
- Wiki context: `runner-role-slugs` 는 실제 runner id rename 이 superseded 됐음을 기록한다. `planner`, `ticket-owner`, `wiki-maintainer` runtime role key 도 변경하지 않는다.
- Related ticket context: `tickets/done/prd_021/prd_021.md` 에서 현재 `Planner` / `Worker` / `위키봇` 카드 라벨 mapping 이 도입됐다. 이번 티켓은 해당 mapping 의 표시 문자열만 사용자 요청에 맞게 조정한다.
- Scope guard: `displayWorkflowRunnerId`, runner config/state, ticket fields, parser-sensitive key=value output, runtime scripts, wiki files 는 이 티켓의 Allowed Paths 밖이거나 Out of Scope 다.

## Verification

- Command: `npm --prefix apps/desktop run check`
- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
