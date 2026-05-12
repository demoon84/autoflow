# Ticket

## Ticket

- ID: Todo-324
- PRD Key: prd_302
- Plan Candidate: Plan AI retry from tickets/done/prd_302/prd_302.md (origin=Todo-317, retry_count=1, fingerprint=7e9537e8d40c)
- Title: sh to ts 전환 1단계 active-runtime 동기화 retry
- Priority: normal
- Change Type: infra
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-12T10:44:22Z

## Goal

`Todo-317`의 active/runtime mirror 동기화 목표를 fresh worktree에서 다시 수행한다. 직전 실패 원인은 finalizer 시점의 missing worktree였으므로, worker는 새 worktree를 만들고 실제 diff/검증 evidence를 남긴 뒤 pass finalizer를 호출한다.

## References

- PRD: tickets/done/prd_302/prd_302.md
- Feature PRD:
- Plan:

## Reference Notes

- Project Note: [[prd_302]], original acceptance basis [[prd_295]]
- Plan Note:
- Ticket Note: origin=Todo-317, failure_class=merge_preparation_failed, retry_fingerprint=7e9537e8d40c, retry_count=1/3

## Allowed Paths

- `.autoflow/scripts`
- `runtime/board-scripts`
- `packages/cli/doctor-project.sh`
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

- [ ] `finish-ticket-owner.sh`, `board-guard.sh`, `state-db.sh`, `start-ticket-owner.legacy.sh`, `runner-common.sh`, `watch-board.sh`, `start-todo.sh`의 active/runtime 차이가 조사된다.
- [ ] 각 차이가 의도된 차이인지 의도되지 않은 drift인지 분류된다.
- [ ] 의도되지 않은 drift는 기준 소스를 정해 `.autoflow/scripts`와 `runtime/board-scripts`가 동기화된다.
- [ ] 의도된 차이가 남는 경우 doctor/smoke/Notes 중 하나에 근거가 남아 후속 작업이 회귀로 오인하지 않는다.
- [ ] mirror drift 재발을 감지하는 doctor 또는 smoke 검사가 포함된다.
- [ ] fresh worktree에서 실제 diff가 만들어졌고 `git diff <Worktree.Base Commit>..HEAD`가 0이 아님을 pass 전 evidence에 남긴다.
- [ ] `bash tests/smoke/active-runtime-mirror-smoke.sh`가 통과한다.
- [ ] `find .autoflow/scripts runtime/board-scripts -maxdepth 1 -type f -name '*.sh' -exec bash -n {} \;`가 통과한다.

## Next Action

worker가 이 티켓을 claim한 뒤 old missing worktree를 재사용하지 말고 fresh worktree에서 active/runtime 우선 대상 7개 파일을 다시 조사한다. 필요한 mirror/smoke 변경을 만든 뒤 worktree와 PROJECT_ROOT 검증을 모두 기록한다.

## Resume Context

- Current state: planner가 retry order를 새 PRD/todo로 승격했다.
- Last completed action: `order_317_retry_1_20260512T104151Z.md`의 missing worktree failure evidence를 `prd_302` / `Todo-324`에 반영했다.
- First thing to inspect on resume: `tickets/done/prd_295/prd_295.md`, `tickets/done/prd_302/order_317_retry_1_20260512T104151Z.md`, fresh worktree의 active/runtime diff.

## Notes

- Mini-plan: ① origin ticket/PRD evidence 확인 ② fresh worktree 생성 확인 ③ 우선 대상 7개 파일 active/runtime diff 재조사 ④ drift 동기화와 mirror smoke 보강 ⑤ worktree와 PROJECT_ROOT 검증 후 pass.
- Progress: generated from retry order `order_317_retry_1_20260512T104151Z.md`.
- Planner wiki pass: RAG query returned `result_count=0`; embedded retry evidence and `prd_295` are the authoritative context.

## Verification

- Command: `bash tests/smoke/active-runtime-mirror-smoke.sh`
- Command: `find .autoflow/scripts runtime/board-scripts -maxdepth 1 -type f -name '*.sh' -exec bash -n {} \;`
- Run file:
- Result:

## Result

- Summary:
- Commit:

## Path Notes

- `References` are relative to `BOARD_ROOT`.
- `Allowed Paths` are relative to the implementation worktree root. If no worktree exists, they fall back to `PROJECT_ROOT`.
- `Plan Candidate` must copy the exact candidate text from `Execution Candidates`. It is a duplicate-detection key.

