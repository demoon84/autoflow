# Autoflow Order

## Order

- ID: order_234
- Title: runner-tokens.ts 통합 보강 — agent.md 3개 + prompt + wrapper
- Status: inbox
- Priority: high
- Created At: 2026-05-10T14:27:26Z
- Source: autoflow order create

## Request

# Autoflow Order

## Order

- Title: runner-tokens.ts 통합 보강 — agent.md 3개 + startup prompt + 자동 호출 wrapper
- Priority: high
- Status: ready
- Change Type: code


`runner-tokens.ts` 파일은 이미 작성되어 동작 가능 상태이지만, LLM 프로세스 지시서·시작 prompt·자동 통합이 빠져있어 실 호출이 안 됨. 보강 후 token 카운터가 모든 runner 에서 누적되도록 함.

## 현재 상태 (audit)

- `.autoflow/scripts/runner-tokens.ts` ✅ 존재 (6035 bytes)
- `ticket-owner-agent.md` — 2회 언급 (Active Reporting Tools 섹션). 다만 `runner-tokens.js` 로 표기 (실파일은 `.ts`)
- `plan-to-ticket-agent.md` ❌ 0회 — planner 도 token 누적되어야 하는데 누락
- `wiki-maintainer-agent.md` ❌ 0회 — wiki 도 누락
- `apps/desktop/src/main.js` 의 `buildInitialPrompt` ❌ 명시 없음 — worker/planner/wiki 어느 케이스에도
- `start-ticket-owner.sh` / `finish-ticket-owner.sh` ❌ 자동 호출 wrapper 없음

결과: worker 가 agent.md 를 잘 읽어도 `.js` 호출은 wrapper 없이 실패. planner/wiki 는 안내조차 없어 호출 시도 안 함.

## Allowed Paths

- .autoflow/agents/ticket-owner-agent.md
- .autoflow/agents/plan-to-ticket-agent.md
- .autoflow/agents/wiki-maintainer-agent.md
- apps/desktop/src/main.js
- .autoflow/scripts/start-ticket-owner.sh
- .autoflow/scripts/finish-ticket-owner.sh
- runtime/board-scripts/start-ticket-owner.sh
- runtime/board-scripts/finish-ticket-owner.sh

## Done When

- [ ] **표기 정정**: ticket-owner-agent.md 의 `runner-tokens.js` → `runner-tokens.ts` (실행은 `tsx` 또는 wrapper 경유 표기). 본문의 호출 예시도 정정.
- [ ] **plan-to-ticket-agent.md 보강**: ticket-owner-agent.md 의 "Active Reporting Tools" 섹션과 동일한 형태로 runner-stage / runner-wake / runner-tokens 3종 호출 의무 명시 (planner 컨텍스트에 맞게: planning / generating-todo / idle stage 명).
- [ ] **wiki-maintainer-agent.md 보강**: 동일 섹션 추가 (wiki 컨텍스트: syncing / idle stage 명, runner-tokens 사용 동일).
- [ ] **buildInitialPrompt 보강**: `apps/desktop/src/main.js` 의 worker / planner / wiki 3개 케이스에 1줄 추가 — "After every turn, also call `node node_modules/.bin/tsx .autoflow/scripts/runner-tokens.ts report --runner <id> --tick-id <unique> --input N --output N` to push token usage from your TUI status bar."
- [ ] **자동 호출 wrapper (선택)**: `finish-ticket-owner.sh pass` 직후 / `start-ticket-owner.sh` claim 직후에 runner-tokens.ts 를 호출하는 hook 추가. LLM 의지 없이도 상태 전환 시점마다 token 누적 보장. 인자가 부족할 때 (LLM 이 token 수 모름) skip exit 0 (1원칙).
- [ ] **wrapper 검증**: 어떤 경로로 호출하든 (LLM Bash tool / shell / hook) `tsx` 가 없는 환경에서도 0 exit + stderr 경고만 (board 흐름 차단 금지).
- [ ] runtime/board-scripts/ 미러도 동기화 (autoflow upgrade 호환).

## Verification

- Command: rg -n "runner-tokens" .autoflow/agents/*.md apps/desktop/src/main.js .autoflow/scripts/start-ticket-owner.sh .autoflow/scripts/finish-ticket-owner.sh

## Notes

- runner-stage / runner-wake 도 같은 패턴으로 plan-to-ticket / wiki-maintainer 에 누락된 가능성 — 같이 점검해 함께 추가
- 표기 통일 원칙: 코드는 `.ts`, 호출은 `node node_modules/.bin/tsx <path>` 또는 `tsx <path>` 표준화. 사용자 노출 인터페이스는 `tsx` (npm/Node 친숙)
- 자동 호출 hook 의 인자: 토큰 정보를 hook 단계에서 알 수 없으므로 `--note "auto-from-finish"` 정도만 박고 input/output=0 으로 호출하면 runner-tokens.ts 가 turn=0 으로 skip — 의미 없음. 따라서 hook 은 LLM 가 직접 호출하는 보강 패턴이지 대체 패턴은 아님. 진짜 fallback 은 session log token watcher (별도 PRD-L).

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
