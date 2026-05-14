# Worker Stop Investigation Findings

- 2026-05-12 조사 시작. `git diff --stat` 기준 기존 dirty 변경이 많다: `.autoflow/scripts/start-plan.ts`, ticket 이동/삭제, desktop package/dev script, `runner-pty-manager.js` 등이 포함된다. 이 변경은 되돌리지 않고 증거로만 취급한다.
- Planning session catchup은 이전 세션이 worktree cleanup/dev process 종료를 했다고 보고했지만, worker stop의 직접 원인인지는 아직 미확인이다.
- `.autoflow/runners/config.local.toml` 기준 실제 실행 config는 `worker`와 `worker-2` 두 worker runner를 동시에 enabled로 둔다. AGENTS/계약의 “동시에 살아 있는 worktree 0 또는 1개” 기본 운영과 충돌한다.
- `worker.state`와 `worker-2.state`가 모두 `active_ticket_id=Todo-319`, `active_stage=inprogress`를 가리킨다. process는 죽지 않았다: `ps` 기준 두 zsh/codex 프로세스 모두 살아 있다.
- 현재 보드에는 `Todo-319`가 `.autoflow/tickets/inprogress/Todo-319.md`와 `.autoflow/tickets/verifier/Todo-319.md`에 동시에 존재한다. `./bin/autoflow guard . .autoflow`가 `duplicate_ticket_ids` error로 동일하게 보고했다.
- `Todo-319` ticket 본문은 Done When이 모두 `[x]`이고 Verification passed로 기록됐지만 `Next Action`은 여전히 `finish-ticket.sh pass`다. 즉 구현/검증 이후 finalizer/merge 단계로 넘어가다 멈춘 상태다.
- `tickets_319` worktree에는 `.autoflow/scripts/start-plan.ts`, `runtime/board-scripts/start-plan.ts` 두 파일의 uncommitted diff가 있다. PROJECT_ROOT에는 같은 결과가 완전히 반영되지 않았다: worktree의 두 파일 hash는 동일하지만 PROJECT_ROOT의 두 파일 hash는 서로 다르고 worktree hash와도 다르다.
- `.autoflow/scripts/`와 runtime mirror의 `sync_runner_active_state()` 안 `ticket_id` 대입 라인이 깨져 있다: `ticket_id="Todo-20 20 ... 400extract_numeric_id "$ticket_file")"`. `bash -n`은 통과하지만 active state 갱신 시 잘못된 ticket id를 쓸 수 있는 데이터 손상이다.
- `Todo-319`의 `Claimed By` lock은 `worker-2:43594:2026-05-12T10:56:13Z`인데 pid 43594는 현재 존재하지 않는다. PTY shell pid는 `worker-2=4291`로 살아 있다. 즉 lock이 장기 실행 PTY pid가 아니라 짧게 끝나는 helper/script pid를 기록하고 있어, 다른 worker가 stale lock으로 판단해 같은 ticket을 takeover할 수 있다.
- Desktop PTY spawn env는 `AUTOFLOW_WORKER_ID`, `AUTOFLOW_RUNNER_ID`, `RUNNER_ID`만 넣고 `AUTOFLOW_WORKER_PID`를 넣지 않는다. `runner-common.sh`는 없으면 `$$`를 lock pid로 쓰므로 PTY 모드에서 claim liveness가 짧은 script pid에 묶인다.
- PTY start 시 `writePtyRunnerStateFile()`는 기존 state file을 merge하고 active ticket fields를 명시적으로 비우지 않는다. 그래서 `worker`가 11:21에 새 PTY로 시작됐는데도 예전 `active_ticket_id=Todo-319`가 남아 CLI `runners list`에서 두 worker가 같은 ticket을 잡은 것처럼 보인다.
- `./bin/autoflow doctor . .autoflow`는 runner pid는 모두 살아 있다고 보며, `verifier` role을 unsupported role warning으로 보고한다. 또한 detailed active-ticket traversal은 lock busy로 일부 생략됐다.

---

# Planner Runner Tools Findings

- 2026-05-12 방향 정리: 앞으로 `planner`, `worker`, `verifier`, `wiki`는 러너라고 부른다. 러너는 Codex/Claude 같은 실행 능력이 있는 LLM 주체이며, 러너 도구는 러너가 호출하는 작고 안전한 보드 조작 버튼이다.
- Codex/Claude 러너는 파일 읽기, `rg` 검색, 의미 판단, `Allowed Paths`/`Done When` 작성이 가능하므로 이 영역을 별도 도구가 대신 판단하면 안 된다.
- Planner 러너 도구의 적합한 책임은 번호 충돌 방지, queue snapshot, 템플릿/필수 섹션 검증, 안전한 파일 쓰기/이동, `Recovery State` 갱신, guard wrapper처럼 보드 무결성이 걸린 일이다.
- 기존 `.autoflow/agents/plan-to-ticket-agent.md`는 아직 `scripts/start-plan.*`를 첫 단계로 부르는 계약을 갖고 있다. 새 TS 도구는 먼저 additive MVP로 두고, 큰 script-driven 흐름은 compatibility wrapper로 점진 축소하는 편이 안전하다.
- Implemented MVP command surface: `scripts/runner-tool.js planner queue-snapshot`, `reserve-id`, `write-prd`, `write-ticket`, `item-archive`, `recovery-update`, and `guard`. The commands return JSON and do not draft scope or choose work.
- While testing `recovery-update`, `board-utils.ts` showed a formatting bug: replacing an empty scalar field produced `- Evidence:value`. The shared helper now normalizes replaced fields to `- Field: value`.
- `planner guard` must pass explicit `PROJECT_ROOT` / `AUTOFLOW_BOARD_ROOT` to `board-guard`; otherwise a board-local invocation can resolve `.autoflow/.autoflow` as the board root.

---

# Findings

## Wiki Runner Token Efficiency Findings

- Live runner process inspection showed loop worker bash processes are small (~1MB RSS), while `codex`, `gemini`, and MCP child processes dominate memory.
- Current snapshot measured approximate runner process trees: `planner` ~196MB RSS, `worker` ~194MB RSS, `wiki` ~297MB RSS.
- `run-role.sh` creates a fresh prompt file and launches a fresh adapter process on every AI tick. This prevents chat-context accumulation, but it also means each tick can pay the full prompt + board/wiki reread cost.
- Prompt artifacts are small: 671 prompt logs total ~1.8MB, average ~2.8KB. Token waste is not primarily the base prompt size.
- Runner stdout artifacts dominate disk: `.autoflow/runners/logs` is ~462MB, with stdout logs ~266MB.
- Current metrics report `autoflow_token_usage_count=52,977,703` over 554 token reports, average ~95.6k tokens/report.
- Wiki semantic lint builds a prompt from every wiki page up to 220 lines per page, then invokes the configured wiki adapter. This is the most obvious high-token wiki path.
- `wiki-project.sh` currently has synth/semantic adapter helpers, but no deterministic fingerprint gate for "inputs unchanged" before an AI semantic/synthesis pass.
- `run-role.sh` invokes the wiki adapter turn for `wiki`; the wiki agent then decides what tools to call. A preflight gate at this layer can skip launching the model entirely when done/reject/conversation/wiki inputs are unchanged.
- Implemented skip point: loop-mode wiki runs hash `tickets/done`, `tickets/reject`, `logs`, `conversations`, and `wiki` source files, stores the hash under runner state, and skips adapter startup when the hash is unchanged.
- Implemented low-value synth skip: `autoflow wiki query --synth` now returns `synth_status=skipped_no_results` when deterministic search returns zero results, avoiding an adapter call that cannot cite sources.

## Korean Terminal AI Response Findings

- User requested terminal conversations to appear in Korean and for the AI to speak Korean.
- Existing planning context shows many unrelated dirty files, including desktop renderer, runner scripts, board tickets, and wiki files. Treat them as pre-existing and avoid reverting them.
- Required board docs say installed board Markdown should remain concise, AI-friendly English, while user-facing docs/UI can be Korean. Therefore the likely fix is a prompt-level user-visible language directive, not translating all board contracts.
- Worker/automation docs route AI work through runner prompts and agent instruction files. Visible terminal conversation can be Korean while durable board files remain English.
- `bin/autoflow run ...` dispatches to `packages/cli/run-role.sh`; its `write_agent_prompt()` feeds Codex, Claude, OpenCode, and Gemini adapters.
- `runtime/board-scripts/run-role.sh` contains a similar prompt for packaged/generated runtime script copies, but it is currently older than `packages/cli/run-role.sh`.
- `packages/cli/wiki-project.sh` has separate adapter prompts for `wiki query --synth` and `wiki lint --semantic`; these produce key=value output and should keep exact machine-readable keys while making any natural-language values Korean.
- Legacy hook and heartbeat paths also generate prompts (`run-hook.ts` and `automations/templates/*heartbeat*.toml`). They need the same language rule for consistency when those compatibility routes are used.

## Worker Runner Tools Findings

- User direction: Worker must be LLM-led like Planner. Codex/Claude are capable coding agents, so runner tools should expose precise operations rather than pretend the tool is the agent.
- Existing Worker contract still pointed at `start-ticket.*` as the first macro. That macro combines queue selection, claim, worktree setup, recovery, and context writing, which is too large for the new boundary.
- Small Worker tools should cover deterministic surfaces only: active ticket lookup, todo snapshot/conflict hints, explicit claim, worktree creation/status, durable context updates, verification evidence recording, Done When/diff mechanical checks, and finalizer wrappers.
- Worker tools must not implement code, choose which todo to claim, infer scope, judge semantic correctness, decide pass/fail, or merge conflicts.
- Worktree creation can be split safely because it already has deterministic inputs: ticket id, git root, base commit, branch name, worktree root, and recorded Worktree fields.
- Smoke coverage should force `AUTOFLOW_WORKTREE_ROOT` into a temp directory so worktree tests do not leave global cache state.

## Verifier Runner Tools Findings

- Verifier should stay smaller than Worker: it does not implement or merge, it only reviews whether the finished diff semantically matches Title/Goal/Done When/Acceptance Probe.
- Existing Verifier contract already has deterministic side effects: queue scan, diff extraction, verifier-ok marker, latency log, wake marker, and finalizer re-entry. These are good runner-tool targets.
- The semantic decision cannot be a tool result because only the LLM can compare intent, diff meaning, and checklist truthfulness. The tool should output evidence and require an explicit `--decision` / `--reason`.
- `finish-ticket.*` expects verifier bypass through `AUTOFLOW_SKIP_VERIFIER=1` or `runners/state/verifier-ok-<id>.marker`; Verifier pass tooling should set both before finalizer re-entry.
- Smoke testing should avoid destructive pass/fail finalization and instead verify queue snapshot, evidence extraction, decision logging, pass marker creation, and wake marker creation.

## Wiki Runner Tools Findings

- Wiki runner-tool should be a wrapper layer around existing deterministic wiki CLI operations, not a new knowledge synthesizer.
- Wiki AI remains responsible for deciding whether source changes deserve baseline refresh, focused page synthesis, raw ingest, or semantic lint triage.
- Safe Wiki tool surfaces are source/diff snapshots, explicit `autoflow wiki update/query/lint/summarize-telemetry/ingest/retrofit-frontmatter` calls, validated board-local `wiki/` and `wiki-raw/` writes, and realtime wake markers.
- `write-page` must reject absolute paths, `..`, project-root `wiki/`, and non-markdown targets so Wiki AI cannot accidentally write outside `$AUTOFLOW_BOARD_ROOT`.
- `.autoflow/wiki/` is intentionally gitignored in normal boards, so diff tooling should report scoped status when files are tracked/staged but smoke tests need `git add -f` for wiki page fixtures.

## Shell To TS Migration Findings

- Small support wrappers with existing TS bodies are the safest first deletion group: `board-guard`, `integrate-worktree`, `lint-ticket`, `path-conflict-check`, and `state-db`.
- Directly executing `.ts` entrypoints now relies on repo-local `tsx`/CLI dispatch instead of keeping per-script `.js` wrappers.
- `packages/cli/guard-project.sh`, `packages/cli/origin-project.sh`, `packages/cli/doctor-project.sh`, packaging, and related smoke tests now reference TS entrypoints instead of `.sh`.
- The TS wrapper must infer `AUTOFLOW_BOARD_ROOT` when executed from an installed board's `scripts/` directory or from the board root itself; otherwise TS helpers resolve paths like `.autoflow/.autoflow`.
- `board-guard-recovery-protocol-sync-smoke.sh` now reads enum values from `board-guard.ts`; this exposed missing `resolved`, `dirty_root_cleared`, and `dirty_project_root_conflict` entries in `protocols/recovery.md`, which were added to dogfood and scaffold docs.
- Core lifecycle shell remains risky: `finish-ticket.sh` is still the durable finalizer, while current board has dirty `start-plan.ts` work tied to active tickets. These should be later phases, not mixed into small support deletion.

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
- The current default execution model is `worker`: one runner owns local planning, implementation, verification, evidence, and done/reject movement.
- Legacy `planner/todo/verifier` role pipeline remains as a compatibility path, but new/default behavior should prefer `worker`.
- Runner/process state lives under `runners/` and should not replace ticket stage state.
- Existing CLI supports `run ticket`, `run planner/todo/verifier/wiki`, watcher, stop hook, metrics, doctor, runner management, and desktop observation.

## Local Implementation Evidence
- `bin/autoflow` is a Bash dispatcher over project-scoped CLI scripts.
- `packages/cli/run-role.sh` validates runner config, picks the runtime role, writes runner state/logs, and either invokes a local runtime script or an external agent adapter.
- External adapter support is prompt based for `codex`, `claude`, `opencode`, and `gemini`; dry runs persist prompt/log artifacts.
- `runtime/board-scripts/start-ticket.sh` already models a deterministic worker state selection order: resume owned inprogress, requested ticket, todo, verifier, populated backlog spec, then idle.
- `verify-ticket.ts` runs the verification command from the ticket/spec and records evidence into `verify_*.md`.
- `finish-ticket.sh` handles pass/fail, worktree integration, done/reject movement, verifier log writing, and optional local commit.
- `watch-board.ts` polls board fingerprints and dispatches routes through `run-hook.ts`; it is an event trigger layer, not a graph executor.
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
- Current runner config has one `worker` runner with `role = "worker"`, `agent = "codex"`, `mode = "one-shot"`.
- File watcher enables the `ticket` route only by default; legacy `plan`, `todo`, and `verifier` routes are disabled.
- The worker agent contract explicitly says to keep the ticket file as source of truth, write a mini-plan, verify, record evidence, and finish pass/fail without splitting responsibility.

## Fit Recommendation
- LangGraph is feasible, but should not become the authoritative state store for Autoflow right now.
- Best fit: an optional `worker` runner/adapter that uses LangGraph internally for plan/implement/verify/retry/human-review routing while preserving `tickets/` markdown files as the source of truth.
- Good candidates: human approval before risky shell/git actions, verification-failure retry loops, streaming node updates to the desktop app, and resumable long-running worker turns.
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
- Its best wedge is a repo-local source-of-truth harness: `.autoflow/tickets/` as execution ledger, worker lifecycle, evidence records, local worktree isolation, no-push guard, and metrics/reporting.
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

- User screenshot shows multiple Codex Worker runners displayed as `실행 중`, current item `tickets_003`, `tickets_005`, `tickets_007`, `tickets_004`, with the visible pill `막힘`; one runner for `tickets_001` is at `구현 중`.
- Initial git status shows several `.autoflow/tickets/inprogress/*.md`, verification files, reject files, wiki files, and desktop renderer/main files are already dirty before this debug pass.
- Relevant board contract: `inprogress` tickets may remain blocked, but worker mode should continue implementation and verification, and runner state should not replace ticket stage state.
- Runner evidence before cleanup: worker through worker-5 were loop workers with live PIDs and active tickets; worker/2/3/5 had `active_stage=blocked`, worker-4 had `active_stage=executing`.
- Repeated `막힘` is backed by real ticket state, not only a renderer label: tickets 003/004/005/007 carry `Stage: blocked` with `shared_allowed_path_conflict`; logs also show worktree dependency hydration and stale verification path failures.
- Worktree cleanup archive: `.autoflow/logs/worktree-cleanup_20260426T042800Z/` contains status/diff/staged/untracked records for each removed worktree. Non-empty diffs existed for `autoflow_tickets_003`, `autoflow_tickets_006_local`, `autoflow_tickets_007`, and stale `autoflowLab_*` worktrees.
- After cleanup, `git worktree list --porcelain` shows only `/Users/demoon/Documents/project/autoflow`; all Autoflow project worker runners are `stopped` with empty active ticket metadata.
- One unrelated loop worker remains for another project: `worker-6` on `/Users/demoon/Documents/project/tetris`; it was intentionally not stopped during the Autoflow project cleanup.
- The only remaining reject ticket was `.autoflow/tickets/reject/reject_006.md`; it was replanned with the runtime's existing `replan_reject_to_todo` logic and moved to `.autoflow/tickets/todo/tickets_006.md` with `Stage: todo`, blank worker fields, `Integration Status: pending_claim`, and `Retry Count: 7`.
- Manual PRD restart reset moved active tickets 001, 003, 004, 005, and 007 from `inprogress/` to `todo/` with `Stage: todo`, blank worker fields, `Integration Status: pending_claim`, and pending verification/result fields. Existing `verify_001.md`, `verify_003.md`, `verify_005.md`, and `verify_007.md` were archived under `.autoflow/logs/requeue-inprogress_20260426T043110Z/`.
- Full tickets reset preserved every PRD document by moving PRDs 001 through 010 into `.autoflow/tickets/backlog/`, then removed generated ticket, done, reject, and verifier files from `.autoflow/tickets/`. The previous ticket tree was archived under `.autoflow/logs/tickets-reset_20260426T043324Z/tickets-before-reset/`.
- The desktop `처리 지표` view also depends on `.autoflow/metrics/daily.jsonl` and verifier completion logs. The previous metrics history and 39 verifier completion logs were archived under `.autoflow/archive/metrics-reset_20260426T043803Z/`, and the report card calculation was corrected so runners without artifacts no longer count as `AI 산출물`.
- New start-blocked reproduction: after the PRD-only reset, starting five worker runners moved PRDs 001-005 into `tickets/done/prd_*/` and created five inprogress tickets. `tickets_001` reached `planning`, while `tickets_002` through `tickets_005` immediately became `Stage: blocked` with `Runtime auto-blocked: shared_allowed_path_conflict`.
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
- Existing `worker-smoke` exposed an unrelated merge cleanup bug: `merge-ready-ticket.sh` used `git_root` after completion without defining it in main scope.
- On macOS, `setsid` is not available. The previous loop start fallback used plain `nohup`, which did not reliably detach from the launching process group in this environment; `coordinator-1` appeared started and then immediately became a stale PID.
- The first AI coordinator instruction still told the coordinator to run/resume `autoflow runners start coordinator-1`; inside a coordinator adapter turn, that caused recursive coordinator invocations instead of one bounded diagnostic/merge turn.
- Current live blocker chain is not a ready-to-merge backlog. `ready_to_merge_count=0`, `tickets_001` is the root active worker item, and tickets 004/005/009 are blocked behind lower-number active tickets through shared Allowed Paths.
- Current doctor evidence also shows dirty `PROJECT_ROOT` overlap and one shared non-base HEAD group (`001,005,009` on `edc3f23abb487081dd6f4323091519db7933a7b3`), so automatic repair would be destructive without an explicit repair policy.

---

# Coordinator Wiki Role Findings

- Current board docs define wiki maintenance as derived knowledge, never as the source of truth for ticket stage, pass/fail, or commits.
- Current `.autoflow/agents/coordinator-agent.md` covers diagnostics and one ready-to-merge integration, while `.autoflow/agents/wiki-maintainer-agent.md` separately covers wiki update/lint/query behavior.
- User requested expanding coordinator to include the wiki bot role, so the likely target is to fold wiki-maintainer post-processing and guidance into Coordinator Mode while keeping the wiki derived and idempotent.
- `merge-ready-ticket.sh` already runs deterministic `update-wiki.ts` after moving a ready ticket to done, then attempts a non-blocking `autoflow run wiki` adapter turn.
- The existing wiki adapter lookup only accepted `wiki` / `wiki-maintainer`; `query --synth`, `lint --semantic`, and post-merge wiki maintenance therefore needed coordinator fallback support.
- The old runtime config parser decided on a runner as soon as it saw `role = ...`, before reading a later `enabled = false`; coordinator fallback should evaluate complete `[[runners]]` blocks instead.

---

# Planner Needs-Info Token Gate Findings

- `memo_005` is parked at `Status: needs-info`; `start-plan.sh` treats only empty, `inbox`, `ready`, and `pending` memo statuses as actionable.
- The active `planner` runner is a Codex loop runner with `interval_seconds=60` and `reasoning=xhigh`, so every idle tick can be expensive if the adapter is launched before checking runtime state.
- `start-plan.sh` already provides a deterministic cheap runtime answer (`status=idle`, `reason=no_actionable_plan_input`) when no actionable planner input exists.
- The current expensive path happens because `run-role.sh` only preflights worker runs; planner runs launch Codex first and let the AI call `start-plan.sh` itself.
- For autonomous operation, `needs-info` cannot mean "ask a human every minute." User clarified memo intake should not ask questions; memos are directives that should be promoted by inference unless unsafe.
- After `memo_005` was made actionable, live `planner` generated `prd_039` and `tickets_039`, but the source memo remained in `tickets/inbox/`. Without an archive/skip guard, the next planner tick could duplicate the generated PRD from the same memo.
- The runtime can deterministically recognize already-promoted memos by scanning backlog/done PRDs for `## Conversation Handoff` sources that reference the memo.
- The live runner config set `planner` to `reasoning="xhigh"`, which made each mistaken planner tick expensive. Planner work does not need xhigh reasoning by default, so the current board config should use `medium`.
