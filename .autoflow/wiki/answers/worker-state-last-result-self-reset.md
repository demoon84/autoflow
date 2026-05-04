---
kind: answer
slug: worker-state-last-result-self-reset
created: 2026-05-05T10:00:00Z
updated: 2026-05-05T10:00:00Z
source: "prd_169"
---

# worker.state.last_result Stale State Self-Reset Fix

## Summary

This answer synthesizes the fix for a recurring issue where the `worker.state.last_result` field would incorrectly remain set to `ticket_stage_blocked` even after project cleanup. This led to the user interface persistently displaying workers as "blocked" when they were not. The solution involves implementing a self-reset mechanism at the start of each worker tick, coupled with an explicit reset after the planner's cleanup phase. This ensures that the worker's displayed status accurately reflects its current operational state.

## Problem Description

Even after successful project root cleanup and blocked orchestration resolution, the `worker.state.last_result` field could retain the `ticket_stage_blocked` value. This resulted in a stale "blocked" status in monitoring and desktop UIs.

## Solution Details

The fix involves two key changes:
1.  **Worker Tick Self-Reset:** At the beginning of each worker tick, the `worker.state.last_result` is reset.
2.  **Explicit Planner Cleanup Reset:** Following the planner's cleanup process, an explicit reset is applied to `worker.state.last_result`.

These measures work in tandem to ensure the `worker.state.last_result` is always synchronized with the worker's actual operational status, preventing false "blocked" indications.

## Entities Involved

- Planner orchestration runtime
- Worker tick dispatcher
- Shared planner/worker helpers

## Related Concepts

- `worker.state.last_result`
- `ticket_stage_blocked`
- Race-safe operations
- Explicit reset mechanisms

## Source Document

- [[sources/prd-169-handoff]] (`wiki-raw/prd_169.md`)
