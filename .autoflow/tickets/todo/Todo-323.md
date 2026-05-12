# Ticket

## Ticket

- ID: Todo-323
- PRD Key: prd_301
- Plan Candidate: Plan AI retry from tickets/done/prd_301/prd_301.md (origin=Todo-316, retry_count=1, fingerprint=38dc2d08b6e4)
- Title: sh to ts 전환 0단계 기반 정리 retry
- Priority: normal
- Change Type: infra
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-12T10:44:22Z

## Goal

`Todo-316`에서 구현/검증한 sh→ts 0단계 기반 정리를 현재 PROJECT_ROOT 상태에 맞춰 다시 완료한다. 직전 실패 원인은 `dirty_project_root_conflict`였으므로, worker는 allowed paths의 현재 dirty 상태를 먼저 검토하고 필요한 변경만 재적용하거나 이미 반영된 상태를 증거로 남긴 뒤 pass finalizer를 호출한다.

## References

- PRD: tickets/done/prd_301/prd_301.md
- Feature PRD:
- Plan:

## Reference Notes

- Project Note: [[prd_301]], original acceptance basis [[prd_294]]
- Plan Note:
- Ticket Note: origin=Todo-316, failure_class=dirty_project_root_conflict, retry_fingerprint=38dc2d08b6e4, retry_count=1/3

## Allowed Paths

- `package.json`
- `package-lock.json`
- `packages/cli/package-board-common.sh`
- `packages/cli/doctor-project.sh`
- `runtime/board-scripts`
- `.autoflow/scripts`
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
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [ ] `packages/cli/package-board-common.sh`의 runtime asset 설치/upgrade 목록이 `.sh` wrapper companion인 `.ts`/`.js`/`.legacy.sh` 파일 누락 위험을 방지한다.
- [ ] `packages/cli/doctor-project.sh` 또는 smoke 검증이 `.sh` wrapper가 참조하는 companion 파일 누락을 감지한다.
- [ ] `.autoflow/scripts`와 `runtime/board-scripts`의 현재 `.sh` 전환 상태가 후속 worker가 볼 수 있게 분류된다.
- [ ] 후속 전환 순서가 작은 보조 스크립트 → planner → ticket-owner/finalizer → packages/cli 대형 shell 순서로 정리된다.
- [ ] companion 설치/doctor/검증 기반을 보강하는 회귀 검사가 `tests/smoke` 또는 doctor 경로에 포함된다.
- [ ] pass 직전 allowed paths의 `git status --short`와 finalizer staging 안전성 검토 결과가 Notes 또는 Verification에 남는다.
- [ ] `find .autoflow/scripts runtime/board-scripts packages/cli -type f -name '*.sh' -exec bash -n {} \; && find .autoflow/scripts runtime/board-scripts -maxdepth 1 -type f \( -name '*.ts' -o -name '*.js' \) -exec node --check {} \; && ./bin/autoflow doctor . .autoflow`가 통과한다.
- [ ] `bash tests/smoke/runtime-script-companion-smoke.sh`가 통과한다.

## Next Action

worker가 이 티켓을 claim한 뒤 원 PRD/Todo evidence를 읽고, 현재 PROJECT_ROOT allowed paths dirty 상태를 확인한 다음 필요한 hunk만 재적용한다. worktree와 PROJECT_ROOT 검증을 모두 통과시킨 뒤 pass finalizer를 호출한다.

## Resume Context

- Current state: planner가 retry order를 새 PRD/todo로 승격했다.
- Last completed action: `order_316_retry_1_20260512T081442Z.md`의 failure_class와 Original Ticket evidence를 `prd_301` / `Todo-323`에 반영했다.
- First thing to inspect on resume: `tickets/done/prd_294/prd_294.md`, `tickets/done/prd_301/order_316_retry_1_20260512T081442Z.md`, 현재 `git status --short -- package.json package-lock.json packages/cli/package-board-common.sh packages/cli/doctor-project.sh runtime/board-scripts .autoflow/scripts tests/smoke`.

## Notes

- Mini-plan: ① origin ticket/PRD evidence 확인 ② allowed paths dirty 상태 확인 ③ 누락된 companion/doctor/smoke hunk만 재적용 또는 이미 반영 증거 기록 ④ worktree와 PROJECT_ROOT에서 verification 실행 ⑤ finalizer staging 안전성 확인 후 pass.
- Progress: generated from retry order `order_316_retry_1_20260512T081442Z.md`.
- Planner wiki pass: RAG query returned `result_count=0`; embedded retry evidence and `prd_294` are the authoritative context.

## Verification

- Command: `find .autoflow/scripts runtime/board-scripts packages/cli -type f -name '*.sh' -exec bash -n {} \; && find .autoflow/scripts runtime/board-scripts -maxdepth 1 -type f \( -name '*.ts' -o -name '*.js' \) -exec node --check {} \; && ./bin/autoflow doctor . .autoflow`
- Command: `bash tests/smoke/runtime-script-companion-smoke.sh`
- Run file:
- Result:

## Result

- Summary:
- Commit:

## Path Notes

- `References` are relative to `BOARD_ROOT`.
- `Allowed Paths` are relative to the implementation worktree root. If no worktree exists, they fall back to `PROJECT_ROOT`.
- `Plan Candidate` must copy the exact candidate text from `Execution Candidates`. It is a duplicate-detection key.

