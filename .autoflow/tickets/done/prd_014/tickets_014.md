# Ticket

## Ticket

- ID: tickets_014
- PRD Key: prd_014
- Plan Candidate: Plan AI handoff from tickets/done/prd_014/prd_014.md
- Title: Fix planner stage indicator showing "계획" while runtime is idle
- Stage: done
- AI: AI-1
- Claimed By: AI-1
- Execution AI: AI-1
- Verifier AI: AI-1
- Last Updated: 2026-04-27T13:29:34Z

## Goal

- 이번 작업의 목표: 데스크톱 작업 흐름 페이지의 Plan AI 카드 단계 표시기가 `status=running` 만으로 "계획" 으로 잘못 매핑되는 버그를 고친다. `runnerStageKey()` 의 planner 분기에 `hasActiveTicket` + `adapter_start` 가드를 추가해, idle 시 "대기", 직전 todo 생성 시 "완료", 실제 어댑터 실행 중 "계획", fail-like 시 "정체" 로 정확히 매핑한다.

## References

- PRD: tickets/done/prd_014/prd_014.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Obsidian Links

- Project Note: [[prd_014]]
- Plan Note:
- Ticket Note: [[tickets_014]]

## Allowed Paths

- `apps/desktop/src/renderer/main.tsx` (modify `runnerStageKey()` planner branch only — do not change ticket-owner or wiki-maintainer branches)

## Worktree
- Path: `/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_014`
- Branch: autoflow/tickets_014
- Base Commit: 5607a9e1bef39af25ac87d51984903657bd487cb
- Worktree Commit:
- Integration Status: no_code_changes

## Done When

- [x] planner-1 이 `status=running`, `last_result=loop_waiting_exit_0` 이고 `last_log_line` 에 adapter_start/source 마커가 없을 때 단계가 **"대기"** 로 표시된다.
- [x] planner-1 이 직전 tick 에서 `source=backlog-to-todo` 또는 `source=reject-replan` 으로 todo 티켓을 만들었을 때 단계가 **"완료"** 로 표시된다.
- [x] planner-1 의 `last_log_line` 에 `event=adapter_start` 가 보이고 active ticket 또는 source 흔적이 아직 없을 때 단계가 **"계획"** 로 표시된다.
- [x] planner-1 의 `last_result` 또는 `active_stage` 가 fail-like (예: `adapter_exit_1`, `failed`) 일 때 단계가 **"정체"** 로 표시된다.
- [x] `cd apps/desktop && npx tsc --noEmit` 가 0 errors 로 통과한다.
- [x] `cd apps/desktop && npm run check` 가 통과한다.
- [x] dev 서버에서 보드 비어있을 때 planner-1 카드가 첫 단계 ("대기") 활성 상태로 보이고, 실제 PRD 처리 직후 "완료" 로 한 단계 진행되는 것이 시각적으로 확인된다. Adapter note: direct Electron visual inspection was unavailable because Computer Use returned macOS Apple event error -1743; the same UI stage paths were verified through the `runnerStageKey()` scenario script and the `plannerFlowStages` order.

## Next Action
- Complete: coordinator integrated the verified ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: `apps/desktop/src/renderer/main.tsx` 의 `runnerStageKey()` planner 분기가 수정되어 fail-like -> blocked, source/todo traces -> done, running+active/adapter_start -> planning, otherwise idle 순서로 매핑된다.
- 직전 작업: AI-1 resumed the ticket, refreshed wiki context with `/Users/demoon/Documents/project/autoflow/bin/autoflow wiki query`, and inspected the existing scoped diff.
- 재개 시 먼저 볼 것: `runnerStageKey()` planner branch, PRD `tickets/done/prd_014/prd_014.md`, Goal, Allowed Paths, Done When.

## Notes

- Created by demoon@gomgom:27646 (Plan AI) from tickets/done/prd_014/prd_014.md at 2026-04-27T12:13:42Z.
- Wiki context (planner-1): Bug introduced by prd_011 ("Replace ticket board with tabbed PRD/ticket workspace") which added `plannerFlowStages` and the initial `runnerStageKey()` planner branch. The wiki-maintainer branch already has the correct `hasActiveTicket || adapter_start` guard pattern — replicate it for the planner branch.
- Wiki context (planner-1): `tickets/done/prd_011/tickets_011.md` confirmed as the origin of `runnerStageKey` and `plannerFlowStages`. No prior reject or fix attempt for this specific bug exists.
- PRD scope constraints (planner-1): Only `main.tsx` is in scope — single file, logic-only change. No `styles.css`, no `plannerFlowStages` label/meta changes, no `start-plan.sh` output key changes, no visual design changes. Verification: `cd apps/desktop && npm run check` + visual dev-server check for idle/done/planning/blocked transitions.

- Runtime hydrated worktree dependency at 2026-04-27T12:24:34Z: linked apps/desktop/node_modules -> /Users/demoon/Documents/project/autoflow/apps/desktop/node_modules
- Runtime hydrated worktree dependency at 2026-04-27T12:24:34Z: linked node_modules -> /Users/demoon/Documents/project/autoflow/node_modules
- AI AI-1 prepared todo at 2026-04-27T12:24:34Z; worktree=/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_014; run=tickets/inprogress/verify_014.md
- AI AI-1 prepared resume at 2026-04-27T12:33:20Z; worktree=/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_014; run=tickets/inprogress/verify_014.md
- AI AI-1 prepared resume at 2026-04-27T12:39:22Z; worktree=/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_014; run=tickets/inprogress/verify_014.md
- AI AI-1 prepared resume at 2026-04-27T12:46:58Z; worktree=/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_014; run=tickets/inprogress/verify_014.md
- AI AI-1 prepared resume at 2026-04-27T12:56:37Z; worktree=/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_014; run=tickets/inprogress/verify_014.md
- AI AI-1 prepared resume at 2026-04-27T13:04:43Z; worktree=/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_014; run=tickets/inprogress/verify_014.md
- AI AI-1 prepared resume at 2026-04-27T13:05:33Z; worktree=/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_014; run=tickets/inprogress/verify_014.md
- AI-1 mini-plan at 2026-04-27T13:06:41Z:
  1. Apply the wiki/PRD mapping from `tickets/done/prd_014/prd_014.md`: fail-like -> `blocked`, source/todo creation traces -> `done`, running only with active ticket or `event=adapter_start` -> `planning`, otherwise `idle`.
  2. Modify only the `runnerStageKey()` planner branch in `apps/desktop/src/renderer/main.tsx`; leave ticket-owner, wiki-maintainer, labels, styles, and scripts unchanged.
  3. Verify with `cd apps/desktop && npx tsc --noEmit`, `cd apps/desktop && npm run check`, and a non-Playwright browser/dev-server observation if feasible.
- Wiki query at 2026-04-27T13:06:41Z cited `tickets/done/prd_014/prd_014.md` as the direct mapping source and confirmed `tickets/done/prd_011/tickets_011.md` as the origin of `runnerStageKey`/`plannerFlowStages`.
- AI AI-1 prepared resume at 2026-04-27T13:21:53Z; worktree=/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_014; run=tickets/inprogress/verify_014.md
- AI AI-1 prepared resume at 2026-04-27T13:22:30Z; worktree=/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_014; run=tickets/inprogress/verify_014.md
- AI-1 resume/update at 2026-04-27T13:23:34Z:
  1. Runtime resumed `tickets_014` in `/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_014`.
  2. Wiki query using planner stage / `runnerStageKey` / `adapter_start` terms returned `tickets/done/prd_014/prd_014.md` as the relevant memory source; no additional conflicting wiki decision surfaced.
  3. Existing implementation diff is limited to the allowed `runnerStageKey()` planner branch and applies the PRD mapping constraint from `tickets/done/prd_014/prd_014.md`.
- Ticket owner verification failed by AI-1 at 2026-04-27T13:26:53Z: command exited 127
- Ticket owner verification passed by AI-1 at 2026-04-27T13:27:21Z: command exited 0
- AI-1 verification evidence at 2026-04-27T13:28:47Z:
  1. `cd apps/desktop && npx tsc --noEmit` exited 0.
  2. Runtime verification with command override `cd apps/desktop && npm run check` exited 0. The earlier runtime exit 127 was caused by markdown backticks around the PRD command, not by the desktop check itself.
  3. Scenario script confirmed planner stage keys for idle, done, planning, and blocked cases. Direct Electron visual inspection was unavailable in this adapter session; see `tickets/inprogress/verify_014.md`.
- Rebased worktree onto PROJECT_ROOT HEAD 5607a9e1bef39af25ac87d51984903657bd487cb at 2026-04-27T13:29:33Z for clean merge.
- Allowed path was not present in worktree during merge preparation at 2026-04-27T13:29:33Z, so it was skipped: apps/desktop/src/renderer/main.tsx (modify runnerStageKey() planner branch only — do not change ticket-owner or wiki-maintainer branches)
- No staged code changes found in worktree during merge preparation at 2026-04-27T13:29:33Z.
- Impl AI AI-1 marked verification pass at 2026-04-27T13:29:33Z and triggered inline merge.
- Coordinator AI-1 finalized this verified ticket at 2026-04-27T13:29:34Z.
- Coordinator post-merge cleanup at 2026-04-27T13:29:34Z: removed_worktree=/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_014 deleted_branch=autoflow/tickets_014.
- Repair note at 2026-04-27T13:31:12Z: post-finish sanity check found the inline merge skipped `apps/desktop/src/renderer/main.tsx` because the Allowed Paths line included explanatory prose after the backticked path. The verified one-line planner mapping change was applied directly to `PROJECT_ROOT` and staged as a follow-up repair hunk without staging unrelated dirty renderer changes.
- Repair verification at 2026-04-27T13:31:12Z: `cd apps/desktop && npx tsc --noEmit` exited 0 and `cd apps/desktop && npm run check` exited 0 from `PROJECT_ROOT`.
## Verification
- Run file: `tickets/done/prd_014/verify_014.md`
- Log file: `logs/verifier_014_20260427_132934Z_pass.md`
- Result: passed

## Result

- Summary: Fix planner stage mapping so idle running loops show 대기 and todo creation shows 완료
- Remaining risk: Direct Electron visual inspection was unavailable in this adapter session, so visual behavior is inferred from the verified stage-key mapping and unchanged `plannerFlowStages` rendering path. Runtime Allowed Paths parsing skipped the original worktree file; repaired in PROJECT_ROOT with a follow-up commit.
