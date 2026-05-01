# Ticket

## Ticket

- ID: tickets_076
- PRD Key: prd_078
- Plan Candidate: Plan AI handoff from tickets/done/prd_078/prd_078.md
- Title: 입력과 버튼 기본 크기 xs 축소
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-04-30T22:47:41Z

## Goal

- 이번 작업의 목표: 데스크톱 앱 전반의 로컬 `Input`/`Button` 기반 입력 요소와 버튼 요소를 기존보다 한 단계 작은 `xs` 밀도에 맞춰 표시하되, 아이콘 정렬, 포커스 링, 텍스트 잘림, 좁은 폭 레이아웃 회귀가 생기지 않게 한다.

## References

- PRD: tickets/done/prd_078/prd_078.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Obsidian Links

- Project Note: [[prd_078]]
- Plan Note:
- Ticket Note: [[tickets_076]]

## Allowed Paths

- `apps/desktop/src/components/ui/button.tsx`
- `apps/desktop/src/components/ui/input.tsx`
- `apps/desktop/src/renderer/styles.css`
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

- [ ] Default local `Button` instances without an explicit size render at `xs` density or an equivalent smaller visual size.
- [ ] Existing explicit `size="sm"` general button uses that should shrink with the global request are converted or otherwise made visually consistent with `xs`; intentional exceptions are documented in ticket Notes.
- [ ] Icon-only buttons that should shrink use `icon-xs` or an equivalent smaller token, and their icons remain centered without clipped focus rings.
- [ ] Local `Input` supports an `xs` density path or has its default `.af-input` density reduced so input height, padding, and text size match the smaller button system.
- [ ] Project folder selection, board/search inputs, dialog forms, toolbar actions, runner controls, sidebar/project menu actions, and footer buttons still show readable text without overlapping adjacent UI.
- [ ] Focus ring, hover, disabled, destructive/outline/ghost/default variants, and keyboard operation remain visible and usable after the size reduction.
- [ ] Implementation stays inside Allowed Paths and does not mix in `memo_045` or `memo_046` work.
- [ ] Desktop check command passes.

## Next Action

- 다음에 바로 이어서 할 일: Impl AI 는 이 티켓을 todo 에서 claim 한 뒤 현재 PROJECT_ROOT 기준으로 `Button`/`Input` xs 밀도 축소만 좁게 구현하고, 같은 Allowed Paths 안의 다른 데스크톱 UI 작업과 섞지 않는다.

## Resume Context

- 현재 상태 요약: Plan AI 가 backlog PRD 에서 todo 티켓을 생성한 직후 상태로 되돌렸다.
- 직전 작업: scripts/start-plan.sh 가 `tickets/done/prd_078/prd_078.md` 를 바탕으로 이 todo 티켓을 만들었다.
- 재개 시 먼저 볼 것: `apps/desktop/src/components/ui/button.tsx`, `apps/desktop/src/components/ui/input.tsx`, `apps/desktop/src/renderer/styles.css`, `apps/desktop/src/renderer/main.tsx` 의 현재 구현과 PRD `tickets/done/prd_078/prd_078.md`.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_078/prd_078.md at 2026-04-30T22:47:41Z.

## Verification

- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
