# Ticket

## Ticket

- ID: tickets_175
- PRD Key: prd_176
- Plan Candidate: Plan AI handoff from tickets/done/prd_176/prd_176.md
- Title: autoflow recovery roadmap integration pass
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-04T22:13:36Z

## Goal

- 이번 작업의 목표: `tickets/inbox/order_154.md` 의 master roadmap 을 이미 생성된 개별 PRD/todo 와 충돌하지 않는 최종 integration pass 로 좁힌다. Worker 는 A1~A5, B1~B3 항목이 기존 PRD/ticket 으로 ticketized 된 범위를 재구현하지 않고, 코드와 보드에 남은 residual gap 만 Allowed Paths 안에서 보강한다.

## References

- PRD: tickets/done/prd_176/prd_176.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_176]]
- Plan Note:
- Ticket Note: [[tickets_175]]

## Allowed Paths

- `.autoflow/scripts/start-plan.sh`
- `.autoflow/scripts/common.sh`
- `.autoflow/scripts/start-ticket-owner.sh`
- `runtime/board-scripts/start-plan.sh`
- `runtime/board-scripts/common.sh`
- `runtime/board-scripts/start-ticket-owner.sh`
- `packages/cli/run-role.sh`
- `packages/cli/runners-project.sh`
- `packages/cli/wiki-project.sh`
- `runtime/board-scripts/run-role.sh`
- `runtime/board-scripts/runners-project.sh`
- `runtime/board-scripts/wiki-project.sh`
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

- [ ] `rg -n "blocked-cleanup|fixpoint|tickets/check|ticket_stage_blocked" .autoflow/scripts/start-plan.sh runtime/board-scripts/start-plan.sh packages/cli/run-role.sh` returns evidence for check-ledger live-lock prevention and stale worker-state reset hooks, or the ticket records why the existing PRD/ticket coverage is sufficient without a new patch.
- [ ] `rg -n "needs_user|repairing|Recovery State|active_item" .autoflow/scripts/start-plan.sh runtime/board-scripts/start-plan.sh packages/cli/run-role.sh` returns evidence for parked `needs_user` / stale `repairing` handling, or the ticket records the exact missing path fixed in this integration pass.
- [ ] `rg -n "ticket_stage_blocked|verify_.*md|self-refresh|dirty" .autoflow/scripts/start-ticket-owner.sh runtime/board-scripts/start-ticket-owner.sh packages/cli/run-role.sh` returns evidence that active ticket markdown self-refresh does not remain the only blocker signal.
- [ ] `rg -n "loop-worker|worktree|orphan|runner-common|process group|kill" packages/cli/runners-project.sh runtime/board-scripts/runners-project.sh` returns evidence for worktree-bound runner cleanup or self-exit handling. If the implementation uses a non-`kill` guard, the ticket explains the exact function and state key.
- [ ] `rg -n "DEBOUNCE|runner-timing|runner-health|prompt-evolution|output_truncated|adapter_finish|adapter_timeout|SIGTERM" packages/cli/run-role.sh runtime/board-scripts/run-role.sh packages/cli/wiki-project.sh runtime/board-scripts/wiki-project.sh` returns evidence for commit-throttle, wiki debounce, and adapter timeout classification.
- [ ] `rg -n "\\[wiki\\].*(PRD|ticket|source)|wiki knowledge update|source.*ticket|autocommit_message" packages/cli/wiki-project.sh packages/cli/run-role.sh runtime/board-scripts/run-role.sh runtime/board-scripts/wiki-project.sh` returns evidence that wiki commit/log attribution includes source PRD/ticket context, or the ticket records the exact fallback behavior when no source ticket can be inferred.
- [ ] `node --check apps/desktop/src/main.js` exits 0 and `rg -n "selfHealStoppedRunnersForScope|listRunnersCachedOrRefresh|knownProjectScopes|cooldown" apps/desktop/src/main.js` returns the self-heal cache/cooldown guard evidence.
- [ ] `bash -n` passes for every modified shell file in Allowed Paths.
- [ ] `bin/autoflow guard` exits 0 after implementation.

## Next Action

- 다음에 바로 이어서 할 일: Impl AI 는 이 티켓을 todo 에서 claim 한 뒤 `tickets/done/prd_176/prd_176.md`, `tickets/done/prd_176/order_157.md`, 관련 PRD/ticket evidence 를 먼저 대조한다. 이미 개별 티켓으로 처리된 A1~A5, B1~B3 범위는 재구현하지 말고, Allowed Paths 안에서 남은 residual connector gap, 특히 wiki commit source attribution gap 만 mini-plan / 구현 / 검증 / 머지까지 한 턴에 끝낸다.

## Resume Context

- 현재 상태 요약: Plan AI 가 backlog PRD 에서 todo 티켓을 생성한 직후.
- 직전 작업: scripts/start-plan.sh 가 PRD 를 done 으로 보관하고 todo 티켓을 만들었다.
- 재개 시 먼저 볼 것: PRD, Goal, Allowed Paths, Done When.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_176/prd_176.md at 2026-05-04T22:13:36Z.
- Planner guard evidence after creation: `bin/autoflow guard` returned `error_count=0`, `warning_count=2`.
- Guard warning cleanup candidates: `autoflow/tickets_119` has a ticket worktree but no board ticket; `autoflow/tickets_163` has a dirty worktree for done ticket `tickets/done/prd_164/tickets_163.md`.
- Planner decision: leave those worktrees untouched in this turn. They are cleanup candidates for recovery orchestration/user review, not implementation scope for `tickets_175` unless a later planner recovery turn explicitly assigns them.
- Planner dedupe 2026-05-05T01:33:49Z: `tickets/inbox/order_157.md` requested wiki commit source ticket attribution for `[wiki] wiki knowledge update` subjects. Wiki RAG returned `tickets/done/prd_183/prd_183.md`, which covers meaningful wiki commit gates but not explicit source ticket attribution. Because this ticket already owns the residual attribution acceptance item and overlaps the same runner/wiki paths, Plan AI archived `order_157` beside `prd_176` instead of creating a duplicate todo.

## Verification

- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
