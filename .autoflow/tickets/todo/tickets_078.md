# Ticket

## Ticket

- ID: tickets_078
- PRD Key: prd_080
- Plan Candidate: Plan AI handoff from tickets/done/prd_080/prd_080.md
- Title: 작업 흐름 요약 카드 최소 폭 3열 유지
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-04-30T23:00:13Z

## Goal

- 이번 작업의 목표: 데스크톱 앱의 작업 흐름 요약 영역에서 창이 최소 폭까지 좁아져도 ORDER / PRD / TODO 세 카드가 한 줄 3열로 유지되게 한다.

## References

- PRD: tickets/done/prd_080/prd_080.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Obsidian Links

- Project Note: [[prd_080]]
- Plan Note:
- Ticket Note: [[tickets_078]]

## Allowed Paths

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

- [ ] At the desktop minimum window width around 1040px, the ORDER / PRD / TODO cards inside `.workflow-pin-strip` render on one horizontal row as three columns.
- [ ] The 1120px responsive branch no longer causes the third TODO card to wrap to a second row at the desktop minimum width.
- [ ] Card text, counts, icons, and the `세부 보기` CTA remain inside each card without overlapping adjacent cards.
- [ ] Existing pin click behavior still opens the `WorkflowPinLayer` dialog and item detail flow as before.
- [ ] Existing ORDER -> PRD -> TODO visual order is preserved.
- [ ] Implementation stays inside Allowed Paths and does not mix in `memo_047` wiki-page work.
- [ ] Desktop check command passes.

## Next Action

- 다음에 바로 이어서 할 일: Impl AI 는 이 티켓을 todo 에서 claim 한 뒤 `apps/desktop/src/renderer/styles.css` 의 `.workflow-pin-strip` 반응형 분기를 확인하고, 최소 폭 1040px에서 3열이 유지되도록 CSS만 조정한다.

## Resume Context

- 현재 상태 요약: Plan AI 가 backlog PRD 에서 todo 티켓을 생성한 직후.
- 직전 작업: scripts/start-plan.sh 가 `tickets/done/prd_080/prd_080.md` 와 `tickets/done/prd_080/memo_046.md` 를 보관하고 이 todo 티켓을 만들었다.
- 재개 시 먼저 볼 것: `apps/desktop/src/renderer/styles.css` 의 `.workflow-pin-strip`, `@media (max-width: 1120px)`, `@media (max-width: 820px)` 규칙.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_080/prd_080.md at 2026-04-30T23:00:13Z.
- Wiki context: `tickets/done/prd_063/prd_063.md` 는 workflow pin 순서만 바꾸고 `WorkflowPinLayer` 내부 동작을 보존한 선례다. 이 티켓도 pin 순서와 dialog/detail 동작은 건드리지 않는다.
- Wiki context: `tickets/done/prd_015/tickets_015.md`, `tickets/done/prd_018/tickets_018.md`, `tickets/done/prd_023/tickets_023.md` 는 workflow pin 변경을 라벨, 정렬, visual accent 같은 좁은 범위로 제한한 선례다. 이번 구현은 CSS responsive layout 변경으로만 유지한다.
- Code context: 현재 기본 `.workflow-pin-strip` 는 3열이지만 `@media (max-width: 1120px)` 에서 2열로 바뀌고, 데스크톱 창 `minWidth` 1040px 이 이 분기에 걸려 TODO 카드가 두 번째 줄로 내려간다.

## Verification

- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
