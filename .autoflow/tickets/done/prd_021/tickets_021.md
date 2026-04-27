# Ticket

## Ticket

- ID: tickets_021
- PRD Key: prd_021
- Plan Candidate: Workflow page UI overhaul — collapse sidebar label, wrap progress bar, simplify card titles, hoist AI controls into cards
- Title: Workflow page UI overhaul — sidebar label, card header simplification, progress wrap, inline controls
- Stage: done
- AI: 019dcf25-517d-73a1-8ab4-471907c1f307
- Claimed By: 019dcf25-517d-73a1-8ab4-471907c1f307
- Execution AI: 019dcf25-517d-73a1-8ab4-471907c1f307
- Verifier AI: 019dcf25-517d-73a1-8ab4-471907c1f307
- Last Updated: 2026-04-27T16:07:56Z

## Goal

- 이번 작업의 목표: 데스크톱 작업 흐름 페이지를 자체 완결적 모니터링+제어 허브로 만든다. (1) 사이드 메뉴 라벨 `작업 흐름` → `작업` 변경, (2) AI 카드 헤더를 role 기반 이름(`Planner`/`Worker`/`위키봇`)으로 단순화하고 모델·추론 텍스트 제거, (3) progress dots 가 좁은 폭에서 wrap 되도록 CSS 적용, (4) 시작/정지/재시작 버튼을 카드 우측 상단에 inline 배치, (5) 모델/추론/저장 컨트롤을 카드 내부 터미널 위에 한 줄로 추가, (6) AI 관리 페이지와 양쪽 동기화 보장.

## References

- PRD: tickets/done/prd_021/prd_021.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Obsidian Links

- Project Note: [[prd_021]]
- Plan Note:
- Ticket Note: [[tickets_021]]

## Allowed Paths

- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`
- `apps/desktop/src/components/ui/`
- `apps/desktop/src/renderer/`

## Worktree
- Path: `/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_021`
- Branch: autoflow/tickets_021
- Base Commit: 049209895508984a9418dc02ff4d7a1cc088088e
- Worktree Commit: f1b2b0186041ba7fd33ff06305460b49af9bdb47
- Integration Status: integrated_by_ai_manual_merge

## Done When

- [x] 사이드 메뉴의 `작업 흐름` 항목이 `작업` 으로 표시된다.
- [x] 작업 흐름 페이지의 각 AI 카드 헤더 좌측이 `Planner` / `Worker` / `위키봇` 중 하나로만 표시된다(어댑터·runner-id 없음).
- [x] AI 카드 헤더에서 모델·추론 보조 텍스트(`Opus 4.7 · 높음` 등) 가 사라진다.
- [x] 카드 폭이 좁아져 단계 dots 가 한 줄에 못 들어갈 때 두 줄 이상으로 wrap 되며, 라벨이 잘리거나 dots 가 겹치지 않는다.
- [x] 각 AI 카드 우측 상단에 시작/정지/재시작 아이콘 버튼이 있고, 누르면 AI 관리 페이지의 같은 동작이 호출된다(같은 `onControl` 핸들러).
- [x] 각 AI 카드의 터미널 박스 위쪽 한 줄에 모델 셀렉터, 추론 셀렉터, 저장 버튼이 있고, 변경 후 저장 버튼이 활성화 + dirty dot 표기, 클릭 시 runner config.toml 이 갱신되어 다음 tick 에 반영된다.
- [x] AI 관리 페이지에서 같은 runner 의 모델/추론을 바꿔 저장하면 작업 페이지의 카드 컨트롤도 동기화된다(반대 방향도 동일).
- [x] `cd apps/desktop && npx tsc --noEmit` 가 0 errors.
- [x] `cd apps/desktop && npm run check` 가 통과한다.
- [x] 시각 회귀: 통계, Wiki, 티켓 정보 페이지 영향 없음.

## Next Action
- Complete: AI manually merged the remaining workflow card controls/layout behavior into current `main` while preserving later ticket 025/026 changes.

## Resume Context

- 현재 상태 요약: 구현과 자동 검증이 통과했다. Product diff 는 `apps/desktop/src/renderer/main.tsx`, `apps/desktop/src/renderer/styles.css` 로 제한된다.
- 직전 작업: `npx tsc --noEmit` 통과, `npm run check` 통과, verifier wrapper 는 Markdown backtick 포함 명령으로 1회 exit 127 후 override `cd apps/desktop && npm run check` 로 pass 기록. `finish-ticket-owner.sh 021 pass ...` prepared worktree commit `f1b2b0186041ba7fd33ff06305460b49af9bdb47`; inline merge blocked on dirty project-root scope in the two changed files.
- 재개 시 먼저 볼 것: `RunnerConfigControls`, `TicketBoard` props, `AiProgressRow`, `.ai-progress-track`, `.ai-progress-config`.

## Notes

- Created by demoon@gomgom:8527 (Plan AI) from tickets/done/prd_021/prd_021.md at 2026-04-27T12:48:43Z.
- Wiki context: tickets_007 (prd_007) established 3-line agent/id/progress card display — this PRD simplifies that further to role-only label. tickets_017 restricted Claude reasoning to medium/high — the inline reasoning selector must reuse `runnerAgentReasoningOptions` which already enforces that policy.
- Owner wiki query at 2026-04-27T13:36Z: `./bin/autoflow wiki query ... --term "Workflow page" --term "AI card controls" --term "runner model reasoning" --term "progress dots"` returned `tickets/done/prd_021/prd_021.md`; follow-up query for `runnerAgentReasoningOptions`, `claude reasoning medium high`, `3-runner layout`, `AiProgressRow` returned `tickets/done/prd_017/tickets_017.md`, `tickets/done/prd_017/prd_017.md`, `tickets/done/prd_007/prd_007.md`, and `tickets/done/prd_016/prd_016.md`.
- Role label mapping: `planner|plan` → `Planner`, `ticket-owner|owner` → `Worker`, `wiki-maintainer|wiki` → `위키봇`. Fallback to existing display for unknown roles.
- shadcn Button (ghost/outline) + lucide icons (Play, Square, RotateCw) for start/stop/restart controls per Rule 17.
- Model/reasoning selectors reuse existing `runnerAgentModelOptions` / `runnerAgentReasoningOptions` helpers.
- Dirty state indicator: dot next to "저장" button when local selection differs from persisted config.
- Mini-plan:
  1. Change the progress nav label only, leaving route keys and icons intact.
  2. Reuse the AI management page's runner control/config callbacks and runner draft state in `TicketBoard` / `AiProgressRow`.
  3. Extract shared runner model/reasoning/save controls so workflow cards and AI management stay synchronized through the same `runnerDrafts` state and `saveRunnerConfig`.
  4. Simplify workflow card header text to role-only labels, remove model/reasoning meta from the header, and add start/stop/restart controls at the card top right.
  5. Convert progress steps to wrapping flex layout and remove step label truncation.
  6. Run `cd apps/desktop && npx tsc --noEmit` and `cd apps/desktop && npm run check`; then finish pass/fail through the runtime script.

- Runtime hydrated worktree dependency at 2026-04-27T13:34:16Z: linked apps/desktop/node_modules -> /Users/demoon/Documents/project/autoflow/apps/desktop/node_modules
- Runtime hydrated worktree dependency at 2026-04-27T13:34:16Z: linked node_modules -> /Users/demoon/Documents/project/autoflow/node_modules
- AI 019dcf25-517d-73a1-8ab4-471907c1f307 prepared todo at 2026-04-27T13:34:16Z; worktree=/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_021; run=tickets/inprogress/verify_021.md
- Ticket owner verification failed by 019dcf25-517d-73a1-8ab4-471907c1f307 at 2026-04-27T13:40:41Z: command exited 127
- Ticket owner verification passed by 019dcf25-517d-73a1-8ab4-471907c1f307 at 2026-04-27T13:41:02Z: command exited 0
- Owner implementation summary: changed progress nav label to `작업`; added shared `RunnerConfigControls` so AI management and workflow cards share the same draft/save path; workflow cards now use role-only labels, inline start/stop/restart buttons wired to `onControl`, model/reasoning/save controls above terminal output, and wrapping progress dots with non-truncated labels.
- Verification note: direct `cd apps/desktop && npx tsc --noEmit` passed before runtime verification. `cd apps/desktop && npm run check` passed manually and through `verify-ticket-owner.sh 021 "cd apps/desktop && npm run check"`. Source review confirms no changes to Stats/Wiki/Ticket page rendering paths beyond passing `installedAgentProfiles` into the existing fallback `TicketBoard`.
- Prepared worktree commit f1b2b0186041ba7fd33ff06305460b49af9bdb47 at 2026-04-27T13:42:40Z; coordinator should integrate it into PROJECT_ROOT and create the local completion commit.
- Impl AI 019dcf25-517d-73a1-8ab4-471907c1f307 marked verification pass at 2026-04-27T13:42:40Z and triggered inline merge.
- Merge blocked at 2026-04-27T13:42:40Z: PROJECT_ROOT has conflicting dirty changes in commit paths (apps/desktop/src/renderer/main.tsx apps/desktop/src/renderer/styles.css).
- Coordinator 019dcf25-517d-73a1-8ab4-471907c1f307 blocked at 2026-04-27T13:42:40Z: dirty_scope_conflict (attempt 1/5).
- AI-led root merge at 2026-04-27T16:07:56Z: preserved existing `작업` navigation label, role-only card titles, shared `RunnerConfigControls`, and Gemini asset behavior from current `main`; added workflow-card `restart` control typing/button and kept progress labels wrapping without truncation. `cd apps/desktop && npx tsc --noEmit` and `npm --prefix apps/desktop run check` passed.
## Verification
- Run file: `tickets/done/prd_021/verify_021.md`
- Log file: `logs/manual_worktree_merge_20260427_160756Z.md`
- Result: passed by 019dcf25-517d-73a1-8ab4-471907c1f307 at 2026-04-27T13:42:40Z

## Result

- Summary: Workflow page AI cards now use role-only labels, inline runner controls, synced model/reasoning controls, and wrapping progress dots.
- Remaining risk: Browser-level visual inspection was not run because the required Codex in-app browser runtime is not exposed in this adapter, and project rules prohibit Playwright for verifier checks. Merge is blocked until existing dirty `PROJECT_ROOT` edits in `apps/desktop/src/renderer/main.tsx` and `apps/desktop/src/renderer/styles.css` are resolved.
