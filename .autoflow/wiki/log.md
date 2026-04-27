# Wiki Log

Chronological notes derived from completed tickets.

## Managed Log

Generated entries may be inserted here.

Each entry should cite its source ticket or log.

- `prd_001` - Restructure Wiki & Handoff panel — handoff as wiki source, not a peer. Source: `tickets/done/prd_001/prd_001.md`.
- `prd_004` - Add in-app Help section explaining sidebar and core terms. Source: `tickets/done/prd_004/prd_004.md`.
- `prd_005` - Rename "spec" terminology to "PRD" (UI + docs + CLI alias). Source: `tickets/done/prd_005/prd_005.md`.
- `prd_012` - Rename runner ids to role-aligned slugs (planner / worker / wiki-maintainer). Source: `tickets/done/prd_012/prd_012.md`.
- `prd_016` - Pin AI progress board to a 2-left / 1-right tall layout when three runners are present. Source: `tickets/done/prd_016/prd_016.md`.
- `prd_021` - Workflow page UI overhaul — collapse sidebar label, wrap progress bar, simplify card titles, hoist AI controls into the cards. Source: `tickets/done/prd_021/prd_021.md`.
- `prd_023` - Remove left-border color accents from AI progress cards and all workflow pin bars. Source: `tickets/done/prd_023/prd_023.md`.
- `learning` - Recorded how to resolve `dirty_scope_conflict` when the ticket patch is already present in `PROJECT_ROOT` but unrelated dirty edits remain in the same file. Source: `learnings/merge-blocked-already-applied-patch.md`.
- `prd_024` - Convert ticket workspace right preview into a click-to-open layer like the workflow PRD pin. Source: `tickets/done/prd_024/prd_024.md`.
- `prd_025` - Audit AI progress stages and fix dot alignment so the bar matches runtime-observable signals. Source: `tickets/done/prd_025/prd_025.md`.
- `prd_026` - Fix Gemini app icon in Desktop AI runner UI. Source: `tickets/done/prd_026/prd_026.md`.


<!-- AUTOFLOW:BEGIN derived-timeline -->
## Derived Timeline

- Last rebuilt: 2026-04-27T16:08:44Z

### Completed Tickets

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

### Verifier Logs

- # Coordinator Checkpoint Source: `logs/coordinator_20260426T125351Z_blocked.md`.
- # Coordinator Log Source: `logs/coordinator_20260426T125856Z_blocked.md`.
- # Coordinator Log Source: `logs/coordinator_20260426T130531Z_blocked.md`.
- # Coordinator Turn - blocked Source: `logs/coordinator_20260426T130920Z_blocked.md`.
- # Coordinator Turn - blocked Source: `logs/coordinator_20260426T131244Z_blocked.md`.
- # Coordinator Turn - blocked Source: `logs/coordinator_20260426T131652Z_blocked.md`.
- # Coordinator Turn - blocked Source: `logs/coordinator_20260426T132004Z_blocked.md`.
- # Manual Worktree Merge Log Source: `logs/manual_worktree_merge_20260427_160756Z.md`.
- # Owner Completion Log Source: `logs/owner_002_20260426T050634Z_blocked.md`.
- # Owner Completion Log Source: `logs/owner_002_20260426T051002Z_blocked.md`.
- # Owner Completion Log Source: `logs/owner_002_20260426T052345Z_blocked.md`.
- # Owner Completion Log Source: `logs/owner_002_20260426T053051Z_blocked.md`.
- # Owner Completion Log Source: `logs/owner_002_20260426T053454Z_blocked.md`.
- # Owner Completion Log Source: `logs/owner_002_20260426T054220Z_blocked.md`.
- # Owner Completion Log Source: `logs/owner_002_20260426T054535Z_blocked.md`.
- # Owner Completion Log Source: `logs/owner_002_20260426T054853Z_blocked.md`.
- # Owner Completion Log Source: `logs/owner_002_20260426T055213Z_blocked.md`.
- # Owner Completion Log Source: `logs/owner_002_20260426T055648Z_blocked.md`.
- # Owner Completion Log Source: `logs/owner_002_20260426T060918Z_blocked.md`.
- # Owner Completion Log Source: `logs/owner_002_20260426T061328Z_blocked.md`.

### Reject Records

- reject_003. Source: `tickets/done/prd_003/reject_003.md`.

### Conversation Handoffs

- PRD Handoff. Source: `conversations/prd_022/spec-handoff.md`.
<!-- AUTOFLOW:END derived-timeline -->
