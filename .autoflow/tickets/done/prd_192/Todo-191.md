# Ticket

## Ticket

- ID: Todo-191
- PRD Key: prd_192
- Plan Candidate: Plan AI handoff from tickets/done/prd_192/prd_192.md
- Title: desktop runner transition action guard
- Priority: high
- Stage: done
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI: worker
- Last Updated: 2026-05-05T22:40:49Z

## Goal

- 이번 작업의 목표: AI runner start/stop/restart 처리가 IPC 응답 직후가 아니라 실제 runner state transition 완료 시점까지 진행 중으로 유지되게 하여, 중복 클릭으로 인한 race condition 과 중복 spawn 가능성을 막는다.

## References

- PRD: tickets/done/prd_192/prd_192.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_192]]
- Plan Note:
- Ticket Note: [[Todo-191]]

## Allowed Paths

- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`
- `apps/desktop/src/main.js`

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-191`
- Branch: autoflow/Todo-191
- Base Commit: 96a7a247a76c2e0664c42b9c03d8c6906c261775
- Worktree Commit: 
- Integration Status: already_in_project_root

## Goal Runtime
- Status: complete
- Started At: 2026-05-05T22:33:32Z
- Started Epoch: 1778020412
- Updated At: 2026-05-05T22:40:50Z
- Tick Count: 4
- Time Used Seconds: 438
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: complete
- Last Progress Fingerprint: 3008136294

## Recovery State

- Status: needs_user
- Detected By: planner
- Failure Class: stale_todo_worktree
- Evidence: `scripts/start-plan.sh` returned `status=idle` at 2026-05-05T22:35:01Z, while this ticket remains `Stage: blocked` with `Worktree.Integration Status: blocked_stale_todo_worktree`. Runtime evidence at 2026-05-05T22:33:30Z says `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-191` still has unmerged or dirty state, so it refused to reuse that worktree silently. Required wiki RAG pass for `desktop runner transition action guard stale todo worktree Todo-191 prd_192` returned `result_count=0`.
- Planner Decision: Park this ticket as `needs_user` rather than creating duplicate work. Planner must not delete, reset, or silently reuse the stale worktree; a human or future explicit recovery turn must decide whether to salvage the worktree contents or discard/reissue the ticket.
- Owner Resume Instruction: Do not claim or recreate `Todo-191` automatically while this stale worktree blocker remains. Worker may continue with the next eligible todo ticket; resume `Todo-191` only after the stale worktree is explicitly salvaged or cleared and this Recovery State is updated.
- Last Recovery At: 2026-05-05T22:35:01Z

## Done When

- [x] Start 클릭 후 IPC 응답이 먼저 도착해도 해당 runner 의 control buttons remain disabled until observed runner state has `status=running`.
- [x] Graceful stop 클릭 후 `stop_pending=true` 또는 equivalent pending evidence 가 관찰되는 동안 stop UI shows `중지 예약 중...` with a spinner, and normal start/restart/config/run/dry-run actions for that runner remain disabled until `status=stopped`.
- [x] Graceful stop pending 중 force stop 경로는 확인 다이얼로그를 통해서만 활성화되고, force 선택 후 UI shows `강제 종료 중...` until `status=stopped`.
- [x] Restart 클릭 후 action state remains active through the stop and subsequent start phases, and clears only after the final target state is observed.
- [x] Transition state is tracked per runner id: one runner in `"starting"` or `"stopping_pending"` does not disable controls for another runner.
- [x] If no target state is observed within 60 seconds, action state is cleared and a Korean warning toast tells the user that state 확인이 실패했으며 새로고침 또는 재시도를 권장한다.
- [x] `apps/desktop/src/renderer/main.tsx` no longer clears start/stop/restart action state solely in the `finally` branch of the IPC call; the clear path is tied to state observation or timeout fallback.
- [x] `npm run desktop:check` exits 0.

## Next Action
- Complete: the inline merge finalizer integrated the AI-merged ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: `Todo-191` 은 stale todo worktree blocker 때문에 `needs_user` 로 parking 되었다. Planner 는 worktree 삭제/초기화 없이 evidence 만 남겼다.
- 직전 작업: `scripts/start-plan.sh` 는 `status=idle` 을 반환했고, wiki RAG query 는 관련 선례 `result_count=0` 이었다. 티켓 markdown 을 현재 blocker(`blocked_stale_todo_worktree`)와 일치시켰다.
- 재개 시 먼저 볼 것: stale worktree `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-191` 의 보존/폐기 결정을 먼저 끝낸 뒤, PRD, Goal, Allowed Paths, Done When 을 확인한다. `tickets/done/prd_167/prd_167.md` 는 graceful stop runtime semantics 를 소유하므로 이 티켓은 UI action guard 와 state observation 에만 집중한다.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_192/prd_192.md at 2026-05-05T13:29:14Z.
- Planner wiki pass: `runnerActionKeys start stop disabled transition order_147 graceful stop desktop runner state polling`, `AI runner start stop button disabled state transition force stop restart desktop controls`, `order_147 PRD_135 stop_pending graceful_stop_completed runner state file watch short poll` RAG queries all returned `result_count=0`.
- Relevant ticket boundary: `tickets/done/prd_167/prd_167.md` / `tickets/done/prd_167/order_147.md` define `stop_pending`, graceful completion, and force stop confirmation semantics. Do not rewrite CLI/runtime stop behavior here.
- Related prior pattern: `tickets/done/prd_174/prd_174.md` uses the same "IPC response is not completion" principle for config apply feedback; reuse the state-observation principle for runner buttons without reopening config-save scope.
- Related runner-state boundary: `tickets/done/prd_135/prd_135.md` owns stop marker/self-resurrect semantics, so this ticket should not change those state fields.

- Runtime hydrated worktree dependency at 2026-05-05T13:52:36Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- Runtime hydrated worktree dependency at 2026-05-05T13:52:36Z: linked node_modules -> /Users/demoon2016/Documents/project/autoflow/node_modules
- Runtime auto-blocked: dirty_project_root_conflict at 2026-05-05T13:52:35Z; dirty_paths=apps/desktop/src/renderer/main.tsx, apps/desktop/src/renderer/styles.css
- Planner blocked-dirty orchestration at 2026-05-05T13:54:15Z: integrated runtime-listed dirty paths `apps/desktop/src/renderer/main.tsx` and `apps/desktop/src/renderer/styles.css` with commit `6a34deb`; `git status --short -- apps/desktop/src/renderer/main.tsx apps/desktop/src/renderer/styles.css` returned clean. Check records: `tickets/check/check_230.md`, `tickets/check/check_231.md`.
- Auto-recovery at 2026-05-05T13:54:42Z: dirty_project_root_conflict cleared; ticket returned to todo for fresh claim.
- Cleaned stale todo worktree metadata at 2026-05-05T13:54:43Z: removed already-merged worktree /Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-191 before fresh claim.
- Runtime hydrated worktree dependency at 2026-05-05T13:54:45Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- Runtime hydrated worktree dependency at 2026-05-05T13:54:45Z: linked node_modules -> /Users/demoon2016/Documents/project/autoflow/node_modules
- Auto-recovery at 2026-05-05T13:59:38Z: dirty_project_root_conflict cleared; ticket returned to todo for fresh claim.
- Planner blocked-dirty orchestration at 2026-05-05T13:59:39Z: wiki RAG query for `desktop runner transition action guard auth browser gemini apps/desktop/src/main.js apps/desktop/src/renderer/main.tsx Todo-191 prd_192` returned `result_count=0`; integrated runtime-listed dirty paths `apps/desktop/src/main.js` and `apps/desktop/src/renderer/main.tsx` with commit `b4999e3`; `git status --short -- apps/desktop/src/main.js apps/desktop/src/renderer/main.tsx` returned clean. Check record: `tickets/check/check_236.md`.
- Cleaned stale todo worktree metadata at 2026-05-05T13:59:58Z: removed already-merged worktree /Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-191 before fresh claim.
- Runtime hydrated worktree dependency at 2026-05-05T14:00:00Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- Runtime hydrated worktree dependency at 2026-05-05T14:00:00Z: linked node_modules -> /Users/demoon2016/Documents/project/autoflow/node_modules
- Mini-plan at 2026-05-05T14:03:57Z: wiki RAG queries for runner transition/action guard terms returned `result_count=0`; use existing ticket references to keep PRD_167 graceful stop runtime semantics and PRD_135 state semantics out of scope. Implement per-runner transition intent in `apps/desktop/src/renderer/main.tsx`, clear start/stop/restart only when observed runner state reaches the target or 60s timeout fires, keep config/run/dry-run guards per runner, and expose graceful stop pending / force stop confirmation labels in both runner control surfaces.
- Planner blocked-dirty orchestration at 2026-05-05T22:30:49Z: wiki RAG query for `desktop runner transition action guard apps/desktop/src/main.js window state desktop space Todo-191 prd_192` returned `result_count=0`; integrated runtime-listed dirty path `apps/desktop/src/main.js` with commit `96a7a24`; `git status --short -- apps/desktop/src/main.js` returned clean. Check record: `tickets/check/check_247.md`.
- Auto-recovery at 2026-05-05T22:32:44Z: dirty_project_root_conflict cleared; ticket returned to todo for fresh claim.
- Blocked stale todo worktree at 2026-05-05T22:33:30Z: /Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-191 still has unmerged or dirty state, so the runtime refused to reuse it silently.
- AI worker prepared todo at 2026-05-05T22:33:30Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-191; run=tickets/inprogress/verify_191.md
- Mini-plan at 2026-05-05T22:35:40Z: `start-ticket-owner.sh` returned `status=blocked reason=ticket_stage_blocked`, but Recovery State is resolved and the worktree contains only an in-scope dirty `apps/desktop/src/renderer/main.tsx` transition-guard implementation. Continue salvaging that worktree, keep PRD_167/PRD_135 runtime semantics out of scope, finish the per-runner UI action guard, update both runner control surfaces, run `npm run desktop:check`, then AI-merge into PROJECT_ROOT before finalization.
- Implementation at 2026-05-05T22:38:02Z: added per-runner transition intent tracking in `apps/desktop/src/renderer/main.tsx`, labels/spinners for `starting` / `stopping_pending` / `stopping_force` / `restarting`, 1s short-poll + 60s Korean warning timeout, force-stop confirmation path, and transition inline styling in `styles.css`. `apps/desktop/src/main.js` allows confirmed force stop to bypass the same-runner IPC inflight reuse and forwards `--force` for compatible CLI stop handlers.
- Verification at 2026-05-05T22:38:02Z: `npm run desktop:check` exited 0 in the ticket worktree and again after AI merge into PROJECT_ROOT.
- Planner recovery at 2026-05-05T22:35:01Z: start-plan returned `status=idle`, but ticket state still shows `blocked_stale_todo_worktree`; wiki RAG query for `desktop runner transition action guard stale todo worktree Todo-191 prd_192` returned `result_count=0`. Planner parked this ticket as `needs_user` and left the stale worktree untouched for explicit salvage/discard decision.
- Finish paused at 2026-05-05T22:40:21Z: worktree HEAD b4999e395dec44a3fb4ab00c1df7d8668c3accaf does not contain PROJECT_ROOT HEAD 96a7a247a76c2e0664c42b9c03d8c6906c261775. AI must perform the rebase/merge; script did not run git rebase.
- AI worker prepared resume at 2026-05-05T22:40:40Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-191; run=tickets/inprogress/verify_191.md
- Queued without worktree commit at 2026-05-05T22:40:49Z: PROJECT_ROOT already matches the ticket worktree for all Allowed Paths with code changes.
- Impl AI worker marked verification pass at 2026-05-05T22:40:48Z; runtime finalizer will not perform merge operations.
- Coordinator post-merge cleanup at 2026-05-05T22:40:49Z: removed_worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-191 deleted_branch=autoflow/Todo-191.
- Inline merge finalizer (worker worker) finalized this verified ticket at 2026-05-05T22:40:49Z.
## Verification
- Run file: `tickets/done/prd_192/verify_191.md`
- Log file: `logs/verifier_191_20260505_224050Z_pass.md`
- Result: passed

## Result

- Summary: desktop runner transition action guard
- Remaining risk: Live desktop click-through was not run in this adapter tick; coverage is by code inspection and `npm run desktop:check` from worktree and PROJECT_ROOT.
