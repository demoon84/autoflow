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
- Done tickets: 19
- Reject records: 1
- Verifier logs: 210
- Conversation handoffs: 1
- Last updated: 2026-04-27T15:52:48Z

## Latest Completed Work

- `tickets_002` - AI work for prd_002. test Source: `tickets/done/prd_002/tickets_002.md`.
- `tickets_006` - AI work for prd_006. allow unrelated dirty root paths while preserving Allowed Paths conflict checks Source: `tickets/done/prd_006/tickets_006.md`.
- `tickets_007` - AI work for prd_007. Update AI workflow card meta to 3-line agent/id/progress display Source: `tickets/done/prd_007/tickets_007.md`.
- `tickets_008` - AI work for prd_008. Add bounded reject auto-replan flow for ticket-owner runtime Source: `tickets/done/prd_008/tickets_008.md`.
- `tickets_009` - AI work for prd_009. All PRD-009 features (display_worker_id, board script AI-N normalization, markdown-viewer transform, AGENTS.md/CLAUDE.md rule 16) verified present on base commit. Fixed pre-existing git_root unbound variable bug in merge-ready-ticket.sh to unblock smoke test. All Done When criteria pass: tsc clean, syntax clean, smoke passes, mirror diffs clean. Source: `tickets/done/prd_009/tickets_009.md`.
- `tickets_010` - AI work for prd_010. Add desktop tickets kanban view with dialog preview and board counts Source: `tickets/done/prd_010/tickets_010.md`.
- `tickets_011` - AI work for prd_011. Replace ticket board with tabbed PRD/ticket workspace Source: `tickets/done/prd_011/tickets_011.md`.
- `tickets_013` - Hoist code-volume + token-usage stat strip above TicketBoard on 작업 흐름 page. Workflow stat strip reuses ReportingDashboard metric counts above the workflow board; tsc and desktop check pass. Source: `tickets/done/prd_013/tickets_013.md`.

## Recent Handoffs

- PRD Handoff. Source: `conversations/prd_022/spec-handoff.md`.
<!-- AUTOFLOW:END project-summary -->
