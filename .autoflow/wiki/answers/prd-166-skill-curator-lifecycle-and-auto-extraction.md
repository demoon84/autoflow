---
kind: synth_answer
created: 2026-05-04T00:00:00Z
updated: 2026-05-05T00:00:00Z
terms:
  - Skill Curator Lifecycle
  - Auto-Extraction
  - Nudge Guard
  - CLI Commands
  - Policies
  - Verification
  - Smoke Test
citations:
  - tickets_164
  - PRD 166
  - logs/verifier_164_20260504_215445Z_pass.md
---
# PRD 166: Skill Curator Lifecycle and Auto-Extraction

## Summary

This document summarizes the work done for PRD 166, focusing on establishing the lifecycle management for skills, implementing auto-extraction triggers, and adding related CLI commands and policies. The implementation involved creating a curator mechanism that handles skill staleness, archiving, and automated extraction based on predefined triggers.

## Key Features

- **Curator Lifecycle Management**: Implemented logic for managing skills based on their usage.
  - Skills unused for 30 days are marked as stale.
  - Skills unused for 90 days are moved to archive.
  - Pinned skills bypass these lifecycle rules.
- **Auto-Extraction Triggers**: Developed four distinct triggers for automatically extracting and creating new skills.
- **Nudge Guard**: Incorporated a mechanism to prevent recursive nudges.
- **CLI Commands and Policies**: Added necessary CLI commands and updated relevant policies to support the new curator functionality.
- **Verification**: Passed all verification criteria, including smoke tests for trigger functionality and lifecycle management, and ensured compatibility with existing runner contracts.

## Key Outcomes

- **Verification**: All verification steps, including shell syntax checks, smoke tests, direct curator runs, desktop checks, and git diff, passed successfully.
- **Smoke Test Results**: The smoke test confirmed the creation of skills for various scenarios (ticket completion, reject turnaround, blocked recovery, orchestration cleanup, skill nudge), with correct counts for reviewed, stale, archived, and skipped skills.
- **Code Integrity**: Passed `npm run desktop:check` and `git diff --check`.
- **Project Health**: No critical issues or blockers identified post-implementation.

## Related Tickets and PRDs

- **Primary Ticket**: `tickets_164`
- **Related PRD**: `prd_166`
- **Dependencies/Context**: Mentions of `PRD 158` (cache hit rate monitoring), `PRD 159` (order tab workflow), `PRD 161` (desktop UI refinements), `PRD 162`/`PRD 163` (Phase 3/4 work, not part of this ticket's scope), `PRD 165` (Phase 5 security/import/clustering/deterministic mode), and `PRD 164` (dirty worktree).

## Wiki/Board Notes

- The implementation preserved existing runner contracts and policies, focusing specifically on the curator lifecycle and auto-extraction triggers.
- Wiki queries for related terms did not surface direct prior constraints that would alter the cleanup decisions.
- Leftover worktrees (`tickets_119`, `tickets_163`) were noted but not reset by the planner during this ticket's execution.
- The recovery path for `dirty_project_root_conflict` was utilized.

## Artifacts

- **Log File**: `logs/verifier_164_20260504_215445Z_pass.md`
- **Ticket Path**: `tickets/done/prd_166/tickets_164.md`
- **Verification Path**: `tickets/done/prd_166/verify_164.md`
- **Smoke Test Script**: `tests/smoke/skill-curator-auto-extract-smoke.sh`
