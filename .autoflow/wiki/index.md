# Wiki Index

This wiki is derived from completed Autoflow work.

## Managed Summary

Generated summaries may be written here by `autoflow wiki update`.

## Recent Synthesis
- **[[manual-merge-recovery-20260427]]**: Documented the manual consolidation of multiple verified worktrees (`prd_012`, `prd_016`, `prd_021`, `prd_025`) to resolve `dirty_scope_conflict` gridlock in `PROJECT_ROOT`.
- **[[desktop-runner-controls]]**: Simplified desktop runner control UI by removing the restart button and "AI" prefixes from start/stop labels (`prd_028`).
- **[[design-kit-mui-migration]]**: Decided to migrate the desktop design kit from shadcn/Tailwind to MUI (Material UI) for better consistency and developer velocity.
- **[[desktop-gemini-icon]]**: Fix Gemini app icon in Desktop AI runner UI. Verified and documented.
- **[[ai-workflow-board]]**: Updated with Worker 4-stage simplification and dot alignment precision from `prd_025`.
- **[[ticket-workspace-tabs]]**: Documented the evolution of the ticket board into a unified tabbed workspace.

## Pages

- [[project-overview]]
- [[log]]
- `features/`
  - [[ai-workflow-board]]
  - [[self-improvement-trial]]
  - [[ticket-workspace-tabs]]
  - [[wiki-preview-flow]]
  - [[auto-resume-recovery]]
  - [[workflow-stat-strip]]
  - [[desktop-gemini-icon]]
  - [[in-app-help]]
  - [[desktop-runner-controls]]
- `decisions/`
  - [[design-kit-mui-migration]]
  - [[manual-resolution-policy]]
  - [[handoff-as-raw-source]]
  - [[prd-terminology-rename]]
  - [[worker-display-policy]]
- `architecture/`
  - [[runner-role-slugs]]
- `learnings/`
  - [[ticket-overlap-no-op]]
  - [[merge-blocked-already-applied-patch]]
  - [[manual-merge-recovery-20260427]]

## Archive
- [[desktop-tickets-kanban]] (Legacy)

## Source Of Truth

Tickets, verification records, and logs remain authoritative.

<!-- AUTOFLOW:BEGIN work-map -->
## Autoflow Work Map

- Done tickets: 28
- Reject records: 1
- Verifier logs: 217
- Conversation handoffs: 1
- Last updated: 2026-04-28T15:35:17Z

## Completed Tickets

- `tickets_002` - AI work for prd_002. test Source: `tickets/done/prd_002/tickets_002.md`.
- `tickets_006` - AI work for prd_006. allow unrelated dirty root paths while preserving Allowed Paths conflict checks Source: `tickets/done/prd_006/tickets_006.md`.
- `tickets_007` - AI work for prd_007. Update AI workflow card meta to 3-line agent/id/progress display Source: `tickets/done/prd_007/tickets_007.md`.
- `tickets_008` - AI work for prd_008. Add bounded reject auto-replan flow for ticket-owner runtime Source: `tickets/done/prd_008/tickets_008.md`.
- `tickets_009` - AI work for prd_009. All PRD-009 features (display_worker_id, board script AI-N normalization, markdown-viewer transform, AGENTS.md/CLAUDE.md rule 16) verified present on base commit. Fixed pre-existing git_root unbound variable bug in merge-ready-ticket.sh to unblock smoke test. All Done When criteria pass: tsc clean, syntax clean, smoke passes, mirror diffs clean. Source: `tickets/done/prd_009/tickets_009.md`.
- `tickets_010` - AI work for prd_010. Add desktop tickets kanban view with dialog preview and board counts Source: `tickets/done/prd_010/tickets_010.md`.
- `tickets_011` - AI work for prd_011. Replace ticket board with tabbed PRD/ticket workspace Source: `tickets/done/prd_011/tickets_011.md`.
- `tickets_012` - Rename runner ids to role-aligned slugs (planner / worker / wiki-maintainer). Stale runner-id rename was not applied; current runner topology remains consistent with AGENTS and active config. Source: `tickets/done/prd_012/tickets_012.md`.
- `tickets_013` - Hoist code-volume + token-usage stat strip above TicketBoard on 작업 흐름 page. Workflow stat strip reuses ReportingDashboard metric counts above the workflow board; tsc and desktop check pass. Source: `tickets/done/prd_013/tickets_013.md`.
- `tickets_014` - Fix planner stage indicator showing "계획" while runtime is idle. Fix planner stage mapping so idle running loops show 대기 and todo creation shows 완료 Source: `tickets/done/prd_014/tickets_014.md`.
- `tickets_015` - Show pending PRD count alongside total in workflow pin label. PRD workflow pin label now shows nonzero pending backlog count and reuses the label for the layer heading. Source: `tickets/done/prd_015/tickets_015.md`.
- `tickets_016` - Pin AI progress board to a 2-left / 1-right tall layout when three runners are present. 3-runner workflow board layout merged into `main` with current AI progress card behavior preserved. Source: `tickets/done/prd_016/tickets_016.md`.
- `tickets_017` - Restrict Claude reasoning dropdown to medium/high only. Restrict Claude reasoning choices to medium/high and normalize invalid saved Claude values to high Source: `tickets/done/prd_017/tickets_017.md`.
- `tickets_018` - Align workflow stat strip edges with PRD pin bar + show raw token count. Align workflow stat strip edges with PRD pin strip and show raw token counts Source: `tickets/done/prd_018/tickets_018.md`.
- `tickets_019` - Reduce ticket workspace tabs to PRD + 발급 티켓 only. Reduced ticket workspace to PRD and issued-ticket tabs with issued as default and all ticket stages listed. Source: `tickets/done/prd_019/tickets_019.md`.
- `tickets_020` - Auto-resume finish-pass when an inprogress ticket has Result: passed but no commit / merge. auto-resume finish-pass recovery implemented Source: `tickets/done/prd_020/tickets_020.md`.
- `tickets_021` - Workflow page UI overhaul — sidebar label, card header simplification, progress wrap, inline controls. Workflow page AI cards now use role-only labels, inline runner controls, synced model/reasoning controls, and wrapping progress dots. Source: `tickets/done/prd_021/tickets_021.md`.
- `tickets_022` - Log-driven self-improvement trial runner — analyze logs, detect repeated issues, emit safe improvement candidates. self-improvement trial runner implemented and verified Source: `tickets/done/prd_022/tickets_022.md`.
- `tickets_023` - Remove left-border color accents from AI progress cards and all workflow pin bars. auto-resumed by recovery path Source: `tickets/done/prd_023/tickets_023.md`.
- `tickets_024` - Convert ticket workspace right preview into a click-to-open detail layer. auto-resumed by recovery path Source: `tickets/done/prd_024/tickets_024.md`.
<!-- AUTOFLOW:END work-map -->
