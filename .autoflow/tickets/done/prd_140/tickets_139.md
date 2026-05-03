# Ticket

## Ticket

- ID: tickets_139
- PRD Key: prd_140
- Plan Candidate: Plan AI handoff from tickets/done/prd_140/prd_140.md
- Title: Desktop readBoard IPC timeout graceful fallback
- Stage: done
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI: worker
- Last Updated: 2026-05-03T10:55:38Z

## Goal

- 이번 작업의 목표: 데스크톱 보드 화면이 `autoflow:readBoard` IPC timeout 때문에 자동화 흐름을 전혀 보여주지 못하는 상태를 막고, 오래된 값이나 부분 값이라도 30초 안에 렌더링할 수 있게 한다.

## References

- PRD: tickets/done/prd_140/prd_140.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_140]]
- Plan Note:
- Ticket Note: [[tickets_139]]

## Allowed Paths

- `apps/desktop/src/main.js`

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_139`
- Branch: autoflow/tickets_139
- Base Commit: 53ffb029d0178e211a23616c84e22570684d7b01
- Worktree Commit: 
- Integration Status: already_in_project_root

## Goal Runtime
- Status: complete
- Started At: 2026-05-03T10:49:02Z
- Started Epoch: 1777805342
- Updated At: 2026-05-03T10:55:40Z
- Tick Count: 5
- Time Used Seconds: 398
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: complete
- Last Progress Fingerprint: 286745627

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [x] `apps/desktop/src/main.js`의 `readBoard`가 `status`, `doctor`, `metrics`, `stop-hook-status`, `watch-status`, 그리고 `readBoard` 내부 runner list 데이터를 stale-while-revalidate 또는 bounded fallback 경로로 수집한다.
- [x] cache miss 또는 refresh in-flight 상태에서도 `readBoard`는 안전한 빈 값이나 직전 stale 값을 포함한 객체를 반환하며, 느린 CLI sub-call 하나 때문에 전체 `autoflow:readBoard` IPC가 reject되지 않는다.
- [x] 같은 project root / board dir / command key에 대해 concurrent `readBoard` 호출이 동일 background refresh promise를 공유하거나 새 spawn을 만들지 않도록 inflight guard가 있다.
- [x] fallback을 사용한 응답에는 `partial`, `stale`, `fallback`, 또는 이와 동등한 machine-readable marker가 포함되어 UI/로그에서 stale 응답 여부를 확인할 수 있다.
- [x] 기존 action IPC(`autoflow:controlRunner`, `autoflow:runRole`, install/configure/write 계열)의 장시간 실행 정책은 변경하지 않는다.
- [x] `npm run desktop:check` exits 0.

## Next Action
- Complete: the inline merge finalizer integrated the AI-merged ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: Plan AI 가 `order_132`를 `prd_140`과 `tickets_139`로 승격했다.
- 직전 작업: `start-plan.sh 140`이 `prd_140`을 `tickets/done/prd_140/prd_140.md`로 보관하고 `tickets/todo/tickets_139.md`를 만들었다.
- 재개 시 먼저 볼 것: PRD, Goal, Allowed Paths, Done When, 그리고 `apps/desktop/src/main.js`의 `readBoard`, `runAutoflowCached`, `runAutoflowCachedOrRefresh`, `listRunners`, `withTimeout`.
- Wiki/ticket constraints: wiki RAG 결과는 0건이었다. `order_133`(doctor/metrics CLI lock), `order_134`(bash/awk process leak), `order_136`(standalone `listRunners` IPC fork-bomb)은 별도 후속 order로 남아 있으므로 이 ticket은 `readBoard` 내부 fallback과 중복 refresh 억제에 집중한다.
- Guard warning: `bin/autoflow guard` at 2026-05-03T10:48:15Z reported leftover ticket worktree `autoflow/tickets_119`; planner recorded it as an unrelated cleanup candidate and did not delete or reset the worktree.
- 구현/검증 완료: worktree와 PROJECT_ROOT의 `apps/desktop/src/main.js`가 동일하며, 양쪽에서 `npm run desktop:check`가 exit 0으로 통과했다. 다음 owner 동작은 finish finalizer 실행만 남았다.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_140/prd_140.md at 2026-05-03T10:48:03Z.
- Planner wiki pass: `bin/autoflow wiki query --term "readBoard IPC timeout stale-while-revalidate" --term "doctor metrics lock desktop-cache" --term "listRunners runners-project.sh list fork-bomb" --term "apps/desktop/src/main.js readBoard listRunners runAutoflow" --limit 8 --rag` returned `result_count=0`.
- Repository context: `apps/desktop/src/main.js` currently wraps `autoflow:readBoard` with `withTimeout(..., 30000)`, and `readBoard` waits for `runAutoflow("status")`, `listRunners(...)`, `runAutoflowCached("doctor")`, `runAutoflowCachedOrRefresh("metrics")`, `runAutoflow("stop-hook-status")`, and `runAutoflow("watch-status")` before listing board files.
- Planning constraint: keep this ticket separate from pending `order_133`, `order_134`, and `order_136`; this ticket may bound/cache the runner list used inside `readBoard`, but should not broaden into a full standalone `autoflow:listRunners` redesign.
- Guard result: `bin/autoflow guard` returned `status=warning`, `error_count=0`, `warning_count=1`; warning was the unrelated leftover worktree `autoflow/tickets_119`.

- Runtime hydrated worktree dependency at 2026-05-03T10:49:01Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- AI worker prepared todo at 2026-05-03T10:49:01Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_139; run=tickets/inprogress/verify_139.md
- AI mini-plan at 2026-05-03T11:01:00Z:
  1. Keep scope to `apps/desktop/src/main.js` and only change `readBoard` read-path helpers, not action IPC timeout policy.
  2. Convert `status`, `doctor`, `metrics`, `stop-hook-status`, `watch-status`, and readBoard's internal runner list to stale-or-empty immediate results with per-project/board/command inflight refresh sharing.
  3. Add machine-readable fallback/stale/partial metadata on individual results and the returned board payload so renderer/logs can diagnose partial data.
  4. Run `npm run desktop:check`, then mirror the verified file into PROJECT_ROOT and rerun the same verification there before finish.
- Wiki context pass: `autoflow wiki query --term "readBoard IPC timeout stale-while-revalidate" --term "doctor metrics lock desktop-cache" --term "listRunners runners-project.sh list fork-bomb" --term "apps/desktop/src/main.js readBoard listRunners runAutoflow" --limit 8 --rag` was started before implementation. Planner's prior wiki pass for the same terms returned `result_count=0`, so no prior wiki decision changes this mini-plan.
- AI worker prepared resume at 2026-05-03T10:52:46Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_139; run=tickets/inprogress/verify_139.md
- AI worker wiki context pass at 2026-05-03T10:54:57Z: host-board `autoflow wiki query /Users/demoon2016/Documents/project/autoflow .autoflow --rag --term "Desktop readBoard IPC timeout" --term "apps/desktop/src/main.js readBoard runAutoflowCached" --term "listRunners fallback inflight"` returned 1 result, `tickets/done/prd_140/prd_140.md`, which matches the active PRD and adds no extra constraints.
- AI worker implementation evidence: `apps/desktop/src/main.js` now uses `runAutoflowCachedOrRefresh` for `status`, `doctor`, `metrics`, `stop-hook-status`, and `watch-status`; `listRunnersCachedOrRefresh` provides readBoard-only runner list fallback with a per project root / board dir inflight promise; fallback responses include `partial`, `fallback`, `stale`, `refreshInFlight`, `cacheStatus`, `readBoardFallback`, and top-level `readBoardMeta`.
- AI worker merge evidence: `diff -u PROJECT_ROOT/apps/desktop/src/main.js WORKTREE/apps/desktop/src/main.js` returned no differences before PROJECT_ROOT verification.
- Queued without worktree commit at 2026-05-03T10:55:38Z: PROJECT_ROOT already matches the ticket worktree for all Allowed Paths with code changes.
- Impl AI worker marked verification pass at 2026-05-03T10:55:38Z; runtime finalizer will not perform merge operations.
- Coordinator post-merge cleanup at 2026-05-03T10:55:38Z: removed_worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_139 deleted_branch=autoflow/tickets_139.
- Inline merge finalizer (worker worker) finalized this verified ticket at 2026-05-03T10:55:38Z.
## Verification
- Run file: `tickets/done/prd_140/verify_139.md`
- Log file: `logs/verifier_139_20260503_105540Z_pass.md`
- Result: passed

## Result

- Summary: readBoard stale fallback and inflight refresh guard
- Remaining risk: First render after a cold cache may show partial empty diagnostic/runner fields until background refresh completes, which is intentional for this ticket.
