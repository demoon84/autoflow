# Ticket

## Ticket

- ID: tickets_172
- PRD Key: prd_173
- Plan Candidate: Plan AI handoff from tickets/done/prd_173/prd_173.md
- Title: desktop readBoard subcall timeout isolation
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-04T21:50:44Z

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

- Path:
- Branch:
- Base Commit:
- Worktree Commit:
- Integration Status: pending_claim

## Goal Runtime

- Status:
- Started At:
- Started Epoch:
- Updated At:
- Tick Count: 0
- Time Used Seconds: 0
- Token Budget:
- Tokens Used:
- Continuation Suppressed: false
- Last Event:
- Last Progress Fingerprint:
- Iteration Fingerprints: []
- Last Lint Status: ok
- Last Lint Vagueness Score: 0

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [ ] `apps/desktop/src/main.js`의 `readBoard` 내부 6개 진단 호출은 `Promise.allSettled` 또는 동등한 safe wrapper를 사용해 단일 rejected promise가 전체 `autoflow:readBoard` IPC reject로 이어지지 않는다.
- [ ] `status`, runner list, `doctor`, `metrics`, `stop-hook-status`, `watch-status` 각각은 개별 timeout(기본 15000ms 안팎) 또는 공유 helper를 통해 handler-level 30000ms보다 짧게 fallback result를 반환한다.
- [ ] timeout 또는 reject가 난 diagnostic result는 `ok: false` 또는 `partial/fallback` 계열 field, `cancelled`/`signal`/`stderr` 증거, source 이름을 포함해 `readBoardMeta.fallbackSources`에서 식별된다.
- [ ] 한 diagnostic refresh가 timeout되어도 나머지 성공/캐시/파일 목록 결과는 board snapshot에 유지되고, renderer는 빈 전체 board 대신 부분 board를 받을 수 있다.
- [ ] 기존 `readBoard` stale cache와 inflight refresh guard는 유지되며, `prd_140`의 `partial`, `fallback`, `stale`, `refreshInFlight`, `readBoardFallback`, top-level `readBoardMeta` 의미가 제거되지 않는다.
- [ ] standalone `autoflow:listRunners` IPC의 TTL/inflight guard와 timeout cleanup은 `prd_144`의 완료 범위를 유지하며, 이번 변경이 그 경로를 다시 direct spawn 구조로 되돌리지 않는다.
- [ ] `npm run desktop:check` exits 0.

## Next Action

- 다음에 바로 이어서 할 일: Impl AI 는 이 티켓을 todo 에서 claim 한 뒤 `apps/desktop/src/main.js`의 `readBoard`, `runAutoflowCachedOrRefresh`, `listRunnersCachedOrRefresh`, `withTimeout`/`timeoutSignal` 경로를 먼저 읽고, `Promise.all` 단일 reject 의존 제거와 개별 diagnostic refresh timeout을 Allowed Paths 안에서 구현한다.

## Resume Context

- 현재 상태 요약: Plan AI 가 `tickets/inbox/order_153.md`를 `tickets/done/prd_173/prd_173.md`로 승격하고 이 todo 티켓을 생성했다.
- 직전 작업: `.autoflow/scripts/start-plan.sh` first returned `source=order-inbox`, `order_id=153`; after PRD creation, `.autoflow/scripts/start-plan.sh 173` returned `source=backlog-to-todo`, `lint_status=ok`, `lint_vagueness_score=0`, and created `tickets_172.md`.
- 재개 시 먼저 볼 것: `tickets/done/prd_173/prd_173.md`, `tickets/done/prd_173/order_153.md`, `apps/desktop/src/main.js`의 `readBoard`, `runAutoflowCachedOrRefresh`, `listRunnersCachedOrRefresh`, `runAutoflowArgs`, `withTimeout`, `attachTimeoutSignal`.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_173/prd_173.md at 2026-05-04T21:50:44Z.
- Wiki exact query `bin/autoflow wiki query --term "readBoard IPC timeout Promise.allSettled desktop main.js" --rag` returned `result_count=0`.
- Wiki broader query `bin/autoflow wiki query --term "readBoard" --term "IPC timeout" --term "listRunners" --term "apps/desktop/src/main.js" --rag` returned prior related work. Use these as constraints, not completion proof: `tickets/done/prd_140/prd_140.md` completed readBoard stale fallback and top-level `readBoardMeta`; `tickets/done/prd_104/prd_104.md` handled metrics cold-start fallback; `tickets/done/prd_144/prd_144.md` completed standalone `autoflow:listRunners` fork-bomb guard.
- Repository context at planning time: current `apps/desktop/src/main.js` still awaits the six readBoard diagnostic promises together around line 2346 and background refresh helpers start subprocess promises without a per-refresh timeout specific to those readBoard diagnostics.
- Scope constraint: preserve `prd_140` fallback metadata fields (`partial`, `fallback`, `stale`, `refreshInFlight`, `readBoardFallback`, top-level `readBoardMeta`) and do not broaden into `packages/cli/runners-project.sh` or renderer/preload changes.
- Guard after ticket creation returned `status=warning`, `error_count=0`, `warning_count=2`; unresolved cleanup candidates are the existing `tickets_119` leftover worktree with no board ticket and dirty done-ticket worktree for `tickets/done/prd_164/tickets_163.md`. Planner did not delete, reset, or manage those worktrees.

## Verification

- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
