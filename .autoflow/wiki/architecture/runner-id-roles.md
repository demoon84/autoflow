---
kind: architecture
slug: runner-id-roles
title: "Runner IDs and Conceptual Roles"
created: 2026-05-03T10:54:04Z
updated: 2026-05-03T10:54:04Z
tags:
  - architecture
  - runner-id-roles
---

# Runner IDs and Conceptual Roles

This document clarifies the distinction between the internal identifiers used for active runner instances and the conceptual role labels that describe their primary functions within the Autoflow project.

## Internal Runner Identifiers

Active runner instances are identified by a unique slug that combines their conceptual role with an instance number. For example:
- `planner-1`: The first instance of the `planner` role.
- `owner-1`: The first instance of the `owner` role.
- `wiki-1`: The first instance of the `wiki` role.

These identifiers are used for system-level operations, configuration, and logging to ensure precise targeting and tracking of individual runner processes.

## Conceptual Role Labels

Conceptual role labels (e.g., `planner`, `owner`, `wiki-maintainer`) represent the general responsibilities and functions that a runner type performs. These labels are used in broader architectural discussions and documentation. For user-facing interfaces, these labels are often normalized (e.g., `owner` becomes `worker`), as detailed in [[decisions/worker-display-policy]], and `wiki-maintainer` becomes `LLM 위키` (LLM Wiki) as described in [[answers/desktop-sidebar-korean-labels]].

## Relationship

The internal runner identifiers are instantiations of the conceptual role labels. While a conceptual role like `planner` defines a set of tasks, `planner-1` refers to a specific process performing those tasks. This modular approach allows for flexible scaling and management of runner instances while maintaining a clear understanding of their roles.

Ticket `tickets_012` discussed the naming scheme for these roles and confirmed the consistency of the existing role-aligned runner ID scheme with [[agent-definitions]] and active configuration. While a proposal to use more generic role labels (e.g., just `worker`) was considered for the primary identification scheme, user-facing labels have since been normalized to `worker`, as further explained in [[decisions/worker-display-policy]].
