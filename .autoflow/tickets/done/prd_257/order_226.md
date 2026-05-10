# Autoflow Order

## Order

- ID: order_226
- Title: LLM tick 종료 시 token 능동 보고 runner-tokens.js
- Status: inbox
- Priority: high
- Created At: 2026-05-10T11:12:26Z
- Source: autoflow order create

## Request

# Autoflow Order

## Order

- Title: LLM 이 tick 종료 시 직접 보고하는 token 측정 (runner-tokens.js)
- Priority: high
- Status: ready
- Change Type: code


토큰 사용량을 세션 로그 파싱 (order_222 / PRD_253 의 token watcher) 으로 추론하는 대신, **LLM 이 매 tick 종료 시점에 tool 을 호출해 자기 측정값을 능동 보고**하는 방식으로 통일.

이유:
- 각 CLI (claude / codex / gemini) 의 세션 로그 포맷이 버전마다 변동 → 파싱 fragile
- LLM 은 자기 turn 의 token usage 를 항상 알고 있음 (TUI status bar 에 직접 표시) → 자기가 보고하는 게 정확
- runner-stage.js 와 같은 패턴 (push > pull) 으로 일관성
- 세션 로그 파싱은 fallback 으로만 두고 (LLM 이 보고 안 하면 보강) primary 신호는 tool 호출

워크플로:
```
worker / planner / wiki LLM
  매 turn 종료 시점에:
    node .autoflow/scripts/runner-tokens.js report \
      --runner <id> \
      --tick-id <generated-uuid-or-counter> \
      --input <N> \
      --output <N> \
      --cache-read <N> \
      --cache-create <N>
```

## Allowed Paths

- .autoflow/scripts/runner-tokens.js (new)
- .autoflow/agents/ticket-owner-agent.md
- .autoflow/agents/plan-to-ticket-agent.md
- .autoflow/agents/wiki-maintainer-agent.md
- apps/desktop/src/main.js (buildInitialPrompt 보강)
- apps/desktop/src/renderer/main.tsx (UI 가 새 state 필드 읽기)

## Done When

- [ ] `.autoflow/scripts/runner-tokens.js` 가 다음 인터페이스로 동작:
      `runner-tokens.js report --runner <id> [--tick-id <id>] --input <N> --output <N> [--cache-read <N>] [--cache-create <N>] [--note <text>]`
      - state 파일 (`runners/state/<runner>.state`) 의 다음 필드 갱신:
        - `last_turn_tokens`: 이번 tick 합계 (input + output + cache_read + cache_create)
        - `cumulative_tokens`: 누적 (이전 cumulative + 이번 turn)
        - `last_turn_input_tokens`, `last_turn_output_tokens`, `last_turn_cache_read_tokens`, `last_turn_cache_create_tokens` 각각
        - `last_turn_at`: ISO timestamp
        - `token_source`: `llm_reported`
      - JSONL audit 로그 `runners/logs/<runner>-tokens.log` 에 한 줄 추가 (tick-id, breakdown, timestamp)
- [ ] agent.md 3개에 워크플로 명시 — 매 turn 끝 (tool 사용 후 응답 직전 또는 finalizer 호출 직전) 에 `runner-tokens.js report` 호출 의무
- [ ] desktop 의 startup prompt 에 명시 추가
- [ ] 데스크톱 UI 가 `cumulative_tokens` / `last_turn_tokens` 를 읽어 카드 하단의 "0 tokens" 영역에 실시간 표시
- [ ] LLM 이 보고 안 한 경우 fallback: order_222 / PRD_253 에서 만들어진 session log token watcher 가 그대로 동작 — `token_source=session_log` 로 표시
- [ ] script 호출 실패 (잘못된 인자 등) 시 0 exit + stderr 경고만 — LLM 메인 흐름 차단 금지 (1원칙)

## Verification

- Command: node .autoflow/scripts/runner-tokens.js report --runner worker --input 100 --output 50 --cache-read 200 && grep -E "last_turn_tokens|cumulative_tokens" .autoflow/runners/state/worker.state

## Notes

- order_222 (session log 파싱) 의 작업과 보완 관계 — session log watcher 는 fallback, 이 tool 은 primary
- LLM 이 자기 token usage 를 어떻게 알 수 있나:
  - claude: TUI status bar 에 "↑ N.Nk tokens" 표시. LLM 이 그 숫자 인식 가능
  - codex: 비슷한 status 표시
  - gemini: 응답 metadata 에 포함
- LLM 이 매 turn 보고하면 분 단위 정밀도. UI 가 거의 실시간 업데이트
- tick-id 는 deduplicate 용 — 같은 tick 을 두 번 보고해도 한 번만 누적
- runner-stage.js 가 곧 들어오므로 (PRD_253) 두 스크립트가 같은 공통 유틸 (state file writer) 을 공유하도록 설계

## Hints

### Scope

- pending Plan AI inference

### Allowed Paths

- pending Plan AI inference

### Verification

- Command: pending Plan AI inference

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
