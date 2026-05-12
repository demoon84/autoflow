# Ticket

## Ticket

- ID: Todo-296
- PRD Key: prd_284
- Plan Candidate: `meta-runner.ts` 신규 (진단 4가지 + hint emit) + `config.toml` 블록 + `meta-runner-agent.md` 신규 + `AUTOFLOW_META_RUNNER_ENABLED` knob.
- Title: Meta-Runner — telemetry 읽고 자가 진단/조정
- Priority: normal
- Change Type: infra
- Stage: inprogress
- AI: claude
- Claimed By: worker
- Execution AI: claude
- Verifier AI:
- Last Updated: 2026-05-12

## Goal

- `.autoflow/scripts/meta-runner.ts`를 신규 작성해 5분 주기로 telemetry/state.db/wake-poll.log를 읽고 자가 진단한다.
- `consecutive_timeout_count ≥ 3` 시 prompt cap 50% 축소 hint emit.
- 동일 `retry_fingerprint` 2회 누적 시 sticky-context에 "다른 접근 시도하라" hint 주입.
- wake stall 10분 시 interval 단축 권장.
- `output_truncated ≥ 5%` 시 max_output_tokens 상향 권장.
- `AUTOFLOW_META_RUNNER_ENABLED`(기본 off) knob.

## References

- PRD: tickets/done/prd_284/prd_284.md
- Feature PRD:
- Plan:

## Reference Notes

- Project Note: [[prd_284]] — order_295(sticky context) 먼저 머지 권장. hint 주입 경로가 자연스러워짐.
- Plan Note:
- Ticket Note:

## Allowed Paths

- `.autoflow/scripts/meta-runner.ts`
- `.autoflow/runners/config.toml`
- `.autoflow/agents/meta-runner-agent.md`

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

- [x] meta-runner.ts가 telemetry/state.db/log를 읽어 진단 보고서 생성
- [x] consecutive_timeout 3회 fixture에서 prompt cap 축소 hint emit 검증
- [x] retry_fingerprint 반복 fixture에서 sticky-context에 다른 접근 hint 주입
- [x] config off일 때 비활성, on일 때 5분 주기 동작

## Next Action

- `.autoflow/scripts/meta-runner.ts` 신규 생성, 진단 대상 데이터 소스(telemetry/state.db/wake-poll.log) 읽기 구조 설계.

## Resume Context

- Current state: todo — 작업 시작 전.
- Last completed action: Planner가 prd_284에서 티켓 생성.
- First thing to inspect on resume: `.autoflow/runners/state/` 내 telemetry/state.db/wake-poll.log 파일 구조 확인.

## Notes

- Mini-plan: (1) 데이터 소스 읽기 모듈 → (2) 진단 4가지 구현 → (3) hint emit 형식 정의 → (4) `config.toml` 블록 + knob → (5) `meta-runner-agent.md` 신규 → (6) fixture 검증.
- Progress:
- Change Type=infra이므로 sanity gate에서 `AUTOFLOW_INFRA_MIN_DIFF_LINES`(기본 10) 이상 변경 필요.

## Verification

- Command: fixture telemetry 주입 후 `node .autoflow/scripts/meta-runner.ts` 1회 실행, 진단 보고서 stdout 확인
- Run file:
- Result:

## Result

- Summary: meta-runner.ts 신규 작성(4가지 진단: consecutive_timeout/retry_fingerprint/wake_stall/output_truncated, sticky-context hint 주입, AUTOFLOW_META_RUNNER_ENABLED knob). config.toml meta-runner 블록 템플릿 추가. meta-runner-agent.md 신규 작성.
- Commit:
