# Project Overview

## Summary

Autoflow is an AI-native project orchestration system. 
As of April 27, 2026, the project has reached a stable 3-runner topology (Planner, Worker, Wiki) with a polished Desktop UI.
Total PRDs completed: 26 (15 via automated ticket-owner flow, 11 via direct PRD-to-done transitions).


## Key Decisions

- **[[prd-terminology-rename]]**: Unified requirement terminology from "spec" to "PRD" across UI and documentation (`prd_005`).
- **[[handoff-as-raw-source]]**: Conversation handoffs are treated as raw ingest for the wiki, not as peer wiki outputs (`prd_001`).
- **[[manual-resolution-policy]]**: Repeated automation failures (shared path blocks) require manual intervention (`learnings/ticket-overlap-no-op`).

## Current Work

- Improving agent runner visual feedback and resource tracking (Stat Strip).
- Expanding in-app help and documentation (Help Section).
- Self-improvement loop experimentation (Log-driven trial runner).

## Open Questions

List unresolved questions with owner or source when known.

<!-- AUTOFLOW:BEGIN project-summary -->
## Current Autoflow Summary

- Project root: `/Users/demoon/Documents/project/autoflow`
- Board root: `/Users/demoon/Documents/project/autoflow/.autoflow`
- Done tickets: 17
- Reject records: 1
- Verifier logs: 208
- Conversation handoffs: 1
- Last updated: 2026-04-27T15:26:50Z

## Latest Completed Work

- `tickets_002` - AI work for prd_002. test Source: `tickets/done/prd_002/tickets_002.md`.
- `tickets_006` - AI work for prd_006. allow unrelated dirty root paths while preserving Allowed Paths conflict checks Source: `tickets/done/prd_006/tickets_006.md`.
- `tickets_007` - AI work for prd_007. Update AI workflow card meta to 3-line agent/id/progress display Source: `tickets/done/prd_007/tickets_007.md`.
- `tickets_008` - AI work for prd_008. Add bounded reject auto-replan flow for ticket-owner runtime Source: `tickets/done/prd_008/tickets_008.md`.
- `tickets_009` - AI work for prd_009. All PRD-009 features (display_worker_id, board script AI-N normalization, markdown-viewer transform, AGENTS.md/CLAUDE.md rule 16) verified present on base commit. Fixed pre-existing git_root unbound variable bug in merge-ready-ticket.sh to unblock smoke test. All Done When criteria pass: tsc clean, syntax clean, smoke passes, mirror diffs clean. Source: `tickets/done/prd_009/tickets_009.md`.
- `tickets_010` - AI work for prd_010. Add desktop tickets kanban view with dialog preview and board counts Source: `tickets/done/prd_010/tickets_010.md`.
- `tickets_011` - AI work for prd_011. Replace ticket board with tabbed PRD/ticket workspace Source: `tickets/done/prd_011/tickets_011.md`.
- `tickets_013` - Hoist code-volume + token-usage stat strip above TicketBoard on 작업 흐름 page. Workflow stat strip reuses ReportingDashboard metric counts above the workflow board; tsc and desktop check pass. Source: `tickets/done/prd_013/tickets_013.md`.
- `tickets_014` - Fix planner stage indicator showing "계획" while runtime is idle. Fix planner stage mapping so idle running loops show 대기 and todo creation shows 완료 Source: `tickets/done/prd_014/tickets_014.md`.
- `tickets_015` - Show pending PRD count alongside total in workflow pin label. PRD workflow pin label now shows nonzero pending backlog count and reuses the label for the layer heading. Source: `tickets/done/prd_015/tickets_015.md`.
- `tickets_017` - Restrict Claude reasoning dropdown to medium/high only. Restrict Claude reasoning choices to medium/high and normalize invalid saved Claude values to high Source: `tickets/done/prd_017/tickets_017.md`.
- `tickets_018` - Align workflow stat strip edges with PRD pin bar + show raw token count. Align workflow stat strip edges with PRD pin strip and show raw token counts Source: `tickets/done/prd_018/tickets_018.md`.
- `tickets_019` - Reduce ticket workspace tabs to PRD + 발급 티켓 only. Reduced ticket workspace to PRD and issued-ticket tabs with issued as default and all ticket stages listed. Source: `tickets/done/prd_019/tickets_019.md`.
- `tickets_020` - Auto-resume finish-pass when an inprogress ticket has Result: passed but no commit / merge. auto-resume finish-pass recovery implemented Source: `tickets/done/prd_020/tickets_020.md`.
- `tickets_022` - Log-driven self-improvement trial runner — analyze logs, detect repeated issues, emit safe improvement candidates. self-improvement trial runner implemented and verified Source: `tickets/done/prd_022/tickets_022.md`.
- `tickets_023` - Remove left-border color accents from AI progress cards and all workflow pin bars. auto-resumed by recovery path Source: `tickets/done/prd_023/tickets_023.md`.
- `tickets_024` - Convert ticket workspace right preview into a click-to-open detail layer. auto-resumed by recovery path Source: `tickets/done/prd_024/tickets_024.md`.

## Recent Handoffs

- PRD Handoff. Source: `conversations/prd_022/spec-handoff.md`.
<!-- AUTOFLOW:END project-summary -->
