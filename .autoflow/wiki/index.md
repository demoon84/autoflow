# Wiki Index

This wiki is derived from completed Autoflow work, reject learnings, logs, and conversation handoffs.

## Managed Summary

Generated summaries may be written here by `autoflow wiki update`.

## Recent Synthesis
- **[[answers/prd_222_summary]]** (`wiki/answers/prd_222_summary.md`): 데스크톱 ticket dialog 에서 더 이상 사용하지 않는 `reject/` 경로 및 레거시 네이밍(`spec`, `memo` 등)을 PRD/Order 명칭에 맞게 보정하였습니다(prd_222). 요약일: 2026-05-09.
- **[[answers/prd_221_summary]]** (`wiki/answers/prd_221_summary.md`): AiConversationPanel 라이브 어댑터 스트림에 글자 단위 타이핑 애니메이션을 추가하였습니다(prd_221). 과부하 시 catch-up flush 로직과 ANSI 색상 무결성 보존, reduced-motion fallback이 포함되었습니다. 요약일: 2026-05-09.
- **[[sources/prd_219]]** (`wiki/sources/prd_219.md`): AI 스킬 탭 로딩 성능 최적화 및 조회수 증가 제어 옵션 도입(prd_219). (참고: prd_212에서 SKILL 시스템이 제거됨에 따라 이 작업은 안전한 종료 및 잔재 정리 목적으로 수행되었습니다). 요약일: 2026-05-09.
- **[[answers/prd_220_summary]]** (`wiki/answers/prd_220_summary.md`): 통계 처리 시간 카드 라벨 명확화 작업(prd_220) 요약. '처리 시간'을 '평균 처리 시간'으로 변경하고 sub 텍스트를 한국어 풀어쓴 표현으로 교체하였습니다. 요약일: 2026-05-09.
- **[[answers/recent-core-and-ui-refinements-20260509-v4]]** (`wiki/answers/recent-core-and-ui-refinements-20260509-v4.md`): 최근 완료된 핵심 및 UI 개선 사항 요약(v4). SKILL 시스템 전면 제거(prd_212~217)에 따른 후속 정리 및 AI 스킬 탭의 안전한 로딩/조회수 분리 재시도([[sources/prd_219]])를 포함합니다. 요약일: 2026-05-09.
- **[[answers/skill-system-removal]]** (`wiki/answers/skill-system-removal.md`): SKILL 시스템 전면 제거 (Phase 1~6). 파이프라인, CLI, UI, RAG 주입 등 모든 SKILL 인프라가 제거되고 `wiki/learnings` 및 `AGENTS.md` 규칙으로 대체되었습니다 (prd_212 ~ prd_217). 요약일: 2026-05-09.
- **[[sources/prd_218]]** (`wiki/sources/prd_218.md`): 통계 탭에 처리 시간 카드 추가 (prd_218). metrics 집계 방식을 보정하고 strip 영역에 3번째 카드를 배치하여 러너 성능 가시성을 높였습니다. 요약일: 2026-05-09.
- **[[decisions/planner-prioritization]]** (`wiki/decisions/planner-prioritization.md`): Planner 가 작업을 처리할 때의 우선순위 정책 (prd_211). 같은 Priority 내에서 Backlog PRD 가 Inbox Order 보다 우선 처리되도록 설정되었습니다. 요약일: 2026-05-09.
- **[[answers/recent-refinements-20260509-v3]]** (`wiki/answers/recent-refinements-20260509-v3.md`): 최근 완료된 핵심 및 UI 개선 사항 요약(v3). 러너 카드 1줄 레이아웃 고정(prd_209), Worker/LLM Wiki 라벨 영어화(prd_210)를 포함합니다. (주의: prd_208의 스킬 탭 최적화는 이후 prd_212에서 SKILL 시스템이 제거됨에 따라 더 이상 유효하지 않습니다). 요약일: 2026-05-09.
- **[[answers/prd_209_summary]]** (`wiki/answers/prd_209_summary.md`): 러너 카드 내부 설정 행(agent, model, reasoning, 저장 버튼)을 viewport 폭과 관계없이 항상 1줄로 유지하도록 스타일 시트를 보정하였습니다 (prd_209). 요약일: 2026-05-09.
- **[[answers/recent-core-and-ui-refinements-20260509-v2]]** (`wiki/answers/recent-core-and-ui-refinements-20260509-v2.md`): Recent refinements including Desktop UI grid fixation (1x3), terminal status indicators, "AI AutoFlow" menu rename, and runtime finalizer cleanup routing stability (prd_200 - prd_207). Logged on 2026-05-09.
- **[[decisions/telemetry-stability]]** (`wiki/decisions/telemetry-stability.md`): Telemetry 5.2T guard implementation and post-merge cleanup stability fixes (prd_195, prd_197). Logged on 2026-05-08.
- **[[features/desktop-ui-updates-2026-05]]** (`wiki/features/desktop-ui-updates-2026-05.md`): Desktop UI refinements including runner config visibility, full-width layout, help text removal, and retry order visibility (prd_194, prd_196, prd_198, prd_199). Logged on 2026-05-08.
- **[[answers/recent-core-and-ui-refinements-20260508-v2]]** (`wiki/answers/recent-core-and-ui-refinements-20260508-v2.md`): Recent refinements spanning `prd_195` through `prd_197`, including telemetry 5.2T retry with dirty-root cleanup, desktop runner config layout full-width alignment, and post-merge cleanup retry recovery. Logged on 2026-05-08.
- **[[answers/recent-core-and-ui-refinements-20260508]]** (`wiki/answers/recent-core-and-ui-refinements-20260508.md`): Captured recent refinements including Desktop runner UI (always show model config, remove save-and-restart), runner transition guard (per-runner state tracking), telemetry 5.2T spike root-cause trace, and cross-verification learning record. Logged on 2026-05-08.
- **[[answers/recent-core-refinements-175-189]]** (`wiki/answers/recent-core-refinements-175-189.md`): Captured core refinements spanning `prd_175` through `prd_189`, including Planner realtime wakeup, telemetry usage sanity correction, live-log cleanup, and wiki commit gate. Logged on 2026-05-08.
- **[[answers/prd-168]]** (`wiki/answers/prd-168.md`): Captured `prd_168`, which fixes a Planner check ledger live-lock by ensuring correct exit code propagation.
- **[[answers/prd-154]]** (`wiki/answers/prd-154.md`): Captured `prd_154`, which implements proper handling for large telemetry files.
- **[[answers/prd-063-ticket-064]]** (`wiki/answers/prd-063-ticket-064.md`) : Summary of PRD 063 and ticket 064, describing changes to the desktop dashboard's workflow pin strip for inbox card and PRD card order. Logged on 2026-05-05.
- **[[answers/prd-178-adapter-running-state-heartbeat]]** (`wiki/answers/prd-178-adapter-running-state-heartbeat.md`) : Summary of PRD 178, addressing runner state staleness during long adapter calls by introducing periodic heartbeats and chunk timestamps. Logged on 2026-05-05.
- **[[answers/recent-core-and-ui-refinements-20260502]]** (`wiki/answers/recent-core-and-ui-refinements-20260502.md`): Captured the recent core and UI refinements spanning `prd_091` through `prd_097`, including Desktop TODO layer layout fixes, Planner orchestrator recovery for max retries, Worker lifecycle isolation (worktree/branch), flex-alignment for UI progress rows, Codex fast reasoning (low), and Planner/Orchestrator role label normalization.
- **[[answers/planner-worker-lifecycle-boundaries-20260502]]** (`wiki/answers/planner-worker-lifecycle-boundaries-20260502.md`): Captured the core architectural boundaries between Planner and Worker roles defined in `prd_092` and `prd_093`, focusing on retry-limit recovery signals and task-level isolation.
- **[[answers/desktop-workflow-board-refinements-20260502]]** (`wiki/answers/desktop-workflow-board-refinements-20260502.md`): Captured the recent workflow-board polish across `prd_082` through `prd_084`, including unified `prd-NNN`/`order-NNN`/`ticket-NNN` display IDs, role labels normalized to `Planner AI`/`Worker AI`/`LLM Wiki` (formerly 위키봇), and the always-visible kanban column baseline.
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
- **[[answers/desktop-sidebar-korean-labels]]** (`wiki/answers/desktop-sidebar-korean-labels.md`): Captured `prd_090`, which keeps the existing sidebar order and route keys while renaming labels to `AI 대쉬보드`, `티켓`, and `LLM Wiki` (formerly 위키봇).
- **[[answers/desktop-full-page-loading-overlay-20260430]]** (`wiki/answers/desktop-full-page-loading-overlay-20260430.md`): Summarized `prd_065` as the desktop-wide loading overlay restoration that should reuse existing loading flags and restore a full-page loading overlay flow consistent with the current `shadcn` standard.
- **[[answers/finish-ticket-owner-cleanup-status-regression-20260430]]** (`wiki/answers/finish-ticket-owner-cleanup-status-regression-20260430.md`): Captured the current `finish-ticket-owner` output contract around `cleanup_status=ok` and linked the related reject history from `verify_003` and `prd_049`.
- **[[answers/desktop-navigation-refinements-20260430]]** (`wiki/answers/desktop-navigation-refinements-20260430.md`): Summarized the Desktop navigation refinements that put the inbox pin before PRD in the workflow strip and moved the Logs sidebar item after 통계.
- **[[answers/recent-desktop-ui-refinements-20260429]]** (`wiki/answers/recent-desktop-ui-refinements-20260429.md`): Captured the 2026-04-29 Desktop UI snapshot that renamed user-facing memo labels to order and confirmed the placement of the Logs sidebar item at the end of the navigation list.
- **[[answers/desktop-sidebar-navigation-order]]** (`wiki/answers/desktop-sidebar-navigation-order.md`): Captured `tickets_065` under `prd_064`, the sidebar-order-only change that moves `로그` after `통계` while leaving the `settingsNavigation` keys, icons, and page render blocks untouched.
- **[[answers/wiki-preview-top-alignment]]** (`wiki/answers/wiki-preview-top-alignment.md`): Captured the `tickets_059` adjustment that keeps the Wiki query right preview aligned to the top while preserving the existing split-pane preview flow.
- **[[answers/finish-ticket-owner-cleanup-status-contract]]** (`wiki/answers/finish-ticket-owner-cleanup-status-contract.md`): Summarized the `verify_003` / `reject_003` failure caused by the missing `cleanup_status=ok` line in the `finish-ticket-owner` pass-output contract.
- **[[answers/korean-board-writing-policy]]** (`wiki/answers/korean-board-writing-policy.md`): Captured the board-writing policy that user-facing PRD, ticket, and memo prose defaults to Korean while parser-sensitive fields keep their original format.
- **[[answers/obsidian-free-board-outputs]]** (`wiki/answers/obsidian-free-board-outputs.md`): Captured the transition to Obsidian-free board outputs, ensuring all board files use standard Markdown.
- **[[answers/prompt-evolution]]** (`wiki/answers/prompt-evolution.md`): Tracking of agent prompt evolution.
- **[[answers/runner-health]]** (`wiki/answers/runner-health.md`): Overview of runner health metrics.
- **[[answers/runner-timing]]** (`wiki/answers/runner-timing.md`): Overview of runner timing metrics.
- **[[answers/telemetry-data-handling]]** (`wiki/answers/telemetry-data-handling.md`): Guidelines for handling telemetry data.
- **[[answers/autoflow-wiki-telemetry-overview]]** (`wiki/answers/autoflow-wiki-telemetry-overview.md`): Overview of how wiki uses telemetry.
- **[[answers/singleton-runner-display-labels]]** (`wiki/answers/singleton-runner-display-labels.md`): Policy for runner display labels.
- **[[answers/wiki-query-filter-group]]** (`wiki/answers/wiki-query-filter-group.md`): Grouping of wiki query filters.
- **[[answers/desktop-runner-terminal-streaming]]** (`wiki/answers/desktop-runner-terminal-streaming.md`): Implementation of terminal streaming in the desktop app.
- **[[answers/wiki-ingest-workflow]]** (`wiki/answers/wiki-ingest-workflow.md`): Documentation of the wiki ingest workflow.
- **[[answers/wiki-maintenance-pipeline]]** (`wiki/answers/wiki-maintenance-pipeline.md`): Overview of the wiki maintenance pipeline.

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
  - [[features/desktop-ui-updates-2026-05]] (`wiki/features/desktop-ui-updates-2026-05.md`)
- `decisions/`
  - [[decisions/design-kit-mui-migration]] (`wiki/decisions/design-kit-mui-migration.md`)
  - [[decisions/prd_172_commit_mitigation]] (`wiki/decisions/prd_172_commit_mitigation.md`)
  - [[decisions/manual-resolution-policy]] (`wiki/decisions/manual-resolution-policy.md`)
  - [[decisions/handoff-as-raw-source]] (`wiki/decisions/handoff-as-raw-source.md`)
  - [[decisions/prd-terminology-rename]] (`wiki/decisions/prd-terminology-rename.md`)
  - [[decisions/worker-display-policy]] (`wiki/decisions/worker-display-policy.md`)
  - [[decisions/telemetry-stability]] (`wiki/decisions/telemetry-stability.md`)
  - [[decisions/planner-prioritization]] (`wiki/decisions/planner-prioritization.md`)
- `architecture/`
  - [[architecture/runner-role-slugs]] (`wiki/architecture/runner-role-slugs.md`) - current retained runner-id scheme (`planner`, `worker`, `wiki`); slug rename proposal was superseded.
  - [[architecture/runner-id-roles]] (`wiki/architecture/runner-id-roles.md`)
- `learnings/` (SKILL 시스템을 대체하는 주요 학습 및 규칙 저장소)
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
  - [[agents/index]]
  - [[agents/prompt-evolution]]

- `skills/`
  - [[skills/local-index]] (Agent-extracted skills catalog)
  - [[skills-local/nudge/adapter-running-state-heartbeat-2]] (`wiki/skills-local/nudge/adapter-running-state-heartbeat-2/SKILL.md`)
  - [[skills-local/nudge/adapter-running-state-heartbeat-3]] (`wiki/skills-local/nudge/adapter-running-state-heartbeat-3/SKILL.md`)
  - [[skills-local/nudge/adapter-running-state-heartbeat-4]] (`wiki/skills-local/nudge/adapter-running-state-heartbeat-4/SKILL.md`)
  - [[skills-local/nudge/adapter-running-state-heartbeat-5]] (`wiki/skills-local/nudge/adapter-running-state-heartbeat-5/SKILL.md`)

  - `answers/` — `autoflow wiki query --synth --save-as <slug>` 로 저장된 합성 답변 카탈로그. 위 `Recent Synthesis`는 최신 하이라이트이고, 아래 목록은 자주 다시 찾는 answer 페이지를 빠르게 탐색하기 위한 인덱스다. 자세한 규약은 [[answers/README]] 참고.
  - [[answers/README]] (`wiki/answers/README.md`)
  - [[answers/recent-core-and-ui-refinements-20260509]] (`wiki/answers/recent-core-and-ui-refinements-20260509.md`)
  - [[answers/common-verification-failure-patterns]] (`wiki/answers/common-verification-failure-patterns.md`)
  - [[answers/recent-core-and-ui-refinements-20260508-v2]] (`wiki/answers/recent-core-and-ui-refinements-20260508-v2.md`)
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

- Done tickets: 591
- Reject records: 0
- Verifier logs: 2
- Conversation handoffs: 8
- Last updated: 2026-05-09T07:17:03Z

## Completed Tickets

- `prd_224` - AiConversationPanel 진행 중 활동 인디케이터 (elapsed + tokens). 사용자는 "일을 하고 있는것인지 모르겠는데 이런식으로 (※ 45s · ↓ 272 tokens) 하단에 여백을 주고 표시가 가능할까?"라고 요청했다. order_196 이 안 A (활동 인디케이터) 와 안 B (터미널 임베드) 두 옵션을 제시했고, 본 PRD 는 사용자가 권장한 안 A 만 다룬다. 안 B 는 별도 PRD 후보. Source: `tickets/done/prd_224/prd_224.md`.
- `prd_223` - wiki RAG 검색을 sqlite FTS5 + BM25 로 전환 (phase 1, vector 는 옵셔널 후속). Source: `tickets/done/prd_223/prd_223.md`.
- `order_195` - 위키 검색 sqlite FTS5+BM25 도입 (vector 는 옵셔널 phase). Source: `tickets/done/prd_223/order_195.md`.
- `prd_222` - 데스크톱 ticket dialog 의 deprecated reject/ + legacy naming 보정. Source: `tickets/done/prd_222/prd_222.md`.
- `order_194` - 데스크톱 ticket dialog 의 deprecated reject/ + legacy naming 보정. Source: `tickets/done/prd_222/order_194.md`.
- `Todo-221` - 데스크톱 ticket dialog deprecated reject/ + legacy naming 보정. openTicketDialog 후보 경로에서 deprecated reject/ 제거, Todo-NNN/tickets_NNN cross-product 추가, npm run check 통과 Source: `tickets/done/prd_222/Todo-221.md`.
- `prd_221` - AiConversationPanel 라이브 어댑터 스트림 타이핑 애니메이션. Source: `tickets/done/prd_221/prd_221.md`.
- `order_193` - 러너 live adapter 스트림에 타이핑 애니메이션 적용. Source: `tickets/done/prd_221/order_193.md`.
- `prd_220` - 통계 처리 시간 카드 라벨 명확화 (처리 시간 → 평균 처리 시간). Source: `tickets/done/prd_220/prd_220.md`.
- `order_192` - 통계 처리 시간 카드 라벨 명확화 (처리 시간 → 평균 처리 시간). Source: `tickets/done/prd_220/order_192.md`.
- `prd_219` - AI 스킬 탭 로딩/조회수 분리 재시도 (prd_208 retry 1). Source: `tickets/done/prd_219/prd_219.md`.
- `Todo-210` - AI 스킬 탭 로딩 지연 + 클릭 시 조회수 누적 분리. Implemented AI skill list usage sidecar batch read, CLI `view --no-bump`, and desktop manual-view read-only usage behavior. Source: `tickets/done/prd_219/order_210_retry_1_20260509T061154Z.md`.
- `prd_218` - prd_218. Source: `tickets/done/prd_218/prd_218.md`.
- `order_191` - 통계 탭에 처리 시간 카드 추가 (metrics 집계 + strip 3칸). Source: `tickets/done/prd_218/order_191.md`.
- `Todo-209` - AI work for prd_218. 통계 탭 처리 시간 metrics emit 및 카드 추가 Source: `tickets/done/prd_218/Todo-209.md`.
- `prd_217` - prd_217. Source: `tickets/done/prd_217/prd_217.md`.
- `prd_216` - prd_216. Source: `tickets/done/prd_216/prd_216.md`.
- `Todo-216` - AI work for prd_216. `/skill-this` trigger SKILL 디렉토리 4개(`.claude/skills/skill-this`, `.codex/skills/skill-this`, `integrations/claude/skills/skill-this`, `integrations/codex/skills/skill-this`)를 삭제하고 main 으로 머지했다. scaffold 사본은 처음부터 없었다. Source: `tickets/done/prd_216/Todo-216.md`.
- `prd_215` - prd_215. Source: `tickets/done/prd_215/prd_215.md`.
- `prd_214` - prd_214. Source: `tickets/done/prd_214/prd_214.md`.
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

- [[sources/prd_160]] (autoflow learned skill registry phase 1)

- [[sources/prd_161]] (quote-prefix shadow 디렉토리 정리 및 재발 방지 가드)

- [[sources/prd_162]] (Hermes 자가학습 Phase 1 - Skill 인프라)

- [[sources/prd_163]] (Hermes 자가학습 Phase 3 — RAG 주입 및 활용 통계 자동화)

- [[sources/prd_164]] (Hermes 자가학습 Phase 4 — 데스크톱 UI)

- [[sources/prd_165]] (Hermes 자가학습 Phase 5 — 고도화)

- [[sources/prd_166]] (Hermes 자가학습 Phase 2 — Curator 및 자동 추출 트리거)

- [[sources/prd_167]] (Runner 정지 흐름의 Graceful 중지 및 단계별 알림 전환)

- [[sources/prd_195]] (telemetry 5.2T 재시도 및 dirty-root 정리)

- [[sources/prd_196]] (데스크톱 위키 Runner 설정 폭 정렬)

- [[sources/prd_197]] (telemetry post-merge cleanup 실패 재발 방지)


- [[sources/prd_199]] (데스크톱 retry order 파일 노출 보정)

- [[sources/prd_198]] (워크플로 핀 레이어 안내 문구 3종 제거)

- [[sources/prd_200]] (post-merge cleanup 차단 시 재시도 라우팅 보정)

- [[sources/prd_201]] (Todo-NNN 티켓 파일명 마이그레이션 (prd_201))

- [[sources/prd_202]] (데스크톱 메뉴명 AI AutoFlow 변경)

- [[sources/prd_203]] (러너 설정 '저장하고 재시작' 제거 및 dirty-root 재시도)

- [[sources/prd_204]] (prd_204: 워크플로 핀 레이어 안내 문구 제거 (dirty-root 재시도))

- [[sources/prd_205]] (retry order 파일 노출 dirty-root 재시도)

- [[sources/prd_206]] (AI Autoflow 그리드 1줄 3칸 고정)

- [[sources/prd_207]] (터미널 뷰 러너 시작/정지 binary 상태 표시 (prd_207))

- [[sources/prd_208]] (AI 스킬 탭 로딩 지연 개선 및 조회수 누적 로직 분리 (PRD 208))

- [[sources/prd_209]] (러너 카드 내부 설정 행 1줄 고정)

- [[sources/prd_210]] (PRD 210 — 데스크톱 러너 라벨 영문 전환 (Worker / LLM Wiki))

- [[sources/prd_211]] (Planner backlog PRD 우선 처리 정책 (prd_211))

- [[sources/prd_212]] (SKILL 시스템 전면 제거 및 대체)

- [[sources/prd_218]] (통계 탭 처리 시간 카드 추가)

- [[sources/prd_213]] (SKILL 제거 Phase 2 — CLI 서브커맨드 및 RAG 조회수 카운터 제거)

- [[sources/prd_214]] (SKILL 제거 Phase 3 — 데스크톱 UI / IPC 제거)

- [[sources/prd_215]] (SKILL 제거 Phase 4 — order/autoflow RAG injection 제거)

- [[sources/prd_216]] (PRD 216 — /skill-this 트리거 SKILL 제거)

- [[sources/prd_217]] (SKILL 제거 Phase 6 — Wiki content + AGENTS.md rule 정리)

- [[sources/prd_219]] (AI 스킬 탭 로딩/조회수 분리 재시도 (prd_219))

- [[sources/prd_220]] (통계 처리 시간 카드 라벨 명확화)

- [[sources/prd_221]] (AiConversationPanel 라이브 어댑터 스트림 타이핑 애니메이션)

- [[sources/order_193]] (러너 라이브 어댑터 스트림 타이핑 애니메이션 적용)

- [[sources/ai-work-for-prd-162-skill]] (PRD-162 AI 작업 스킬 (Hermes Phase 1 인프라))

- [[sources/skill_001]] (데스크톱 셀프힐 러너 리스트 캐시 가드)

- [[sources/skill_003]] (데스크톱 selfHeal 러너 리스트 캐시 가드)

- [[sources/skill_004]] (Autoflow 학습 기술 레지스트리 1단계)

- [[sources/skill_005]] (Reasoning level 동적 dispatch (tick 복잡도 기반))

- [[sources/skill_006]] (플래너 차분 컨텍스트 프롬프트 디스패치)

- [[sources/skill_007]] (따옴표 접두사 섀도 디렉토리 정리 가드)

- [[sources/prd_222]] (데스크톱 티켓 다이얼로그 경로 및 네이밍 보정 (prd_222))

- [[sources/order_194]] (데스크톱 티켓 다이얼로그 경로 및 명명 규칙 보정 (order_194))

- [[sources/order_192]] (통계 처리 시간 카드 라벨 명확화 (order_192))

- [[sources/prd_223]] (wiki RAG sqlite FTS5 + BM25 도입 (Phase 1))

- [[sources/prd_224]] (AiConversationPanel 진행 중 활동 인디케이터 (경과 시간 및 토큰))
