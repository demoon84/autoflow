# Ticket

## Ticket

- ID: Todo-058
- PRD Key: prd_056
- Plan Candidate: Plan AI handoff from tickets/done/prd_056/prd_056.md
- Title: Wiki query filter options as a single list
- Stage: done
- AI: worker-1
- Claimed By: worker-1
- Execution AI: worker-1
- Verifier AI: worker-1
- Last Updated: 2026-04-29T21:45:27Z

## Goal

- 이번 작업의 목표: Wiki 페이지 검색창 아래의 `완료/거절 티켓 포함` 과 `인수인계 포함` 옵션을 한 줄에 별개로 떠 있는 두 컨트롤이 아니라 하나의 필터 옵션 목록/그룹으로 보이게 통합하되, 기존 query 상태와 API 동작은 유지한다.

## References

- PRD: tickets/done/prd_056/prd_056.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Obsidian Links

- Project Note: [[prd_056]]
- Plan Note:
- Ticket Note: [[Todo-058]]

## Allowed Paths

- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`

## Worktree
- Path: `/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/Todo-058`
- Branch: autoflow/Todo-058
- Base Commit: 1b3e0d7d320912c06444cdf6964be2974eedb708
- Worktree Commit:
- Integration Status: already_in_project_root

## Done When

- [x] Wiki 검색창 아래의 `완료/거절 티켓 포함` 과 `인수인계 포함` 옵션이 하나의 필터 목록/그룹 안에 함께 표시된다.
- [x] 두 옵션은 각각 독립적으로 토글되며, 기존 `wikiQueryIncludeTickets` 와 `wikiQueryIncludeHandoffs` 상태가 그대로 query payload 에 반영된다.
- [x] `includeTickets=false/true` 와 `includeHandoffs=false/true` 조합이 기존처럼 `runWikiQuery` 의 `includeTickets` / `includeHandoffs` 인자로 전달된다.
- [x] 필터 목록은 desktop 폭에서 검색창 아래에 자연스럽게 정렬되고, 좁은 폭에서도 텍스트나 체크박스가 서로 겹치지 않는다.
- [x] Wiki 검색 결과 목록과 우측 미리보기 패널 동작은 변경되지 않는다.
- [x] Desktop renderer check command 가 통과한다.

## Next Action
- Complete: the inline merge finalizer integrated the AI-merged ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: Plan AI 가 `tickets/inbox/memo_025.md` 를 `tickets/done/prd_056/prd_056.md` 로 승격하고 이 todo 티켓을 생성했다.
- 직전 작업: wiki context pass 후 `apps/desktop/src/renderer/main.tsx` 의 `WikiQueryPanel` 이 `.wiki-query-toggles` 안에 두 `FormControlLabel` / `Checkbox` 를 직접 렌더링하며, `wikiQueryIncludeTickets` / `wikiQueryIncludeHandoffs` 상태가 `runWikiQuery` payload 로 전달되는 것을 확인했다.
- 재개 시 먼저 볼 것: `tickets/done/prd_056/prd_056.md`, `apps/desktop/src/renderer/main.tsx` 의 `WikiQueryPanel`, `apps/desktop/src/renderer/styles.css` 의 `.wiki-query-toggles` / `.wiki-query-toggle`.

## Notes

- Created by planner-1 (Plan AI) from tickets/done/prd_056/prd_056.md at 2026-04-29T21:22:32Z.
- Wiki context command: `./bin/autoflow wiki query . --term "Wiki 검색 체크박스" --term "완료/거절 티켓 포함" --term "인수인계 포함" --term "wikiQueryIncludeTickets" --term "wikiQueryIncludeHandoffs" --term "apps/desktop/src/renderer/main.tsx" --term "Wiki query options"`.
- Wiki context result: no direct prior decision governs these two Wiki query filter controls; results mainly surfaced prior desktop renderer tickets touching `apps/desktop/src/renderer/main.tsx`.
- Relevant finding: prior desktop renderer tickets such as `tickets/done/prd_040/Todo-040.md` and `tickets/done/prd_041/Todo-041.md` show frequent adjacent `main.tsx` work, so keep this implementation narrow and avoid unrelated Wiki page changes.
- Relevant finding: `.autoflow/wiki/features/wiki-preview-flow.md` documents the Wiki split-pane preview behavior; do not change preview auto-open/toggle behavior while grouping the filters.
- Planning constraint: prefer MUI Material grouping controls (`FormGroup` or equivalent) and preserve the two existing boolean states for query API compatibility.

- Runtime hydrated worktree dependency at 2026-04-29T21:41:34Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- AI worker-1 prepared todo at 2026-04-29T21:41:34Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/Todo-058; run=tickets/inprogress/verify_058.md
- AI worker-1 prepared resume at 2026-04-29T21:42:14Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/Todo-058; run=tickets/inprogress/verify_058.md
- Mini-plan at 2026-04-29T21:42:59Z: keep the change inside `WikiQueryPanel` and `.wiki-query-toggles`; wrap the two existing `FormControlLabel` controls in MUI `FormGroup` with group ARIA labeling; update CSS so the controls read as one compact filter list and wrap on narrow widths; preserve `wikiQueryIncludeTickets` / `wikiQueryIncludeHandoffs` state and `runWikiQuery` payload behavior. Wiki context cited `tickets/done/prd_056/prd_056.md` plus related `tickets/done/prd_040/Todo-040.md` and `tickets/done/prd_041/Todo-041.md`, so this stays narrow and does not touch preview/result behavior.
- Implementation at 2026-04-29T21:42:59Z: updated `apps/desktop/src/renderer/main.tsx` to use MUI `FormGroup` for the two Wiki query filter checkboxes and adjusted `apps/desktop/src/renderer/styles.css` so `.wiki-query-toggles` appears as one bordered, wrapping filter option group.
- Verification at 2026-04-29T21:44:30Z: `npm --prefix apps/desktop run check` passed in the ticket worktree, verified changes were manually integrated into PROJECT_ROOT, and the same check passed again from PROJECT_ROOT. Allowed Paths check shows only `apps/desktop/src/renderer/main.tsx` and `apps/desktop/src/renderer/styles.css`; `cmp` confirmed the worktree and PROJECT_ROOT copies match.
- Queued without worktree commit at 2026-04-29T21:45:19Z: PROJECT_ROOT already matches the ticket worktree for all Allowed Paths with code changes.
- Impl AI worker-1 marked verification pass at 2026-04-29T21:45:17Z; runtime finalizer will not perform merge operations.
- Inline merge finalizer (worker worker-1) finalized this verified ticket at 2026-04-29T21:45:27Z.
- Coordinator post-merge cleanup at 2026-04-29T21:45:27Z: removed_worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/Todo-058 deleted_branch=autoflow/Todo-058.
## Verification
- Run file: `tickets/done/prd_056/verify_058.md`
- Log file: `logs/verifier_058_20260429_214534Z_pass.md`
- Result: passed

## Result

- Summary: Grouped Wiki query include filters into one MUI FormGroup while preserving query payload behavior; desktop renderer check passed in worktree and PROJECT_ROOT.
- Remaining risk: Visual browser inspection was not required by the ticket and was not run; verification is static/build-based plus code inspection of the affected UI paths.
