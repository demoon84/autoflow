# Ticket

## Ticket

- ID: Todo-326
- PRD Key: prd_304
- Plan Candidate: Plan AI retry from tickets/done/prd_304/prd_304.md (origin=Todo-319, retry_count=1, fingerprint=0e069e61a0fe)
- Title: sh to ts 전환 3단계 planner start-plan 실제 이관 retry
- Priority: normal
- Change Type: infra
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-12T12:10:53Z

## Goal

`Todo-319`에서 구현/검증한 planner `start-plan` TypeScript 이관을 현재 PROJECT_ROOT 상태에 맞춰 다시 완료한다. 직전 실패 원인은 `dirty_project_root_conflict`였고 충돌 경로는 `.autoflow/scripts/start-plan.ts`였으므로, worker는 allowed paths의 현재 dirty 상태를 먼저 검토하고 필요한 변경만 재적용하거나 이미 반영된 상태를 증거로 남긴 뒤 pass finalizer를 호출한다.

## References

- PRD: tickets/done/prd_304/prd_304.md
- Feature PRD:
- Plan:

## Reference Notes

- Project Note: [[prd_304]], original acceptance basis [[prd_297]]
- Plan Note:
- Ticket Note: origin=Todo-319, failure_class=dirty_project_root_conflict, retry_fingerprint=0e069e61a0fe, retry_count=1/3

## Allowed Paths

- `.autoflow/scripts/start-plan.sh`
- `.autoflow/scripts/start-plan.ts`
- `.autoflow/scripts/start-plan.legacy.sh`
- `.autoflow/scripts/board-utils.ts`
- `.autoflow/scripts/promote-order-to-ticket.ts`
- `runtime/board-scripts/start-plan.sh`
- `runtime/board-scripts/start-plan.ts`
- `runtime/board-scripts/start-plan.legacy.sh`
- `tests/smoke`

## Worktree

- Branch:
- Path:
- Base:
- Created At:

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
- Last Lint Status:
- Last Lint Vagueness Score:

## Recovery State

- Status: healthy
- Detected By: planner board-guard at 2026-05-12T12:10:53Z
- Failure Class: tooling_failure
- Evidence: `./bin/autoflow guard . .autoflow` reported `warning.1=autoflow/tickets_319 has a ticket worktree but no board ticket: /Users/demoon/Library/Caches/autoflow/worktrees/autoflow/tickets_319`.
- Planner Decision: keep the retry as `Todo-326`; planner does not delete or reuse the leftover `tickets_319` worktree.
- Owner Resume Instruction: create and use a fresh `Todo-326` worktree. Do not resume `/Users/demoon/Library/Caches/autoflow/worktrees/autoflow/tickets_319`.
- Last Recovery At: 2026-05-12T12:10:53Z

## Done When

- [ ] `start-plan.ts`가 planner orchestration의 primary implementation으로 동작한다.
- [ ] retry/order/backlog/express promotion 로직이 TS 경로로 유지된다.
- [ ] `status/source/todo_ticket/reason/next_action` 출력 계약이 유지된다.
- [ ] priority ordering, express order, retry order, backlog-first 정책이 보존된다.
- [ ] active/runtime `start-plan*` mirror가 동기화된다.
- [ ] pass 직전 allowed paths의 `git status --short`와 `.autoflow/scripts/start-plan.ts` dirty conflict 안전성 검토 결과가 Notes 또는 Verification에 남는다.
- [ ] `find .autoflow/scripts runtime/board-scripts -maxdepth 1 -type f -name 'start-plan*.sh' -exec bash -n {} \; && node --check .autoflow/scripts/start-plan.ts && AUTOFLOW_BACKGROUND=1 AUTOFLOW_ROLE=plan AUTOFLOW_WORKER_ID=planner ./.autoflow/scripts/start-plan.sh 999999`가 통과한다.
- [ ] `tests/smoke/start-plan-ts-smoke.sh`가 통과한다.

## Next Action

worker가 이 티켓을 claim한 뒤 원 PRD/Todo evidence를 읽고, 현재 PROJECT_ROOT allowed paths dirty 상태를 확인한 다음 필요한 hunk만 재적용한다. worktree와 PROJECT_ROOT 검증을 모두 통과시킨 뒤 pass finalizer를 호출한다.

## Resume Context

- Current state: planner가 retry order를 새 PRD/todo로 승격했다.
- Last completed action: `order_319_retry_1_20260512T120816Z.md`의 dirty conflict evidence를 `prd_304` / `Todo-326`에 반영했다.
- First thing to inspect on resume: `tickets/done/prd_297/prd_297.md`, `tickets/done/prd_304/order_319_retry_1_20260512T120816Z.md`, 현재 `git status --short -- .autoflow/scripts/start-plan.ts .autoflow/scripts/start-plan.sh .autoflow/scripts/start-plan.legacy.sh runtime/board-scripts/start-plan.ts runtime/board-scripts/start-plan.sh runtime/board-scripts/start-plan.legacy.sh tests/smoke`.

## Notes

- Mini-plan: ① origin ticket/PRD evidence 확인 ② allowed paths dirty 상태 확인 ③ start-plan TS 이관 hunk 재적용 또는 이미 반영 증거 기록 ④ worktree와 PROJECT_ROOT에서 verification 실행 ⑤ finalizer staging 안전성 확인 후 pass.
- Progress: generated from retry order `order_319_retry_1_20260512T120816Z.md`.
- Planner wiki pass: RAG query returned `result_count=0`; embedded retry evidence and `prd_297` are the authoritative context.
- Planner guard note: old `tickets_319` worktree is a cleanup candidate only; worker should use a fresh `Todo-326` worktree.

## Verification

- Command: `find .autoflow/scripts runtime/board-scripts -maxdepth 1 -type f -name 'start-plan*.sh' -exec bash -n {} \; && node --check .autoflow/scripts/start-plan.ts && AUTOFLOW_BACKGROUND=1 AUTOFLOW_ROLE=plan AUTOFLOW_WORKER_ID=planner ./.autoflow/scripts/start-plan.sh 999999`
- Command: `tests/smoke/start-plan-ts-smoke.sh`
- Run file:
- Result:

## Result

- Summary:
- Commit:

## Path Notes

- `References` are relative to `BOARD_ROOT`.
- `Allowed Paths` are relative to the implementation worktree root. If no worktree exists, they fall back to `PROJECT_ROOT`.
- `Plan Candidate` must copy the exact candidate text from `Execution Candidates`. It is a duplicate-detection key.
