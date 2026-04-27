# Ticket

## Ticket

- ID: tickets_016
- PRD Key: prd_016
- Plan Candidate: Plan AI handoff from tickets/done/prd_016/prd_016.md
- Title: Pin AI progress board to a 2-left / 1-right tall layout when three runners are present
- Stage: executing
- AI: 019dceee-18c0-7622-9b43-71f08fc41ab0
- Claimed By: 019dceee-18c0-7622-9b43-71f08fc41ab0
- Execution AI: 019dceee-18c0-7622-9b43-71f08fc41ab0
- Verifier AI: 019dceee-18c0-7622-9b43-71f08fc41ab0
- Last Updated: 2026-04-27T12:37:46Z

## Goal

- 이번 작업의 목표: 작업 흐름 페이지의 AI 진행 보드가 3-runner 토폴로지에서 우하단이 항상 비어 있는 문제를 해결한다. `<div className="ai-progress-board">` 에 `data-runner-count` 와 `data-runner-role` 속성을 추가하고, CSS 에서 3-runner 일 때 `grid-template-areas: "plan impl" "wiki impl"` 레이아웃을 적용해 Impl AI 카드가 우측 풀 높이를 차지하도록 한다. 좁은 viewport 에서는 단일 칼럼 fallback.

## References

- PRD: tickets/done/prd_016/prd_016.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Obsidian Links

- Project Note: [[prd_016]]
- Plan Note:
- Ticket Note: [[tickets_016]]

## Allowed Paths

- `apps/desktop/src/renderer/main.tsx` (add `data-runner-role` and `data-runner-count` attributes to the AI progress board container and cells)
- `apps/desktop/src/renderer/styles.css` (add `.ai-progress-board[data-runner-count="3"]` grid rules and `< 720px` media query fallback)

## Worktree
- Path: `/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_016`
- Branch: autoflow/tickets_016
- Base Commit: 14295dc36619674559bc977d47d12274e37eceed
- Worktree Commit:
- Integration Status: pending

## Done When

- [ ] 데스크톱에 정확히 3개 runner (planner / ticket-owner / wiki-maintainer) 가 있을 때, 작업 흐름 페이지의 AI 보드가 좌측 2단 (위 Plan AI, 아래 Wiki AI) + 우측 1단 (Impl AI 가 두 행 높이 span) 으로 보인다.
- [ ] 같은 레이아웃에서 우하단이 빈 공간 없이 채워진다 (현재 스크린샷의 빈 사각형이 제거된다).
- [ ] runner 수가 3 이 아닐 때 (1, 2, 4+) 는 현재 `repeat(2, 1fr)` 자동 흐름이 그대로 동작하고 시각 회귀 없음.
- [ ] viewport width < 720px 에서는 세 카드가 단일 칼럼으로 세로 적층되어 잘리지 않는다.
- [ ] `cd apps/desktop && npx tsc --noEmit` 가 0 errors.
- [ ] `cd apps/desktop && npm run check` 가 통과한다.
- [ ] 시각 회귀: `티켓 정보`, `AI 관리`, `Wiki`, `통계` 등 다른 사이드 페이지가 영향 없음.

## Next Action
- 다음에 바로 이어서 할 일: `main.tsx` 에 runner count/role data attributes 를 추가하고, `styles.css` 에 3-runner grid-template-areas 및 <720px 단일 칼럼 fallback 을 적용한 뒤 owner verification 을 실행한다.

## Resume Context

- 현재 상태 요약: Plan AI 가 tickets_016 를 생성하고 Allowed Paths / Goal / Notes 를 PRD 에 맞게 세분화 완료. 위키 조회로 선행 작업(prd_012) 충돌 없음 확인.
- 직전 작업: start-plan.sh 가 prd_016 을 done 으로 보관하고 todo 티켓을 만든 뒤, Plan AI 가 Title, Goal, Allowed Paths, Notes 를 PRD 원문 기준으로 정교화했다.
- 재개 시 먼저 볼 것: PRD (`tickets/done/prd_016/prd_016.md`), Allowed Paths, Done When, Notes 의 Implementation hint.

## Notes

- Created by demoon@gomgom:55730 (Plan AI) from tickets/done/prd_016/prd_016.md at 2026-04-27T12:21:45Z.
- Wiki context (planner-1): No prior attempt or reject for this grid layout change. prd_012 (role slug rename) landed in done and touched the same `main.tsx` area — but only runner IDs, not layout. This ticket is layout-only so merge conflict risk is minimal.
- PRD scope constraints (planner-1): Two files only — `main.tsx` (data attributes) and `styles.css` (grid rules). No JS logic changes, no new components, no shadcn additions needed. Grid-template-areas + role-based grid-area is the approach. Verification: `cd apps/desktop && npm run check` + visual inspection.
- Implementation hint: The PRD specifies `data-runner-role` should use `runner.role` string directly. For the CSS `grid-area` mapping, both the runtime role key (`planner`, `ticket-owner`, `wiki-maintainer`) and possible short forms (`plan`, `owner`, `wiki`) should be handled — check what `runner.role` actually emits in the renderer.

- Runtime hydrated worktree dependency at 2026-04-27T12:33:49Z: linked apps/desktop/node_modules -> /Users/demoon/Documents/project/autoflow/apps/desktop/node_modules
- Runtime hydrated worktree dependency at 2026-04-27T12:33:49Z: linked node_modules -> /Users/demoon/Documents/project/autoflow/node_modules
- AI 019dceee-18c0-7622-9b43-71f08fc41ab0 prepared todo at 2026-04-27T12:33:48Z; worktree=/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_016; run=tickets/inprogress/verify_016.md
- Owner mini-plan at 2026-04-27T12:34:59Z:
  1. Add `data-runner-count={runners.length}` to `.ai-progress-board` and `data-runner-role={runner.role}` to each `AiProgressRow` article.
  2. Add exact 3-runner CSS areas (`plan impl` / `wiki impl`) while leaving non-3 counts on the existing auto grid.
  3. Add a max-width 719px fallback that clears the areas and stacks all cards in one column.
  4. Verify with the ticket owner script, including `apps/desktop` type/check commands.
- Wiki context (owner-1): `autoflow wiki query` for `AI progress board`, `ticket-owner wiki-maintainer`, and the allowed renderer paths only surfaced `tickets/done/prd_016/prd_016.md`; no older done implementation changed this layout. The planner note about `prd_012` remains the relevant nearby history.
- Ticket owner verification failed by 019dceee-18c0-7622-9b43-71f08fc41ab0 at 2026-04-27T12:37:25Z: command exited 127
- Ticket owner verification passed by 019dceee-18c0-7622-9b43-71f08fc41ab0 at 2026-04-27T12:37:46Z: command exited 0
## Verification
- Run file: `tickets/inprogress/verify_016.md`
- Log file: pending
- Command: `cd apps/desktop && npm run check`
- Result: passed by 019dceee-18c0-7622-9b43-71f08fc41ab0 at 2026-04-27T12:37:46Z

## Result

- Summary:
- Remaining risk:
