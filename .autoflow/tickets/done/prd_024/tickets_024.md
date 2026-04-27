# Ticket

## Ticket

- ID: tickets_024
- PRD Key: prd_024
- Plan Candidate: Plan AI handoff from tickets/done/prd_024/prd_024.md
- Title: Convert ticket workspace right preview into a click-to-open detail layer
- Stage: done
- AI: AI-1
- Claimed By: AI-1
- Execution AI: AI-1
- Verifier AI: AI-1
- Last Updated: 2026-04-27T15:26:44Z

## Goal

- 이번 작업의 목표: 데스크톱 `티켓 정보` 페이지의 우측 고정 preview pane 을 제거하고, PRD/ticket 카드 클릭 시 작업 흐름의 `WorkflowPinLayer` 와 같은 shadcn `Dialog` 기반 layer 로 해당 markdown 본문과 메타데이터를 읽게 한다.

## References

- PRD: tickets/done/prd_024/prd_024.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Obsidian Links

- Project Note: [[prd_024]]
- Plan Note:
- Ticket Note: [[tickets_024]]

## Allowed Paths

- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`

## Worktree
- Path: `/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_024`
- Branch: autoflow/tickets_024
- Base Commit: 7f23bc972578da6ff7f91d2bc15cdd3f6153ac2b
- Worktree Commit: a8a7cb231649ae56a37d26590cc9e334978dc8e7
- Integration Status: integrated

## Done When

- [ ] 티켓 정보 페이지 진입 시 우측 미리보기 column 이 보이지 않고, 카드 리스트가 화면 폭 전체를 사용한다.
- [ ] `TicketWorkspaceDetailPane` 또는 동등한 우측 상세 pane 이 더 이상 기본 읽기 흐름에 렌더되지 않는다.
- [ ] 어느 카드 (`Ticket-NNN` 또는 `PRD-NNN`) 든 클릭하면 dialog 레이어가 열려 해당 항목의 본문이 표시된다.
- [ ] 레이어 헤더에 카드와 동일한 식별자, 단계 badge, 마지막 업데이트, 파일 경로가 보인다.
- [ ] 레이어 메타 라인에 ID / PRD Key / Stage / AI / Claimed By / Last Updated 가 표시되고, 사용자 노출 AI 값은 `AI-N` 형태로 정규화된다.
- [ ] 레이어 본문이 ticket / PRD markdown 의 표준 섹션을 정상 렌더한다 (`MarkdownViewer` 와 동일 톤).
- [ ] ESC, 배경 클릭, 닫기 버튼 모두로 레이어가 닫힌다.
- [ ] 카드가 `<button>` 또는 동등한 접근성 role 로 동작하고 visible focus ring 이 있다.
- [ ] 레이어 오픈 시 focus 가 닫기 버튼 또는 본문 첫 element 로 이동하고, 닫힌 뒤 클릭한 카드로 focus 복귀.
- [ ] 다른 카드를 클릭하면 기존 레이어 내용이 새 카드 내용으로 교체되거나 (또는 닫힘 후 다시 오픈) 깜빡임 없이 자연스럽게 전환된다.
- [ ] 탭 전환 (`PRD` ↔ `발급 티켓`) 시 열려 있던 레이어가 닫히거나 / 그대로 유지되는 정책이 일관된다 (권장: 탭 전환 시 자동 닫힘).
- [ ] `cd apps/desktop && npx tsc --noEmit` 가 0 errors.
- [ ] `cd apps/desktop && npm run check` 가 통과한다.
- [ ] 시각 회귀: 작업 흐름·통계·Wiki·AI 관리 페이지 영향 없음.

## Next Action
- Complete: coordinator integrated the verified ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: `start-ticket-owner.sh` returned `status=resume`, `ticket_id=024`, `implementation_root=/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_024`, and `run=tickets/inprogress/verify_024.md`. Owner implementation is proceeding in the ticket worktree only.
- 직전 작업: wiki query was rerun with terms `ticket workspace`, `WorkflowPinLayer`, `TicketWorkspaceDetailPane`, `readBoardFile`, and `apps/desktop/src/renderer/main.tsx`; relevant hits were `tickets/done/prd_019/tickets_019.md`, `tickets/done/prd_024/prd_024.md`, and `tickets/done/prd_015/tickets_015.md`.
- 재개 시 먼저 볼 것: `apps/desktop/src/renderer/main.tsx` 의 `TicketWorkspaceDetailPane`, `TicketWorkspace`, `WorkflowPinLayer`, `ticketWorkspaceFiles`, `extractTicketWorkspaceMeta`, `window.autoflow.readBoardFile` usage. CSS 는 `.ticket-workspace-*`, `.workflow-pin-layer-*`, `.markdown-viewer` 부근을 확인한다.

## Notes

- Created by planner-1 (Plan AI) from tickets/done/prd_024/prd_024.md at 2026-04-27T13:35:14Z.
- Wiki context: `tickets/done/prd_010/prd_010.md` established the read-only ticket board card-click pattern using shadcn `Dialog`, `readBoardFile`, and `MarkdownViewer`; reuse that data-loading surface, do not add backend IPC.
- Wiki context: `tickets/done/prd_011/prd_011.md` created the current tabbed PRD/ticket reading workspace with a left list and right `MarkdownViewer` detail pane. This ticket intentionally removes that right pane from the steady-state layout and makes detail viewing explicit via layer.
- Wiki context: `tickets/done/prd_019/tickets_019.md` reduced the ticket workspace to `PRD` and `발급 티켓` tabs with `issued` default and legacy localStorage fallback. Preserve that two-tab behavior while changing the detail presentation.
- Queue / overlap note: `tickets/todo/tickets_023.md` is still pending and also touches `apps/desktop/src/renderer/styles.css` around `.workflow-pin*`. If it lands first, keep its border/tint normalization and only add ticket-detail-layer styles needed for this ticket.
- Scope: two product files only: `main.tsx` for state, click handlers, layer component, focus behavior, and detail content loading; `styles.css` for full-width ticket workspace layout and layer-specific styles.
- Planner tick metric snapshot: `./bin/autoflow metrics` at 2026-04-27T13:36:31Z reported `completion_rate_percent=65.0`, `spec_backlog_count=1`, `ticket_todo_count=3`, `ticket_inprogress_count=4`.
- Implementation hints:
  1. Add `activeTicketLayerId: string | null` or equivalent selected item state at page scope; close it on `PRD` / `발급 티켓` tab changes.
  2. Convert PRD/ticket cards to accessible buttons without nested-button violations; keep current card visual design.
  3. Remove the `ticket-workspace-detail-pane` column from the rendered grid so the list consumes full width.
  4. Reuse the existing `Dialog` + `MarkdownViewer` + `readBoardFile` flow from `WorkflowPinLayer` / ticket dialog patterns for a `TicketDetailLayer` or local equivalent.
  5. Header should show display id, status badge, modified time, and file path; meta grid should show ID / PRD Key / Stage / AI / Claimed By / Last Updated with AI labels normalized to `AI-N`.
  6. Preserve current PRD/ticket tab filtering from `prd_019`; only the reading surface changes.
  7. Verify type/check commands and do a visual spot-check of ticket workspace, workflow page, statistics, Wiki, and AI management pages.

- Runtime hydrated worktree dependency at 2026-04-27T15:06:12Z: linked apps/desktop/node_modules -> /Users/demoon/Documents/project/autoflow/apps/desktop/node_modules
- Runtime hydrated worktree dependency at 2026-04-27T15:06:12Z: linked node_modules -> /Users/demoon/Documents/project/autoflow/node_modules
- AI AI-1 prepared todo at 2026-04-27T15:06:11Z; worktree=/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_024; run=tickets/inprogress/verify_024.md
- AI AI-1 prepared resume at 2026-04-27T15:06:52Z; worktree=/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_024; run=tickets/inprogress/verify_024.md
- Mini-plan by AI-1 at 2026-04-27T15:07:48Z:
  1. Keep the `PRD` / `발급 티켓` workspace tabs from `tickets/done/prd_019/tickets_019.md`; close any open detail layer on tab changes.
  2. Replace default selected-file/detail-pane state with `activeDetailItem` Dialog state loaded through existing `window.autoflow.readBoardFile` and rendered with `MarkdownViewer`, following the `WorkflowPinLayer` shadcn Dialog pattern from `tickets/done/prd_024/prd_024.md` / `tickets/done/prd_015/tickets_015.md`.
  3. Render every PRD/ticket row as an accessible button that opens the layer, with visible focus ring and focus restoration to the clicked card.
  4. Add layer header/meta content for display ID, stage badge, modified time, path, and ID / PRD Key / Stage / AI / Claimed By / Last Updated with AI labels normalized through `displayWorkflowRunnerId`.
  5. Remove the steady-state right detail pane styles and make the list consume the full ticket workspace width.
- AI AI-1 prepared resume at 2026-04-27T15:10:09Z; worktree=/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_024; run=tickets/inprogress/verify_024.md
- AI AI-1 prepared resume at 2026-04-27T15:10:50Z; worktree=/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_024; run=tickets/inprogress/verify_024.md
- Ticket owner verification failed by AI-1 at 2026-04-27T15:13:41Z: command exited 127
- Ticket owner verification passed by AI-1 at 2026-04-27T15:14:02Z: command exited 0
- Auto-resume finish-pass created recovery worktree commit at 2026-04-27T15:17:41Z for dropped owner tick.
- Auto-resume finish-pass at 2026-04-27T15:17:41Z: invoking finish-ticket-owner pass for previously passed inprogress ticket.
- Impl AI AI-1 marked verification pass at 2026-04-27T15:17:42Z and triggered inline merge.
- Coordinator rebase onto PROJECT_ROOT HEAD 7f23bc972578da6ff7f91d2bc15cdd3f6153ac2b failed at 2026-04-27T15:17:42Z; ticket-owner must resolve conflicts in /Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_024 (e.g. `git -C /Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_024 rebase 7f23bc972578da6ff7f91d2bc15cdd3f6153ac2b`) before re-queuing. Tail: hint: To abort and get back to the state before "git rebase", run "git rebase --abort". hint: Disable this message with "git config set advice.mergeConflict false" Could not apply e13e55d... # [Remove left-border color accents from AI progress cards and all workflow pin bars] auto-resumed by recovery path
- Impl AI AI-1 flagged merge_blocked in place at 2026-04-27T15:17:42Z: rebase_conflict.
- Auto-resume finish-pass paused at 2026-04-27T15:18:42Z: merge blocker still needs repair (blocked_rebase_conflict).
- Coordinator rebased worktree onto PROJECT_ROOT HEAD 0f81b49367d2bf609dc04e827e9051f5bbccaf4b at 2026-04-27T15:26:44Z (Worktree Commit: 7d661ccc8e197c6f55a38a4ecc9370c2c36a1cbc -> a8a7cb231649ae56a37d26590cc9e334978dc8e7).
- Coordinator 019dc89c-5138-74e1-90fe-1fff92599a14 integrated worktree commit a8a7cb231649ae56a37d26590cc9e334978dc8e7 into PROJECT_ROOT without committing at 2026-04-27T15:26:44Z.
- Coordinator 019dc89c-5138-74e1-90fe-1fff92599a14 finalized this verified ticket at 2026-04-27T15:26:44Z.
- Coordinator post-merge cleanup at 2026-04-27T15:26:44Z: removed_worktree=/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_024 deleted_branch=autoflow/tickets_024.
## Verification
- Run file: `tickets/done/prd_024/verify_024.md`
- Log file: `logs/verifier_024_20260427_152644Z_pass.md`
- Result: passed

## Result

- Summary: auto-resumed by recovery path
- Remaining risk:
