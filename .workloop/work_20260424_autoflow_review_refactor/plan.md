# Plan: Autoflow Code Review And Refactor

## Confirmed Decisions
1. User asked for project-wide code inspection and refactoring.
2. User asked to keep the work from stopping by using a Stop hook.
3. The global Codex Stop hook already points to the autopilot completion guard.

## Assumed Defaults
- Work in the current repository: `/Users/demoon/Documents/project/autoflow`.
- Preserve unrelated user changes, especially existing `.idea`, deleted `autoflow/`, and deleted `plan.done.md` worktree state.
- Prefer focused runtime/CLI refactors and smoke-testable fixes over broad churn.

## Goal
Make Autoflow easier to operate by tightening high-risk CLI/runtime code, preserving Stop-hook continuity, and validating the public workflow with concrete smoke tests.

## Scope
- Allowed: `bin/`, `scripts/`, `templates/`, `agents/`, `reference/`, `rules/`, `automations/`, and isolated `.workloop/` planning notes.
- Out of Scope: `git push`, commits, reverting user changes, editing IDE metadata, and recreating the deleted generated `autoflow/` board tree unless explicitly needed.

## Done When
- [x] Stop-hook continuity is confirmed without colliding with existing `plan.done.md` deletion.
- [x] Project CLI/runtime code is inspected for operational risks.
- [x] At least one focused refactor or correctness fix is implemented in the source tree.
- [x] Smoke checks exercise init/status/doctor/stop-hook behavior on a disposable project.
- [x] Worktree status is reviewed so user-owned changes are not hidden.

## Verification
- `./bin/autoflow help`
- Disposable-project smoke: `init`, `status`, `doctor`, and `stop-hook-status` with test hook manifest.
- Targeted shell syntax checks for modified `.sh` files.

## Risks & Mitigations
| Risk | Mitigation |
|---|---|
| Existing dirty work belongs to the user. | Read diffs before editing and avoid unrelated reversions. |
| Generated-board and package-source paths differ. | Test through the public CLI against a disposable project. |
| Stop hook could archive a root `plan.md` over deleted `plan.done.md`. | Use `.workloop/.../plan.md` instead of root `plan.md`. |

## Todos
- [x] Inspect current dirty state, CLI entrypoints, and runtime stop-hook paths.
- [x] Run baseline public CLI smoke checks and capture failures.
- [x] Identify a small high-impact refactor/fix from the inspection.
- [x] Implement the focused change with minimal file scope.
- [x] Run syntax checks and disposable-project smoke verification.
- [x] Update this plan and summarize touched files plus residual risks.

## Next Action
> Completed. Summarize the scoped changes and verification results to the user.

## Progress Log
- 2026-04-24 22:24 — Confirmed global autopilot Stop hook exists and points to an executable script.
- 2026-04-24 22:26 — Baseline disposable-project smoke passed for init, status, doctor, install-stop-hook, and stop-hook-status.
- 2026-04-24 22:37 — Fixed default/custom board path consistency across shell CLI defaults, Windows watcher default, generated host AGENTS, heartbeat templates, and the Windows hook dispatcher prompt.
- 2026-04-24 22:39 — Verified direct scripts and public CLI on disposable projects, including custom board name substitution, render-heartbeats after setting thread ids, stop-hook install/status, planner pending-ticket output, and plan/spec archival.
- 2026-04-24 22:40 — Ran `bash -n` on shell entrypoints, `./bin/autoflow help`, and `git diff --check`.

## Open Decisions
None.

## Model Strategy (optional)
- Task: repo-wide shell/CLI refactor
  preferred_model: inherited
  why: current task needs repository-specific inspection plus conservative edits.
