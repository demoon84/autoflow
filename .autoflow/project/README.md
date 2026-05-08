# Project-owned Autoflow Layer (PRD 8, 2026-05-09)

This directory is the **project-owned** layer of the Autoflow sidecar. Anything you put here is preserved across `autoflow upgrade` runs; the runtime directories (`agents/`, `scripts/`, `rules/`, `reference/`) belong to autoflow core and may be overwritten on upgrade.

## Layout

```
.autoflow/project/
├── README.md          # this file
└── hooks/             # optional shell hooks invoked by autoflow at well-defined points
    ├── verify-pre.sh  # runs before the worker's verify command (best-effort)
    └── verify-post.sh # runs after a passed sanity gate but before commit (best-effort)
```

## Hook Contract

Hooks are **best-effort and never block the autoflow flow**. A non-existent hook is silently ignored. A failing hook prints a warning to stderr but does not fail the ticket — this preserves Autoflow's first principle (`사용자가 명시적으로 정지하지 않는 한 멈추지 않는다`).

Each hook receives:

| Env Var | Description |
| --- | --- |
| `AUTOFLOW_HOOK_TICKET_FILE` | Absolute path to the ticket markdown |
| `AUTOFLOW_HOOK_TICKET_ID`   | Numeric ticket ID (e.g. `205`) |
| `AUTOFLOW_HOOK_PRD_KEY`     | PRD/project key (e.g. `prd_042`, `express_900`) |
| `AUTOFLOW_HOOK_CHANGE_TYPE` | `code` / `docs` / `cleanup` / `infra` (PRD 2) |
| `AUTOFLOW_BOARD_ROOT`       | `.autoflow/` absolute path |
| `AUTOFLOW_PROJECT_ROOT`     | Repo root |

Hooks should:

- Be idempotent.
- Run quickly (≤ a few seconds). Long-running checks belong in the verify command, not hooks.
- Avoid network calls and credential access.
- Never run `git push`.

## Future

Phase 2 will move agent prompts, rules, and templates to `.autoflow/core/` (autoflow-owned, read-only) so the boundary becomes physical instead of conventional. For now the convention is: anything under `.autoflow/project/` is yours, everything else may change on upgrade.
