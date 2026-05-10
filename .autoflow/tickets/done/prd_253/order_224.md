# Autoflow Order

## Order

- ID: order_224
- Title: LLM 능동 stage 보고 runner-stage.js
- Status: inbox
- Priority: high
- Created At: 2026-05-10T11:04:39Z
- Source: autoflow order create

## Request

# Autoflow Order

## Order

- Title: LLM 이 호출하는 runner-stage.js 로 진행 상태 능동 보고
- Priority: high
- Status: ready
- Change Type: code


현재 worker / planner / wiki 카드의 progress slider 가 항상 "대기" 에 머무는 회귀가 반복된다. 원인은 PTY 모드에선 legacy run-role.sh 가 쓰던 `active_stage` / `active_ticket_id` state 필드를 갱신하는 주체가 없고, `enrichRunnerActiveTicketFromFs` 같은 filesystem 추론 enrichment 는 다른 worker 의 main.js 편집과 충돌하면서 자주 회귀.

**해결책**: LLM 자체가 작업 단계 전환 시점에 `runner-stage.js` 를 호출해 state 를 능동 갱신. inference 가 아니라 explicit signal 이라 race / cache / 회귀에서 자유.

기본 워크플로:
```
worker (ticket-owner)
  claim → runner-stage.js inprogress --ticket Todo-NNN
  verify pass → runner-stage.js verifying
  merge → runner-stage.js merging
  finish-ticket-owner pass → runner-stage.js done
  reject → runner-stage.js blocked --note "<reason>"

planner
  inbox/backlog 처리 시작 → runner-stage.js planning --ticket order_NNN | prd_NNN
  todo 생성 완료 → runner-stage.js done
  idle 진입 → runner-stage.js idle

wiki
  source 변화 감지 → runner-stage.js syncing
  baseline 갱신 완료 → runner-stage.js done
  adapter 오류 → runner-stage.js blocked
```

## Allowed Paths

- .autoflow/scripts/runner-stage.js (new)
- .autoflow/agents/ticket-owner-agent.md
- .autoflow/agents/plan-to-ticket-agent.md
- .autoflow/agents/wiki-maintainer-agent.md
- apps/desktop/src/main.js
- apps/desktop/src/renderer/main.tsx

## Done When

- [ ] 새 스크립트 `.autoflow/scripts/runner-stage.js` 가 다음 인터페이스로 동작:
      `runner-stage.js <stage> [--runner <id>] [--ticket <ticket-id>] [--note <text>]`
      - 인자 없을 때 `runner` 는 환경변수 `AUTOFLOW_RUNNER_ID` 또는 `runners/state/` 에서 현재 PTY 가 잡은 ticket 으로 자동 추론
      - state 파일 (`runners/state/<runner>.state`) 의 `active_stage`, `active_ticket_id`, `active_ticket_title`, `last_event_at` 갱신
      - ticket-id 가 주어지면 `tickets/inprogress/<ticket-id>.md` (또는 inbox/backlog) 에서 Title 을 읽어 active_ticket_title 도 같이 채움
      - JSONL event 로그 `runners/logs/<runner>-stage.log` 에 한 줄 추가 (stage 전환 audit)
- [ ] `ticket-owner-agent.md` 의 워크플로 섹션에 위 명시 — claim 직후 / verify 직후 / merge 직후 / pass 직후 각 단계에서 `runner-stage.js` 호출 의무
- [ ] `plan-to-ticket-agent.md` / `wiki-maintainer-agent.md` 에도 동일 패턴 명시
- [ ] desktop 의 startup prompt (`buildInitialPrompt` in `apps/desktop/src/main.js`) 에도 "after each phase, call runner-stage.js" 단계 추가
- [ ] 데스크톱 UI 가 state.active_stage 를 그대로 슬라이더에 매핑 — 별도 enrichment 함수 없이 LLM 이 쓴 값 그대로 표시
- [ ] PTY 모드 / legacy 모드 둘 다 호환 — 스크립트는 mode 에 무관하게 state 파일을 직접 갱신
- [ ] script 호출 실패 (state 파일 없음 등) 시 0 exit + stderr 경고만 — LLM 의 메인 흐름 차단 금지 (1원칙)

## Verification

- Command: node .autoflow/scripts/runner-stage.js inprogress --runner worker --ticket Todo-001 && cat .autoflow/runners/state/worker.state | grep active_

## Notes

- 기존 `enrichRunnerActiveTicketFromFs` 와 같은 filesystem inference 함수는 fallback 으로만 남겨두고 (LLM 이 호출 안 한 경우 대비), primary 신호는 능동 보고 방식
- script 가 PROJECT_ROOT 기준으로 동작해야 worker / wiki 양쪽에서 같은 경로 사용 가능
- LLM 이 매 단계 호출 안 하더라도 최소한 claim 직후 1회만 부르면 inprogress 진입은 보장됨
- 데스크톱 main.js 의 ipcMain.handle 에 fs.watch 가 이미 state 파일 변경 감지하므로, runner-stage.js 가 state 쓰면 자동으로 UI 새로고침 됨 (별도 IPC 추가 불필요)

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
