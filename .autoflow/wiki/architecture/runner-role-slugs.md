---
kind: architecture
slug: runner-role-slugs
title: "Runner Role Slugs"
created: 2026-04-27T15:19:53Z
updated: 2026-05-09T05:55:00Z
tags:
  - architecture
  - runner-role-slugs
---

# Runner Role Slugs

This page describes the naming conventions for runners in the Autoflow project.

As of the latest deterministic wiki refresh, the project utilizes role-based identifiers for its stable **3-runner topology**, namely `planner`, `worker`, and `wiki`. 

### Evolution of Topology
- **Current (since 2026-05-07)**: 3-runner topology (Planner, Worker, LLM Wiki).
- **Historical**: A 4-runner topology included a dedicated `verifier` runner, which was removed on 2026-05-07 as its sanity gate functions were integrated into the `worker` finalizer.

### User-facing Labels
While internal IDs are used, user-facing labels have been normalized for clarity:
- `worker`: User-facing label is **Worker**.
- `wiki`: User-facing label is **LLM Wiki** (renamed from *WikiBot* in [[sources/prd_210]]).
- `planner`: User-facing label is **Planner**.

For further context, see [[project-overview]] and [[architecture/runner-id-roles]].

Ticket `tickets_012` was a historical runner-id rename proposal that was not applied, thus preserving the existing role-aligned runner ID scheme consistent with agent definitions and active configuration. It's important to note that while `owner` was used internally in legacy contexts, user-facing labels have been normalized to **Worker**, as detailed in [[decisions/worker-display-policy]].

This ensures clarity and consistency across the project regarding runner responsibilities.
