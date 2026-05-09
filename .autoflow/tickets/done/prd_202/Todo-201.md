# Ticket

## Ticket

- ID: Todo-201
- PRD Key: prd_202
- Plan Candidate: Plan AI handoff from tickets/done/prd_202/prd_202.md
- Title: 데스크톱 메뉴명 AI AutoFlow 변경
- Priority: normal
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-08T06:24:54Z

## Goal

- 이번 작업의 목표: 데스크톱 renderer의 사용자 노출 메뉴명 `AI 진행 현황`을 `AI AutoFlow`로 바꾸고, 같은 메뉴/탭/접근성 label 영역에서 이전 표기가 남지 않게 한다.

## References

- PRD: tickets/done/prd_202/prd_202.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_202]]
- Plan Note:
- Ticket Note: [[Todo-201]]

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

- [x] `apps/desktop/src/renderer/main.tsx`의 `settingsNavigation` progress 항목 label이 `AI AutoFlow`다.
- [x] `apps/desktop/src/renderer/` 아래 `.ts`, `.tsx`, `.html`, `.css` 파일 검색에서 사용자 노출 문자열 `AI 진행 현황`이 0건이다.
- [x] `apps/desktop/src/renderer/` 아래 `.ts`, `.tsx`, `.html`, `.css` 파일 검색에서 `AI AutoFlow`가 최소 1건 확인된다.
- [x] 기존 navigation key `progress`, `Workflow` icon, 다른 메뉴명 `티켓`, `LLM 위키`, `AI 스킬`, `통계`는 유지된다.
- [x] 변경은 `apps/desktop/src/renderer/main.tsx` 안에만 머문다.
- [x] `bash -lc 'grep -RIn "AI 진행 현황" apps/desktop/src/renderer --include="*.ts" --include="*.tsx" --include="*.html" --include="*.css" >/tmp/autoflow-ai-progress-grep.txt; test ! -s /tmp/autoflow-ai-progress-grep.txt && grep -RIn "AI AutoFlow" apps/desktop/src/renderer --include="*.ts" --include="*.tsx" --include="*.html" --include="*.css" && npm run desktop:check'` exits 0.

## Next Action

- 다음에 바로 이어서 할 일: Impl AI 는 이 티켓을 todo 에서 claim 한 뒤 현재 `apps/desktop/src/renderer/main.tsx`를 먼저 읽고, 선행 `main.tsx` 변경을 보존하면서 `settingsNavigation` progress label과 renderer 내 남은 사용자 노출 `AI 진행 현황` 문자열만 `AI AutoFlow`로 바꾼다.

## Resume Context

- 현재 상태 요약: Plan AI 가 backlog PRD 에서 todo 티켓을 생성한 직후.
- 직전 작업: scripts/start-plan.sh 가 `tickets/done/prd_202/prd_202.md`를 보관하고 `tickets/todo/Todo-201.md`를 만들었다. Planner가 source/wiki/queue context를 보강했다.
- 재개 시 먼저 볼 것: `tickets/done/prd_202/prd_202.md`, `apps/desktop/src/renderer/main.tsx`의 `settingsNavigation`, 그리고 같은 파일을 수정 중인 선행 ticket의 완료 결과.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_202/prd_202.md at 2026-05-08T06:23:58Z.
- Planner wiki pass: `bin/autoflow wiki query --term "AI 진행 현황" --term "AI AutoFlow" --term "apps/desktop/src/renderer" --term "desktop sidebar" --rag` returned `result_count=822`; relevant constraints are prior `settingsNavigation` sidebar cleanup in `tickets/done/prd_136/*` and narrow renderer text cleanup in `tickets/done/prd_139/Todo-138.md`.
- Source finding: product-code grep found the current target at `apps/desktop/src/renderer/main.tsx` line 204 (`settingsNavigation` progress label). Historical `AI 진행 현황` mentions under `.autoflow/tickets/done/` and `.autoflow/wiki/` are out of scope.
- Queue note: `tickets/inprogress/Todo-198.md` and `tickets/todo/Todo-200.md` currently include `apps/desktop/src/renderer/main.tsx` in Allowed Paths. Single-worker execution should serialize them, but Impl AI must inspect current file state before editing.
- Guard warning after planner handoff: `bin/autoflow guard` returned `error_count=0`, `warning_count=3` for leftover worktree cleanup candidates `autoflow/Todo-194`, `autoflow/Todo-196`, and `autoflow/Todo-197`. These are unrelated to this label-change ticket; planner did not delete or reset worktrees.

## Verification

- Command: `bash -lc 'grep -RIn "AI 진행 현황" apps/desktop/src/renderer --include="*.ts" --include="*.tsx" --include="*.html" --include="*.css" >/tmp/autoflow-ai-progress-grep.txt; test ! -s /tmp/autoflow-ai-progress-grep.txt && grep -RIn "AI AutoFlow" apps/desktop/src/renderer --include="*.ts" --include="*.tsx" --include="*.html" --include="*.css" && npm run desktop:check'`
- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:


## Manual Closure Note

- Closed manually 2026-05-08 by user request: worker codex usage limit until 2026-05-12. Code changes already match all Done When in main: ticket_201 sidebar label rename, ticket_203 helpText prop removal, ticket_204 isOrderBoardFile regex already covers retry order via existing implementation.
- Stage: done (manual)
