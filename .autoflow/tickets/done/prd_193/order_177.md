# Autoflow Order

## Order

- ID: order_177
- Title: 저장하고 재시작 버튼 삭제
- Status: archived
- Priority: normal
- Created At: 2026-05-05T23:49:53Z
- Source: autoflow order create

## Request

러너 설정 화면의 '저장하고 재시작' 버튼을 삭제한다. 일반 저장 버튼과 기존 설정 저장 흐름은 유지하고, 재시작을 함께 수행하는 별도 버튼만 화면에서 제거한다.

## Hints

### Scope

- 데스크톱 앱 러너 설정 UI에서 '저장하고 재시작' 액션 버튼만 제거한다. 저장 핸들러와 러너 재시작 관련 내부 로직은 다른 화면/동작에서 쓰일 수 있으므로 불필요하게 삭제하지 않는다.

### Allowed Paths

- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`

### Verification

- Command: npm run desktop:check

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.

## Archive

- Archived By: planner
- Archived At: 2026-05-06T00:07:59Z
- Generated PRD: `tickets/done/prd_193/prd_193.md`
- Generated Ticket: `tickets/todo/Todo-192.md`
