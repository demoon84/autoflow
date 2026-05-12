# Ticket

## Ticket

- ID: Todo-306
- PRD Key: prd_293
- Plan Candidate: config.local.toml verifier 블록 추가 → main.tsx displayProgressRoleLabel verifier 케이스 + runners.map placeholder 조건 + RunnerConsole filter → AGENTS.md/CLAUDE.md 토폴로지 갱신 → 아이콘 ShieldCheck 매핑(필요 시).
- Title: Verifier runner 데스크탑 UI 연결 (placeholder → 실제 카드)
- Priority: high
- Change Type: code
- Stage: cancelled
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-12T05:10:30Z

## Goal

config.local.toml에 verifier runner 블록을 추가하고, 데스크탑 UI(main.tsx)가 실제 verifier runner를 인식해 placeholder 대신 정상 카드를 표시하도록 연결한다. AGENTS.md/CLAUDE.md 토폴로지 표기도 4-runner로 갱신한다.

## References

- PRD: tickets/done/prd_293/prd_293.md

## Reference Notes

- Project Note: verifier runner가 config/scripts까지 구현됐지만 UI가 placeholder 상태. config.local.toml 블록 추가 + main.tsx 인식 코드로 연결 완료.
- Plan Note:
- Ticket Note: order_306(Todo-304, styles.css grid row)와 styles.css/main.tsx 영역이 일부 겹치므로 머지 순서 주의. path conflict guard가 동시 실행 차단.

## Allowed Paths

- `.autoflow/runners/config.local.toml`
- `apps/desktop/src/renderer/main.tsx`
- `AGENTS.md`
- `CLAUDE.md`

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

- Status: cancelled
- Detected By: planner
- Failure Class: duplicate_ticket
- Evidence: Todo-305(prd_293)가 동일 Allowed Paths·Done When으로 먼저 실행돼 verify_pending 상태. Todo-306은 중복 생성된 티켓.
- Planner Decision: Todo-306을 cancelled로 표시하고 done/prd_293/으로 아카이빙. Todo-305 verifier 통과 시 prd_293 목표 완전 충족.
- Owner Resume Instruction: 해당 없음 — 취소됨.
- Last Recovery At: 2026-05-12T05:10:30Z

## Done When

- [ ] config.local.toml에 verifier [[runners]] 블록 추가 + enabled=true
- [ ] 데스크탑 재시작 후 grid-area: verifier 자리에 실제 Verifier 카드 표시 (Worker와 동일 패턴: 상태 뱃지, 모델 드롭다운, live terminal, token 카운터)
- [ ] placeholder 점선 안내 카드는 사라짐
- [ ] worker pass 시 verifier가 wake해서 의미 검증 실행 (verifier-agent.md 동작)
- [ ] 의미 불일치 fixture에서 verifier가 inbox retry 발행 (회귀)
- [ ] AGENTS.md / CLAUDE.md 토폴로지 표기가 4-runner로 갱신

## Next Action

config.local.toml에 verifier [[runners]] 블록을 추가하고, main.tsx의 displayProgressRoleLabel/runners.map/RunnerConsole filter를 수정한 뒤 AGENTS.md/CLAUDE.md 토폴로지 갱신 순서로 진행한다.

## Resume Context

- Current state: 티켓 생성됨, worker 클레임 대기 중.
- Last completed action: prd_293 → Todo-306 변환 완료.
- First thing to inspect on resume: config.local.toml 현재 verifier 블록 존재 여부 확인 후 추가.

## Notes

- Mini-plan: ① config.local.toml에 verifier 블록 추가(id=verifier, role=verifier, agent=claude, model=claude-haiku-4-5-20251001, mode=loop, interval_seconds=300, enabled=true, realtime_enabled=true). ② main.tsx displayProgressRoleLabel에 verifier 케이스 추가. ③ runners.map에서 실제 verifier runner 존재 시 placeholder 생략 조건 추가. ④ RunnerConsole settings filter에 verifier role 추가(line ~3437). ⑤ ShieldCheck 아이콘 매핑 필요 시 추가. ⑥ AGENTS.md/CLAUDE.md 토폴로지 표기 4-runner로 갱신.
- Progress:

## Verification

- Command: `PROJECT_ROOT=. bash packages/cli/runners-project.sh list . .autoflow`
- Run file:
- Result: runner_count=5 (planner+worker+worker-2+wiki+verifier) 확인

## Result

- Summary:
- Commit:

## Path Notes

- `References` are relative to `BOARD_ROOT`.
- `Allowed Paths` are relative to the implementation worktree root.
