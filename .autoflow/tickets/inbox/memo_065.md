# Autoflow Order

## Order

- ID: order_065
- Title: 완료 커밋 메시지에 PRD와 ticket 번호 모두 포함
- Status: inbox
- Created At: 2026-05-02T00:40:25Z
- Source: $order intake

## Request

한개의 PRD에 todo가 여러개 나올수 있으니 [PRD_숫자][ticket_숫자] 작업내용 요약 이렇게 커밋메세지를 작성

요청 의미:
- 하나의 PRD에서 여러 todo/ticket이 생성될 수 있으므로 완료 커밋 메시지가 PRD 번호만으로는 부족하다.
- Autoflow pass/completion commit subject를 [PRD_숫자][ticket_숫자] 작업내용 요약 형식으로 만든다.
- 예: [PRD_123][ticket_456] 작업내용 요약
- PRD key와 ticket id는 실제 티켓의 PRD Key / ID에서 가져오고, summary는 기존처럼 pass summary 또는 Result.Summary 기반 한 줄 요약을 사용한다.
- 대소문자와 구분자는 사용자가 지정한 형태를 따른다: PRD는 대문자 PRD_, ticket은 소문자 ticket_.

## Hints

### Scope

- Ticket Owner/merge finalizer가 만드는 local completion commit 메시지 형식을 [PRD_NNN][ticket_NNN] <요약> 으로 변경한다. finish-ticket-owner와 merge-ready-ticket의 live/runtime copies, legacy verifier/run-hook guidance, owner/verifier contract 문서, 관련 smoke assertion을 함께 맞춘다. PRD Key가 없는 legacy ticket의 fallback도 정의하되, 일반 ticket에서는 PRD와 ticket 번호가 둘 다 반드시 보이게 한다.

### Allowed Paths

- `.autoflow/scripts/finish-ticket-owner.sh`
- `runtime/board-scripts/finish-ticket-owner.sh`
- `.autoflow/scripts/merge-ready-ticket.sh`
- `runtime/board-scripts/merge-ready-ticket.sh`
- `.autoflow/scripts/run-hook.sh`
- `runtime/board-scripts/run-hook.sh`
- `scaffold/board/AGENTS.md`
- `scaffold/board/agents/ticket-owner-agent.md`
- `scaffold/board/agents/verifier-agent.md`
- `scaffold/board/protocols/owner-contract.md`
- `scaffold/board/automations/templates/verifier-heartbeat.template.toml`
- `tests/smoke/ticket-owner-smoke.sh`

### Verification

- Command: bash -n .autoflow/scripts/finish-ticket-owner.sh runtime/board-scripts/finish-ticket-owner.sh .autoflow/scripts/merge-ready-ticket.sh runtime/board-scripts/merge-ready-ticket.sh .autoflow/scripts/run-hook.sh runtime/board-scripts/run-hook.sh && bash tests/smoke/ticket-owner-smoke.sh

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
