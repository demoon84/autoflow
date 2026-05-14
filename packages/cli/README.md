# CLI Package

`packages/cli/` contains the TypeScript implementation for the Autoflow CLI.
`bin/autoflow` is a Node entrypoint that launches `packages/cli/autoflow.ts`
through the repo-local `tsx` runtime.

## CLI Files

- `autoflow.ts`: top-level command dispatcher.
- `cli-core.ts`: stable compatibility entrypoint. The implementation lives in
  `cli-core/`, split by command (`commands/`) and shared feature (`shared/`).
- `*-project.ts`: command-specific entrypoints for scaffold, upgrade, order,
  spec, runners, metrics, status, doctor, wiki, telemetry, watch, stop-hook,
  origin, coordinator, and log cleanup.
- `run-role.ts`: one-shot runner role dispatch.
- `render-heartbeats.ts`: heartbeat rendering summary entrypoint.
- `guard-project.ts`: board guard CLI bridge.

There are no repo-owned shell CLI entrypoints. New package commands should be
added as `.ts` files and routed through the matching `cli-core/commands/*`
module, with reusable helpers placed under `cli-core/shared/*`.

## Runtime Source Copied Into Boards

`runtime/board-scripts/` is copied into each generated board's `scripts/`
directory by `autoflow init` and `autoflow upgrade`. Runtime helpers are also
TypeScript-first:

- `common.ts`
- `runner-common.ts`
- `board-utils.ts`
- `check-stop.ts`
- `install-stop-hook.ts`
- `run-hook.ts`
- `set-thread-context.ts`
- `clear-thread-context.ts`
- `start-plan.ts`
- `start-spec.ts`
- `start-ticket.ts`
- `start-todo.ts`
- `start-verifier.ts`
- `verify-ticket.ts`
- `finish-ticket.ts`
- `merge-ready-ticket.ts`
- `update-wiki.ts`
- `watch-board.ts`
- `wiki-query.ts`
- `wiki-search-index.ts`

Large runtime entrypoints may keep a small top-level `*.ts` wrapper and place
their real implementation in a same-named folder with `index.ts` plus
feature-owned modules. Current examples include `runner-tool/`, `start-plan/`,
`start-ticket/`, `verify-ticket/`, `finish-ticket/`, `board-utils/`, and
`board-guard/`.

Legacy `.js` companions may remain for Node runtime compatibility, but shell
companions are not installed.

## Smoke Tests

Smoke tests live in `tests/smoke/*.ts`. The public worker smoke command is:

```bash
npm run smoke:worker
```

The smoke suite now checks that repo-owned `.sh` files are absent outside
third-party dependency folders.

## Command Notes

- `autoflow init` and `autoflow upgrade` copy scaffold docs plus TypeScript
  runtime scripts into the target board.
- `autoflow order create` writes quick requests into `tickets/order/`.
- `autoflow prd create` / `autoflow spec create` writes PRD markdown into
  `tickets/prd/`.
- `autoflow run <role>` dispatches TypeScript runtime scripts for planner,
  worker, todo, verifier, wiki, and self-improve roles.
- `autoflow wiki query` performs local markdown retrieval directly in the
  TypeScript CLI; `runtime/board-scripts/wiki-query.ts` delegates back to this
  CLI without shell fallback.
- `autoflow doctor` verifies the active board and required TypeScript runtime
  companions.
