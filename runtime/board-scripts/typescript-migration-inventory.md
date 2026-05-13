# TypeScript Migration Inventory

The repo-owned shell migration is complete for runtime, active-board, package
CLI, and smoke-test entrypoints.

## Current Runtime Contract

- Runtime board scripts live in `runtime/board-scripts/*.ts`.
- Active board scripts live in `.autoflow/scripts/*.ts`.
- Package CLI entrypoints live in `packages/cli/*.ts`.
- Smoke tests live in `tests/smoke/*.ts`.

Legacy shell wrappers are no longer part of the supported runtime contract.
Third-party dependency scripts under `node_modules/` are external package
contents and are not copied into generated boards.
