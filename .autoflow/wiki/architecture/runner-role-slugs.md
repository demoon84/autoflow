# Runner Role Identifiers

## Overview
Autoflow uses standardized identifiers for the runners in its 3-runner topology. While a move to role-aligned slugs (e.g., `worker` instead of `owner-1`) was planned, the project has maintained its existing numerical suffix identifiers to preserve compatibility with established AGENTS and active configuration contracts.

## Current Identifiers
- **Planner AI**: `planner-1`
- **Worker (Implementation) AI**: `owner-1`
- **Wiki Maintainer AI**: `wiki-1`

## Design Rationale
- **Stability**: Maintaining existing IDs prevents configuration drift and avoids breaking state persistence or UI mapping logic that expects the `-1` suffix.
- **Scaling Readiness**: Numerical suffixes allow for future horizontal scaling (e.g., adding `owner-2`) without changing the base naming convention.
- **UI Mapping**: The desktop application maps these internal IDs to user-friendly titles:
  - `planner-1` → **Planner** (formerly Plan AI)
  - `owner-1` → **Worker** (formerly Impl AI)
  - `wiki-1` → **위키봇** (formerly Wiki AI)

## Status of Slug Rename
- **Decision**: A proposal to rename IDs to `planner`, `worker`, and `wiki-maintainer` (`prd_012`) was **superseded**.
- **Reasoning**: The rename conflicted with the current AGENTS topology contract and live runner state. It was determined that the current ID scheme provides sufficient clarity and better compatibility (`tickets/done/prd_012/tickets_012.md`).

## Impact
- **Configuration**: Always use `planner-1`, `owner-1`, and `wiki-1` in `.autoflow/runners/config.toml` and heartbeat automations.
- **Persistence**: State files under `.autoflow/runners/state/` continue to use these IDs.

## See Also
- **[[decisions/worker-display-policy]]**: How internal IDs are normalized for user-facing display.
