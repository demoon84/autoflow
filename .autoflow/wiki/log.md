# Wiki Log

Chronological notes derived from completed tickets, reject learnings, and operational logs.

## Managed Log

Generated entries may be inserted here.
This curated milestone list summarizes representative milestones from the early board foundation through the recent wiki/runtime refinements. For current counts and broader work context, use [[index]] and [[project-overview]].
Recent synthesis answers for newer completed work are intentionally filed back through [[index]]; for example, May 1 additions covering `prd_088`, `prd_089`, and `prd_090` are linked under `Recent Synthesis` there rather than repeated verbatim in this historical timeline.
The managed `Derived Timeline` below is a deterministic baseline sample, not a full recency-sorted changelog. Treat [[index]] `Recent Synthesis` as the entrypoint for newer focused work.

Each entry should cite its source ticket or log.

- `prd_001` - Restructure Wiki & Handoff panel — handoff as wiki source, not a peer. Source: `tickets/done/prd_001/prd_001.md`.
- `prd_004` - Add in-app Help section explaining sidebar and core terms. Source: `tickets/done/prd_004/prd_004.md`.
- `prd_005` - Rename "spec" terminology to "PRD" (UI + docs + CLI alias). Source: `tickets/done/prd_005/prd_005.md`.
- `prd_012` - Historical runner-id rename proposal. The ticket was closed as superseded and the proposed changes were not applied, preserving the existing runner ID topology. Source: `tickets/done/prd_012/tickets_012.md`.
- `prd_016` - Pin AI progress board to a 2-left / 1-right tall layout when three runners are present. Source: `tickets/done/prd_016/tickets_016.md`.
- `prd_021` - Workflow page UI overhaul — collapse sidebar label, wrap progress bar, simplify card titles, hoist AI controls into the cards. Source: `tickets/done/prd_021/tickets_021.md`.
- `prd_023` - Remove left-border color accents from AI progress cards and all workflow pin bars. Source: `tickets/done/prd_023/tickets_023.md`.
- `learning` - Recorded how to resolve `dirty_scope_conflict` when the ticket patch is already present in `PROJECT_ROOT` but unrelated dirty edits remain in the same file. See [[answers/merge-blocked-already-applied-patch-summary]].
- `prd_024` - Convert ticket workspace right preview into a click-to-open layer like the workflow PRD pin. Source: `tickets/done/prd_024/tickets_024.md`.
- `learning` - Manual Recovery and Worktree Consolidation (2026-04-27). See [[learnings/manual-merge-recovery-20260427]] for the consolidation path that resolved dirty-scope conflicts around tickets 012, 016, 021, and 025.
- `prd_025` - Audit AI progress stages and fix dot alignment so the bar matches runtime-observable signals. Source: `tickets/done/prd_025/prd_025.md`.
- `prd_026` - Fix Gemini app icon in Desktop AI runner UI. Source: `tickets/done/prd_026/prd_026.md`.
- `prd_027` - Historical design-kit migration attempt from shadcn/Radix/Tailwind to MUI. Refer to [[decisions/design-kit-mui-migration]] for the current rule that new Desktop UI work prefers local shadcn-style components. Source: `tickets/done/prd_027/prd_027.md`.
- `prd_028` - Simplify desktop runner control buttons. Source: `tickets/done/prd_028/prd_028.md`.
- `prd_030` - Add Inbox tab to Ticket Workspace. Source: `tickets/done/prd_030/prd_030.md`.
- `prd_035` - Apply MUI dashboard design to the Statistics page. Source: `tickets/done/prd_035/prd_035.md`.
- `prd_037` - Fix Statistics page scrolling. Source: `tickets/done/prd_037/prd_037.md`.
- `prd_038` - Enable Wiki Bot (`wiki-1`) to use the Codex adapter while preserving Gemini support. Source: `tickets/done/prd_038/tickets_038.md`.
- `prd_039` - Replace user-visible `AI-N` worker attribution with `worker-N` (later normalized to `Worker AI` in the UI) while keeping legacy ownership matching compatible. Source: `tickets/done/prd_039/tickets_039.md`.
- `prd_040` - Removed unsupported Gemini 3.1 preview model ids from Desktop runner options. Source: `tickets/done/prd_040/tickets_040.md`.
- `prd_042` - Kept the Ticket Workspace on the PRD / Inbox / Issued 3-tab layout while left-aligning list rows and preserving the detail layer. Source: `tickets/done/prd_042/tickets_042.md`.
- `prd_045` - Shortened planner `next_action` output while preserving machine-readable runtime keys. Source: `tickets/done/prd_045/tickets_045.md`.
- `prd_047` - Compressed successful `verify-ticket-owner` output into short pass excerpts while keeping larger failure tails. Source: `tickets/done/prd_047/tickets_047.md`.
- `prd_048` - Compressed successful `finish-ticket-owner` inline merge output into a one-line summary while keeping diagnostic paths verbose. Source: `tickets/done/prd_048/tickets_048.md`.
- `prd_050` - Added semantic wiki lint fingerprint gating and prompt-budget smoke coverage. Source: `tickets/done/prd_050/tickets_050.md`.




<!-- AUTOFLOW:BEGIN derived-timeline -->
## Derived Timeline

- Last rebuilt: 2026-05-05T00:04:53Z

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

- # Coordinator Checkpoint Source: `logs/archive/2026-04/coordinator_20260426T125351Z_blocked.md`.
- # Coordinator Log Source: `logs/archive/2026-04/coordinator_20260426T125856Z_blocked.md`.
- # Coordinator Log Source: `logs/archive/2026-04/coordinator_20260426T130531Z_blocked.md`.
- # Coordinator Turn - blocked Source: `logs/archive/2026-04/coordinator_20260426T130920Z_blocked.md`.
- # Coordinator Turn - blocked Source: `logs/archive/2026-04/coordinator_20260426T131244Z_blocked.md`.
- # Coordinator Turn - blocked Source: `logs/archive/2026-04/coordinator_20260426T131652Z_blocked.md`.
- # Coordinator Turn - blocked Source: `logs/archive/2026-04/coordinator_20260426T132004Z_blocked.md`.
- # Manual Worktree Merge Log Source: `logs/archive/2026-04/manual_worktree_merge_20260427_160756Z.md`.
- # Owner Completion Log Source: `logs/archive/2026-04/owner_002_20260426T050634Z_blocked.md`.
- # Owner Completion Log Source: `logs/archive/2026-04/owner_002_20260426T051002Z_blocked.md`.
- # Owner Completion Log Source: `logs/archive/2026-04/owner_002_20260426T052345Z_blocked.md`.
- # Owner Completion Log Source: `logs/archive/2026-04/owner_002_20260426T053051Z_blocked.md`.
- # Owner Completion Log Source: `logs/archive/2026-04/owner_002_20260426T053454Z_blocked.md`.
- # Owner Completion Log Source: `logs/archive/2026-04/owner_002_20260426T054220Z_blocked.md`.
- # Owner Completion Log Source: `logs/archive/2026-04/owner_002_20260426T054535Z_blocked.md`.
- # Owner Completion Log Source: `logs/archive/2026-04/owner_002_20260426T054853Z_blocked.md`.
- # Owner Completion Log Source: `logs/archive/2026-04/owner_002_20260426T055213Z_blocked.md`.
- # Owner Completion Log Source: `logs/archive/2026-04/owner_002_20260426T055648Z_blocked.md`.
- # Owner Completion Log Source: `logs/archive/2026-04/owner_002_20260426T060918Z_blocked.md`.
- # Owner Completion Log Source: `logs/archive/2026-04/owner_002_20260426T061328Z_blocked.md`.
- # adapter-running state heartbeat Source: logs/verifier_177_20260505_001334Z_pass.md
- # repeated preflight failure recovery circuit Source: logs/verifier_179_20260505_003015Z_pass.md
- # telemetry token usage sanity correction Source: logs/verifier_180_20260505_004202Z_pass.md

### Reject Records

- reject_003. Source: `tickets/done/prd_003/reject_003.md`.
- reject_049. Source: `tickets/done/prd_049/reject_049.md`.
- reject_071. Source: `tickets/done/prd_073/reject_071.md`.
- reject_074. Source: `tickets/done/prd_076/reject_074.md`.
- reject_119. Source: `tickets/done/prd_120/reject_119.md`.

### Conversation Handoffs

- PRD Handoff. Source: `conversations/prd_022/spec-handoff.md`.
- PRD Handoff. Source: `conversations/prd_038/spec-handoff.md`.
- PRD Handoff. Source: `conversations/prd_091/spec-handoff.md`.
- PRD Handoff. Source: `conversations/prd_093/spec-handoff.md`.
- PRD Handoff. Source: `conversations/prd_120/spec-handoff.md`.
- PRD Handoff. Source: `conversations/prd_121/spec-handoff.md`.
- PRD Handoff. Source: `conversations/prd_122/spec-handoff.md`.
- PRD Handoff. Source: `conversations/prd_123/spec-handoff.md`.
<!-- AUTOFLOW:END derived-timeline -->
