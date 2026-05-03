# Ticket

## Ticket

- ID: tickets_123
- PRD Key: prd_124
- Plan Candidate: Plan AI handoff from tickets/done/prd_124/prd_124.md
- Title: AI 진행 현황 보드 1행 4칸 그리드
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-03T07:32:00Z

## Goal

- 이번 작업의 목표: 데스크톱 앱의 `AI 진행 현황` 보드가 일반 데스크톱 폭에서 4개의 동일한 grid column 을 사용하도록 정리한다. 현재 3-runner 토폴로지에서는 planner / worker / wiki 카드가 앞의 3칸을 차지하고 4번째 칸은 비어 있으며, 향후 4번째 runner 가 추가되면 같은 행의 4번째 칸에 배치된다.

## References

- PRD: tickets/done/prd_124/prd_124.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_124]]
- Plan Note:
- Ticket Note: [[tickets_123]]

## Allowed Paths

- apps/desktop/src/renderer/styles.css
- apps/desktop/src/renderer/main.tsx

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

- [ ] `apps/desktop/src/renderer/styles.css` 에서 일반 desktop 폭의 `.ai-progress-board` 가 `grid-template-columns: repeat(4, minmax(0, 1fr))` 또는 동등한 4-column 정의를 사용한다.
- [ ] `data-runner-count="3"` 상태에서 `.ai-progress-board` 의 desktop grid-area 가 `"plan impl" "wiki impl"` 형태로 worker 를 2행 span 하지 않는다.
- [ ] `data-runner-count="4"` 상태에서 4개 카드가 2x2 grid 정의가 아니라 1행 4칸 정의를 따른다.
- [ ] viewport `<= 1279px` 에서는 2-column fallback, viewport `<= 720px` 에서는 1-column fallback 이 CSS 로 정의되어 카드의 select, button, active ticket label, log 영역이 부모 밖으로 넘치지 않는다.
- [ ] `apps/desktop/src/renderer/main.tsx` 변경이 있으면 `ai-progress-board` 의 runner 순서와 `data-runner-count` / `data-runner-role` 의미가 기존과 호환된다.
- [ ] 구현은 Allowed Paths 안에만 머문다.
- [ ] `npm run desktop:check` 가 exit 0 으로 통과한다.

## Next Action

- 다음에 바로 이어서 할 일: Impl AI 는 이 티켓을 todo 에서 claim 한 뒤 PRD의 CSS-first 제약을 읽고, mini-plan, 구현, 검증, 머지까지 한 턴에 끝낸다.

## Resume Context

- 현재 상태 요약: Plan AI 가 `tickets/inbox/order_086.md` 를 `tickets/done/prd_124/prd_124.md` 로 승격하고 todo 티켓을 생성했다.
- 직전 작업: `scripts/start-plan.sh` 가 PRD 와 order 를 `tickets/done/prd_124/` 로 보관하고 `tickets/todo/tickets_123.md` 를 만들었다.
- 재개 시 먼저 볼 것: `tickets/done/prd_124/prd_124.md` 의 Notes, `apps/desktop/src/renderer/styles.css` 의 `.ai-progress-board` / `data-runner-count` 분기, 필요 시 `apps/desktop/src/renderer/main.tsx` 의 runner data attributes.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_124/prd_124.md at 2026-05-03T07:31:47Z.
- Planner wiki context at 2026-05-03T07:32:00Z: `autoflow wiki query --rag` returned `tickets/done/prd_016/prd_016.md` and `tickets/done/prd_105/prd_105.md` for the same `ai-progress-board` area. Treat this ticket as replacing the older 3-runner worker-span layout and extending the later 1행 3열 layout to a 4-column desktop grid.
- Related constraints: preserve the card-internal runner display/active-ticket footer behavior from `tickets/done/prd_058/prd_058.md` and `tickets/done/prd_111/prd_111.md`; this ticket should stay CSS-first and touch `main.tsx` only if existing data attributes cannot preserve order.

## Verification

- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
