---
kind: feature
slug: worker-lifecycle-isolation
title: "Worker Lifecycle Isolation"
created: 2026-05-02T12:00:00Z
updated: 2026-05-02T12:00:00Z
tags:
  - feature
  - worker
  - isolation
  - worktree
---

# Worker Lifecycle Isolation

## Overview
Worker Lifecycle Isolation ensures that implementation, verification, and board updates performed by a Worker do not pollute the main working tree until they are explicitly finalized. This is achieved through the use of per-ticket Git worktrees or branches.

## Isolation Contract

- **Creation**: At the start of a ticket (`start-ticket-owner.sh`), an isolation context (usually a Git worktree) is created. The path and base commit are recorded in the ticket metadata.
- **Execution**: All product code changes, verifier logs, and intermediate board states are kept within this isolation context.
- **Finalization**: The only point where changes are reflected in the main working tree is during the finalization step (`finish-ticket-owner.sh`). This step is intended to be atomic, followed immediately by a commit and cleanup.
- **Safety**: If a worker fails, rejects, or hits a retry limit, the main working tree remains clean. The failed state is preserved in the isolation context for manual inspection or replanning.

## Benefits
- **Parallelism Safety**: Prevents multiple workers (if enabled in the future) or manual edits from conflicting in the same working tree.
- **Clean State**: Ensures that the `PROJECT_ROOT` always represents a stable or explicitly merging state.
- **Auditability**: Each ticket has a clear, isolated trail of implementation evidence.

## Origins
- **Design**: Introduced in `prd_093` to resolve frequent `dirty_scope_conflict` issues and improve system robustness.

## Citations
- `tickets/done/prd_093/prd_093.md`
- `tickets/done/prd_093/tickets_091.md`
