# Autoflow Order

## Order

- ID: order_228
- Title: runner-stage.js 실제 구현 + start-ticket-owner 통합 (PRD_253 재발행)
- Status: inbox
- Priority: critical
- Created At: 2026-05-10T11:25:07Z
- Source: autoflow order create

## Request

# Autoflow Order

## Order

- Title: runner-stage.js 실제 구현 + start-ticket-owner 통합 (PRD_253 false-pass 재발행)
- Priority: critical
- Status: ready
- Change Type: code


PRD_253 / Todo-257 (LLM 능동 stage 보고) 가 가짜 완료 처리됨:
- Done When 7개 모두 `[x]` 체크됨
- Stage: done
- Tickets/done/prd_253/Todo-257.md 로 이동됨

하지만 **실제 산출물은 하나도 없음**:
- `.autoflow/scripts/runner-stage.js` 파일 없음
- agent.md 3개 (ticket-owner / planner / wiki-maintainer) 어디에도 runner-stage 언급 없음
- `start-ticket-owner.sh` / `finish-ticket-owner.sh` 에 호출 없음
- `apps/desktop/src/main.js` buildInitialPrompt 에도 없음

결과: state 파일의 `active_ticket_id` 가 절대 업데이트되지 않아 worker 카드가 stale 한 ticket id 를 영원히 보여줌. UI 가 Todo-257 을 표시하지만 실제로는 Todo-259 작업 중.

## Allowed Paths

- .autoflow/scripts/runner-stage.js (new)
- .autoflow/scripts/start-ticket-owner.sh
- .autoflow/scripts/finish-ticket-owner.sh
- .autoflow/agents/ticket-owner-agent.md
- .autoflow/agents/plan-to-ticket-agent.md
- .autoflow/agents/wiki-maintainer-agent.md
- apps/desktop/src/main.js
- runtime/board-scripts/start-ticket-owner.sh
- runtime/board-scripts/finish-ticket-owner.sh

## Done When

- [ ] 파일 존재 + 실행 가능: `node .autoflow/scripts/runner-stage.js --help` 가 0 exit 으로 사용법 출력
- [ ] 인터페이스: `node runner-stage.js <stage> [--runner <id>] [--ticket <ticket-id>] [--note <text>]` 동작
- [ ] 단위 테스트로 검증: 임시 boardRoot 만들어 `node runner-stage.js inprogress --runner worker --ticket Todo-001` 실행 후 `worker.state` 의 `active_stage=inprogress`, `active_ticket_id=Todo-001`, `active_ticket_title` (ticket md 의 Title 값) 모두 갱신됨을 grep 으로 확인
- [ ] **claim 자동 통합**: `start-ticket-owner.sh` 가 ticket claim 후 마지막에 `node "$BOARD_ROOT/scripts/runner-stage.js" inprogress --runner "$RUNNER_ID" --ticket "$TICKET_ID"` 자동 호출 (LLM 의지에 의존 안 함). 실패해도 main 흐름 차단 안 함 (1원칙)
- [ ] **finish 자동 통합**: `finish-ticket-owner.sh` 의 pass 분기에서 done 이동 직후 `runner-stage.js idle --runner ...` 호출
- [ ] **prompt 명시**: `apps/desktop/src/main.js` buildInitialPrompt 의 worker 케이스에 "after each phase, also call `node .autoflow/scripts/runner-stage.js <stage>`" 추가
- [ ] agent.md 3개에 워크플로 1줄 명시
- [ ] **가짜 pass 방지 검증**: 이 ticket 의 pass 호출 시 sanity gate 가 다음 셸 검증을 추가 통과해야 함:
      `test -x .autoflow/scripts/runner-stage.js && grep -q "runner-stage" .autoflow/scripts/start-ticket-owner.sh`
      이 검증이 finish-ticket-owner 에서 실패하면 false-pass 로 차단됨

## Verification

- Command: test -x .autoflow/scripts/runner-stage.js && node .autoflow/scripts/runner-stage.js --help && grep -q "runner-stage" .autoflow/scripts/start-ticket-owner.sh && echo "PASS" || echo "FAIL"

## Notes

- 이전 PRD_253 의 가짜 완료를 인지하고 재발행. 같은 실수 반복 방지 위해 Done When 마지막 항목에 셸로 검증 가능한 가드 (test -x, grep) 박음
- claim 자동 통합이 핵심: LLM 이 매 단계마다 호출하길 기다리지 않고 start-ticket-owner.sh 가 강제로 부름. LLM 보고는 보강 (verifying / merging 등 중간 단계용)
- `runtime/board-scripts/` 와 `.autoflow/scripts/` 동기화 둘 다 변경 (autoflow upgrade 가 .js 를 복사하도록)
- 이 ticket 이 false-pass 면 anti-pattern 이 자기 자신에게 적용됨 — worker 가 이걸 통과 못 하게 강하게 박아둠

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
