# Autoflow Order

## Order

- Title: 토큰 보고 툴 통합 E2E 테스트 — runner-tokens.js 호출 의무화
- Express: true
- Priority: normal
- Status: ready
- Change Type: code

## Request

`runner-tokens.js report` 호출이 실제로 LLM 측에서 동작하는지 확인하는 E2E 테스트.
티켓 작업 자체는 trivial — `.autoflow/scripts/runner-tokens.js` 상단의 주석에 한 줄 추가.
**핵심 검증**은 워커가 턴 종료 시 `runner-tokens.js report` 를 호출해 worker.state 에 `token_source=llm_reported` 가 박히는지 여부다.

## Allowed Paths

- .autoflow/scripts/runner-tokens.js
- .autoflow/runners/state/worker.state

## Done When

- [ ] `.autoflow/scripts/runner-tokens.js` 의 첫 줄 주석 (`#!/usr/bin/env node` 다음 줄) 에 `// e2e-token-test: order_272` 한 줄 추가
- [ ] 작업 턴 종료 직전에 `node .autoflow/scripts/runner-tokens.js report --runner worker --tick-id worker-$(date +%s)-e2e272 --input <실제 input 토큰> --output <실제 output 토큰>` 을 호출하여 보고
- [ ] 보고 후 `.autoflow/runners/state/worker.state` 를 확인해 다음 3개 라인이 모두 존재해야 한다:
  - `token_source=llm_reported`
  - `last_turn_tick_id=worker-<숫자>-e2e272`
  - `last_turn_tokens=<양수>`

## Verification

- Command: grep -E "^(token_source|last_turn_tick_id|last_turn_tokens)=" .autoflow/runners/state/worker.state

## Notes

- Express rationale: 1줄 주석 추가 + 도구 호출 검증. PRD 없이 처리 가능.
- 본 티켓의 성공 = runner-tokens 통합 완전 동작 증거. 실패하면 통합이 깨진 곳을 디버깅한다.
- tick-id 형식: `worker-<unix-epoch-sec>-e2e272`
