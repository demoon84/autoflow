# Autoflow Order

## Order

- Title: context-reset E2E 검증 — 워커가 pass 직후 /compact 자동 인젝션 확인
- Express: true
- Priority: normal
- Status: ready
- Change Type: code

## Request

PRD_278 (commit 77ea27b) 가 `injectContextReset` + `scheduleContextReset` 를 추가했으나 실제 발사 흔적 (context_reset 로그) 0건. 본 티켓은 trivial 변경으로 pass 사이클을 한 번 돌려, board watcher 가 done/ 출현을 감지해 scheduleContextReset 가 트리거되는지 검증한다.

## Allowed Paths

- .autoflow/scripts/runner-tokens.js

## Done When

- [ ] `.autoflow/scripts/runner-tokens.js` 의 1번째 코멘트 줄 다음에 `// context-reset-e2e: order_286` 라인 추가
- [ ] `node .autoflow/scripts/runner-tokens.js report --runner worker --tick-id worker-$(date +%s)-e2e286 --input <실측 input> --output <실측 output>` 호출
- [ ] worker.state 에 `last_turn_tick_id=worker-<숫자>-e2e286` 박힘
- [ ] pass 직후 `.autoflow/runners/logs/worker.log` 에 `event=context_reset mode=compact|clear trigger=ticket_pass` 줄이 1개 이상 기록

## Verification

- Command: tail -5 .autoflow/runners/logs/worker.log | grep context_reset; grep "context-reset-e2e: order_286" .autoflow/scripts/runner-tokens.js

## Notes

- Express rationale: 한 줄 코멘트 + 도구 호출 + 사이드 이펙트 관찰. PRD 불필요.
- 실패하면 PRD_278 의 board watcher 연결이 미동작 — 진단 후 별도 PRD.
