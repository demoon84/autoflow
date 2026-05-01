---
kind: feature
slug: reject-auto-replan
title: "Reject Auto-Replan"
created: 2026-05-02T12:00:00Z
updated: 2026-05-02T12:00:00Z
tags:
  - feature
  - reject-auto-replan
  - recovery
  - planner
---

# Reject Auto-Replan

## Overview
Reject Auto-Replan is a safety and efficiency mechanism that automatically handles rejected tickets. Instead of requiring manual intervention for every failure, the system can automatically return a rejected ticket to the `todo` queue for another attempt, provided it hasn't exceeded the retry limit.

## Mechanisms

- **Retry Limit**: The system uses `AUTOFLOW_REJECT_MAX_RETRIES` to cap the number of automatic retries.
  - **Default Limit**: The default limit was recently reduced from 10 to **3** to reduce cost and surface persistent issues faster (`tickets/done/prd_097/prd_097.md`).
  - **Override**: Can be overridden via environment variables or per-ticket `Retry → Max Retries` fields.
- **Orchestration**: When a ticket reaches its retry limit, the Planner AI (Orchestrator) intercepts the signal and transitions the ticket to a durable recovery state.
  - **Recovery Signal**: Emits `reason=max_retries_reached`.
  - **Needs User**: Tickets that fail repeatedly are parked in `Recovery State: needs_user` with a `Failure Class: retry_limit` to prevent infinite loops (`tickets/done/prd_092/prd_092.md`).
- **Isolation**: To prevent a failing ticket from polluting the main branch, workers use isolated worktrees/branches. If an auto-replan is triggered, the isolation context ensures the main working tree remains clean (`tickets/done/prd_093/prd_093.md`).

## Origins
- **Initial Implementation**: Introduced in `prd_008` to handle transient failures.
- **Orchestrator Integration**: `prd_092` shifted responsibility to the Planner AI for better visibility and manual recovery paths.
- **Policy Refinement**: `prd_097` lowered the default threshold for better operational efficiency.

## Citations
- `tickets/done/prd_008/tickets_008.md`
- `tickets/done/prd_092/prd_092.md`
- `tickets/done/prd_097/prd_097.md`
