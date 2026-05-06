---
kind: answer
slug: prd-120-rejection-learning
title: "Persistent Rejection of prd_120 Due to Dirty Project Root and Missing GUI Environment"
created: 2026-05-03T06:46:00Z
updated: 2026-05-03T06:46:00Z
tags:
  - learning
  - prd-120
  - reject-119
  - dirty-project-root
  - gui-verification
---

# Persistent Rejection of prd_120 Due to Dirty Project Root and Missing GUI Environment

## Summary
Ticket `prd_120` (ID 119) was repeatedly rejected due to a `dirty_project_root_conflict` and the inability to perform GUI-dependent verification steps (`desktop readBoard IPC/runner terminal preview`) in the automated environment. The ticket reached its maximum retry budget (3/3) and was parked as `needs_user`.

## Context
The ticket aimed to implement the approved spec for `prd_120`, which involved changes to `packages/cli/run-role.sh`, `packages/cli/runners-project.sh`, `packages/cli/cleanup-runner-logs.sh`, and `bin/autoflow`.

## Observation
The automated runs consistently encountered:
- `dirty_project_root_conflict` on the Allowed Paths, requiring manual intervention to commit or stash changes in the `PROJECT_ROOT`.
- Verification of GUI-dependent functionality (desktop readBoard IPC and runner terminal preview) could not be completed due to the absence of a GUI execution environment.

## Learning
- **Recurring Blocker:** `dirty_project_root_conflict` remains a significant blocker for automated ticket processing, requiring external manual resolution for specific file paths. For more context on similar issues, refer to [[answers/dirty-root-finalization-blockers-20260502]] and [[answers/desktop-renderer-dirty-root-finalization-blocker-20260501]].
- **Environmental Limitation:** Automated testing for GUI-dependent features is currently blocked by the lack of a suitable GUI execution environment. This prevents full verification of certain tickets. For details on runner terminal streaming, see [[answers/desktop-runner-terminal-streaming]].
- **Retry Budget:** Tickets with persistent, out-of-scope blockers will exhaust their retry budget and transition to `needs_user`, requiring human intervention. For the policy on manual resolution, see [[decisions/manual-resolution-policy]].


