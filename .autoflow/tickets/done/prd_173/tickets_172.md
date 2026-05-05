# Ticket

## Ticket

- ID: tickets_172
- PRD Key: prd_173
- Plan Candidate: Plan AI handoff from tickets/done/prd_173/prd_173.md
- Title: desktop readBoard subcall timeout isolation
- Stage: done
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI: worker
- Last Updated: 2026-05-05T10:54:49Z

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
- Integration Status: integrated

## Goal Runtime
- Status: complete
- Started At: 2026-05-05T02:10:05Z
- Started Epoch: 1777947005
- Updated At: 2026-05-05T10:54:49Z
- Tick Count: 2
- Time Used Seconds: 16484
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: pass
- Last Progress Fingerprint: 2164060142

## Recovery State

- Status: resolved
- Detected By: runtime; planner
- Failure Class: fixed
- Evidence: Direct cleanup integrated the preserved `tickets_172` worktree implementation into `apps/desktop/src/main.js`: readBoard diagnostics now use `Promise.allSettled`, runner diagnostics use the same readBoard diagnostic timeout wrapper, fallback metadata includes source/ok/cancelled/signal/stderr/command evidence, and stale/inflight fallback semantics are preserved.
- Planner Decision: Recovery completed by direct owner cleanup; no further blocked-dirty orchestration is needed for this ticket.
- Owner Resume Instruction: None. Ticket is complete and archived to done.
- Last Recovery At: 2026-05-05T10:54:49Z

## Done When

- [x] `apps/desktop/src/main.js`의 `readBoard` 내부 6개 진단 호출은 `Promise.allSettled` 또는 동등한 safe wrapper를 사용해 단일 rejected promise가 전체 `autoflow:readBoard` IPC reject로 이어지지 않는다.
- [x] `status`, runner list, `doctor`, `metrics`, `stop-hook-status`, `watch-status` 각각은 개별 timeout(기본 15000ms 안팎) 또는 공유 helper를 통해 handler-level 30000ms보다 짧게 fallback result를 반환한다.
- [x] timeout 또는 reject가 난 diagnostic result는 `ok: false` 또는 `partial/fallback` 계열 field, `cancelled`/`signal`/`stderr` 증거, source 이름을 포함해 `readBoardMeta.fallbackSources`에서 식별된다.
- [x] 한 diagnostic refresh가 timeout되어도 나머지 성공/캐시/파일 목록 결과는 board snapshot에 유지되고, renderer는 빈 전체 board 대신 부분 board를 받을 수 있다.
- [x] 기존 `readBoard` stale cache와 inflight refresh guard는 유지되며, `prd_140`의 `partial`, `fallback`, `stale`, `refreshInFlight`, `readBoardFallback`, top-level `readBoardMeta` 의미가 제거되지 않는다.
- [x] standalone `autoflow:listRunners` IPC의 TTL/inflight guard와 timeout cleanup은 `prd_144`의 완료 범위를 유지하며, 이번 변경이 그 경로를 다시 direct spawn 구조로 되돌리지 않는다.
- [x] `npm run desktop:check` exits 0.

## Next Action
- Completed: readBoard diagnostic isolation is integrated into main and verified with `npm --prefix apps/desktop run check`.

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
- Planner blocked-dirty orchestration 2026-05-05T07:20:45Z: `start-plan.sh` returned `source=blocked-dirty-orchestration`, `blocked_origin=tickets/inprogress/tickets_172.md`, `dirty_path_count=7`, and `cleanup_commit_policy=single_housekeeping_commit_per_tick`. Wiki query `bin/autoflow wiki query --term "desktop readboard subcall timeout isolation tickets_172 dirty_root orchestration cleanup" --rag` returned `result_count=0`. Planner created cleanup commit `89b3a62`; follow-up `git status --short` shows residual untracked `tests/smoke/runner-realtime-event-driven-smoke.sh` for next-tick orchestration. Check evidence: `tickets/check/check_211.md`, `tickets/check/check_212.md`.
- Planner blocked-dirty orchestration 2026-05-05T16:26:00+09:00: `start-plan.sh` returned `source=blocked-dirty-orchestration`, `blocked_origin=tickets/inprogress/tickets_172.md`, `dirty_path_count=8`, and `cleanup_commit_policy=single_housekeeping_commit_per_tick`; runtime also produced `tickets/check/check_215.md` and skill extraction `desktop-readboard-subcall-timeout-isolation-8`. Wiki RAG returned `result_count=0`. Planner created cleanup commit `a693f20`; follow-up `git status --short` shows residual runtime follow-up evidence `tickets/check/check_216.md` and `desktop-readboard-subcall-timeout-isolation-9/` for the next tick.
## Verification
- Run file: `tickets/done/prd_173/verify_172.md`
- Log file: desktop check output
- Result: passed direct cleanup at 2026-05-05T10:54:49Z

## Result

- Summary: readBoard no longer lets one diagnostic subprocess rejection reject the entire IPC result; fallback evidence is exposed in `readBoardMeta.fallbackSources`.
- Remaining risk: GUI timing was not separately exercised after runners remain stopped; static desktop build passed.
