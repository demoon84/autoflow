# Task Plan: Electron Codex Flow Visualizer

## Goal
Create a first Electron desktop shell that visualizes how Codex is moving work through the Autoflow board without executing planner/todo/verifier actions.

## Scope
- Add a desktop app under `apps/desktop/`.
- Add package scripts for local development and syntax checks.
- Keep existing CLI/runtime behavior authoritative.
- Avoid committing, pushing, or reverting unrelated dirty work.

## Phases
- [x] Inspect current repo shape and JavaScript tooling availability.
- [x] Scaffold Electron main/preload/renderer files.
- [x] Read board files and `bin/autoflow status` through a narrow IPC surface.
- [x] Add board summary/ticket/log reading for the dashboard.
- [x] Add scripts and documentation for running the desktop app.
- [x] Verify syntax and CLI compatibility.
- [x] Convert the Electron renderer to React + Vite + shadcn-compatible UI components.
- [x] Verify the shadcn renderer build and Electron main syntax.
- [x] Redesign the Electron renderer into a denser operations console with clearer hierarchy.
- [x] Verify the redesigned renderer build and whitespace checks.
- [x] Move project selection to the lower sidebar and sharpen the sidebar/workspace separation.
- [x] Verify the Codex-like sidebar layout in the running Electron window.
- [x] Remove the sidebar and convert the layout to top bar + bottom project switcher.
- [x] Convert the desktop UI from an action console into a read-only flow viewer.
- [x] Verify the read-only flow viewer build and running Electron window.
- [x] Add `.autoflow` setup affordance for projects that do not have a flow source yet.
- [x] Redesign the project selection/setup state into an Obsidian-like left project list and create/open panel.
- [x] Revert the Obsidian-like setup screen back to the prior board-first layout.

## Decisions
- Use shadcn/ui as the UI toolchain, which means React + Vite + Tailwind v4 for the renderer.
- Treat `bin/autoflow status` and board files as the read boundary; the Electron app should not duplicate planner/todo/verifier rules.
- Use `apps/desktop/` so the desktop app remains separable from the CLI package source.
- Redesign away from a generic dashboard toward a compact Codex progress visualizer: status strip, colored ticket lanes, and log/snapshot panels.
- Keep project context controls in the lower dock so the main view stays focused on the board flow.
- Prefer a sidebar-free flow viewer while the app has only one primary board view.
- Do not expose planner/todo/verifier command execution from the renderer; this app is for observing board state.
- Frame the app as a Codex work-flow visualization, not as an Autoflow action surface.
- Default the desktop app to `.autoflow/` because the visualizer is attached to the per-project sidecar board.
- Use only the selected project root in the desktop UI; `.autoflow/` is an implementation convention, not a user-facing folder choice.
- If the selected project has `.autoflow/`, load it immediately; otherwise show setup actions.
- Keep setup as a small bottom-bar affordance so the flow board remains the primary surface.

## Verification
- [x] `npm --prefix apps/desktop run check`
- [x] `npm run desktop:check`
- [x] `./bin/autoflow help`
- [x] Disposable project smoke for `init/status/doctor`
- [x] `git diff --check`
- [x] `npm run desktop:check` after shadcn/Vite conversion
- [x] `npm run desktop:check` after operations-console redesign
- [x] Computer Use visual check of the running Electron window
- [x] `npm run desktop:check` after lower-sidebar project dock changes
- [x] Computer Use visual check that the project selector remains visible at the sidebar bottom
- [x] `npm run desktop:check` after removing the sidebar
- [x] Computer Use visual check of top bar and bottom project switcher
- [x] `npm run desktop:check` after read-only flow viewer conversion
- [x] Visual check of the running read-only Electron window

## Risks
- Electron dependency installation may be deferred; syntax checks should not require installed Electron.
- The existing worktree is dirty from user changes; only new desktop files and intentional docs/package files should be touched.
