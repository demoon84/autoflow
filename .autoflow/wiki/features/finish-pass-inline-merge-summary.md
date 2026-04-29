---
kind: feature
slug: finish-pass-inline-merge-summary
title: "Finish-Pass Inline Merge Summary"
created: 2026-04-29T15:54:31Z
updated: 2026-04-29T15:54:31Z
tags:
  - feature
  - finish-pass-inline-merge-summary
  - features
---

# Finish-Pass Inline Merge Summary

## Overview

Successful `finish-ticket-owner.sh` pass finalization now collapses the inline merge output to a single summary line instead of echoing the full `merge-ready-ticket.sh` stdout/stderr block.

## Current Constraints

- `prd_048` changed only the success path where `inline_merge_exit=0` and `inline_merge_status=done`.
- That path now prints `inline_merge=done; wiki+log written` instead of the previous `inline_merge.output_begin` / `inline_merge.output_end` block.
- Diagnostic paths such as `needs_ai_merge`, `blocked`, non-zero exits, or missing success state must continue to emit the full inline merge output block for debugging.
- `.autoflow/scripts/finish-ticket-owner.sh` and `runtime/board-scripts/finish-ticket-owner.sh` must stay behaviorally aligned, following the same mirror-script constraint already enforced by earlier runtime tickets.

## Reusable Guidance

- Treat successful finalization output size as part of prompt hygiene because the finish-pass summary is fed into later runner turns and logs.
- Reduce noise only on the fully successful path; keep verbose output for merge recovery and blocker diagnosis.
- When a runtime script exists in both board and runtime copies, preserve behavior parity instead of optimizing one side in isolation.

## Sources

- `tickets/done/prd_048/tickets_048.md`
- `tickets/done/prd_048/verify_048.md`
- `tickets/done/prd_048/prd_048.md`
- Related prior constraints: `tickets/done/prd_009/tickets_009.md`, `tickets/done/prd_006/tickets_006.md`
