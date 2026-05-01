# Autoflow Memo

## Memo

- ID: memo_055
- Title: Done When 완료 항목 체크 표시
- Status: inbox
- Created At: 2026-05-01T00:27:58Z
- Source: autoflow memo create

## Request

Done When에 완료가 되면 완료된 항목은 체크 표시가 되야함

## Hints

### Scope

- Ticket Owner/verification completion flow에서 Done When 체크리스트 항목이 실제로 충족되면 해당 항목을 unchecked 상태로 남기지 말고 ticket 문서에서 [x] 체크 표시로 갱신한다. 미충족 항목은 [ ] 상태로 남겨 검증/반려 판단 근거가 보이게 한다.

### Allowed Paths

- `.autoflow/agents/ticket-owner-agent.md`
- `.autoflow/agents/verifier-agent.md`
- `.autoflow/reference/ticket-template.md`
- `runtime/board-scripts`
- `.autoflow/scripts`

### Verification

- Command: rg -n "Done When|\[x\]|\[ \]" .autoflow/agents .autoflow/reference runtime/board-scripts .autoflow/scripts && bash tests/smoke/ticket-owner-smoke.sh

## Planner Contract

- Plan AI treats this memo as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn memo intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
