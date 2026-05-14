# Task Plan: Worker Stop Investigation

## Goal
워커가 계속 멈추는 현재 원인을 증거 기반으로 파악하고, 재현 가능한 로그/상태 근거와 다음 조치를 정리한다.

## Scope
- `.autoflow/` 보드 계약, runner 상태, 최근 로그, ticket 상태, worktree 상태를 조사한다.
- 원인 확인 전에는 코드 수정이나 runner 재시작을 하지 않는다.
- 기존 dirty worktree 변경은 사용자/이전 작업의 증거로 취급하고 되돌리지 않는다.

## Phases
- [x] 디버깅/계획 스킬과 기존 계획 파일 상태 확인.
- [x] AGENTS read order에 맞춰 Autoflow 보드 계약 확인.
- [x] worker runner 상태와 최근 로그 수집.
- [x] 현재 ticket/worktree/git 상태와 멈춤 이벤트 연결.
- [x] 근본 원인 가설을 세우고 최소 검증.
- [x] 사용자에게 원인과 안전한 다음 조치 보고.

## Verification
- [x] 관련 runner state/log/ticket 파일에서 같은 원인을 교차 확인.
- [x] 필요 시 `autoflow` 상태/metrics/doctor 명령으로 현재 상태 확인.

## Risks
- 현재 worktree가 이미 dirty하므로 멈춤 원인과 unrelated dirty 변경을 구분해야 한다.
- 자동 runner가 동시에 파일을 갱신할 수 있으므로 로그 타임스탬프와 state를 함께 본다.

---

# Task Plan: Planner Runner Tools MVP

## Goal
Planner 러너가 큰 shell 주도 흐름에 덜 의존하도록, Codex/Claude가 직접 판단하고 호출할 수 있는 작은 TypeScript 러너 도구 MVP를 추가한다.

## Scope
- Planner 러너 도구의 개념을 문서화한다: `planner`, `worker`, `verifier`, `wiki`는 러너이고, 러너 도구는 러너가 호출하는 작은 실행 버튼이다.
- Planner 1차 도구는 보드 무결성이 필요한 기능으로 제한한다: queue snapshot, id reservation, PRD/ticket write, archive, recovery update, guard wrapper.
- 기존 대형 `start-plan.*` 흐름을 즉시 제거하지 않고 compatibility 경로로 남긴다.
- 기존 dirty worktree 변경은 되돌리지 않는다.

## Phases
- [x] 기존 Planner 계약과 현재 TS 스크립트 구조 확인.
- [x] Planner runner-tool CLI 설계 및 구현.
- [x] 문서에 러너/러너 도구 관계와 Planner 도구 목록 반영.
- [x] 최소 smoke/usage 검증 추가.
- [x] 관련 검증 명령 실행.

## Verification
- [x] Runner tool help/queue snapshot command 실행.
- [x] 가능한 경우 임시 보드에서 write/archive 기능 smoke 검증.
- [x] TypeScript 또는 Node syntax check.
- [x] Targeted `git diff --check`.

## Risks
- 현재 worktree가 이미 dirty하므로 새 파일/문서 수정 범위를 좁게 유지해야 한다.
- 기존 `start-plan.*`이 아직 실제 runner 경로이므로 새 도구는 먼저 additive로 넣어야 한다.

---

# Task Plan: Worker Runner Tools MVP

## Goal
Worker 러너가 Codex/Claude 판단을 중심으로 티켓을 claim, worktree 준비, evidence 기록, 기계적 점검까지 작은 TypeScript 러너 도구로 수행하게 만든다.

## Scope
- Worker 러너 도구는 `active-get`, `todo-snapshot`, `claim`, `worktree-ensure/status`, `stage/context-update`, `verification-record`, `done-when-check`, `diff-check`, `finish-pass/fail`로 제한한다.
- Worker 도구는 티켓 선택, 구현 방법, semantic verification, pass/fail 판단을 하지 않는다.
- 기존 `start-ticket.*`, `verify-ticket.*`, `finish-ticket.*`는 compatibility macro/finalizer 로 남긴다.
- 기존 dirty worktree 변경은 되돌리지 않는다.

## Phases
- [x] 기존 Worker 계약과 worktree/claim 흐름 확인.
- [x] `runner-tool.ts`에 Worker 명령 추가.
- [x] Worker runner-tool 문서와 current/scaffold 보드 계약 반영.
- [x] Worker runner-tool smoke test 추가.
- [x] 관련 검증 명령 실행.

## Verification
- [x] `worker-runner-tool-smoke.sh`
- [x] 기존 `planner-runner-tool-smoke.sh`
- [x] runtime companion smoke
- [x] Node/tsx syntax or command checks
- [x] Targeted `git diff --check`

## Risks
- `finish-ticket.*`는 여전히 큰 finalizer 이므로 Worker tool은 wrapper로만 노출하고 pass/fail 판단은 AI가 유지해야 한다.
- Worktree 생성은 git 상태와 로컬 캐시에 민감하므로 smoke test는 `AUTOFLOW_WORKTREE_ROOT`를 임시 폴더로 고정한다.

---

# Task Plan: Verifier Runner Tools MVP

## Goal
Verifier 러너가 semantic diff 검토는 직접 판단하고, 증거 수집과 pass/fail 라우팅만 작은 TypeScript 러너 도구로 수행하게 만든다.

## Scope
- Verifier 러너 도구는 `queue-snapshot`, `evidence`, `decision-record`, `finish-pass`, `finish-fail`, `wake`로 제한한다.
- Verifier 도구는 diff가 Goal/Done When에 맞는지 의미 판단하지 않는다.
- pass/fail finalizer 호출은 wrapper로만 제공하고, 판단 이유는 Verifier AI가 명시한다.
- 기존 dirty worktree 변경은 되돌리지 않는다.

## Phases
- [x] 기존 Verifier 계약과 finish hook 흐름 확인.
- [x] `runner-tool.ts`에 Verifier 명령 추가.
- [x] Verifier runner-tool 문서와 scaffold packaging 반영.
- [x] Verifier runner-tool smoke test 추가.
- [x] 관련 검증 명령 실행.

## Verification
- [x] `verifier-runner-tool-smoke.sh`
- [x] 기존 Planner/Worker runner-tool smoke
- [x] runtime companion smoke
- [x] Node/tsx syntax or command checks
- [x] Targeted `git diff --check`

## Risks
- `finish-pass`는 기존 finalizer를 재호출하므로 smoke에서는 destructive routing 대신 evidence/decision-record 중심으로 검증한다.
- Verifier evidence patch는 커질 수 있으므로 기본 patch byte cap을 둔다.

---

# Task Plan: Wiki Runner Tools MVP

## Goal
Wiki 러너가 지식 정리 판단은 직접 하고, 소스 스냅샷·기존 wiki CLI 호출·검증된 wiki 파일 쓰기·diff/wake 확인만 작은 TypeScript 러너 도구로 수행하게 만든다.

## Scope
- Wiki 러너 도구는 `source-snapshot`, `update-baseline`, `telemetry-summary`, `query`, `lint`, `ingest`, `retrofit-frontmatter`, `write-page`, `diff-snapshot`, `wake`로 제한한다.
- Wiki 도구는 어떤 내용을 위키에 남길지, 어떤 페이지를 합성할지, semantic lint 결과를 어떻게 해석할지 결정하지 않는다.
- 기존 `autoflow wiki ...` CLI는 compatibility/runtime implementation으로 유지하고 runner-tool은 안전한 wrapper와 board-local write validator 역할만 한다.
- 기존 dirty worktree 변경은 되돌리지 않는다.

## Phases
- [x] 기존 Wiki 계약과 wiki CLI 흐름 확인.
- [x] `runner-tool.ts`에 Wiki 명령 추가.
- [x] Wiki runner-tool 문서와 current/scaffold 보드 계약 반영.
- [x] Wiki runner-tool smoke test 추가.
- [x] 관련 검증 명령 실행.

## Verification
- [x] `wiki-runner-tool-smoke.sh`
- [x] 기존 Planner/Worker/Verifier runner-tool smoke
- [x] runtime companion smoke
- [x] Node/tsx syntax or command checks
- [x] Targeted `git diff --check`

## Risks
- Wiki CLI 일부 명령은 adapter를 부를 수 있으므로 smoke는 deterministic `query --rag`, `lint`, `update --dry-run` 중심으로 검증한다.
- `.autoflow/wiki/`는 보통 gitignored라 diff smoke는 temp repo에서 필요한 파일만 `git add -f`로 staged 상태를 만든다.

---

# Task Plan: Shell To TS Migration

## Goal
기존 runner/runtime shell 사용을 순서대로 줄인다. 이미 TS/JS 본체가 있는 도구는 `.sh` wrapper를 삭제하고, 아직 shell 본체인 핵심 finalizer/CLI는 이후 단계에서 기능 단위로 TS 전환한다.

## Scope
- 1단계는 small support runtime만 다룬다: `board-guard`, `integrate-worktree`, `lint-ticket`, `path-conflict-check`, `state-db`.
- 1단계에서 `start-plan.ts` / `start-ticket.ts` / `finish-ticket.sh` 본문은 건드리지 않는다. 현재 보드에 별도 dirty 변경과 active ticket이 있기 때문이다.
- `.sh` 삭제 전 호출부를 `.js` 또는 `.ts` 기반 실행으로 바꾼다.
- 기존 dirty worktree 변경은 되돌리지 않는다.

## Phases
- [x] 전환 대상 sh 목록과 기존 TS/JS 대체물 확인.
- [x] small support TS 실행용 JS wrapper 추가.
- [x] 패키징/doctor/CLI 호출부를 small support `.js` 기준으로 전환.
- [x] small support `.sh` wrapper 삭제 및 current board mirror 반영.
- [x] smoke/문법 검증 실행.
- [x] 다음 단계 대상(`finish-ticket`, `verify-ticket`, `update-wiki`) 세부 계획 갱신.

## Next Migration Order
- [ ] `finish-ticket.sh`: pass/fail finalizer를 기능 단위로 쪼개서 TS 모듈화. 가장 중요하지만 위험도가 높으므로 sanity gate, verifier handoff, retry inbox 발행, commit/PR draft 생성을 분리해서 진행한다.
- [ ] `verify-ticket.ts`: verifier runner 계약과 evidence 기록을 TS runner tool로 이동한다. `finish-ticket`와 연결되므로 두 번째 순서가 안전하다.
- [ ] `update-wiki.ts`: Wiki runner가 직접 호출하는 wiki update 도구를 TS로 이동한다. wiki commit/content gate는 유지한다.
- [ ] legacy lifecycle shell(`start-plan.legacy.sh`, ``, `start-todo.ts`) 삭제 후보를 재검토한다. 현재 active board 호환성이 남아 있으므로 즉시 삭제하지 않는다.
- [ ] large CLI shell(`run-role.sh`, `runners-project.sh`, `wiki-project.sh`, `doctor-project.sh`)은 마지막 단계에서 adapter/run-loop API를 안정화한 뒤 쪼갠다.

## Verification
- [x] `runtime-script-companion-smoke.sh`
- [x] `active-runtime-mirror-smoke.sh`
- [x] `board-guard-smoke.sh`
- [x] `board-guard-recovery-protocol-sync-smoke.sh`
- [x] `worker-allowed-path-noise-commit-scope-smoke.sh`
- [x] `worker-smoke.sh`
- [x] `node --check` for new JS wrappers
- [x] targeted `git diff --check`

## Risks
- TS 파일 shebang은 `tsx` 전역 설치에 의존할 수 있으므로 `.js` wrapper가 local `node_modules/.bin/tsx` 또는 `npx tsx`를 선택해야 한다.
- lifecycle/finalizer smoke에는 아직 다른 `.sh` 런타임이 남아 있으므로 다음 단계도 기능 단위로 쪼개서 진행한다.

---

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

# Task Plan: Wiki Runner Token Efficiency

## Goal
Reduce unnecessary wiki-bot LLM/token usage and long-running adapter memory cost while keeping the deterministic wiki baseline and query/lint behavior correct.

## Scope
- Improve wiki runner preflight so idle loop ticks can skip adapter startup when wiki inputs have not changed.
- Keep explicit `autoflow wiki query --synth` and `autoflow wiki lint --semantic` available when requested.
- Add lightweight local state/fingerprints instead of changing ticket or wiki source-of-truth rules.
- Keep edits scoped to CLI/runtime scripts and focused tests.

## Phases
- [x] Read board rules, wiki runner contracts, planning files, and current process/token evidence.
- [x] Trace current wiki adapter invocation and identify the smallest skip/cache point.
- [x] Implement deterministic wiki idle gate and low-value synth skip.
- [x] Add targeted smoke coverage for skip/run behavior.
- [x] Run verification commands and whitespace checks.

## Decisions
- Do not stop live `planner`, `worker`, or `wiki` during investigation unless explicitly requested.
- Avoid touching dirty desktop/UI/board files unrelated to this optimization.
- Prefer deterministic input fingerprints over model-specific token accounting.

## Verification
- [x] Shell syntax checks for changed scripts.
- [x] Targeted wiki smoke test.
- [x] `git diff --check` for changed files.

## Risks
- A too-aggressive skip could miss meaningful wiki source changes.
- Live `worker` is currently active on `tickets_038`; avoid overlapping edits to files it may be changing.

---

# Task Plan: Blocked Runner Status Debug

## Goal
Find why the desktop progress view repeatedly shows Worker runners as `막힘`, then implement a code-level fix that reflects actionable blocked state without hiding real failures.

## Scope
- Inspect board/runtime contracts, runner state files, desktop state derivation, and ticket files.
- Reproduce the status derivation from local `.autoflow/` data.
- Fix the root cause in the smallest safe code surface.
- Verify with targeted desktop checks and local state inspection.
- Do not revert unrelated dirty board or desktop changes.

## Phases
- [x] Read Autoflow board rules and debugging/planning instructions.
- [x] Gather runner/ticket evidence for the current repeated `막힘` display.
- [x] Trace the desktop status derivation path from files to Korean UI labels.
- [x] Stop active worker runners and remove ticket worktrees after archiving their diffs.
- [x] Move the remaining rejected ticket back to `todo/` for rework.
- [x] Reset all active inprogress tickets back to `todo/` so PRD work can restart cleanly.
- [x] Reset `.autoflow/tickets/` to PRD-only backlog state with no generated ticket, done, reject, or verifier files.
- [x] Reset processing metrics history and verifier completion logs so the desktop `처리 지표` view starts from zero.
- [x] Identify root cause and add a failing/targeted check if practical.
- [x] Implement the minimal fix for dirty-root worktree fallback.
- [x] Reset the current board after the blocked-start reproduction.
- [x] Verify code checks and local status output.

## Decisions
- Treat existing dirty `.autoflow/` board changes as evidence, not as changes to revert.
- Prefer non-browser verification unless rendered behavior must be observed.

## Verification
- [ ] Targeted unit/script check for status derivation, if available.
- [ ] `npm --prefix apps/desktop run check`
- [ ] Targeted whitespace check for changed files.
- [x] `./bin/autoflow runners list . .autoflow` shows worker through worker-5 stopped with no active ticket metadata.
- [x] `git worktree list --porcelain` shows only the main project worktree after cleanup.
- [x] `./bin/autoflow metrics . .autoflow` reports `reject_count=0` and `ticket_todo_count=1`.
- [x] `./bin/autoflow status . .autoflow` reports `ticket_todo_count=6`, `ticket_inprogress_count=0`, `ticket_executing_count=0`, `ticket_blocked_count=0`, and `ticket_worker_active_count=0`.
- [x] `./bin/autoflow metrics . .autoflow` reports `reject_count=0`, `runner_running_count=0`, `runner_blocked_count=0`, and `runner_stopped_count=5`.
- [x] `./bin/autoflow status . .autoflow` reports `spec_count=10`, `ticket_todo_count=0`, `ticket_done_count=0`, `ticket_blocked_count=0`, and `verify_run_count=0` after PRD-only reset.
- [x] `find .autoflow/tickets -type f ! -path '.autoflow/tickets/backlog/prd_*.md'` returns no files.
- [x] `./bin/autoflow metrics . .autoflow` reports `ticket_total=0`, `verifier_total=0`, `autoflow_commit_count=0`, `autoflow_code_volume_count=0`, and both percentage metrics at `0.0`.
- [x] `npm --prefix apps/desktop run check` after the `AI 산출물` report-count correction.
- [x] `bash tests/smoke/worker-dirty-root-worktree-smoke.sh`
- [x] `bash tests/smoke/worker-shared-path-block-smoke.sh`
- [x] `bash tests/smoke/worker-smoke.sh`
- [x] `diff -q runtime/board-scripts/common.sh .autoflow/scripts/common.sh`
- [x] `git diff --check -- runtime/board-scripts/common.sh .autoflow/scripts/common.sh tests/smoke/worker-dirty-root-worktree-smoke.sh tests/smoke/worker-shared-path-block-smoke.sh task_plan.md findings.md progress.md .autoflow/tickets .autoflow/archive/start-blocked-reset_20260426T045128Z`

## Risks
- Current board state is actively dirty and may reflect in-flight runner activity.
- Desktop UI may be showing a derived label rather than the authoritative ticket state.

---

# Task Plan: Processing Metrics Code And Token Usage

## Goal
Show code change volume and AI token usage in processing metrics.

## Scope
- Extend `autoflow metrics` output and JSON snapshots.
- Surface token usage in the desktop `처리 지표` dashboard.
- Keep existing code-change metrics intact.
- Avoid reverting unrelated dirty board/runtime/UI work.

## Phases
- [x] Inspect existing metrics CLI and desktop reporting code.
- [x] Identify token usage source in runner adapter logs.
- [x] Implement token aggregation in CLI metrics.
- [x] Add token fields to desktop metrics history/types/report cards.
- [x] Update metrics documentation.
- [x] Add or run targeted verification.

## Decisions
- Use runner adapter stdout/stderr logs under `runners/logs/` as the token source.
- Parse Codex CLI's current `tokens used` summary as total token usage; keep the metric agent-agnostic enough to tolerate future `total_tokens` style lines.
- Keep code-change metrics based on Autoflow completion commits, excluding board markdown/log churn.

## Verification
- [x] `./bin/autoflow metrics .`
- [x] `./bin/autoflow metrics . --write` on a disposable board via `tests/smoke/metrics-token-usage-smoke.sh`
- [x] `npm --prefix apps/desktop run check`
- [x] `bash tests/smoke/metrics-token-usage-smoke.sh`
- [x] `git diff --check` on changed files

## Risks
- Token output formats differ by adapter; this pass reports only token totals that are observable in local runner logs.
- Current worktree is heavily dirty from active dogfood board work; changes must stay tightly scoped.

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
- Recommendation: do not replace the file-based board with LangGraph; consider an optional LangGraph-backed `worker` runner/adapter if deeper retry, streaming, or human approval loops become necessary.

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

# Task Plan: Korean Terminal AI Responses

## Goal
Make Autoflow terminal/adapter AI conversations use Korean by default where the project controls agent prompts and runner-facing instructions.

## Scope
- Inspect Autoflow board/rule docs in the required project read order.
- Locate runner prompt generation and terminal-facing agent instruction files.
- Add a scoped language directive that makes AI terminal output Korean without changing storage IDs or English runtime contracts that need to remain machine-friendly.
- Verify with targeted static checks and any prompt dry-run available.
- Avoid reverting or normalizing unrelated dirty work.

## Phases
- [x] Read required Autoflow board docs and relevant agent/runtime docs.
- [x] Trace how terminal AI prompts are generated for Codex/Claude/etc.
- [x] Implement the smallest language-policy change.
- [x] Verify generated prompt/content and syntax/whitespace checks.

## Decisions
- Keep board/runtime contracts machine-readable; user-facing terminal conversation should be Korean.
- Do not touch unrelated dirty desktop, wiki, ticket, or runner changes.

## Verification
- [x] Targeted prompt inspection or dry-run.
- [x] Relevant shell syntax checks if scripts are changed.
- [x] `git diff --check` for changed files.
- [ ] `autoflow render-heartbeats` on live board (blocked: placeholder/non-real target thread id).

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `render-heartbeats` rejected the live `.autoflow/automations/heartbeat-set.toml` target thread id | Tried `./bin/autoflow render-heartbeats . .autoflow` | Verified heartbeat language directives by direct template search instead. |

## Risks
- Some agent docs are intentionally English for machine contracts, so the fix should be explicit about visible terminal responses rather than translating all docs.

# Task Plan: Coordinator Wiki Bot Role

## Goal
Extend Coordinator Mode so the coordinator also covers wiki-maintainer responsibilities instead of requiring a separate visible wiki bot role.

## Scope
- Inspect coordinator, wiki, runner, scaffold, and CLI runtime wiring.
- Prefer reusing existing `autoflow wiki` commands and managed-section rules.
- Keep `.autoflow/tickets/` as source of truth; wiki remains derived knowledge.
- Avoid reverting unrelated dirty work already present in the repository.

## Phases
- [x] Read Autoflow board contracts and coordinator/wiki role prompts.
- [x] Map existing coordinator and wiki runtime implementation.
- [x] Implement the smallest safe coordinator/wiki integration.
- [x] Update current board and scaffold documentation/config if needed.
- [x] Run targeted CLI/smoke verification.

## Decisions
- Preserve coordinator's no-implementation boundary.
- Treat wiki maintenance as a post-merge/derived-knowledge responsibility inside coordinator mode.

## Verification
- [x] `bash -n packages/cli/run-role.sh packages/cli/wiki-project.sh packages/cli/metrics-project.sh packages/cli/coordinator-project.sh runtime/board-scripts/merge-ready-ticket.sh runtime/board-scripts/finish-ticket.sh runtime/board-scripts/check-stop.ts runtime/board-scripts/run-hook.ts runtime/board-scripts/start-ticket.sh runtime/board-scripts/verify-ticket.ts tests/smoke/worker-smoke.sh tests/smoke/doctor-blocked-ticket-smoke.sh bin/autoflow`
- [x] `bash tests/smoke/worker-smoke.sh`
- [x] `bash tests/smoke/doctor-blocked-ticket-smoke.sh`
- [x] Temp `autoflow wiki query --synth --runner coordinator-shell-1` returned `synth_status=skipped_no_adapter` after selecting a coordinator role runner.
- [x] Temp `autoflow wiki lint --semantic --runner coordinator-shell-1` returned `semantic_status=skipped_no_adapter`.
- [x] Runtime/current-board mirror `diff -q` checks for changed scripts and agent/reference docs.
- [x] `./bin/autoflow metrics .`
- [x] `git diff --check` on changed files.

## Risks
- The worktree is already heavily dirty from active dogfood work; changes must stay tightly scoped.
- Existing live coordinator loop state may be active, so config/runtime edits should avoid destructive state operations.

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

# Task Plan: Coordinator Agent For Blocked Work And Merge

## Goal
Make Autoflow explain frequent `blocked` runner states and let a coordinator role process ready-to-merge work when present.

## Scope
- Extend `autoflow doctor` output with active-ticket operational triage.
- Allow `coordinator` as a local runner role through `autoflow runners start coordinator-1`.
- Add AI-friendly coordinator agent instructions.
- Add a coordinator runtime that runs doctor diagnostics and invokes one ready-to-merge runtime when present.
- Add focused smoke coverage for blocked shared-path diagnosis.
- Avoid changing live ticket state or repairing work automatically in this pass.

## Phases
- [x] Inspect existing doctor, runner, and shared-path conflict runtime code.
- [x] Implement doctor active-ticket diagnostics.
- [x] Wire `coordinator` into runner role validation and `autoflow run`.
- [x] Document the coordinator role and add smoke coverage.
- [x] Verify shell syntax, smoke behavior, and whitespace.

## Decisions
- Keep `autoflow doctor` as a deterministic scanner.
- Use `autoflow runners start coordinator-1` for the role-level loop: diagnostics first, then one ready-to-merge integration if available.
- Treat shared Allowed Path blockers as warnings rather than errors, because a serialized queue can be intentional; the value is surfacing the real chain.
- Inside a coordinator adapter turn, the AI must not start or run the coordinator recursively; it executes the provided runtime path once, then reports the result.

## Verification
- [x] `bash -n packages/cli/coordinator-project.sh packages/cli/run-role.sh packages/cli/runners-project.sh packages/cli/doctor-project.sh tests/smoke/doctor-blocked-ticket-smoke.sh tests/smoke/worker-smoke.sh bin/autoflow`
- [x] `bash tests/smoke/doctor-blocked-ticket-smoke.sh`
- [x] `bash tests/smoke/worker-smoke.sh`
- [x] `git diff --check` for touched coordinator/doctor/runner/smoke files
- [x] Live `coordinator-1` loop restarted and completed one AI coordinator tick without recursive coordinator processes.

---

# Task Plan: GitHub Competitive Review

## Goal
Assess whether Autoflow is competitive against similar GitHub-hosted AI coding agent and agent-harness projects.

## Scope
- Research current GitHub projects in adjacent categories: coding agents, IDE agents, desktop agent workspaces, PRD/task managers, and GitHub-native agent workflows.
- Compare positioning against Autoflow's repo-local board, worker runner, verification evidence, and desktop operations console.
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
- [x] Local `desktop:check` and `smoke:worker` still pass from the preceding harness diagnosis.

---

# Task Plan: Planner Needs-Info Token Gate

## Goal
Make memo intake autonomous: planner ticks must not turn memo requests into repeated human-question loops, and parked `needs-info` memos must be reprocessable.

## Scope
- Add cheap runtime preflight for planner runs before launching the AI adapter.
- Treat `needs-info` memos as actionable legacy/parked inputs so the planner can promote them instead of looping.
- Remove memo-planner instructions that ask humans for clarification.
- Add smoke coverage proving a previously `needs-info` memo is selected as memo inbox work.
- Prevent already-promoted memos from being selected again, and archive consumed memo files beside the generated PRD when the todo ticket is created.

## Phases
- [x] Confirm root cause from `memo_005`, `start-plan.sh`, runner config, and runner logs.
- [x] Patch planner preflight, memo actionability, and memo archive/duplicate guards.
- [x] Add smoke coverage for actionable `needs-info` memo recovery and generated-PRD archive behavior.
- [x] Verify syntax and focused smoke behavior.

## Decisions
- Autonomous runners should not wait on human clarification inside an AI loop.
- Memo files are directives, not question prompts; Plan AI must infer a concrete implementation scope and ticketize.
- If a memo conflicts with existing policy, the newer memo directive is treated as intentional unless it is unsafe.
- If a planner already generated a PRD from a memo, the runtime must skip that inbox memo on later ticks so it cannot create duplicate PRDs.
