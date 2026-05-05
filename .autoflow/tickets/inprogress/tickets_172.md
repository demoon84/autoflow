# Ticket

## Ticket

- ID: tickets_172
- PRD Key: prd_173
- Plan Candidate: Plan AI handoff from tickets/done/prd_173/prd_173.md
- Title: desktop readBoard subcall timeout isolation
- Stage: blocked
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI: worker
- Last Updated: 2026-05-05T07:12:23Z

## Goal

- 이번 작업의 목표: 데스크톱 main process의 `autoflow:readBoard`가 cold-start 또는 main.js reload 직후 한 CLI subprocess 지연/중단 때문에 30초 IPC timeout으로 reject되지 않도록, 내부 진단 호출을 개별 timeout과 부분 실패 허용 구조로 격리한다.

## References

- PRD: tickets/done/prd_173/prd_173.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_173]]
- Plan Note:
- Ticket Note: [[tickets_172]]

## Allowed Paths

- `apps/desktop/src/main.js`

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_172`
- Branch: autoflow/tickets_172
- Base Commit: dc9151ba1566b32c7a04ebbe026599898c939058
- Worktree Commit: 
- Integration Status: blocked_dirty_project_root

## Goal Runtime
- Status: blocked
- Started At: 2026-05-05T02:10:05Z
- Started Epoch: 1777947005
- Updated At: 2026-05-05T06:44:49Z
- Tick Count: 2
- Time Used Seconds: 16484
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: true
- Last Event: ticket_stage_blocked
- Last Progress Fingerprint: 2164060142

## Recovery State

- Status: repairing
- Detected By: runtime; planner
- Failure Class: dirty_root
- Evidence: `start-plan.sh` returned `source=blocked-dirty-orchestration` for `tickets/inprogress/tickets_172.md` with `dirty_paths` including `apps/desktop/src/main.js` and mixed board/runtime/wiki/check-ledger files. Planner ran `git status --short`, staged the dirty inventory, and created local cleanup commit `d3c498a` (`[PRD_173][tickets_172] orchestration cleanup: misc housekeeping (147 paths)`). Follow-up `git status --short` returned no output.
- Planner Decision: Treat the mixed dirty inventory as misc housekeeping for the blocked ticket and integrate it in one local orchestration cleanup commit. No new product code was authored in this planner turn.
- Owner Resume Instruction: Wait for the next planner tick to surface `source=blocked-auto-recover` and return this ticket to `tickets/todo/`; after that, ticket-owner should claim from current `main` and continue the `apps/desktop/src/main.js` readBoard timeout isolation work.
- Last Recovery At: 2026-05-05T07:12:23Z

## Done When

- [ ] `apps/desktop/src/main.js`의 `readBoard` 내부 6개 진단 호출은 `Promise.allSettled` 또는 동등한 safe wrapper를 사용해 단일 rejected promise가 전체 `autoflow:readBoard` IPC reject로 이어지지 않는다.
- [ ] `status`, runner list, `doctor`, `metrics`, `stop-hook-status`, `watch-status` 각각은 개별 timeout(기본 15000ms 안팎) 또는 공유 helper를 통해 handler-level 30000ms보다 짧게 fallback result를 반환한다.
- [ ] timeout 또는 reject가 난 diagnostic result는 `ok: false` 또는 `partial/fallback` 계열 field, `cancelled`/`signal`/`stderr` 증거, source 이름을 포함해 `readBoardMeta.fallbackSources`에서 식별된다.
- [ ] 한 diagnostic refresh가 timeout되어도 나머지 성공/캐시/파일 목록 결과는 board snapshot에 유지되고, renderer는 빈 전체 board 대신 부분 board를 받을 수 있다.
- [ ] 기존 `readBoard` stale cache와 inflight refresh guard는 유지되며, `prd_140`의 `partial`, `fallback`, `stale`, `refreshInFlight`, `readBoardFallback`, top-level `readBoardMeta` 의미가 제거되지 않는다.
- [ ] standalone `autoflow:listRunners` IPC의 TTL/inflight guard와 timeout cleanup은 `prd_144`의 완료 범위를 유지하며, 이번 변경이 그 경로를 다시 direct spawn 구조로 되돌리지 않는다.
- [ ] `npm run desktop:check` exits 0.

## Next Action
- Planner wait: cleanup commit `d3c498a` cleared the PROJECT_ROOT dirty overlap. Next planner tick should let runtime run blocked-auto-recover and requeue this ticket; owner should not bypass that board transition.

## Resume Context

- 현재 상태 요약: Plan AI 가 `tickets/inbox/order_153.md`를 `tickets/done/prd_173/prd_173.md`로 승격하고 이 todo 티켓을 생성했다.
- 직전 작업: `.autoflow/scripts/start-plan.sh` first returned `source=order-inbox`, `order_id=153`; after PRD creation, `.autoflow/scripts/start-plan.sh 173` returned `source=backlog-to-todo`, `lint_status=ok`, `lint_vagueness_score=0`, and created `tickets_172.md`.
- 재개 시 먼저 볼 것: `git status --short`, `apps/desktop/src/main.js` dirty overlap, `tickets/done/prd_173/prd_173.md`, `tickets/done/prd_173/order_153.md`, `apps/desktop/src/main.js`의 `readBoard`, `runAutoflowCachedOrRefresh`, `listRunnersCachedOrRefresh`, `runAutoflowArgs`, `withTimeout`, `attachTimeoutSignal`.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_173/prd_173.md at 2026-05-04T21:50:44Z.
- Wiki exact query `bin/autoflow wiki query --term "readBoard IPC timeout Promise.allSettled desktop main.js" --rag` returned `result_count=0`.
- Wiki broader query `bin/autoflow wiki query --term "readBoard" --term "IPC timeout" --term "listRunners" --term "apps/desktop/src/main.js" --rag` returned prior related work. Use these as constraints, not completion proof: `tickets/done/prd_140/prd_140.md` completed readBoard stale fallback and top-level `readBoardMeta`; `tickets/done/prd_104/prd_104.md` handled metrics cold-start fallback; `tickets/done/prd_144/prd_144.md` completed standalone `autoflow:listRunners` fork-bomb guard.
- Repository context at planning time: current `apps/desktop/src/main.js` still awaits the six readBoard diagnostic promises together around line 2346 and background refresh helpers start subprocess promises without a per-refresh timeout specific to those readBoard diagnostics.
- Scope constraint: preserve `prd_140` fallback metadata fields (`partial`, `fallback`, `stale`, `refreshInFlight`, `readBoardFallback`, top-level `readBoardMeta`) and do not broaden into `packages/cli/runners-project.sh` or renderer/preload changes.
- Guard after ticket creation returned `status=warning`, `error_count=0`, `warning_count=2`; unresolved cleanup candidates are the existing `tickets_119` leftover worktree with no board ticket and dirty done-ticket worktree for `tickets/done/prd_164/tickets_163.md`. Planner did not delete, reset, or manage those worktrees.

- Runtime hydrated worktree dependency at 2026-05-05T02:10:04Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- AI worker prepared todo at 2026-05-05T02:10:03Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_172; run=tickets/inprogress/verify_172.md
- AI worker prepared resume at 2026-05-05T02:10:36Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_172; run=tickets/inprogress/verify_172.md
- Mini-plan 2026-05-05T02:18Z: wiki query `autoflow wiki query --term "readBoard diagnostics timeout" --term "autoflow:readBoard" --term "prd_140 prd_144 listRunners" --rag` returned related done records `tickets/done/prd_140/prd_140.md`, `tickets/done/prd_104/tickets_100.md`, and `tickets/done/prd_144` context. Preserve `prd_140` top-level `readBoardMeta`/stale fields, keep `prd_144` standalone `autoflow:listRunners` TTL/inflight path, and apply the `prd_104` bounded fallback pattern to readBoard diagnostics only. Implementation steps: add a shared readBoard diagnostic timeout helper around cached background refreshes, convert readBoard diagnostic fan-out to all-settled safe result collection, and enrich `readBoardMeta.fallbackSources` with ok/cancelled/signal/stderr evidence.
- Runtime auto-blocked: dirty_project_root_conflict at 2026-05-05T02:13:50Z; dirty_paths=apps/desktop/src/main.js
- Planner recovery 2026-05-05T02:16:33Z: normalized guard-warning failure class `dirty_project_root_conflict` to `dirty_root` while preserving the original dirty path evidence. Guard cleanup candidates remain evidence-only: `autoflow/tickets_119` leftover worktree and dirty done-ticket worktree `autoflow/tickets_163`; planner did not delete or reset worktrees.
- Planner blocked-dirty orchestration 2026-05-05T07:12:23Z: `start-plan.sh` returned `source=blocked-dirty-orchestration`, `blocked_origin=tickets/inprogress/tickets_172.md`, and `dirty_path_count=146` with `cleanup_commit_policy=single_housekeeping_commit_per_tick`. Planner created cleanup commit `d3c498a`; `git status --short` was clean afterward. Check evidence: `tickets/check/check_207.md`.
## Verification
- Run file: `tickets/inprogress/verify_172.md`
- Log file: pending
- Result: pending ticket-owner by worker

## Result

- Summary:
- Remaining risk:
