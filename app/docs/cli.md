# CLI (inside the Desktop App)

`app/cli/` contains the TypeScript implementation for the Autoflow CLI,
absorbed into the desktop application as the single source of truth.
`app/bin/autoflow` is a thin Node entrypoint that launches
`app/cli/autoflow.ts` through the repo-local `tsx` runtime.

## CLI Files

- `autoflow.ts`: top-level CLI entrypoint and command dispatcher.
- `runners/`: runner-facing command code grouped by `planner/`, `worker/`,
  `verifier`, and `wiki`.
- `system/`: board/runtime management commands such as install, status,
  runner config, tool dispatch, telemetry, and cleanup.
- `shared/`: reusable CLI helpers.

There are no repo-owned shell CLI entrypoints. New package commands should be
implemented in the matching physical folder and routed directly from
`autoflow.ts`. Use `runners/<role>/` for runner-owned surfaces and `system/`
for board/runtime management. Reusable helpers belong under `shared/*`.

## Runner Runtime (App Level, Not Installed)

Runner runtime code lives under `../runtime/` (a sibling of `cli/` under
`app/`). It is NOT copied into boards. The CLI/app invokes physical runtime
paths directly with `AUTOFLOW_BOARD_ROOT` and `AUTOFLOW_PROJECT_ROOT` env vars
pointing at the target board. Runtime uses the same top-level ownership shape
as CLI:

- `runners/planner/`: planner startup, order/PRD promotion, and planner tools.
- `runners/worker/`: worker startup, worktree tools, evidence checks, and finalization.
- `runners/verifier/`: verifier queue/evidence/decision tools and legacy verify macro.
- `runners/wiki/`: wiki runner tools plus wiki scripts.
- `system/`: board guard, stop hook, wake/stage/token, and runtime maintenance helpers.
- `shared/`: shared markdown, git, board, and runner-tool helpers.

Legacy `.js` companions may remain for Node runtime compatibility, but shell
companions are not installed.

## Verification

Source-repo smoke tests were retired in favor of validating installed boards
directly. Run `app/bin/autoflow upgrade <project-root>` against a target project
and exercise the runners there.

## Command Notes

- `autoflow init` and `autoflow upgrade` copy install-source docs (board/host/
  integrations) into the target board. Runtime is NOT copied — any leftover
  `<board>/scripts/` from older installs is removed.
- `autoflow order create` writes quick requests into `tickets/order/`.
- `autoflow prd create` / `autoflow spec create` writes PRD markdown into
  `tickets/prd/`.
- `autoflow run <role>` invokes the matching focused runtime surface with
  board/project env vars. `planner` may promote order/PRD work; `worker`
  (alias `ticket`) reports owned active work or the next todo candidate as
  startup context before the runner uses explicit worker tools.
- `autoflow run wiki` is the deterministic wiki baseline update surface. A
  normal wiki runner turn uses `autoflow tool runner-tool wiki tick`.
- `autoflow runners start <runner>` records/prepares runner state/config from
  the CLI. The desktop app's PTY runner path owns long-running process spawn.
- `autoflow tool runner-tool <role> ...` is the preferred surface for narrow
  runner actions such as claim, worktree setup, verification evidence,
  verifier decision routing, wiki source snapshots, and wake markers.
- `autoflow wiki query` performs local markdown retrieval directly in the
  TypeScript CLI; wiki runner scripts live under `app/runtime/runners/wiki/scripts/`.
