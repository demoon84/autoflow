# Ticket

## Ticket

- ID: Todo-061
- PRD Key: prd_059
- Plan Candidate: Plan AI handoff from tickets/done/prd_059/prd_059.md
- Title: Stabilize Tickets detail layer opening
- Stage: done
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI: worker
- Last Updated: 2026-04-29T23:41:51Z

## Goal

- 이번 작업의 목표: Tickets 페이지에서 카드나 목록 항목을 열어 상세 레이어를 표시할 때 overlay 또는 panel 이 첫 프레임에 보였다가 사라지는 깜박임 없이 안정적으로 열리게 한다.

## References

- PRD: tickets/done/prd_059/prd_059.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Obsidian Links

- Project Note: [[prd_059]]
- Plan Note:
- Ticket Note: [[Todo-061]]

## Allowed Paths

- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`
- `apps/desktop/src/components/ui/dialog.tsx`

## Worktree
- Path: `/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/Todo-061`
- Branch: autoflow/Todo-061
- Base Commit: 624889d378f0147a54768d7803867e1d1a686fd5
- Worktree Commit: edcf93d90221452da9eddaa781820f8ef2535cfd
- Integration Status: integrated

## Done When

- [ ] Opening a ticket detail from the Tickets page list view shows the overlay and panel without a visible first-frame flash, disappearance, or double-open flicker.
- [ ] Opening a ticket detail from the Tickets Kanban view shows the same stable detail-layer behavior.
- [ ] Closing and reopening several different ticket cards does not briefly show stale detail content, an empty panel flash, or a backdrop opacity flash.
- [ ] The detail layer still closes through the close icon and Dialog open-state callbacks without leaving stale `activeDetailPath`, loading, or error state visible on the next open.
- [ ] Existing workflow pin layers that share `.workflow-pin-layer-panel` / `.workflow-pin-layer-overlay` continue to open, close, and display content normally.
- [ ] The implementation stays within Allowed Paths and preserves ticket parsing, board state, and markdown rendering behavior.
- [ ] The desktop check command passes.

## Next Action
- Complete: the inline merge finalizer integrated the AI-merged ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: Plan AI 가 `tickets/inbox/memo_028.md` 를 `tickets/done/prd_059/prd_059.md` 로 승격하고 이 todo 티켓을 생성했다.
- 직전 작업: wiki context pass 결과 이 flicker fix 를 직접 제약하는 선행 wiki/ticket 기록은 없었다. 정적 코드 확인으로 `TicketDetailLayer` 가 `Dialog open={Boolean(item)}` 와 `DialogContent` classes `workflow-pin-layer-panel workflow-pin-layer-default ticket-detail-layer-panel`, `overlayClassName="workflow-pin-layer-overlay"` 를 사용함을 확인했다.
- 재개 시 먼저 볼 것: `tickets/done/prd_059/prd_059.md`, `apps/desktop/src/renderer/main.tsx` 의 `TicketDetailLayer` / `TicketWorkspaceListView` / `TicketKanban`, `apps/desktop/src/renderer/styles.css` 의 `.workflow-pin-layer-panel` / `.ticket-detail-layer-panel`, `apps/desktop/src/components/ui/dialog.tsx` 의 MUI `Dialog` wrapper.

## Notes

- Created by planner-1 (Plan AI) from tickets/done/prd_059/prd_059.md at 2026-04-29T21:40:36Z.
- Wiki context command: `./bin/autoflow wiki query /Users/demoon2016/Documents/project/autoflow .autoflow --term "Tickets page detail layer flicker" --term "TicketDetailLayer MUI Dialog" --term "workflow-pin-layer-overlay ticket-detail-layer-panel" --term "apps/desktop/src/renderer/main.tsx styles.css dialog.tsx" --limit 8 --runner planner-1`.
- Wiki context result: `result_count=0`; no prior wiki/ticket finding directly constrains this flicker fix.
- Planning constraint: keep React changes minimal because `apps/desktop/src/renderer/main.tsx` already has pending todo work in adjacent desktop UI areas. Prefer a scoped CSS/Dialog wrapper fix when sufficient, and only touch `TicketDetailLayer` state flow if remount/reset behavior is the cause.
- Relevant code finding: `apps/desktop/src/components/ui/dialog.tsx` passes `overlayClassName` as a MUI Dialog root class and `className` as the paper class, so transition or initial-frame changes may need to target root/paper separately.
- Mini-plan (owner-1, 2026-04-29T23:38:03Z):
  1. `DialogContent` 의 `overlayClassName` 을 실제 MUI backdrop slot 에도 전달하고, Tickets detail layer 에서 mount 안정화 옵션을 사용할 수 있게 한다.
  2. `TicketWorkspaceListView` 와 `TicketKanban` 의 detail content 를 `activeDetailPath` 와 함께 추적해 다른 항목을 열 때 이전 markdown/content 가 첫 프레임에 보이지 않게 한다.
  3. `ticket-detail-layer-panel` 은 열린 상태에서만 content 를 보여 주되, loading/error reset 이 close callback 과 open-state callback 뒤에 남지 않는지 확인한다.
  4. 검증은 `npm --prefix apps/desktop run check` 를 worktree 와 PROJECT_ROOT merge 후 각각 실행한다.
- Wiki context pass (owner-1): `autoflow wiki query` result_count=1 이며 현재 `tickets/done/prd_059/prd_059.md` PRD 자체만 관련 결과로 확인됐다. 별도 선행 결정/반복 실패 기록은 없으므로 PRD 의 scoped CSS/Dialog wrapper 제약을 따른다.

- Runtime hydrated worktree dependency at 2026-04-29T23:36:35Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- AI worker prepared todo at 2026-04-29T23:36:35Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/Todo-061; run=tickets/inprogress/verify_061.md
- Prepared worktree commit edcf93d90221452da9eddaa781820f8ef2535cfd at 2026-04-29T23:41:50Z; Impl AI integrates it into PROJECT_ROOT and the inline finalizer creates the local completion commit.
- Impl AI worker marked verification pass at 2026-04-29T23:41:50Z; runtime finalizer will not perform merge operations.
- Merge finalizer verified at 2026-04-29T23:41:51Z: AI already integrated worktree commit edcf93d90221452da9eddaa781820f8ef2535cfd into PROJECT_ROOT; script performed no rebase or cherry-pick.
- Inline merge finalizer (worker worker) finalized this verified ticket at 2026-04-29T23:41:51Z.
- Coordinator post-merge cleanup at 2026-04-29T23:41:51Z: removed_worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/Todo-061 deleted_branch=autoflow/Todo-061.
## Verification
- Run file: `tickets/done/prd_059/verify_061.md`
- Log file: `logs/verifier_061_20260429_234151Z_pass.md`
- Result: passed

## Result

- Summary: Tickets detail layer opens without stale first-frame content or backdrop class mismatch
- Remaining risk: Visual runtime confirmation was not performed in an in-app browser/desktop shell in this adapter turn; static state-flow review and desktop check passed.
