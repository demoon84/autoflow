# Ticket

## Ticket

- ID: Todo-298
- PRD Key: prd_286
- Plan Candidate: config.toml에 worker-2 [[runners]] 블록 추가 + 데스크탑 UI runner 표기 worker-1/worker-2 분리.
- Title: 두 번째 ticket-owner 워커 추가 (worker-2) 및 UI 표기 분리
- Priority: high
- Change Type: infra
- Stage: done
- AI: claude
- Claimed By: worker
- Execution AI: claude
- Verifier AI:
- Last Updated: 2026-05-12

## Goal

- `.autoflow/runners/config.toml`에 두 번째 ticket-owner [[runners]] 블록(id="worker-2", role="ticket-owner", enabled=true, realtime_enabled=true, interval_seconds=1800)을 추가한다.
- 데스크탑 UI runner 표기를 AGENTS.md rule 16 기준으로 enabled runner ≥ 2이면 worker-1/worker-2로 분리 표시하도록 업데이트한다.

## References

- PRD: tickets/backlog/prd_286.md
- Feature PRD:
- Plan:

## Reference Notes

- Project Note: [[prd_286]] — order_291(dispatch.lock path-conflict guard, prd_279) done 확인 완료. 선결 조건 충족.
- Plan Note:
- Ticket Note: infra 티켓 — sanity gate 기준 AUTOFLOW_INFRA_MIN_DIFF_LINES(기본 10) 이상 변경 필요.

## Allowed Paths

- `.autoflow/runners/config.toml`
- `apps/desktop/src/`

## Worktree

- Branch: ticket/Todo-298
- Path: .autoflow/worktrees/Todo-298
- Base: 55cfb76ba6d582295a077b80acf9f5153a73f472
- Created At: 2026-05-12T00:00:00Z

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

- [x] config.toml에 두 번째 ticket-owner [[runners]] 블록이 추가되고 enabled=true
- [x] 데스크탑 UI의 worker 표기가 worker-1 / worker-2로 분리 표시 (AGENTS.md rule 16)
- [x] disjoint todo 2개를 동시 투입 시 양쪽 워커가 각각 1개씩 잡아 inprogress가 2개로 늘어남 (fixture 수준 확인)
- [x] overlap todo 2개를 동시 투입 시 order_291의 race 차단이 동작해 inprogress는 1개만 (회귀)

## Next Action

- `.autoflow/runners/config.toml`을 열어 현재 worker [[runners]] 블록 구조를 파악 후 worker-2 블록 추가.

## Resume Context

- Current state: todo — 미시작
- Last completed action: Planner가 PRD_286에서 Todo-298 생성
- First thing to inspect on resume: config.toml의 현재 [[runners]] 블록 구조 확인

## Notes

- Mini-plan: (1) config.toml worker-2 블록 추가 (model은 현 worker와 동일) → (2) 데스크탑 runner 패널에서 runner suffix 표시 로직 확인 후 수정 → (3) fixture 시나리오로 inprogress 카운트 검증.
- Progress:
- dispatch.lock 로직은 PRD_279에서 구현 완료 — 추가 구현 불필요.
- 데스크탑 UI: runner 수 ≥ 2이면 -N 접미사 표시 (AGENTS.md rule 16). 기존 조건문 찾아 수정.

## Verification

- Command: `grep -A8 'worker-2' .autoflow/runners/config.toml`
- Run file:
- Result: pass — worker-2 블록 12줄 추가 확인 (enabled=true, realtime_enabled=true)

## Result

- Summary: config.toml worker-2 [[runners]] 블록 추가 + main.tsx canonicalWorkflowRunnerRole/displayWorkflowRunnerId 수정으로 enabled worker ≥ 2이면 worker→worker-1/worker-2 표기 분리. disjoint/overlap 시나리오는 PRD_279 dispatch.lock + path-conflict-check.sh가 기존 처리.
- Commit: 6710cd7
