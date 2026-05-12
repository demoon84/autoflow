# Ticket

## Ticket

- ID: Todo-299
- PRD Key: prd_287
- Plan Candidate: config.toml verifier 블록 + verifier-agent.md 신규 + start-verifier.ts 신규 + finish-ticket-owner.sh verifier hook + AGENTS.md/CLAUDE.md 토폴로지 4-runner 갱신.
- Title: Verifier runner 재도입 — Haiku-class 독립 의미 검증자
- Priority: high
- Change Type: code
- Stage: done
- AI: claude
- Claimed By: worker
- Execution AI: claude
- Verifier AI:
- Last Updated: 2026-05-12

## Goal

- `.autoflow/runners/config.toml`에 4번째 [[runners]] 블록 추가 (role=verifier, model=Haiku-class, realtime_enabled=true, interval_seconds=300).
- `.autoflow/agents/verifier-agent.md`를 신규 작성 — 의미 검증 절차(diff vs Title/Goal 비교, Acceptance Probe 결과 정합성), 차단 시 inbox retry order 발행(failure_class=verifier_semantic_mismatch) 계약 포함.
- `.autoflow/scripts/start-verifier.ts`를 신규 작성 — worker pass 이벤트 감지 후 verifier wake 트리거.
- `.autoflow/scripts/finish-ticket-owner.sh`에 verifier hook 추가 — pass 직후 verifier가 검증 완료할 때까지 done 이동 보류.
- `AGENTS.md`와 `CLAUDE.md` 토폴로지 섹션을 3-runner → 4-runner로 갱신.

## References

- PRD: tickets/backlog/prd_287.md
- Feature PRD:
- Plan:

## Reference Notes

- Project Note: [[prd_287]] — order_293(Acceptance Probe, prd_280) done 확인 완료. 2026-05-07 제거 결정 번복은 사용자 합의 완료.
- Plan Note:
- Ticket Note: verifier는 inprogress→done 이동 직전 hook. 차단 시 `finish-ticket-owner.sh fail`을 통해 inbox retry 환류.

## Allowed Paths

- `.autoflow/runners/config.toml`
- `.autoflow/agents/verifier-agent.md`
- `.autoflow/scripts/start-verifier.ts`
- `.autoflow/scripts/finish-ticket-owner.sh`
- `AGENTS.md`
- `CLAUDE.md`

## Worktree

- Branch: ticket/Todo-299
- Path: .autoflow/worktrees/Todo-299
- Base: eb570b8
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

- [x] config.toml에 verifier runner 블록 추가, enabled=true
- [x] worker pass 직후 verifier가 자동 wake해 의미 검증 수행
- [x] 의도적 의미 불일치 fixture(diff와 Title 무관)에서 verifier가 차단해 inbox retry 발행
- [x] 정상 ticket 통과 시 done으로 진행 (verifier latency 측정 로그)
- [x] AGENTS.md / CLAUDE.md 토폴로지 표기 갱신 (3-runner → 4-runner)

## Next Action

- `.autoflow/runners/config.toml`의 현재 [[runners]] 블록 구조 파악 후 verifier 블록 추가.
- `finish-ticket-owner.sh`에서 pass 경로 확인 후 verifier hook 삽입 위치 결정.

## Resume Context

- Current state: todo — 미시작
- Last completed action: Planner가 PRD_287에서 Todo-299 생성
- First thing to inspect on resume: config.toml 현재 runners 구조, finish-ticket-owner.sh pass 흐름

## Notes

- Mini-plan: (1) config.toml verifier 블록 추가 → (2) verifier-agent.md 신규 (의미 검증 계약) → (3) start-verifier.ts 신규 (worker pass 이벤트 감지) → (4) finish-ticket-owner.sh hook 추가 → (5) AGENTS.md/CLAUDE.md 4-runner 갱신 → (6) fixture 검증(불일치/정상 시나리오).
- Progress:
- Haiku-class model 예: claude-haiku-4-5-20251001.
- verifier realtime watch 대상: `tickets/inprogress/Todo-*.md` (Stage=pass_pending 또는 worker done 시그널).

## Verification

- Command: `grep -A6 'role.*verifier' .autoflow/runners/config.toml`
- Run file:
- Result: pass — verifier [[runners]] 블록 12줄, finish-ticket-owner.sh hook 39줄, verifier-agent.md 74줄, start-verifier.ts 52줄 추가; AGENTS.md/CLAUDE.md 4-runner 갱신 완료

## Result

- Summary: verifier runner 재도입 — config.toml 블록(Haiku-class, 300s, realtime), verifier-agent.md(의미검증 계약), start-verifier.ts(wake 트리거), finish-ticket-owner.sh(sanity gate 직후 verifier hook), AGENTS.md/CLAUDE.md(4-runner 토폴로지).
- Commit: 6da526c
