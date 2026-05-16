# TypeScript Migration Inventory

The repo-owned shell migration is complete for runtime, installable-board,
and package CLI entrypoints.

## Current Runtime Contract

- Runner runtime code lives in `app/runtime/{runners,system,shared}/` (app
  level, not copied into boards).
- The board (`<project>/.autoflow/`) holds only data — tickets, logs, state,
  wiki — and does NOT carry a `scripts/` folder. `autoflow upgrade` removes
  any leftover `<board>/scripts/` from older installs.
- The app/CLI invokes physical runtime paths directly with
  `AUTOFLOW_BOARD_ROOT` and `AUTOFLOW_PROJECT_ROOT` env vars pointing at the
  target board.
- CLI entrypoints live in `app/cli/{runners,system,shared}/` plus
  `app/cli/autoflow.ts` (absorbed into the desktop app).

Legacy shell wrappers are no longer part of the supported runtime contract.
Third-party dependency scripts under `node_modules/` are external package
contents and are not copied into generated boards.
