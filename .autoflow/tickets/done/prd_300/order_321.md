# Autoflow Order

## Order

- ID: order_321
- Title: 진행 중 작업 완료 후 정지 기능
- Status: inbox
- Priority: normal
- Created At: 2026-05-12T08:04:22Z
- Source: autoflow order create

## Request

지금 하던 내용 까지만 작업 하고 종료 할 수 있는 기능이 있었으면 좋겠네

의도: runner를 즉시 kill하는 정지가 아니라, 현재 이미 잡은 ticket/verifier/wiki 작업은 끝까지 처리하고 새 ticket/PRD claim은 막은 뒤 안전하게 종료하는 drain-stop 기능이 필요하다.

## Hints

### Scope

- Autoflow runner stop/drain semantics, worker/verifier/planner interaction, desktop/CLI control surface if applicable

### Allowed Paths

- pending Plan AI inference

### Verification

- Command: runner state와 board queue 기준으로 drain-stop 동작을 재현 검증

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
