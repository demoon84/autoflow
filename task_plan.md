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

---

# Task Plan: LangGraph Fit Review

## Goal
Assess whether LangGraph should be integrated into the Autoflow project, based on the current repository architecture and current LangGraph capabilities.

## Scope
- Inspect Autoflow's CLI, runner, automation, and desktop boundaries.
- Identify workflow/state-machine areas where LangGraph would add value.
- Compare benefits against project risks such as extra runtime dependencies and duplicated orchestration semantics.
- Produce a recommendation and possible integration path without changing product code.

## Phases
- [x] Read project guidance and architecture docs.
- [x] Map current workflow/orchestration model.
- [x] Check current LangGraph official docs for relevant capabilities.
- [x] Evaluate fit, risks, and integration options.
- [x] Deliver concise Korean recommendation.

## Decisions
- Do not implement LangGraph in this turn; this is an architectural feasibility review.
- Avoid reverting or modifying unrelated dirty work already present in the repo.
- Recommendation: do not replace the file-based board with LangGraph; consider an optional LangGraph-backed `ticket-owner` runner/adapter if deeper retry, streaming, or human approval loops become necessary.

## Verification
- [x] Codebase evidence gathered from local files.
- [x] LangGraph evidence gathered from official sources.

## Risks
- The repo currently has substantial dirty work unrelated to this review.
- LangGraph may duplicate existing shell-based board semantics if introduced too broadly.

---

# Task Plan: Desktop Tabs Layout

## Goal
Replace the desktop app's left sidebar layout with a tabbed layout that separates progress status from setup/runner controls.

## Scope
- Update `apps/desktop/src/renderer/main.tsx`.
- Update `apps/desktop/src/renderer/styles.css`.
- Rebuild `apps/desktop/dist/renderer` so the running Electron window reflects the change.
- Avoid reverting unrelated dirty work.

## Phases
- [x] Inspect current sidebar/dashboard component structure.
- [x] Move progress content and sidebar controls into separate tabs.
- [x] Update layout CSS to remove the sidebar grid and style tabs.
- [x] Build and visually verify the running Electron app.

## Decisions
- Keep existing control components (`RunnerConsole`, stop hook, watcher, doctor, project setup) and relocate them instead of rewriting their behavior.
- Use simple in-app state for tabs: `progress` and `settings`.

## Verification
- [x] `npm --prefix apps/desktop run build`
- [x] `npm --prefix apps/desktop run check`
- [x] `git diff --check -- apps/desktop/src/renderer/main.tsx apps/desktop/src/renderer/styles.css apps/desktop/dist/renderer`
- [x] Computer Use visual check of progress tab and settings tab.

---

# Task Plan: Essential Decision UI Simplification

## Goal
Reduce the desktop service UI to a Codex-like work surface: keep the left sidebar, show progress in a conversation-style main pane, and expose only essential user decisions.

## Scope
- Inspect the current Electron renderer and IPC surface.
- Remove or hide UI controls that make users decide internal runner/automation details.
- Keep essential decisions: choose project, initialize `.autoflow` when missing, refresh/read board state.
- Preserve read-only board visibility and existing backend behavior.
- Avoid reverting unrelated dirty work.

## Phases
- [x] Map current desktop UI controls and classify essential vs. operational/internal.
- [x] Adjust collapsed sidebar state toward the Codex reference.
- [x] Remove sidebar collapse feature entirely after user requested deletion.
- [x] Roll back the attempted sidebar-free renderer entry point after user correction.
- [x] Build and run desktop checks.
- [x] Rebuild and verify collapsed-state CSS checks.

## Decisions
- Treat runner/watch/doctor/stop-hook controls as internal operational UI unless the current code proves they are required for basic user flow.
- Keep UI text Korean-facing where the current desktop UI is Korean-facing.
- Sidebar navigation is required and must not be removed.
- The provided Codex screenshot is the target interaction model: left navigation/projects/chats, main work transcript, compact review card, and minimal explicit controls.
- Sidebar collapse is no longer part of the product UI; the sidebar remains fixed.

## Verification
- [x] `npm --prefix apps/desktop run build`
- [x] `npm --prefix apps/desktop run check`
- [x] `git diff --check -- apps/desktop/src/renderer/main.tsx apps/desktop/src/renderer/styles.css apps/desktop/dist/renderer task_plan.md findings.md progress.md`
- [x] `git diff --check -- apps/desktop/src/renderer/styles.css apps/desktop/dist/renderer task_plan.md findings.md progress.md`
- [x] `rg -n "isSidebarCollapsed|toggleSidebar|sidebar-collapse|PanelLeft|settings-page-collapsed|autoflow.sidebarCollapsed" apps/desktop/src/renderer/main.tsx apps/desktop/src/renderer/styles.css`
- [ ] Visual check of desktop app after simplification.

## Risks
- Existing worktree contains large unrelated dirty changes; this task must stay focused on `apps/desktop` and planning notes.
- A first simplification attempt removed the sidebar from the rendered entry point; this was rolled back after user clarification.

---

# Task Plan: Desktop Renderer Hot Reload

## Goal
Make desktop UI updates hot reload during development instead of requiring `npm run build` before every Electron launch.

## Scope
- Update `apps/desktop/package.json`.
- Add a small local dev launcher under `apps/desktop/scripts/`.
- Use the existing `ELECTRON_RENDERER_URL` support in `apps/desktop/src/main.js`.
- Do not add new dependencies.

## Phases
- [x] Inspect current desktop dev/build scripts and Electron renderer loading.
- [x] Add Vite dev server + Electron launcher script.
- [x] Update `dev` script and keep a bundled fallback script.
- [x] Verify dev server launch, build, check, and diff whitespace.

## Decisions
- `npm --prefix apps/desktop run dev` now starts Vite on localhost and launches Electron against that URL, enabling Vite HMR for renderer UI changes.
- `npm --prefix apps/desktop run dev:bundle` keeps the old build-then-launch behavior.

## Verification
- [x] `npm --prefix apps/desktop run dev` reached `http://127.0.0.1:5173/`, then was stopped.
- [x] `npm --prefix apps/desktop run build`
- [x] `npm --prefix apps/desktop run check`
- [x] `git diff --check -- apps/desktop/package.json apps/desktop/scripts/dev.mjs`
- [x] Confirmed no dev/Electron HMR process remains running.

---

# Task Plan: Reporting Metrics Dashboard

## Goal
Turn the desktop `진행 스냅샷` area into a reporting-oriented dashboard that visualizes how much work Autoflow has done, including charts suitable for status reporting.

## Scope
- Update `apps/desktop/src/renderer/main.tsx`.
- Update `apps/desktop/src/renderer/styles.css`.
- Rebuild `apps/desktop/dist/renderer`.
- Keep board files and CLI metrics as the source of truth.
- Avoid changing ticket state or unrelated dirty work.

## Phases
- [x] Inspect available metrics and current renderer data model.
- [x] Design reporting cards/charts using existing board metrics and file lists.
- [x] Implement the report dashboard UI.
- [x] Verify build, type checks, and targeted whitespace.
- [x] Visually check the desktop UI if feasible.

## Decisions
- Keep the Korean desktop UI language.
- Prefer charts based on existing metrics so the report is useful without adding a new backend data model.
- Treat `.autoflow/metrics/` snapshots as report history, not authoritative state.
- Define `commit count` as the number of pass-completion commits discoverable from `tickets/done/**/tickets_*.md`, and define `code volume` as the summed `files changed / insertions / deletions` from those commits.

## Verification
- [x] `npm --prefix apps/desktop run build`
- [x] `npm --prefix apps/desktop run check`
- [x] `git diff --check -- apps/desktop/src/main.js apps/desktop/src/renderer/main.tsx apps/desktop/src/renderer/styles.css apps/desktop/src/renderer/vite-env.d.ts apps/desktop/dist/renderer task_plan.md findings.md progress.md`
- [x] Computer Use visual check of `처리 지표` in Electron.

## Risks
- Current worktree is heavily dirty from previous work; edits must stay tightly scoped.
- Metrics history may be sparse, so charts should degrade gracefully when `daily.jsonl` has few entries.

---

# Task Plan: GitHub Competitive Review

## Goal
Assess whether Autoflow is competitive against similar GitHub-hosted AI coding agent and agent-harness projects.

## Scope
- Research current GitHub projects in adjacent categories: coding agents, IDE agents, desktop agent workspaces, PRD/task managers, and GitHub-native agent workflows.
- Compare positioning against Autoflow's repo-local board, ticket-owner runner, verification evidence, and desktop operations console.
- Identify gaps needed for competitiveness.
- No product code changes.

## Phases
- [x] Confirm Autoflow's local harness positioning from repository docs and runtime.
- [x] Search GitHub and related official sources for similar active projects.
- [x] Pull current GitHub repository metadata for major comparables.
- [x] Categorize competitors and identify Autoflow's defensible wedge.
- [x] Produce a Korean recommendation.

## Decisions
- Treat Autoflow as a work-harness layer, not a direct replacement for Aider/Cline/Roo/OpenHands style coding agents.
- The closest strategic competitors are OpenAgents Workspace, Open Cowork, Task Master AI, and GitHub Agent HQ because they manage multi-agent work or task handoff, not just code editing.

## Verification
- [x] GitHub repo pages and GitHub API metadata checked on 2026-04-26.
- [x] Local `desktop:check` and `smoke:ticket-owner` still pass from the preceding harness diagnosis.
