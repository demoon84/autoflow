# Autoflow Memo

## Memo

- ID: memo_062
- Title: Reject limit 3회로 변경
- Status: inbox
- Created At: 2026-05-01T22:24:31Z
- Source: autoflow memo create

## Request

reject limit  횟수를 3회로 변경

요청 의미:
- reject auto-replan/retry limit 기본 횟수를 3회로 변경한다.
- 현재 live/runtime common script는 AUTOFLOW_REJECT_MAX_RETRIES 미설정 시 10회를 기본값으로 사용한다.
- ticket별 Retry 섹션의 Max Retries override 동작은 유지하고, 기본값만 3회가 되도록 한다.
- 관련 문서/스캐폴드/검증 smoke가 기본값 또는 기대값을 언급하면 함께 맞춘다.

## Hints

### Scope

- Autoflow reject auto-replan의 기본 retry limit을 3회로 바꾼다. live board script와 runtime board script의 기본값을 동기화하고, scaffold 문서 및 smoke test에서 기본/상한 의미가 어긋나지 않도록 필요한 최소 변경을 한다. AUTOFLOW_REJECT_MAX_RETRIES 환경변수로 명시한 값과 ticket별 Retry/Max Retries override는 유지한다.

### Allowed Paths

- `.autoflow/scripts/common.sh`
- `runtime/board-scripts/common.sh`
- `tests/smoke/ticket-owner-replan-smoke.sh`
- `scaffold/board/AGENTS.md`
- `scaffold/board/agents/plan-to-ticket-agent.md`
- `scaffold/board/automations/README.md`

### Verification

- Command: bash -n .autoflow/scripts/common.sh runtime/board-scripts/common.sh && bash tests/smoke/ticket-owner-replan-smoke.sh

## Planner Contract

- Plan AI treats this memo as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn memo intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
