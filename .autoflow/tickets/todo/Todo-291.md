# Ticket

## Ticket

- ID: Todo-291
- PRD Key: prd_279
- Plan Candidate: `start-ticket-owner.legacy.sh`의 `find_next_dispatchable_todo` 진입 시 `dispatch.lock/` mkdir mutex 획득 + PID 파일 기록 + 30초 stale lock 자동 회수 + `AUTOFLOW_PATH_CONFLICT_CHECK` 기본 on 전환 + AGENTS.md rule 24 갱신.
- Title: 워커 dispatcher race 차단 + path conflict guard 기본 활성화
- Priority: high
- Change Type: code
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-12

## Goal

- `start-ticket-owner.legacy.sh`의 dispatcher 진입부에 mkdir mutex(`dispatch.lock/`)를 추가해 두 워커가 동시에 같은 todo를 claim하는 race window를 차단한다.
- PID 파일을 기록해 lock holder liveness를 확인하고, 30초 경과 후 dead lock은 자동 회수한다.
- `AUTOFLOW_PATH_CONFLICT_CHECK` 미설정 시 기본을 on으로 간주(명시적 off만 끔)한다.
- AGENTS.md rule 24 표기를 "default on; opt-out via off"로 갱신하고 race window 차단 사실을 한 줄 추가한다.

## References

- PRD: tickets/done/prd_279/prd_279.md
- Feature PRD:
- Plan:

## Reference Notes

- Project Note: [[prd_279]] — Order 292(워커 추가)의 선행 조건. 본 ticket done 후 order_292 promote.
- Plan Note:
- Ticket Note:

## Allowed Paths

- `.autoflow/scripts/start-ticket-owner.legacy.sh`
- `.autoflow/scripts/common.sh`
- `AGENTS.md`

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

- [ ] overlap된 Allowed Paths를 가진 todo 2개 동시 dispatcher 호출 시 inprogress는 정확히 1개만
- [ ] dispatcher 도중 강제 종료된 워커의 stale lock을 다음 dispatcher가 PID liveness 확인 후 회수 (수동 SIGKILL 시나리오)
- [ ] AUTOFLOW_PATH_CONFLICT_CHECK 미설정 환경에서 가드 모드 동작 (명시적 off만 끔)
- [ ] AGENTS.md rule 24 본문이 "default on; opt-out via off"로 갱신
- [ ] path-conflict-check.sh 회귀 (overlap exit 1, disjoint exit 0, unresolvable exit 1) 그대로 통과

## Next Action

- `start-ticket-owner.legacy.sh`의 `find_next_dispatchable_todo` 함수 앞에 mkdir mutex 획득 코드 삽입.

## Resume Context

- Current state: todo — 작업 시작 전.
- Last completed action: Planner가 prd_279에서 티켓 생성.
- First thing to inspect on resume: `.autoflow/scripts/start-ticket-owner.legacy.sh`의 `find_next_dispatchable_todo` 함수 구조 확인.

## Notes

- Mini-plan: (1) lock dir `dispatch.lock/` mkdir + PID 기록 → (2) liveness 확인(`kill -0`) + stale 판정(30초) → (3) `AUTOFLOW_PATH_CONFLICT_CHECK` 기본값 전환 → (4) AGENTS.md 갱신 → (5) 회귀 테스트.
- Progress:

## Verification

- Command: `bash .autoflow/scripts/path-conflict-check.sh <fixture-a.md> <fixture-b.md>` 회귀 + 동시 dispatcher 스니펫 시뮬레이션
- Run file:
- Result:

## Result

- Summary:
- Commit:

## Path Notes

- `References` are relative to `BOARD_ROOT`.
- `Allowed Paths` are relative to the implementation worktree root. If no worktree exists, they fall back to `PROJECT_ROOT`.
