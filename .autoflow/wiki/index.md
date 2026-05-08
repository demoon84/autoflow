# Wiki Index

This wiki is derived from completed Autoflow work, reject learnings, logs, and conversation handoffs.

## Managed Summary

Generated summaries may be written here by `autoflow wiki update`.

## Recent Synthesis
- **[[answers/recent-core-and-ui-refinements-20260508]]** (`wiki/answers/recent-core-and-ui-refinements-20260508.md`): Captured recent refinements including Desktop runner UI (always show model config, remove save-and-restart), runner transition guard (per-runner state tracking), telemetry 5.2T spike root-cause trace, and cross-verification learning record. Logged on 2026-05-08.
- **[[answers/recent-core-refinements-175-189]]** (`wiki/answers/recent-core-refinements-175-189.md`): Captured core refinements spanning `prd_175` through `prd_189`, including Planner realtime wakeup, telemetry usage sanity correction, live-log cleanup, and wiki commit gate. Logged on 2026-05-08.
- **[[answers/prd-168]]** (`wiki/answers/prd-168.md`): Captured `prd_168`, which fixes a Planner check ledger live-lock by ensuring correct exit code propagation.
- **[[answers/prd-154]]** (`wiki/answers/prd-154.md`): Captured `prd_154`, which implements proper handling for large telemetry files.
- **[[answers/prd-063-ticket-064]]** (`wiki/answers/prd-063-ticket-064.md`) : Summary of PRD 063 and ticket 064, describing changes to the desktop dashboard's workflow pin strip for inbox card and PRD card order. Logged on 2026-05-05.
- **[[answers/prd-178-adapter-running-state-heartbeat]]** (`wiki/answers/prd-178-adapter-running-state-heartbeat.md`) : Summary of PRD 178, addressing runner state staleness during long adapter calls by introducing periodic heartbeats and chunk timestamps. Logged on 2026-05-05.
- **[[answers/prd-166-skill-curator-lifecycle-and-auto-extraction]]** (`wiki/answers/prd-166-skill-curator-lifecycle-and-auto-extraction.md`) : Summary of PRD 166, detailing the implementation of skill curator lifecycle management, auto-extraction triggers, and CLI commands. Logged on 2026-05-04.
- **[[answers/recent-core-and-ui-refinements-20260502]]** (`wiki/answers/recent-core-and-ui-refinements-20260502.md`): Captured the recent core and UI refinements spanning `prd_091` through `prd_097`, including Desktop TODO layer layout fixes, Planner orchestrator recovery for max retries, Worker lifecycle isolation (worktree/branch), flex-alignment for UI progress rows, Codex fast reasoning (low), and Planner/Orchestrator role label normalization.
- **[[answers/planner-worker-lifecycle-boundaries-20260502]]** (`wiki/answers/planner-worker-lifecycle-boundaries-20260502.md`): Captured the core architectural boundaries between Planner and Worker roles defined in `prd_092` and `prd_093`, focusing on retry-limit recovery signals and task-level isolation.
- **[[answers/desktop-workflow-board-refinements-20260502]]** (`wiki/answers/desktop-workflow-board-refinements-20260502.md`): Captured the recent workflow-board polish across `prd_082` through `prd_084`, including unified `prd-NNN`/`order-NNN`/`ticket-NNN` display IDs, role labels normalized to `Planner AI`/`Worker AI`/`위키봇`, and the always-visible kanban column baseline.
- **[[answers/desktop-xs-density-and-workflow-pin-width-20260502]]** (`wiki/answers/desktop-xs-density-and-workflow-pin-width-20260502.md`): Captured the recent Desktop density/layout pass that keeps general Button/Input controls on an `xs` rhythm and preserves a 3-column core workflow pin strip (ORDER, PRD, TODO) around the 1040px minimum desktop width.
- **[[answers/dirty-root-finalization-blockers-20260502]]** (`wiki/answers/dirty-root-finalization-blockers-20260502.md`): Captured the shared finalization blocker across `reject_071` and `reject_074`: when accepted state already lives inside a broad dirty Desktop rewrite with out-of-scope typing/preload dependencies, replay must restart from a clean current-HEAD baseline instead of force-finishing the old ticket.
- **[[answers/ticket-overlap-no-op-summary]]** (`wiki/answers/ticket-overlap-no-op-summary.md`): Summary of learning regarding ticket overlap and no-op worktrees.
- **[[answers/merge-blocked-already-applied-patch-summary]]** (`wiki/answers/merge-blocked-already-applied-patch-summary.md`): Summary of learning regarding merge blocked by an already-applied patch.
- **[[answers/prd-120-rejection-learning]]** (`wiki/answers/prd-120-rejection-learning.md`): Summary of learning regarding persistent rejection of prd_120 due to dirty project root and missing GUI environment.
- **[[answers/ticket-detail-layer-meta-layout-20260501]]** (`wiki/answers/ticket-detail-layer-meta-layout-20260501.md`): Captured `prd_077`, which keeps `TicketDetailLayer` metadata on a one-line-first flex-wrap layout instead of a fixed 3-column grid while preserving the existing narrow-screen fallback.
- **[[answers/desktop-renderer-dirty-root-finalization-blocker-20260501]]** (`wiki/answers/desktop-renderer-dirty-root-finalization-blocker-20260501.md`): Captured `reject_071` as a replay blocker: when visible criteria are already embedded in a broad dirty `renderer` rewrite, finalization must wait for either that rewrite to land or a fresh isolated current-HEAD diff.
- **[[answers/open-layer-flicker-finalization-blocker-20260501]]** (`wiki/answers/open-layer-flicker-finalization-blocker-20260501.md`): Captured the layer-flicker reject path that requires stable ticket-detail/workflow-pin layer identity during board snapshot refresh without widening scope beyond the affected layer flows.
- **[[answers/done-when-checklist-state]]** (`wiki/answers/done-when-checklist-state.md`): Captured `prd_088`, which makes completed `## Done When` items persist as checked `[x]` state in the ticket document instead of staying as a static acceptance list.
- **[[answers/order-inbox-memo-delete]]** (`wiki/answers/order-inbox-memo-delete.md`): Captured `prd_089`, the Order-tab workflow that limits deletion to pending `tickets/inbox/memo_*.md` cards with confirmation and defensive IPC path checks.
- **[[answers/desktop-sidebar-korean-labels]]** (`wiki/answers/desktop-sidebar-korean-labels.md`): Captured `prd_090`, which keeps the existing sidebar order and route keys while renaming labels to `AI 대쉬보드`, `티켓`, and `LLM 위키`.
- **[[answers/desktop-full-page-loading-overlay-20260430]]** (`wiki/answers/desktop-full-page-loading-overlay-20260430.md`): Summarized `prd_065` as the desktop-wide loading overlay restoration that should reuse existing loading flags and restore a full-page loading overlay flow consistent with the current `shadcn` standard.
- **[[answers/finish-ticket-owner-cleanup-status-regression-20260430]]** (`wiki/answers/finish-ticket-owner-cleanup-status-regression-20260430.md`): Captured the current `finish-ticket-owner` output contract around `cleanup_status=ok` and linked the related reject history from `verify_003` and `prd_049`.
- **[[answers/desktop-navigation-refinements-20260430]]** (`wiki/answers/desktop-navigation-refinements-20260430.md`): Summarized the Desktop navigation refinements that put the inbox pin before PRD in the workflow strip and moved the Logs sidebar item after 통계.
- **[[answers/recent-desktop-ui-refinements-20260429]]** (`wiki/answers/recent-desktop-ui-refinements-20260429.md`): Captured the 2026-04-29 Desktop UI snapshot that renamed user-facing memo labels to order and confirmed the placement of the Logs sidebar item at the end of the navigation list.
- **[[answers/desktop-sidebar-navigation-order]]** (`wiki/answers/desktop-sidebar-navigation-order.md`): Captured `tickets_065` under `prd_064`, the sidebar-order-only change that moves `로그` after `통계` while leaving the `settingsNavigation` keys, icons, and page render blocks untouched.
- **[[answers/wiki-preview-top-alignment]]** (`wiki/answers/wiki-preview-top-alignment.md`): Captured the `tickets_059` adjustment that keeps the Wiki query right preview aligned to the top while preserving the existing split-pane preview flow.
- **[[answers/finish-ticket-owner-cleanup-status-contract]]** (`wiki/answers/finish-ticket-owner-cleanup-status-contract.md`): Summarized the `verify_003` / `reject_003` failure caused by the missing `cleanup_status=ok` line in the `finish-ticket-owner` pass-output contract.
- **[[answers/korean-board-writing-policy]]** (`wiki/answers/korean-board-writing-policy.md`): Captured the board-writing policy that user-facing PRD, ticket, and memo prose defaults to Korean while parser-sensitive fields keep their original format.
- **[[answers/wiki-query-filter-group]]** (`wiki/answers/wiki-query-filter-group.md`): Captured the `tickets_058` change that groups the two wiki query include options into one MUI-backed filter list.
- **[[answers/desktop-runner-terminal-streaming]]** (`wiki/answers/desktop-runner-terminal-streaming.md`): Captured the `prd_053` fix that restores multi-line typed terminal streaming in Desktop runner cards instead of path-only/runtime-envelope fallbacks.
- [[answers/wiki-maintenance-pipeline]] (`wiki/answers/wiki-maintenance-pipeline.md`): Summarized the current wiki maintenance flow spanning semantic lint tightening, deterministic frontmatter retrofit, and reusable synth-save patterns.
- [[answers/worker-state-last-result-self-reset]] (`wiki/answers/worker-state-last-result-self-reset.md`): Fixes a stale `worker.state.last_result` issue by implementing a self-reset at the start of worker ticks and an explicit reset after planner cleanup.

## Pages

- [[project-overview]]
- [[log]]
- `features/`
  - [[features/llm-wiki-features]] (`wiki/features/llm-wiki-features.md`)
  - [[features/ai-workflow-board]] (`wiki/features/ai-workflow-board.md`)
  - [[features/reject-auto-replan]] (`wiki/features/reject-auto-replan.md`)
  - [[features/worker-lifecycle-isolation]] (`wiki/features/worker-lifecycle-isolation.md`)
  - [[features/self-improvement-trial]] (`wiki/features/self-improvement-trial.md`)
  - [[features/ticket-workspace-tabs]] (`wiki/features/ticket-workspace-tabs.md`)
  - [[features/wiki-preview-flow]] (`wiki/features/wiki-preview-flow.md`)
  - [[features/auto-resume-recovery]] (`wiki/features/auto-resume-recovery.md`)
  - [[features/workflow-stat-strip]] (`wiki/features/workflow-stat-strip.md`)
  - [[features/desktop-gemini-icon]] (`wiki/features/desktop-gemini-icon.md`)
  - [[features/in-app-help]] (`wiki/features/in-app-help.md`)
  - [[features/desktop-runner-controls]] (`wiki/features/desktop-runner-controls.md`)
  - [[features/finish-pass-inline-merge-summary]] (`wiki/features/finish-pass-inline-merge-summary.md`)
  - [[features/desktop-statistics-page]] (`wiki/features/desktop-statistics-page.md`)
  - [[features/desktop-layer-width]] (`wiki/features/desktop-layer-width.md`)
  - [[features/desktop-runner-model-options]] (`wiki/features/desktop-runner-model-options.md`)
  - [[features/planner-next-action-cues]] (`wiki/features/planner-next-action-cues.md`)
  - [[features/run-role-prompt-dispatch]] (`wiki/features/run-role-prompt-dispatch.md`)
  - [[features/ticket-owner-verification-output-caps]] (`wiki/features/ticket-owner-verification-output-caps.md`)
  - [[features/wiki-bot-codex-adapter]] (`wiki/features/wiki-bot-codex-adapter.md`)
- `decisions/`
  - [[decisions/design-kit-mui-migration]] (`wiki/decisions/design-kit-mui-migration.md`)
  - [[decisions/prd_172_commit_mitigation]] (`wiki/decisions/prd_172_commit_mitigation.md`)
  - [[decisions/manual-resolution-policy]] (`wiki/decisions/manual-resolution-policy.md`)
  - [[decisions/handoff-as-raw-source]] (`wiki/decisions/handoff-as-raw-source.md`)
  - [[decisions/prd-terminology-rename]] (`wiki/decisions/prd-terminology-rename.md`)
  - [[decisions/worker-display-policy]] (`wiki/decisions/worker-display-policy.md`)
- `architecture/`
  - [[architecture/runner-role-slugs]] (`wiki/architecture/runner-role-slugs.md`) - current retained runner-id scheme (`planner-1`, `owner-1`, `wiki-1`); slug rename proposal was superseded.
  - [[architecture/runner-id-roles]] (`wiki/architecture/runner-id-roles.md`)
- `learnings/`
  - [[learnings/merge-blocked-already-applied-patch]] (`wiki/learnings/merge-blocked-already-applied-patch.md`)
  - [[learnings/ticket-overlap-no-op]] (`wiki/learnings/ticket-overlap-no-op.md`)
  - [[learnings/manual-merge-recovery-20260427]] (`wiki/learnings/manual-merge-recovery-20260427.md`)
  - [[learnings/runtime-log-scope-vs-finish-contract-20260429]] (`wiki/learnings/runtime-log-scope-vs-finish-contract-20260429.md`)
  - [[learnings/retrofit-frontmatter-scope-limitation]] (`wiki/learnings/retrofit-frontmatter-scope-limitation.md`)
  - [[learnings/cross-verification-root-cause-tracking-20260504]] (`wiki/learnings/cross-verification-root-cause-tracking-20260504.md`)
- `operations/`
  - [[Operations Wiki Index]] (`wiki/operations/index.md`)
  - [[operations/runner-health]]
  - [[operations/runner-timing]]
  - [[operations/wiki-panel-layout]] (`wiki/operations/wiki-panel-layout.md`)
- `agents/`
  - [[Agents Wiki Index]] (`wiki/agents/index.md`)
  - [[agents/prompt-evolution]]

- `skills/`
  - [[skills/local-index]] (Agent-extracted skills catalog)
  - [[skills-local/nudge/adapter-running-state-heartbeat-2]] (`wiki/skills-local/nudge/adapter-running-state-heartbeat-2/SKILL.md`)
  - [[skills-local/nudge/adapter-running-state-heartbeat-3]] (`wiki/skills-local/nudge/adapter-running-state-heartbeat-3/SKILL.md`)
  - [[skills-local/nudge/adapter-running-state-heartbeat-4]] (`wiki/skills-local/nudge/adapter-running-state-heartbeat-4/SKILL.md`)
  - [[skills-local/nudge/adapter-running-state-heartbeat-5]] (`wiki/skills-local/nudge/adapter-running-state-heartbeat-5/SKILL.md`)

  - `answers/` — `autoflow wiki query --synth --save-as <slug>` 로 저장된 합성 답변 카탈로그. 위 `Recent Synthesis`는 최신 하이라이트이고, 아래 목록은 자주 다시 찾는 answer 페이지를 빠르게 탐색하기 위한 인덱스다. 자세한 규약은 [[answers/README]] 참고.
  - [[answers/README]] (`wiki/answers/README.md`)
  - [[answers/common-verification-failure-patterns]] (`wiki/answers/common-verification-failure-patterns.md`)
  - [[answers/recent-core-and-ui-refinements-20260508]] (`wiki/answers/recent-core-and-ui-refinements-20260508.md`)
  - [[answers/prd-178-adapter-running-state-heartbeat]] (`wiki/answers/prd-178-adapter-running-state-heartbeat.md`)
  - [[answers/prd-166-skill-curator-lifecycle-and-auto-extraction]] (`wiki/answers/prd-166-skill-curator-lifecycle-and-auto-extraction.md`)
  - [[answers/prd-098-memo-to-order-refactor]] (`wiki/answers/prd-098-memo-to-order-refactor.md`)
  - [[answers/recent-core-and-ui-refinements-20260502]] (`wiki/answers/recent-core-and-ui-refinements-20260502.md`)
  - [[answers/planner-worker-lifecycle-boundaries-20260502]] (`wiki/answers/planner-worker-lifecycle-boundaries-20260502.md`)
  - [[answers/desktop-workflow-board-refinements-20260502]] (`wiki/answers/desktop-workflow-board-refinements-20260502.md`)
  - [[answers/desktop-xs-density-and-workflow-pin-width-20260502]] (`wiki/answers/desktop-xs-density-and-workflow-pin-width-20260502.md`)
  - [[answers/dirty-root-finalization-blockers-20260502]] (`wiki/answers/dirty-root-finalization-blockers-20260502.md`)
  - [[answers/ticket-detail-layer-meta-layout-20260501]] (`wiki/answers/ticket-detail-layer-meta-layout-20260501.md`)
  - [[answers/desktop-renderer-dirty-root-finalization-blocker-20260501]] (`wiki/answers/desktop-renderer-dirty-root-finalization-blocker-20260501.md`)
  - [[answers/open-layer-flicker-finalization-blocker-20260501]] (`wiki/answers/open-layer-flicker-finalization-blocker-20260501.md`)
  - [[answers/done-when-checklist-state]] (`wiki/answers/done-when-checklist-state.md`)
  - [[answers/order-inbox-memo-delete]] (`wiki/answers/order-inbox-memo-delete.md`)
  - [[answers/desktop-sidebar-korean-labels]] (`wiki/answers/desktop-sidebar-korean-labels.md`)
  - [[answers/desktop-full-page-loading-overlay-20260430]] (`wiki/answers/desktop-full-page-loading-overlay-20260430.md`)
  - [[answers/finish-ticket-owner-cleanup-status-regression-20260430]] (`wiki/answers/finish-ticket-owner-cleanup-status-regression-20260430.md`)
  - [[answers/desktop-navigation-refinements-20260430]] (`wiki/answers/desktop-navigation-refinements-20260430.md`)
  - [[answers/recent-desktop-ui-refinements-20260429]] (`wiki/answers/recent-desktop-ui-refinements-20260429.md`)
  - [[answers/desktop-sidebar-navigation-order]] (`wiki/answers/desktop-sidebar-navigation-order.md`)
  - [[answers/wiki-preview-top-alignment]] (`wiki/answers/wiki-preview-top-alignment.md`)
  - [[answers/finish-ticket-owner-cleanup-status-contract]] (`wiki/answers/finish-ticket-owner-cleanup-status-contract.md`)
  - [[answers/korean-board-writing-policy]] (`wiki/answers/korean-board-writing-policy.md`)
  - [[answers/obsidian-free-board-outputs]] (`wiki/answers/obsidian-free-board-outputs.md`)
  - [[answers/prompt-evolution]] (`wiki/answers/prompt-evolution.md`)
  - [[answers/runner-health]] (`wiki/answers/runner-health.md`)
  - [[answers/runner-timing]] (`wiki/answers/runner-timing.md`)
  - [[answers/telemetry-data-handling]] (`wiki/answers/telemetry-data-handling.md`)
  - [[answers/autoflow-wiki-telemetry-overview]] (`wiki/answers/autoflow-wiki-telemetry-overview.md`)
  - [[answers/singleton-runner-display-labels]] (`wiki/answers/singleton-runner-display-labels.md`)
  - [[answers/wiki-query-filter-group]] (`wiki/answers/wiki-query-filter-group.md`)
  - [[answers/desktop-runner-terminal-streaming]] (`wiki/answers/desktop-runner-terminal-streaming.md`)
  - [[answers/wiki-ingest-workflow]] (`wiki/answers/wiki-ingest-workflow.md`)
  - [[answers/wiki-maintenance-pipeline]] (`wiki/answers/wiki-maintenance-pipeline.md`)

## Archive
- [[features/desktop-tickets-kanban]] (`wiki/features/desktop-tickets-kanban.md`) (Legacy)

<!-- AUTOFLOW:BEGIN feature-links -->
## Added Feature Pages

- [[features/finish-pass-inline-merge-summary]] (`wiki/features/finish-pass-inline-merge-summary.md`)
- [[features/planner-next-action-cues]] (`wiki/features/planner-next-action-cues.md`)
- [[features/run-role-prompt-dispatch]] (`wiki/features/run-role-prompt-dispatch.md`)
- [[features/desktop-runner-model-options]] (`wiki/features/desktop-runner-model-options.md`)
- [[features/desktop-layer-width]] (`wiki/features/desktop-layer-width.md`)
- [[features/ticket-owner-verification-output-caps]] (`wiki/features/ticket-owner-verification-output-caps.md`)
<!-- AUTOFLOW:END feature-links -->

## Source Of Truth

Tickets, verification records, and logs remain authoritative.

<!-- AUTOFLOW:BEGIN work-map -->
## Autoflow Work Map

- Done tickets: 176
- Reject records: 0
- Verifier logs: 1
- Conversation handoffs: 8
- Last updated: 2026-05-08T05:29:06Z

## Completed Tickets

- `tickets_002` - AI work for prd_002. test Source: `tickets/done/prd_002/tickets_002.md`.
- `tickets_006` - AI work for prd_006. allow unrelated dirty root paths while preserving Allowed Paths conflict checks Source: `tickets/done/prd_006/tickets_006.md`.
- `tickets_007` - AI work for prd_007. Update AI workflow card meta to 3-line agent/id/progress display Source: `tickets/done/prd_007/tickets_007.md`.
- `tickets_008` - AI work for prd_008. Add bounded reject auto-replan flow for ticket-owner runtime Source: `tickets/done/prd_008/tickets_008.md`.
- `tickets_009` - AI work for prd_009. All PRD-009 features (display_worker_id, board script AI-N normalization, markdown-viewer transform, AGENTS.md/CLAUDE.md rule 16) verified present on base commit. Fixed pre-existing git_root unbound variable bug in merge-ready-ticket.sh to unblock smoke test. All Done When criteria pass: tsc clean, syntax clean, smoke passes, mirror diffs clean. Source: `tickets/done/prd_009/tickets_009.md`.
- `tickets_010` - AI work for prd_010. Add desktop tickets kanban view with dialog preview and board counts Source: `tickets/done/prd_010/tickets_010.md`.
- `tickets_011` - AI work for prd_011. Replace ticket board with tabbed PRD/ticket workspace Source: `tickets/done/prd_011/tickets_011.md`.
- `tickets_012` - Rename runner ids to role-aligned slugs (planner / worker / wiki-maintainer). Stale runner-id rename was not applied; current runner topology remains consistent with AGENTS and active config. Source: `tickets/done/prd_012/tickets_012.md`.
- `tickets_013` - Hoist code-volume + token-usage stat strip above TicketBoard on 작업 흐름 page. Workflow stat strip reuses ReportingDashboard metric counts above the workflow board; tsc and desktop check pass. Source: `tickets/done/prd_013/tickets_013.md`.
- `tickets_014` - Fix planner stage indicator showing "계획" while runtime is idle. Fix planner stage mapping so idle running loops show 대기 and todo creation shows 완료 Source: `tickets/done/prd_014/tickets_014.md`.
- `tickets_015` - Show pending PRD count alongside total in workflow pin label. PRD workflow pin label now shows nonzero pending backlog count and reuses the label for the layer heading. Source: `tickets/done/prd_015/tickets_015.md`.
- `tickets_016` - Pin AI progress board to a 2-left / 1-right tall layout when three runners are present. 3-runner workflow board layout merged into `main` with current AI progress card behavior preserved. Source: `tickets/done/prd_016/tickets_016.md`.
- `tickets_017` - Restrict Claude reasoning dropdown to medium/high only. Restrict Claude reasoning choices to medium/high and normalize invalid saved Claude values to high Source: `tickets/done/prd_017/tickets_017.md`.
- `tickets_018` - Align workflow stat strip edges with PRD pin bar + show raw token count. Align workflow stat strip edges with PRD pin strip and show raw token counts Source: `tickets/done/prd_018/tickets_018.md`.
- `tickets_019` - Reduce ticket workspace tabs to PRD + 발급 티켓 only. Reduced ticket workspace to PRD and issued-ticket tabs with issued as default and all ticket stages listed. Source: `tickets/done/prd_019/tickets_019.md`.
- `tickets_020` - Auto-resume finish-pass when an inprogress ticket has Result: passed but no commit / merge. auto-resume finish-pass recovery implemented Source: `tickets/done/prd_020/tickets_020.md`.
- `tickets_021` - Workflow page UI overhaul — sidebar label, card header simplification, progress wrap, inline controls. Workflow page AI cards now use role-only labels, inline runner controls, synced model/reasoning controls, and wrapping progress dots. Source: `tickets/done/prd_021/tickets_021.md`.
- `tickets_022` - Log-driven self-improvement trial runner — analyze logs, detect repeated issues, emit safe improvement candidates. self-improvement trial runner implemented and verified Source: `tickets/done/prd_022/tickets_022.md`.
- `tickets_023` - Remove left-border color accents from AI progress cards and all workflow pin bars. auto-resumed by recovery path Source: `tickets/done/prd_023/tickets_023.md`.
- `tickets_024` - Convert ticket workspace right preview into a click-to-open detail layer. auto-resumed by recovery path Source: `tickets/done/prd_024/tickets_024.md`.
<!-- AUTOFLOW:END work-map -->

## sources/

- [[sources/prd-022-handoff]] (로그 기반 자기 개선 시험용 러너)

- [[sources/prd-038-handoff]] (Wiki Bot Codex 지원)

- [[sources/prd-091-handoff]] (반려 최대 재시도 Planner 처리 PRD)

- [[sources/prd-093-handoff]] (Worker 작업 생명주기 격리 (PRD-093))
urces/prd-093-handoff]] (Worker 작업 생명주기 격리 (PRD-093))

- [[sources/agent-definitions]] (Autoflow 에이전트 정의)

- [[sources/prd_169]] (worker.state.last_result 잔류 자가 리셋)

- [[sources/prd-022-spec-handoff]] (로그 기반 자체 개선 시험 러너 PRD 핸드오프)

- [[sources/prd-120-spec-handoff]] (PRD Handoff: runner 로그 retention 정책 및 정리)

- [[sources/prd-123-spec-handoff]] (metrics-project.sh 및 _stdout.log 처리 개선)

- [[sources/prd-091-spec-handoff]] (반려 최대 재시도 Planner 처리)

- [[sources/prd-121-spec-handoff]] (텔레메트리 레이어 도입 - 틱별 구조화 이벤트 jsonl 추출)

- [[sources/prd-093-spec-handoff]] (PRD Handoff)

- [[sources/prd-038-spec-handoff]] (PRD Handoff)

- [[sources/prd-122-spec-handoff]] (Wiki AI 합성 입력으로 telemetry jsonl 사용)

- [[sources/prd-003]] (Wiki 패널 - 좌우 분할 + 접이식 미리보기)

- [[sources/prd_172]] (플래너 커밋 폭증 완화)

- [[sources/prd_189]] (Codex stdout WARN 노이즈 필터링 (prd_189))

- [[sources/prd_175]] (Planner 실시간 wakeup trigger)

- [[sources/prd_176]] (Autoflow 자율회복 로드맵 통합 패스 (prd_176))

- [[sources/prd_177]] (token telemetry regression recovery)

- [[sources/prd_178]] (Runner 어댑터 Heartbeat 상태 관리)

- [[sources/prd_179]] (token budget stale-data guard (PRD-179))

- [[sources/prd_180]] (반복 preflight 실패 회복 회로 (prd_180))

- [[sources/prd_181]] (telemetry token usage sanity correction)

- [[sources/prd_182]] (runner live log finalize cleanup)

- [[sources/prd_183]] (wiki 의미 있는 커밋 게이트 (prd_183))

- [[sources/prd_184]] (데스크톱 Detached Runner 재연결 및 종료 정책 (prd_184))

- [[sources/prd_185]] (Self-monitoring agent 도입과 monitor runner 표준화 (prd_185))

- [[sources/prd_186]] (prd_186: 티켓 워크트리 삭제 시 고아 러너 루프 방지)

- [[sources/prd_187]] (Planner Secret Dependency Preflight (prd_187))

- [[sources/prd_188]] (데스크톱 응답 지연 심각도 라벨 (prd_188))

- [[sources/prd_190]] (prd_190: 교차 검증 근본 원인 분석 학습 기록)

- [[sources/prd_191]] (telemetry 5.2T spike root-cause trace)

- [[sources/prd_192]] (데스크톱 Runner 상태 전환 액션 가드 (prd_192))

- [[sources/prd_193]] (데스크톱 러너 설정의 저장 후 재시작 버튼 제거)

- [[sources/prd_194]] (데스크톱 러너 모델 설정 상시 표시 (prd_194))

- [[sources/prd_174]] (Runner 설정 저장 적용 피드백 개선 (PRD-174))

- [[sources/prd_170]] (inprogress 복구 파킹 및 repairing 타임아웃 처리)

- [[sources/prd_171]] (worker self-refresh dirty deadlock 차단)

- [[sources/prd_173]] (데스크톱 readBoard 내부 호출 타임아웃 격리)
