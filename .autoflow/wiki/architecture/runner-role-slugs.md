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

As of the latest deterministic wiki refresh, the project utilizes role-based identifiers for its stable 3-runner topology, namely `planner-1`, `owner-1`, and `wiki-1`. For further context, see [[project-overview]].

For a detailed explanation of the distinction between these internal identifiers and conceptual role labels, refer to [[architecture/runner-id-roles]].

Ticket `tickets_012` confirmed the consistency of the existing role-aligned runner ID scheme with [[sources/agent-definitions]] and active configuration. It's important to note that while `owner` is used internally, user-facing labels have been normalized to `worker`, as detailed in [[decisions/worker-display-policy]].

This ensures clarity and consistency across the project regarding runner responsibilities.
