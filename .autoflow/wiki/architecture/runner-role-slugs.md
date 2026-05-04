---
kind: architecture
slug: runner-role-slugs
title: "Runner Role Slugs"
created: 2026-04-27T15:19:53Z
updated: 2026-05-02T01:15:50Z
tags:
  - architecture
  - runner-role-slugs
---

# Runner Role Slugs

This page describes the naming conventions for runners in the Autoflow project.

As of the latest deterministic wiki refresh, the project utilizes role-based identifiers for its stable 3-runner topology, namely `planner-1`, `owner-1`, and `wiki-1`. While `owner-1` is used internally, its user-facing label has been normalized to `worker`. Similarly, `wiki-1` is internally used, but its user-facing label is `WikiBot`. For further context, see [[project-overview]].

For a detailed explanation of the distinction between these internal identifiers and conceptual role labels, refer to [[runner-id-roles]].

Ticket `tickets_012` was a historical runner-id rename proposal that was not applied, thus preserving the existing role-aligned runner ID scheme consistent with agent definitions and active configuration. It's important to note that while `owner` is used internally, user-facing labels have been normalized to `worker`, as detailed in [[decisions/worker-display-policy]].

This ensures clarity and consistency across the project regarding runner responsibilities.
