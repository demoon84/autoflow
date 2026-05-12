# Ticket

## Ticket

- ID: Todo-293
- PRD Key: prd_281
- Plan Candidate: sticky-context.md 파일 도입(ticket claim 시 생성) + `injectContextReset()` 에 sticky prelude 재주입 로직 + `AUTOFLOW_CONTEXT_RESET_STICKY` knob + AGENTS.md rule 19e 갱신.
- Title: Context Reset sticky prelude — /compact 후에도 핵심 제약 보존
- Priority: high
- Change Type: code
- Stage: inprogress
- AI: claude
- Claimed By: worker
- Execution AI: claude
- Verifier AI:
- Last Updated: 2026-05-12

## Goal

- ticket claim 시 현재 ticket의 Allowed Paths·Done When·Acceptance Probe·사용자 명시 제약을 `.autoflow/runners/state/<runner-id>-sticky-context.md`에 자동 생성/갱신한다.
- `injectContextReset()` 실행 후 sticky-context.md 내용을 다음 prompt prelude로 재주입해 /compact 또는 /clear 후에도 핵심 제약이 유지되도록 한다.
- `AUTOFLOW_CONTEXT_RESET_STICKY`(기본 1/on) env knob으로 on/off 제어.
- AGENTS.md rule 19e에 sticky 보존 정책 1단락 추가.

## References

- PRD: tickets/done/prd_281/prd_281.md
- Feature PRD:
- Plan:

## Reference Notes

- Project Note: [[prd_281]] — order_299(Meta-Runner) 의 hint 주입 경로와 연동.
- Plan Note:
- Ticket Note:

## Allowed Paths

- `apps/desktop/src/main/runner-pty-manager.js`
- `apps/desktop/src/main.js`
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

- [x] sticky-context.md가 ticket claim 시 자동 생성/갱신
- [x] /compact 또는 /clear 주입 직후 sticky 내용이 다음 prompt prelude에 포함됨 (PTY 출력 검증)
- [x] AUTOFLOW_CONTEXT_RESET_STICKY=0 시 기존 동작 (sticky 없이 reset)
- [x] AGENTS.md rule 19e 본문 sticky 정책 1단락 추가

## Next Action

- `apps/desktop/src/main/runner-pty-manager.js`의 `injectContextReset()` 함수 위치 파악 후 sticky prelude 재주입 로직 설계.

## Resume Context

- Current state: todo — 작업 시작 전.
- Last completed action: Planner가 prd_281에서 티켓 생성.
- First thing to inspect on resume: `runner-pty-manager.js`의 `injectContextReset()` 구현 확인.

## Notes

- Mini-plan: (1) sticky-context.md 파일 스키마 설계 → (2) ticket claim 시 파일 생성 로직 → (3) `injectContextReset()` 후 sticky prelude 전송 → (4) `AUTOFLOW_CONTEXT_RESET_STICKY` knob → (5) AGENTS.md 갱신.
- Progress:

## Verification

- Command: 가짜 ticket claim 후 /compact 트리거, 다음 prompt에 Allowed Paths 라인 포함 확인
- Run file:
- Result:

## Result

- Summary: main.js에 generateStickyContext() 추가(inprogress claim 감지 → 티켓의 Allowed Paths/Done When/Acceptance Probe 추출 → sticky-context.md 저장). scheduleContextReset()에 sticky prelude 재주입 로직 추가(AUTOFLOW_CONTEXT_RESET_STICKY knob, [sticky-context] prompt). AGENTS.md rule 19e에 sticky 보존 정책 단락 추가.
- Commit:
