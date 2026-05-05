---
kind: synth_answer
created: 2026-05-05T00:00:00Z
updated: 2026-05-05T00:00:00Z
terms:
  - Adapter Heartbeat
  - Stale Detection
  - Chunk Timestamping
  - Runner State
  - CLI Commands
  - Policies
  - Verification
  - Smoke Test
citations:
  - tickets_177
  - PRD 178
  - logs/verifier_177_20260505_001334Z_pass.md
---
# PRD 178: Adapter-Running State Heartbeat

## Summary

This document summarizes the work done for PRD 178, which addresses issues with runner state staleness during long adapter calls. The implementation introduces periodic adapter heartbeats and optional chunk timestamps to ensure the runner state accurately reflects ongoing adapter activity, preventing false positives for stale detections.

## Key Features

- **Periodic Adapter Heartbeat**: Implemented a mechanism to send regular heartbeats from long-running adapters to update their last event timestamp.
- **Optional Chunk Timestamping**: Added functionality to record a timestamp for the last adapter output chunk when available.
- **Corrected Stale Detection Logic**: Updated the desktop UI's stale detection logic to use the freshest timestamp between the general heartbeat and the adapter chunk timestamp.
- **Preservation of Runner Contracts**: Maintained compatibility with existing runner contracts, including `run_with_timeout`'s behavior for stdin preservation, timeout exit codes (124), and fast-exit watchdog cleanup.

## Key Outcomes

- **Verification**: All verification steps, including shell syntax checks, smoke tests, and desktop build checks, passed successfully.
- **Smoke Test Results**: The smoke test verified that long adapter calls are not incorrectly marked as stuck, and that the runner state accurately reflects ongoing activity through heartbeats and chunk timestamps.
- **Code Integrity**: Passed `npm run desktop:check`.
- **Project Health**: No critical issues or blockers identified post-implementation.

## Related Tickets and PRDs

- **Primary Ticket**: `tickets_177`
- **Related PRD**: `prd_178`
- **Dependencies/Context**: Mentions of `PRD 142` (watchdog/process-tree cleanup), `PRD 125` (stdin preservation), `order_159` (response delay), and `PRD 135`. The work builds upon prior ticket `prd_142` and `prd_125`.

## Wiki/Board Notes

- The implementation preserved prior runner contracts and focused on adding adapter-running freshness signals.
- Wiki queries confirmed the approach and identified relevant prior work.
- The desktop UI now uses the freshest timestamp (heartbeat or chunk) for stale detection.

## Artifacts

- **Log File**: `logs/verifier_177_20260505_001334Z_pass.md`
- **Ticket Path**: `tickets/done/prd_178/tickets_177.md`
- **Verification Path**: `tickets/done/prd_178/verify_177.md`
- **Smoke Test Script**: `tests/smoke/runner-adapter-heartbeat-smoke.sh`
