# Findings

## Repository Shape
- No existing `package.json`, `tsconfig.json`, or frontend build tool was present before the Electron work.
- The current implementation is shell/PowerShell CLI plus generated board templates.
- `node` and `npm` are available locally (`node v20.19.6`, `npm 10.8.2`).

## Electron Version
- `npm view electron version` returned `41.3.0` on 2026-04-24.

## Product Direction
- The desktop app should be an Autoflow operating console:
  - select a project root and board directory
  - run `status`, `doctor`, `init`, `install-stop-hook`, `watch-bg`, `watch-stop`, and `render-heartbeats`
  - show ticket counts, ticket queues, and recent logs
- The CLI remains the source of truth for board state transitions.

## shadcn Direction
- Official shadcn Vite docs use Tailwind CSS, `@tailwindcss/vite`, React, a `@/*` alias, and `components.json`.
- The `components.json` docs say `style: "new-york"` is the current style choice and `tailwind.config` can be blank for Tailwind CSS v4.
- For this Electron app, use copied shadcn-compatible components under `src/components/ui/` instead of running an interactive CLI inside the existing scaffold.

---

# LangGraph Fit Review Findings

## Initial Task
- User asked to review whether LangGraph can be connected to the current Autoflow project.
- This is an architectural feasibility review only; no production code changes are planned.

## Autoflow Architecture Snapshot
- Root README describes Autoflow as a local harness layer for coding agents, not a model itself.
- Project state is intentionally file-based under `.autoflow/`; `tickets/` is the source of truth for execution state.
- The current default execution model is `ticket-owner`: one runner owns local planning, implementation, verification, evidence, and done/reject movement.
- Legacy `planner/todo/verifier` role pipeline remains as a compatibility path, but new/default behavior should prefer `ticket-owner`.
- Runner/process state lives under `runners/` and should not replace ticket stage state.
- Existing CLI supports `run ticket`, `run planner/todo/verifier/wiki`, watcher, stop hook, metrics, doctor, runner management, and desktop observation.

## Local Implementation Evidence
- `bin/autoflow` is a Bash dispatcher over project-scoped CLI scripts.
- `packages/cli/run-role.sh` validates runner config, picks the runtime role, writes runner state/logs, and either invokes a local runtime script or an external agent adapter.
- External adapter support is prompt based for `codex`, `claude`, `opencode`, and `gemini`; dry runs persist prompt/log artifacts.
- `runtime/board-scripts/start-ticket-owner.sh` already models a deterministic ticket-owner state selection order: resume owned inprogress, requested ticket, todo, verifier, populated backlog spec, then idle.
- `verify-ticket-owner.sh` runs the verification command from the ticket/spec and records evidence into `verify_*.md`.
- `finish-ticket-owner.sh` handles pass/fail, worktree integration, done/reject movement, verifier log writing, and optional local commit.
- `watch-board.sh` polls board fingerprints and dispatches routes through `run-hook.sh`; it is an event trigger layer, not a graph executor.
- The Electron app currently reads board state through CLI outputs and board files, with some guarded command surfaces in main-process IPC.

## LangGraph Official Capabilities
- Official docs describe LangGraph as a low-level orchestration framework/runtime for long-running, stateful agents.
- Core benefits relevant to Autoflow: durable execution, checkpoint persistence, human-in-the-loop interrupts, streaming, and traceability.
- JavaScript docs install with `@langchain/langgraph` and `@langchain/core`; `npm view` on 2026-04-25 returned `@langchain/langgraph` 1.2.9 and `@langchain/core` 1.1.41.
- Graph API models workflows as state, nodes, and edges; nodes can be normal code, not just LLM calls.
- Persistence/checkpoints require a thread identifier and make resume/human review possible.
- Official JavaScript docs list SQLite/Postgres/MongoDB/Redis checkpointer packages, with SQLite positioned for local experimentation.
- Current GitHub advisories include checkpoint-related issues, including Python `langgraph-checkpoint-sqlite` SQL injection patched at 3.0.1 and Python `langgraph` msgpack deserialization patched at 1.0.10. This matters if Autoflow later adds Python checkpointers or exposes checkpoint filters.

## Current Board Status
- `./bin/autoflow status . autoflow` reports initialized, package/board version 0.1.0, no active specs/tickets, 5 done tickets, 5 verify runs, runner/wiki/metrics/conversation/adapter scaffold present.
- Current runner config has one `owner-1` runner with `role = "ticket-owner"`, `agent = "codex"`, `mode = "one-shot"`.
- File watcher enables the `ticket` route only by default; legacy `plan`, `todo`, and `verifier` routes are disabled.
- The ticket owner agent contract explicitly says to keep the ticket file as source of truth, write a mini-plan, verify, record evidence, and finish pass/fail without splitting responsibility.

## Fit Recommendation
- LangGraph is feasible, but should not become the authoritative state store for Autoflow right now.
- Best fit: an optional `ticket-owner` runner/adapter that uses LangGraph internally for plan/implement/verify/retry/human-review routing while preserving `tickets/` markdown files as the source of truth.
- Good candidates: human approval before risky shell/git actions, verification-failure retry loops, streaming node updates to the desktop app, and resumable long-running owner turns.
- Poor candidate: replacing `tickets/` state transitions, watcher routing, or CLI shell runtime wholesale.
- If implemented, prefer JavaScript/TypeScript LangGraph first because the repo already has Node/Electron tooling; avoid adding Python runtime unless a strong reason appears.
- Side effects must be idempotent or guarded because LangGraph durable execution can replay from node boundaries; existing scripts that append notes, move files, or commit should be called from carefully isolated nodes.

---

# Desktop Tabs Layout Findings

- The current renderer uses `main.workspace-layout` with `aside.settings-area` for project/AI controls and `section.dashboard-area` for progress, logs, wiki, and snapshots.
- `sidebarOpen`, `toggleSidebar`, and `PanelLeft*` imports only support collapsing the sidebar and can be removed when replacing the sidebar with tabs.
- The existing `RunnerConsole`, `StopHookPanel`, `WatcherPanel`, and `DoctorPanel` components can be reused inside a settings tab.
- Visual verification showed the new `진행 상태` tab contains the summary/progress/log/snapshot view and the `설정` tab contains project connection, AI settings, stop hook, watcher, and doctor content without the old left sidebar.

---

# Essential Decision UI Simplification Findings

- User wants fewer service-wide UI features and only decisions users must make.
- Existing dirty work is extensive and includes unrelated repository moves/deletions, so this pass should not touch non-desktop surfaces unless required.
- Current likely target is the Electron desktop renderer because recent work added UI tabs and operational controls.
- Current renderer exposes many operational decisions: settings navigation, automation panels, stop hook controls, watcher controls, doctor panel, AI runner creation/config/execution, wiki update/lint, and metrics snapshot write.
- Essential visible decisions for the desktop viewer are project selection, installing `.autoflow` only when missing, refresh, and choosing a log/file to inspect.
- User-provided screenshot shows the desired direction: Codex-style left sidebar retained, main area as a work transcript/review surface, not a multi-page admin console.

---

# Reporting Metrics Dashboard Findings

- User clarified that `진행 스냅샷` should become report material showing how much Autoflow worked, preferably with charts.
- `packages/cli/metrics-project.sh` already emits the needed report metrics: spec totals, ticket totals by state, active/done/reject counts, verifier pass/fail counts, handoff count, runner state counts, artifact status counts, pass rate, and completion rate.
- The desktop main process already runs `autoflow metrics` on board load and lists files under `.autoflow/metrics/`, but it does not yet parse `metrics/daily.jsonl` into structured history for charts.
- The current renderer `snapshot` section is mostly a grid of key/value status cells plus search/history/log preview. It can be reused as the backing section while changing the visible product concept to `처리 지표`.
- No charting dependency is installed. Use lightweight React/SVG/CSS charts to avoid expanding the dependency surface for this focused report view.
- For commit-based reporting, the most stable Autoflow-specific anchor is the `done` ticket path. Each pass flow creates one local commit after moving a ticket into `tickets/done/**/tickets_*.md`, so the git commit that first adds that done ticket path can identify the Autoflow completion commit without mixing in arbitrary user commits.
- `변경 코드량` should exclude board-side markdown/log churn. Summing `git show --numstat` for those completion commits while filtering out paths under `BOARD_ROOT` keeps the metric focused on product code changes.
