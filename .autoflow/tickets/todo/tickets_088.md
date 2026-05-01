# Ticket

## Ticket

- ID: tickets_088
- PRD Key: prd_090
- Plan Candidate: Plan AI handoff from tickets/done/prd_090/prd_090.md
- Title: 사이드바 메뉴명 변경
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-01T00:45:04Z

## Goal

- 이번 작업의 목표: 데스크톱 앱 좌측 사이드바의 사용자 노출 메뉴명을 요청한 한국어 라벨로 변경한다.

## References

- PRD: tickets/done/prd_090/prd_090.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_090]]
- Plan Note:
- Ticket Note: [[tickets_088]]

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

- [ ] 좌측 사이드바의 `progress` 메뉴가 `AI 대쉬보드`로 표시된다.
- [ ] 좌측 사이드바의 `kanban` 메뉴가 `티켓`으로 표시된다.
- [ ] 좌측 사이드바의 `knowledge` 메뉴가 `LLM 위키`로 표시된다.
- [ ] `progress`, `kanban`, `knowledge`, `snapshot`, `logs`의 순서는 `AI 대쉬보드 -> 티켓 -> LLM 위키 -> 통계 -> 로그`이며, 기존 key와 icon은 유지된다.
- [ ] 메뉴 클릭 시 기존 화면 전환 동작은 유지된다.
- [ ] 변경된 긴 라벨이 사이드바 항목 안에서 서로 겹치거나 주변 UI를 밀어내지 않는다.
- [ ] 구현은 Allowed Paths 안에만 머문다.
- [ ] `cd apps/desktop && npx tsc --noEmit && node scripts/check-syntax.mjs` 가 통과한다.

## Next Action

- 다음에 바로 이어서 할 일: Impl AI 는 이 티켓을 todo 에서 claim 한 뒤 `settingsNavigation` 라벨만 요청값으로 바꾸고, 필요한 경우 사이드바 텍스트 표시 CSS를 최소 조정한 뒤 `cd apps/desktop && npx tsc --noEmit && node scripts/check-syntax.mjs` 를 실행한다.

## Resume Context

- 현재 상태 요약: Plan AI 가 `tickets/inbox/memo_057.md` 를 `tickets/done/prd_090/prd_090.md` 로 승격하고 이 todo 티켓을 생성했다.
- 직전 작업: wiki query 로 desktop sidebar navigation order 관련 선행 기록을 확인했고, 현재 순서 `작업 -> Tickets -> Wiki -> 통계 -> 로그` 는 유지하면서 label만 `AI 대쉬보드 -> 티켓 -> LLM 위키 -> 통계 -> 로그` 로 바꾸는 제약을 반영했다.
- 재개 시 먼저 볼 것: `tickets/done/prd_090/prd_090.md`, `apps/desktop/src/renderer/main.tsx` 의 `settingsNavigation` 배열, `apps/desktop/src/renderer/styles.css` 의 `.settings-nav-item span`.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_090/prd_090.md at 2026-05-01T00:44:44Z.
- Source memo archived at `tickets/done/prd_090/memo_057.md`.
- Planner wiki context command: `./bin/autoflow wiki query . --term '사이드바 메뉴명 변경' --term 'AI 대쉬보드 티켓 LLM 위키' --term 'desktop sidebar navigation labels' --term 'apps/desktop/src/renderer/main.tsx styles.css' --limit 8`.
- Planner wiki context command: `./bin/autoflow wiki query . --term 'desktop sidebar navigation order' --term 'sidebar navItems Workflow Tickets Wiki' --term 'AI 대쉬보드 티켓 LLM 위키' --term 'apps/desktop/src/renderer/main.tsx styles.css' --limit 8`.
- Wiki/ticket context: `wiki/answers/desktop-sidebar-navigation-order.md`, `wiki/answers/desktop-navigation-refinements-20260430.md`, and `tickets/done/prd_064/tickets_065.md` show the sidebar order was intentionally set to `작업 -> Tickets -> Wiki -> 통계 -> 로그`; preserve order, keys, icons, routing, and non-target menu behavior.
- Planning constraint: `tickets/reject/reject_003.md` is a max-retry Wiki preview/runtime smoke blocker unrelated to this label rename. Do not include `cleanup_status=ok`, `runner.7.id=coordinator-shell-loop`, or Wiki preview fixes in this ticket.

## Verification

- Command: `cd apps/desktop && npx tsc --noEmit && node scripts/check-syntax.mjs`
- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
