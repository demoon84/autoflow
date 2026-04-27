# Findings

## Korean Terminal AI Response Findings

- User requested terminal conversations to appear in Korean and for the AI to speak Korean.
- Existing planning context shows many unrelated dirty files, including desktop renderer, runner scripts, board tickets, and wiki files. Treat them as pre-existing and avoid reverting them.
- Required board docs say installed board Markdown should remain concise, AI-friendly English, while user-facing docs/UI can be Korean. Therefore the likely fix is a prompt-level user-visible language directive, not translating all board contracts.
- Ticket Owner/automation docs route AI work through runner prompts and agent instruction files. Visible terminal conversation can be Korean while durable board files remain English.
- `bin/autoflow run ...` dispatches to `packages/cli/run-role.sh`; its `write_agent_prompt()` feeds Codex, Claude, OpenCode, and Gemini adapters.
- `runtime/board-scripts/run-role.sh` contains a similar prompt for packaged/generated runtime script copies, but it is currently older than `packages/cli/run-role.sh`.
- `packages/cli/wiki-project.sh` has separate adapter prompts for `wiki query --synth` and `wiki lint --semantic`; these produce key=value output and should keep exact machine-readable keys while making any natural-language values Korean.
- Legacy hook and heartbeat paths also generate prompts (`run-hook.sh` and `automations/templates/*heartbeat*.toml`). They need the same language rule for consistency when those compatibility routes are used.

---

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

---

# GitHub Competitive Review Findings

## Comparable Projects Checked
- Direct coding agents: Aider, OpenHands, Cline, Roo Code, OpenCode/Crush, Continue, SWE-agent.
- Agent workspace / desktop orchestration: OpenAgents Workspace, Open Cowork, OpenClaudia, Hermes Agent Desktop.
- PRD/task systems: Task Master AI.
- GitHub-native background agents: GitHub Copilot Agents / Agent HQ with Claude and Codex.

## Market Signal
- Large incumbents are already strong for direct editing: OpenHands (~72k stars), Cline (~61k), Aider (~44k), Continue (~33k), Task Master AI (~27k), Roo Code (~23k), SWE-agent (~19k).
- Newer orchestration/workspace tools are smaller but closer to Autoflow's category: OpenAgents (~3.3k), Open Cowork (~1k), OpenClaudia (<100).
- GitHub itself now frames the category as an agent mission-control problem: assign background tasks, track progress, get PRs, and choose Copilot/Claude/Codex/custom agents.

## Autoflow Positioning
- Autoflow should not compete head-on as "the best code editor agent." That lane is crowded and mature.
- Its best wedge is a repo-local source-of-truth harness: `.autoflow/tickets/` as execution ledger, ticket-owner lifecycle, evidence records, local worktree isolation, no-push guard, and metrics/reporting.
- This is closer to "agent operations for local repos" than "AI coding UI."

## Competitiveness
- Competitive if positioned for teams or power users who need auditable local agent work across Codex/Claude/OpenCode/Gemini and want work state in git.
- Not competitive yet as a consumer-friendly desktop agent app: competitors have installers, marketplaces/skills, IDE/native workflows, sandbox stories, remote collaboration, and GitHub PR automation.

## Gaps
- Reliable worktree provisioning and dependency hydration are critical; current dogfood tickets repeatedly fail because isolated worktrees lack expected toolchains or current repo layout.
- Need a clearer "mission control" UX for blocked tickets, evidence, runner artifacts, and next safe action.
- Need GitHub issue/PR integration if competing with Agent HQ/SWE-agent-style background task workflows.
- Need packaged installation, onboarding, templates, and docs that make value obvious within 5 minutes.
- Need security/sandbox permissions story comparable to Open Cowork / GitHub Actions-backed agents.

---

# Blocked Runner Status Debug Findings

- User screenshot shows multiple Codex Ticket Owner runners displayed as `실행 중`, current item `tickets_003`, `tickets_005`, `tickets_007`, `tickets_004`, with the visible pill `막힘`; one runner for `tickets_001` is at `구현 중`.
- Initial git status shows several `.autoflow/tickets/inprogress/*.md`, verification files, reject files, wiki files, and desktop renderer/main files are already dirty before this debug pass.
- Relevant board contract: `inprogress` tickets may remain blocked, but ticket owner mode should continue implementation and verification, and runner state should not replace ticket stage state.
- Runner evidence before cleanup: owner-1 through owner-5 were loop workers with live PIDs and active tickets; owner-1/2/3/5 had `active_stage=blocked`, owner-4 had `active_stage=executing`.
- Repeated `막힘` is backed by real ticket state, not only a renderer label: tickets 003/004/005/007 carry `Stage: blocked` with `shared_allowed_path_conflict`; logs also show worktree dependency hydration and stale verification path failures.
- Worktree cleanup archive: `.autoflow/logs/worktree-cleanup_20260426T042800Z/` contains status/diff/staged/untracked records for each removed worktree. Non-empty diffs existed for `autoflow_tickets_003`, `autoflow_tickets_006_local`, `autoflow_tickets_007`, and stale `autoflowLab_*` worktrees.
- After cleanup, `git worktree list --porcelain` shows only `/Users/demoon/Documents/project/autoflow`; all Autoflow project owner runners are `stopped` with empty active ticket metadata.
- One unrelated loop worker remains for another project: `owner-6` on `/Users/demoon/Documents/project/tetris`; it was intentionally not stopped during the Autoflow project cleanup.
- The only remaining reject ticket was `.autoflow/tickets/reject/reject_006.md`; it was replanned with the runtime's existing `replan_reject_to_todo` logic and moved to `.autoflow/tickets/todo/tickets_006.md` with `Stage: todo`, blank owner fields, `Integration Status: pending_claim`, and `Retry Count: 7`.
- Manual PRD restart reset moved active tickets 001, 003, 004, 005, and 007 from `inprogress/` to `todo/` with `Stage: todo`, blank owner fields, `Integration Status: pending_claim`, and pending verification/result fields. Existing `verify_001.md`, `verify_003.md`, `verify_005.md`, and `verify_007.md` were archived under `.autoflow/logs/requeue-inprogress_20260426T043110Z/`.
- Full tickets reset preserved every PRD document by moving PRDs 001 through 010 into `.autoflow/tickets/backlog/`, then removed generated ticket, done, reject, and verifier files from `.autoflow/tickets/`. The previous ticket tree was archived under `.autoflow/logs/tickets-reset_20260426T043324Z/tickets-before-reset/`.
- The desktop `처리 지표` view also depends on `.autoflow/metrics/daily.jsonl` and verifier completion logs. The previous metrics history and 39 verifier completion logs were archived under `.autoflow/archive/metrics-reset_20260426T043803Z/`, and the report card calculation was corrected so runners without artifacts no longer count as `AI 산출물`.
- New start-blocked reproduction: after the PRD-only reset, starting five owner runners moved PRDs 001-005 into `tickets/done/prd_*/` and created five inprogress tickets. `tickets_001` reached `planning`, while `tickets_002` through `tickets_005` immediately became `Stage: blocked` with `Runtime auto-blocked: shared_allowed_path_conflict`.
- Root cause: `ensure_ticket_worktree` calls `worktree_auto_fallback_reason` before creating or reusing a ticket worktree. In default `AUTOFLOW_WORKTREE_MODE=auto`, any dirty root Allowed Path such as `apps/desktop/src/renderer/main.tsx` forces `Integration Status: project_root_fallback`. Once one fallback ticket holds a shared path, later tickets with overlapping Allowed Paths are blocked before implementation starts.
- The repository rules say ticket worktrees are preferred in git repositories and fallback should happen only when no ticket worktree exists. Dirty root paths are not a worktree-unavailable condition; treating them as fallback input creates the visible start-blocked behavior.
- Fix: default `auto` mode no longer uses dirty Allowed Paths as a project-root fallback trigger. The old behavior remains available only through explicit `AUTOFLOW_WORKTREE_MODE=project-root-on-dirty` / `fallback-on-dirty`, and the shared-path block smoke test now opts into that legacy mode.
- Current board reset after reproduction: PRDs 001-010 are back under `.autoflow/tickets/backlog/`; generated blocked tickets and `verify_001.md` from the failed start were archived under `.autoflow/archive/start-blocked-reset_20260426T045128Z/`.

---

# Processing Metrics Code And Token Usage Findings

- `packages/cli/metrics-project.sh` already emits Autoflow completion commit and code-volume fields: `autoflow_commit_count`, `autoflow_code_files_changed_count`, `autoflow_code_insertions_count`, `autoflow_code_deletions_count`, and `autoflow_code_volume_count`.
- Desktop `처리 지표` already reads those code-volume fields through `apps/desktop/src/main.js`, `apps/desktop/src/renderer/vite-env.d.ts`, and `apps/desktop/src/renderer/main.tsx`.
- Codex adapter stdout logs contain a stable local usage summary in the form `tokens used` followed by a comma-formatted number such as `95,413`.
- Runner adapter artifacts are persisted under `.autoflow/runners/logs/*_stdout.log` and `*_stderr.log`; live and loop logs should be ignored to avoid duplicate or incomplete readings.

---

# Coordinator Agent Findings

- `autoflow doctor` already exists and validates board scaffold, runner config/state, adapter availability, duplicate ticket IDs, starter files, and board version drift.
- The existing doctor does not inspect active ticket dependency chains, so a user can see several `blocked` pills without a concise root-cause chain.
- The runtime source of the common blocked case is `ticket_shared_allowed_path_blockers` in `runtime/board-scripts/common.sh`; it compares concrete `Allowed Paths` against lower-number active tickets in conflict stages.
- `run-role.sh` supports ticket, planner, todo, verifier, merge, and wiki roles, but needs a coordinator role for diagnosis plus ready-to-merge orchestration.
- `runners-project.sh` role validation needs `coordinator` so `autoflow runners add coordinator-1 coordinator ...` works.
- New boards should include a looped `coordinator-1` Codex runner for the AI Coordinator path. The raw `autoflow doctor` scanner remains shell-friendly and deterministic.
- Existing `ticket-owner-smoke` exposed an unrelated merge cleanup bug: `merge-ready-ticket.sh` used `git_root` after completion without defining it in main scope.
- On macOS, `setsid` is not available. The previous loop start fallback used plain `nohup`, which did not reliably detach from the launching process group in this environment; `coordinator-1` appeared started and then immediately became a stale PID.
- The first AI coordinator instruction still told the coordinator to run/resume `autoflow runners start coordinator-1`; inside a coordinator adapter turn, that caused recursive coordinator invocations instead of one bounded diagnostic/merge turn.
- Current live blocker chain is not a ready-to-merge backlog. `ready_to_merge_count=0`, `tickets_001` is the root active owner item, and tickets 004/005/009 are blocked behind lower-number active tickets through shared Allowed Paths.
- Current doctor evidence also shows dirty `PROJECT_ROOT` overlap and one shared non-base HEAD group (`001,005,009` on `edc3f23abb487081dd6f4323091519db7933a7b3`), so automatic repair would be destructive without an explicit repair policy.

---

# Coordinator Wiki Role Findings

- Current board docs define wiki maintenance as derived knowledge, never as the source of truth for ticket stage, pass/fail, or commits.
- Current `.autoflow/agents/coordinator-agent.md` covers diagnostics and one ready-to-merge integration, while `.autoflow/agents/wiki-maintainer-agent.md` separately covers wiki update/lint/query behavior.
- User requested expanding coordinator to include the wiki bot role, so the likely target is to fold wiki-maintainer post-processing and guidance into Coordinator Mode while keeping the wiki derived and idempotent.
- `merge-ready-ticket.sh` already runs deterministic `update-wiki.sh` after moving a ready ticket to done, then attempts a non-blocking `autoflow run wiki` adapter turn.
- The existing wiki adapter lookup only accepted `wiki` / `wiki-maintainer`; `query --synth`, `lint --semantic`, and post-merge wiki maintenance therefore needed coordinator fallback support.
- The old runtime config parser decided on a runner as soon as it saw `role = ...`, before reading a later `enabled = false`; coordinator fallback should evaluate complete `[[runners]]` blocks instead.
