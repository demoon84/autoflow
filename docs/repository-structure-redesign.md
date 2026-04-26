# Repository Structure Redesign

This document defines the target source layout for the Autoflow repository.
The key rule is that the installed board directory name is configuration, not
a source folder naming rule.

## Problem

The current repository mixes three different concepts:

- Package source: CLI, desktop app, scripts, templates, and docs for Autoflow.
- Board scaffold source: files that are rendered into a target project board.
- Dogfood board state: this repository's own Autoflow work board.

That makes folders such as `autoflow/`, `templates/board/`, `agents/`,
`automations/`, `reference/`, and `rules/` feel like overlapping sources of
truth. It also makes the UI look odd because the repository is named
`autoflow` and a top-level `autoflow/` folder appears inside it.

## Naming Principles

1. Source folders describe responsibility, not install destination.
2. The installed board directory is a configurable target value.
3. There should be one canonical source for board scaffold files.
4. Runtime scripts shipped into the board should be separate from CLI scripts.
5. Local dogfood board state should not look like product source.

## Target Layout

```text
autoflow/
  apps/
    desktop/
  bin/
    autoflow
    autoflow.ps1
  docs/
  examples/
  packages/
    cli/
    desktop-shared/
  scaffold/
    manifest.toml
    board/
      AGENTS.md
      README.md
      agents/
      automations/
      conversations/
      metrics/
      reference/
      rules/
      runners/
      wiki/
    host/
      AGENTS.md
  runtime/
    board-scripts/
  tests/
    smoke/
  VERSION
  package.json
```

## Install Mapping

The installer should read an explicit mapping instead of inferring the target
from source folder names.

```toml
[install]
default_board_dir = ".autoflow"

[sources]
board = "scaffold/board"
host = "scaffold/host/AGENTS.md"
runtime_scripts = "runtime/board-scripts"
```

With that contract, `scaffold/board/` means "board source files", while
`.autoflow/` means "the default installed board directory in a target project".
Changing the installed board name should not require renaming source folders.

## Template Tokens

Scaffold text uses `{{BOARD_DIR}}` wherever installed documentation needs to
refer to the target board directory. The installer renders that token from
`scaffold/manifest.toml`, so source files stay independent from the default
`.autoflow/` install path.

## Current To Target Mapping

| Current Path | Target Path | Note |
| --- | --- | --- |
| `templates/board/` | `scaffold/board/` | Main board scaffold source |
| `templates/host-AGENTS.md` | `scaffold/host/AGENTS.md` | Host guidance template |
| `agents/` | `scaffold/board/agents/` | Remove duplicate source path |
| `automations/` | `scaffold/board/automations/` | Remove duplicate source path |
| `reference/` | `scaffold/board/reference/` | Remove duplicate source path |
| `rules/` | `scaffold/board/rules/` | Remove duplicate source path |
| `scripts/runtime/` | `runtime/board-scripts/` | Scripts copied into installed board |
| `scripts/cli/` | `packages/cli/` | Installer and command implementation |
| `scripts/tests/` | `tests/smoke/` | Runtime smoke tests |
| `autoflow/` | `dogfood-board/` | Tracked development board state, not product source |

## Dogfood Board Policy

The repository's own Autoflow board is useful for development, but it is
workspace state, not package source. When tracked, it uses the purpose-based
`dogfood-board/` name so it does not look like product code or the installed
target board directory.

Preferred options:

- Keep transient backups ignored under `dogfood-board/.autoflow-upgrade-backups/`.
- Keep only curated examples under `examples/` if examples are needed later.
- Do not use the repository name or installed target board name for this
  development state folder.

Do not rename package source folders to `.autoflow/` just because target
projects install to `.autoflow/`.

## Migration Plan

1. Done: Add scaffold manifest support while keeping current paths working.
2. Done: Teach Bash and PowerShell installers to read source paths from the
   manifest.
3. Done: Move `templates/board/` and `templates/host-AGENTS.md` into
   `scaffold/`.
4. Done: Fold root `agents/`, `automations/`, `reference/`, and `rules/`
   into `scaffold/board/` so there is one board source.
5. Done: Move board runtime scripts from `scripts/runtime/` to
   `runtime/board-scripts/`.
6. Done: Move CLI implementation into `packages/cli/` and keep `bin/` as thin
   entrypoints.
7. Done: Rename the top-level `autoflow/` dogfood board state to
   `dogfood-board/`.
8. Done: Tokenize scaffold references to the installed board directory.
9. Done: Update README, smoke tests, desktop app assumptions, and upgrade
   paths.

## Non Goals

- Do not change the installed default board directory away from `.autoflow`.
- Do not break custom board directory names.
- Do not make the desktop app own spec authoring again; spec starts from chat.
