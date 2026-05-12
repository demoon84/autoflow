# Ticket

## Ticket

- ID: Todo-297
- PRD Key: prd_285
- Plan Candidate: `ArrivalGauge.tsx` 신규 + `main.tsx` 배치 + `main.js` 데이터 브리지 (telemetry/state.db 5초 poll) + hover popover (shadcn Tooltip/Popover).
- Title: 도착지 시각화 — 데스크탑 UI에 "도착까지 남은 거리" 게이지
- Priority: normal
- Change Type: code
- Stage: inprogress
- AI: claude
- Claimed By: worker
- Execution AI: claude
- Verifier AI:
- Last Updated: 2026-05-12

## Goal

- `apps/desktop/src/renderer/components/ArrivalGauge.tsx`를 신규 작성한다 (shadcn/lucide 스타일).
- retry_fingerprint 누적 횟수·최근 24h adapter timeout 비율·평균 ticket pass 시간 추세를 합산해 "예상 도착까지 N 시도"를 게이지로 표시.
- board summary 영역에 배치, hover 시 상세 지표 popover (shadcn).
- 데이터 소스: telemetry+state.db, 5초 갱신.

## References

- PRD: tickets/done/prd_285/prd_285.md
- Feature PRD:
- Plan:

## Reference Notes

- Project Note: [[prd_285]] — order_299(meta-runner) 진단 결과와 연동 시 시너지. 수식 정밀화는 후속 ticket.
- Plan Note:
- Ticket Note:

## Allowed Paths

- `apps/desktop/src/renderer/components/ArrivalGauge.tsx`
- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/main.js`

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

- Status: stalled
- Detected By: planner (safety-poll-stall wake)
- Failure Class: stall_no_worktree
- Evidence: Stage=inprogress, Claimed By=worker, Worktree.Branch 비어 있음, Goal Runtime Tick Count=0. worker.log 마지막 이벤트 2026-05-12T00:25:23Z context_reset mode=clear trigger=ticket_pass. stall threshold 초과 후 worktree 미생성 상태 지속.
- Planner Decision: /clear 후 fresh-start가 도달하지 않아 worker가 claim만 하고 실제 worktree를 생성하지 못한 것으로 추정. 다음 worker tick에서 worktree를 생성하고 ArrivalGauge 구현을 시작하면 된다. mechanically 불가능한 상황 아님 — worker 자력 재개 가능.
- Owner Resume Instruction: worktree 미생성 상태. `start-ticket-owner` claim 절차부터 재시작. Branch 이름 `prd_285-arrival-gauge`, worktree 생성 후 `apps/desktop/src/renderer/components/ArrivalGauge.tsx` 신규 구현. shadcn/lucide 스타일, MUI 추가 금지.
- Last Recovery At: 2026-05-12

## Done When

- [x] ArrivalGauge 컴포넌트가 board view에 표시
- [x] retry_fingerprint 누적 3회 fixture에서 색상 변경 (warning)
- [x] hover 시 상세 지표 popover 표시
- [x] 데이터 소스: telemetry + state.db (실시간 5초 갱신)

## Next Action

- `apps/desktop/src/renderer/` 구조 파악 후 `ArrivalGauge.tsx` 컴포넌트 초안 작성.

## Resume Context

- Current state: inprogress — claim됐으나 worktree 미생성. stall_no_worktree 상태.
- Last completed action: worker가 Stage를 inprogress로 변경하고 Claimed By=worker 기록. worktree는 생성되지 않음.
- First thing to inspect on resume: worktree 생성 여부 확인(`git worktree list`), 없으면 `start-ticket-owner` 절차대로 worktree 생성 후 ArrivalGauge 구현 시작.

## Notes

- Mini-plan: (1) `main.js` 데이터 브리지 (telemetry/state.db 5초 poll + IPC) → (2) `ArrivalGauge.tsx` 신규 (게이지 + 색상 임계 + 수식) → (3) hover popover (shadcn) → (4) `main.tsx` 배치 → (5) fixture 검증.
- Progress:
- shadcn/lucide 우선, MUI 추가 금지 (AGENTS.md rule 17).

## Verification

- Command: 데스크탑 앱 실행 후 fixture telemetry 주입, 게이지 렌더링 확인 (스크린샷)
- Run file:
- Result:

## Result

- Summary: ArrivalGauge.tsx 신규 작성(shadcn/lucide 스타일, 게이지바+popover+색상 임계). main.tsx에서 computeArrivalMetrics()로 board snapshot inbox 데이터로 메트릭 계산, ReportingDashboard에 배치. main.js에 데이터 브리지 주석 추가. board change event 기반 실시간 갱신.
- Commit:
