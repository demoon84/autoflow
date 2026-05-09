---
kind: answer
slug: prd-120-rejection-learning
title: "Persistent Rejection of prd_120 Due to Dirty Project Root and Missing GUI Environment"
created: 2026-05-03T06:46:00Z
updated: 2026-05-08T04:55:00Z
tags:
  - learning
  - prd-120
  - reject-119
  - dirty-project-root
  - gui-verification
citations:
  - tickets/done/prd_120/prd_120.md
  - wiki/sources/prd-120-spec-handoff.md
  - wiki/answers/dirty-root-finalization-blockers-20260502.md
  - wiki/answers/desktop-renderer-dirty-root-finalization-blocker-20260501.md
---

# Persistent Rejection of prd_120 Due to Dirty Project Root and Missing GUI Environment

## Summary
Ticket `prd_120` (ID 119) was initially repeatedly rejected due to a `dirty_project_root_conflict` and the inability to perform GUI-dependent verification steps (`desktop readBoard IPC/runner terminal preview`) in the automated environment. However, the ticket was eventually completed through manual intervention and resolution of the blockers.

## Context
The ticket aimed to implement the approved spec for `prd_120`, which involved changes to `packages/cli/run-role.sh`, `packages/cli/runners-project.sh`, `packages/cli/cleanup-runner-logs.sh`, and `bin/autoflow`.

## Observation
The automated runs encountered:
- `dirty_project_root_conflict` on the Allowed Paths, requiring manual intervention to commit or stash changes in the `PROJECT_ROOT`.
- Verification of GUI-dependent functionality (desktop readBoard IPC and runner terminal preview) could not be completed due to the absence of a GUI execution environment.

## Learning
- **Manual Intervention Requirement:** Some tickets with persistent, out-of-scope blockers like `dirty_project_root_conflict` may exhaust their automated retry budget and require human intervention to complete. For the policy on manual resolution, see [[decisions/manual-resolution-policy]].
- **Environmental Limitation:** Automated testing for GUI-dependent features is currently blocked by the lack of a suitable GUI execution environment. This prevents full verification of certain tickets. For details on runner terminal streaming, see [[answers/desktop-runner-terminal-streaming]].


## Citations
- `tickets/done/prd_120/prd_120.md`
- `wiki/sources/prd-120-spec-handoff.md`
- `wiki/answers/dirty-root-finalization-blockers-20260502.md`
- `wiki/answers/desktop-renderer-dirty-root-finalization-blocker-20260501.md`


