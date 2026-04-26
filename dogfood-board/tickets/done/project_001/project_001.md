# Project Spec

## Project

- Name: Autoflow Runner/Wiki Board Scaffold
- Goal: Generated Autoflow boards include the first runner, wiki, metrics, conversations, and agent-adapter scaffold needed for the local agent harness direction.
- Owner: demoon

## Core Scope

- In Scope:
  - Add generated board directories for runner state, runner logs, wiki, metrics, conversations, and agent adapters.
  - Add minimal template/readme files that explain the purpose of the new directories.
  - Update scaffold and upgrade scripts so new boards and existing boards can receive the new structure without overwriting live state.
  - Update doctor/status documentation or checks where needed so missing runner/wiki scaffold is visible.
  - Update README/reference docs to describe the new runner harness direction at a high level.
- Out of Scope:
  - Running real Codex, Claude, OpenCode, Gemini, or shell agent processes.
  - Adding embedded desktop terminals.
  - Implementing `autoflow run`, `autoflow runners`, `autoflow wiki`, or metrics commands.
  - Changing todo/verifier lifecycle behavior.
  - Auto-push or remote Git operations.

## Main Screens / Modules

- `scripts/cli/scaffold-project.sh`
- `scripts/cli/scaffold-project.ps1`
- `scripts/cli/upgrade-project.sh`
- `scripts/cli/upgrade-project.ps1`
- `scripts/cli/doctor-project.sh`
- `scripts/cli/doctor-project.ps1`
- `scripts/cli/package-board-common.sh`
- `scripts/cli/package-board-common.ps1`
- `templates/board/`
- `agents/`
- `reference/`
- `rules/`
- `README.md`
- `plan.md`

## Global Rules

- Board files live in `autoflow/` for the current generated board behavior.
- The product direction remains compatible with a future `.autoflow/` default.
- Allowed Paths are relative to the host project root.
- Verification commands run from the host project root unless a ticket says otherwise.
- Do not create plan or todo files from this spec directly; planner heartbeat owns that.
- Do not remove or revert unrelated existing worktree changes.
- Do not change git remotes or push.

## Global Acceptance Criteria

- [ ] `./bin/autoflow init <project>` creates runner, wiki, metrics, conversations, and adapter scaffold directories for a fresh board.
- [ ] `./bin/autoflow upgrade <project>` adds the same missing scaffold directories to an existing board without overwriting existing ticket/log/state files.
- [ ] `./bin/autoflow doctor <project>` reports the presence or absence of the new runner/wiki scaffold in machine-readable output.
- [ ] The generated board contains short docs or placeholder files explaining `runners`, `wiki`, `metrics`, `conversations`, and `agents/adapters`.
- [ ] Repository docs describe Autoflow as a local work harness for coding agents, with board as ledger and wiki as map.
- [ ] Existing `#spec`, `#plan`, `#todo`, and `#veri` board lifecycle remains unchanged.

## Verification

- Command:
  - `./bin/autoflow help`
  - `./bin/autoflow init /tmp/autoflow-runner-scaffold-smoke`
  - `./bin/autoflow status /tmp/autoflow-runner-scaffold-smoke`
  - `./bin/autoflow doctor /tmp/autoflow-runner-scaffold-smoke`
  - `./bin/autoflow upgrade /tmp/autoflow-runner-scaffold-smoke`
  - `git diff --check`
- Manual check:
  - Inspect the smoke board and confirm the new runner/wiki scaffold exists.
  - Confirm no plan/todo/verifier lifecycle behavior was changed by this phase.

## Obsidian Links

- [[project_001]]

## Notes

- This is Phase 1 from `plan.md`.
- Keep this ticket intentionally limited to board schema and documentation. Runner execution comes later.
