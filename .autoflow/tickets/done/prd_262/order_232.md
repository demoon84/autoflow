# Autoflow Order

## Order

- ID: order_232
- Title: runner-wake.js 툴 도입 (LLM polling)
- Status: inbox
- Priority: high
- Created At: 2026-05-10T12:21:33Z
- Source: autoflow order create

## Request

# Autoflow Order

## Order

- Title: runner-wake.js 툴 도입 — LLM 이 polling 으로 wake 이벤트 수집
- Priority: high
- Status: ready
- Change Type: code


현재 fs.watch 기반 wake 시스템:
- main process 가 tickets 폴더 변경 감지 → `writePrompt(runnerId, "[wake] <path>")` 로 PTY stdin 에 텍스트 주입
- PTY 안의 LLM 이 그 텍스트를 다음 user message 처럼 처리

문제점:
- LLM 이 이미 paste 처리 중이면 wake 메시지가 paste body 에 흡수됨 (실제 incident 다수 발생)
- TUI 의 multi-line / bracketed paste 모드에서 mojibake 로 깨짐
- LLM 이 mid-thinking 중이면 wake 이 "현재 turn 의 user 입력 일부"로 잘못 인식
- wake 가 정확히 도착했는지 검증 불가

**제안**: 같은 push 방식 + polling 방식 hybrid 로 안정성 향상.
- main process 는 fs.watch 결과를 **JSONL 큐 파일** 에 기록 (`runners/state/<runner>-wake.queue.jsonl`)
- LLM 이 매 turn 끝 / startup scan 시 `node .autoflow/scripts/runner-wake.js poll --runner <id>` 호출 → 지난 poll 이후의 wake 이벤트 JSON 반환
- 옵션 A: text 주입은 그대로 유지 (보강 trigger). poll 이 truth source
- 옵션 B: text 주입 폐기. poll 만 사용 (cleaner)

이번 order 는 옵션 A (hybrid) 로 진행 — 안정성 우선.

## 동작 명세

### `runner-wake.js poll`
```
node .autoflow/scripts/runner-wake.js poll --runner <id> [--since <iso>] [--limit <N>]
```
- runner 의 큐 파일 (`runners/state/<id>-wake.queue.jsonl`) 를 읽고 마지막 `last_polled_at` 이후 이벤트 반환
- 출력: JSON array
  ```json
  [
    {"reason": "tickets/inbox/order_232.md", "kind": "fs.watch.create", "at": "2026-05-10T12:00:00Z"},
    {"reason": "tickets/todo/Todo-300.md", "kind": "fs.watch.move", "at": "2026-05-10T12:00:01Z"}
  ]
  ```
- poll 후 `last_polled_at` 갱신 (큐 파일은 round-robin 으로 size 제한, 기본 200 events)
- 큐 비었으면 `[]` 반환

### `runner-wake.js emit` (boards 내부 / main process 가 호출)
```
node .autoflow/scripts/runner-wake.js emit --runner <id> --reason "<path>" --kind <kind>
```
- 큐 파일에 1줄 append
- 같은 turn 안에 같은 reason 중복은 dedupe (마지막 이벤트만 기록)

### `runner-wake.js notify` (LLM 이 다른 runner 깨우기 — 옵션)
```
node .autoflow/scripts/runner-wake.js notify --target wiki --reason "ticket done: Todo-300"
```
- target runner 의 큐에 wake event 푸시. 예: worker 가 ticket pass 직후 wiki 를 깨워 즉시 sync 유도

## Allowed Paths

- .autoflow/scripts/runner-wake.js (new)
- apps/desktop/src/main.js (fs.watch broadcast → emit 호출 추가)
- .autoflow/agents/ticket-owner-agent.md
- .autoflow/agents/plan-to-ticket-agent.md
- .autoflow/agents/wiki-maintainer-agent.md
- .autoflow/scripts/start-ticket-owner.sh (claim 직전 poll 호출)

## Done When

- [ ] `.autoflow/scripts/runner-wake.js` 가 emit / poll / notify 3개 subcommand 동작
- [ ] 큐 파일 포맷: JSONL, 한 줄 = 1 event, fields = `{ reason, kind, at }`
- [ ] poll 후 `last_polled_at` 자동 갱신 (idempotent — 같은 event 두 번 반환 안 함)
- [ ] main process 의 `ensureBoardWatcher.broadcast` 가 `[wake]` text 주입 외에 `runner-wake.js emit` 도 호출 (hybrid)
- [ ] agent.md 3개에 워크플로 1줄 추가 — startup scan 직전 + 매 turn 끝에 poll 호출
- [ ] worker prompt (buildInitialPrompt) 에도 명시
- [ ] 큐 파일 크기 제한 (기본 200 events, FIFO trim)
- [ ] poll 실패 / 파일 없음 시 0 exit + `[]` 반환 (1원칙)
- [ ] notify 사용 예시 1개: worker `finish-ticket-owner.sh pass` 성공 후 wiki notify

## Verification

- Command: node .autoflow/scripts/runner-wake.js emit --runner worker --reason "tickets/todo/Todo-001.md" --kind fs.watch.create && node .autoflow/scripts/runner-wake.js poll --runner worker

## Notes

- text 주입 (`[wake] <path>`) 은 보강 신호로 유지 — UI 에 보이고 LLM 이 즉시 인지 가능. poll 은 truth source
- order_228 (runner-stage.js) / order_226 (runner-tokens.js) 와 같은 LLM-active-tool 패턴 통일
- 큐 파일은 .gitignored (`runners/state/*-wake.queue.jsonl`)
- 큐 파일 위치는 state 와 같은 폴더 — fs.watch 가 이미 그 폴더를 보고 있어 별도 처리 불필요
- wiki AI 가 ticket-done 에 즉시 반응하도록 `notify` 활용 시, 디바운스 정책은 wiki 측 그대로 유지 (즉시 fire 가 아니라 큐에 모이고 wiki 가 자체 debounce 로 처리)

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
