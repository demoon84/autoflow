# Ticket

## Ticket

- ID: Todo-266
- PRD Key: prd_262
- Plan Candidate: Candidate 1: runner-wake.js 신규 구현 + main.js/agent.md 통합
- Title: runner-wake.js 도입 — LLM polling 기반 wake 이벤트 수집 (hybrid)
- Priority: high
- Change Type: code
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-10T21:00Z

## Goal

`.autoflow/scripts/runner-wake.js`를 emit/poll/notify 3개 subcommand로 신규 구현한다. main.js의 `ensureBoardWatcher.broadcast`에 emit 호출을 추가해 텍스트 주입과 JSONL 큐 파일 기록을 병행(hybrid)하고, agent.md 3개와 worker buildInitialPrompt에 startup/turn-end poll 명시를 추가한다.

## References

- PRD: tickets/done/prd_262/prd_262.md
- Feature PRD:
- Plan:

## Reference Notes

- Project Note: [[prd_262]]

## Allowed Paths

- `.autoflow/scripts/runner-wake.js`
- `apps/desktop/src/main.js`
- `.autoflow/agents/ticket-owner-agent.md`
- `.autoflow/agents/plan-to-ticket-agent.md`
- `.autoflow/agents/wiki-maintainer-agent.md`
- `.autoflow/scripts/start-ticket-owner.sh`

## Worktree
- Path:
- Branch:
- Base Commit:
- Worktree Commit:
- Integration Status: pending

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

## Recovery State

- Status: healthy
- Detected By: planner (2026-05-10T21:00Z)
- Failure Class:
- Evidence:
- Planner Decision: 선행 티켓 3개 완료 후 진행. Todo-263(critical) → Todo-264(normal) → Todo-265(high) 완료 후 claim. start-ticket-owner.sh + main.js + agent.md×3 모두 겹침.
- Owner Resume Instruction: `ls .autoflow/tickets/done/prd_259/ .autoflow/tickets/done/prd_260/ .autoflow/tickets/done/prd_261/` 로 263/264/265 완료 확인 후 구현 시작.
- Last Recovery At: 2026-05-10T21:00Z

## Done When

- [x] `.autoflow/scripts/runner-wake.js`가 emit / poll / notify 3개 subcommand 동작
- [x] 큐 파일 포맷: JSONL, 한 줄 = 1 event, fields = `{ reason, kind, at }`
- [x] poll 후 `last_polled_at` 자동 갱신 (idempotent — 같은 event 두 번 반환 안 함)
- [x] `main.js`의 `ensureBoardWatcher.broadcast`가 `[wake]` 텍스트 주입 외에 `runner-wake.js emit`도 호출 (hybrid)
- [x] agent.md 3개에 startup scan 직전 + 매 turn 끝 poll 호출 1줄 추가
- [x] worker prompt (buildInitialPrompt)에도 poll 명시
- [x] 큐 파일 크기 제한 (기본 200 events, FIFO trim)
- [x] poll 실패 / 파일 없음 시 0 exit + `[]` 반환 (1원칙)
- [x] notify 사용 예시: worker `finish-ticket-owner.sh pass` 성공 후 `runner-wake.js notify --target wiki` 호출
- [x] `node .autoflow/scripts/runner-wake.js emit --runner worker --reason "tickets/todo/Todo-001.md" --kind fs.watch.create && node .autoflow/scripts/runner-wake.js poll --runner worker` 실행 시 이벤트 반환

## Next Action
- 다음에 바로 이어서 할 일: Todo-263/264/265 완료 확인 후 claim. runner-wake.js 신규 구현 → main.js broadcast 수정 → agent.md 3개 1줄 추가.

## Resume Context

- Current state: Todo 상태, Todo-263/264/265 선행 완료 필요
- Last completed action: Planner가 order_232에서 이 티켓 생성 (2026-05-10T21:00Z)
- First thing to inspect on resume: `ls .autoflow/tickets/done/prd_259/ .autoflow/tickets/done/prd_260/ .autoflow/tickets/done/prd_261/` 로 선행 티켓 완료 확인

## Notes

- Mini-plan: (1) 선행 3개 완료 확인 → (2) runner-wake.js 신규 구현(emit/poll/notify) → (3) main.js broadcast에 emit 추가 → (4) agent.md 3개 + buildInitialPrompt poll 명시 → (5) start-ticket-owner.sh claim 직전 poll 1줄(선택) → (6) 검증
- Progress: 신규 구현 필요
- 큐 파일은 `runners/state/*-wake.queue.jsonl` (gitignored)
- order_228(runner-stage.js), order_226(runner-tokens.js)와 같은 LLM-active-tool 패턴 통일

## Verification

- Command: `node .autoflow/scripts/runner-wake.js emit --runner worker --reason "tickets/todo/Todo-001.md" --kind fs.watch.create && node .autoflow/scripts/runner-wake.js poll --runner worker`
- Run file:
- Result:

## Result

- Summary:
- Commit:

## Notes
