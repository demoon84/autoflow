# Runner Role Slugs

## Overview
Autoflow uses role-aligned slugs for runner identifiers in the standard 3-runner topology. This simplifies configuration and aligns the internal IDs with their primary functions, making the system easier to monitor and maintain.

## Slug Mapping
- **Planner AI**: Internal ID `planner` (mapped from `planner-1`).
- **Worker (Implementation) AI**: Internal ID `worker` (mapped from `owner-1`).
- **Wiki Maintainer AI**: Internal ID `wiki-maintainer` (mapped from `wiki-1`).

## Design Rationale
- **Simplicity**: Removes numerical suffixes when a single runner per role is sufficient, creating "one board, one AI of each type" model.
- **Namespace Reservation**: The `worker` ID is intentionally distinct from its role (`ticket-owner`) to allow for future horizontal scaling (e.g., adding `worker-1`, `worker-2`) while keeping the first instance clean.
- **Self-Alignment**: For roles like `wiki-maintainer`, the ID and role are identical, reducing configuration overhead.

## Impact
- **Configuration**: Affects `.autoflow/runners/config.toml` and `.autoflow/automations/heartbeat-set.toml`.
- **Persistence**: Runner state files (e.g., `worker.state`) use the new slugs.
- **UI Labels**: The desktop application maps these slugs to user-friendly titles like "Plan AI", "Impl AI", and "Wiki AI".

## Origins
- **Decision**: Implemented to unify identifiers across the 3-runner topology and improve UI clarity (`tickets/done/prd_012/prd_012.md`).
