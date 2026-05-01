# Ticket

## Ticket

- ID: tickets_074
- PRD Key: prd_076
- Plan Candidate: Plan AI handoff from tickets/done/prd_076/prd_076.md
- Title: 보드 갱신 중 다이얼로그/레이어 깜박임 제거
- Stage: rejected
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI: worker
- Last Updated: 2026-05-01T13:50:37Z

## Goal

- 이번 작업의 목표: 데스크톱 앱에서 다이얼로그나 레이어가 열린 상태로 보드 상태가 갱신되어도 레이어가 remount 되거나 entry animation 이 다시 재생되는 듯한 깜박임 없이 안정적으로 유지되게 한다.

## References

- PRD: tickets/done/prd_076/prd_076.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Obsidian Links

- Project Note: [[prd_076]]
- Plan Note:
- Ticket Note: [[tickets_074]]

## Allowed Paths

- `apps/desktop/src/components/ui/dialog.tsx`
- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_074`
- Branch: autoflow/tickets_074
- Base Commit: e71af04f6087d85f8d8d7d3b68ce0db434540730
- Worktree Commit:
- Integration Status: pending

## Goal Runtime
- Status: blocked
- Started At: 2026-05-01T13:48:17Z
- Started Epoch: 1777643297
- Updated At: 2026-05-01T13:50:37Z
- Tick Count: 1
- Time Used Seconds: 140
- Token Budget:
- Tokens Used:
- Continuation Suppressed: true
- Last Event: rejected
- Last Progress Fingerprint: 335739843

## Recovery State

- Status: blocked
- Detected By: owner-1
- Failure Class: dirty_root
- Evidence: owner-1 resumed the existing worktree, confirmed the dirty patch is the scoped open-layer stability fix, and ran `npm --prefix apps/desktop run check` in both the ticket worktree and PROJECT_ROOT with exit 0. The worktree remains scoped to `apps/desktop/src/components/ui/dialog.tsx` and `apps/desktop/src/renderer/main.tsx` with 87 insertions / 13 deletions. PROJECT_ROOT remains broadly dirty in overlapping/adjacent desktop files (`dialog.tsx`, `main.tsx`, `styles.css`, `preload.js`, and out-of-scope `vite-env.d.ts`) with 1822 insertions / 2335 deletions and root-only API/type dependencies such as `window.autoflow.projectExists` and runner auth fields.
- Planner Decision: Prior planner instruction said not to create another retry and to finish fail with concrete evidence if the stale-worktree/dirty-root blocker remained. That condition still holds.
- Owner Resume Instruction: Land or isolate the broad desktop renderer/API rewrite first, or create a fresh follow-up ticket from current PROJECT_ROOT HEAD with scope that includes the required root-side typing/preload dependencies. Do not pass/finalize `tickets_074` from the current worktree/root mismatch.
- Last Recovery At: 2026-05-01T22:49:19+09:00

## Done When

- [ ] 다이얼로그/레이어를 연 상태로 보드 상태 갱신 또는 runner tick 이 1회 이상 지나도 backdrop, panel, content 가 깜박이거나 닫혔다 다시 열리는 것처럼 보이지 않는다.
- [ ] 의도적인 open 동작에서는 기존 open animation 이 한 번만 실행되고, 열린 상태의 부모 재렌더에서는 같은 entry animation 이 다시 실행되지 않는다.
- [ ] 의도적인 close/reopen 흐름, Escape, 외부 클릭, close button 동작이 기존처럼 유지된다.
- [ ] ticket detail layer 와 workflow pin layer 처럼 `af-dialog-*` 또는 `workflow-pin-layer-*` 스타일을 공유하는 대표 레이어에서 회귀가 없다.
- [ ] `prefers-reduced-motion` 환경에서도 깜박임 방지와 open/close 상태 전환이 깨지지 않는다.
- [ ] 구현은 Allowed Paths 안에 머물고 보드 데이터 로딩, runner 상태, markdown 렌더링, ticket lifecycle 동작을 바꾸지 않는다.
- [ ] desktop check command 가 통과한다.

## Next Action
- reject 처리됨: broad desktop renderer/API rewrite 를 먼저 landing 또는 current HEAD 기준 isolated diff 로 분리한 뒤, 필요하면 새 티켓에서 open-layer stability fix 를 재적용한다. 현재 worktree/root mismatch 상태에서는 `tickets_074`를 다시 auto-retry 하지 않는다.

## Resume Context

- 현재 상태 요약: open-layer stability fix 는 worktree 와 PROJECT_ROOT 양쪽에서 check 를 통과하지만, pass finalization 은 동일한 dirty-root blocker 때문에 안전하지 않다.
- 직전 작업: owner-1 이 `autoflow wiki query` 로 `tickets/done/prd_076/prd_076.md`, `tickets/done/prd_059/tickets_061.md`, `tickets/reject/reject_071.md` 를 재확인했고, `npm --prefix apps/desktop run check` 를 worktree 와 PROJECT_ROOT 에서 각각 exit 0 으로 확인했다.
- 재개 시 먼저 볼 것: `tickets/reject/verify_074.md`, `tickets/reject/reject_071.md`, PROJECT_ROOT `git diff --stat -- apps/desktop/src/components/ui/dialog.tsx apps/desktop/src/renderer/main.tsx apps/desktop/src/renderer/styles.css apps/desktop/src/preload.js apps/desktop/src/renderer/vite-env.d.ts`. 현재 root dirty stat 은 5 files, 1822 insertions(+), 2335 deletions(-) 이며 out-of-scope `vite-env.d.ts`/`preload.js` 변경에 의존한다.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_076/prd_076.md at 2026-04-30T22:31:50Z.
- Wiki context command: `bin/autoflow wiki query /Users/demoon2016/Documents/project/autoflow .autoflow --term "다이얼로그 레이어 깜박임" --term "dialog layer flicker" --term "af-dialog-content" --term "workflow-pin-layer overlay" --term "apps/desktop/src/components/ui/dialog.tsx" --limit 8`.
- Planning constraint: preserve the prior `prd_059` stale-first-frame/backdrop-class fix and `prd_043` layer behavior/focus/scrolling constraints; this ticket specifically targets flicker while a layer is already open during background board refresh.

- Runtime hydrated worktree dependency at 2026-04-30T22:32:28Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- Cleanup note (2026-05-01T12:09:44Z): stale pre-claim Worktree metadata was cleared while the ticket remained in `tickets/todo/`; the next owner claim must create a fresh worktree from current PROJECT_ROOT HEAD.
- Runtime hydrated worktree dependency at 2026-05-01T13:28:41Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- AI worker prepared resume at 2026-05-01T13:33:29Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_074; run=tickets/inprogress/verify_074.md
- Wiki context pass (owner-1): `autoflow wiki query` surfaced `tickets/done/prd_059/tickets_061.md` and `tickets/done/prd_043/tickets_043.md`; preserve the prior ticket-detail stale first-frame/backdrop class fix and shared layer focus/scrolling behavior while addressing refresh-time open-layer stability.
- Mini-plan (owner-1, 2026-05-01T22:47:00+09:00):
  1. Stabilize `DialogContent` open lifecycle metadata so entry animation/state can be scoped to the first intentional open instead of every parent refresh.
  2. Keep ticket detail layer identity stable across board snapshot refreshes by retaining the last selected item snapshot while the selected path is being refreshed, and by following same-basename ticket moves between board folders when safe.
  3. Keep workflow pin layers mounted while intentionally open even if a board refresh temporarily empties their source list.
  4. Verify with static criteria review plus `npm --prefix apps/desktop run check` in the worktree and again from `PROJECT_ROOT` after AI-led integration.
- Implementation (owner-1, 2026-05-01T23:03:00+09:00): worktree patch changed only Allowed Paths and `npm --prefix apps/desktop run check` passed. PROJECT_ROOT received the same logical fix adapted to its current refactored dialog/main structure and also passed the same check.
- Blocker (owner-1, 2026-05-01T23:03:00+09:00): PROJECT_ROOT already contains large pre-existing changes in the same Allowed Paths; making the worktree exactly match root pulled in root code that depends on out-of-scope `window.autoflow.projectExists` and runner auth typings, breaking worktree TypeScript. The owner restored the worktree to the scoped passing patch and is finishing fail so planner can requeue from current root baseline instead of committing unrelated dirty root state under this ticket.
- AI worker marked fail at 2026-05-01T13:40:47Z.
- Ticket automatically replanned from tickets/reject/reject_074.md at 2026-05-01T13:42:26Z; retry_count=1
- Planner recovery decision (2026-05-01T22:43:19+0900): wiki query for `보드 갱신 중 다이얼로그 레이어 깜박임`, `dialog layer flicker`, `af-dialog-content`, `workflow-pin-layer`, `dirty_root`, `projectExists runner auth typings`, and the affected desktop paths surfaced `tickets/done/prd_076/prd_076.md`, `tickets/done/prd_059/tickets_061.md`, `tickets/reject/reject_074.md`, and `tickets/reject/reject_071.md`. `reject_071` shows the same broad dirty renderer rewrite can cause unsafe repeated finalization attempts, so this retry's `Max Retries` is fixed at 1 and owner must reject rather than auto-loop if dirty-root finalization remains blocked.
- Blocked stale todo worktree at 2026-05-01T13:48:16Z: /Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_074 still has unmerged or dirty state, so the runtime refused to reuse it silently.
- AI worker prepared todo at 2026-05-01T13:48:16Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_074; run=tickets/inprogress/verify_074.md
- Planner checkpoint (2026-05-01T22:48:14+0900): `autoflow wiki query` resurfaced `tickets/done/prd_076/prd_076.md` and `wiki/answers/open-layer-flicker-finalization-blocker-20260501.md`; `scripts/start-plan.sh` returned `status=idle` and skipped `reject_003` / `reject_071` because retry limits were reached. Read-only git checks showed the retry worktree still has scoped dirty changes, so planner left the worktree intact and directed owner-1 to salvage or fail once with evidence.
- Wiki context retry note (owner-1, 2026-05-01T22:49:19+09:00): `autoflow wiki query` resurfaced `tickets/done/prd_076/prd_076.md`, `tickets/done/prd_059/tickets_061.md`, and `tickets/reject/reject_071.md`. The prior stale first-frame/backdrop and shared layer behavior constraints remain satisfied by the scoped worktree patch, but `reject_071` and the planner recovery note both constrain this attempt to reject if the broad dirty-root finalization blocker remains.
- Verification note (owner-1, 2026-05-01T22:49:19+09:00): direct `npm --prefix apps/desktop run check` passed in both `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_074` and `/Users/demoon2016/Documents/project/autoflow`. `rg` confirmed both roots contain the intended open-layer stability markers (`data-af-open-cycle`, `keepMounted`, `activeDetailSnapshot`, `resolveTicketWorkspaceDetailItem`).
- Merge safety note (owner-1, 2026-05-01T22:49:19+09:00): failing instead of pass because PROJECT_ROOT still has broad dirty changes in the same/adjacent desktop files (`dialog.tsx`, `main.tsx`, `styles.css`, `preload.js`, `vite-env.d.ts`) while the worktree has only the scoped flicker patch. Passing now would stage unrelated root rewrite/API typing work or require broadening Allowed Paths beyond this ticket.
- AI worker marked fail at 2026-05-01T13:50:37Z.
## Verification
- Run file: `tickets/reject/verify_074.md`
- Log file: `logs/verifier_074_20260501_135037Z_fail.md`
- Result: failed

## Result
- Summary: scoped flicker fix passes check in worktree and PROJECT_ROOT, but pass finalization is unsafe because PROJECT_ROOT has broad pre-existing dirty desktop rewrite and out-of-scope API typing/preload dependencies.
- Remaining risk: none for this owner tick beyond the recorded dirty-root blocker; the next safe step is to land/isolate the broader desktop rewrite before replaying this fix from current HEAD.

## Reject Reason

- dirty PROJECT_ROOT baseline blocks safe pass finalization: scoped flicker fix passes checks, but root allowed files depend on out-of-scope desktop typing/preload changes; requeue from current PROJECT_ROOT HEAD or broaden follow-up scope

## Retry
- Retry Count: 1
- Max Retries: 1

## Reject History
- 2026-05-01T13:42:26Z | retry_count=1 | source=`tickets/reject/reject_074.md` | log=``logs/verifier_074_20260501_134047Z_fail.md`` | reason=dirty PROJECT_ROOT baseline blocks safe pass finalization: scoped flicker fix passes checks, but root allowed files depend on out-of-scope desktop typing/preload changes; requeue from current PROJECT_ROOT HEAD or broaden follow-up scope
